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
npm run dev
```

`npm run db:migrate` 依檔名順序套用 `migrations/*.sql` 到 `data/hw2.sqlite`。新增 schema 變更時，建立下一個編號的純 SQL 檔案，例如 `migrations/0002_add_status.sql`，再手動執行相同指令。已套用的檔案會略過。

Migration 只建立資料表，不建立登入帳號；新資料庫需要另外建立帳號才能登入。

## 路由

- `/`：首頁與登入狀態
- `/login`：登入頁
- `/logout`：只接受 POST 的登出 action

## 其他指令

```bash
npm run typecheck
npm run build
npm start
```

SQLite 資料檔已排除版本控制。
