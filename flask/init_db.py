"""
Initialize the SQLite database for the app using `db_schema.sql`.
Places the DB at DB_PATH (default ./data/app.db).
"""
import os
import sqlite3

ROOT = os.path.dirname(__file__)
SCHEMA = os.path.join(ROOT, 'db_schema.sql')
DEFAULT_DB = os.path.join(ROOT, 'data', 'app.db')

db_path = os.environ.get('DB_PATH', DEFAULT_DB)

os.makedirs(os.path.dirname(db_path), exist_ok=True)

print(f"Initializing SQLite DB at: {db_path}")
conn = sqlite3.connect(db_path)
conn.execute('PRAGMA foreign_keys = ON')
with open(SCHEMA, 'r', encoding='utf-8') as f:
    sql = f.read()

conn.executescript(sql)
conn.commit()

# Show created tables
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
rows = cur.fetchall()
print('Created tables:')
for r in rows:
    print('-', r[0])
cur.close()
conn.close()
print('Done')
