import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from backend import main


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('AI_MODE', 'offline')
    monkeypatch.setattr(main, 'DEMO', True)
    test_engine = create_engine('sqlite:///' + str(tmp_path / 'test.db'), connect_args={'check_same_thread': False})
    monkeypatch.setattr(main, 'engine', test_engine)
    main.limits.clear()
    with TestClient(main.app) as c:
        yield c
    test_engine.dispose()


def draft(client, text='Our revolutionary platform costs $29/month for users.'):
    response = client.post('/api/v1/review', json={'text': text, 'title': 'Test campaign'})
    assert response.status_code == 201, response.text
    return response.json()


def action(client, r, action, issue='', role='creator', **kwargs):
    return client.post(f"/api/v1/reviews/{r['id']}/actions", headers={'X-Demo-Role': role}, json={'version': r['version'], 'action': action, 'issueId': issue, **kwargs})


def test_creator_to_manager_signoff(client):
    r = draft(client)
    assert r['score'] == 78
    assert len(r['issues']) == 3
    assert all(i['ruleCitation'] for i in r['issues'])
    original = r['text']
    for issue in list(r['issues']):
        response = action(client, r, 'accept', issue['id'])
        assert response.status_code == 200, response.text
        r = response.json()
    assert r['score'] == 100
    assert r['original'] == original
    assert '$49/month' in r['text'] and 'customers' in r['text']
    r = action(client, r, 'submit', comment='Ready for review').json()
    assert r['status'] == 'pending'
    assert action(client, r, 'approve').status_code == 403
    r = action(client, r, 'approve', role='manager').json()
    assert r['status'] == 'approved'
    assert len(r['events']) == 6
    assert action(client, r, 'accept', r['issues'][0]['id']).status_code == 409


def test_reject_keeps_risk_and_blocks_approval(client):
    r = draft(client, 'Our revolutionary platform.')
    before = r['score']
    r = action(client, r, 'reject', r['issues'][0]['id']).json()
    assert r['score'] == before and r['text'] == r['original']
    r = action(client, r, 'submit').json()
    assert action(client, r, 'approve', role='manager').status_code == 409
    assert action(client, r, 'return', role='manager', comment='Please resolve the tone issue').status_code == 200


def test_out_of_order_replacements_and_emoji(client):
    r = draft(client, '🚀 users love this revolutionary tool for users at $29/month.')
    for issue in reversed(list(r['issues'])):
        r = action(client, r, 'accept', issue['id']).json()
        assert 'text' in r
    assert r['text'] == '🚀 customers love this thoughtfully designed tool for customers at $49/month.'


def test_stale_write_and_duplicate_decision(client):
    r = draft(client)
    updated = action(client, r, 'accept', r['issues'][0]['id']).json()
    assert action(client, r, 'accept', r['issues'][1]['id']).status_code == 409
    assert action(client, updated, 'accept', r['issues'][0]['id']).status_code == 409


def test_open_findings_cannot_be_submitted(client):
    r = draft(client)
    assert action(client, r, 'submit').status_code == 409


def test_guideline_changes_invalidate_signoff(client):
    r = draft(client, 'Clear, helpful content for your team.')
    r = action(client, r, 'submit').json()
    assert client.patch('/api/v1/guidelines/tone', json={'active': False}, headers={'X-Demo-Role': 'manager'}).status_code == 200
    assert action(client, r, 'approve', role='manager').status_code == 409


def test_permissions_and_upload_schema(client):
    assert client.patch('/api/v1/guidelines/tone', json={'active': False}).status_code == 403
    assert client.post('/api/v1/review', json={'text': 'A draft'}, headers={'X-Demo-Role': 'manager'}).status_code == 403
    payload = {'title':'Regional terms', 'category':'Terminology', 'citation':'Section 8', 'content':'Do not use awesome. Use helpful.', 'rules':[{'pattern':'awesome','replacement':'helpful','severity':'low','explanation':'Use grounded language.'}]}
    res = client.post('/api/v1/guidelines/upload', files={'file':('rules.json',json.dumps(payload),'application/json')}, headers={'X-Demo-Role':'admin'})
    assert res.status_code == 201, res.text
    assert res.json()['chunkCount'] == 1 and 'vectors' not in res.json()
    r = draft(client, 'This is awesome.')
    assert r['issues'][0]['ruleCitation'] == 'Section 8'
    assert client.post('/api/v1/guidelines/upload', files={'file':('bad.json','{}')}, headers={'X-Demo-Role':'admin'}).status_code == 422


def test_plain_markdown_and_invalid_pdf(client):
    headers = {'X-Demo-Role':'admin'}
    assert client.post('/api/v1/guidelines/upload', files={'file':('tone.md','# Tone\nBe kind.')}, headers=headers).status_code == 201
    assert client.post('/api/v1/guidelines/upload', files={'file':('bad.pdf','not a pdf')}, headers=headers).status_code == 422


def test_visual_metadata_cannot_be_text_accepted(client):
    r = client.post('/api/v1/review', json={'text':'Our next campaign.', 'visual':{'colors':['#FF0000'],'logoPosition':'center'}}).json()
    assert len(r['issues']) == 2
    assert all(i['target'] == 'visual' for i in r['issues'])
    assert action(client, r, 'accept', r['issues'][0]['id']).status_code == 409


def test_untrusted_origin_invalid_image_and_empty_input(client):
    assert client.post('/api/v1/review', json={'text':'Hello'}, headers={'Origin':'https://untrusted.test'}).status_code == 403
    assert client.post('/api/v1/review', json={'text':'Hello','visual':{'image':'data:image/png;base64,not-an-image'}}).status_code == 422
    assert client.post('/api/v1/review', json={'text':''}).status_code == 422


def test_approved_facts_are_not_flagged(client):
    r = draft(client, 'BrandGuard AI Pro starts at $49/month with 99.9% uptime for customers.')
    assert r['issues'] == [] and r['score'] == 100


def test_authentication_and_review_isolation(client, monkeypatch):
    r = draft(client, 'Hello team.')
    monkeypatch.setattr(main, 'DEMO', False)
    assert client.get('/api/v1/reviews').status_code == 401
    salt = 'test-salt'
    password_hash = main.hashlib.pbkdf2_hmac('sha256', b'strong-password', salt.encode(), 600000).hex()
    monkeypatch.setattr(main, 'USERS', {'creator@example.test':{'role':'creator','passwordHash':salt+':'+password_hash}})
    assert client.post('/api/v1/auth/login', json={'email':'creator@example.test','password':'wrong'}).status_code == 401
    assert client.post('/api/v1/auth/login', json={'email':'creator@example.test','password':'strong-password'}).status_code == 200
    # Secure cookies are deliberately sent only via HTTPS.
    token = client.cookies.get('bg_session')
    response = client.get('/api/v1/reviews/'+r['id'], headers={'Cookie':'bg_session='+token})
    assert response.status_code == 404


def test_no_active_sources_fails_closed(client):
    for g in client.get('/api/v1/guidelines').json():
        client.patch('/api/v1/guidelines/'+g['id'], json={'active':False}, headers={'X-Demo-Role':'admin'})
    assert client.post('/api/v1/review', json={'text':'Something to review.'}).status_code == 503


def test_final_verification_catches_unsafe_rewrites(client):
    payload = {'title':'Bad rewrite test','category':'Terminology','citation':'Test source','content':'Say users instead of awesome.', 'rules':[{'pattern':'awesome','replacement':'users','severity':'low','explanation':'Test replacement introduces another known violation.'}]}
    assert client.post('/api/v1/guidelines', json=payload, headers={'X-Demo-Role':'admin'}).status_code == 201
    r = draft(client, 'Something awesome.')
    r = action(client, r, 'accept', r['issues'][0]['id']).json()
    assert action(client, r, 'submit').status_code == 409


def test_image_requires_actual_vision_before_signoff(client):
    import base64
    import io
    from PIL import Image
    buffer = io.BytesIO()
    Image.new('RGB', (1,1)).save(buffer, format='PNG')
    image = 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode()
    r = client.post('/api/v1/review', json={'text':'Hello team.', 'visual':{'image':image}}).json()
    assert r['visualCoverage'] == 'declared metadata only'
    r = action(client, r, 'submit').json()
    assert action(client, r, 'approve', role='manager').status_code == 409


def test_provider_failure_does_not_issue_review(client, monkeypatch):
    async def unavailable(*args):
        raise RuntimeError('Provider unavailable')
    monkeypatch.setattr(main, 'analyze', unavailable)
    assert client.post('/api/v1/review', json={'text':'Something to review.'}).status_code == 503
    assert client.get('/api/v1/reviews').json() == []


def test_audit_events_reference_resulting_revision(client):
    r = draft(client, 'Something revolutionary.')
    assert r['events'][0]['version'] == 1
    r = action(client, r, 'accept', r['issues'][0]['id']).json()
    assert r['events'][-1]['version'] == r['version'] == 2
    r = action(client, r, 'submit').json()
    assert r['events'][-1]['version'] == r['version'] == 3
