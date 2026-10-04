import { getDatabase } from "./db.server";

export const GENERAL_SELECTION_CLOSED_MESSAGE = "目前全校未開放通識初選。";

export function isGeneralSelectionOpen(semester: string): boolean {
  const setting = getDatabase().prepare(
    "SELECT is_open FROM general_selection_settings WHERE semester = ?",
  ).get(semester) as { is_open: number } | undefined;
  return setting?.is_open === 1;
}

export function saveGeneralSelectionSettings(semester: string, mode: FormDataEntryValue | null): string | null {
  if (mode !== "closed" && mode !== "open") return "請選擇有效的開放方式。";
  getDatabase().prepare(
    `INSERT INTO general_selection_settings (semester, is_open) VALUES (?, ?)
     ON CONFLICT(semester) DO UPDATE SET is_open = excluded.is_open`,
  ).run(semester, mode === "open" ? 1 : 0);
  return null;
}
