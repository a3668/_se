import { describe, expect, it } from "vitest";

import { parseChoices } from "../app/lib/parse-choices";

describe("parseChoices", () => {
	it("拆出題幹與大寫字母選項", () => {
		const { stem, options } = parseChoices("Which is true?\n\n(A) one\n(B) two");
		expect(stem).toBe("Which is true?");
		expect(options).toEqual([
			{ key: "A", label: "(A)", text: "one" },
			{ key: "B", label: "(B)", text: "two" },
		]);
	});

	it("小寫選項保留原標記,key 轉成大寫", () => {
		const { options } = parseChoices("Q\n(a) x\n(b) y");
		expect(options.map((o) => [o.key, o.label])).toEqual([
			["A", "(a)"],
			["B", "(b)"],
		]);
	});

	it("支援數字選項", () => {
		const { options } = parseChoices("Q\n(1) x\n(2) y\n(3) z");
		expect(options.map((o) => o.key)).toEqual(["1", "2", "3"]);
	});

	it("選項後的接續行併入上一個選項", () => {
		const { options } = parseChoices("Q\n(A) first\n   line two\n(B) second");
		expect(options[0].text).toBe("first line two");
	});

	it("程式碼區塊內像選項的行不算選項", () => {
		const content = "Q\n```\n(A) not an option\n```\n(A) real\n(B) also real";
		const { stem, options } = parseChoices(content);
		expect(stem).toContain("(A) not an option");
		expect(options.map((o) => o.text)).toEqual(["real", "also real"]);
	});

	it("沒有選項時整段都是題幹", () => {
		expect(parseChoices("Explain deadlock.")).toEqual({ stem: "Explain deadlock.", options: [] });
	});
});
