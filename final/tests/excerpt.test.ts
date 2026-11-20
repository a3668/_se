import { describe, expect, it } from "vitest";

import { excerpt, toPlainText } from "../app/lib/excerpt";

const joined = (segments: { text: string }[]) => segments.map((s) => s.text).join("");
const hits = (segments: { text: string; hit: boolean }[]) =>
	segments.filter((s) => s.hit).map((s) => s.text);

describe("toPlainText", () => {
	it("去掉 Markdown 標記並合併空白", () => {
		expect(toPlainText("**粗體** and `code`\n\n```c\nint x;\n```")).toBe("粗體 and code int x;");
	});

	it("還原跳脫字元", () => {
		expect(toPlainText("A \\_\\_\\_ is")).toBe("A ___ is");
	});
});

describe("excerpt", () => {
	it("標示所有命中的關鍵字,不分大小寫", () => {
		const segments = excerpt("Semaphore and semaphore", ["semaphore"]);
		expect(hits(segments)).toEqual(["Semaphore", "semaphore"]);
		expect(joined(segments)).toBe("Semaphore and semaphore");
	});

	it("長文從命中位置附近擷取並加上省略號", () => {
		const text = `${"x".repeat(200)} deadlock ${"y".repeat(200)}`;
		const segments = excerpt(text, ["deadlock"], 20);
		expect(segments[0].text).toBe("…");
		expect(segments.at(-1)?.text).toBe("…");
		expect(hits(segments)).toEqual(["deadlock"]);
	});

	it("沒有命中時回傳開頭片段", () => {
		const segments = excerpt("hello world", ["zzz"]);
		expect(joined(segments)).toBe("hello world");
		expect(hits(segments)).toEqual([]);
	});

	it("關鍵字中的正規表示式符號被當成一般文字", () => {
		expect(hits(excerpt("call wait(S) now", ["wait(S)"]))).toEqual(["wait(S)"]);
	});
});
