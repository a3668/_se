use mips_pipeline_lab::simulation::{simulate, Cycle, Simulation, SimulationInput};
use std::collections::{BTreeMap, BTreeSet};

fn input(source: &str) -> SimulationInput {
    SimulationInput { source: source.into(), max_cycles: 128, ..Default::default() }
}

fn completed(data: SimulationInput) -> Simulation {
    let simulation = simulate(data).unwrap();
    assert_eq!(simulation.status, "completed", "{}", simulation.stop_reason);
    simulation
}

fn last(simulation: &Simulation) -> &Cycle {
    simulation.trace.last().unwrap()
}

fn ex_at(simulation: &Simulation, pc: u32) -> &Cycle {
    simulation.trace.iter().find(|c| c.pipeline_before.id_ex.as_ref()
        .is_some_and(|s| s.instruction.pc == pc)).expect("instruction reached EX")
}

#[test]
fn arithmetic_logic_comparisons_and_shifts() {
    // Each case has an independently specified 32-bit result in $t0.
    for (source, a, b, expected) in [
        ("add $t0, $t1, $t2", 7, 3, 10),
        ("sub $t0, $t1, $t2", 3, 7, 0xffff_fffc),
        ("addi $t0, $t1, -3", 7, 0, 4),
        ("addu $t0, $t1, $t2", 0xffff_ffff, 1, 0),
        ("subu $t0, $t1, $t2", 0, 1, 0xffff_ffff),
        ("addiu $t0, $t1, -1", 0, 0, 0xffff_ffff),
        ("addiu $t0, $t1, 1", 0x7fff_ffff, 0, 0x8000_0000),
        ("and $t0, $t1, $t2", 0xaa55, 0x0ff0, 0x0a50),
        ("or $t0, $t1, $t2", 0xaa55, 0x0ff0, 0xaff5),
        ("xor $t0, $t1, $t2", 0xaa55, 0x0ff0, 0xa5a5),
        ("nor $t0, $t1, $t2", 0xaa55, 0x0ff0, 0xffff_500a),
        ("andi $t0, $t1, 0xFFFF", 0xffff_1234, 0, 0x1234),
        ("ori $t0, $t1, 0x8000", 0x1234_0000, 0, 0x1234_8000),
        ("xori $t0, $t1, 0xFFFF", 0xffff_1234, 0, 0xffff_edcb),
        ("slt $t0, $t1, $t2", 0xffff_ffff, 1, 1),
        ("sltu $t0, $t1, $t2", 0xffff_ffff, 1, 0),
        ("slt $t0, $t1, $t2", 3, 3, 0),
        ("sltu $t0, $t1, $t2", 0, 0xffff_ffff, 1),
        ("slti $t0, $t1, -1", 0xffff_fffe, 0, 1),
        ("slti $t0, $t1, -1", 0, 0, 0),
        ("sltiu $t0, $t1, -1", 1, 0, 1),
        ("sltiu $t0, $t1, -1", 0xffff_ffff, 0, 0),
        ("sll $t0, $t1, 4", 0x8000_0001, 0, 16),
        ("srl $t0, $t1, 4", 0x8000_0000, 0, 0x0800_0000),
        ("sra $t0, $t1, 4", 0x8000_0000, 0, 0xf800_0000),
        ("sll $t0, $t1, 31", 1, 0, 0x8000_0000),
        ("srl $t0, $t1, 31", 0x8000_0000, 0, 1),
        ("sra $t0, $t1, 31", 0x8000_0000, 0, 0xffff_ffff),
        ("sll $t0, $t1, 0", 0x8765_4321, 0, 0x8765_4321),
        ("lui $t0, 0xABCD", 0, 0, 0xabcd_0000),
    ] {
        let mut data = input(source);
        data.registers = BTreeMap::from([(9, a), (10, b)]);
        let simulation = completed(data);
        assert_eq!(last(&simulation).registers_after[8], expected, "{source}");
        assert_eq!(simulation.statistics.retired, 1, "{source}");
    }
}

#[test]
fn signed_overflow_stops_without_committing_the_result() {
    for (source, a, b) in [
        ("add $t0, $t1, $t2", 0x7fff_ffff, 1),
        ("add $t0, $t1, $t2", 0x8000_0000, 0xffff_ffff),
        ("sub $t0, $t1, $t2", 0x8000_0000, 1),
        ("sub $t0, $t1, $t2", 0x7fff_ffff, 0xffff_ffff),
        ("addi $t0, $t1, 1", 0x7fff_ffff, 0),
        ("addi $t0, $t1, -1", 0x8000_0000, 0),
    ] {
        let mut data = input(source);
        data.registers = BTreeMap::from([(8, 99), (9, a), (10, b)]);
        let simulation = simulate(data).unwrap();
        assert_eq!(simulation.status, "error", "{source}");
        assert!(simulation.stop_reason.contains("溢位"));
        assert_eq!(simulation.statistics.cycles, 3);
        assert_eq!(simulation.statistics.retired, 0);
        assert_eq!(last(&simulation).registers_after[8], 99);
        assert!(last(&simulation).events.iter().any(|e| e.kind == "error"));
    }
}

#[test]
fn five_stages_and_clock_edge_writeback() {
    let simulation = completed(input("addi $t0, $zero, 7"));
    assert_eq!(simulation.model_version, "mips-single-ex-v1");
    assert_eq!(simulation.statistics.cycles, 5);
    assert_eq!(simulation.statistics.retired, 1);
    assert_eq!(simulation.statistics.cpi, 5.0);
    let t = &simulation.trace;
    assert_eq!(t.iter().map(|c| c.number).collect::<Vec<_>>(), [1, 2, 3, 4, 5]);
    assert_eq!(t[0].fetch.as_ref().unwrap().id, 1);
    assert_eq!(t[1].pipeline_before.if_id.as_ref().unwrap().id, 1);
    assert_eq!(t[2].pipeline_before.id_ex.as_ref().unwrap().id, 1);
    assert_eq!(t[3].pipeline_before.ex_mem.as_ref().unwrap().id, 1);
    assert_eq!(t[4].pipeline_before.mem_wb.as_ref().unwrap().id, 1);
    assert_eq!((t[0].pc_before, t[0].pc_after), (0, 4));
    assert_eq!(t[2].ex_operands, Some([0, 7]));
    assert_eq!(t[2].ex_result, Some(7));
    assert!(t[..4].iter().all(|c| c.registers_after[8] == 0));
    assert_eq!((t[4].registers_before[8], t[4].registers_after[8]), (0, 7));
    let p = &t[4].pipeline_after;
    assert!(p.if_id.is_none() && p.id_ex.is_none() && p.ex_mem.is_none() && p.mem_wb.is_none());
}

#[test]
fn independent_instructions_and_explicit_nop_retire_in_order() {
    let simulation = completed(input("addi $t0, $zero, 1\nnop\naddi $t1, $zero, 2"));
    assert_eq!(simulation.statistics.cycles, 7);
    assert_eq!(simulation.statistics.retired, 3);
    assert_eq!(simulation.statistics.stalls, 0);
    assert_eq!(simulation.statistics.flushed, 0);
    assert!((simulation.statistics.cpi - 7.0 / 3.0).abs() < 1e-12);
    let retired = simulation.trace.iter().filter_map(|c| c.pipeline_before.mem_wb.as_ref().map(|s| s.id)).collect::<Vec<_>>();
    assert_eq!(retired, [1, 2, 3]);
}

#[test]
fn ex_mem_forwarding_takes_priority_over_older_mem_wb() {
    let simulation = completed(input("addi $t0, $zero, 1\naddi $t0, $zero, 2\nadd $t1, $t0, $t0"));
    let c = ex_at(&simulation, 8);
    assert_eq!((c.signals.forward_a.as_str(), c.signals.forward_b.as_str()), ("EX/MEM", "EX/MEM"));
    assert_eq!(c.ex_operands, Some([2, 2]));
    assert_eq!(last(&simulation).registers_after[9], 4);
    assert_eq!(simulation.statistics.forwarding, 2);
    assert_eq!(simulation.statistics.stalls, 0);
    assert!(c.active_paths.iter().any(|p| p == "forward-ex-a"));
    assert!(c.active_paths.iter().any(|p| p == "forward-ex-b"));
}

#[test]
fn mem_wb_forwards_both_ex_operands() {
    let simulation = completed(input("addi $t0, $zero, 9\nnop\nadd $t1, $t0, $t0"));
    let c = ex_at(&simulation, 8);
    assert_eq!((c.signals.forward_a.as_str(), c.signals.forward_b.as_str()), ("MEM/WB", "MEM/WB"));
    assert_eq!(c.ex_operands, Some([9, 9]));
    assert_eq!(last(&simulation).registers_after[9], 18);
    assert_eq!(simulation.statistics.forwarding, 2);
}

#[test]
fn wb_is_visible_to_id_in_the_same_cycle() {
    let simulation = completed(input("addi $t0, $zero, 9\nnop\nnop\nadd $t1, $t0, $t0"));
    let c = &simulation.trace[4];
    assert_eq!((c.registers_before[8], c.registers_after[8]), (0, 9));
    let decoded = c.pipeline_after.id_ex.as_ref().unwrap();
    assert_eq!((decoded.read_a, decoded.read_b), (9, 9));
    assert_eq!(ex_at(&simulation, 12).signals.forward_a, "Register");
    assert_eq!(last(&simulation).registers_after[9], 18);
    assert_eq!(simulation.statistics.forwarding, 0);
}

#[test]
fn load_use_freezes_pc_and_if_id_inserts_bubble_and_preserves_ids() {
    let mut data = input("lw $t0, 0($zero)\nadd $t1, $t0, $t0\nnop");
    data.memory.insert(0, 7);
    let simulation = completed(data);
    assert_eq!(simulation.statistics.stalls, 1);
    assert_eq!(simulation.statistics.cycles, 8);
    assert_eq!(simulation.statistics.retired, 3);
    let c = &simulation.trace[2];
    assert!(!c.signals.pc_write && !c.signals.if_id_write && c.signals.id_ex_flush);
    assert!(!c.signals.if_id_flush);
    assert_eq!(c.pc_before, c.pc_after);
    assert_eq!(c.pipeline_before.if_id.as_ref().unwrap().id, c.pipeline_after.if_id.as_ref().unwrap().id);
    assert!(c.pipeline_after.id_ex.is_none());
    assert_eq!(c.pipeline_after.ex_mem.as_ref().unwrap().instruction.op, "lw");
    assert_eq!(c.fetch.as_ref().unwrap().id, simulation.trace[3].fetch.as_ref().unwrap().id);
    let ex = ex_at(&simulation, 4);
    assert_eq!((ex.signals.forward_a.as_str(), ex.signals.forward_b.as_str()), ("MEM/WB", "MEM/WB"));
    assert_eq!(ex.ex_operands, Some([7, 7]));
    assert_eq!(last(&simulation).registers_after[9], 14);
}

#[test]
fn latest_load_value_replaces_older_alu_write() {
    let mut data = input("addi $t0, $zero, 99\nlw $t0, 0($zero)\nadd $t1, $t0, $t0");
    data.memory.insert(0, 7);
    let simulation = completed(data);
    assert_eq!(simulation.statistics.stalls, 1);
    assert_eq!(ex_at(&simulation, 8).ex_operands, Some([7, 7]));
    assert_eq!(last(&simulation).registers_after[9], 14);
}

#[test]
fn load_to_store_data_uses_mem_forwarding_without_a_stall() {
    let mut data = input("lw $t0, 0($zero)\nsw $t0, 4($zero)");
    data.memory.insert(0, 0x1234_5678);
    let simulation = completed(data);
    assert_eq!(simulation.statistics.stalls, 0);
    assert_eq!(simulation.statistics.cycles, 6);
    let ex = ex_at(&simulation, 4);
    assert_eq!(ex.signals.forward_b, "Register");
    let c = simulation.trace.iter().find(|c| c.signals.forward_store).unwrap();
    let change = c.memory_change.as_ref().unwrap();
    assert_eq!((change.address, change.before, change.after), (4, 0, 0x1234_5678));
    assert_eq!(last(&simulation).memory_after[1], 0x1234_5678);
    assert_eq!(simulation.statistics.forwarding, 1);
}

#[test]
fn load_to_store_base_stalls_even_when_store_data_is_independent() {
    let mut data = input("lw $t0, 0($zero)\nsw $t1, 0($t0)");
    data.memory.insert(0, 1020);
    data.registers.insert(9, 42);
    let simulation = completed(data);
    assert_eq!(simulation.statistics.stalls, 1);
    assert_eq!(ex_at(&simulation, 4).signals.forward_a, "MEM/WB");
    assert_eq!(last(&simulation).memory_after[255], 42);
}

#[test]
fn alu_to_store_forwards_data_in_ex_and_mem() {
    let simulation = completed(input("addi $t0, $zero, 17\nsw $t0, 0($zero)"));
    assert_eq!(ex_at(&simulation, 4).signals.forward_b, "EX/MEM");
    assert!(simulation.trace.iter().any(|c| c.signals.forward_store));
    assert_eq!(last(&simulation).memory_after[0], 17);
    assert_eq!(simulation.statistics.stalls, 0);
}

#[test]
fn zero_is_immutable_and_is_not_a_forwarding_or_stall_source() {
    let mut data = input("addi $zero, $zero, 9\nadd $t0, $zero, $zero\nlw $zero, 0($zero)\nadd $t1, $zero, $zero\nsw $zero, 4($zero)");
    data.memory.insert(0, 7);
    let simulation = completed(data);
    assert!(simulation.trace.iter().all(|c| c.registers_after[0] == 0));
    assert_eq!(&last(&simulation).registers_after[8..10], &[0, 0]);
    assert_eq!(last(&simulation).memory_after[1], 0);
    assert_eq!(simulation.statistics.stalls, 0);
    assert_eq!(simulation.statistics.forwarding, 0);
    assert_eq!(simulation.statistics.retired, 5);
}

#[test]
fn load_store_boundaries_offsets_and_memory_change() {
    let mut data = input("lw $t0, -4($t1)\nsw $t0, 1016($t1)\nlw $t2, 1020($zero)");
    data.registers.insert(9, 4);
    data.memory = BTreeMap::from([(0, 0x89ab_cdef), (1020, 99)]);
    let simulation = completed(data);
    let change = simulation.trace.iter().find_map(|c| c.memory_change.as_ref()).unwrap();
    assert_eq!((change.address, change.before, change.after), (1020, 99, 0x89ab_cdef));
    let c = last(&simulation);
    assert_eq!(c.memory_after.len(), 256);
    assert_eq!(c.memory_after[0], 0x89ab_cdef);
    assert_eq!(c.memory_after[255], 0x89ab_cdef);
    assert_eq!(c.registers_after[10], 0x89ab_cdef);
    assert!(c.memory_after[1..255].iter().all(|&v| v == 0));
}

#[test]
fn runtime_memory_faults_keep_a_partial_trace() {
    for source in ["lw $t0, 2($zero)", "sw $t0, 2($zero)",
        "lw $t0, 1024($zero)", "sw $t0, 1024($zero)", "lw $t0, -4($zero)"] {
        let simulation = simulate(input(source)).unwrap();
        assert_eq!(simulation.status, "error", "{source}");
        assert!(simulation.stop_reason.contains("MEM"));
        assert_eq!(simulation.statistics.cycles, 4);
        assert_eq!(simulation.statistics.retired, 0);
        assert!(last(&simulation).memory_change.is_none());
        assert!(last(&simulation).events.iter().any(|e| e.kind == "error"));
        assert!(last(&simulation).memory_after.iter().all(|&v| v == 0));
    }
}

#[test]
fn invalid_initial_settings_are_rejected_before_simulation() {
    for (index, value) in [(32, 0), (0, 1)] {
        let mut data = input("nop");
        data.registers.insert(index, value);
        assert!(simulate(data).is_err());
    }
    for address in [2, 1024, u32::MAX] {
        let mut data = input("nop");
        data.memory.insert(address, 1);
        assert!(simulate(data).is_err());
    }
    for limit in [0, 10001] {
        let mut data = input("nop");
        data.max_cycles = limit;
        assert!(simulate(data).unwrap_err().contains("cycle 上限"));
    }
    assert!(simulate(input("li $t0, 1")).is_err());
    let mut data = input("nop");
    data.source = format!("#{}\nnop", "x".repeat(262144));
    assert!(simulate(data).unwrap_err().contains("256 KiB"));
}

#[test]
fn maximum_source_size_and_cycle_limit_are_accepted() {
    let mut data = input("nop");
    data.source = format!("#{}\nnop", "x".repeat(262138));
    assert_eq!(data.source.len(), 262143);
    data.source.push('\n');
    data.max_cycles = 10000;
    assert_eq!(completed(data).statistics.cycles, 5);
}

#[test]
fn taken_branches_flush_two_instructions_without_a_delay_slot() {
    for (op, a, b) in [("beq", 5, 5), ("bne", 5, 6)] {
        let mut data = input(&format!("{op} $t0, $t1, target\naddi $s0, $zero, 99\nsw $t0, 0($zero)\ntarget: addi $s1, $zero, 42"));
        data.registers = BTreeMap::from([(8, a), (9, b)]);
        let simulation = completed(data);
        let c = ex_at(&simulation, 0);
        assert!(c.signals.branch_taken && c.signals.pc_write);
        assert!(c.signals.id_ex_flush && c.signals.if_id_flush);
        assert_eq!(c.signals.redirect, Some(12));
        assert_eq!(c.pc_after, 12);
        assert!(c.pipeline_after.if_id.is_none() && c.pipeline_after.id_ex.is_none());
        assert_eq!(simulation.trace[c.number].fetch.as_ref().unwrap().instruction.pc, 12);
        assert_eq!(simulation.statistics.flushed, 2);
        assert_eq!(simulation.statistics.retired, 2);
        assert_eq!(simulation.statistics.cycles, 8);
        assert_eq!(last(&simulation).registers_after[16], 0);
        assert_eq!(last(&simulation).registers_after[17], 42);
        assert_eq!(last(&simulation).memory_after[0], 0);
        let flushed = [c.pipeline_before.if_id.as_ref().unwrap().id, c.fetch.as_ref().unwrap().id];
        assert!(simulation.trace.iter().filter_map(|c| c.pipeline_before.mem_wb.as_ref())
            .all(|s| !flushed.contains(&s.id)));
    }
}

#[test]
fn untaken_branches_do_not_flush_or_skip_instructions() {
    for (op, a, b) in [("beq", 5, 6), ("bne", 5, 5)] {
        let mut data = input(&format!("{op} $t0, $t1, end\naddi $s0, $zero, 9\nend: nop"));
        data.registers = BTreeMap::from([(8, a), (9, b)]);
        let simulation = completed(data);
        assert!(!ex_at(&simulation, 0).signals.branch_taken);
        assert_eq!(ex_at(&simulation, 0).signals.redirect, None);
        assert_eq!(simulation.statistics.flushed, 0);
        assert_eq!(simulation.statistics.cycles, 7);
        assert_eq!(simulation.statistics.retired, 3);
        assert_eq!(last(&simulation).registers_after[16], 9);
    }
}

#[test]
fn branches_receive_forwarded_comparison_operands() {
    let simulation = completed(input("addi $t0, $zero, 5\naddi $t1, $zero, 5\nbeq $t0, $t1, end\naddi $s0, $zero, 99\nend: nop"));
    let c = ex_at(&simulation, 8);
    assert_eq!((c.signals.forward_a.as_str(), c.signals.forward_b.as_str()), ("MEM/WB", "EX/MEM"));
    assert_eq!(c.ex_operands, Some([5, 5]));
    assert!(c.signals.branch_taken);
    assert_eq!(last(&simulation).registers_after[16], 0);
}

#[test]
fn load_to_branch_stalls_before_comparing_the_loaded_value() {
    let mut data = input("lw $t0, 0($zero)\nbeq $t0, $zero, end\naddi $s0, $zero, 1\nend: nop");
    data.memory.insert(0, 7);
    let simulation = completed(data);
    assert_eq!(simulation.statistics.stalls, 1);
    let c = ex_at(&simulation, 4);
    assert_eq!(c.signals.forward_a, "MEM/WB");
    assert_eq!(c.ex_operands, Some([7, 0]));
    assert!(!c.signals.branch_taken);
    assert_eq!(last(&simulation).registers_after[16], 1);
}

#[test]
fn jump_and_link_returns_to_pc_plus_four() {
    let simulation = completed(input("addi $a0, $zero, 6\njal double\nsw $v0, 0($zero)\nj done\ndouble: add $v0, $a0, $a0\njr $ra\ndone: nop"));
    let c = last(&simulation);
    assert_eq!((c.registers_after[4], c.registers_after[2], c.registers_after[31]), (6, 12, 8));
    assert_eq!(c.memory_after[0], 12);
    assert_eq!(simulation.statistics.retired, 7);
    assert_eq!(ex_at(&simulation, 4).signals.redirect, Some(16));
    assert_eq!(ex_at(&simulation, 20).signals.redirect, Some(8));
}

#[test]
fn jump_has_no_delay_slot_and_can_target_program_end() {
    let simulation = completed(input("j end\naddi $t0, $zero, 99\nsw $t0, 0($zero)\nend:"));
    assert_eq!(simulation.statistics.retired, 1);
    assert_eq!(simulation.statistics.flushed, 2);
    assert_eq!(simulation.statistics.cycles, 5);
    assert_eq!(last(&simulation).registers_after[8], 0);
    assert_eq!(last(&simulation).memory_after[0], 0);
    assert_eq!(last(&simulation).pc_after, 12);
}

#[test]
fn jr_uses_alu_forwarding_and_load_use_stalls() {
    let simulation = completed(input("addi $t0, $zero, 12\njr $t0\naddi $s0, $zero, 99\nnop"));
    assert_eq!(ex_at(&simulation, 4).signals.forward_a, "EX/MEM");
    assert_eq!(last(&simulation).registers_after[16], 0);
    let mut data = input("lw $t0, 0($zero)\njr $t0\naddi $s0, $zero, 99\nnop");
    data.memory.insert(0, 12);
    let simulation = completed(data);
    assert_eq!(simulation.statistics.stalls, 1);
    assert_eq!(ex_at(&simulation, 4).signals.forward_a, "MEM/WB");
    assert_eq!(ex_at(&simulation, 4).signals.redirect, Some(12));
    assert_eq!(last(&simulation).registers_after[16], 0);
}

#[test]
fn redirect_discards_younger_load_and_dependent_instruction() {
    let simulation = completed(input("j end\nlw $t0, 0($zero)\nadd $t1, $t0, $t0\nend: nop"));
    let c = ex_at(&simulation, 0);
    assert!(c.signals.pc_write && c.signals.if_id_flush && c.signals.id_ex_flush);
    assert_eq!(simulation.statistics.stalls, 0);
    assert_eq!(simulation.statistics.flushed, 2);
    assert_eq!(simulation.statistics.retired, 2);
}

#[test]
fn invalid_jump_targets_stop_in_ex() {
    for source in ["j 8", "jal 8", "beq $zero, $zero, -2", "bne $t0, $zero, 4", "jr $t0"] {
        let mut data = input(source);
        data.registers.insert(8, 2);
        let simulation = simulate(data).unwrap();
        assert_eq!(simulation.status, "error", "{source}");
        assert!(simulation.stop_reason.contains("跳轉目標"));
        assert_eq!(simulation.statistics.cycles, 3);
        assert_eq!(simulation.statistics.retired, 0);
        assert_eq!(last(&simulation).registers_after[31], 0);
    }
    let mut data = input("jr $t0");
    data.registers.insert(8, 8);
    assert_eq!(simulate(data).unwrap().status, "error");
}

#[test]
fn loop_instances_have_distinct_ids_and_statistics_match_hand_count() {
    let simulation = completed(input("addi $t0, $zero, 5\naddi $s0, $zero, 0\nloop: add $s0, $s0, $t0\naddi $t0, $t0, -1\nbne $t0, $zero, loop\nsw $s0, 0($zero)"));
    assert_eq!(last(&simulation).registers_after[8], 0);
    assert_eq!(last(&simulation).registers_after[16], 15);
    assert_eq!(last(&simulation).memory_after[0], 15);
    // 2 initial + 5 * 3 loop + 1 store; 4 taken branches cost 2 cycles each.
    assert_eq!(simulation.statistics.retired, 18);
    assert_eq!(simulation.statistics.cycles, 30);
    assert_eq!(simulation.statistics.stalls, 0);
    // Only the store is in ID; IF is already past program end on each taken branch.
    assert_eq!(simulation.statistics.flushed, 4);
    assert!((simulation.statistics.cpi - 30.0 / 18.0).abs() < 1e-12);
    let loop_ids = simulation.trace.iter().filter_map(|c| c.pipeline_before.mem_wb.as_ref())
        .filter(|s| s.instruction.pc == 8).map(|s| s.id).collect::<BTreeSet<_>>();
    assert_eq!(loop_ids.len(), 5);
}

#[test]
fn cycle_limit_keeps_partial_state_and_zero_retired_cpi_is_zero() {
    let mut data = input("addi $t0, $zero, 9");
    data.max_cycles = 1;
    let simulation = simulate(data).unwrap();
    assert_eq!(simulation.status, "limit");
    assert_eq!(simulation.statistics.cycles, 1);
    assert_eq!(simulation.statistics.retired, 0);
    assert_eq!(simulation.statistics.cpi, 0.0);
    assert_eq!(last(&simulation).registers_after[8], 0);
    assert!(last(&simulation).pipeline_after.if_id.is_some());
    let mut data = input("loop: j loop");
    data.max_cycles = 20;
    let simulation = simulate(data).unwrap();
    assert_eq!(simulation.status, "limit");
    assert_eq!(simulation.trace.len(), 20);
    assert!(simulation.stop_reason.contains("20 cycles"));
    assert_eq!(simulation.statistics.retired, 6);
    let mut data = input("nop");
    data.max_cycles = 5;
    assert_eq!(completed(data).statistics.retired, 1);
}

#[test]
fn ex_fault_preserves_older_wb_and_mem_side_effects_in_the_same_cycle() {
    let mut data = input("addi $s0, $zero, 7\nsw $t1, 0($zero)\nadd $t0, $t2, $t3\naddi $s1, $zero, 99");
    data.registers = BTreeMap::from([(9, 42), (10, 0x7fff_ffff), (11, 1)]);
    let simulation = simulate(data).unwrap();
    assert_eq!(simulation.status, "error");
    assert_eq!(simulation.statistics.cycles, 5);
    assert_eq!(simulation.statistics.retired, 1);
    let c = last(&simulation);
    assert_eq!((c.registers_before[16], c.registers_after[16]), (0, 7));
    assert_eq!(c.memory_after[0], 42);
    assert_eq!(c.memory_change.as_ref().unwrap().after, 42);
    assert_eq!(c.registers_after[8], 0);
    assert_eq!(c.registers_after[17], 0);
    assert!(!c.signals.pc_write);
}
