import { getDatabase } from "./db.server";

export function isSemesterGradeOpen(semester: string): boolean {
  const setting = getDatabase().prepare(
    "SELECT is_open FROM semester_grade_settings WHERE semester = ?",
  ).get(semester) as { is_open: number } | undefined;
  return setting?.is_open === 1;
}

export function saveSemesterGradeSettings(semester: string, mode: FormDataEntryValue | null): string | null {
  if (mode !== "closed" && mode !== "open") return "請選擇有效的開放方式。";
  getDatabase().prepare(
    `INSERT INTO semester_grade_settings (semester, is_open) VALUES (?, ?)
     ON CONFLICT(semester) DO UPDATE SET is_open = excluded.is_open`,
  ).run(semester, mode === "open" ? 1 : 0);
  return null;
}
