import os
import atexit
import threading
from pathlib import Path

# Prefer app factory from api.py which registers blueprints and extensions
from api import create_app
from utils import close_db, get_db

app = create_app()

_bootstrap_lock = threading.Lock()
_bootstrap_done = False
_SCHEMA_PATH = Path(__file__).with_name('db_schema.sql')


def _bootstrap_database() -> None:
    global _bootstrap_done
    if _bootstrap_done:
        return
    with _bootstrap_lock:
        if _bootstrap_done:
            return
        try:
            conn = get_db()
            cur = conn.cursor()
            try:
                cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
                schema_present = cur.fetchone() is not None
            except Exception:
                schema_present = False

            if not schema_present and _SCHEMA_PATH.exists():
                with _SCHEMA_PATH.open('r', encoding='utf-8') as handle:
                    conn.executescript(handle.read())
                conn.commit()

            cur.execute(
                'CREATE TABLE IF NOT EXISTS fake_data ('
                'id INTEGER PRIMARY KEY AUTOINCREMENT, '
                'message TEXT)'
            )
            conn.commit()

            try:
                from schedule import ensure_schedule_schema as _ensure_schedule_schema
                _ensure_schedule_schema()
            except Exception as schedule_exc:
                print(f'Failed to synchronize schedule schema: {schedule_exc}')

            try:
                from seed_data import ensure_seed_data as _ensure_seed_data
                _ensure_seed_data(conn)
            except Exception as seed_exc:
                print(f'Failed to ensure seed data: {seed_exc}')
        except Exception as exc:
            print(f'Failed to bootstrap database: {exc}')
            return
        _bootstrap_done = True


@app.before_request
def ensure_db():
    _bootstrap_database()


def close_db_connections():
    close_db()


atexit.register(close_db_connections)


if __name__ == '__main__':
    _bootstrap_database()
    app.run(host='0.0.0.0', port=5000)