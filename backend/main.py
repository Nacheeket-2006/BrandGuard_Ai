import base64
import hashlib
import hmac
import io
import json
import logging
import os
import secrets
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel, Field
from pypdf import PdfReader
from sqlalchemy import Column, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Session
from sqlalchemy.exc import IntegrityError
from starlette.concurrency import run_in_threadpool

if __package__:
    from .engine import analyze, chunks_for, embed_guideline, py_index, score, uid, utf16
else:
    from engine import analyze, chunks_for, embed_guideline, py_index, score, uid, utf16

BACKEND_DIR = Path(__file__).resolve().parent
ROOT = BACKEND_DIR.parent if (BACKEND_DIR.parent / 'frontend').is_dir() else BACKEND_DIR
GUIDELINES_FILE = ROOT / 'frontend/shared/guidelines.json'
if not GUIDELINES_FILE.is_file():
    GUIDELINES_FILE = BACKEND_DIR / 'shared/guidelines.json'
DEMO = os.getenv('DEMO_MODE', 'true').lower() == 'true'
SECRET = os.getenv('SESSION_SECRET') or secrets.token_hex(32)
ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8000').split(',')
if not DEMO and (len(os.getenv('SESSION_SECRET', '')) < 32 or not os.getenv('BRANDGUARD_USERS')):
    raise RuntimeError('Production requires SESSION_SECRET (32+ chars) and BRANDGUARD_USERS JSON.')
USERS = json.loads(os.getenv('BRANDGUARD_USERS', '{}'))
DATABASE = os.getenv('DATABASE_URL', 'sqlite:///' + str(ROOT / 'backend/brandguard.db').replace('\\', '/'))
engine = create_engine(DATABASE, connect_args={'check_same_thread': False, 'timeout': 20} if DATABASE.startswith('sqlite') else {}, pool_pre_ping=True)


class Base(DeclarativeBase): pass


class Record(Base):
    __tablename__ = 'records'
    id = Column(String(64), primary_key=True)
    kind = Column(String(32), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    body = Column(Text, nullable=False)


@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        if not db.get(Record, 'settings:initialized'):
            for g in json.loads(GUIDELINES_FILE.read_text(encoding='utf-8')):
                g = await embed_guideline(g)
                db.add(Record(id=g['id'], kind='guideline', body=json.dumps(g)))
            db.add(Record(id='settings:initialized', kind='setting', body='{}'))
            db.commit()
        for row in db.scalars(select(Record).where(Record.kind == 'guideline')):
            row.body = json.dumps(await embed_guideline(json.loads(row.body)))
        db.commit()
    yield


app = FastAPI(title='BrandGuard AI', version='1.0.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_credentials=True, allow_methods=['GET', 'POST', 'PATCH'], allow_headers=['Content-Type', 'X-Demo-Role'])
limits = {}
limit_lock = threading.Lock()


@app.middleware('http')
async def security(request: Request, call_next):
    if request.method in ('POST', 'PATCH', 'DELETE') and request.headers.get('origin') and request.headers['origin'] not in ORIGINS:
        return Response('Untrusted origin', status_code=403)
    if int(request.headers.get('content-length', '0')) > 8_000_000:
        return Response('Request too large', status_code=413)
    if request.url.path.startswith('/api'):
        key = request.client.host
        now = time.monotonic()
        with limit_lock:
            for expired in [k for k,v in limits.items() if now - v[0] > 60]:
                del limits[expired]
            start, count = limits.get(key, (now, 0))
            limits[key] = (start, count + 1)
        if count > 119:
            return Response('Rate limit exceeded. Try again in one minute.', status_code=429)
    response = await call_next(request)
    response.headers.update({'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"})
    return response


def actor(request: Request):
    token = request.cookies.get('bg_session', '')
    if DEMO and not token:
        role = request.headers.get('x-demo-role', 'creator')
        if role not in ('creator', 'manager', 'admin'):
            raise HTTPException(403, 'Unknown demo role')
        return {'id': f'demo-{role}', 'role': role, 'demo': True}
    try:
        payload, signature = token.split('.')
        expected = hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected): raise ValueError()
        user = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
        entry = account(user['id'])
        if user['exp'] < time.time() or not entry: raise ValueError()
        return {'id': user['id'], 'role': entry['role'], 'name': entry.get('name', user['id']), 'demo': False}
    except (ValueError, KeyError, TypeError, UnicodeError):
        raise HTTPException(401, 'Sign in to continue')


def require(user, roles):
    if user['role'] not in roles:
        raise HTTPException(403, 'This action requires ' + ' or '.join(roles))


class Login(BaseModel):
    email: str = Field(max_length=200)
    password: str = Field(max_length=500)


def account(email):
    normalized = email.strip().casefold()
    entry = next((v for k,v in USERS.items() if k.casefold() == normalized), None)
    if entry: return entry
    with Session(engine) as db:
        row = db.get(Record, 'user:' + hashlib.sha256(normalized.encode()).hexdigest())
        return json.loads(row.body) if row and row.kind == 'user' else None


def registration_enabled():
    return DEMO or os.getenv('ALLOW_REGISTRATION', 'false').lower() == 'true'


def signed_in(email, entry, response):
    payload = base64.urlsafe_b64encode(json.dumps({'id': email, 'exp': time.time() + 8 * 3600}).encode()).decode().rstrip('=')
    token = payload + '.' + hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    response.set_cookie('bg_session', token, httponly=True, secure=not DEMO, samesite='strict', max_age=8 * 3600, path='/')
    return {'id': email, 'role': entry['role'], 'name': entry.get('name', email), 'demo': False}


@app.post('/api/v1/auth/login')
def login(body: Login, response: Response):
    email = body.email.strip().casefold()
    entry = account(email)
    salt, expected = (entry or {}).get('passwordHash', 'missing:missing').split(':', 1)
    actual = hashlib.pbkdf2_hmac('sha256', body.password.encode(), salt.encode(), 600000).hex()
    if not entry or not hmac.compare_digest(actual, expected):
        raise HTTPException(401, 'Invalid email or password')
    return signed_in(email, entry, response)


class Registration(BaseModel):
    model_config = {'extra': 'forbid'}
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=6, max_length=254, pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
    password: str = Field(min_length=12, max_length=128)


@app.post('/api/v1/auth/register', status_code=201)
def register(body: Registration, response: Response):
    if not registration_enabled(): raise HTTPException(403, 'Registration is closed. Contact your workspace administrator.')
    name, email = body.name.strip(), body.email.strip().casefold()
    if len(name) < 2: raise HTTPException(422, 'Enter a name of at least two characters')
    if account(email): raise HTTPException(409, 'An account already exists for this email. Sign in instead.')
    salt = secrets.token_hex(16)
    entry = {'name': name, 'email': email, 'role': 'creator', 'passwordHash': salt + ':' + hashlib.pbkdf2_hmac('sha256', body.password.encode(), salt.encode(), 600000).hex(), 'createdAt': time.time()}
    with Session(engine) as db:
        db.add(Record(id='user:' + hashlib.sha256(email.encode()).hexdigest(), kind='user', body=json.dumps(entry)))
        try: db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, 'An account already exists for this email. Sign in instead.')
    return signed_in(email, entry, response)


@app.post('/api/v1/auth/logout')
def logout(response: Response):
    response.delete_cookie('bg_session')
    return {'ok': True}


@app.get('/api/v1/health')
def health():
    return {'status': 'ok', 'demo': DEMO, 'registrationEnabled': registration_enabled(), 'aiMode': os.getenv('AI_MODE', 'offline'), 'vectorStore': 'FAISS', 'version': '1.0.0'}


@app.get('/api/v1/auth/me')
def me(user=Depends(actor)):
    return user


def guidelines(db):
    return [json.loads(r.body) for r in db.scalars(select(Record).where(Record.kind == 'guideline'))]


@app.get('/api/v1/guidelines')
def list_guidelines(user=Depends(actor)):
    with Session(engine) as db:
        return [{k:v for k,v in g.items() if k != 'vectors'} for g in guidelines(db)]


class Guideline(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=100)
    citation: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=60000)
    active: bool = True
    rules: list[dict] = Field(default_factory=list, max_length=100)
    colors: list[str] = Field(default_factory=list, max_length=30)
    logoPositions: list[str] = Field(default_factory=list, max_length=10)


def validate_guideline(g):
    import re
    # Offline rules are literal phrases only for uploaded data (no untrusted regex execution).
    for r in g['rules']:
        if not all(isinstance(r.get(k), str) and len(r[k]) <= 2000 for k in ('pattern', 'replacement', 'explanation')) or not r['pattern']:
            raise HTTPException(422, 'Each rule requires pattern, replacement, and explanation strings')
        if r.get('severity') not in ('low', 'medium', 'high'):
            raise HTTPException(422, 'Rule severity must be low, medium, or high')
        r['pattern'] = re.escape(r['pattern'])
    if any(not re.fullmatch(r'#[0-9A-Fa-f]{6}', c) for c in g['colors']):
        raise HTTPException(422, 'Colors must use six-digit hex notation')
    return g


@app.post('/api/v1/guidelines', status_code=201)
async def create_guideline(body: Guideline, user=Depends(actor)):
    require(user, ('admin', 'manager'))
    g = await embed_guideline({**validate_guideline(body.model_dump()), 'id': uid()})
    with Session(engine) as db:
        db.add(Record(id=g['id'], kind='guideline', body=json.dumps(g)))
        db.commit()
    return {**{k:v for k,v in g.items() if k != 'vectors'}, 'chunkCount': len(chunks_for([g]))}


@app.post('/api/v1/guidelines/upload', status_code=201)
async def upload(file: UploadFile, user=Depends(actor)):
    require(user, ('admin', 'manager'))
    raw = await file.read(4_000_001)
    if len(raw) > 4_000_000: raise HTTPException(413, 'Maximum guideline size is 4 MB')
    suffix = Path(file.filename or '').suffix.lower()
    try:
        if suffix == '.json':
            body = Guideline.model_validate(json.loads(raw))
        else:
            if suffix == '.pdf':
                reader = await run_in_threadpool(PdfReader, io.BytesIO(raw))
                if len(reader.pages) > 100: raise ValueError('PDF limited to 100 pages')
                text = await run_in_threadpool(lambda: '\n'.join(p.extract_text() or '' for p in reader.pages))
            elif suffix in ('.md', '.txt'):
                text = raw.decode('utf-8')
            else: raise ValueError('Use PDF, Markdown, TXT, or structured JSON')
            body = Guideline(title=Path(file.filename).stem[:120], category='Custom guideline', citation='Source: ' + file.filename[:180], content=text.strip())
        return await create_guideline(body, user)
    except HTTPException: raise
    except Exception as exc:
        raise HTTPException(422, 'Unable to ingest guideline. Use readable text PDF, UTF-8 Markdown, or the documented JSON schema.') from exc


class Active(BaseModel): active: bool


@app.patch('/api/v1/guidelines/{gid}')
def toggle(gid: str, body: Active, user=Depends(actor)):
    require(user, ('admin', 'manager'))
    with Session(engine) as db:
        row = db.get(Record, gid)
        if not row or row.kind != 'guideline': raise HTTPException(404, 'Guideline not found')
        g = json.loads(row.body); g['active'] = body.active
        row.body = json.dumps(g); row.version += 1
        db.commit()
        return {k:v for k,v in g.items() if k != 'vectors'}


class Visual(BaseModel):
    colors: list[str] = Field(default_factory=list, max_length=20)
    logoPosition: str = Field(default='', max_length=40)
    image: str = Field(default='', max_length=6_000_000)


class Draft(BaseModel):
    title: str = Field(default='Untitled draft', max_length=200)
    channel: str = Field(default='LinkedIn post', max_length=100)
    text: str = Field(min_length=1, max_length=20000)
    visual: Visual = Field(default_factory=Visual)


def validate_image(visual):
    if not visual.get('image'): return
    try:
        prefix, content = visual['image'].split(',', 1)
        if prefix not in ('data:image/png;base64', 'data:image/jpeg;base64', 'data:image/webp;base64'): raise ValueError()
        image = Image.open(io.BytesIO(base64.b64decode(content, validate=True)))
        if image.width * image.height > 20_000_000 or image.format not in ('PNG', 'JPEG', 'WEBP'): raise ValueError()
        image.verify()
    except Exception:
        raise HTTPException(422, 'Supply a valid PNG, JPEG, or WebP image below 20 megapixels')


def event(r, user, action, detail=''):
    r['events'].append({'id': uid(), 'at': time.time(), 'actor': user['id'], 'role': user['role'], 'action': action, 'detail': detail, 'version': r['version']})


def policy_hash(gs):
    return hashlib.sha256(json.dumps([{k:v for k,v in g.items() if k not in ('vectors','embeddingModel')} for g in sorted(gs, key=lambda g:g['id'])], sort_keys=True).encode()).hexdigest()


@app.post('/api/v1/review', status_code=201)
async def review(body: Draft, user=Depends(actor)):
    require(user, ('creator', 'admin'))
    visual = body.visual.model_dump()
    await run_in_threadpool(validate_image, visual)
    with Session(engine) as db: gs = guidelines(db)
    try:
        result = await analyze(body.text, visual, gs)
    except Exception as exc:
        logging.exception('Review failed')
        raise HTTPException(503, 'Audit unavailable. Check the provider configuration and retry; no compliance result was issued.') from exc
    r = {**body.model_dump(), **result, 'id': uid(), 'owner': user['id'], 'original': body.text, 'originalVisual': visual, 'createdAt': time.time(), 'version': 1, 'status': 'draft', 'events': [], 'score': score(result['issues']), 'policyHash': policy_hash(gs), 'comment': ''}
    event(r, user, 'Audit completed', f"{len(r['issues'])} findings · {r['mode']} engine")
    with Session(engine) as db:
        db.add(Record(id=r['id'], kind='review', version=1, body=json.dumps(r)))
        db.commit()
    return r


def get_review(db, rid, user):
    row = db.get(Record, rid)
    if not row or row.kind != 'review': raise HTTPException(404, 'Review not found')
    r = json.loads(row.body)
    if user.get('demo') and not r['owner'].startswith('demo-'): raise HTTPException(404, 'Review not found')
    if user['role'] == 'creator' and r['owner'] != user['id']: raise HTTPException(404, 'Review not found')
    return row, r


@app.get('/api/v1/reviews')
def reviews(user=Depends(actor)):
    with Session(engine) as db:
        result = [json.loads(r.body) for r in db.scalars(select(Record).where(Record.kind == 'review'))]
    return sorted([r for r in result if (not user.get('demo') or r['owner'].startswith('demo-')) and (user['role'] != 'creator' or r['owner'] == user['id'])], key=lambda r:r['createdAt'], reverse=True)


@app.get('/api/v1/reviews/{rid}')
def read_review(rid: str, user=Depends(actor)):
    with Session(engine) as db: return get_review(db, rid, user)[1]


class Action(BaseModel):
    version: int
    action: Literal['accept', 'reject', 'reopen', 'submit', 'approve', 'return']
    issueId: str = ''
    comment: str = Field(default='', max_length=3000)


@app.post('/api/v1/reviews/{rid}/actions')
async def act(rid: str, body: Action, user=Depends(actor)):
    with Session(engine) as db:
        row, r = get_review(db, rid, user)
        if body.version != row.version: raise HTTPException(409, 'This review changed. Refresh before continuing.')
        r['version'] += 1
        if body.action in ('approve', 'return'):
            require(user, ('manager', 'admin'))
            if r['status'] != 'pending': raise HTTPException(409, 'Only submitted reviews can be signed off')
            if body.action == 'approve':
                if user['id'] == r['owner']: raise HTTPException(403, 'A separate manager must approve this review')
                if r['policyHash'] != policy_hash(guidelines(db)): raise HTTPException(409, 'Guidelines changed. Return the draft for a fresh audit.')
                if any(i['status'] != 'accepted' for i in r['issues']): raise HTTPException(409, 'Unresolved findings prevent publication approval')
                if r['visual'].get('image') and r['visualCoverage'] != 'image + metadata': raise HTTPException(409, 'An image requires live visual review before sign-off')
            elif not body.comment.strip(): raise HTTPException(422, 'Explain the requested changes')
            r['status'] = 'approved' if body.action == 'approve' else 'returned'
            event(r, user, 'Approved for publication' if body.action == 'approve' else 'Changes requested', body.comment)
        else:
            require(user, ('creator', 'admin'))
            if r['owner'] != user['id']: raise HTTPException(403, 'Only the draft owner can revise it')
            if r['status'] not in ('draft', 'returned'): raise HTTPException(409, 'Submitted and approved revisions are locked')
            if body.action == 'submit':
                if any(i['status'] == 'open' for i in r['issues']): raise HTTPException(409, 'Resolve or reject open findings before handoff')
                if r['policyHash'] != policy_hash(guidelines(db)): raise HTTPException(409, 'Guidelines changed. Run a new audit.')
                # Re-check the resulting content; model rewrites are untrusted too.
                try:
                    final = await analyze(r['text'], r['visual'], guidelines(db))
                except Exception as exc:
                    raise HTTPException(503, 'Final verification unavailable. Retry before handoff.') from exc
                rejected_snippets = {(i['flaggedText'], i['ruleCitation']) for i in r['issues'] if i['status'] == 'rejected'}
                if any((i['flaggedText'],i['ruleCitation']) not in rejected_snippets for i in final['issues']):
                    raise HTTPException(409, 'Final verification found additional risks. Run a fresh audit before handoff.')
                r['visualCoverage'] = final['visualCoverage']
                r['status'] = 'pending'; r['comment'] = body.comment
                event(r, user, 'Sent for manager approval', body.comment)
            else:
                issue = next((i for i in r['issues'] if i['id'] == body.issueId), None)
                if not issue: raise HTTPException(404, 'Finding not found')
                if body.action == 'reopen':
                    if issue['status'] != 'rejected': raise HTTPException(409, 'Only rejected findings can be reopened')
                    issue['status'] = 'open'
                else:
                    if issue['status'] != 'open': raise HTTPException(409, 'Finding already decided')
                    if body.action == 'accept':
                        if issue['target'] == 'visual': raise HTTPException(409, 'Update the artwork and run a new audit; an image cannot be repaired by accepting text')
                        start, end = py_index(r['text'], issue['startIndex']), py_index(r['text'], issue['endIndex'])
                        if r['text'][start:end] != issue['flaggedText']: raise HTTPException(409, 'Stale finding. Re-audit this revision.')
                        r['text'] = r['text'][:start] + issue['suggestedRewrite'] + r['text'][end:]
                        delta = utf16(issue['suggestedRewrite']) - (issue['endIndex'] - issue['startIndex'])
                        for other in r['issues']:
                            if other['id'] != issue['id'] and other['target'] == 'text' and other['startIndex'] >= issue['endIndex']:
                                other['startIndex'] += delta; other['endIndex'] += delta
                    issue['status'] = 'accepted' if body.action == 'accept' else 'rejected'
                event(r, user, {'accept':'Accepted suggestion','reject':'Rejected suggestion','reopen':'Reopened finding'}[body.action], issue['flaggedText'])
        r['score'] = score(r['issues'])
        # Compare-and-swap prevents concurrent writers from losing decisions.
        updated = db.query(Record).filter(Record.id == rid, Record.version == body.version).update({'body': json.dumps(r), 'version': r['version']})
        if not updated: raise HTTPException(409, 'Concurrent update; refresh this review')
        db.commit()
        return r


if (ROOT / 'frontend/dist').exists():
    app.mount('/assets', StaticFiles(directory=ROOT / 'frontend/dist/assets'), name='assets')

    @app.get('/{path:path}', include_in_schema=False)
    def frontend(path: str):
        if path.startswith('api/'): raise HTTPException(404, 'Endpoint not found')
        if path in ('favicon.svg', 'theme-init.js'): return FileResponse(ROOT / 'frontend/dist' / path)
        if path == 'brandguard-ai-source.zip': return FileResponse(ROOT / 'frontend/dist/brandguard-ai-source.zip', filename='brandguard-ai-source.zip')
        return FileResponse(ROOT / 'frontend/dist/index.html')
