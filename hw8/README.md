# csie-quiz

一行指令建立自己的考古題網站。產生的專案使用 React Router 7 + Cloudflare Workers + D1,是只讀的題庫:可以依章節、題型、關鍵字瀏覽題目並查看答案。

csie-quiz 是建專案用的工具,不是函式庫:建出來的專案不會 import 或依賴 csie-quiz。

## 安裝

```bash
npm install -g csie-quiz
```

## 建立專案

```bash
csie-quiz init my-quiz
cd my-quiz
```

也可以自己建資料夾,在裡面執行 `csie-quiz init`(不給資料夾名稱時寫進目前的資料夾):

```bash
mkdir my-quiz
cd my-quiz
csie-quiz init
```

- 資料夾不存在會自動建立。
- 資料夾裡已經有檔案時不會寫入任何檔案;確定要覆蓋請加 `--force`。
- 專案名稱(`package.json`、Worker 名稱)與 D1 資料庫名稱(`my-quiz-db`)會依資料夾名稱自動填入。

## 本機開發

```bash
npm install
npm run db:init   # 在本機建表、匯入範例題目
npm run dev
```

## 上線

```bash
npx wrangler login
npx wrangler d1 create my-quiz-db   # 建立遠端 D1,讓 wrangler 把 database_id 寫進 wrangler.jsonc
npm run db:migrate:remote          # 在遠端 D1 套用 migrations(建表 + 題目)
npm run deploy
```

## 產生的專案

| 路徑 | 內容 |
| --- | --- |
| `/` | 章節列表 |
| `/questions` | 題目列表,可用 `chapter`、`type`、`q` 篩選 |
| `/questions/:id` | 單題與答案,含上一題、下一題 |

- 資料在各頁面的 `loader` 裡直接查 D1(binding 名稱 `DB`)。
- 題目放在 `migrations/`:`0001_init.sql` 建表、`0002_seed.sql` 是範例題目,換成自己的題目後重新匯入即可。
- 只讀:沒有新增、修改、刪除功能,不需要 `.dev.vars` 或 token。
