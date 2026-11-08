# HW7:作業系統考古題庫

一個線上刷題網站,收錄「作業系統」課程第四章(程序之間的溝通及同步問題)的考古題。可以依章節、題型或關鍵字瀏覽題目,選擇題與是非題能直接作答並立即看到對錯與詳解,問答題則附有參考答案。

**線上網址：<https://hw7.jellystudio.workers.dev/>**

## 功能

- **章節總覽**:首頁列出所有章節,顯示題數與已有答案的題數。
- **題目列表**:可用章節、題型(選擇題 / 問答題 / 是非題)與關鍵字篩選。
- **互動作答**:選擇題支援單選與多選(答案如 `ACD`),是非題為 `T` / `F`,送出後顯示對錯與詳解。
- **問答題參考答案**:提供精簡版解答,以 Markdown 渲染。
- 題目與詳解皆支援 Markdown(程式碼區塊、換行等)。

## 技術架構

| 項目 | 使用技術 |
| --- | --- |
| 前端框架 | React 19 + React Router 7(SSR) |
| 樣式 | Tailwind CSS 4 |
| 執行環境 | Cloudflare Workers |
| 資料庫 | Cloudflare D1(SQLite),binding 名稱 `hw7_db` |
| 建置工具 | Vite 7 + TypeScript |

## 專案結構

```
hw7/
├── app/
│   ├── routes/          # home(章節)、questions(列表)、question(單題)
│   ├── components/      # quiz(作答)、markdown、type-badge
│   ├── lib/             # questions.server.ts(D1 查詢)、parse-choices.ts(解析選項)
│   └── types/           # Question 型別與題型標籤
├── migrations/          # D1 migration(建表 + 題庫 + 答案)
├── workers/app.ts       # Worker 入口
└── wrangler.jsonc       # Cloudflare 設定
```

### 資料表 `questions`

| 欄位 | 說明 |
| --- | --- |
| `id` | 主鍵 |
| `chapter` | 章節名稱 |
| `number` | 題號 |
| `type` | `choice` / `essay` / `truefalse` |
| `content` | 題目(Markdown) |
| `answer` | 詳解或參考答案(Markdown) |
| `correct` | 標準答案:選擇題為大寫字母,是非題為 `T` / `F`,問答題為 `NULL` |

### Migrations

| 檔案 | 內容 |
| --- | --- |
| `0001_init.sql` | 建立 `questions` 表與索引 |
| `0002_seed_chapter4.sql` | 匯入第四章題目 |
| `0003_answer_keys.sql` | 新增 `correct` 欄位並填入選擇題 / 是非題答案與詳解 |
| `0004_essay_refs.sql` | 補上問答題參考答案 |
| `0005_seed_chapter4_part2.sql` | 匯入第四章後半部題目 |

> 部分題目各家解答有分歧,在 `0003` 中以 ⚠ 標記,使用前請再確認。

## 本機開發

```bash
cd hw7
npm install
npm run db:migrate:local   # 建立本機 D1 並套用 migration
npm run dev                # 啟動開發伺服器
```

## 部署

部署在 Cloudflare Workers,由 Workers Builds 連接此 GitHub repo:

- Root directory:`hw7`
- Build command:`npm install && npm run build`
- Deploy command:`npx wrangler deploy`
- Build watch paths:`hw7/*`(只有 `hw7/` 有變動才會重新 build)

**Migration 不會在部署時自動套用**,有新增 migration 時要手動執行:

```bash
cd hw7
npm run db:migrate:remote
```

## 常用指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 開發伺服器 |
| `npm run build` | 建置 |
| `npm run typecheck` | 型別檢查 |
| `npm run check` | 型別檢查 + 建置 + `wrangler deploy --dry-run` |
| `npm run deploy` | 手動部署 |
