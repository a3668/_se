# hw5 測試說明

本專案的測試分為三種：

| 類型 | 測試範圍 | 目前狀態 |
| --- | --- | --- |
| 單元測試 | Server（Rust）的組譯器與 CPU 模擬核心；Client 單元測試可省略 | 已建立，共 42 項 |
| 系統測試 | 透過 HTTP 呼叫 Web API，檢查回傳內容與資料儲存 | 尚未建立 |
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

尚未建立。預計透過 HTTP 測試 Rust server 的 Web API；完成後再補上執行步驟。

## 3. E2E 測試（無頭 Playwright）

尚未建立。預計使用 Playwright 無頭瀏覽器測試完整前後端流程；完成後再補上執行步驟。
