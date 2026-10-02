CREATE TABLE enrollment_open_grades (
  semester TEXT NOT NULL,
  grade INTEGER NOT NULL CHECK (grade > 0),
  PRIMARY KEY (semester, grade)
) STRICT;
