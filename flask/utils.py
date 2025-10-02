import os
import sqlite3
import threading
from itertools import cycle
from typing import Any, Dict, Iterable, Iterator, List, Mapping, Optional, Sequence, Tuple
from urllib.parse import urlparse

import requests

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


class RqliteError(RuntimeError):
    """Raised when the rqlite cluster cannot be reached or returns an error."""


def _normalize_rqlite_url(raw: str) -> Optional[str]:
    if not raw:
        return None
    candidate = raw.strip()
    if not candidate:
        return None
    if '://' not in candidate:
        candidate = f"http://{candidate}"
    parsed = urlparse(candidate)
    if not parsed.netloc:
        return None
    scheme = parsed.scheme or 'http'
    base = f"{scheme}://{parsed.netloc}".rstrip('/')
    return base


class RqliteRow(Mapping[str, Any]):
    """Mapping-like row object supporting both key and index access."""

    __slots__ = ('_columns', '_values', '_mapping')

    def __init__(self, columns: Sequence[str], values: Sequence[Any]):
        self._columns = list(columns)
        self._values = list(values)
        self._mapping = dict(zip(self._columns, self._values))

    def __getitem__(self, key: Any) -> Any:
        if isinstance(key, int):
            return self._values[key]
        return self._mapping[key]

    def __iter__(self) -> Iterator[str]:
        return iter(self._mapping)

    def __len__(self) -> int:
        return len(self._mapping)

    def keys(self):  # pragma: no cover - delegated to mapping methods
        return self._mapping.keys()

    def items(self):  # pragma: no cover - delegated to mapping methods
        return self._mapping.items()

    def values(self):  # pragma: no cover - delegated to mapping methods
        return self._mapping.values()

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"RqliteRow({self._mapping!r})"


class RqliteCursor:
    """Minimal DB-API compatible cursor backed by the rqlite HTTP API."""

    def __init__(self, connection: 'RqliteConnection'):
        self._connection = connection
        self._closed = False
        self._rows: List[RqliteRow] = []
        self._index = 0
        self._lastrowid: Optional[int] = None
        self._rowcount: int = -1
        self._description: Optional[List[Tuple[str, None, None, None, None, None, None]]] = None

    def _ensure_open(self) -> None:
        if self._closed:
            raise RqliteError('Cursor is closed')

    @property
    def description(self):
        return self._description

    @property
    def rowcount(self) -> int:
        return self._rowcount

    @property
    def lastrowid(self) -> Optional[int]:
        return self._lastrowid

    def execute(self, sql: str, params: Optional[Sequence[Any]] = None) -> 'RqliteCursor':
        self._ensure_open()
        params = list(params) if params is not None else []
        sql_clean = sql.strip()
        is_query = sql_clean.lower().startswith(('select', 'pragma', 'with', 'show', 'explain'))

        result = self._connection._dispatch(sql_clean, params, is_query=is_query)
        payload = result.get('results', [{}])[0]

        if is_query:
            columns = payload.get('columns') or []
            raw_rows = payload.get('values') or []
            self._rows = [RqliteRow(columns, row) for row in raw_rows]
            self._rowcount = len(self._rows)
            self._description = [(col, None, None, None, None, None, None) for col in columns]
            self._lastrowid = None
        else:
            self._rows = []
            self._rowcount = payload.get('rows_affected', 0)
            last_id = payload.get('last_insert_id')
            self._lastrowid = int(last_id) if last_id is not None else None
            self._description = None
        self._index = 0
        return self

    def fetchone(self) -> Optional[RqliteRow]:
        self._ensure_open()
        if self._index >= len(self._rows):
            return None
        row = self._rows[self._index]
        self._index += 1
        return row

    def fetchall(self) -> List[RqliteRow]:
        self._ensure_open()
        if self._index == 0:
            return list(self._rows)
        result = self._rows[self._index:]
        self._index = len(self._rows)
        return result

    def close(self) -> None:
        self._rows = []
        self._closed = True

    def __iter__(self) -> Iterator[RqliteRow]:  # pragma: no cover - rarely used
        while True:
            row = self.fetchone()
            if row is None:
                return
            yield row


class RqliteConnection:
    """Very small connection wrapper for the rqlite HTTP API."""

    def __init__(self, urls: Sequence[str], *, timeout: float = 8.0, read_consistency: Optional[str] = None):
        if not urls:
            raise ValueError('At least one rqlite URL is required')
        self._urls = list(urls)
        self._timeout = timeout
        if read_consistency:
            self._read_params = {'level': read_consistency}
        else:
            self._read_params = {}
        self._write_params: Dict[str, Any] = {}
        self._session = requests.Session()
        self._cycle = cycle(self._urls)
        self.row_factory = None  # maintained for API compatibility

    def cursor(self) -> RqliteCursor:
        return RqliteCursor(self)

    def execute(self, sql: str, params: Optional[Sequence[Any]] = None) -> RqliteCursor:
        cur = self.cursor()
        return cur.execute(sql, params)

    def commit(self) -> None:
        # Each statement is committed immediately by rqlite.
        return None

    def close(self) -> None:
        self._session.close()

    def executescript(self, script: str) -> None:
        if not script:
            return
        filtered_lines = []
        for line in script.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith('--'):
                continue
            filtered_lines.append(line)
        cleaned = '\n'.join(filtered_lines)
        statements = [segment.strip() for segment in cleaned.split(';') if segment.strip()]
        for stmt in statements:
            self.execute(stmt)

    def _dispatch(self, sql: str, params: Sequence[Any], *, is_query: bool) -> Dict[str, Any]:
        if params:
            statement_payload: Any = [sql, *list(params)]
        else:
            statement_payload = sql

        payload = [statement_payload]

        errors = []
        for _ in range(len(self._urls)):
            base = next(self._cycle)
            endpoint = '/db/query' if is_query else '/db/execute'
            url = f"{base}{endpoint}"
            try:
                response = self._session.post(
                    url,
                    params=(self._read_params if is_query else self._write_params) or None,
                    json=payload,
                    timeout=self._timeout,
                )
                response.raise_for_status()
                data = response.json()
                if 'results' not in data:
                    raise RqliteError(f'Unexpected response from rqlite node {base}')
                results = data.get('results') or []
                if results:
                    first = results[0]
                    if isinstance(first, dict) and first.get('error'):
                        raise RqliteError(first['error'])
                return data
            except Exception as exc:  # pragma: no cover - network error path
                errors.append(f'{base}: {exc}')
                continue

        raise RqliteError('All rqlite nodes failed: ' + '; '.join(errors))


conn_local = threading.local()


def _get_app_config(key: str, default: Any = None) -> Any:
    try:
        return current_app.config.get(key, default)  # type: ignore[attr-defined]
    except Exception:
        return default


def _resolve_rqlite_settings() -> Optional[Dict[str, Any]]:
    primary = _get_app_config('RQLITE_URL') or os.environ.get('RQLITE_URL')
    replica_raw = _get_app_config('RQLITE_REPLICA_SET') or os.environ.get('RQLITE_REPLICA_SET')
    if not primary and not replica_raw:
        return None

    urls: List[str] = []
    if replica_raw:
        for piece in replica_raw.split(','):
            normalized = _normalize_rqlite_url(piece)
            if normalized and normalized not in urls:
                urls.append(normalized)
    if primary:
        normalized = _normalize_rqlite_url(primary)
        if normalized:
            # ensure primary is first in rotation
            urls.insert(0, normalized)

    urls = [u for u in urls if u]
    if not urls:
        return None

    timeout_value: Any = _get_app_config('RQLITE_HTTP_TIMEOUT') or os.environ.get('RQLITE_HTTP_TIMEOUT')
    consistency_value: Any = _get_app_config('RQLITE_CONSISTENCY') or os.environ.get('RQLITE_CONSISTENCY')
    try:
        timeout = float(timeout_value) if timeout_value is not None else 8.0
    except (TypeError, ValueError):
        timeout = 8.0

    consistency = None
    if consistency_value not in (None, ''):
        try:
            consistency = str(consistency_value).strip() or None
        except Exception:
            consistency = None
    if not consistency:
        consistency = 'strong'

    settings = {
        'urls': urls,
        'timeout': timeout,
    }
    if consistency:
        settings['read_consistency'] = consistency
    return settings


def get_db():
    """Return a thread-local database connection (sqlite or rqlite)."""
    settings = _resolve_rqlite_settings()
    using_rqlite = settings is not None

    existing = getattr(conn_local, 'connection', None)
    if existing is not None:
        if using_rqlite and isinstance(existing, RqliteConnection):
            return existing
        if not using_rqlite and isinstance(existing, sqlite3.Connection):
            return existing
        # backend switched, close old connection and recreate
        try:
            existing.close()
        except Exception:
            pass
        delattr(conn_local, 'connection')

    if using_rqlite and settings:
        conn_local.connection = RqliteConnection(**settings)
    else:
        db_path = _get_app_config('DB_PATH') or os.environ.get('DB_PATH')
        if not db_path:
            db_path = os.path.join(os.path.dirname(__file__), 'data', 'app.db')
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
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
            pass
        finally:
            delattr(conn_local, 'connection')


def hash_password(password: str) -> str:
    """Hash a password using bcrypt when available, otherwise PBKDF2-HMAC-SHA256."""
    if bcrypt:
        try:
            # passlib's bcrypt may be present but its native backend can fail at runtime
            # (for example a broken "bcrypt" C-extension). Attempt to use it and
            # fall back to the pbkdf2 path on any error.
            return bcrypt.hash(password)
        except Exception:
            # fall through to the pbkdf2 fallback below
            pass
    # fallback to pbkdf2
    salt = _os.urandom(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100_000)
    return binascii.hexlify(salt + dk).decode('ascii')


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a stored hash."""
    if bcrypt:
        try:
            return bcrypt.verify(password, hashed)
        except Exception:
            # If bcrypt verification fails (e.g. stored hash isn't a bcrypt string or
            # the backend is broken), fall back to the pbkdf2 verification below.
            pass
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
