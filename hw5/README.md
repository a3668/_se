# MIPS / Pipeline Lab

Single-issue MIPS 五級管線教學網站。Rust 核心產生逐 cycle trace，React 同步呈現資料路徑、控制訊號、管線時序、暫存器與記憶體；SQLite 保存程式與可回放的模擬快照。

## 本機使用

需求：Rust stable、Node.js 20.19+ 或 22.12+。

在專案根目錄啟動 Rust API：

```bash
cargo run
```

另一個終端啟動前端：

```bash
cd frontend
npm install
npm run dev
```

網站位址為 `http://127.0.0.1:5173`；Vite 將 `/api` 代理至 `127.0.0.1:8080`。

若要由 Rust 同時提供編譯後的前端，在 `frontend` 執行 `npm run build`，再從專案根目錄執行 `cargo run`，網站位址為 `http://127.0.0.1:8080`。

後端設定透過環境變數提供：`SERVER_ADDR` 預設 `127.0.0.1:8080`；`DATABASE_PATH` 預設為執行目錄下的 `mips.db`。資料表在啟動時建立。SQLite 資料庫、WAL 與本機相依套件不納入 Git。

## 工作台

- **Program editor**：組合語言、暫存器與記憶體初值、cycle 上限，以及四個內建教學範例。
- **Datapath**：可縮放與水平捲動的五級資料路徑圖；綠色代表有效路徑，琥珀色代表 forwarding。
- **Control Unit**：各階段指令的機器碼、解碼欄位、控制訊號、hazard 訊號與管線暫存器。
- **Pipeline**：依動態指令實例 ID 呈現時序，標示保持與取消的指令。顯示游標附近 18 個 cycles，避免長迴圈一次渲染整張表。
- **History**：免登入共用工作區，保存程式草稿、執行快照，回放及刪除紀錄。清單顯示最近 100 筆；刪除程式不會刪除其模擬快照。
- **Playback**：前後 cycle、播放／暫停、速度調整、時間軸、回到第一個 cycle。播放使用已儲存的 trace，不重新執行 CPU。

程式編輯後，舊模擬仍保留並顯示未套用提示；再次執行會建立新的快照。統計卡的 retired、stall、flush、CPI 為整次模擬統計；cycle 游標與機器狀態隨播放改變。

## CPU 與輸入規則

- MIPS 整數指令子集；32-bit、32 暫存器、`$zero` 固定為 0。
- IF → ID → EX → MEM → WB；IF/ID、ID/EX、EX/MEM、MEM/WB 保存資料與控制訊號。每 cycle 最多發射一條指令，in-order。
- 指令與資料記憶體分離；程式 PC 從 0 開始，指令長 4 bytes。
- Data Memory **1 KiB**（256 words），little-endian；有效 byte 範圍 `0x0000–0x03FF`，`lw/sw` 的 word 起始位址為 `0–1020` 且須 4-byte 對齊。
- WB 先寫回，ID 可於同一 cycle 讀到新值。
- EX/MEM 與 MEM/WB 可轉送至 EX，較新結果優先；尚未完成的 load 不從 EX/MEM 轉送。
- load-use 保持 PC 與 IF/ID，向 ID/EX 插入 bubble。`sw` 的 base 在 EX 使用，store data 在 MEM 使用，另有 MEM/WB → MEM 轉送。
- `beq/bne/j/jal/jr` 在 EX 重新導向；預設 not taken、**無 delay slot**；重新導向清除 IF、ID，優先於較年輕指令的 stall。`jal` 保存 PC+4 到 `$ra`。
- 程式結束時排空管線；最多 20 條靜態指令、程式文字 256 KiB、1–10000 cycles（預設 10000）。迴圈每次取指皆有不同動態實例 ID；停頓保持中的指令沿用其 ID。
- 非法語法或初始設定由 API 拒絕；執行中的記憶體錯誤、無效跳躍目標、`add/sub/addi` 的 signed overflow 會停止並保存部分紀錄。停止 cycle 中較早階段的 WB/MEM 副作用可能已發生；本版不實作 precise exceptions 或 exception handler。
- 跳躍目標須為程式內或程式末端、4-byte 對齊的位址；程式末端目標代表結束取指並排空管線。

支援指令：

```text
add addu sub subu addi addiu
and or xor nor andi ori xori
slt sltu slti sltiu sll srl sra lui
lw sw beq bne j jal jr nop
```

暫存器接受 `$t0`、`$8`、`t0`、`8`；`$s8` 為 `$fp` 的別名。支援標籤、`.text`、`#` / `;` 註解、十進位與十六進位。除了 `nop`，不展開 `li/move/b` 等偽指令，不處理 `.data`、乘除、浮點、系統呼叫、分支延遲槽。

- `beq/bne` 的第三參數可為標籤或 signed 16-bit **word offset**（相對 PC+4）。
- `j/jal` 的參數為標籤或絕對 **byte address**。
- 算術與 load/store 的立即數採 signed 16-bit；`0xFFFF` 以 -1 解讀。`andi/ori/xori/lui` 採 unsigned 16-bit。
- 初始設定每行一筆，例如 `$t0 = -1` 或 `0x0000 = 7`；未指定的值為 0，記憶體初始值為 word。

## API

前綴 `/api/v1`，JSON body。正常建立回傳 201，刪除回傳 204。應用錯誤回傳 `{ "error": "訊息" }`。

| Method | Path | 行為 |
|---|---|---|
| GET / POST | `/programs` | 列出／建立程式 |
| GET / PUT / DELETE | `/programs/{id}` | 取得／更新／刪除程式 |
| GET / POST | `/simulations` | 列出摘要／建立並保存模擬 |
| GET / DELETE | `/simulations/{id}` | 讀取完整快照與 trace／刪除紀錄 |

程式的建立與更新接受 `{ "title": "名稱", "input": {...} }`。模擬接受相同欄位，另含可為 null 的 `program_id`。

```json
{
  "title": "Load-use",
  "program_id": null,
  "input": {
    "source": "lw $t0, 0($zero)\nadd $t1, $t0, $t0",
    "registers": {},
    "memory": { "0": 7 },
    "max_cycles": 10000
  }
}
```

`registers` 的 key 為十進位暫存器編號，`memory` 的 key 為十進位 byte 位址，value 為 unsigned 32-bit 整數。前端接受的負數會先轉成同一個 32-bit bit pattern。

模擬回傳 `id/title/program_id/created_at/simulation`。`simulation` 包含 `model_version/input/instructions/trace/status/stop_reason/statistics`。執行期 fault 或 cycle 上限仍會保存為 `error` 或 `limit` 紀錄，正常結束為 `completed`。組譯失敗回傳 400，不建立紀錄。

## 原始碼

- `src/assembler.rs`：MIPS 語法、標籤解析、機器碼、來源使用與控制訊號。
- `src/simulation.rs`：純 Rust 模擬核心，逐 cycle 狀態與事件。
- `src/main.rs`：Axum API、SQLite、靜態前端提供。
- `frontend/src`：React 工作台、SVG datapath、時序與歷史介面。

模型版本為 `mips-single-ex-v1`；未來 dual-issue 使用新的模型與發射寬度，保留目前 single-issue 的獨立語意。歷史快照已保存模型版本與動態指令 ID，不會隨原程式修改而變動。

CPU 模型的 cycle 邊界與 hazard 行為詳見 [CPU_MODEL.md](CPU_MODEL.md)。
