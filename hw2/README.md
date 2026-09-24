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

`npm run db:migrate` 依檔名順序套用 `migrations/*.sql` 到 `data/hw2.sqlite`。目前只有 `0001_initial.sql`，建立 `users` 與 `sessions`；`users.role` 只允許 `student` 或 `teacher`。後續 schema 變更再新增下一個編號的 migration。

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

`npm run dev` 與 `npm start` 會載入 `.dev.vars`。管理員未設定完整時，管理員登入頁回傳 503。學生、老師帳號建立功能留待下一階段，目前新資料庫沒有可登入的一般帳號。

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
