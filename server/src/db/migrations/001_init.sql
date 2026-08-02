-- OGDC Internee Management System -- initial schema.
-- Dates are stored as ISO 'YYYY-MM-DD' TEXT: sorts correctly, compares
-- correctly, and works directly with SQLite's strftime()/date() functions.

CREATE TABLE users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  username             TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash        TEXT    NOT NULL,
  full_name            TEXT    NOT NULL,
  role                 TEXT    NOT NULL CHECK (role IN ('admin', 'hr', 'viewer')),
  is_active            INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  last_login_at        TEXT,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Lookup tables.
--
-- These exist so the dashboard can GROUP BY them. Free-text universities would
-- split "UMT" / "U.M.T" / "University of Management & Technology" into three
-- rows and make every university-wise comparison meaningless.
-- ---------------------------------------------------------------------------

CREATE TABLE cities (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  province  TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE universities (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  short_name TEXT,
  city      TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE degrees (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  level     TEXT    NOT NULL DEFAULT 'Bachelors',
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE departments (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  code      TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE supervisors (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  designation   TEXT,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  email         TEXT,
  phone         TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- Interns
-- ---------------------------------------------------------------------------

CREATE TABLE interns (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  intern_code   TEXT    NOT NULL UNIQUE,

  -- identity
  full_name     TEXT    NOT NULL,
  father_name   TEXT,
  cnic          TEXT,
  gender        TEXT CHECK (gender IN ('Male', 'Female', 'Other') OR gender IS NULL),
  dob           TEXT,
  photo_path    TEXT,

  -- contact
  phone                    TEXT,
  email                    TEXT,
  address                  TEXT,
  city_id                  INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  emergency_contact_name   TEXT,
  emergency_contact_phone  TEXT,
  referred_by              TEXT,

  -- academic
  university_id INTEGER REFERENCES universities(id) ON DELETE SET NULL,
  degree_id     INTEGER REFERENCES degrees(id) ON DELETE SET NULL,
  major         TEXT,
  semester      TEXT,
  cgpa          REAL,
  enrollment_no TEXT,

  -- placement
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  supervisor_id INTEGER REFERENCES supervisors(id) ON DELETE SET NULL,

  -- internship period
  joining_date   TEXT NOT NULL,
  end_date       TEXT,
  duration_weeks INTEGER,
  status         TEXT NOT NULL DEFAULT 'Active'
                 CHECK (status IN ('Upcoming', 'Active', 'Completed', 'Terminated', 'Extended')),

  -- closure
  certificate_issued  INTEGER NOT NULL DEFAULT 0,
  certificate_date    TEXT,
  certificate_no      TEXT,
  evaluation_rating   INTEGER CHECK (evaluation_rating BETWEEN 1 AND 5 OR evaluation_rating IS NULL),
  evaluation_remarks  TEXT,

  notes      TEXT,

  -- meta
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE INDEX idx_interns_joining     ON interns(joining_date);
CREATE INDEX idx_interns_status      ON interns(status);
CREATE INDEX idx_interns_university  ON interns(university_id);
CREATE INDEX idx_interns_department  ON interns(department_id);
CREATE INDEX idx_interns_city        ON interns(city_id);
CREATE INDEX idx_interns_degree      ON interns(degree_id);
CREATE INDEX idx_interns_deleted     ON interns(deleted_at);
CREATE INDEX idx_interns_name        ON interns(full_name);

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------

CREATE TABLE documents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  intern_id     INTEGER NOT NULL REFERENCES interns(id) ON DELETE CASCADE,
  doc_type      TEXT    NOT NULL,
  original_name TEXT    NOT NULL,
  stored_name   TEXT    NOT NULL,
  mime_type     TEXT    NOT NULL,
  size_bytes    INTEGER NOT NULL,
  uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_documents_intern ON documents(intern_id);

-- ---------------------------------------------------------------------------
-- Audit trail -- who did what, so a shared LAN app stays accountable.
-- ---------------------------------------------------------------------------

CREATE TABLE audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username     TEXT,
  action       TEXT NOT NULL,
  entity       TEXT NOT NULL,
  entity_id    INTEGER,
  details_json TEXT,
  at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX idx_audit_at     ON audit_log(at);

-- Per-year counter behind intern_code (OGDC-INT-2026-001).
CREATE TABLE code_counters (
  year INTEGER PRIMARY KEY,
  seq  INTEGER NOT NULL DEFAULT 0
);
