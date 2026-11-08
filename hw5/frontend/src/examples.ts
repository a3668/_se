export const examples = [
  { title: 'Forwarding & load-use', description: '觀察 load-use 停頓、ALU forwarding 與 store-data forwarding。', source: '# 載入 → 相依運算 → 寫回記憶體\n# Data Memory [0] 初始為 7\nlw    $t0, 0($zero)\nadd   $t1, $t0, $t0\naddi  $t2, $t1, 3\nsw    $t2, 4($zero)\nlw    $t3, 4($zero)\nsw    $t3, 8($zero)\n', registers: '', memory: '0x0000 = 7' },
  { title: 'Branch & flush', description: 'EX 判定分支成立，清除 IF 與 ID 的錯誤路徑。', source: '# 分支後的兩條指令會被清除\naddi  $t0, $zero, 5\naddi  $t1, $zero, 5\nbeq   $t0, $t1, taken\naddi  $s0, $zero, 99\nsw    $s0, 0($zero)\ntaken:\naddi  $s1, $zero, 42\nsw    $s1, 4($zero)\n', registers: '', memory: '' },
  { title: 'Loop & dependencies', description: '同一行指令多次執行，各次都有獨立的指令實例 ID。', source: '# 1 + 2 + 3 + 4 + 5 = 15\naddi  $t0, $zero, 5\naddi  $s0, $zero, 0\nloop:\nadd   $s0, $s0, $t0\naddi  $t0, $t0, -1\nbne   $t0, $zero, loop\nsw    $s0, 0($zero)\n', registers: '', memory: '' },
  { title: 'Jump & link', description: 'jal 保存 PC+4，jr 返回，跳躍同樣在 EX 重新導向。', source: 'addi  $a0, $zero, 6\njal   double\nsw    $v0, 0($zero)\nj     done\ndouble:\nadd   $v0, $a0, $a0\njr    $ra\ndone:\nnop\n', registers: '', memory: '' },
]
