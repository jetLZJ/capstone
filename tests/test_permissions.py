from importlib import util
from pathlib import Path


_PERMISSIONS_PATH = Path(__file__).resolve().parents[1] / 'flask' / 'permissions.py'
_spec = util.spec_from_file_location('app_permissions', _PERMISSIONS_PATH)
if _spec is None or _spec.loader is None:  # pragma: no cover - defensive against missing module
    raise ImportError(f'Unable to load permissions module from {_PERMISSIONS_PATH}')
_permissions = util.module_from_spec(_spec)
_spec.loader.exec_module(_permissions)
expand_allowed_roles = _permissions.expand_allowed_roles


def test_expand_allowed_roles():
    # Manager should expand to include Admin
    allowed = expand_allowed_roles(['Manager'])
    assert 'Manager' in allowed
    assert 'Admin' in allowed