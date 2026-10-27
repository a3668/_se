use mips_pipeline_lab::assembler::{assemble, register, Instruction};

fn one(source: &str) -> Instruction {
    let mut instructions = assemble(source).expect(source);
    assert_eq!(instructions.len(), 1, "{source}");
    instructions.remove(0)
}

fn flags(i: &Instruction) -> Vec<&str> {
    let c = &i.control;
    [
        ("RegDst", c.reg_dst), ("ALUSrc", c.alu_src),
        ("MemToReg", c.mem_to_reg), ("RegWrite", c.reg_write),
        ("MemRead", c.mem_read), ("MemWrite", c.mem_write),
        ("Branch", c.branch), ("Jump", c.jump),
    ].into_iter().filter_map(|(name, active)| active.then_some(name)).collect()
}

#[test]
fn register_names_numbers_and_aliases() {
    let names = ["zero", "at", "v0", "v1", "a0", "a1", "a2", "a3",
        "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7",
        "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7",
        "t8", "t9", "k0", "k1", "gp", "sp", "fp", "ra"];
    for (index, name) in names.iter().enumerate() {
        for spelling in [name.to_string(), format!("${name}"), index.to_string(), format!("${index}")] {
            assert_eq!(register(&spelling).unwrap(), index, "{spelling}");
        }
    }
    assert_eq!(register(" $T0 ").unwrap(), 8);
    assert_eq!(register("$s8").unwrap(), 30);
    for invalid in ["", "$32", "-1", "$unknown"] {
        assert!(register(invalid).is_err(), "{invalid}");
    }
}

#[test]
fn r_type_encodings_and_control_signals() {
    // Fixed encodings: rs=$t1(9), rt=$t2(10), rd=$t0(8).
    for (op, machine_code) in [
        ("add", 0x012a4020), ("addu", 0x012a4021),
        ("sub", 0x012a4022), ("subu", 0x012a4023),
        ("and", 0x012a4024), ("or", 0x012a4025),
        ("xor", 0x012a4026), ("nor", 0x012a4027),
        ("slt", 0x012a402a), ("sltu", 0x012a402b),
    ] {
        let i = one(&format!("{op} $t0, $t1, $t2"));
        assert_eq!(i.machine_code, machine_code, "{op}");
        assert_eq!((i.rs, i.rt, i.rd, i.destination), (9, 10, 8, Some(8)), "{op}");
        assert_eq!((i.reads_rs_ex, i.reads_rt_ex), (true, true), "{op}");
        assert_eq!(flags(&i), ["RegDst", "RegWrite"], "{op}");
        assert_eq!(i.control.alu_op, op);
    }
}

#[test]
fn immediate_encodings_and_control_signals() {
    for (source, machine_code, immediate) in [
        ("addi $t0, $t1, -1", 0x2128ffff, -1),
        ("addiu $t0, $t1, -1", 0x2528ffff, -1),
        ("slti $t0, $t1, -1", 0x2928ffff, -1),
        ("sltiu $t0, $t1, -1", 0x2d28ffff, -1),
        ("andi $t0, $t1, 0xFFFF", 0x3128ffff, 65535),
        ("ori $t0, $t1, 0xFFFF", 0x3528ffff, 65535),
        ("xori $t0, $t1, 0xFFFF", 0x3928ffff, 65535),
    ] {
        let i = one(source);
        assert_eq!(i.machine_code, machine_code, "{source}");
        assert_eq!((i.rs, i.rt, i.immediate, i.destination), (9, 8, immediate, Some(8)));
        assert_eq!((i.reads_rs_ex, i.reads_rt_ex), (true, false));
        assert_eq!(flags(&i), ["ALUSrc", "RegWrite"]);
        assert_eq!(i.control.alu_op, i.op);
    }
    let i = one("lui $t0, 0x1234");
    assert_eq!(i.machine_code, 0x3c081234);
    assert_eq!((i.immediate, i.destination), (0x1234, Some(8)));
    assert_eq!((i.reads_rs_ex, i.reads_rt_ex), (false, false));
    assert_eq!(flags(&i), ["ALUSrc", "RegWrite"]);
    assert_eq!(i.control.alu_op, "lui");
}

#[test]
fn shifts_encode_shamt_and_only_read_rt() {
    for (op, machine_code) in [("sll", 0x000940c0), ("srl", 0x000940c2), ("sra", 0x000940c3)] {
        let i = one(&format!("{op} $t0, $t1, 3"));
        assert_eq!(i.machine_code, machine_code);
        assert_eq!((i.rt, i.rd, i.shamt, i.destination), (9, 8, 3, Some(8)));
        assert_eq!((i.reads_rs_ex, i.reads_rt_ex), (false, true));
        assert_eq!(flags(&i), ["RegDst", "RegWrite"]);
        assert_eq!(i.control.alu_op, op);
    }
    assert_eq!(one("sll $t0, $t1, 0").shamt, 0);
    assert_eq!(one("sll $t0, $t1, 31").shamt, 31);
}

#[test]
fn memory_encodings_and_operand_usage() {
    let load = one("lw $t0, -4($t1)");
    assert_eq!(load.machine_code, 0x8d28fffc);
    assert_eq!((load.rs, load.rt, load.immediate, load.destination), (9, 8, -4, Some(8)));
    assert_eq!((load.reads_rs_ex, load.reads_rt_ex), (true, false));
    assert_eq!(flags(&load), ["ALUSrc", "MemToReg", "RegWrite", "MemRead"]);
    assert_eq!(load.control.alu_op, "add");
    let store = one("sw $t0, -4($t1)");
    assert_eq!(store.machine_code, 0xad28fffc);
    assert_eq!((store.rs, store.rt, store.immediate, store.destination), (9, 8, -4, None));
    assert_eq!((store.reads_rs_ex, store.reads_rt_ex), (true, false));
    assert_eq!(flags(&store), ["ALUSrc", "MemWrite"]);
    assert_eq!(store.control.alu_op, "add");
}

#[test]
fn branch_and_jump_encodings_and_control_signals() {
    for (op, machine_code) in [("beq", 0x11090001), ("bne", 0x15090001)] {
        let i = one(&format!("{op} $t0, $t1, 1"));
        assert_eq!(i.machine_code, machine_code);
        assert_eq!((i.rs, i.rt, i.immediate, i.target), (8, 9, 1, 8));
        assert_eq!((i.reads_rs_ex, i.reads_rt_ex), (true, true));
        assert_eq!(i.destination, None);
        assert_eq!(flags(&i), ["Branch"]);
        assert_eq!(i.control.alu_op, op);
    }
    for (source, code, destination, control) in [
        ("j 8", 0x08000002, None, vec!["Jump"]),
        ("jal 8", 0x0c000002, Some(31), vec!["RegWrite", "Jump"]),
    ] {
        let i = one(source);
        assert_eq!((i.machine_code, i.target, i.destination), (code, 8, destination));
        assert_eq!((i.reads_rs_ex, i.reads_rt_ex), (false, false));
        assert_eq!(flags(&i), control);
        assert_eq!(i.control.alu_op, i.op);
    }
    let i = one("jr $t0");
    assert_eq!((i.machine_code, i.rs, i.destination), (0x01000008, 8, None));
    assert_eq!((i.reads_rs_ex, i.reads_rt_ex), (true, false));
    assert_eq!(flags(&i), ["Jump"]);
    assert_eq!(i.control.alu_op, "jr");
}

#[test]
fn nop_has_no_side_effect_control_signals() {
    let i = one("nop");
    assert_eq!(i.machine_code, 0);
    assert_eq!(i.destination, None);
    assert_eq!((i.reads_rs_ex, i.reads_rt_ex), (false, false));
    assert!(flags(&i).is_empty());
}

#[test]
fn labels_comments_text_and_source_line_numbers() {
    let instructions = assemble("# heading\n.text\nstart: ADDI $8, $0, 1 ; comment\nbeq $8, $0, end\nbne $8, $0, start\nj end\nend:\nnop").unwrap();
    assert_eq!(instructions.iter().map(|i| (i.pc, i.line)).collect::<Vec<_>>(),
        [(0, 3), (4, 4), (8, 5), (12, 6), (16, 8)]);
    assert_eq!(instructions[0].op, "addi");
    assert_eq!((instructions[1].immediate, instructions[1].target), (2, 16));
    assert_eq!((instructions[2].immediate, instructions[2].target), (-3, 0));
    assert_eq!(instructions[3].target, 16);
    assert_eq!(assemble("a: b: nop\nj a\nj b").unwrap()[2].target, 0);
    assert_eq!(assemble("j end\nend:").unwrap()[0].target, 4);
}

#[test]
fn numeric_branch_offsets_are_words_and_jump_addresses_are_bytes() {
    assert_eq!(one("beq $zero, $zero, -1").target, 0);
    assert_eq!(one("bne $zero, $t0, 2").target, 12);
    assert_eq!(one("j 0x10").target, 16);
}

#[test]
fn immediate_boundaries_and_hex_sign_extension() {
    for op in ["addi", "addiu", "slti", "sltiu"] {
        for (literal, value) in [("-32768", -32768), ("32767", 32767), ("0x8000", -32768), ("0xFFFF", -1)] {
            assert_eq!(one(&format!("{op} $t0, $t1, {literal}")).immediate, value);
        }
    }
    for op in ["andi", "ori", "xori"] {
        assert_eq!(one(&format!("{op} $t0, $t1, 0")).immediate, 0);
        assert_eq!(one(&format!("{op} $t0, $t1, 65535")).immediate, 65535);
    }
    assert_eq!(one("lui $t0, 65535").immediate, 65535);
    assert_eq!(one("beq $zero, $zero, -32768").immediate, -32768);
    assert_eq!(one("beq $zero, $zero, 32767").immediate, 32767);
    assert_eq!(one("lw $t0, -32768($zero)").immediate, -32768);
    assert_eq!(one("sw $t0, 32767($zero)").immediate, 32767);
}

#[test]
fn invalid_sources_are_rejected_with_relevant_errors() {
    for (source, message) in [
        ("", "至少一條"), ("# only comment\n.text", "至少一條"),
        ("x: nop\nx: nop", "重複標籤"), ("1bad: nop", "無效標籤"),
        (".data", "只支援 .text"), ("li $t0, 1", "不支援指令"),
        ("move $t0, $t1", "不支援指令"), ("b label", "不支援指令"),
        ("add $t0, $t1", "需要 3 個運算元"), ("nop 1", "需要 0 個運算元"),
        ("addi $32, $zero, 1", "未知暫存器"),
        ("addi $t0, $zero, abc", "無效數值"),
        ("addi $t0, $zero, 32768", "帶符號立即數"),
        ("addi $t0, $zero, -32769", "帶符號立即數"),
        ("andi $t0, $zero, -1", "立即數須介於"),
        ("ori $t0, $zero, 65536", "立即數須介於"),
        ("lui $t0, 65536", "立即數須介於"),
        ("sll $t0, $t1, -1", "位移量"), ("srl $t0, $t1, 32", "位移量"),
        ("j 2", "4-byte 對齊"), ("jal -4", "4-byte 對齊"),
        ("j 0x10000000", "4-byte 對齊"),
        ("beq $zero, $zero, missing", "無效數值"),
    ] {
        let error = assemble(source).expect_err(source);
        assert!(error.contains(message), "{source}: {error}");
    }
    assert!(assemble("nop\naddi $t0, $zero, bad").unwrap_err().contains("第 2 行"));
}

#[test]
fn punctuation_only_program_is_rejected() {
    assert!(assemble(",()").is_err());
}

#[test]
fn static_instruction_limit_allows_twenty_but_rejects_twenty_one() {
    assert_eq!(assemble(&"nop\n".repeat(20)).unwrap().len(), 20);
    assert!(assemble(&"nop\n".repeat(21)).unwrap_err().contains("20 條"));
}
