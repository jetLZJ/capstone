from flask import Flask
import os
from typing import Any, Optional

# Optional extension holders (use Any to avoid importing stubs during static checks)
CORS: Optional[Any] = None
JWTManager: Optional[Any] = None
Limiter: Optional[Any] = None
get_remote_address: Optional[Any] = None

try:
    from flask_cors import CORS as _CORS
    CORS = _CORS
except Exception:
    CORS = None

try:
    from flask_jwt_extended import JWTManager as _JWTManager
    JWTManager = _JWTManager
except Exception:
    JWTManager = None

try:
    from flask_limiter import Limiter as _Limiter
    from flask_limiter.util import get_remote_address as _get_remote_address
    Limiter = _Limiter
    get_remote_address = _get_remote_address
except Exception:
    Limiter = None
    get_remote_address = None

# Blueprints
from auth import bp as auth_bp
from menu import bp as menu_bp
from schedule import bp as schedule_bp
from analytics import bp as analytics_bp
from uploads import bp as uploads_bp
from orders import bp as orders_bp


def create_app(test_config=None):
    app = Flask(__name__, static_folder='html', static_url_path='')
    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY', 'dev-secret'),
        JWT_SECRET_KEY=os.environ.get('JWT_SECRET_KEY', 'jwt-secret'),
        DB_PATH=os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), 'data', 'app.db')),
    )

    if test_config:
        app.config.update(test_config)

    # Security and extensions (optional)
    if CORS:
        CORS(app)
    if JWTManager:
        jwt = JWTManager(app)
        # register a callback to check if a token is revoked
        @jwt.token_in_blocklist_loader
        def check_if_token_revoked(jwt_header, jwt_payload):
            try:
                from utils import get_db
                jti = jwt_payload.get('jti')
                conn = get_db()
                cur = conn.cursor()
                cur.execute('SELECT jti FROM revoked_tokens WHERE jti=?', (jti,))
                return cur.fetchone() is not None
            except Exception:
                return False
    if Limiter:
        # Pass keywords to work across limiter versions
        Limiter(key_func=get_remote_address, app=app)

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(menu_bp, url_prefix='/api/menu')
    app.register_blueprint(schedule_bp, url_prefix='/api/schedules')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(uploads_bp, url_prefix='/api/uploads')
    app.register_blueprint(orders_bp, url_prefix='/api/orders')

    @app.route('/ping')
    def ping():
        return 'ok'
        
    @app.route('/health')
    def health():
        return 'ok'

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000)
