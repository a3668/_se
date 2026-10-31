# hw5 測試說明

本專案的測試分為三種：

| 類型 | 測試範圍 | 數量 |
| --- | --- | --- |
| 單元測試 | Rust 組譯器與 CPU 模擬核心 | 42 項 |
| 系統測試 | Web API 回傳內容與資料儲存 | 477 項檢查 |
| E2E 測試 | 完整前後端操作流程 | 37 項 |

## 1. 單元測試（Rust Server）

需要 Rust stable 與 Cargo，於 `hw5` 目錄執行：

```bash
cargo test --test unit
```

### 涵蓋內容與檔案

| 檔案                                     | 內容                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [unit.rs](unit.rs)                       | Cargo 測試入口，載入以下兩個模組                                                                        |
| [unit/assembler.rs](unit/assembler.rs)   | 13 項：暫存器、機器碼、控制訊號、標籤、立即數與位移量邊界、非法語法與指令數上限                         |
| [unit/simulation.rs](unit/simulation.rs) | 29 項：運算、記憶體、五級管線、forwarding、stall、flush、branch、jump、迴圈、cycle 上限、錯誤紀錄與統計 |

### 執行結果

共 42 項，全部通過時顯示：

```text
test result: ok. 42 passed; 0 failed
```

失敗項目會標示 `FAILED`，詳細錯誤列於 `failures:`。

## 2. 系統測試（Web API）

需要 Rust stable、Cargo、Bash、curl 與 Python 3，於 `hw5` 目錄執行：

```bash
./tests/api/test.sh
```

### 涵蓋內容

- 健康檢查、空清單、未知 API 與不支援的方法。
- 程式新增、查詢、更新、刪除，以及未完成草稿的儲存。
- `completed`、`error`、`limit` 模擬的建立、完整快照、摘要與刪除。
- 輸入格式、名稱、程式大小、組譯錯誤、初始設定與 cycle 邊界；拒絕建立時不新增紀錄。
- 修改程式不影響舊快照；刪除程式保留快照並清除關聯。
- 重啟後端後仍可讀回原資料，以及兩種清單的排序與最近 100 筆限制。

測試檔案：[api/test.sh](api/test.sh)。

### 執行結果

共 477 項檢查，全部通過時顯示：

```text
結果：477/477 通過，0 失敗
```

失敗項目會標示 `FAIL`，並顯示錯誤資訊與可取得的後端日誌。

## 3. E2E 測試（無頭 Playwright）

### 安裝與執行

需要 Node.js 24、npm、Rust stable、Cargo、Bash、curl 與 Python 3。以下指令皆於 `hw5` 目錄執行。

首次使用時安裝相依套件與 Chromium：

```bash
npm --prefix frontend ci
npm --prefix tests/e2e ci
npm --prefix tests/e2e run install:browser
```

執行測試：

```bash
./tests/e2e/test.sh
```

腳本會自動建置前後端、啟動服務，以臨時資料庫執行無頭 Chromium 測試，結束後清理。請透過腳本執行，以免測試清除其他資料庫的內容。

### 涵蓋內容與檔案

| 檔案 | 項數 | 內容 |
| --- | --- | --- |
| [simulation.spec.ts](e2e/simulation.spec.ts) | 14 | 教學範例、cycle 導覽、播放控制、縮放、管線訊號、時序視窗與記憶體分頁 |
| [history.spec.ts](e2e/history.spec.ts) | 8 | 程式與草稿管理、快照保存、歷史回放與刪除 |
| [errors.spec.ts](e2e/errors.spec.ts) | 15 | 無效輸入、執行期錯誤、cycle 上限與連線恢復 |

### 執行結果與報告

共 37 項，全部通過時顯示：

```text
37 passed
```

測試結果見 [test_report.md](test_report.md)。
