CREATE TABLE teachers (
  user_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  department TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;
