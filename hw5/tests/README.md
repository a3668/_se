# hw5 測試說明

本專案的測試分為三種：

| 類型 | 測試範圍 | 目前狀態 |
| --- | --- | --- |
| 單元測試 | Server（Rust）的組譯器與 CPU 模擬核心；Client 單元測試可省略 | 已建立，共 42 項 |
| 系統測試 | 透過 HTTP 呼叫 Web API，檢查回傳內容與資料儲存 | 已建立 |
| E2E 測試 | 使用 Playwright 無頭 Chromium，測試完整前後端操作流程 | 已建立，共 37 項 |

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

### 執行前準備

- 安裝 Node.js 24、npm、Rust stable、Cargo、Bash、curl、Python 3。
- E2E 使用獨立的 npm 專案；套件、lockfile、設定、腳本與案例都在 [e2e/](e2e/)，不需要全域安裝 Playwright。
- 第一次使用時，從 `hw5` 安裝前端與 E2E 相依套件，再下載 Chromium：

```bash
npm --prefix frontend ci
npm --prefix tests/e2e ci
npm --prefix tests/e2e run install:browser
```

E2E 開發相依為 `@playwright/test`、`@types/node`、`typescript`，確切版本由 `e2e/package-lock.json` 固定。Chromium 存放在 `e2e/node_modules/.cache/ms-playwright/`。更新 Playwright 後需再次執行 `install:browser`。

採 `channel: 'chromium'` 與 `headless: true`，使用完整 Chromium 的新無頭模式；本機的 Chrome Headless Shell 曾發生動畫 frame 不前進、點擊等待逾時，因此不採預設 shell 模式。

### 執行步驟

從 repository 根目錄執行：

```bash
cd hw5
bash tests/e2e/test.sh
```

已經位於 `hw5` 時，只需最後一行。也可以在 `tests/e2e` 執行 `npm test`。

預設連接埠為 `127.0.0.1:18082`，占用時直接停止；可指定其他連接埠：

```bash
E2E_SERVER_PORT=18083 bash tests/e2e/test.sh
```

執行特定案例或檔案：

```bash
bash tests/e2e/test.sh --grep '教學範例'
bash tests/e2e/test.sh history.spec.ts
```

腳本會編譯 Rust 與前端、建立臨時 SQLite、啟動 Rust 提供編譯後的前端、等待自己的後端及 `/health` 就緒、檢查 E2E 型別，最後執行無頭 Chromium。單一 worker 依序執行，失敗不自動重試，個別案例上限 30 秒，整輪上限 10 分鐘。

不需要事先啟動服務或 Vite。腳本設定獨立的 `SERVER_ADDR`、`DATABASE_PATH`；每個案例使用新的瀏覽器 context，並透過 API 清除該臨時資料庫內的模擬與程式。正常結束、失敗或收到 INT／TERM 時，只關閉本次啟動的後端並刪除臨時資料庫，不使用開發用 `mips.db`，不重用或關閉既有服務。

請使用啟動腳本，不要自行設定 `HW5_E2E_BASE_URL`、`HW5_E2E_ISOLATED` 後直接呼叫 Playwright；案例會刪除所連接後端的測試資料。

### 涵蓋內容與檔案

| 檔案 | 項數 | 內容 |
| --- | --- | --- |
| [simulation.spec.ts](e2e/simulation.spec.ts) | 14 | 初始狀態、四個教學範例、cycle 導覽、播放速度／暫停／結尾、縮放、Control Unit、stall／forwarding／flush、18 欄時序視窗、動態 ID、初值與記憶體分頁、時鐘邊緣前後值 |
| [history.spec.ts](e2e/history.spec.ts) | 8 | 程式新增／更新／載入、未完成草稿、取代確認、快照不隨編輯改變、重新整理後回放、刪除取消／確認、刪程式保留快照、刪除目前紀錄及清單重新整理 |
| [errors.spec.ts](e2e/errors.spec.ts) | 15 | 11 種無效輸入與修正後再執行、執行期記憶體錯誤／溢位、cycle 上限及其回放、連線失敗後重新連線 |

[helpers.ts](e2e/helpers.ts) 提供資料清理、表單輸入、播放定位及共用斷言。[playwright.config.ts](e2e/playwright.config.ts) 定義無頭瀏覽器與報告設定，[test.sh](e2e/test.sh) 負責建置、服務與清理。

主要流程透過真實前端、Rust API 與 SQLite 執行；API 另外用於資料準備、清理和補充確認。連線恢復案例暫時攔截請求以製造連線錯誤，解除後重新連接真實 API。播放速度案例使用 Playwright Clock 推進瀏覽器計時器。未使用固定 sleep 作為畫面同步，也不以 API 回傳值作為唯一結果斷言。

### 判讀結果與產物

終端逐項顯示通過或失敗；全部通過時顯示 `37 passed`，退出碼為 0。失敗、中斷、缺少套件或服務啟動失敗時，退出碼為非零。只執行部分案例時，數量會依篩選改變。

產物位於 `e2e/artifacts/`，已排除 Git：

- `results.json`：最近一次進入 Playwright runner 的詳細結果。
- `html/index.html`：HTML 報告，執行後不自動開啟。
- `results/`：失敗案例的 screenshot、trace 與錯誤上下文（能取得時保留）。
- `server.log`：最近一次啟動的測試後端日誌。

每輪會更新對應產物，啟動腳本在編譯前清除舊 `results.json`，避免將先前結果誤認成本輪結果。實際執行摘要與已知限制記錄於 [test_report.md](test_report.md)。
