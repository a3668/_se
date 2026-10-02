CREATE TABLE enrollments (
  student_user_id INTEGER NOT NULL,
  offering_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (student_user_id, offering_id),
  FOREIGN KEY (student_user_id) REFERENCES students(user_id) ON DELETE CASCADE,
  FOREIGN KEY (offering_id) REFERENCES course_offerings(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX enrollments_offering_id_idx ON enrollments(offering_id);
