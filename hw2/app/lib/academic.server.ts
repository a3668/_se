import type { CurrentUser } from "./auth.server";
import { getDatabase } from "./db.server";
import { ACTIVE_SEMESTER, addEnrollment, getSemesterOptions } from "./enrollments.server";
import { isWithdrawalOpen, WITHDRAWAL_CLOSED_MESSAGE } from "./withdrawal-settings.server";
import { isGeneralSelectionOpen, GENERAL_SELECTION_CLOSED_MESSAGE } from "./general-selection-settings.server";
import { isMidtermAlertOpen, MIDTERM_ALERT_CLOSED_MESSAGE } from "./midterm-alert-settings.server";
import { isSemesterGradeOpen } from "./semester-grade-settings.server";

type SqlValue = string | number | null;
function rows<T>(sql: string, ...args: SqlValue[]): T[] {
  return getDatabase().prepare(sql).all(...args) as T[];
}
function row<T>(sql: string, ...args: SqlValue[]): T | undefined {
  return getDatabase().prepare(sql).get(...args) as T | undefined;
}
function run(sql: string, ...args: SqlValue[]) {
  return getDatabase().prepare(sql).run(...args);
}
export type AcademicCourse = {
  id: number; code: string; name: string; section: string; semester: string;
  credits: number; capacity: number; enrolledCount: number; teacherName: string; generalEducation: number;
};
export type AcademicStudent = { id: number; username: string; name: string; department: string; grade: number };
export type AcademicRecord = { id: number; cells: string[]; status?: string; kind?: string };
export type AcademicSurvey = { id: number; title: string; question: string; isOpen: number; courseName: string; answer: string; count: number };
export type AcademicLesson = {
  offeringId: number; code: string; name: string; section: string; classroom: string | null;
  weekday: number | null; startPeriod: number | null; endPeriod: number | null;
};
export type AcademicData = {
  semester: string; semesters: string[]; courses: AcademicCourse[]; students: AcademicStudent[];
  offeringId: number | null; columns: string[]; records: AcademicRecord[]; surveys: AcademicSurvey[];
  teachers: { id: number; name: string; department: string }[]; teacherId: number | null;
  classrooms: string[]; classroom: string; lessons: AcademicLesson[]; note: string;
  summary: { label: string; value: string }[];
  withdrawalOpen?: boolean;
  generalSelectionOpen?: boolean;
  midtermAlertOpen?: boolean;
  semesterGradeOpen?: boolean;
};

const courseSelect = `SELECT o.id, c.course_code AS code, c.name, o.section, o.semester,
  c.credits, o.capacity, o.general_education AS generalEducation, t.name AS teacherName,
  (SELECT COUNT(*) FROM enrollments e WHERE e.offering_id = o.id) AS enrolledCount
  FROM course_offerings o JOIN courses c ON c.id = o.course_id
  JOIN teachers t ON t.user_id = o.teacher_user_id`;
const weekdays = ["", "一", "二", "三", "四", "五", "六", "日"];
const statuses: Record<string, string> = { pending: "待審核", approved: "已核准", rejected: "已駁回", cancelled: "已取消" };
export const applicationLabels: Record<string, string> = { withdraw: "停修", general: "通識初選", military: "兵役申請" };

function profile(user: CurrentUser) {
  const table = user.role === "teacher" ? "teachers" : "students";
  const result = row<{ name: string; department: string }>(`SELECT name, department FROM ${table} WHERE user_id = ?`, user.id);
  if (!result) throw new Response("缺少個人資料", { status: 403 });
  return result;
}

export function getAcademicData(user: CurrentUser, path: string, params: URLSearchParams): AcademicData {
  const identity = profile(user);
  const semesters = getSemesterOptions();
  const semester = params.get("semester") || ACTIVE_SEMESTER;
  if (!semesters.includes(semester)) throw new Response("學期無效", { status: 400 });
  const teacher = user.role === "teacher";
  const value: AcademicData = { semester, semesters, courses: [], students: [], offeringId: null, columns: [], records: [], surveys: [], teachers: [], teacherId: null, classrooms: [], classroom: "", lessons: [], note: "", summary: [] };
  if (path === "/query/semester-grades" || path === "/query/history-grades") {
    value.semesterGradeOpen = isSemesterGradeOpen(ACTIVE_SEMESTER);
    if (path === "/query/semester-grades" && !value.semesterGradeOpen) return value;
  }
  if (path === "/teacher/alerts" || path === "/query/midterm-alert") {
    value.midtermAlertOpen = isMidtermAlertOpen(ACTIVE_SEMESTER);
    if (!value.midtermAlertOpen) return value;
  }
  const courses = teacher
    ? rows<AcademicCourse>(`${courseSelect} WHERE o.teacher_user_id = ? AND o.semester = ? ORDER BY c.course_code, o.section`, user.id, semester)
    : rows<AcademicCourse>(`${courseSelect} JOIN enrollments e ON e.offering_id = o.id WHERE e.student_user_id = ? AND o.semester = ? ORDER BY c.course_code, o.section`, user.id, semester);
  value.courses = courses;
  const courseInput = params.get("offeringId");
  if (teacher && path.startsWith("/teacher/")) {
    if (courseInput) {
      if (!/^[1-9]\d*$/.test(courseInput) || !Number.isSafeInteger(Number(courseInput))
        || !row("SELECT 1 FROM course_offerings WHERE id = ? AND teacher_user_id = ?", Number(courseInput), user.id)) {
        throw new Response("無法存取這門授課課程", { status: 403 });
      }
    }
    // Changing semesters submits the old course selection with the new semester.
    value.offeringId = courses.find((c) => c.id === Number(courseInput))?.id ?? courses[0]?.id ?? null;
    if (value.offeringId) value.students = rows<AcademicStudent>(
      `SELECT s.user_id AS id, u.username, s.name, s.department, s.grade FROM enrollments e
       JOIN students s ON s.user_id = e.student_user_id JOIN users u ON u.id = s.user_id
       WHERE e.offering_id = ? ORDER BY u.username`, value.offeringId);
  }
  const offeringId = value.offeringId;
  if (path === "/teacher/courses" || path === "/query/course-data") {
    value.columns = ["課程", "班別", "學分", "教師", "修課人數／上限", "通識"];
    value.records = courses.map((c) => ({ id: c.id, cells: [`${c.name}（${c.code}）`, c.section, String(c.credits), c.teacherName, `${c.enrolledCount} / ${c.capacity}`, c.generalEducation ? "是" : "否"] }));
    value.summary = [{ label: teacher ? "授課門數" : "已選門數", value: String(courses.length) }, { label: teacher ? "授課學分" : "已選學分", value: String(courses.reduce((n, c) => n + c.credits, 0)) }];
  }
  if (path === "/teacher/roster") {
    value.columns = ["學號", "姓名", "科系", "年級"];
    value.records = value.students.map((s) => ({ id: s.id, cells: [s.username, s.name, s.department, `${s.grade} 年級`] }));
    value.note = "僅能查看自己授課課程的修課名單。";
  }
  if (path.includes("grades")) {
    const hideCurrentHistory = !teacher && path === "/query/history-grades" && !value.semesterGradeOpen;
    value.columns = teacher ? ["學號", "姓名", "課程", "學分", "成績", "狀態"] : ["學期", "課程", "學分", "成績", "結果"];
    const grades = rows<{ id: number; username: string; studentName: string; name: string; credits: number; score: number; semester: string; published: number }>(
      `SELECT g.student_user_id AS id, u.username, s.name AS studentName, c.name, c.credits, g.score, o.semester, g.published
       FROM academic_grades g JOIN students s ON s.user_id = g.student_user_id JOIN users u ON u.id = s.user_id
       JOIN course_offerings o ON o.id = g.offering_id JOIN courses c ON c.id = o.course_id
       WHERE ${teacher ? "o.teacher_user_id = ? AND o.id = ?" : "g.student_user_id = ? AND g.published = 1"}
       ${!teacher && path !== "/query/history-grades" ? "AND o.semester = ?" : ""}
       ${hideCurrentHistory ? "AND o.semester != ?" : ""}
       ORDER BY o.semester DESC, c.course_code, u.username`,
      user.id, ...(teacher ? [offeringId] : path === "/query/history-grades" ? [] : [semester]), ...(hideCurrentHistory ? [ACTIVE_SEMESTER] : []));
    value.records = grades.map((g, i) => ({ id: i, cells: teacher ? [g.username, g.studentName, g.name, String(g.credits), String(g.score), g.published ? "已公布" : "草稿"] : [g.semester, g.name, String(g.credits), String(g.score), g.score >= 60 ? "及格" : "不及格"] }));
    const published = grades.filter((g) => g.published);
    const credits = published.reduce((n, g) => n + g.credits, 0);
    value.summary = [{ label: "已公布門數", value: String(published.length) }, { label: "取得學分", value: String(published.filter((g) => g.score >= 60).reduce((n, g) => n + g.credits, 0)) }, { label: "學分加權平均", value: credits ? (published.reduce((n, g) => n + g.credits * g.score, 0) / credits).toFixed(2) : "—" }];
    value.note = "採百分制，60 分及格。學生僅能看見已公布的成績；停修不計入平均與學分。";
    if (hideCurrentHistory) value.note += ` ${ACTIVE_SEMESTER} 學期成績查詢尚未開放，此處僅顯示其他學期資料。`;
    if (!teacher) {
      const withdrawals = rows<{ id: number; semester: string; name: string; credits: number }>(
        `SELECT a.id, a.semester, c.name, c.credits FROM student_applications a
         JOIN course_offerings o ON o.id = a.offering_id JOIN courses c ON c.id = o.course_id
         WHERE a.student_user_id = ? AND a.kind = 'withdraw' AND a.status = 'approved'
         ${path !== "/query/history-grades" ? "AND a.semester = ?" : ""}
         ${hideCurrentHistory ? "AND a.semester != ?" : ""} ORDER BY a.semester DESC`, user.id, ...(path !== "/query/history-grades" ? [semester] : []), ...(hideCurrentHistory ? [ACTIVE_SEMESTER] : []));
      for (const w of withdrawals) value.records.push({ id: grades.length + w.id, cells: [w.semester, w.name, String(w.credits), "—", "停修"] });
    }
  }
  if (path === "/query/midterm-alert" || path === "/teacher/alerts") {
    value.columns = ["學號", "姓名", "課程", "預警原因", "更新時間"];
    const alerts = rows<{ id: number; username: string; studentName: string; name: string; reason: string; updated: string }>(
      `SELECT a.student_user_id AS id, u.username, s.name AS studentName, c.name, a.reason, a.updated_at AS updated
       FROM midterm_alerts a JOIN students s ON s.user_id = a.student_user_id JOIN users u ON u.id = s.user_id
       JOIN course_offerings o ON o.id = a.offering_id JOIN courses c ON c.id = o.course_id
       WHERE ${teacher ? "o.teacher_user_id = ? AND o.id = ?" : "a.student_user_id = ? AND o.semester = ?"} ORDER BY c.course_code, u.username`, user.id, teacher ? offeringId : semester);
    value.records = alerts.map((a, i) => ({ id: i, cells: [a.username, a.studentName, a.name, a.reason, a.updated.slice(0, 10)] }));
  }
  if (path === "/student/absence-details" || path === "/teacher/attendance") {
    value.columns = ["日期", "課程", "學號", "姓名", "節次", "狀態", "備註"];
    const attendance = rows<{ id: number; date: string; name: string; username: string; studentName: string; period: number; status: string; note: string }>(
      `SELECT a.id, a.attendance_date AS date, c.name, u.username, s.name AS studentName, a.period, a.status, a.note
       FROM attendance_records a JOIN students s ON s.user_id = a.student_user_id JOIN users u ON u.id = s.user_id
       JOIN course_offerings o ON o.id = a.offering_id JOIN courses c ON c.id = o.course_id
       WHERE ${teacher ? "o.teacher_user_id = ? AND o.id = ?" : "a.student_user_id = ? AND o.semester = ?"} ORDER BY a.attendance_date DESC, a.period, u.username`, user.id, teacher ? offeringId : semester);
    value.records = attendance.map((a) => ({ id: a.id, cells: [a.date, a.name, a.username, a.studentName, String(a.period), ({ absent: "缺課", late: "遲到", leave: "請假" } as Record<string, string>)[a.status], a.note] }));
    value.note = "每筆記錄代表一節課；老師可重新登錄同一日期與節次以更正，也可將該節標記為出席來移除缺曠紀錄。";
  }
  if (path === "/student/reward-punishment" || path === "/teacher/discipline") {
    value.columns = ["日期", "學號", "姓名", "類型", "事由", "登錄老師"];
    if (teacher) value.students = rows<AcademicStudent>(`SELECT s.user_id AS id, u.username, s.name, s.department, s.grade FROM students s JOIN users u ON u.id = s.user_id WHERE s.department = ? ORDER BY u.username`, identity.department);
    const records = rows<{ id: number; date: string; username: string; studentName: string; kind: string; reason: string; teacherName: string }>(
      `SELECT d.id, d.record_date AS date, u.username, s.name AS studentName, d.kind, d.reason, t.name AS teacherName
       FROM student_discipline d JOIN students s ON s.user_id = d.student_user_id JOIN users u ON u.id = s.user_id
       JOIN teachers t ON t.user_id = d.teacher_user_id WHERE ${teacher ? "d.teacher_user_id = ?" : "d.student_user_id = ?"} ORDER BY d.record_date DESC, d.id DESC`, user.id);
    value.records = records.map((d) => ({ id: d.id, cells: [d.date, d.username, d.studentName, d.kind === "reward" ? "獎勵" : "懲處", d.reason, d.teacherName] }));
    value.note = teacher ? "此版本由同系老師登錄獎懲；只能管理自己登錄的記錄。" : "顯示個人全部獎懲紀錄。";
  }
  if (["/course/withdraw", "/course/general", "/student/military-service", "/teacher/applications"].includes(path)) {
    if (path === "/course/withdraw") value.withdrawalOpen = isWithdrawalOpen(semester);
    if (path === "/course/general") value.generalSelectionOpen = isGeneralSelectionOpen(semester);
    if (path === "/course/general") value.courses = rows<AcademicCourse>(`${courseSelect} WHERE o.semester = ? AND o.general_education = 1
      AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.offering_id = o.id AND e.student_user_id = ?)
      AND NOT EXISTS (SELECT 1 FROM student_applications a WHERE a.offering_id = o.id AND a.student_user_id = ? AND a.kind = 'withdraw' AND a.status = 'approved')
      ORDER BY c.course_code`, semester, user.id, user.id);
    value.columns = ["申請日期", "學號", "姓名", "類型", "課程／學期", "申請原因", "狀態", "審核意見"];
    if (path === "/course/withdraw") value.columns = value.columns.slice(0, -1);
    const applications = rows<{ id: number; created: string; username: string; studentName: string; kind: string; courseName: string | null; semester: string; reason: string; status: string; reviewNote: string }>(
      `SELECT a.id, a.created_at AS created, u.username, s.name AS studentName, a.kind, c.name AS courseName,
              a.semester, a.reason, a.status, a.review_note AS reviewNote
       FROM student_applications a JOIN students s ON s.user_id = a.student_user_id JOIN users u ON u.id = s.user_id
       LEFT JOIN course_offerings o ON o.id = a.offering_id LEFT JOIN courses c ON c.id = o.course_id
       WHERE a.semester = ? AND ${teacher ? "((a.kind = 'general' AND o.teacher_user_id = ?) OR (a.kind = 'military' AND s.department = ?))" : "a.student_user_id = ? AND a.kind = ?"}
       ORDER BY a.created_at DESC, a.id DESC`, semester, user.id, teacher ? identity.department : path === "/course/withdraw" ? "withdraw" : path === "/course/general" ? "general" : "military");
    value.records = applications.map((a) => {
      const cells = [a.created.slice(0, 10), a.username, a.studentName, applicationLabels[a.kind], `${a.courseName || "兵役"} · ${a.semester}`, a.reason,
        a.kind === "withdraw" && a.status === "approved" ? "已停修" : statuses[a.status]];
      if (path !== "/course/withdraw") cells.push(a.reviewNote);
      return { id: a.id, status: a.status, kind: a.kind, cells };
    });
    value.note = path === "/course/withdraw" ? "送出即完成停修、移除選課並留下停修紀錄，不需教師審核，完成後不能自行取消。已公布成績的課程不可停修。"
      : path === "/course/general" ? "老師將授課課程標記為通識後會列於此處。初選不保留名額；老師核准時會檢查加退選開放狀態、名額與衝堂後正式加選。"
      : "兵役申請由同系老師審核並記錄結果；本系統只保存校內申請，不會送件至外部機關。";
    if (teacher) value.note = "只處理自己授課課程的通識初選，以及同系學生的兵役申請。通識核准時依加選規則正式加入課程。";
  }
  if (path === "/entry/teaching-evaluation" || path === "/teacher/evaluations") {
    if (teacher) {
      value.columns = ["課程", "回覆人數", "平均評分（1–5）"];
      const results = rows<{ id: number; name: string; count: number; average: number | null }>(
        `SELECT o.id, c.name, COUNT(e.student_user_id) AS count, AVG(e.rating) AS average
         FROM course_offerings o JOIN courses c ON c.id = o.course_id LEFT JOIN teaching_evaluations e ON e.offering_id = o.id
         WHERE o.teacher_user_id = ? AND o.semester = ? GROUP BY o.id ORDER BY c.course_code`, user.id, semester);
      value.records = results.map((e) => ({ id: e.id, cells: [e.name, String(e.count), e.average === null ? "—" : e.average.toFixed(2)] }));
      value.note = "只顯示授課課程的彙總評分；不提供學生身分與個別評論。";
    } else {
      value.columns = ["課程", "評分（1–5）", "評論", "更新日期"];
      const evaluations = rows<{ id: number; name: string; rating: number; comment: string; updated: string }>(
        `SELECT e.offering_id AS id, c.name, e.rating, e.comment, e.updated_at AS updated FROM teaching_evaluations e
         JOIN course_offerings o ON o.id = e.offering_id JOIN courses c ON c.id = o.course_id
         WHERE e.student_user_id = ? AND o.semester = ? ORDER BY c.course_code`, user.id, semester);
      value.records = evaluations.map((e) => ({ id: e.id, cells: [e.name, String(e.rating), e.comment, e.updated.slice(0, 10)] }));
      value.note = "每門已選課程可填一份評量，重送會更新原紀錄。老師只能查看彙總評分。";
    }
  }
  if (path === "/entry/questionnaire" || path === "/teacher/questionnaires") {
    value.surveys = rows<AcademicSurvey>(
      `SELECT q.id, q.title, q.question, q.is_open AS isOpen, c.name AS courseName,
       ${teacher ? "''" : "COALESCE(r.answer, '')"} AS answer,
       (SELECT COUNT(*) FROM questionnaire_responses response WHERE response.questionnaire_id = q.id) AS count
       FROM course_questionnaires q JOIN course_offerings o ON o.id = q.offering_id JOIN courses c ON c.id = o.course_id
       ${teacher ? "" : "JOIN enrollments e ON e.offering_id = o.id AND e.student_user_id = ? LEFT JOIN questionnaire_responses r ON r.questionnaire_id = q.id AND r.student_user_id = ?"}
       WHERE o.semester = ? AND ${teacher ? "o.teacher_user_id = ?" : "1 = 1"} ORDER BY q.created_at DESC, q.id DESC`,
      ...(teacher ? [semester, user.id] : [user.id, user.id, semester]));
    if (teacher) {
      value.columns = ["問卷", "回答"];
      const answers = rows<{ id: number; title: string; answer: string }>(`SELECT ROW_NUMBER() OVER (ORDER BY r.updated_at DESC) AS id, q.title, r.answer
        FROM questionnaire_responses r JOIN course_questionnaires q ON q.id = r.questionnaire_id
        JOIN course_offerings o ON o.id = q.offering_id WHERE o.teacher_user_id = ? AND o.semester = ? ORDER BY r.updated_at DESC`, user.id, semester);
      value.records = answers.map((a) => ({ id: a.id, cells: [a.title, a.answer] }));
    }
    value.note = "每份問卷有一題文字問題；開放時可填寫或修改，關閉後只能查看。老師看到的回答不包含學生身分。";
  }
  if (path === "/query/teacher-schedule" || path === "/query/classroom-schedule") {
    if (path === "/query/teacher-schedule") {
      value.teachers = rows<{ id: number; name: string; department: string }>("SELECT user_id AS id, name, department FROM teachers ORDER BY department, name");
      const id = params.get("teacherId");
      value.teacherId = id ? Number(id) : teacher ? user.id : null;
      if (id && (!/^[1-9]\d*$/.test(id) || !value.teachers.some((t) => t.id === value.teacherId))) throw new Response("老師無效", { status: 400 });
    } else {
      value.classrooms = rows<{ classroom: string }>("SELECT DISTINCT s.classroom FROM course_schedules s JOIN course_offerings o ON o.id = s.offering_id WHERE o.semester = ? ORDER BY s.classroom", semester).map((s) => s.classroom);
      value.classroom = params.get("classroom") || "";
      if (value.classroom && !value.classrooms.includes(value.classroom)) throw new Response("教室無效", { status: 400 });
    }
    if (value.teacherId || value.classroom) {
      value.lessons = rows<AcademicLesson>(`SELECT o.id AS offeringId, c.course_code AS code, c.name, o.section,
        s.classroom, s.weekday, s.start_period AS startPeriod, s.end_period AS endPeriod
        FROM course_offerings o JOIN courses c ON c.id = o.course_id LEFT JOIN course_schedules s ON s.offering_id = o.id
        WHERE o.semester = ? AND ${value.teacherId ? "o.teacher_user_id = ?" : "s.classroom = ?"}
        ORDER BY c.course_code, s.weekday, s.start_period`, semester, value.teacherId || value.classroom);
    }
    value.note = "日校課程安排於週一至週五、第 1–8 節，最晚 17:20 下課。";
  }
  return value;
}

class InputError extends Error {}
function textField(form: FormData, key: string, max = 1000, required = true) {
  const input = form.get(key);
  if (input !== null && typeof input !== "string") throw new InputError("欄位格式無效。");
  const value = (input || "").trim();
  if ((required && !value) || value.length > max) throw new InputError(`請填寫有效欄位（最多 ${max} 字）。`);
  return value;
}
function idField(form: FormData, key: string) {
  const value = textField(form, key, 20);
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new InputError("請選擇有效資料。");
  return Number(value);
}
function dateField(form: FormData, key: string) {
  const value = textField(form, key, 10);
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new InputError("日期無效。");
  // Compare calendar dates in the school's timezone.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (value > today) throw new InputError("不可登錄未來日期。");
  return value;
}
function choice(form: FormData, key: string, values: string[]) {
  const value = textField(form, key);
  if (!values.includes(value)) throw new InputError("選項無效。");
  return value;
}
function ownCourse(user: CurrentUser, id: number, active = true) {
  const course = row<{ id: number; semester: string; generalEducation: number }>(
    "SELECT id, semester, general_education AS generalEducation FROM course_offerings WHERE id = ? AND teacher_user_id = ?", id, user.id);
  if (user.role !== "teacher" || !course) throw new Response("Forbidden", { status: 403 });
  if (active && course.semester !== ACTIVE_SEMESTER) throw new InputError("僅能修改目前學期資料。");
  return course;
}
function enrolled(studentId: number, offeringId: number) {
  if (!row("SELECT 1 FROM enrollments WHERE student_user_id = ? AND offering_id = ?", studentId, offeringId)) throw new InputError("學生未選修這門課。");
}
function studentCourse(user: CurrentUser, offeringId: number) {
  if (user.role !== "student") throw new Response("Forbidden", { status: 403 });
  enrolled(user.id, offeringId);
  const course = row<{ semester: string }>("SELECT semester FROM course_offerings WHERE id = ?", offeringId);
  if (course?.semester !== ACTIVE_SEMESTER) throw new InputError("僅能申請或填寫目前學期課程。");
}

export function saveAcademicAction(user: CurrentUser, path: string, form: FormData): string | null {
  const db = getDatabase();
  const identity = profile(user);
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    const intent = textField(form, "intent", 30);
    if (path === "/teacher/courses" && intent === "general-setting") {
      const offeringId = idField(form, "offeringId");
      ownCourse(user, offeringId);
      const general = choice(form, "generalEducation", ["0", "1"]);
      if (general === "0" && row("SELECT 1 FROM student_applications WHERE offering_id = ? AND kind = 'general' AND status = 'pending'", offeringId)) throw new InputError("仍有通識初選待審，請先處理後再取消通識標記。");
      run("UPDATE course_offerings SET general_education = ? WHERE id = ?", Number(general), offeringId);
    } else if (["/teacher/grades", "/teacher/alerts", "/teacher/attendance"].includes(path)) {
      const offeringId = idField(form, "offeringId");
      ownCourse(user, offeringId);
      const studentId = idField(form, "studentId");
      enrolled(studentId, offeringId);
      if (path === "/teacher/grades" && intent === "grade") {
        const scoreText = textField(form, "score", 10);
        const score = Number(scoreText);
        if (!/^\d+(\.\d{1,2})?$/.test(scoreText) || !Number.isFinite(score) || score < 0 || score > 100) throw new InputError("成績須為 0–100，最多兩位小數。");
        const published = Number(choice(form, "published", ["0", "1"]));
        run(`INSERT INTO academic_grades VALUES (?, ?, ?, ?, ?) ON CONFLICT(student_user_id, offering_id)
          DO UPDATE SET score = excluded.score, published = excluded.published, updated_at = excluded.updated_at`, studentId, offeringId, score, published, now);
      } else if (path === "/teacher/alerts" && ["alert", "clear-alert"].includes(intent)) {
        if (!isMidtermAlertOpen(ACTIVE_SEMESTER)) throw new InputError(MIDTERM_ALERT_CLOSED_MESSAGE);
        if (intent === "clear-alert") run("DELETE FROM midterm_alerts WHERE student_user_id = ? AND offering_id = ?", studentId, offeringId);
        else run(`INSERT INTO midterm_alerts VALUES (?, ?, ?, ?) ON CONFLICT(student_user_id, offering_id)
          DO UPDATE SET reason = excluded.reason, updated_at = excluded.updated_at`, studentId, offeringId, textField(form, "reason"), now);
      } else if (path === "/teacher/attendance" && intent === "attendance") {
        const date = dateField(form, "date");
        const period = Number(textField(form, "period", 2));
        const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
        if (!Number.isInteger(period) || period < 1 || period > 8 || !row("SELECT 1 FROM course_schedules WHERE offering_id = ? AND weekday = ? AND start_period <= ? AND end_period >= ?", offeringId, weekday, period, period)) throw new InputError(`所選日期與節次不在課程的週${weekdays[weekday]}時段內。`);
        const status = choice(form, "status", ["present", "absent", "late", "leave"]);
        if (status === "present") run("DELETE FROM attendance_records WHERE student_user_id = ? AND offering_id = ? AND attendance_date = ? AND period = ?", studentId, offeringId, date, period);
        else run(`INSERT INTO attendance_records (student_user_id, offering_id, attendance_date, period, status, note, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(student_user_id, offering_id, attendance_date, period)
          DO UPDATE SET status = excluded.status, note = excluded.note, updated_at = excluded.updated_at`, studentId, offeringId, date, period, status, textField(form, "note", 1000, false), now);
      } else throw new InputError("操作無效。");
    } else if (path === "/teacher/discipline") {
      if (user.role !== "teacher") throw new Response("Forbidden", { status: 403 });
      if (intent === "delete-discipline") {
        const recordId = idField(form, "recordId");
        if (!run("DELETE FROM student_discipline WHERE id = ? AND teacher_user_id = ?", recordId, user.id).changes) throw new InputError("無法移除此紀錄。");
      } else if (intent === "discipline") {
        const studentId = idField(form, "studentId");
        if (!row("SELECT 1 FROM students WHERE user_id = ? AND department = ?", studentId, identity.department)) throw new Response("Forbidden", { status: 403 });
        run("INSERT INTO student_discipline (student_user_id, teacher_user_id, record_date, kind, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)", studentId, user.id, dateField(form, "date"), choice(form, "kind", ["reward", "punishment"]), textField(form, "reason"), now);
      } else throw new InputError("操作無效。");
    } else if (["/course/withdraw", "/course/general", "/student/military-service"].includes(path)) {
      if (user.role !== "student") throw new Response("Forbidden", { status: 403 });
      const kind = path === "/course/withdraw" ? "withdraw" : path === "/course/general" ? "general" : "military";
      if (intent === "cancel-application") {
        if (!run("UPDATE student_applications SET status = 'cancelled', reviewed_at = ? WHERE id = ? AND student_user_id = ? AND kind = ? AND status = 'pending'", now, idField(form, "recordId"), user.id, kind).changes) throw new InputError("申請已被處理或無法取消。");
      } else if (intent === "apply") {
        if (kind === "withdraw" && !isWithdrawalOpen(ACTIVE_SEMESTER)) throw new InputError(WITHDRAWAL_CLOSED_MESSAGE);
        if (kind === "general" && !isGeneralSelectionOpen(ACTIVE_SEMESTER)) throw new InputError(GENERAL_SELECTION_CLOSED_MESSAGE);
        const offeringId = kind === "military" ? null : idField(form, "offeringId");
        if (kind === "withdraw" && offeringId) {
          studentCourse(user, offeringId);
          if (row("SELECT 1 FROM academic_grades WHERE student_user_id = ? AND offering_id = ? AND published = 1", user.id, offeringId)) throw new InputError("已公布成績的課程不可停修。");
        }
        if (kind === "general" && offeringId) {
          if (!row("SELECT 1 FROM course_offerings WHERE id = ? AND semester = ? AND general_education = 1", offeringId, ACTIVE_SEMESTER)) throw new InputError("這門課未開放通識初選。");
          if (row("SELECT 1 FROM enrollments WHERE student_user_id = ? AND offering_id = ?", user.id, offeringId)) throw new InputError("已選課程無須初選。");
          if (row("SELECT 1 FROM student_applications WHERE student_user_id = ? AND offering_id = ? AND kind = 'withdraw' AND status = 'approved'", user.id, offeringId)) throw new InputError("已停修課程不可重新申請。");
        }
        if (row("SELECT 1 FROM student_applications WHERE student_user_id = ? AND kind = ? AND IFNULL(offering_id, 0) = ? AND semester = ? AND status = 'pending'", user.id, kind, offeringId || 0, ACTIVE_SEMESTER)) throw new InputError("已有待審申請，請勿重複送出。");
        run("INSERT INTO student_applications (student_user_id, offering_id, semester, kind, reason, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)", user.id, offeringId, ACTIVE_SEMESTER, kind, textField(form, "reason"), now, kind === "withdraw" ? "approved" : "pending");
        if (kind === "withdraw") {
          run("DELETE FROM academic_grades WHERE student_user_id = ? AND offering_id = ? AND published = 0", user.id, offeringId);
          run("DELETE FROM midterm_alerts WHERE student_user_id = ? AND offering_id = ?", user.id, offeringId);
          run("DELETE FROM enrollments WHERE student_user_id = ? AND offering_id = ?", user.id, offeringId);
        }
      } else throw new InputError("操作無效。");
    } else if (path === "/teacher/applications" && intent === "review") {
      if (user.role !== "teacher") throw new Response("Forbidden", { status: 403 });
      const application = row<{ id: number; studentId: number; offeringId: number | null; semester: string; kind: string; status: string; department: string }>(
        `SELECT a.id, a.student_user_id AS studentId, a.offering_id AS offeringId, a.semester, a.kind, a.status, s.department
         FROM student_applications a JOIN students s ON s.user_id = a.student_user_id WHERE a.id = ?`, idField(form, "recordId"));
      if (!application) throw new InputError("找不到申請。");
      if (application.kind === "withdraw") throw new InputError("停修不需教師審核。");
      if (application.kind === "military") {
        if (application.department !== identity.department) throw new Response("Forbidden", { status: 403 });
      } else ownCourse(user, application.offeringId!);
      if (application.status !== "pending" || application.semester !== ACTIVE_SEMESTER) throw new InputError("申請已被處理或非目前學期。");
      const status = choice(form, "decision", ["approved", "rejected"]);
      const reviewNote = textField(form, "reviewNote");
      if (status === "approved" && application.kind === "general") {
        const course = ownCourse(user, application.offeringId!);
        if (!course.generalEducation) throw new InputError("課程已取消通識標記。");
        // addEnrollment uses this transaction so enrollment and review commit together.
        const error = addEnrollment(application.studentId, application.offeringId!, true);
        if (error) throw new InputError(error);
      }
      run("UPDATE student_applications SET status = ?, reviewer_user_id = ?, review_note = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'", status, user.id, reviewNote, now, application.id);
    } else if (path === "/entry/teaching-evaluation" && intent === "evaluation") {
      const offeringId = idField(form, "offeringId");
      studentCourse(user, offeringId);
      const rating = Number(choice(form, "rating", ["1", "2", "3", "4", "5"]));
      run(`INSERT INTO teaching_evaluations VALUES (?, ?, ?, ?, ?) ON CONFLICT(student_user_id, offering_id)
        DO UPDATE SET rating = excluded.rating, comment = excluded.comment, updated_at = excluded.updated_at`, user.id, offeringId, rating, textField(form, "comment", 1000, false), now);
    } else if (path === "/teacher/questionnaires") {
      if (intent === "questionnaire") {
        const offeringId = idField(form, "offeringId");
        ownCourse(user, offeringId);
        run("INSERT INTO course_questionnaires (offering_id, title, question, created_at) VALUES (?, ?, ?, ?)", offeringId, textField(form, "title", 100), textField(form, "question"), now);
      } else if (intent === "toggle-questionnaire") {
        const questionnaireId = idField(form, "questionnaireId");
        const q = row<{ offeringId: number }>("SELECT offering_id AS offeringId FROM course_questionnaires WHERE id = ?", questionnaireId);
        if (!q) throw new InputError("找不到問卷。");
        ownCourse(user, q.offeringId);
        run("UPDATE course_questionnaires SET is_open = ? WHERE id = ?", Number(choice(form, "isOpen", ["0", "1"])), questionnaireId);
      } else throw new InputError("操作無效。");
    } else if (path === "/entry/questionnaire" && intent === "response") {
      const questionnaireId = idField(form, "questionnaireId");
      const q = row<{ offeringId: number; isOpen: number }>("SELECT offering_id AS offeringId, is_open AS isOpen FROM course_questionnaires WHERE id = ?", questionnaireId);
      if (!q || !q.isOpen) throw new InputError("問卷已關閉。");
      studentCourse(user, q.offeringId);
      run(`INSERT INTO questionnaire_responses VALUES (?, ?, ?, ?) ON CONFLICT(questionnaire_id, student_user_id)
        DO UPDATE SET answer = excluded.answer, updated_at = excluded.updated_at`, questionnaireId, user.id, textField(form, "answer"), now);
    } else throw new Response("Method Not Allowed", { status: 405 });
    db.exec("COMMIT");
    return null;
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    if (error instanceof InputError) return error.message;
    throw error;
  }
}

export function getPortalDashboard(user: CurrentUser) {
  const identity = profile(user);
  const teacher = user.role === "teacher";
  const courses = rows<AcademicCourse>(`${courseSelect} ${teacher ? "WHERE o.teacher_user_id = ?" : "JOIN enrollments e ON e.offering_id = o.id WHERE e.student_user_id = ?"} AND o.semester = ? ORDER BY c.course_code`, user.id, ACTIVE_SEMESTER);
  const pending = row<{ count: number }>(`SELECT COUNT(*) AS count FROM student_applications a JOIN students s ON s.user_id = a.student_user_id
    LEFT JOIN course_offerings o ON o.id = a.offering_id WHERE a.semester = ? AND a.status = 'pending' AND
    ${teacher ? "((a.kind = 'general' AND o.teacher_user_id = ?) OR (a.kind = 'military' AND s.department = ?))" : "a.student_user_id = ?"}`, ACTIVE_SEMESTER, user.id, ...(teacher ? [identity.department] : []))?.count || 0;
  return { ...identity, semester: ACTIVE_SEMESTER, courses, pending };
}
