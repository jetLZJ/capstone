from flask import Flask, jsonify
import os
import atexit
import sqlite3
import threading

app = Flask(__name__, static_folder='html', static_url_path='')

# SQLite database connection
db_path = os.environ.get('DB_PATH', 'app.db')
conn_local = threading.local()

def get_db():
    if not hasattr(conn_local, 'connection'):
        conn_local.connection = sqlite3.connect(db_path)
        # Enable foreign key support
        conn_local.connection.execute('PRAGMA foreign_keys = ON')
        # Create table if it doesn't exist
        conn_local.connection.execute('''
            CREATE TABLE IF NOT EXISTS fake_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message TEXT
            )
        ''')
        conn_local.connection.commit()
    return conn_local.connection

def init_db():
    try:
        # Ensure the database and table exist
        conn = get_db()
        print('SQLite database initialized')
        return conn
    except Exception as e:
        print(f'Failed to initialize SQLite database: {e}')


@app.before_request
def startup():
    init_db()


@app.route('/add_data', methods=['POST'])
def add_data():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("INSERT INTO fake_data (message) VALUES (?)", ("from app server",))
        inserted_id = cur.lastrowid
        conn.commit()
        cur.close()
        return jsonify({'ok': True, 'inserted_id': inserted_id}), 200
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/ping')
def ping():
    return 'ping'





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
    app.run(host='0.0.0.0')