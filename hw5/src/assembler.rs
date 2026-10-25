use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Control {
    pub reg_dst: bool,
    pub alu_src: bool,
    pub mem_to_reg: bool,
    pub reg_write: bool,
    pub mem_read: bool,
    pub mem_write: bool,
    pub branch: bool,
    pub jump: bool,
    pub alu_op: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Instruction {
    pub pc: u32,
    pub line: usize,
    pub text: String,
    pub op: String,
    pub rs: usize,
    pub rt: usize,
    pub rd: usize,
    pub immediate: i32,
    pub target: u32,
    pub shamt: u32,
    pub machine_code: u32,
    pub destination: Option<usize>,
    pub reads_rs_ex: bool,
    pub reads_rt_ex: bool,
    pub control: Control,
}

pub fn register(input: &str) -> Result<usize, String> {
    let value = input.trim().trim_start_matches('$').to_lowercase();
    let names = ["zero", "at", "v0", "v1", "a0", "a1", "a2", "a3", "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "t8", "t9", "k0", "k1", "gp", "sp", "fp", "ra"];
    if value == "s8" { return Ok(30); }
    if let Some(index) = names.iter().position(|name| *name == value) { return Ok(index); }
    value.parse::<usize>().ok().filter(|n| *n < 32).ok_or_else(|| format!("未知暫存器：{input}"))
}

fn number(input: &str) -> Result<i64, String> {
    let (negative, digits) = input.strip_prefix('-').map_or((false, input), |s| (true, s));
    let n = if let Some(hex) = digits.strip_prefix("0x").or_else(|| digits.strip_prefix("0X")) {
        i64::from_str_radix(hex, 16)
    } else { digits.parse::<i64>() }.map_err(|_| format!("無效數值：{input}"))?;
    Ok(if negative { -n } else { n })
}

fn immediate(input: &str, unsigned: bool) -> Result<i32, String> {
    let n = number(input)?;
    if unsigned {
        if !(0..=65535).contains(&n) { return Err("立即數須介於 0 與 65535".into()); }
        Ok(n as i32)
    } else {
        let n = if (input.starts_with("0x") || input.starts_with("0X")) && (32768..=65535).contains(&n) { n - 65536 } else { n };
        if !(-32768..=32767).contains(&n) { return Err("帶符號立即數須介於 -32768 與 32767".into()); }
        Ok(n as i32)
    }
}

pub fn assemble(source: &str) -> Result<Vec<Instruction>, String> {
    let mut labels = HashMap::new();
    let mut lines = Vec::new();
    for (index, raw) in source.lines().enumerate() {
        let mut text = raw.split('#').next().unwrap_or("").split(';').next().unwrap_or("").trim();
        while let Some((label, rest)) = text.split_once(':') {
            let label = label.trim();
            if label.is_empty() || !label.chars().enumerate().all(|(i, c)| c == '_' || c.is_ascii_alphabetic() || (i > 0 && c.is_ascii_digit())) {
                return Err(format!("第 {} 行：無效標籤", index + 1));
            }
            if labels.insert(label.to_string(), (lines.len() * 4) as u32).is_some() { return Err(format!("第 {} 行：重複標籤 {label}", index + 1)); }
            text = rest.trim();
        }
        if text.is_empty() || text == ".text" { continue; }
        if text.starts_with('.') { return Err(format!("第 {} 行：只支援 .text，資料請在初始記憶體設定", index + 1)); }
        lines.push((index + 1, text.to_string()));
        if lines.len() > 20 { return Err("最多支援 20 條靜態指令；迴圈的動態執行不受此數量限制".into()); }
    }
    if lines.is_empty() { return Err("請輸入至少一條 MIPS 指令".into()); }
    lines.iter().enumerate().map(|(index, (line, text))| {
        parse_instruction((index * 4) as u32, *line, text, &labels).map_err(|e| format!("第 {line} 行：{e}"))
    }).collect()
}

fn parse_instruction(pc: u32, line: usize, text: &str, labels: &HashMap<String, u32>) -> Result<Instruction, String> {
    let clean = text.replace([',', '(', ')'], " ");
    let tokens: Vec<&str> = clean.split_whitespace().collect();
    let (opcode, args) = tokens.split_first().ok_or("缺少指令名稱")?;
    let op = opcode.to_lowercase();
    let mut i = Instruction { pc, line, text: text.to_string(), op: op.clone(), rs: 0, rt: 0, rd: 0, immediate: 0, target: 0, shamt: 0, machine_code: 0, destination: None, reads_rs_ex: false, reads_rt_ex: false, control: Control { alu_op: op.clone(), ..Default::default() } };
    let count = |n| if args.len() == n { Ok(()) } else { Err(format!("{op} 需要 {n} 個運算元")) };
    let r_function = match op.as_str() { "add" => Some(32), "addu" => Some(33), "sub" => Some(34), "subu" => Some(35), "and" => Some(36), "or" => Some(37), "xor" => Some(38), "nor" => Some(39), "slt" => Some(42), "sltu" => Some(43), _ => None };
    if let Some(function) = r_function {
        count(3)?; i.rd = register(args[0])?; i.rs = register(args[1])?; i.rt = register(args[2])?;
        i.destination = Some(i.rd); i.reads_rs_ex = true; i.reads_rt_ex = true; i.control.reg_dst = true; i.control.reg_write = true;
        i.machine_code = ((i.rs as u32) << 21) | ((i.rt as u32) << 16) | ((i.rd as u32) << 11) | function;
        return Ok(i);
    }
    match op.as_str() {
        "nop" => { count(0)?; }
        "sll" | "srl" | "sra" => {
            count(3)?; i.rd = register(args[0])?; i.rt = register(args[1])?;
            let shift = number(args[2])?;
            if !(0..=31).contains(&shift) { return Err("位移量須介於 0 與 31".into()); }
            i.shamt = shift as u32; i.destination = Some(i.rd); i.reads_rt_ex = true; i.control.reg_write = true; i.control.reg_dst = true;
            let function = match op.as_str() { "srl" => 2, "sra" => 3, _ => 0 };
            i.machine_code = ((i.rt as u32) << 16) | ((i.rd as u32) << 11) | (i.shamt << 6) | function;
        }
        "jr" => { count(1)?; i.rs = register(args[0])?; i.reads_rs_ex = true; i.control.jump = true; i.machine_code = ((i.rs as u32) << 21) | 8; }
        "j" | "jal" => {
            count(1)?;
            let target = if let Some(target) = labels.get(args[0]) { *target as i64 } else { number(args[0])? };
            if !(0..=0x0fff_fffc).contains(&target) || target % 4 != 0 { return Err("跳躍位址須為有效的 4-byte 對齊位址".into()); }
            i.target = target as u32; i.control.jump = true;
            if op == "jal" { i.destination = Some(31); i.control.reg_write = true; }
            i.machine_code = (if op == "jal" { 3 } else { 2 }) << 26 | (i.target >> 2);
        }
        "beq" | "bne" => {
            count(3)?; i.rs = register(args[0])?; i.rt = register(args[1])?; i.reads_rs_ex = true; i.reads_rt_ex = true; i.control.branch = true;
            i.immediate = if let Some(target) = labels.get(args[2]) {
                let offset = (*target as i64 - (pc as i64 + 4)) / 4;
                if !(-32768..=32767).contains(&offset) { return Err("分支目標超出範圍".into()); }
                offset as i32
            } else { immediate(args[2], false)? };
            i.target = pc.wrapping_add(4).wrapping_add((i.immediate * 4) as u32);
            i.machine_code = (if op == "beq" { 4 } else { 5 }) << 26 | ((i.rs as u32) << 21) | ((i.rt as u32) << 16) | (i.immediate as u32 & 65535);
        }
        "lui" => {
            count(2)?; i.rt = register(args[0])?; i.immediate = immediate(args[1], true)?; i.destination = Some(i.rt); i.control.alu_src = true; i.control.reg_write = true;
            i.machine_code = 15 << 26 | ((i.rt as u32) << 16) | i.immediate as u32;
        }
        "lw" | "sw" => {
            count(3)?; i.rt = register(args[0])?; i.immediate = immediate(args[1], false)?; i.rs = register(args[2])?; i.reads_rs_ex = true; i.control.alu_src = true;
            i.control.mem_read = op == "lw"; i.control.mem_write = op == "sw"; i.control.mem_to_reg = op == "lw"; i.control.reg_write = op == "lw";
            if op == "lw" { i.destination = Some(i.rt); }
            i.control.alu_op = "add".into();
            i.machine_code = (if op == "lw" { 35 } else { 43 }) << 26 | ((i.rs as u32) << 21) | ((i.rt as u32) << 16) | (i.immediate as u32 & 65535);
        }
        "addi" | "addiu" | "andi" | "ori" | "xori" | "slti" | "sltiu" => {
            count(3)?; i.rt = register(args[0])?; i.rs = register(args[1])?;
            i.immediate = immediate(args[2], matches!(op.as_str(), "andi" | "ori" | "xori"))?;
            i.destination = Some(i.rt); i.reads_rs_ex = true; i.control.alu_src = true; i.control.reg_write = true;
            let opcode = match op.as_str() { "addi" => 8, "addiu" => 9, "slti" => 10, "sltiu" => 11, "andi" => 12, "ori" => 13, _ => 14 };
            i.machine_code = opcode << 26 | ((i.rs as u32) << 21) | ((i.rt as u32) << 16) | (i.immediate as u32 & 65535);
        }
        _ => return Err(format!("不支援指令 {op}；請使用支援清單中的指令（不展開偽指令）")),
    }
    Ok(i)
}
