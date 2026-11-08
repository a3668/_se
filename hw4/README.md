# HW4：Docker AI 聊天系統

用 Docker Compose 建置的微服務聊天系統。三個容器各自負責一件事：**Nginx** 是網頁入口和反向代理，**Node.js**（跑在 Ubuntu 開發容器裡）是聊天 API，**PostgreSQL** 保存對話紀錄。後端透過主機上的 Ollama 呼叫雲端模型 `gpt-oss:120b-cloud`，回答會即時串流到網頁上。另外還有一個 React 展示頁，用來介紹這套 Docker 系統。

## 技術組成

| 項目         | 內容                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Dockerfile   | [`Dockerfile`](Dockerfile)：以 Ubuntu 24.04 為基礎，安裝 Node.js、Python 3、Rust、gcc/g++ 等開發工具，並在建置時裝好後端依賴         |
| Compose      | [`docker-compose.yml`](docker-compose.yml)：定義 `dev-vm`、`nginx`、`postgres` 三個服務，以及 `chat-data` volume                     |
| Web server   | `nginx:stable-alpine`：提供聊天頁的靜態檔，並把 `/api/` 轉送到 `dev-vm:3000`（[`chat/nginx/default.conf`](chat/nginx/default.conf)） |
| 資料庫       | `postgres:17-alpine`：有 healthcheck，第一次啟動時執行 [`chat/db/init.sql`](chat/db/init.sql) 建表                                   |
| 開發執行環境 | Node.js、Rust、Python 都裝在 `dev-vm` 容器內；Node.js（Express）負責執行聊天後端                                                     |
| Web 介面     | 聊天網頁 [`chat/public/`](chat/public/)（http://localhost:8080），加上系統展示頁 [`demo_web/`](demo_web/)（http://localhost:8181）   |

## 系統架構

```text
瀏覽器 http://localhost:8080
        │
        ▼
┌───────────────── Docker Compose ─────────────────┐
│                                                  │
│  nginx (:80)                                     │
│   ├─ /       → 靜態檔 chat/public                │
│   └─ /api/   → 反向代理                          │
│                 │                                │
│                 ▼                                │
│  dev-vm (Ubuntu 24.04 · Express :3000)           │
│                 │                                │
│                 ▼                                │
│  postgres (:5432) ── chat-data volume            │
│                                                  │
└─────────────────┬────────────────────────────────┘
                  │ host.docker.internal:11434
                  ▼
        主機上的 Ollama ──► Ollama Cloud (gpt-oss:120b-cloud)
```

## 服務說明

| 服務       | 映像                                         | 對外 Port             | 角色                                        |
| ---------- | -------------------------------------------- | --------------------- | ------------------------------------------- |
| `nginx`    | `nginx:stable-alpine`                        | `127.0.0.1:8080 → 80` | 網頁伺服器與反向代理，系統唯一入口          |
| `dev-vm`   | 由 `Dockerfile` 建置（容器名稱 `my-dev-vm`） | 不對外，內部 `3000`   | Ubuntu 開發環境，執行 Express 聊天 API      |
| `postgres` | `postgres:17-alpine`                         | 不對外，內部 `5432`   | 保存對話和訊息，資料放在 `chat-data` volume |

- `dev-vm` 等 `postgres` 的 healthcheck 通過後才啟動（`depends_on: condition: service_healthy`）。
- 只有 Nginx 開放給主機，而且只綁在 `127.0.0.1`，資料庫和後端都不會直接暴露出去。

## 功能

- **新增對話**：每個主題各自保有完整的對話脈絡。
- **切換歷史**：從側邊欄點選已保存的對話，重新讀取先前的問答。
- **串流回答**：後端用 SSE（Server-Sent Events）把模型回答逐段傳到網頁。
- **自動保存**：使用者訊息先存進 PostgreSQL，AI 回答完整後再存。
- **改名與刪除對話**。
- **選擇模型**：從 Ollama 取得可用模型清單。
- 同一段對話在產生回答時，不能重複送出（回傳 409）。

## API

所有 API 都經過 Nginx 的 `/api/` 轉送到後端（[`chat/server.cjs`](chat/server.cjs)）。

| 方法     | 路徑                              | 說明                                                                      |
| -------- | --------------------------------- | ------------------------------------------------------------------------- |
| `GET`    | `/api/config`                     | 預設模型、訊息長度上限、可用模型清單                                      |
| `GET`    | `/api/conversations`              | 列出所有對話（最近更新的在前）                                            |
| `POST`   | `/api/conversations`              | 新增對話                                                                  |
| `PATCH`  | `/api/conversations/:id`          | 修改對話名稱（body：`{ "title": "..." }`）                                |
| `DELETE` | `/api/conversations/:id`          | 刪除對話及其訊息                                                          |
| `GET`    | `/api/conversations/:id/messages` | 取得對話內容與所有訊息                                                    |
| `POST`   | `/api/conversations/:id/messages` | 送出訊息（body：`{ "content": "...", "model": "..." }`），以 SSE 串流回答 |

## 資料庫

### `conversations`

| 欄位                        | 說明                     |
| --------------------------- | ------------------------ |
| `id`                        | 主鍵，自動遞增           |
| `title`                     | 對話名稱，預設「新對話」 |
| `created_at` / `updated_at` | 建立和更新時間           |

### `messages`

| 欄位              | 說明                                                |
| ----------------- | --------------------------------------------------- |
| `id`              | 主鍵，自動遞增                                      |
| `conversation_id` | 所屬對話，刪除對話時一併刪除（`ON DELETE CASCADE`） |
| `role`            | `user` 或 `assistant`                               |
| `content`         | 訊息內容                                            |
| `created_at`      | 建立時間                                            |

## 專案結構

```text
hw4/
├── Dockerfile              # Ubuntu 24.04 開發容器：Node.js、Python、Rust
├── docker-compose.yml      # dev-vm、nginx、postgres 三個服務
├── 01-build.sh             # docker compose build
├── 02-run.sh               # docker compose up -d
├── 03-attach.sh            # 進入 my-dev-vm 的 Bash
├── chat/                   # 聊天系統
│   ├── server.cjs          # Express 後端（API、PostgreSQL、Ollama 串流）
│   ├── public/             # 聊天網頁（index.html、app.js、styles.css）
│   ├── nginx/default.conf  # Nginx 靜態檔與反向代理設定
│   └── db/init.sql         # 建表 SQL
├── demo_web/               # React + TypeScript + Vite 系統展示頁
└── hw4.md                  # 學習使用 Docker 的紀錄
```

## 使用方式

### 1. 準備

- 安裝並啟動 Docker Desktop。
- 建立要掛載進容器的共用資料夾（只需做一次）：

  ```bash
  mkdir -p /Users/Shared/shain
  ```

- 在另一個終端機啟動 Ollama（雲端模型需要網路和登入狀態）：

  ```bash
  OLLAMA_HOST=0.0.0.0:11434 OLLAMA_CONTEXT_LENGTH=16384 ollama serve
  ```

### 2. 建置與啟動

在 `hw4` 目錄執行：

```bash
./01-build.sh   # 建置映像（第一次，或改了 Dockerfile、套件、Compose 設定時）
./02-run.sh     # 在背景啟動所有容器
```

打開 http://localhost:8080 就能開始聊天。

### 3. 其他指令

```bash
./03-attach.sh        # 進入 Ubuntu 開發容器（輸入 exit 離開，後端繼續運作）
docker compose ps     # 查看容器狀態
docker compose stop   # 停止容器，聊天紀錄保留在 volume 中
```

### 4. 展示頁

展示頁獨立運作，不需要先啟動 Docker 或 Ollama（需要 Node.js 20.19+）：

```bash
cd demo_web
npm install
npm run dev     # http://localhost:8181
```

### 環境變數

以下設定都有預設值，需要時可以寫在 `hw4/.env`：

| 變數                | 預設值                              |
| ------------------- | ----------------------------------- |
| `POSTGRES_DB`       | `shain_chat`                        |
| `POSTGRES_USER`     | `shain`                             |
| `POSTGRES_PASSWORD` | `shain_local_dev`                   |
| `OLLAMA_BASE_URL`   | `http://host.docker.internal:11434` |
| `OLLAMA_MODEL`      | `gpt-oss:120b-cloud`                |

## 相關文件

- [`hw4.md`](hw4.md)：學習使用 Docker 的紀錄
