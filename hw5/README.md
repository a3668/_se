# MIPS / Pipeline Lab

MIPS 五級管線教學網站，可編輯組合語言、逐 cycle 查看資料路徑與管線狀態，並儲存及回放模擬紀錄。

技術：Rust、React、SQLite。

## 本機啟動

需求：Rust stable、Node.js 20.19+ 或 22.12+。

在專案目錄啟動後端：

```bash
cargo run
```

另一個終端啟動前端：

```bash
cd frontend
npm install
npm run dev
```

開發網址：`http://127.0.0.1:5173`。

## 主要功能

- 編輯程式、設定暫存器與記憶體初值。
- 顯示資料路徑、控制訊號、管線時序及機器狀態。
- 呈現 forwarding、stall 與 flush。
- 逐 cycle 播放、暫停與回放。
- 儲存程式與模擬紀錄。

## 支援指令

```text
add addu sub subu addi addiu
and or xor nor andi ori xori
slt sltu slti sltiu sll srl sra lui
lw sw beq bne j jal jr nop
```

支援標籤、十進位與十六進位，以及 `#`、`;` 註解。除 `nop` 外不支援偽指令。
