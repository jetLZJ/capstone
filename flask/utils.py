import sqlite3
import threading
import os
from typing import Optional

try:
    from passlib.hash import bcrypt  # type: ignore
except Exception:
    bcrypt = None
    import hashlib
    import os as _os
    import binascii
else:
    # ensure names exist for type checkers when passlib is available
    _os = os
    hashlib = __import__('hashlib')
    binascii = __import__('binascii')

from datetime import datetime
from flask import current_app

conn_local = threading.local()


def get_db() -> sqlite3.Connection:
    """Return a thread-local sqlite3 connection."""
    db_path = current_app.config.get('DB_PATH') if current_app else os.environ.get('DB_PATH')
    if not db_path:
        db_path = os.path.join(os.path.dirname(__file__), 'data', 'app.db')
    if not hasattr(conn_local, 'connection'):
        conn_local.connection = sqlite3.connect(db_path, detect_types=sqlite3.PARSE_DECLTYPES)
        conn_local.connection.row_factory = sqlite3.Row
        conn_local.connection.execute('PRAGMA foreign_keys = ON')
    return conn_local.connection


def close_db() -> None:
    """Close the thread-local DB connection if present."""
    if hasattr(conn_local, 'connection'):
        try:
            conn_local.connection.close()
        except Exception:
            # best-effort close
            pass


def hash_password(password: str) -> str:
    """Hash a password using bcrypt when available, otherwise PBKDF2-HMAC-SHA256."""
    if bcrypt:
        return bcrypt.hash(password)
    # fallback to pbkdf2
    salt = _os.urandom(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100_000)
    return binascii.hexlify(salt + dk).decode('ascii')


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a stored hash."""
    if bcrypt:
        return bcrypt.verify(password, hashed)
    import binascii
    raw = binascii.unhexlify(hashed.encode('ascii'))
    salt = raw[:16]
    dk = raw[16:]
    import hashlib
    new = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100_000)
    return new == dk


def now_iso() -> str:
    return datetime.utcnow().isoformat() + 'Z'


ALLOWED_IMAGE_EXT = {'.png', '.jpg', '.jpeg', '.gif'}


def allowed_image(filename: str) -> bool:
    _, ext = os.path.splitext(filename.lower())
    return ext in ALLOWED_IMAGE_EXT
