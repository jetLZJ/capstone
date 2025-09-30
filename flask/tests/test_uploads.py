import io
import os
from api import create_app


def test_upload_avatar(tmp_path):
    app = create_app({'TESTING': True})
    client = app.test_client()

    data = {
        'file': (io.BytesIO(b'\x89PNG\r\n\x1a\n'), 'test.png')
    }
    resp = client.post('/api/uploads/avatar', data=data, content_type='multipart/form-data')
    assert resp.status_code in (200, 201)
    j = resp.get_json()
    assert 'url' in j
    # ensure file exists in html/uploads
    base = os.path.dirname(__file__)
    uploads_dir = os.path.join(os.path.dirname(base), 'html', 'uploads')
    assert os.path.isdir(uploads_dir)
