#!/usr/bin/env python3
import json
import urllib.request
import urllib.error

BASE = 'http://localhost:8080'
LOGIN = '/api/auth/login'
MENU = '/api/menu/'
ANALYTICS = '/api/analytics/summary'

creds = {'email': 'maya.manager@example.com', 'password': 'password'}

def post(path, data):
    url = BASE + path
    payload = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode('utf-8')
        except Exception:
            body = ''
        print(f'HTTPError {e.code} for POST {url}:', body)
        raise
    except Exception as e:
        print('Error POST', url, e)
        raise


def get(path, token=None):
    url = BASE + path
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode('utf-8')
        except Exception:
            body = ''
        print(f'HTTPError {e.code} for GET {url}:', body)
        raise
    except Exception as e:
        print('Error GET', url, e)
        raise


def main():
    print('Logging in as manager...')
    login_raw = post(LOGIN, creds)
    print('Login response raw:')
    print(login_raw)
    try:
        login = json.loads(login_raw)
    except Exception:
        print('Failed to parse login JSON')
        return
    token = login.get('access_token') or login.get('access') or login.get('token')
    if not token:
        print('No access token in login response')
        return
    print('\nCalling GET', MENU)
    menu_raw = get(MENU, token)
    print(menu_raw)
    print('\nCalling GET', ANALYTICS)
    analytics_raw = get(ANALYTICS, token)
    print(analytics_raw)

if __name__ == '__main__':
    main()
