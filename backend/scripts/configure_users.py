"""Print an environment-ready user record without echoing the password."""
import getpass
import hashlib
import json
import secrets

if __name__ == '__main__':
    users = {}
    for role in ('creator', 'manager', 'admin'):
        email = input(f'{role} email: ').strip()
        password = getpass.getpass(f'{role} password (12+ characters): ')
        if not email or len(password) < 12:
            raise SystemExit('Use a nonempty email and a password of at least 12 characters.')
        salt = secrets.token_hex(16)
        users[email] = {'role': role, 'passwordHash': salt + ':' + hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 600000).hex()}
    print('SESSION_SECRET=' + secrets.token_hex(32))
    print('BRANDGUARD_USERS=' + json.dumps(users, separators=(',', ':')))
