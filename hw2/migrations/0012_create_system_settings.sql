CREATE TABLE system_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_semester TEXT NOT NULL CHECK (active_semester GLOB '[0-9][0-9][0-9]-[12]')
) STRICT;

INSERT INTO system_settings (id, active_semester) VALUES (1, '115-1');
