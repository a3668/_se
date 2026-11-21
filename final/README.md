# Final:考古題庫

資工課程考古題的線上刷題網站，部署在 Cloudflare Workers。題目資料存在 D1。目前收錄作業系統第四章（程序之間的溝通及同步問題），共 106 題。

**線上網址：<https://final.jellystudio.workers.dev/>**

這個專案參考 [hw7](../hw7) 重新設計，新增以下功能：

- 資料表改為「課程 → 章節 → 題目」三層，之後可以加入其他課程
- 用 FTS5 trigram 做全文搜尋，同時搜尋題目和詳解，並標示命中的關鍵字
- 題目列表分頁，另有隨機抽題功能
- 加上單元測試

## 功能

- **課程首頁**：列出各課程的章節數和題數。
- **章節總覽**：顯示每章的題數、可以線上作答的題數，以及有詳解的題數。每章都可以直接開始練習，或隨機抽一題。
- **題目列表**：可以依章節、題型（選擇、是非、問答）和關鍵字篩選，每頁 20 題。
- **全文搜尋**：
  - 同時搜尋題目和詳解。多個關鍵字用空白分隔，題目必須包含所有關鍵字才會列出。
  - 3 個字以上的關鍵字用 FTS5 trigram 搜尋，較短的關鍵字（例如「死結」）改用 LIKE。
  - 搜尋結果顯示命中處附近的摘要，並標示關鍵字。
- **互動作答**：
  - 選擇題支援單選、複選，以及數字選項（例如答案 `245`）。
  - 是非題直接作答。
  - 送出後顯示對錯、正解和詳解。
- **問答題**：可以展開參考答案。
- **隨機抽題**：可以限定章節，並且不會連續抽到同一題。

## 技術架構

| 項目 | 使用技術 |
| --- | --- |
| 前端框架 | React 19 + React Router 7（SSR） |
| 樣式 | Tailwind CSS 4 |
| 執行環境 | Cloudflare Workers |
| 資料庫 | Cloudflare D1（SQLite）+ FTS5 全文索引，binding 名稱 `DB` |
| 測試 | Vitest |
| 建置工具 | Vite 7 + TypeScript |

## 網址結構

| 路徑 | 頁面 |
| --- | --- |
| `/` | 課程列表 |
| `/:course` | 課程章節總覽，例如 `/os` |
| `/:course/questions` | 題目列表，查詢參數有 `chapter`、`type`、`q`、`page` |
| `/:course/questions/:id` | 單題作答 |
| `/:course/random` | 隨機抽一題後轉址，查詢參數有 `chapter`、`exclude` |

## 專案結構

```
final/
├── app/
│   ├── routes/        # home、course、questions、question、random
│   ├── components/    # quiz、markdown、highlight、pagination、type-badge
│   └── lib/           # queries.server.ts(D1 查詢)、search、excerpt、grading、parse-choices
├── migrations/        # D1 migration(資料表 + 初始題庫)
├── tests/             # Vitest 單元測試
├── workers/app.ts     # Worker 入口
└── wrangler.jsonc     # Cloudflare 設定
```

## 資料表

| 資料表 | 說明 |
| --- | --- |
| `courses` | 課程：`slug` 是網址代號（例如 `os`），另有 `name`、`description`、`sort_order` |
| `chapters` | 章節：屬於某門課程，另有 `title`、`sort_order` |
| `questions` | 題目：`chapter_id`、`number`、`type`、`content`、`answer`、`correct` |
| `questions_fts` | `questions` 的 FTS5 全文索引，由 trigger 自動同步 |

`questions.correct` 有 CHECK 限制：

- 問答題必須是 `NULL`
- 是非題只能是 `T` 或 `F`
- 選擇題只能由大寫字母或數字組成

同一個題號可能有多個小題，所以 `number` 不設唯一限制。

| Migration | 內容 |
| --- | --- |
| `0001_schema.sql` | 建立資料表、索引、FTS5 全文索引與 trigger |
| `0002_seed_os.sql` | 匯入作業系統第四章題庫（資料來自 hw7） |

## 本機開發

```bash
cd final
npm install
npm run db:migrate:local   # 建立本機 D1 並套用 migration
npm run dev                # http://localhost:5232
```

## 部署

部署在 Cloudflare Workers，由 Workers Builds 連接這個 GitHub repo：

- Root directory：`final`
- Build command：`npm install && npm run build`
- Deploy command：`npx wrangler deploy`
- Build watch paths：`final/*`

**部署時不會自動套用 migration。** 新增 migration 後要手動執行：

```bash
cd final
npm run db:migrate:remote
```

## 常用指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 開發伺服器 |
| `npm test` | 單元測試 |
| `npm run typecheck` | 型別檢查 |
| `npm run build` | 建置 |
| `npm run check` | 型別檢查、測試、建置，再執行 `wrangler deploy --dry-run` |
| `npm run deploy` | 手動部署 |
