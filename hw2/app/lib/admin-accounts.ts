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

export function accountListSearch(kind: AccountKind, search: string) {
  const source = new URLSearchParams(search);
  const params = new URLSearchParams();
  if (source.get("search") === "1") params.set("search", "1");
  for (const key of kind === "students" ? ["q", "department", "grade", "page"] : ["q", "department", "page"]) {
    const value = source.get(key);
    if (value) params.set(key, value);
  }
  return params.size ? `?${params}` : "";
}
