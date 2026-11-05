"""Persistent accounts and the boundary between authenticated and demo roles."""
import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from backend import main


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('AI_MODE', 'offline')
    monkeypatch.setattr(main, 'DEMO', True)
    monkeypatch.setattr(main, 'USERS', {})
    test_engine = create_engine('sqlite:///' + str(tmp_path / 'accounts.db'), connect_args={'check_same_thread': False})
    monkeypatch.setattr(main, 'engine', test_engine)
    main.limits.clear()
    with TestClient(main.app) as c:
        yield c
    test_engine.dispose()


def registration(client, **extra):
    return client.post('/api/v1/auth/register', json={'name':'Test Creator','email':'creator@example.test','password':'long test passphrase', **extra})


def test_registration_persists_hash_and_signs_in(client):
    response = registration(client)
    assert response.status_code == 201
    assert response.json() == {'id':'creator@example.test','name':'Test Creator','role':'creator','demo':False}
    assert 'httponly' in response.headers['set-cookie'].lower()
    assert 'samesite=strict' in response.headers['set-cookie'].lower()
    assert client.get('/api/v1/auth/me').json()['demo'] is False
    with Session(main.engine) as db:
        row = db.scalars(select(main.Record).where(main.Record.kind == 'user')).one()
        entry = json.loads(row.body)
        assert 'long test passphrase' not in row.body
        assert len(entry['passwordHash'].split(':')[1]) == 64
    assert client.post('/api/v1/auth/logout').status_code == 200
    assert client.post('/api/v1/auth/login', json={'email':'CREATOR@example.test','password':'long test passphrase'}).status_code == 200


def test_duplicates_and_password_validation(client):
    assert registration(client).status_code == 201
    assert registration(client, email='CREATOR@example.test').status_code == 409
    assert registration(client, email='not-an-email').status_code == 422
    assert registration(client, email='other@example.test', password='short').status_code == 422
    assert registration(client, email='other@example.test', name='  ').status_code == 422
    assert registration(client, email='other@example.test', role='admin').status_code == 422
    assert client.post('/api/v1/auth/login', json={'email':'creator@example.test','password':'wrong'}).status_code == 401


def test_authenticated_accounts_cannot_select_demo_privileges(client):
    assert registration(client).status_code == 201
    assert client.get('/api/v1/auth/me', headers={'X-Demo-Role':'admin'}).json()['role'] == 'creator'
    assert client.post('/api/v1/guidelines', json={'title':'A','category':'A','citation':'A','content':'A'}, headers={'X-Demo-Role':'admin'}).status_code == 403
    response = client.post('/api/v1/review', json={'text':'Hello team.'})
    assert response.status_code == 201
    review_id = response.json()['id']
    client.post('/api/v1/auth/logout')
    assert client.get('/api/v1/reviews/'+review_id).status_code == 404
    assert client.get('/api/v1/reviews/'+review_id, headers={'X-Demo-Role':'manager'}).status_code == 404
    assert client.get('/api/v1/reviews', headers={'X-Demo-Role':'manager'}).json() == []
    assert registration(client, email='second@example.test').status_code == 201
    assert client.get('/api/v1/reviews/'+review_id).status_code == 404


def test_production_registration_is_explicit_and_cookies_secure(client, monkeypatch):
    monkeypatch.setattr(main, 'DEMO', False)
    monkeypatch.delenv('ALLOW_REGISTRATION', raising=False)
    assert registration(client).status_code == 403
    monkeypatch.setenv('ALLOW_REGISTRATION', 'true')
    response = registration(client)
    assert response.status_code == 201
    assert 'secure' in response.headers['set-cookie'].lower()
    assert client.get('/api/v1/auth/me').status_code == 401  # HTTP cannot send the Secure cookie.


def test_malformed_cookie_never_falls_back_to_demo(client):
    assert client.get('/api/v1/auth/me', headers={'Cookie':'bg_session=broken'}).status_code == 401
