CREATE TABLE courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits >= 0),
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 4),
  category TEXT NOT NULL CHECK (category IN ('required', 'elective'))
) STRICT;

CREATE TABLE course_offerings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  teacher_user_id INTEGER NOT NULL,
  semester TEXT NOT NULL CHECK (semester GLOB '[0-9][0-9][0-9]-[12]'),
  section TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  UNIQUE (course_id, semester, section),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (teacher_user_id) REFERENCES teachers(user_id)
) STRICT;

CREATE INDEX course_offerings_semester_idx ON course_offerings(semester);
CREATE INDEX course_offerings_teacher_idx ON course_offerings(teacher_user_id);

CREATE TABLE course_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offering_id INTEGER NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_period INTEGER NOT NULL CHECK (start_period BETWEEN 1 AND 14),
  end_period INTEGER NOT NULL CHECK (end_period BETWEEN start_period AND 14),
  classroom TEXT NOT NULL,
  UNIQUE (offering_id, weekday, start_period, end_period),
  FOREIGN KEY (offering_id) REFERENCES course_offerings(id) ON DELETE CASCADE
) STRICT;
