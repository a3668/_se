use crate::assembler::{assemble, Instruction};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const MODEL_VERSION: &str = "mips-single-ex-v1";
pub const MEMORY_BYTES: usize = 1024;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct SimulationInput {
    pub source: String,
    pub registers: BTreeMap<usize, u32>,
    pub memory: BTreeMap<u32, u32>,
    pub max_cycles: usize,
}
impl Default for SimulationInput {
    fn default() -> Self { Self { source: String::new(), registers: BTreeMap::new(), memory: BTreeMap::new(), max_cycles: 10000 } }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Slot {
    pub id: u32,
    pub instruction: Instruction,
    pub read_a: u32,
    pub read_b: u32,
    pub alu_result: u32,
    pub store_value: u32,
    pub write_value: u32,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Pipeline {
    pub if_id: Option<Slot>,
    pub id_ex: Option<Slot>,
    pub ex_mem: Option<Slot>,
    pub mem_wb: Option<Slot>,
}
impl Pipeline {
    fn empty(&self) -> bool { self.if_id.is_none() && self.id_ex.is_none() && self.ex_mem.is_none() && self.mem_wb.is_none() }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Event { pub kind: String, pub stage: String, pub message: String }
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Signals {
    pub pc_write: bool,
    pub if_id_write: bool,
    pub id_ex_flush: bool,
    pub if_id_flush: bool,
    pub forward_a: String,
    pub forward_b: String,
    pub forward_store: bool,
    pub branch_taken: bool,
    pub redirect: Option<u32>,
}
impl Default for Signals {
    fn default() -> Self { Self { pc_write: true, if_id_write: true, id_ex_flush: false, if_id_flush: false, forward_a: "Register".into(), forward_b: "Register".into(), forward_store: false, branch_taken: false, redirect: None } }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MemoryChange { pub address: u32, pub before: u32, pub after: u32 }
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Cycle {
    pub number: usize,
    pub pc_before: u32,
    pub pc_after: u32,
    pub fetch: Option<Slot>,
    pub pipeline_before: Pipeline,
    pub pipeline_after: Pipeline,
    pub registers_before: [u32; 32],
    pub registers_after: [u32; 32],
    pub memory_after: Vec<u32>,
    pub memory_change: Option<MemoryChange>,
    pub signals: Signals,
    pub events: Vec<Event>,
    pub active_paths: Vec<String>,
    pub ex_operands: Option<[u32; 2]>,
    pub ex_result: Option<u32>,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Statistics { pub cycles: usize, pub retired: usize, pub stalls: usize, pub flushed: usize, pub forwarding: usize, pub cpi: f64 }
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Simulation {
    pub model_version: String,
    pub input: SimulationInput,
    pub instructions: Vec<Instruction>,
    pub trace: Vec<Cycle>,
    pub status: String,
    pub stop_reason: String,
    pub statistics: Statistics,
}
fn event(events: &mut Vec<Event>, kind: &str, stage: &str, message: String) {
    events.push(Event { kind: kind.into(), stage: stage.into(), message });
}
fn address(value: u32) -> Result<usize, String> {
    if value % 4 != 0 { return Err(format!("位址 0x{value:08X} 未按 4 bytes 對齊")); }
    if value as usize >= MEMORY_BYTES { return Err(format!("位址 0x{value:08X} 超出 Data Memory（0x0000–0x03FF）")); }
    Ok(value as usize)
}
fn read_word(memory: &[u8], at: usize) -> u32 { u32::from_le_bytes(memory[at..at+4].try_into().expect("aligned memory word")) }
fn forward(reg: usize, original: u32, pipeline: &Pipeline) -> (u32, &'static str) {
    if reg == 0 { return (0, "Register"); }
    if let Some(slot) = &pipeline.ex_mem {
        if slot.instruction.destination == Some(reg) && slot.instruction.control.reg_write {
            if !slot.instruction.control.mem_read { return (slot.alu_result, "EX/MEM"); }
            return (original, "Register");
        }
    }
    if let Some(slot) = &pipeline.mem_wb {
        if slot.instruction.destination == Some(reg) && slot.instruction.control.reg_write { return (slot.write_value, "MEM/WB"); }
    }
    (original, "Register")
}
fn execute(slot: &Slot, a: u32, b: u32) -> Result<(u32, Option<u32>), String> {
    let i = &slot.instruction;
    let imm = i.immediate as u32;
    let overflow = || format!("第 {} 行 {} 發生帶符號溢位", i.line, i.op);
    let mut redirect = None;
    let result = match i.op.as_str() {
        "add" => (a as i32).checked_add(b as i32).ok_or_else(overflow)? as u32,
        "addi" => (a as i32).checked_add(i.immediate).ok_or_else(overflow)? as u32,
        "sub" => (a as i32).checked_sub(b as i32).ok_or_else(overflow)? as u32,
        "addu" => a.wrapping_add(b), "addiu" | "lw" | "sw" => a.wrapping_add(imm), "subu" => a.wrapping_sub(b),
        "and" => a & b, "or" => a | b, "xor" => a ^ b, "nor" => !(a | b),
        "andi" => a & imm, "ori" => a | imm, "xori" => a ^ imm,
        "slt" => ((a as i32) < (b as i32)) as u32, "sltu" => (a < b) as u32,
        "slti" => ((a as i32) < i.immediate) as u32, "sltiu" => (a < imm) as u32,
        "sll" => b << i.shamt, "srl" => b >> i.shamt, "sra" => ((b as i32) >> i.shamt) as u32, "lui" => imm << 16,
        "beq" | "bne" => { if (a == b) == (i.op == "beq") { redirect = Some(i.target); } a.wrapping_sub(b) }
        "j" | "jal" => { redirect = Some(i.target); if i.op == "jal" { i.pc.wrapping_add(4) } else { 0 } }
        "jr" => { redirect = Some(a); 0 }
        _ => 0,
    };
    Ok((result, redirect))
}

pub fn simulate(input: SimulationInput) -> Result<Simulation, String> {
    if input.source.len() > 262144 { return Err("程式文字最多 256 KiB".into()); }
    if !(1..=10000).contains(&input.max_cycles) { return Err("cycle 上限須介於 1 與 10000".into()); }
    let instructions = assemble(&input.source)?;
    let end = instructions.len() as u32 * 4;
    let mut registers = [0u32; 32];
    for (&index, &value) in &input.registers {
        if index >= 32 { return Err(format!("暫存器編號 {index} 超出範圍")); }
        if index == 0 && value != 0 { return Err("$zero 必須為零".into()); }
        registers[index] = value;
    }
    let mut memory = vec![0u8; MEMORY_BYTES];
    for (&at, &value) in &input.memory { let at = address(at)?; memory[at..at+4].copy_from_slice(&value.to_le_bytes()); }
    let mut pipeline = Pipeline::default();
    let mut pc = 0;
    let mut next_id = 1;
    let mut trace = Vec::new();
    let mut statistics = Statistics::default();
    let mut fault: Option<String> = None;
    while (pc < end || !pipeline.empty()) && trace.len() < input.max_cycles {
        let number = trace.len() + 1;
        let before = pipeline.clone();
        let registers_before = registers;
        let pc_before = pc;
        let fetch = if pc < end {
            Some(Slot { id: next_id, instruction: instructions[(pc / 4) as usize].clone(), read_a: 0, read_b: 0, alu_result: 0, store_value: 0, write_value: 0 })
        } else { None };
        let mut after = Pipeline::default();
        let mut signals = Signals::default();
        let mut events = Vec::new();
        let mut paths = Vec::<String>::new();
        let mut memory_change = None;
        let mut ex_operands = None;
        let mut ex_result = None;
        if fetch.is_some() { paths.push("fetch".into()); }
        if let Some(wb) = &before.mem_wb {
            statistics.retired += 1;
            if let Some(dest) = wb.instruction.destination.filter(|d| *d != 0 && wb.instruction.control.reg_write) {
                registers[dest] = wb.write_value; paths.push("writeback".into());
                paths.push(if wb.instruction.control.mem_to_reg { "writeback-memory".into() } else { "writeback-alu".into() });
                event(&mut events, "writeback", "WB", format!("#{}：${dest} ← 0x{:08X}", wb.id, wb.write_value));
            }
        }
        if let Some(mem) = &before.ex_mem {
            let mut next = mem.clone();
            if !mem.instruction.control.mem_read && mem.instruction.control.reg_write { paths.push("memory-alu".into()); }
            if mem.instruction.control.mem_read || mem.instruction.control.mem_write { paths.push("memory-address".into()); }
            if mem.instruction.control.mem_read || mem.instruction.control.mem_write {
                match address(mem.alu_result) {
                    Err(error) => { fault = Some(format!("MEM #{}：{error}", mem.id)); }
                    Ok(at) => {
                        if mem.instruction.control.mem_read {
                            next.write_value = read_word(&memory, at); paths.push("memory-read".into());
                            event(&mut events, "memory", "MEM", format!("讀取 [0x{at:04X}] = 0x{:08X}", next.write_value));
                        } else {
                            let mut value = mem.store_value;
                            if let Some(wb) = &before.mem_wb {
                                if mem.instruction.rt != 0 && wb.instruction.control.reg_write && wb.instruction.destination == Some(mem.instruction.rt) {
                                    value = wb.write_value; signals.forward_store = true; statistics.forwarding += 1; paths.push("forward-store".into());
                                    event(&mut events, "forward", "MEM", format!("MEM/WB #{} → sw #{} 寫入資料", wb.id, mem.id));
                                }
                            }
                            memory_change = Some(MemoryChange { address: at as u32, before: read_word(&memory, at), after: value });
                            memory[at..at+4].copy_from_slice(&value.to_le_bytes()); next.store_value = value; paths.push("memory-write".into());
                            event(&mut events, "memory", "MEM", format!("[0x{at:04X}] ← 0x{value:08X}"));
                        }
                    }
                }
            }
            after.mem_wb = Some(next);
        }
        if fault.is_none() {
            if let Some(ex) = &before.id_ex {
                let i = &ex.instruction;
                if i.control.mem_write { paths.push("store-ex".into()); }
                let (a, fa) = if i.reads_rs_ex { forward(i.rs, ex.read_a, &before) } else { (ex.read_a, "Register") };
                let (b, fb) = if i.reads_rt_ex || i.control.mem_write { forward(i.rt, ex.read_b, &before) } else { (ex.read_b, "Register") };
                signals.forward_a = fa.into(); signals.forward_b = fb.into();
                for (operand, from) in [("A", fa), ("B", fb)] {
                    if from != "Register" {
                        statistics.forwarding += 1;
                        paths.push(format!("forward-{}-{}", if from == "EX/MEM" { "ex" } else { "wb" }, operand.to_lowercase()));
                        event(&mut events, "forward", "EX", format!("{from} → #{} 運算元 {operand}", ex.id));
                    }
                }
                ex_operands = Some([a, if i.control.alu_src { i.immediate as u32 } else { b }]);
                paths.push("execute".into());
                match execute(ex, a, b) {
                    Err(error) => fault = Some(error),
                    Ok((result, redirect)) => {
                        ex_result = Some(result);
                        let mut next = ex.clone(); next.alu_result = result; next.write_value = result; next.store_value = b;
                        after.ex_mem = Some(next);
                        if let Some(target) = redirect {
                            if target % 4 != 0 || target > end { fault = Some(format!("EX #{}：跳轉目標 0x{target:08X} 未對齊或超出程式範圍", ex.id)); }
                            else { signals.redirect = Some(target); signals.branch_taken = i.control.branch; }
                        }
                        if i.control.branch {
                            event(&mut events, "branch", "EX", format!("#{} {}：{}", ex.id, i.op, if redirect.is_some() { "成立，重新導向 PC" } else { "不成立，循序執行" }));
                        }
                    }
                }
            }
        }
        if fault.is_none() {
            if let Some(target) = signals.redirect {
                signals.id_ex_flush = true; signals.if_id_flush = true; pc = target; paths.push("redirect".into());
                for (stage, slot) in [("ID", before.if_id.as_ref()), ("IF", fetch.as_ref())] {
                    if let Some(slot) = slot { statistics.flushed += 1; event(&mut events, "flush", stage, format!("清除 #{}（{}）；PC → 0x{target:08X}", slot.id, slot.instruction.text)); }
                }
                event(&mut events, "bubble", "EX", "重新導向：下一個 EX 為 bubble".into());
            } else {
                let dependency = before.id_ex.as_ref().filter(|s| s.instruction.control.mem_read).and_then(|s| s.instruction.destination).filter(|d| *d != 0).filter(|dest| {
                    before.if_id.as_ref().is_some_and(|id| (id.instruction.reads_rs_ex && id.instruction.rs == *dest) || (id.instruction.reads_rt_ex && id.instruction.rt == *dest))
                });
                if let Some(dest) = dependency {
                    signals.pc_write = false; signals.if_id_write = false; signals.id_ex_flush = true;
                    after.if_id = before.if_id.clone(); statistics.stalls += 1;
                    event(&mut events, "stall", "ID", format!("load-use：${dest} 尚未從 MEM 取得，保持 PC 與 IF/ID"));
                    event(&mut events, "bubble", "EX", "下一個 EX 插入 bubble；較早指令繼續前進".into());
                } else {
                    if let Some(id) = &before.if_id {
                        let mut decoded = id.clone(); decoded.read_a = registers[id.instruction.rs]; decoded.read_b = registers[id.instruction.rt];
                        decoded.store_value = decoded.read_b;
                        after.id_ex = Some(decoded); paths.push("decode".into());
                        if id.instruction.control.alu_src || id.instruction.control.branch { paths.push("immediate".into()); }
                        if let Some(wb) = &before.mem_wb {
                            if let Some(dest) = wb.instruction.destination.filter(|d| *d != 0 && wb.instruction.control.reg_write) {
                                if (id.instruction.reads_rs_ex && id.instruction.rs == dest) || ((id.instruction.reads_rt_ex || id.instruction.control.mem_write) && id.instruction.rt == dest) {
                                    event(&mut events, "register", "ID", format!("同 cycle 先 WB 後 ID：讀取更新後的 ${dest}"));
                                }
                            }
                        }
                    }
                    after.if_id = fetch.clone();
                    if fetch.is_some() { pc += 4; }
                }
            }
        } else {
            signals.pc_write = false; signals.if_id_write = false;
            event(&mut events, "error", "CPU", fault.clone().unwrap_or_default());
        }
        if fetch.is_some() && signals.pc_write { next_id += 1; }
        registers[0] = 0;
        let memory_after = (0..MEMORY_BYTES).step_by(4).map(|at| read_word(&memory, at)).collect();
        trace.push(Cycle { number, pc_before, pc_after: pc, fetch, pipeline_before: before, pipeline_after: after.clone(), registers_before, registers_after: registers, memory_after, memory_change, signals, events, active_paths: paths, ex_operands, ex_result });
        pipeline = after;
        if fault.is_some() { break; }
    }
    statistics.cycles = trace.len();
    statistics.cpi = if statistics.retired == 0 { 0.0 } else { statistics.cycles as f64 / statistics.retired as f64 };
    let (status, stop_reason) = if let Some(error) = fault { ("error", error) } else if pc >= end && pipeline.empty() { ("completed", "程式結束，管線已排空".into()) } else { ("limit", format!("達到 {} cycles 上限，已保存部分執行紀錄", input.max_cycles)) };
    Ok(Simulation { model_version: MODEL_VERSION.into(), input, instructions, trace, status: status.into(), stop_reason, statistics })
}
