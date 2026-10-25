export type Input = { source: string; registers: Record<string, number>; memory: Record<string, number>; max_cycles: number }
export type Control = { reg_dst: boolean; alu_src: boolean; mem_to_reg: boolean; reg_write: boolean; mem_read: boolean; mem_write: boolean; branch: boolean; jump: boolean; alu_op: string }
export type Instruction = { pc: number; line: number; text: string; op: string; rs: number; rt: number; rd: number; immediate: number; target: number; shamt: number; machine_code: number; destination: number | null; reads_rs_ex: boolean; reads_rt_ex: boolean; control: Control }
export type Slot = { id: number; instruction: Instruction; read_a: number; read_b: number; alu_result: number; store_value: number; write_value: number }
export type Pipeline = { if_id: Slot | null; id_ex: Slot | null; ex_mem: Slot | null; mem_wb: Slot | null }
export type Signals = { pc_write: boolean; if_id_write: boolean; id_ex_flush: boolean; if_id_flush: boolean; forward_a: string; forward_b: string; forward_store: boolean; branch_taken: boolean; redirect: number | null }
export type Cycle = { number: number; pc_before: number; pc_after: number; fetch: Slot | null; pipeline_before: Pipeline; pipeline_after: Pipeline; registers_before: number[]; registers_after: number[]; memory_after: number[]; memory_change: { address: number; before: number; after: number } | null; signals: Signals; events: { kind: string; stage: string; message: string }[]; active_paths: string[]; ex_operands: [number, number] | null; ex_result: number | null }
export type Simulation = { model_version: string; input: Input; instructions: Instruction[]; trace: Cycle[]; status: string; stop_reason: string; statistics: { cycles: number; retired: number; stalls: number; flushed: number; forwarding: number; cpi: number } }
export type Program = { id: number; title: string; input: Input; updated_at: number }
export type RunSummary = { id: number; title: string; program_id: number | null; created_at: number; status: string; cycles: number; retired: number }
export type Run = { id: number; title: string; program_id: number | null; created_at: number; simulation: Simulation }
export const names = ['zero','at','v0','v1','a0','a1','a2','a3','t0','t1','t2','t3','t4','t5','t6','t7','s0','s1','s2','s3','s4','s5','s6','s7','t8','t9','k0','k1','gp','sp','fp','ra']
export const hex = (n: number, digits = 8) => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(digits, '0')
export const slots = (c: Cycle): (Slot | null)[] => [c.fetch, c.pipeline_before.if_id, c.pipeline_before.id_ex, c.pipeline_before.ex_mem, c.pipeline_before.mem_wb]
export const stageNames = ['IF', 'ID', 'EX', 'MEM', 'WB']
