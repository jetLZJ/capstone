PRAGMA foreign_keys = ON;

-- Types (Appetizer, Main, Dessert, Beverage)
CREATE TABLE IF NOT EXISTS types (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Menu items
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  description TEXT,
  img_link TEXT,
  qty_left INTEGER DEFAULT 0,
  type_id INTEGER,
  discount REAL DEFAULT 0,
  FOREIGN KEY (type_id) REFERENCES types(id)
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  signup_date DATETIME DEFAULT (datetime('now')),
  password_hash TEXT,
  expiry_date DATETIME,
  allow_marketing INTEGER DEFAULT 0,
  profile_pic TEXT,
  email TEXT UNIQUE,
  phone_number TEXT,
  role_id INTEGER,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  member_id INTEGER,
  order_timestamp DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (member_id) REFERENCES users(id)
);

-- Order items (many-to-many join table)
-- Order items: one row per order, items stored as JSON array of {"item_id", "qty"}
CREATE TABLE IF NOT EXISTS order_items (
  order_id INTEGER PRIMARY KEY,
  items TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Weekly schedule
CREATE TABLE IF NOT EXISTS weekly_schedule (
  id INTEGER PRIMARY KEY,
  schedule TEXT,
  created_by INTEGER,
  approved_by INTEGER,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- Revoked JWT tokens (simple blacklist)
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti TEXT PRIMARY KEY,
  token_type TEXT,
  user_identity INTEGER,
  revoked_at DATETIME DEFAULT (datetime('now'))
);

-- Shifts table: defines a shift template
CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  role_required TEXT,
  start_time TEXT,
  end_time TEXT,
  created_by INTEGER,
  recurrence_rule TEXT,
  default_status TEXT DEFAULT 'scheduled',
  default_duration INTEGER,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Shift assignments to link users to shifts on a given date/week
CREATE TABLE IF NOT EXISTS shift_assignments (
  id INTEGER PRIMARY KEY,
  shift_id INTEGER,
  assigned_user INTEGER,
  shift_date DATE,
  start_time TEXT,
  end_time TEXT,
  role TEXT,
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  recurrence_parent_id INTEGER,
  schedule_week_start DATE,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME,
  FOREIGN KEY (shift_id) REFERENCES shifts(id),
  FOREIGN KEY (assigned_user) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_shift_assignments_user_date ON shift_assignments (assigned_user, shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_week ON shift_assignments (schedule_week_start);

-- Seed some common values
INSERT OR IGNORE INTO types (name) VALUES ('Appetizer'), ('Main'), ('Dessert'), ('Beverage');
INSERT OR IGNORE INTO roles (name) VALUES ('Admin'), ('User'), ('Manager'), ('Staff');
