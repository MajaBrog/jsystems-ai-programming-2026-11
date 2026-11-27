-- ADR-003 §4. Idempotent: executed on every startup.
CREATE TABLE IF NOT EXISTS cases (
  id                  TEXT PRIMARY KEY,
  case_type           TEXT NOT NULL CHECK (case_type IN ('COMPLAINT','RETURN')),
  device_category     TEXT NOT NULL,
  model_name          TEXT NOT NULL CHECK (length(model_name) BETWEEN 2 AND 100),
  purchase_date       TEXT NOT NULL,
  description         TEXT,
  photo_path          TEXT NOT NULL,
  image_analysis_json TEXT NOT NULL,
  current_category    TEXT NOT NULL CHECK (current_category IN ('ACCEPT','REJECT','NEEDS_REVIEW')),
  vision_model        TEXT NOT NULL,
  decision_model      TEXT NOT NULL,
  created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assessments (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id            TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  category           TEXT NOT NULL CHECK (category IN ('ACCEPT','REJECT','NEEDS_REVIEW')),
  previous_category  TEXT CHECK (previous_category IS NULL OR previous_category IN ('ACCEPT','REJECT','NEEDS_REVIEW')),
  source             TEXT NOT NULL CHECK (source IN ('INITIAL','CHAT_REVISION')),
  justification_json TEXT NOT NULL,
  next_steps_json    TEXT NOT NULL,
  guard_applied      TEXT,
  created_at         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assessments_case ON assessments (case_id, id);

CREATE TABLE IF NOT EXISTS messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id       TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('AGENT','CUSTOMER')),
  content       TEXT NOT NULL,
  assessment_id INTEGER REFERENCES assessments(id),
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_case ON messages (case_id, id);
