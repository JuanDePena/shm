CREATE TABLE IF NOT EXISTS shp_environment_parameters (
  parameter_key TEXT PRIMARY KEY,
  parameter_value TEXT NOT NULL,
  description TEXT,
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  created_from_ui BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id TEXT REFERENCES shp_users(user_id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES shp_users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (parameter_key ~ '^[A-Za-z_][A-Za-z0-9_]*$')
);

CREATE INDEX IF NOT EXISTS shp_environment_parameters_source_idx
  ON shp_environment_parameters (created_from_ui, updated_at DESC);

INSERT INTO shp_environment_parameters (
  parameter_key,
  parameter_value,
  description,
  is_sensitive,
  created_from_ui
)
VALUES (
  'SIMPLEHOST_HISTORY_RETENTION_DAYS',
  '90',
  'Retention in days for old audit events and completed job history rows.',
  false,
  true
)
ON CONFLICT (parameter_key) DO NOTHING;
