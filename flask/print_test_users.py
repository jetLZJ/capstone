import os
import sqlite3

ROOT = os.path.dirname(__file__)
DB = os.environ.get('DB_PATH', os.path.join(ROOT, 'data', 'app.db'))

if not os.path.exists(DB):
    print('DB not found at', DB)
    raise SystemExit(1)

conn = sqlite3.connect(DB)
cur = conn.cursor()
roles = ['Admin', 'Manager', 'Staff', 'User']
results = {}
for r in roles:
    cur.execute('SELECT u.email FROM users u JOIN roles ro ON u.role_id=ro.id WHERE ro.name=? LIMIT 1', (r,))
    row = cur.fetchone()
    results[r] = row[0] if row else None
conn.close()

print('\nTest credentials (password for all is: "password")')
for role in roles:
    print(f"{role}: {results.get(role)}")
