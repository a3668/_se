CREATE TABLE semester_grade_settings (
  semester TEXT PRIMARY KEY,
  is_open INTEGER NOT NULL DEFAULT 0 CHECK (is_open IN (0, 1))
) STRICT;
