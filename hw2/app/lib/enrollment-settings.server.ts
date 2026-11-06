import { getDatabase } from "./db.server";

export const ENROLLMENT_CLOSED_MESSAGE = "目前未開放你的年級加退選";

export function getEnrollmentSettings(semester: string) {
  const db = getDatabase();
  const grades = db.prepare("SELECT DISTINCT grade FROM students ORDER BY grade")
    .all() as { grade: number }[];
  const openGrades = db.prepare("SELECT grade FROM enrollment_open_grades WHERE semester = ? ORDER BY grade")
    .all(semester) as { grade: number }[];
  return { grades: grades.map((row) => row.grade), openGrades: openGrades.map((row) => row.grade) };
}

export function isStudentEnrollmentOpen(studentUserId: number, semester: string) {
  const student = getDatabase().prepare(
    `SELECT EXISTS(SELECT 1 FROM enrollment_open_grades g
                   WHERE g.semester = ? AND g.grade = s.grade) AS is_open
     FROM students s WHERE s.user_id = ?`,
  ).get(semester, studentUserId) as { is_open: number } | undefined;
  if (!student) throw new Response("Forbidden", { status: 403 });
  return Boolean(student.is_open);
}

export function saveEnrollmentOpenGrades(semester: string, mode: FormDataEntryValue | null, values: FormDataEntryValue[]): string | null {
  if (mode !== "closed" && mode !== "all" && mode !== "selected") {
    return "請選擇有效的開放方式。";
  }
  if (mode === "selected" && values.length === 0) return "請至少選擇一個年級。";
  if (mode === "selected" && values.some((value) => typeof value !== "string" || !/^[1-9]\d*$/.test(value)
    || !Number.isSafeInteger(Number(value)))) {
    return "請選擇有效的學生年級。";
  }
  const db = getDatabase();
  const ownsTransaction = !db.isTransaction;
  if (ownsTransaction) db.exec("BEGIN IMMEDIATE");
  try {
    const { grades } = getEnrollmentSettings(semester);
    const selectedGrades = mode === "all" ? grades : mode === "closed" ? [] : [...new Set(values.map(Number))];
    if (mode === "all" && !grades.length) {
      if (ownsTransaction) db.exec("ROLLBACK");
      return "目前沒有學生年級資料，無法開放全年級。";
    }
    if (selectedGrades.some((grade) => !grades.includes(grade))) {
      if (ownsTransaction) db.exec("ROLLBACK");
      return "學生年級資料已變更，請重新載入後再儲存。";
    }
    db.prepare("DELETE FROM enrollment_open_grades WHERE semester = ?").run(semester);
    const insert = db.prepare("INSERT INTO enrollment_open_grades (semester, grade) VALUES (?, ?)");
    for (const grade of selectedGrades) insert.run(semester, grade);
    if (ownsTransaction) db.exec("COMMIT");
    return null;
  } catch (error) {
    if (ownsTransaction && db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}
