# hw5 測試結果報告

本報告記錄本次實際執行的結果。寫入前檢查 `hw5` 工作目錄，未發現未提交的變更。本報告為本次執行的結果快照，後續修改程式或測試後，須重新執行才能更新結果。

## 結果總覽

以下指令皆在 `hw5` 目錄執行。

| 測試類型 | 執行指令 | 實際結果 | 退出碼 |
| --- | --- | --- | --- |
| Rust Server 單元測試 | `cargo test --test unit` | 42 通過、0 失敗、0 忽略 | 0 |
| Web API 系統測試 | `bash tests/api/test.sh` | 477 項檢查通過、0 失敗 | 0 |
| 無頭 Playwright E2E | 尚未建立 | 未執行，不列為通過 | — |

## 1. Rust Server 單元測試

### 執行指令與原始摘要

```bash
cargo test --test unit
```

```text
test result: ok. 42 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### 涵蓋範圍

- [unit/assembler.rs](unit/assembler.rs)：13 項，涵蓋暫存器別名、支援指令的機器碼與控制訊號、標籤、分支 offset、跳躍位址、立即數與位移量邊界，以及非法語法與指令數上限。
- [unit/simulation.rs](unit/simulation.rs)：29 項，涵蓋運算、記憶體、五級管線、forwarding、load-use stall、store-data forwarding、同 cycle 的 WB／ID、branch、flush、jump、迴圈動態 ID、cycle 上限、錯誤時的部分紀錄與統計。
- 只有 `,()` 等分隔符號的輸入會被拒絕，對應的回歸測試通過。

測試由 [unit.rs](unit.rs) 載入，直接呼叫 Rust 核心公開函式；未啟動 HTTP server，也未讀寫 `mips.db`。Client 單元測試未建立、未執行。

## 2. Web API 系統測試

### 執行指令與原始摘要

```bash
bash tests/api/test.sh
```

```text
結果：477/477 通過，0 失敗
```

### 涵蓋範圍

- 健康檢查、初始空清單、未知 API 與不支援的 HTTP method。
- 程式新增、查詢、更新、刪除及未完成草稿的儲存。
- `completed`、`error`、`limit` 模擬的建立、完整快照讀取、摘要一致性與紀錄刪除。
- 名稱、程式文字大小、JSON 格式、Content-Type、未知欄位、組譯、初始設定與 cycle 限制；被拒絕的建立請求不新增紀錄。
- 更新程式後舊快照不變；刪除程式後保留快照，且 `program_id` 清為 null。
- 重啟後端後仍可讀回程式與三種狀態的完整快照。
- 不存在的 ID、重複刪除，以及兩種清單的排序與最近 100 筆限制。

477 項為 [api/test.sh](api/test.sh) 統計的檢查數，包含 HTTP 狀態、JSON 斷言與大量建立清單資料時的檢查，不代表 477 個獨立操作流程，也不與單元測試數量合併計算。

### 執行環境與清理

- 腳本編譯並啟動真實 Rust 後端，使用 curl 發送 HTTP 請求，以 Python 標準函式庫解析 JSON。
- 使用 `127.0.0.1:18080` 與臨時 SQLite 資料庫，透過獨立的 `SERVER_ADDR`、`DATABASE_PATH` 設定隔離。
- 本次腳本正常結束，退出碼為 0，並執行清理程序，關閉腳本啟動的後端及刪除臨時資料。
- 未使用開發用 `mips.db`，也未啟動前端或瀏覽器。

## 3. 無頭 Playwright E2E

尚未建立，未執行。此次通過的 Rust 單元測試與 Web API 系統測試，不包含瀏覽器畫面及完整前後端操作流程的測試結果。

詳細執行步驟請參考 [README.md](README.md)。
