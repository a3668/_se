/** 把標準答案字串(如 "acd"、"245"、"T")轉成選項代號集合 */
export function answerKeys(correct: string): Set<string> {
	return new Set(correct.toUpperCase().replace(/[^A-Z0-9]/g, "").split("").filter(Boolean));
}

/** 選取的選項要和標準答案完全相同才算對(複選題不給部分分數) */
export function isCorrect(selected: Iterable<string>, correct: string): boolean {
	const expected = answerKeys(correct);
	const actual = new Set([...selected].map((k) => k.toUpperCase()));
	return actual.size === expected.size && [...actual].every((k) => expected.has(k));
}
