import { describe, expect, it } from "vitest";

import { answerKeys, isCorrect } from "../app/lib/grading";

describe("answerKeys", () => {
	it("拆成大寫代號集合", () => {
		expect([...answerKeys("acd")]).toEqual(["A", "C", "D"]);
		expect([...answerKeys("245")]).toEqual(["2", "4", "5"]);
	});

	it("忽略分隔符號", () => {
		expect([...answerKeys("A, C")]).toEqual(["A", "C"]);
	});
});

describe("isCorrect", () => {
	it("單選題完全相同才對", () => {
		expect(isCorrect(["B"], "B")).toBe(true);
		expect(isCorrect(["A"], "B")).toBe(false);
	});

	it("複選題順序不影響結果", () => {
		expect(isCorrect(["D", "A", "C"], "ACD")).toBe(true);
	});

	it("複選題少選或多選都算錯", () => {
		expect(isCorrect(["A", "C"], "ACD")).toBe(false);
		expect(isCorrect(["A", "B", "C", "D"], "ACD")).toBe(false);
	});

	it("比對不分大小寫", () => {
		expect(isCorrect(["t"], "T")).toBe(true);
	});

	it("沒有作答算錯", () => {
		expect(isCorrect([], "A")).toBe(false);
	});
});
