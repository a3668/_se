import { ADMIN_STUDENTS_PATH, ADMIN_TEACHERS_PATH } from "./admin-paths";

export type AccountKind = "students" | "teachers";

export type AccountFields = {
  username: string;
  name: string;
  birthDate: string;
  department: string;
  grade: string;
};

export function accountPath(kind: AccountKind) {
  return kind === "students" ? ADMIN_STUDENTS_PATH : ADMIN_TEACHERS_PATH;
}

export function accountLabel(kind: AccountKind) {
  return kind === "students" ? "學生" : "教師";
}
