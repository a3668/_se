import { getDatabase } from "./db.server";
import { ENROLLMENT_CLOSED_MESSAGE, isStudentEnrollmentOpen } from "./enrollment-settings.server";

import { compareSemesters, getActiveSemester, getOfferingSemesters, SEMESTER_CHANGED_MESSAGE } from "./semester-settings.server";

type OfferingRow = {
  offering_id: number;
  course_code: string;
  department: string;
  name: string;
  grade: number;
  credits: number;
  category: "required" | "elective";
  section: string;
  capacity: number;
  teacher_name: string;
  enrolled_count: number;
  selected: number;
  weekday: number | null;
  start_period: number | null;
  end_period: number | null;
  classroom: string | null;
};

export type CourseSchedule = {
  weekday: number;
  startPeriod: number;
  endPeriod: number;
  classroom: string;
};

export type StudentOffering = {
  id: number;
  code: string;
  department: string;
  name: string;
  grade: number;
  credits: number;
  category: "required" | "elective";
  section: string;
  capacity: number;
  teacherName: string;
  enrolledCount: number;
  selected: boolean;
  schedules: CourseSchedule[];
  conflict: boolean;
  withdrawn: boolean;
  dropBlockedReason: string | null;
};

export function parseOfferingId(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new Response("Bad Request", { status: 400 });
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new Response("Bad Request", { status: 400 });
  return id;
}

export function getStudentDepartment(studentUserId: number) {
  const row = getDatabase().prepare("SELECT department FROM students WHERE user_id = ?")
    .get(studentUserId) as { department: string } | undefined;
  if (!row) throw new Response("Forbidden", { status: 403 });
  return row.department;
}

function schedulesConflict(a: CourseSchedule[], b: CourseSchedule[]) {
  return a.some((first) => b.some((second) =>
    first.weekday === second.weekday &&
    first.startPeriod <= second.endPeriod && second.startPeriod <= first.endPeriod,
  ));
}

export function getSemesterOptions(currentAndPastOnly = false) {
  const activeSemester = getActiveSemester();
  const semesters = getOfferingSemesters();
  if (!semesters.includes(activeSemester)) semesters.push(activeSemester);
  return semesters.filter((semester) => !currentAndPastOnly || compareSemesters(semester, activeSemester) <= 0)
    .sort((a, b) => compareSemesters(b, a));
}

export function getSemesterFilter(request: Request, currentAndPastOnly = false) {
  const semesters = getSemesterOptions(currentAndPastOnly);
  const semester = new URL(request.url).searchParams.get("semester") || getActiveSemester();
  if (!semesters.includes(semester)) throw new Response("Bad Request", { status: 400 });
  return { semester, semesters };
}

export function getStudentOfferingGrades(semester = getActiveSemester()) {
  const rows = getDatabase().prepare(
    `SELECT DISTINCT c.grade FROM course_offerings o
     JOIN courses c ON c.id = o.course_id
     WHERE o.semester = ? ORDER BY c.grade`,
  ).all(semester) as { grade: number }[];
  return rows.map((row) => row.grade);
}

export function getStudentOfferingDepartments(semester = getActiveSemester()) {
  const rows = getDatabase().prepare(
    `SELECT DISTINCT c.department FROM course_offerings o
     JOIN courses c ON c.id = o.course_id
     WHERE o.semester = ? ORDER BY c.department`,
  ).all(semester) as { department: string }[];
  return rows.map((row) => row.department);
}

export function getStudentOfferings(studentUserId: number, semester = getActiveSemester()) {
  getStudentDepartment(studentUserId);
  const rows = getDatabase().prepare(
    `SELECT o.id AS offering_id, c.course_code, c.department, c.name, c.grade, c.credits, c.category,
            o.section, o.capacity, t.name AS teacher_name,
            (SELECT COUNT(*) FROM enrollments e WHERE e.offering_id = o.id) AS enrolled_count,
            EXISTS(SELECT 1 FROM enrollments e WHERE e.offering_id = o.id AND e.student_user_id = ?) AS selected,
            s.weekday, s.start_period, s.end_period, s.classroom
     FROM course_offerings o
     JOIN courses c ON c.id = o.course_id
     JOIN teachers t ON t.user_id = o.teacher_user_id
     LEFT JOIN course_schedules s ON s.offering_id = o.id
     WHERE o.semester = ?
     ORDER BY c.grade, c.course_code, o.section, s.weekday, s.start_period`,
  ).all(studentUserId, semester) as OfferingRow[];

  const withdrawnIds = new Set((getDatabase().prepare(
    "SELECT offering_id FROM student_applications WHERE student_user_id = ? AND semester = ? AND kind = 'withdraw' AND status = 'approved'",
  ).all(studentUserId, semester) as { offering_id: number }[]).map((r) => r.offering_id));
  const publishedGradeIds = new Set((getDatabase().prepare(
    "SELECT offering_id FROM academic_grades WHERE student_user_id = ? AND published = 1",
  ).all(studentUserId) as { offering_id: number }[]).map((r) => r.offering_id));
  const pendingWithdrawIds = new Set((getDatabase().prepare(
    "SELECT offering_id FROM student_applications WHERE student_user_id = ? AND semester = ? AND kind = 'withdraw' AND status = 'pending'",
  ).all(studentUserId, semester) as { offering_id: number }[]).map((r) => r.offering_id));

  const offerings: StudentOffering[] = [];
  for (const row of rows) {
    let offering = offerings[offerings.length - 1];
    if (offering?.id !== row.offering_id) {
      offering = {
        id: row.offering_id, code: row.course_code, department: row.department, name: row.name, grade: row.grade,
        credits: row.credits, category: row.category, section: row.section,
        capacity: row.capacity, teacherName: row.teacher_name,
        enrolledCount: row.enrolled_count, selected: Boolean(row.selected),
        schedules: [], conflict: false, withdrawn: withdrawnIds.has(row.offering_id),
        dropBlockedReason: publishedGradeIds.has(row.offering_id) ? "已公布成績，不可退選"
          : pendingWithdrawIds.has(row.offering_id) ? "停修申請待審，請先取消申請" : null,
      };
      offerings.push(offering);
    }
    if (row.weekday !== null && row.start_period !== null && row.end_period !== null) {
      offering.schedules.push({
        weekday: row.weekday, startPeriod: row.start_period,
        endPeriod: row.end_period, classroom: row.classroom ?? "教室未定",
      });
    }
  }

  const selectedSchedules = offerings.filter((offering) => offering.selected)
    .flatMap((offering) => offering.schedules);
  for (const offering of offerings) {
    if (!offering.selected) offering.conflict = schedulesConflict(offering.schedules, selectedSchedules);
  }
  return offerings;
}

export function addEnrollment(studentUserId: number, offeringId: number, withinTransaction = false, originalSemester?: FormDataEntryValue | null): string | null {
  const db = getDatabase();
  if (withinTransaction && !db.isTransaction) throw new Error("Expected an active enrollment transaction");
  if (!withinTransaction) db.exec("BEGIN IMMEDIATE");
  try {
    const activeSemester = getActiveSemester();
    if (originalSemester !== undefined && originalSemester !== activeSemester) {
      if (!withinTransaction) db.exec("ROLLBACK");
      return SEMESTER_CHANGED_MESSAGE;
    }
    if (!isStudentEnrollmentOpen(studentUserId, activeSemester)) {
      if (!withinTransaction) db.exec("ROLLBACK");
      return ENROLLMENT_CLOSED_MESSAGE;
    }
    getStudentDepartment(studentUserId);
    const offering = db.prepare(
      `SELECT o.capacity, o.semester
       FROM course_offerings o
       WHERE o.id = ?`,
    ).get(offeringId) as { capacity: number; semester: string } | undefined;

    let error: string | null = null;
    if (!offering || offering.semester !== activeSemester) {
      error = "無法加選這門課。";
    } else if (db.prepare(
      "SELECT 1 FROM student_applications WHERE student_user_id = ? AND offering_id = ? AND kind = 'withdraw' AND status = 'approved'",
    ).get(studentUserId, offeringId)) {
      error = "已停修的課程不可重新加選。";
    } else if (db.prepare(
      "SELECT 1 FROM enrollments WHERE student_user_id = ? AND offering_id = ?",
    ).get(studentUserId, offeringId)) {
      error = "你已經選了這門課。";
    } else if (!(db.prepare("SELECT 1 FROM course_schedules WHERE offering_id = ?").get(offeringId))) {
      error = "這門課尚未安排時段。";
    } else if ((db.prepare(
      "SELECT COUNT(*) AS n FROM enrollments WHERE offering_id = ?",
    ).get(offeringId) as { n: number }).n >= offering.capacity) {
      error = "這門課已額滿。";
    } else if (db.prepare(
      `SELECT 1 FROM course_schedules candidate
       JOIN course_schedules chosen
         ON chosen.weekday = candidate.weekday
        AND chosen.start_period <= candidate.end_period
        AND candidate.start_period <= chosen.end_period
       JOIN enrollments e ON e.offering_id = chosen.offering_id
       JOIN course_offerings selected_o ON selected_o.id = e.offering_id
       WHERE candidate.offering_id = ? AND e.student_user_id = ?
         AND selected_o.semester = ? LIMIT 1`,
    ).get(offeringId, studentUserId, activeSemester)) {
      error = "這門課與已選課程時段衝突。";
    }

    if (!error) {
      db.prepare(
        "INSERT INTO enrollments (student_user_id, offering_id, created_at) VALUES (?, ?, ?)",
      ).run(studentUserId, offeringId, new Date().toISOString());
    }
    if (!withinTransaction) db.exec("COMMIT");
    return error;
  } catch (error) {
    if (!withinTransaction && db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

export function dropEnrollment(studentUserId: number, offeringId: number, originalSemester: FormDataEntryValue | null): string | null {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    const activeSemester = getActiveSemester();
    if (originalSemester !== activeSemester) {
      db.exec("ROLLBACK");
      return SEMESTER_CHANGED_MESSAGE;
    }
    if (!isStudentEnrollmentOpen(studentUserId, activeSemester)) {
      db.exec("ROLLBACK");
      return ENROLLMENT_CLOSED_MESSAGE;
    }
    if (db.prepare("SELECT 1 FROM academic_grades WHERE student_user_id = ? AND offering_id = ? AND published = 1").get(studentUserId, offeringId)) {
      db.exec("ROLLBACK");
      return "已公布成績的課程不可退選。";
    }
    if (db.prepare("SELECT 1 FROM student_applications WHERE student_user_id = ? AND offering_id = ? AND kind = 'withdraw' AND status = 'pending'").get(studentUserId, offeringId)) {
      db.exec("ROLLBACK");
      return "此課程有待審停修申請，請先取消申請再退選。";
    }
    const result = db.prepare(
      `DELETE FROM enrollments
       WHERE student_user_id = ? AND offering_id = ?
         AND offering_id IN (SELECT id FROM course_offerings WHERE semester = ?)`,
    ).run(studentUserId, offeringId, activeSemester);
    if (result.changes > 0) {
      db.prepare("DELETE FROM academic_grades WHERE student_user_id = ? AND offering_id = ? AND published = 0").run(studentUserId, offeringId);
      db.prepare("DELETE FROM midterm_alerts WHERE student_user_id = ? AND offering_id = ?").run(studentUserId, offeringId);
    }
    db.exec("COMMIT");
    return result.changes > 0 ? null : "這門課不在你的已選課程中。";
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}
