from flask import jsonify
import os
import atexit
import sqlite3
import threading

# Prefer app factory from api.py which registers blueprints and extensions
from api import create_app

app = create_app()

# SQLite connection helpers (used by existing endpoints / blueprints)
db_path = os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), 'data', 'app.db'))
conn_local = threading.local()

def get_db():
    if not hasattr(conn_local, 'connection'):
        conn_local.connection = sqlite3.connect(db_path)
        conn_local.connection.execute('PRAGMA foreign_keys = ON')
        conn_local.connection.commit()
    return conn_local.connection

def init_db():
    try:
        conn = get_db()
        # Ensure fake_data table exists for simple test endpoints
        cur = conn.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS fake_data (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT)")
        conn.commit()
        cur.close()
        print('SQLite database initialized')
        return conn
    except Exception as e:
        print(f'Failed to initialize SQLite database: {e}')


@app.before_request
def ensure_db():
    init_db()

def close_db_connections():
    if hasattr(conn_local, 'connection'):
        try:
            conn_local.connection.close()
            print('SQLite connection closed')
        except Exception:
            pass


atexit.register(close_db_connections)


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000)