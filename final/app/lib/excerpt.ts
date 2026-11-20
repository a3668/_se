export type Segment = { text: string; hit: boolean };

/** 粗略去掉 Markdown 標記,讓摘要以純文字顯示 */
export function toPlainText(markdown: string): string {
	return markdown
		.replace(/^\s*```.*$/gm, " ")
		.replace(/\\([\\`*_{}[\]()#+\-.!])/g, "$1")
		.replace(/[*`#>]+/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function escapeRegExp(text: string) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 從文字中擷取第一個命中關鍵字附近的片段,並切成「一般文字 / 命中」區段。
 * 沒有命中時回傳開頭的片段。比對不分大小寫。
 */
export function excerpt(text: string, terms: string[], radius = 60): Segment[] {
	const plain = toPlainText(text);
	const words = terms.filter(Boolean).sort((a, b) => b.length - a.length);
	const pattern = words.length ? new RegExp(words.map(escapeRegExp).join("|"), "gi") : null;

	const first = pattern ? plain.search(pattern) : -1;
	const start = first > radius ? first - radius : 0;
	const end = Math.min(plain.length, (first >= 0 ? first : 0) + radius * 2);
	const window = plain.slice(start, end);

	const segments: Segment[] = [];
	if (start > 0) segments.push({ text: "…", hit: false });

	let last = 0;
	if (pattern) {
		for (const m of window.matchAll(pattern)) {
			if (m.index > last) segments.push({ text: window.slice(last, m.index), hit: false });
			segments.push({ text: m[0], hit: true });
			last = m.index + m[0].length;
		}
	}
	if (last < window.length) segments.push({ text: window.slice(last), hit: false });
	if (end < plain.length) segments.push({ text: "…", hit: false });

	return segments;
}
