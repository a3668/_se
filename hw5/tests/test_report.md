# hw5 測試結果報告

本報告保留先前單元測試與系統測試的結果，並新增 2026-10-25 的 E2E 執行紀錄。本次開始實作前，`hw5` 沒有未提交的變更；本次新增 E2E 與測試文件，未修改應用程式、單元測試或系統測試。各批次結果分別記錄，後續修改相關程式或測試後，須重新執行才能更新結果。

## 結果總覽

以下指令皆在 `hw5` 目錄執行。

| 測試類型 | 執行指令 | 實際結果 | 退出碼 |
| --- | --- | --- | --- |
| Rust Server 單元測試 | `cargo test --test unit` | 先前紀錄：42 通過、0 失敗、0 忽略；本次未重跑 | 0（先前） |
| Web API 系統測試 | `bash tests/api/test.sh` | 先前紀錄：477 項檢查通過、0 失敗；本次未重跑 | 0（先前） |
| 無頭 Playwright E2E | `bash tests/e2e/test.sh` | 本次：37 通過、0 失敗、0 略過、0 flaky | 0 |

## 1. Rust Server 單元測試（先前結果）

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

### 使用者本機執行的完整輸出

以下為使用者提供的 `cargo test --test unit` 執行結果。

```text
cargo test --test unit
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.15s
     Running tests/unit.rs (target/debug/deps/unit-4d235e6177663246)

running 42 tests
test assembler::labels_comments_text_and_source_line_numbers ... ok
test assembler::branch_and_jump_encodings_and_control_signals ... ok
test assembler::nop_has_no_side_effect_control_signals ... ok
test assembler::numeric_branch_offsets_are_words_and_jump_addresses_are_bytes ... ok
test assembler::memory_encodings_and_operand_usage ... ok
test assembler::punctuation_only_program_is_rejected ... ok
test assembler::immediate_encodings_and_control_signals ... ok
test assembler::r_type_encodings_and_control_signals ... ok
test assembler::invalid_sources_are_rejected_with_relevant_errors ... ok
test assembler::immediate_boundaries_and_hex_sign_extension ... ok
test assembler::shifts_encode_shamt_and_only_read_rt ... ok
test assembler::static_instruction_limit_allows_twenty_but_rejects_twenty_one ... ok
test assembler::register_names_numbers_and_aliases ... ok
test simulation::alu_to_store_forwards_data_in_ex_and_mem ... ok
test simulation::branches_receive_forwarded_comparison_operands ... ok
test simulation::five_stages_and_clock_edge_writeback ... ok
test simulation::ex_fault_preserves_older_wb_and_mem_side_effects_in_the_same_cycle ... ok
test simulation::cycle_limit_keeps_partial_state_and_zero_retired_cpi_is_zero ... ok
test simulation::independent_instructions_and_explicit_nop_retire_in_order ... ok
test simulation::invalid_initial_settings_are_rejected_before_simulation ... ok
test simulation::invalid_jump_targets_stop_in_ex ... ok
test simulation::ex_mem_forwarding_takes_priority_over_older_mem_wb ... ok
test simulation::jump_has_no_delay_slot_and_can_target_program_end ... ok
test simulation::jump_and_link_returns_to_pc_plus_four ... ok
test simulation::latest_load_value_replaces_older_alu_write ... ok
test simulation::load_to_store_base_stalls_even_when_store_data_is_independent ... ok
test simulation::load_to_store_data_uses_mem_forwarding_without_a_stall ... ok
test simulation::load_use_freezes_pc_and_if_id_inserts_bubble_and_preserves_ids ... ok
test simulation::load_to_branch_stalls_before_comparing_the_loaded_value ... ok
test simulation::load_store_boundaries_offsets_and_memory_change ... ok
test simulation::maximum_source_size_and_cycle_limit_are_accepted ... ok
test simulation::mem_wb_forwards_both_ex_operands ... ok
test simulation::jr_uses_alu_forwarding_and_load_use_stalls ... ok
test simulation::loop_instances_have_distinct_ids_and_statistics_match_hand_count ... ok
test simulation::runtime_memory_faults_keep_a_partial_trace ... ok
test simulation::taken_branches_flush_two_instructions_without_a_delay_slot ... ok
test simulation::redirect_discards_younger_load_and_dependent_instruction ... ok
test simulation::untaken_branches_do_not_flush_or_skip_instructions ... ok
test simulation::zero_is_immutable_and_is_not_a_forwarding_or_stall_source ... ok
test simulation::signed_overflow_stops_without_committing_the_result ... ok
test simulation::wb_is_visible_to_id_in_the_same_cycle ... ok
test simulation::arithmetic_logic_comparisons_and_shifts ... ok

test result: ok. 42 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

## 2. Web API 系統測試（先前結果）

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
- 先前該次腳本正常結束，退出碼為 0，並執行清理程序，關閉腳本啟動的後端及刪除臨時資料。
- 該次系統測試未使用開發用 `mips.db`，也未啟動前端或瀏覽器。

### 使用者本機執行的完整輸出

以下為使用者提供的 `bash tests/api/test.sh` 執行結果。

```text
bash tests/api/test.sh
[1] 編譯 Rust 後端
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.03s
[2] 啟動獨立後端與臨時資料庫
  OK  健康檢查（HTTP 200）
  OK  健康檢查內容為 OK
  OK  programs 初始清單（HTTP 200）
  OK  programs 初始為空陣列
  OK  simulations 初始清單（HTTP 200）
  OK  simulations 初始為空陣列
  OK  未知 API（HTTP 404）
  OK  未知 API 的應用錯誤格式
  OK  不支援的方法（HTTP 405）
[3] 程式 CRUD 與模擬快照
  OK  建立程式（HTTP 201）
  OK  程式名稱去除首尾空白，保存輸入與時間戳
  OK  讀取程式（HTTP 200）
  OK  讀回程式與建立結果一致
  OK  程式清單（HTTP 200）
  OK  程式清單包含建立紀錄
  OK  建立關聯模擬（HTTP 201）
  OK  模擬關聯、標題、時間戳與原輸入
  OK  completed 模擬結果與逐 cycle trace
  OK  讀取完整快照（HTTP 200）
  OK  完整快照與建立結果一致
  OK  保存 error 模擬（HTTP 201）
  OK  執行錯誤仍保存部分 trace
  OK  讀回 error 快照（HTTP 200）
  OK  error 快照保存完整
  OK  保存 limit 模擬（HTTP 201）
  OK  cycle 上限仍保存部分 trace
  OK  讀回 limit 快照（HTTP 200）
  OK  limit 快照保存完整
  OK  模擬摘要清單（HTTP 200）
  OK  摘要符合 completed/error/limit 的詳細紀錄，且未包含 trace
  OK  更新程式（HTTP 200）
  OK  更新保留 ID，套用新內容與預設初值
  OK  更新後讀回程式（HTTP 200）
  OK  新內容已保存
  OK  更新程式後讀取舊快照（HTTP 200）
  OK  舊快照不隨程式更新而變動
  OK  保存尚未能組譯的草稿（HTTP 201）
  OK  草稿不要求先通過組譯
  OK  刪除草稿（HTTP 204）
  OK  204 沒有 response body
[4] 拒絕錯誤請求，且不新增紀錄
  OK  programs/empty-title：事前清單（HTTP 200）
  OK  programs/empty-title（HTTP 400）
  OK  programs/empty-title：應用錯誤 JSON
  OK  programs/empty-title：事後清單（HTTP 200）
  OK  programs/empty-title：沒有新增紀錄
  OK  programs/blank-title：事前清單（HTTP 200）
  OK  programs/blank-title（HTTP 400）
  OK  programs/blank-title：應用錯誤 JSON
  OK  programs/blank-title：事後清單（HTTP 200）
  OK  programs/blank-title：沒有新增紀錄
  OK  programs/long-title：事前清單（HTTP 200）
  OK  programs/long-title（HTTP 400）
  OK  programs/long-title：應用錯誤 JSON
  OK  programs/long-title：事後清單（HTTP 200）
  OK  programs/long-title：沒有新增紀錄
  OK  programs/long-source：事前清單（HTTP 200）
  OK  programs/long-source（HTTP 400）
  OK  programs/long-source：應用錯誤 JSON
  OK  programs/long-source：事後清單（HTTP 200）
  OK  programs/long-source：沒有新增紀錄
  OK  programs/unknown-field：事前清單（HTTP 200）
  OK  programs/unknown-field（HTTP 422）
  OK  programs/unknown-field：事後清單（HTTP 200）
  OK  programs/unknown-field：沒有新增紀錄
  OK  programs/unknown-input-field：事前清單（HTTP 200）
  OK  programs/unknown-input-field（HTTP 422）
  OK  programs/unknown-input-field：事後清單（HTTP 200）
  OK  programs/unknown-input-field：沒有新增紀錄
  OK  programs/wrong-source-type：事前清單（HTTP 200）
  OK  programs/wrong-source-type（HTTP 422）
  OK  programs/wrong-source-type：事後清單（HTTP 200）
  OK  programs/wrong-source-type：沒有新增紀錄
  OK  programs/negative-register-value：事前清單（HTTP 200）
  OK  programs/negative-register-value（HTTP 422）
  OK  programs/negative-register-value：事後清單（HTTP 200）
  OK  programs/negative-register-value：沒有新增紀錄
  OK  programs/negative-memory-value：事前清單（HTTP 200）
  OK  programs/negative-memory-value（HTTP 422）
  OK  programs/negative-memory-value：事後清單（HTTP 200）
  OK  programs/negative-memory-value：沒有新增紀錄
  OK  programs/negative-cycle-type：事前清單（HTTP 200）
  OK  programs/negative-cycle-type（HTTP 422）
  OK  programs/negative-cycle-type：事後清單（HTTP 200）
  OK  programs/negative-cycle-type：沒有新增紀錄
  OK  programs/null-title：事前清單（HTTP 200）
  OK  programs/null-title（HTTP 422）
  OK  programs/null-title：事後清單（HTTP 200）
  OK  programs/null-title：沒有新增紀錄
  OK  programs/missing-title：事前清單（HTTP 200）
  OK  programs/missing-title（HTTP 422）
  OK  programs/missing-title：事後清單（HTTP 200）
  OK  programs/missing-title：沒有新增紀錄
  OK  programs/missing-input：事前清單（HTTP 200）
  OK  programs/missing-input（HTTP 422）
  OK  programs/missing-input：事後清單（HTTP 200）
  OK  programs/missing-input：沒有新增紀錄
  OK  programs/malformed：事前清單（HTTP 200）
  OK  programs/malformed（HTTP 400）
  OK  programs/malformed：事後清單（HTTP 200）
  OK  programs/malformed：沒有新增紀錄
  OK  programs/oversize：事前清單（HTTP 200）
  OK  programs/oversize（HTTP 413）
  OK  programs/oversize：事後清單（HTTP 200）
  OK  programs/oversize：沒有新增紀錄
  OK  programs/錯誤 Content-Type：事前清單（HTTP 200）
  OK  programs/錯誤 Content-Type（HTTP 415）
  OK  programs/錯誤 Content-Type：事後清單（HTTP 200）
  OK  programs/錯誤 Content-Type：沒有新增紀錄
  OK  simulations/empty-title：事前清單（HTTP 200）
  OK  simulations/empty-title（HTTP 400）
  OK  simulations/empty-title：應用錯誤 JSON
  OK  simulations/empty-title：事後清單（HTTP 200）
  OK  simulations/empty-title：沒有新增紀錄
  OK  simulations/blank-title：事前清單（HTTP 200）
  OK  simulations/blank-title（HTTP 400）
  OK  simulations/blank-title：應用錯誤 JSON
  OK  simulations/blank-title：事後清單（HTTP 200）
  OK  simulations/blank-title：沒有新增紀錄
  OK  simulations/long-title：事前清單（HTTP 200）
  OK  simulations/long-title（HTTP 400）
  OK  simulations/long-title：應用錯誤 JSON
  OK  simulations/long-title：事後清單（HTTP 200）
  OK  simulations/long-title：沒有新增紀錄
  OK  simulations/long-source：事前清單（HTTP 200）
  OK  simulations/long-source（HTTP 400）
  OK  simulations/long-source：應用錯誤 JSON
  OK  simulations/long-source：事後清單（HTTP 200）
  OK  simulations/long-source：沒有新增紀錄
  OK  simulations/unknown-field：事前清單（HTTP 200）
  OK  simulations/unknown-field（HTTP 422）
  OK  simulations/unknown-field：事後清單（HTTP 200）
  OK  simulations/unknown-field：沒有新增紀錄
  OK  simulations/unknown-input-field：事前清單（HTTP 200）
  OK  simulations/unknown-input-field（HTTP 422）
  OK  simulations/unknown-input-field：事後清單（HTTP 200）
  OK  simulations/unknown-input-field：沒有新增紀錄
  OK  simulations/wrong-source-type：事前清單（HTTP 200）
  OK  simulations/wrong-source-type（HTTP 422）
  OK  simulations/wrong-source-type：事後清單（HTTP 200）
  OK  simulations/wrong-source-type：沒有新增紀錄
  OK  simulations/negative-register-value：事前清單（HTTP 200）
  OK  simulations/negative-register-value（HTTP 422）
  OK  simulations/negative-register-value：事後清單（HTTP 200）
  OK  simulations/negative-register-value：沒有新增紀錄
  OK  simulations/negative-memory-value：事前清單（HTTP 200）
  OK  simulations/negative-memory-value（HTTP 422）
  OK  simulations/negative-memory-value：事後清單（HTTP 200）
  OK  simulations/negative-memory-value：沒有新增紀錄
  OK  simulations/negative-cycle-type：事前清單（HTTP 200）
  OK  simulations/negative-cycle-type（HTTP 422）
  OK  simulations/negative-cycle-type：事後清單（HTTP 200）
  OK  simulations/negative-cycle-type：沒有新增紀錄
  OK  simulations/null-title：事前清單（HTTP 200）
  OK  simulations/null-title（HTTP 422）
  OK  simulations/null-title：事後清單（HTTP 200）
  OK  simulations/null-title：沒有新增紀錄
  OK  simulations/missing-title：事前清單（HTTP 200）
  OK  simulations/missing-title（HTTP 422）
  OK  simulations/missing-title：事後清單（HTTP 200）
  OK  simulations/missing-title：沒有新增紀錄
  OK  simulations/missing-input：事前清單（HTTP 200）
  OK  simulations/missing-input（HTTP 422）
  OK  simulations/missing-input：事後清單（HTTP 200）
  OK  simulations/missing-input：沒有新增紀錄
  OK  simulations/malformed：事前清單（HTTP 200）
  OK  simulations/malformed（HTTP 400）
  OK  simulations/malformed：事後清單（HTTP 200）
  OK  simulations/malformed：沒有新增紀錄
  OK  simulations/oversize：事前清單（HTTP 200）
  OK  simulations/oversize（HTTP 413）
  OK  simulations/oversize：事後清單（HTTP 200）
  OK  simulations/oversize：沒有新增紀錄
  OK  simulations/錯誤 Content-Type：事前清單（HTTP 200）
  OK  simulations/錯誤 Content-Type（HTTP 415）
  OK  simulations/錯誤 Content-Type：事後清單（HTTP 200）
  OK  simulations/錯誤 Content-Type：沒有新增紀錄
  OK  simulations/illegal-source：事前清單（HTTP 200）
  OK  simulations/illegal-source（HTTP 400）
  OK  simulations/illegal-source：應用錯誤 JSON
  OK  simulations/illegal-source：事後清單（HTTP 200）
  OK  simulations/illegal-source：沒有新增紀錄
  OK  simulations/empty-source：事前清單（HTTP 200）
  OK  simulations/empty-source（HTTP 400）
  OK  simulations/empty-source：應用錯誤 JSON
  OK  simulations/empty-source：事後清單（HTTP 200）
  OK  simulations/empty-source：沒有新增紀錄
  OK  simulations/punctuation-source：事前清單（HTTP 200）
  OK  simulations/punctuation-source（HTTP 400）
  OK  simulations/punctuation-source：應用錯誤 JSON
  OK  simulations/punctuation-source：事後清單（HTTP 200）
  OK  simulations/punctuation-source：沒有新增紀錄
  OK  simulations/too-many-instructions：事前清單（HTTP 200）
  OK  simulations/too-many-instructions（HTTP 400）
  OK  simulations/too-many-instructions：應用錯誤 JSON
  OK  simulations/too-many-instructions：事後清單（HTTP 200）
  OK  simulations/too-many-instructions：沒有新增紀錄
  OK  simulations/invalid-register：事前清單（HTTP 200）
  OK  simulations/invalid-register（HTTP 400）
  OK  simulations/invalid-register：應用錯誤 JSON
  OK  simulations/invalid-register：事後清單（HTTP 200）
  OK  simulations/invalid-register：沒有新增紀錄
  OK  simulations/nonzero-zero：事前清單（HTTP 200）
  OK  simulations/nonzero-zero（HTTP 400）
  OK  simulations/nonzero-zero：應用錯誤 JSON
  OK  simulations/nonzero-zero：事後清單（HTTP 200）
  OK  simulations/nonzero-zero：沒有新增紀錄
  OK  simulations/unaligned-memory：事前清單（HTTP 200）
  OK  simulations/unaligned-memory（HTTP 400）
  OK  simulations/unaligned-memory：應用錯誤 JSON
  OK  simulations/unaligned-memory：事後清單（HTTP 200）
  OK  simulations/unaligned-memory：沒有新增紀錄
  OK  simulations/out-of-range-memory：事前清單（HTTP 200）
  OK  simulations/out-of-range-memory（HTTP 400）
  OK  simulations/out-of-range-memory：應用錯誤 JSON
  OK  simulations/out-of-range-memory：事後清單（HTTP 200）
  OK  simulations/out-of-range-memory：沒有新增紀錄
  OK  simulations/zero-cycles：事前清單（HTTP 200）
  OK  simulations/zero-cycles（HTTP 400）
  OK  simulations/zero-cycles：應用錯誤 JSON
  OK  simulations/zero-cycles：事後清單（HTTP 200）
  OK  simulations/zero-cycles：沒有新增紀錄
  OK  simulations/too-many-cycles：事前清單（HTTP 200）
  OK  simulations/too-many-cycles（HTTP 400）
  OK  simulations/too-many-cycles：應用錯誤 JSON
  OK  simulations/too-many-cycles：事後清單（HTTP 200）
  OK  simulations/too-many-cycles：沒有新增紀錄
  OK  不存在的關聯程式：事前清單（HTTP 200）
  OK  不存在的關聯程式（HTTP 404）
  OK  不存在的關聯程式：應用錯誤 JSON
  OK  不存在的關聯程式：事後清單（HTTP 200）
  OK  不存在的關聯程式：沒有新增紀錄
  OK  拒絕非法程式更新（HTTP 400）
  OK  更新錯誤格式
  OK  非法更新後讀回程式（HTTP 200）
  OK  非法更新未覆蓋原紀錄
  OK  接受 100 字名稱與 256 KiB 程式草稿（HTTP 201）
  OK  保存允許的名稱與程式大小上界
  OK  接受 256 KiB 程式與 10000 cycle 上限的模擬（HTTP 201）
  OK  大小上界內可正常完成 nop
  OK  刪除大小邊界程式（HTTP 204）
  OK  刪除大小邊界快照（HTTP 204）
  OK  GET 不存在的 programs ID（HTTP 404）
  OK  不存在的紀錄回傳應用錯誤
  OK  PUT 不存在的 programs ID（HTTP 404）
  OK  不存在的紀錄回傳應用錯誤
  OK  DELETE 不存在的 programs ID（HTTP 404）
  OK  不存在的紀錄回傳應用錯誤
  OK  GET 不存在的 simulations ID（HTTP 404）
  OK  不存在的紀錄回傳應用錯誤
  OK  DELETE 不存在的 simulations ID（HTTP 404）
  OK  不存在的紀錄回傳應用錯誤
  OK  重複刪除草稿（HTTP 404）
[5] 重啟保存、刪除程式保留快照
  OK  重啟後程式仍存在（HTTP 200）
  OK  重啟保留程式資料
  OK  重啟後 completed 快照仍存在（HTTP 200）
  OK  重啟保留 completed 完整快照
  OK  重啟後 error 快照仍存在（HTTP 200）
  OK  重啟保留 error 完整快照
  OK  重啟後 limit 快照仍存在（HTTP 200）
  OK  重啟保留 limit 完整快照
  OK  刪除關聯程式（HTTP 204）
  OK  已刪除程式不存在（HTTP 404）
  OK  關聯程式刪除後快照仍存在（HTTP 200）
  OK  只清除 program_id，快照內容不變
  OK  刪除模擬紀錄（HTTP 204）
  OK  已刪除快照不存在（HTTP 404）
  OK  重複刪除模擬紀錄（HTTP 404）
  OK  刪除後的摘要清單（HTTP 200）
  OK  摘要清單也移除刪除的快照
[6] 兩種清單排序與最近 100 筆限制（各建立 101 筆）
  OK  更新最早建立的清單程式（HTTP 200）
  OK  更新時間晚於其他清單程式
  OK  programs 最近 100 筆清單（HTTP 200）
  OK  程式清單按 updated_at、id 遞減，且截取 100 筆
  OK  simulations 最近 100 筆清單（HTTP 200）
  OK  模擬清單依 id 遞減，且截取 100 筆正確摘要
結果：477/477 通過，0 失敗
```

## 3. 無頭 Playwright E2E

### 本次執行與原始摘要

- 日期與開始時間：2026-10-25 23:33:02，Asia/Taipei（使用者本機執行）。
- 工作目錄：`hw5`。
- Chromium 無頭模式，`channel: 'chromium'`；1 worker，重試次數 0。

```bash
bash tests/e2e/test.sh
```

```text
Running 37 tests using 1 worker
37 passed (23.3s)
E2E 結束，退出碼 0；測試服務與臨時資料已清理。
```

23.3 秒為 Playwright runner 的時間，不含前置編譯。結果依使用者提供的終端輸出與本機最新 JSON 更新；JSON 統計為 expected 37、unexpected 0、skipped 0、flaky 0。各案例另檢查瀏覽器 `pageerror`，本輪沒有未處理的頁面 JavaScript 錯誤。

### 逐項執行結果

以下依本次 `e2e/artifacts/results.json` 記錄，列出完整測試名稱與實際耗時。

| # | 測試項目 | 結果 | 耗時 |
| --- | --- | --- | --- |
| 1 | 拒絕輸入：未知暫存器 | 通過 | 714 ms |
| 2 | 拒絕輸入：zero 非零 | 通過 | 546 ms |
| 3 | 拒絕輸入：重複暫存器別名 | 通過 | 546 ms |
| 4 | 拒絕輸入：32-bit 數值超界 | 通過 | 549 ms |
| 5 | 拒絕輸入：記憶體未對齊 | 通過 | 528 ms |
| 6 | 拒絕輸入：記憶體超界 | 通過 | 525 ms |
| 7 | 拒絕輸入：設定格式錯誤 | 通過 | 534 ms |
| 8 | 拒絕輸入：不支援偽指令 | 通過 | 564 ms |
| 9 | 拒絕輸入：超過 20 條指令 | 通過 | 590 ms |
| 10 | 拒絕輸入：空程式名稱 | 通過 | 534 ms |
| 11 | 拒絕輸入：cycle 上限不合法 | 通過 | 540 ms |
| 12 | 執行期記憶體錯誤保存部分紀錄且可回放 | 通過 | 607 ms |
| 13 | 執行期 signed overflow保存部分紀錄且可回放 | 通過 | 591 ms |
| 14 | cycle 上限保存部分紀錄且可回放 | 通過 | 537 ms |
| 15 | 暫時無法連線後可重新連上真實 API | 通過 | 575 ms |
| 16 | 程式新增、更新與重新整理後載入 | 通過 | 728 ms |
| 17 | 未完成語法可存為草稿，執行時顯示組譯錯誤 | 通過 | 472 ms |
| 18 | 新程式的取代確認可取消或接受 | 通過 | 489 ms |
| 19 | 載入範例與已存程式的取代確認 | 通過 | 644 ms |
| 20 | 編輯保留舊快照，重新執行建立新的結果 | 通過 | 846 ms |
| 21 | 重新整理後回放，以及放棄編輯的取消與確認 | 通過 | 785 ms |
| 22 | 刪除程式保留快照，取消刪除及刪除目前紀錄 | 通過 | 901 ms |
| 23 | 歷史重新整理取得其他連線儲存的資料 | 通過 | 414 ms |
| 24 | 初始工作台、空歷史與未執行控制 | 通過 | 383 ms |
| 25 | 教學範例：Forwarding & load-use | 通過 | 432 ms |
| 26 | 教學範例：Branch & flush | 通過 | 412 ms |
| 27 | 教學範例：Loop & dependencies | 通過 | 423 ms |
| 28 | 教學範例：Jump & link | 通過 | 429 ms |
| 29 | 逐 cycle、時間軸、起點與結尾邊界 | 通過 | 612 ms |
| 30 | 播放速度、暫停與自動停止 | 通過 | 622 ms |
| 31 | Datapath 縮放上下界與重設 | 通過 | 984 ms |
| 32 | Control Unit 解碼、階段選擇與管線暫存器邊緣 | 通過 | 705 ms |
| 33 | load-use 的 stall、forwarding 訊號與時序定位 | 通過 | 717 ms |
| 34 | branch 的 flush 訊號與取消指令標記 | 通過 | 520 ms |
| 35 | 長迴圈的 18 欄視窗與不同動態 ID | 通過 | 485 ms |
| 36 | 暫存器初值、負數與記憶體末頁 | 通過 | 1056 ms |
| 37 | 機器狀態的寫回與記憶體邊緣前後值 | 通過 | 657 ms |

### 環境版本

| 工具 | 版本 |
| --- | --- |
| 作業系統 | macOS 26.0.1，arm64 |
| Node.js / npm | 24.14.0 / 11.9.0 |
| Rust / Cargo | 1.99.0 / 1.99.0 |
| Playwright | 1.64.1 |
| Chromium | 156.0.8078.4，revision 1248 |
| E2E TypeScript / Node 型別 | 7.0.2 / 26.6.5 |

本輪腳本中的 `cargo build`、前端 `npm run build`（包含前端型別檢查），以及 E2E `npm run typecheck` 均成功。

### 實際涵蓋結果

| 案例群組 | 結果 | 涵蓋內容 |
| --- | --- | --- |
| [simulation.spec.ts](e2e/simulation.spec.ts) | 14 / 14 通過 | 初始工作台、四個教學範例的具體暫存器／記憶體結果、逐 cycle 與時間軸、播放速度／暫停／結尾、縮放上下界、Control Unit 解碼與邊緣、stall／forwarding／flush、18 欄視窗與動態 ID、自訂初值、記憶體末頁、機器狀態邊緣前後值 |
| [history.spec.ts](e2e/history.spec.ts) | 8 / 8 通過 | 程式新增／更新／重新整理後載入、未完成草稿、取代確認取消／接受、編輯保留舊快照、重新執行建立新結果、重新整理後回放、刪程式保留快照、刪除目前紀錄與清空播放、歷史重新整理 |
| [errors.spec.ts](e2e/errors.spec.ts) | 15 / 15 通過 | 11 種無效輸入不新增紀錄、修正輸入後可再執行、執行期記憶體錯誤／溢位及回放、cycle 上限及回放、連線失敗後重新連上真實 API |

四個範例分別確認 forwarding 範例的記憶體結果 17 與 stall 1、branch 的錯誤路徑無副作用與 flush 2、迴圈累加結果 15，以及 jump/link 的結果 12 與 `$ra = 8`。這些結果由瀏覽器讀取畫面斷言。

### 執行隔離與清理

- Rust 同時提供編譯後的前端與真實 API，未啟動 Vite。
- 使用 `127.0.0.1:18082` 和 `mktemp` 建立的臨時 SQLite，未使用開發用 `mips.db`。
- 每個案例建立新的瀏覽器 context，透過真實 API 清理臨時資料庫內的測試資料；核心流程透過介面輸入、執行、儲存與回放。
- 播放速度案例使用 Playwright Clock；離線案例暫時攔截 API 請求，解除後連接真實後端。未以假成功回應取代模擬或資料儲存。
- 最終腳本正常結束，退出碼為 0，完成關閉本次後端與刪除臨時資料庫的清理程序。
- 產物保留於 `e2e/artifacts/results.json`、`e2e/artifacts/html/index.html` 與 `e2e/artifacts/server.log`，均不納入 Git；失敗時另外保留可取得的 trace、screenshot 與錯誤上下文。

本次未發現需要修正的明確產品缺陷，未修改 Rust 或 React 應用程式。結果範圍為目前 macOS 上的 Chromium 無頭模式，未執行 Firefox、WebKit、畫面像素比對或效能測試。

詳細執行步驟請參考 [README.md](README.md)。
