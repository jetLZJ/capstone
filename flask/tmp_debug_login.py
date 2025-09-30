import sys
sys.path.insert(0, '.')
from api import create_app
app = create_app({'TESTING': True})
client = app.test_client()
rv = client.post('/api/auth/login', json={'email':'maya.manager@example.com','password':'password'})
print('status', rv.status_code)
try:
    print(rv.get_json())
except Exception:
    print(rv.get_data(as_text=True))
data = rv.get_json() or {}
access = data.get('access_token')
print('access len', len(access) if access else None)
rv2 = client.get('/api/auth/me', headers={'Authorization': f'Bearer {access}'})
print('me status', rv2.status_code)
try:
    print(rv2.get_json())
except Exception:
    print(rv2.get_data(as_text=True))
