import { describe, expect, it } from "vitest";

import { parseSearch } from "../app/lib/search";

describe("parseSearch", () => {
	it("空字串沒有任何條件", () => {
		expect(parseSearch("   ")).toEqual({ terms: [], match: null, likes: [] });
	});

	it("3 個字元以上用 FTS 片語,多個詞以 AND 連接", () => {
		const plan = parseSearch("semaphore  mutex");
		expect(plan.terms).toEqual(["semaphore", "mutex"]);
		expect(plan.match).toBe('"semaphore" AND "mutex"');
		expect(plan.likes).toEqual([]);
	});

	it("中文以字數計算長度", () => {
		expect(parseSearch("臨界區").match).toBe('"臨界區"');
		expect(parseSearch("死結").likes).toEqual(["%死結%"]);
	});

	it("短關鍵字改用 LIKE 並跳脫萬用字元", () => {
		expect(parseSearch("a%").likes).toEqual(["%a\\%%"]);
		expect(parseSearch("_").likes).toEqual(["%\\_%"]);
	});

	it("FTS 運算子與雙引號被當成一般文字", () => {
		expect(parseSearch('say "hi" OR').match).toBe('"say" AND """hi"""');
		expect(parseSearch('say "hi" OR').likes).toEqual(["%OR%"]);
		expect(parseSearch("NOT*").match).toBe('"NOT*"');
	});

	it("重複的詞只保留一次,最多 5 個", () => {
		expect(parseSearch("aaa aaa").terms).toEqual(["aaa"]);
		expect(parseSearch("a1 b2 c3 d4 e5 f6 g7").terms).toHaveLength(5);
	});
});
