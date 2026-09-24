# HW2 本機登入網站

使用 React Router 7 Framework Mode、React 19 與 Node.js 24 內建 SQLite 製作的本機登入範例。

## 環境需求

- Node.js 24 或更新版本
- npm

## 首次設定

1. 安裝套件：

   ```bash
   npm install
   ```

2. 複製環境變數範例：

   ```bash
   cp .env.example .env
   ```

3. 編輯 `.env`，設定首次建立帳號使用的帳號與密碼。

4. 啟動本機開發伺服器：

   ```bash
   npm run dev
   ```

第一次存取網站時會自動建立 `data/hw2.sqlite`、`users`、`sessions`，並在資料庫沒有使用者時建立 `.env` 指定的帳號。既有帳號不會因為之後修改 `.env` 而被覆寫。

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

`.env` 與 SQLite 資料檔均已排除版本控制。
