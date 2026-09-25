# HW2 本機登入網站

使用 React Router 7 Framework Mode、React 19 與 Node.js 24 內建 SQLite 製作的本機登入範例。

## 環境需求

- Node.js 24 或更新版本
- npm

## 首次設定

在 `hw2/` 專案根目錄執行：

```bash
npm install
npm run db:migrate
```

`npm run db:migrate` 依檔名順序套用 `migrations/*.sql` 到 `data/hw2.sqlite`。`0001_initial.sql` 建立 `users` 與 `sessions`；`users.role` 只允許 `student` 或 `teacher`。`0002_create_students.sql` 建立學生資料表，以 `user_id` 對應 `users.id`；學生的 `users.username` 即學號。

管理員帳號獨立於資料庫。複製 `.dev.vars.example` 為專案根目錄的 `.dev.vars`，填入管理員帳號、scrypt 密碼雜湊及隨機 session secret。`.dev.vars` 不會納入版本控制：

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=產生的雜湊
ADMIN_SESSION_SECRET=至少32字元的隨機密鑰
```

管理員密碼雜湊可用本機 Node 指令自行產生。格式須與目前密碼驗證函式一致：`scrypt$131072$8$1$<base64url salt>$<base64url hash>`，其中 salt 為 16 bytes、hash 為 64 bytes。隨機 session secret 可用以下指令產生：

```bash
node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'
```

將兩項輸出分別填入 `.dev.vars` 後啟動：

```bash
npm run dev
```

`npm run dev` 與 `npm start` 會載入 `.dev.vars`。管理員未設定完整時，管理員登入頁回傳 503。老師帳號與管理後台的帳號建立功能尚未加入。

## 手動建立學生帳號

先在 `hw2/` 執行 `npm run db:migrate`，再將下方指令最後五個參數改成學號、姓名、生日（`YYYY-MM-DD`）、系所與年級。每執行一次建立一筆；要加多筆時換不同學號重複執行。學號保留為文字，前導零不會消失。

```bash
node --experimental-strip-types --input-type=module -e '
import { getDatabase } from "./app/lib/db.server.ts";
import { hashPassword } from "./app/lib/password.server.ts";

const [studentNo, rawName, birthDate, rawDepartment, gradeText] = process.argv.slice(1);
const name = rawName?.trim();
const department = rawDepartment?.trim();
const grade = Number(gradeText);

if (!studentNo || !/^\d{1,30}$/.test(studentNo)) throw new Error("學號須為 1 到 30 位數字");
if (!name || !department) throw new Error("姓名與系所不可空白");
if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
    Number.isNaN(Date.parse(birthDate)) ||
    new Date(birthDate).toISOString().slice(0, 10) !== birthDate) {
  throw new Error("生日須為有效的 YYYY-MM-DD 日期");
}
if (!/^[1-9]\d*$/.test(gradeText ?? "") || !Number.isSafeInteger(grade)) {
  throw new Error("年級須為正整數");
}

const passwordHash = await hashPassword(birthDate.replaceAll("-", ""));
const db = getDatabase();
try {
  db.exec("BEGIN");
  const result = db.prepare(
    "INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)"
  ).run(studentNo, passwordHash, "student", new Date().toISOString());
  db.prepare(
    "INSERT INTO students (user_id, name, birth_date, department, grade) VALUES (?, ?, ?, ?, ?)"
  ).run(result.lastInsertRowid, name, birthDate, department, grade);
  db.exec("COMMIT");
  console.log(`已建立學生帳號：${studentNo}`);
} catch (error) {
  if (db.isTransaction) db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
' 11300123 '王小明' 2006-03-21 '資工系' 2
```

指令沿用網站的 scrypt 雜湊函式及已啟用外鍵約束的資料庫連線，並在同一筆交易寫入 `users`、`students`；學號重複或寫入失敗時會回滾。學生可到 `/login` 用學號及生日去掉連字號後的八位數（例：`20060321`）登入。生日密碼容易被推測，此方式僅供本機測試資料使用。

## 路由

- `/`：首頁與登入狀態
- `/login`：學生與老師登入頁
- `/logout`：學生與老師登出，只接受 POST
- `/kpGjBpPZC2/login`：管理員登入頁
- `/kpGjBpPZC2`：需管理員 session 的後台入口
- `/kpGjBpPZC2/logout`：管理員登出，只接受 POST

## 其他指令

```bash
npm run typecheck
npm run build
npm start
```

SQLite 資料檔已排除版本控制。
