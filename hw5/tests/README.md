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

## 測試結果

| 測試類型 | 通過 | 失敗 |
| --- | --- | --- |
| Rust Server 單元測試 | 42 | 0 |
| Web API 系統測試 | 477 項檢查 | 0 |
| 無頭 Playwright E2E | 37 | 0 |

### 1. Rust Server 單元測試

```text
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

test result: ok. 42 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

### 2. Web API 系統測試

```text
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

### 3. 無頭 Playwright E2E

```text
37 passed
```

| # | 測試項目 | 結果 |
| --- | --- | --- |
| 1 | 拒絕輸入：未知暫存器 | 通過 |
| 2 | 拒絕輸入：zero 非零 | 通過 |
| 3 | 拒絕輸入：重複暫存器別名 | 通過 |
| 4 | 拒絕輸入：32-bit 數值超界 | 通過 |
| 5 | 拒絕輸入：記憶體未對齊 | 通過 |
| 6 | 拒絕輸入：記憶體超界 | 通過 |
| 7 | 拒絕輸入：設定格式錯誤 | 通過 |
| 8 | 拒絕輸入：不支援偽指令 | 通過 |
| 9 | 拒絕輸入：超過 20 條指令 | 通過 |
| 10 | 拒絕輸入：空程式名稱 | 通過 |
| 11 | 拒絕輸入：cycle 上限不合法 | 通過 |
| 12 | 執行期記憶體錯誤保存部分紀錄且可回放 | 通過 |
| 13 | 執行期 signed overflow保存部分紀錄且可回放 | 通過 |
| 14 | cycle 上限保存部分紀錄且可回放 | 通過 |
| 15 | 暫時無法連線後可重新連上真實 API | 通過 |
| 16 | 程式新增、更新與重新整理後載入 | 通過 |
| 17 | 未完成語法可存為草稿，執行時顯示組譯錯誤 | 通過 |
| 18 | 新程式的取代確認可取消或接受 | 通過 |
| 19 | 載入範例與已存程式的取代確認 | 通過 |
| 20 | 編輯保留舊快照，重新執行建立新的結果 | 通過 |
| 21 | 重新整理後回放，以及放棄編輯的取消與確認 | 通過 |
| 22 | 刪除程式保留快照，取消刪除及刪除目前紀錄 | 通過 |
| 23 | 歷史重新整理取得其他連線儲存的資料 | 通過 |
| 24 | 初始工作台、空歷史與未執行控制 | 通過 |
| 25 | 教學範例：Forwarding & load-use | 通過 |
| 26 | 教學範例：Branch & flush | 通過 |
| 27 | 教學範例：Loop & dependencies | 通過 |
| 28 | 教學範例：Jump & link | 通過 |
| 29 | 逐 cycle、時間軸、起點與結尾邊界 | 通過 |
| 30 | 播放速度、暫停與自動停止 | 通過 |
| 31 | Datapath 縮放上下界與重設 | 通過 |
| 32 | Control Unit 解碼、階段選擇與管線暫存器邊緣 | 通過 |
| 33 | load-use 的 stall、forwarding 訊號與時序定位 | 通過 |
| 34 | branch 的 flush 訊號與取消指令標記 | 通過 |
| 35 | 長迴圈的 18 欄視窗與不同動態 ID | 通過 |
| 36 | 暫存器初值、負數與記憶體末頁 | 通過 |
| 37 | 機器狀態的寫回與記憶體邊緣前後值 | 通過 |
