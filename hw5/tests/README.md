# hw5 測試說明

本專案的測試分為三種：

| 類型 | 測試範圍 | 目前狀態 |
| --- | --- | --- |
| 單元測試 | Server（Rust）的組譯器與 CPU 模擬核心；Client 單元測試可省略 | 已建立，共 42 項 |
| 系統測試 | 透過 HTTP 呼叫 Web API，檢查回傳內容與資料儲存 | 已建立 |
| E2E 測試 | 使用 Playwright 無頭瀏覽器，測試完整前後端操作流程 | 尚未建立 |

## 1. 單元測試（Rust Server）

### 執行前準備

- 安裝 Rust stable 與 Cargo。
- 不需要啟動 Rust server 或前端，也不需要執行 `npm install`。
- 測試直接呼叫 Rust 核心函式，不會讀寫 `mips.db`。

### 執行步驟

開啟終端機，從 repository 根目錄切換到 `hw5` 後執行：

```bash
cd hw5
cargo test --test unit
```

如果終端機已經位於 `hw5`，只需輸入：

```bash
cargo test --test unit
```

首次執行時，Cargo 可能需要下載相依套件並編譯；之後會重用編譯結果。

### 判讀結果

每項測試會顯示 `ok` 或 `FAILED`。目前共有 42 項，全部通過時，摘要包含：

```text
test result: ok. 42 passed; 0 failed
```

若有失敗，查看 `failures:` 下方的測試名稱、檔案行號與錯誤訊息。測試指令會以非零退出碼結束。

### 涵蓋內容與檔案

| 檔案 | 內容 |
| --- | --- |
| [unit.rs](unit.rs) | Cargo 測試入口，載入以下兩個模組 |
| [unit/assembler.rs](unit/assembler.rs) | 13 項：暫存器、機器碼、控制訊號、標籤、立即數與位移量邊界、非法語法與指令數上限 |
| [unit/simulation.rs](unit/simulation.rs) | 29 項：運算、記憶體、五級管線、forwarding、stall、flush、branch、jump、迴圈、cycle 上限、錯誤紀錄與統計 |

此入口在 Cargo 中屬於 integration test target，測試內容以直接呼叫公開函式的方式檢查核心行為，不透過 HTTP。

## 2. 系統測試（Web API）

### 執行前準備

- 安裝 Rust stable、Cargo、Bash、curl 與 Python 3；不需額外 Python 套件。
- 不需要手動啟動後端或前端，也不需要執行 `npm install`。
- 預設測試連接埠為 `127.0.0.1:18080`，須未被其他程序占用。

### 執行步驟

從 repository 根目錄執行：

```bash
cd hw5
bash tests/api/test.sh
```

如果已經位於 `hw5`，只需執行 `bash tests/api/test.sh`。

若預設連接埠被占用，可以指定其他連接埠（1024–65535）：

```bash
TEST_SERVER_PORT=18081 bash tests/api/test.sh
```

腳本會自動編譯 Rust 後端、建立臨時資料庫、啟動後端、等待 `/health` 就緒、執行 HTTP 測試，最後關閉測試後端並清除臨時資料。中斷時也會清理。

測試使用獨立的 `DATABASE_PATH` 與 `SERVER_ADDR`，不會讀寫開發用 `mips.db`，不會關閉既有服務。連接埠已被占用時直接報錯，不會連接該服務繼續測試。

### 涵蓋內容

- 健康檢查、空清單、未知 API 與不支援的方法。
- 程式新增、查詢、更新、刪除，以及未完成草稿的儲存。
- `completed`、`error`、`limit` 模擬的建立、完整快照、摘要與刪除。
- 輸入格式、名稱、程式大小、組譯錯誤、初始設定與 cycle 邊界；拒絕建立時不新增紀錄。
- 修改程式不影響舊快照；刪除程式保留快照並清除關聯。
- 重啟後端後仍可讀回原資料，以及兩種清單的排序與最近 100 筆限制。

測試檔案為 [api/test.sh](api/test.sh)，透過 curl 發送真實 HTTP 請求，由 Python 解析 JSON 並比較欄位與值。

### 判讀結果

每項檢查會顯示 `OK` 或 `FAIL`；大量建立清單資料時只顯示失敗項目。結尾會統計通過數與失敗數。

目前全部通過的摘要為：

```text
結果：477/477 通過，0 失敗
```

此數量包含 HTTP 狀態、JSON 斷言及大量建立清單資料的檢查，不代表 477 個獨立操作流程。

全部通過時退出碼為 0；任何檢查失敗、缺少工具或後端啟動失敗時，退出碼皆為非零。失敗時會顯示錯誤資訊與可取得的後端日誌。

## 3. E2E 測試（無頭 Playwright）

尚未建立。預計使用 Playwright 無頭瀏覽器測試完整前後端流程；完成後再補上執行步驟。
