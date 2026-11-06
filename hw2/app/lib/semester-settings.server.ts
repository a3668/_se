import { getDatabase } from "./db.server";

export const SEMESTER_CHANGED_MESSAGE = "目前學期已變更，請重新載入頁面後再操作。";

export function getActiveSemester(): string {
  const setting = getDatabase().prepare("SELECT active_semester FROM system_settings WHERE id = 1")
    .get() as { active_semester: string } | undefined;
  if (!setting) throw new Error("Missing active semester setting; apply database migrations first.");
  return setting.active_semester;
}

export function compareSemesters(a: string, b: string): number {
  const [aYear, aTerm] = a.split("-").map(Number);
  const [bYear, bTerm] = b.split("-").map(Number);
  return aYear - bYear || aTerm - bTerm;
}

export function getOfferingSemesters(): string[] {
  return (getDatabase().prepare("SELECT DISTINCT semester FROM course_offerings").all() as { semester: string }[])
    .map((row) => row.semester).sort((a, b) => compareSemesters(b, a));
}

// Keep the semester check and write under the same lock, including across processes.
export function withCurrentSemester(expected: FormDataEntryValue | null, save: (semester: string) => string | null): string | null {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    const semester = getActiveSemester();
    const error = expected !== semester ? SEMESTER_CHANGED_MESSAGE : save(semester);
    db.exec(error ? "ROLLBACK" : "COMMIT");
    return error;
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

export function saveActiveSemester(expected: FormDataEntryValue | null, value: FormDataEntryValue | null): string | null {
  return withCurrentSemester(expected, () => {
    if (typeof value !== "string" || !getOfferingSemesters().includes(value)) return "請選擇已有開課資料的學期。";
    getDatabase().prepare("UPDATE system_settings SET active_semester = ? WHERE id = 1").run(value);
    return null;
  });
}
