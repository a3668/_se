import { getDatabase } from "./db.server";
import { hashPassword } from "./password.server";
import type { AccountFields, AccountKind } from "./admin-accounts";

export type Account = {
  user_id: number;
  username: string;
  name: string;
  birth_date: string;
  department: string;
  grade: number | null;
};

export function requireAccountKind(value: string | undefined): AccountKind {
  if (value === "students" || value === "teachers") return value;
  throw new Response("Not Found", { status: 404 });
}

function accountTable(kind: AccountKind) {
  return kind === "students" ? "students" : "teachers";
}

export function parseAccountId(value: string | undefined) {
  const id = Number(value);
  if (!value || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(id)) {
    throw new Response("Not Found", { status: 404 });
  }
  return id;
}

export function fieldsFromForm(formData: FormData): AccountFields {
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  return {
    username: field("username"),
    name: field("name"),
    birthDate: field("birthDate"),
    department: field("department"),
    grade: field("grade"),
  };
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateAccountFields(kind: AccountKind, fields: AccountFields, creating: boolean) {
  if (creating) {
    const pattern = kind === "students" ? /^\d{1,30}$/ : /^[A-Za-z0-9]{1,30}$/;
    if (!pattern.test(fields.username)) {
      return kind === "students" ? "學號須為 1–30 位數字。" : "教師編號須為 1–30 碼英數字。";
    }
  }
  if (!fields.name || fields.name.length > 100) return "姓名須為 1–100 字。";
  if (!validDate(fields.birthDate)) return "生日須為有效的 YYYY-MM-DD 日期。";
  if (!fields.department || fields.department.length > 100) return "系所須為 1–100 字。";
  if (kind === "students" && (!/^[1-9]\d*$/.test(fields.grade) || !Number.isSafeInteger(Number(fields.grade)))) {
    return "年級須為正整數。";
  }
  return null;
}

export function listAccounts(kind: AccountKind, query: string): Account[] {
  const db = getDatabase();
  const table = accountTable(kind);
  const grade = kind === "students" ? "profile.grade" : "NULL AS grade";
  return db.prepare(
    `SELECT users.id AS user_id, users.username, profile.name, profile.birth_date,
            profile.department, ${grade}
     FROM ${table} AS profile
     JOIN users ON users.id = profile.user_id
     WHERE users.role = ?
       AND (? = '' OR instr(lower(users.username), lower(?)) > 0
                    OR instr(lower(profile.name), lower(?)) > 0)
     ORDER BY users.username COLLATE NOCASE`,
  ).all(kind === "students" ? "student" : "teacher", query, query, query) as Account[];
}

export function getAccount(kind: AccountKind, id: number): Account | null {
  const table = accountTable(kind);
  const grade = kind === "students" ? "profile.grade" : "NULL AS grade";
  const row = getDatabase().prepare(
    `SELECT users.id AS user_id, users.username, profile.name, profile.birth_date,
            profile.department, ${grade}
     FROM ${table} AS profile
     JOIN users ON users.id = profile.user_id
     WHERE users.id = ? AND users.role = ?`,
  ).get(id, kind === "students" ? "student" : "teacher") as Account | undefined;
  return row ?? null;
}

export async function createAccount(kind: AccountKind, fields: AccountFields) {
  const error = validateAccountFields(kind, fields, true);
  if (error) return { error };

  const db = getDatabase();
  if (db.prepare("SELECT 1 FROM users WHERE username = ? COLLATE NOCASE").get(fields.username)) {
    return { error: "這個學號或教師編號已被使用。" };
  }

  const passwordHash = await hashPassword(fields.birthDate.replaceAll("-", ""));
  try {
    db.exec("BEGIN IMMEDIATE");
    const result = db.prepare(
      "INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)",
    ).run(fields.username, passwordHash, kind === "students" ? "student" : "teacher", new Date().toISOString());
    const id = Number(result.lastInsertRowid);
    if (kind === "students") {
      db.prepare("INSERT INTO students (user_id, name, birth_date, department, grade) VALUES (?, ?, ?, ?, ?)")
        .run(id, fields.name, fields.birthDate, fields.department, Number(fields.grade));
    } else {
      db.prepare("INSERT INTO teachers (user_id, name, birth_date, department) VALUES (?, ?, ?, ?)")
        .run(id, fields.name, fields.birthDate, fields.department);
    }
    db.exec("COMMIT");
    return { id };
  } catch (cause) {
    if (db.isTransaction) db.exec("ROLLBACK");
    if (cause instanceof Error && cause.message.includes("UNIQUE constraint failed: users.username")) {
      return { error: "這個學號或教師編號已被使用。" };
    }
    throw cause;
  }
}

export function updateAccount(kind: AccountKind, id: number, fields: AccountFields) {
  const error = validateAccountFields(kind, fields, false);
  if (error) return { error };
  const db = getDatabase();
  const table = accountTable(kind);
  const statement = kind === "students"
    ? `UPDATE ${table} SET name = ?, birth_date = ?, department = ?, grade = ? WHERE user_id = ?`
    : `UPDATE ${table} SET name = ?, birth_date = ?, department = ? WHERE user_id = ?`;
  const result = kind === "students"
    ? db.prepare(statement).run(fields.name, fields.birthDate, fields.department, Number(fields.grade), id)
    : db.prepare(statement).run(fields.name, fields.birthDate, fields.department, id);
  if (result.changes !== 1) throw new Response("Not Found", { status: 404 });
  return { error: null };
}

export async function resetAccountPassword(kind: AccountKind, id: number) {
  const account = getAccount(kind, id);
  if (!account) throw new Response("Not Found", { status: 404 });
  const passwordHash = await hashPassword(account.birth_date.replaceAll("-", ""));
  const db = getDatabase();
  try {
    db.exec("BEGIN IMMEDIATE");
    const result = db.prepare(
      `UPDATE users SET password_hash = ?
       WHERE id = ? AND role = ? AND EXISTS (
         SELECT 1 FROM ${accountTable(kind)}
         WHERE user_id = users.id AND birth_date = ?
       )`,
    ).run(passwordHash, id, kind === "students" ? "student" : "teacher", account.birth_date);
    if (result.changes !== 1) {
      db.exec("ROLLBACK");
      return { error: "生日已變更，請重新載入後再重設密碼。" };
    }
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    db.exec("COMMIT");
    return { error: null };
  } catch (cause) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw cause;
  }
}
