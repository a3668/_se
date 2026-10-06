# HW2 校務資訊系統

使用 React Router 7 Framework Mode、React 19 與 Node.js 24 內建 SQLite，提供學生選課與學務查詢、教師授課管理及獨立管理後台。

## 環境需求

- Node.js 24 或更新版本
- npm

## 首次設定

在 `hw2/` 專案根目錄執行：

```bash
npm install
npm run db:migrate
```

`npm run db:migrate` 依檔名順序套用 `migrations/*.sql` 到 `data/hw2.sqlite`。`0001_initial.sql` 建立 `users` 與 `sessions`；`users.role` 只允許 `student` 或 `teacher`。`0002_create_students.sql` 建立學生資料表，`0003_create_teachers.sql` 建立教師資料表，兩者都以 `user_id` 對應 `users.id`。`0004_create_courses.sql` 建立課程、開課與課表資料表；開課的 `semester` 使用 `115-1` 這類學期代碼。`0005_create_enrollments.sql` 建立學生選課資料表。學生與教師的 `users.username` 分別是學號與教師編號。

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

`npm run dev` 與 `npm start` 會載入 `.dev.vars`。管理員未設定完整時，管理員登入頁回傳 503。

## 管理後台

先套用 migrations，再以管理員帳號登入後台。學生與教師管理頁提供列表、依編號或姓名搜尋、新增、編輯資料及重設密碼。學號為 `S` 開頭加 8 位數字，教師編號限 1–30 碼英數字；建立後均不可修改。學生資料包含姓名、生日、系所與年級；教師資料包含姓名、生日與系所。

已登入的學生與教師可在 `/query/class-data` 依學期及系所查詢課程、授課教師與上課時段。這批 15 系資料為虛構示範；課名參考公開課程地圖，學分、必選修、115 學年的開課、教師及時段均為示範配置，不代表來源學校的正式資料。參考來源：[中正大學課程地圖](https://coursemap.ccu.edu.tw/all_dept_list.php)、[臺科大各系課程地圖](https://www.academic.ntust.edu.tw/p/404-1048-78991.php?Lang=zh-tw)、[臺大土木課程地圖](https://coursemap.aca.ntu.edu.tw/course_map_all/class.php?code=5010)、[屏科大應外課程規劃](https://dml.npust.edu.tw/%E8%AA%B2%E7%A8%8B%E8%A6%8F%E5%8A%83/)與[中國科大視傳課程地圖](https://www.cute.edu.tw/dvcd/course-map.html)。

學生可在 `/course/add`、`/course/drop` 加退選 `115-1` 課程（可跨系、跨年級），前提是管理員已開放該學生年級。在 `/course/result` 查看已選課程，在 `/query/my-schedule` 查看週課表。加選會檢查名額與時段衝突；必修也可退選。已公布成績或有待審停修申請的課程不可退選；已核准停修的課程不可重新加選。`115-2` 暫不開放加退選。

## 學生與教師功能

更新程式後，請先在 `hw2/` 執行 `npm run db:migrate`，套用尚未執行的 migration。`0006_create_enrollment_open_grades.sql` 管理年級加退選權限；`0007_create_academic_modules.sql` 加入通識開課標記、成績、期中預警、出缺勤、獎懲、申請、教學評量、問卷及回答。migration 不會自動產生這些業務紀錄，也不會自動將既有課程標成通識。

學生與老師首頁顯示姓名、系所、本學期課程與待審申請數，提供依身分區分的快捷入口。查詢列表以每頁 20 筆顯示；分頁保留學期與查詢條件。我的課表、教師課表、教室課表沿用週一至週日、第 1–8 節的共用表格；日校課程僅安排於週一至週五，最晚 17:20 下課；未排時段另列說明。課程查詢、選課結果、課表與學期紀錄可切換資料中既有的學期。

| 學生功能 | 教師對應功能／規則 |
| --- | --- |
| 學期／歷年成績 | `/teacher/grades` 登錄百分制成績（0–100，最多兩位小數），可存草稿或公布；學生只能看已公布成績，60 分及格，依學分計算加權平均 |
| 期中預警 | `/teacher/alerts` 登錄、更正或解除自己的授課學生預警 |
| 缺曠課明細 | `/teacher/attendance` 登錄缺課、遲到、請假；限課程既有星期與節次，出席會清除該節異常紀錄，不可登錄未來日期 |
| 個人獎懲 | `/teacher/discipline` 由同系老師登錄，老師只可移除自己登錄的錯誤紀錄；學生只能查看本人資料 |
| 停修申請 | `/teacher/applications` 由授課老師審核；核准才移除選課及未公布成績，保留停修與出缺勤歷史；已公布成績不可停修 |
| 通識初選 | 老師在 `/teacher/courses` 將自己的開課標記為通識。初選不保留名額；核准時依正式加選規則檢查年級開放、名額、已選狀態與衝堂，成功才新增選課 |
| 兵役申請 | 同系老師在 `/teacher/applications` 審核，只記錄校內申請結果，不連接外部機關；申請包含事由及審核意見 |
| 教學評量 | 每門已選課程可填寫／更新一份 1–5 分評量及評論；`/teacher/evaluations` 僅顯示自己授課課程的回覆數與平均分，不提供學生身分與個別評論 |
| 問卷調查 | `/teacher/questionnaires` 發布一題文字問卷並開放／關閉；修課學生可在開放時填寫或更新，老師看到的回答不含學生身分 |
| 選課資料查詢 | 顯示本人已選課程、學分、教師與修課人數；老師可查看自己的授課課程與修課名單 |

學生待審申請可取消，核准、駁回、取消均保留歷史。同一學生、學期、類型與課程僅可有一件待審申請。老師審核必須填寫意見；審核與加選／停修資料更新使用同一筆交易。登錄、審核與評量僅能更動 `115-1`；獎懲為依日期保存的跨學期紀錄。一般老師僅能處理自己的授課課程，同系獎懲與兵役則依系所限制。loader 與 action 都會在伺服器端重新檢查角色與資料存取範圍。

新增帳號的初始密碼是生日八碼（`YYYYMMDD`）。編輯生日不會自動更換密碼；按「重設密碼」才會改用目前生日八碼，並使該帳號所有既有登入失效。生日密碼容易被猜到，僅適合這個本機範例。

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

if (!studentNo || !/^S\d{8}$/.test(studentNo)) throw new Error("學號須為 S 開頭加 8 位數字");
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
' S20260999 '王小明' 2006-03-21 '資訊工程學系' 2
```

指令沿用網站的 scrypt 雜湊函式及已啟用外鍵約束的資料庫連線，並在同一筆交易寫入 `users`、`students`；學號重複或寫入失敗時會回滾。學生可到 `/login` 用學號及生日去掉連字號後的八位數（例：`20060321`）登入。生日密碼容易被推測，此方式僅供本機測試資料使用。

## 路由

- `/`：首頁與登入狀態
- `/login`：學生與老師登入頁
- `/logout`：學生與老師登出，只接受 POST
- `/query/class-data`：學生與教師查詢示範課程
- `/course/add`、`/course/drop`、`/course/result`：學生加選、退選與選課結果
- `/query/my-schedule`：學生選課／教師授課週課表
- `/query/teacher-schedule`、`/query/classroom-schedule`：教師／教室課表查詢
- `/query/course-data`：學生已選課程資料
- `/query/semester-grades`、`/query/history-grades`、`/query/midterm-alert`：個人成績及預警
- `/course/withdraw`、`/course/general`：停修申請與通識初選
- `/student/absence-details`、`/student/reward-punishment`、`/student/military-service`：個人學務查詢／申請
- `/entry/teaching-evaluation`、`/entry/questionnaire`：教學評量與課程問卷
- `/teacher/courses`、`/teacher/roster`：授課課程、通識標記與修課名單
- `/teacher/grades`、`/teacher/alerts`、`/teacher/attendance`、`/teacher/discipline`：教師登錄作業
- `/teacher/applications`、`/teacher/evaluations`、`/teacher/questionnaires`：申請審核、教學評量統計及問卷管理
- `/kpGjBpPZC2/login`：管理員登入頁
- `/kpGjBpPZC2`：需管理員 session 的後台入口
- `/kpGjBpPZC2/students`：學生管理
- `/kpGjBpPZC2/teachers`：教師管理
- `/kpGjBpPZC2/logout`：管理員登出，只接受 POST

## 其他指令

```bash
npm run typecheck
npm run build
npm start
```

SQLite 資料檔已排除版本控制。
http://localhost:7788/kpGjBpPZC2/login
