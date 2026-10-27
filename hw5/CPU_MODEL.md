# CPU 模型與 cycle 語意

## 固定架構

此模型對應 Patterson & Hennessy 風格的五級、single-issue MIPS 教學管線，採 EX 判斷分支、predict not taken、無 delay slot。使用分離的指令／資料記憶體避免 IF/MEM 的結構衝突；不模擬 cache、共享記憶體埠或多周期執行單元，因此沒有額外的 structural stall。依序讀取與寫回，沒有 WAR/WAW 排序問題；RAW 依實際 operand 使用階段處理。

參考：[Illinois 五級 MIPS 與分支階段說明](https://courses.grainger.illinois.edu/cs232/sp2010/section/disc6.pdf)、[Cornell MIPS forwarding 條件](https://www.cs.cornell.edu/courses/cs3410/2015fa/projects/pa1.html)。本模型的無 delay slot、EX jump 與記憶體容量是此網站明訂的選擇。

## 一個 trace frame 代表什麼

Cycle 1 的 IF 取得第一條指令，邊緣後進入 IF/ID。每個 frame：

1. `pipeline_before` 與 `fetch` 描述此 cycle 各階段的指令；datapath、時序表和當下事件都依此呈現。
2. WB 的輸出可供本 cycle ID 讀取；MEM、EX 同樣從邊緣前的管線暫存器運算，不讀取本 cycle 剛算出的下一狀態。
3. `signals`、`ex_operands`、`ex_result`、`active_paths` 為此 cycle 的組合邏輯結果。
4. `pipeline_after`、`pc_after`、`registers_after`、`memory_after` 為更新後狀態。`registers_before` 是本 cycle WB 發生前的值。介面的機器狀態切換可查看兩個時間點；資料路徑持續呈現邊緣前指令及其組合邏輯。
5. `memory_change` 包含本 cycle store 的前後值；邊緣前完整記憶體可從上一 frame 的 `memory_after`（首 frame 為初始設定）還原。

框架中的空槽是 bubble / idle。只有實際指令才有動態實例 ID；顯式 `nop` 也是一條指令，會計入 retired。stall 中同一個取指候選沿用 ID，flush 的指令保留在時序紀錄中，永不提交。

## Hazard 規則

- EX forwarding 比較有效寫回目標與實際 EX 來源；目的暫存器為 `$zero` 時不轉送。
- EX/MEM 比 MEM/WB 新，命中時阻止舊值覆蓋；若最新來源為尚未完成的 load，不能以它的位址冒充資料。
- ID/EX 為 load 且 ID 指令在下一個 EX 需要其結果時，凍結 PC、IF/ID，ID/EX 插入 bubble；較早的 MEM、WB 正常前進。
- `sw` 的 `rs` 用於 EX 位址，`rt` 用於 MEM 寫入。僅因 load → sw 的資料相依不插入多餘 stall，MEM/WB → MEM 在 store 寫入時提供資料；若 sw 的 base 也相依，仍按 load-use 停頓。
- 分支的兩個比較來源與 `jr` 的目標來源在 EX 使用，適用相同 forwarding 與 load-use 規則。
- EX redirect 優先清除年輕的 IF、ID，不受其 stall 請求阻擋。`PCWrite=1`，IF/ID 與 ID/EX 清空，下一 cycle 取目標指令。
- 分支不成立時不清除；成立分支或 jump 在沒有其他等待時浪費兩個取指機會。

## 初始狀態與結束

Data Memory 使用 1024 個 bytes，依 little-endian 讀寫 32-bit words。初始設定採 word 值，與介面顯示一致。指令儲存空間獨立，PC 0 不會與資料位址 0 衝突。

程式末端停止取指但繼續排空。cycle 上限停止時保留當下 trace。執行錯誤 frame 可包含較早指令的寫回或 store；本版停止模擬，不執行 precise trap、rollback 或例外服務程式。

CPI = 已模擬 cycles / 已 retired 指令數（包含填充、排空、nop），尚無 retired 指令時呈現 0。stall 統計為停頓的 cycles，flush 統計為取消的動態指令數，forwarding 統計為被採用的轉送 operand 次數。
