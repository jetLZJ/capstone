from flask import Blueprint, request, jsonify, current_app
import os
from werkzeug.utils import secure_filename
import uuid

bp = Blueprint('uploads', __name__)

# Allowed image extensions
ALLOWED_EXT = {'png', 'jpg', 'jpeg', 'gif', 'webp'}


def allowed_filename(filename: str) -> bool:
    if not filename or '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in ALLOWED_EXT


@bp.route('/avatar', methods=['POST'])
def upload_avatar():
    # Accepts multipart/form-data with field name 'file'
    # reject very large uploads (4MB)
    max_bytes = 4 * 1024 * 1024
    if request.content_length is not None and request.content_length > max_bytes:
        return jsonify({'msg': 'file too large'}), 413

    if 'file' not in request.files:
        return jsonify({'msg': 'file required'}), 400
    f = request.files['file']
    if f.filename == '':
        return jsonify({'msg': 'empty filename'}), 400

    if not allowed_filename(f.filename):
        return jsonify({'msg': 'invalid file type'}), 415

    # Basic mimetype check (helps avoid non-image uploads)
    if not (f.mimetype and f.mimetype.startswith('image/')):
        return jsonify({'msg': 'invalid mimetype'}), 415

    # Prepare uploads directory inside the static/html folder so files are served
    base = os.path.dirname(__file__)
    uploads_dir = os.path.join(base, 'html', 'uploads')
    os.makedirs(uploads_dir, exist_ok=True)

    # Generate a unique, safe filename
    filename = secure_filename(f.filename)
    unique = f"{uuid.uuid4().hex}_{filename}"
    dest_path = os.path.join(uploads_dir, unique)

    try:
        f.save(dest_path)
    except Exception as e:
        current_app.logger.exception('Failed to save upload')
        return jsonify({'msg': 'failed to save file', 'error': str(e)}), 500

    # Return an absolute URL using the incoming request root so clients can fetch it
    # Example: https://backend.example.com/uploads/<unique>
    try:
        root = request.url_root.rstrip('/')
    except Exception:
        root = ''
    public_url = f"{root}/uploads/{unique}"
    return jsonify({'url': public_url}), 201
