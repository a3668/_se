ALTER TABLE course_offerings ADD COLUMN general_education INTEGER NOT NULL DEFAULT 0 CHECK (general_education IN (0, 1));

CREATE TABLE academic_grades (
  student_user_id INTEGER NOT NULL REFERENCES students(user_id),
  offering_id INTEGER NOT NULL REFERENCES course_offerings(id),
  score REAL NOT NULL CHECK (score BETWEEN 0 AND 100),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (student_user_id, offering_id)
) STRICT;

CREATE TABLE midterm_alerts (
  student_user_id INTEGER NOT NULL REFERENCES students(user_id),
  offering_id INTEGER NOT NULL REFERENCES course_offerings(id),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (student_user_id, offering_id)
) STRICT;

CREATE TABLE attendance_records (
  id INTEGER PRIMARY KEY,
  student_user_id INTEGER NOT NULL REFERENCES students(user_id),
  offering_id INTEGER NOT NULL REFERENCES course_offerings(id),
  attendance_date TEXT NOT NULL,
  period INTEGER NOT NULL CHECK (period BETWEEN 1 AND 14),
  status TEXT NOT NULL CHECK (status IN ('absent', 'late', 'leave')),
  note TEXT NOT NULL CHECK (length(note) <= 1000),
  updated_at TEXT NOT NULL,
  UNIQUE (student_user_id, offering_id, attendance_date, period)
) STRICT;

CREATE TABLE student_discipline (
  id INTEGER PRIMARY KEY,
  student_user_id INTEGER NOT NULL REFERENCES students(user_id),
  teacher_user_id INTEGER NOT NULL REFERENCES teachers(user_id),
  record_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('reward', 'punishment')),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE student_applications (
  id INTEGER PRIMARY KEY,
  student_user_id INTEGER NOT NULL REFERENCES students(user_id),
  offering_id INTEGER REFERENCES course_offerings(id),
  semester TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('withdraw', 'general', 'military')),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewer_user_id INTEGER REFERENCES teachers(user_id),
  review_note TEXT NOT NULL DEFAULT '' CHECK (length(review_note) <= 1000),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  CHECK ((kind = 'military' AND offering_id IS NULL) OR (kind IN ('withdraw', 'general') AND offering_id IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX student_applications_pending_idx ON student_applications(student_user_id, kind, IFNULL(offering_id, 0), semester) WHERE status = 'pending';
CREATE INDEX student_applications_offering_idx ON student_applications(offering_id, status);

CREATE TABLE teaching_evaluations (
  student_user_id INTEGER NOT NULL REFERENCES students(user_id),
  offering_id INTEGER NOT NULL REFERENCES course_offerings(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL CHECK (length(comment) <= 1000),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (student_user_id, offering_id)
) STRICT;

CREATE TABLE course_questionnaires (
  id INTEGER PRIMARY KEY,
  offering_id INTEGER NOT NULL REFERENCES course_offerings(id),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  question TEXT NOT NULL CHECK (length(question) BETWEEN 1 AND 1000),
  is_open INTEGER NOT NULL DEFAULT 1 CHECK (is_open IN (0, 1)),
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX course_questionnaires_offering_idx ON course_questionnaires(offering_id);

CREATE TABLE questionnaire_responses (
  questionnaire_id INTEGER NOT NULL REFERENCES course_questionnaires(id),
  student_user_id INTEGER NOT NULL REFERENCES students(user_id),
  answer TEXT NOT NULL CHECK (length(answer) BETWEEN 1 AND 1000),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (questionnaire_id, student_user_id)
) STRICT;

CREATE INDEX attendance_records_student_idx ON attendance_records(student_user_id, attendance_date);
CREATE INDEX student_discipline_student_idx ON student_discipline(student_user_id, record_date);
CREATE INDEX student_applications_student_idx ON student_applications(student_user_id, semester);
CREATE INDEX academic_grades_offering_idx ON academic_grades(offering_id);
CREATE INDEX midterm_alerts_offering_idx ON midterm_alerts(offering_id);
CREATE INDEX teaching_evaluations_offering_idx ON teaching_evaluations(offering_id);
