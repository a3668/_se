# {{name}}

只讀的考古題網站,使用 React Router 7 + Cloudflare Workers + D1。由 `csie-quiz init` 建立。

## 本機開發

```bash
npm install
npm run db:init   # 在本機 D1 建表、匯入範例題目
npm run dev
```

## 頁面

| 路徑 | 內容 |
| --- | --- |
| `/` | 章節列表 |
| `/questions` | 題目列表,可用 `chapter`、`type`(`choice` / `essay` / `truefalse`)、`q`(關鍵字)篩選 |
| `/questions/:id` | 單題與答案,含同章節的上一題、下一題 |

資料在各頁面的 `loader` 裡直接查 D1(binding 名稱 `DB`),查詢函式在 `app/lib/questions.server.ts`。

## 題目

題目用 `migrations/` 裡的 SQL 匯入:

| 檔案 | 內容 |
| --- | --- |
| `0001_init.sql` | 建立 `questions` 表 |
| `0002_seed.sql` | 範例題目 |

`questions` 欄位:`chapter`(章節)、`number`(題號)、`type`(`choice` / `essay` / `truefalse`)、`content`(題目 Markdown)、`correct`(標準答案,選擇題如 `ACD`,是非題 `T` / `F`)、`answer`(詳解 Markdown)。

要換成自己的題目:第一次 `db:init` 前可以直接改 `0002_seed.sql`;已經匯入過的話,新增 `0003_xxx.sql` 再執行 `npm run db:init`(已套用過的 migration 不會重跑)。

## 上線

```bash
npx wrangler login
npx wrangler d1 create {{name}}-db   # 建立遠端 D1,讓 wrangler 把 database_id 寫進 wrangler.jsonc
npm run db:migrate:remote           # 在遠端 D1 建表、匯入題目
npm run deploy
```
