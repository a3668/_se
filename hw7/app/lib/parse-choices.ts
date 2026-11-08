export type ChoiceOption = {
	/** 正規化後的大寫字母,用於比對答案 */
	key: string;
	/** 原始標記,保留大小寫顯示,例如 "(a)" */
	label: string;
	text: string;
};

export type ParsedChoices = {
	stem: string;
	options: ChoiceOption[];
};

/** 選項行:"(A) ..."、"(a) ..." 或 "(1) ..." */
const OPTION_LINE = /^\s*\(([A-Ea-e1-9])\)\s*(.+)$/;
const CODE_FENCE = /^\s*```/;

/** 把題目內容拆成題幹與選項:選項是以 "(A) ..." 開頭的獨立行;程式碼區塊內的行不視為選項 */
export function parseChoices(content: string): ParsedChoices {
	const stemLines: string[] = [];
	const options: ChoiceOption[] = [];
	let inCode = false;

	for (const line of content.split("\n")) {
		if (CODE_FENCE.test(line)) inCode = !inCode;
		const match = inCode || CODE_FENCE.test(line) ? null : OPTION_LINE.exec(line);
		if (match) {
			options.push({
				key: match[1].toUpperCase(),
				label: `(${match[1]})`,
				text: match[2].trim(),
			});
		} else if (options.length === 0) {
			stemLines.push(line);
		} else if (line.trim()) {
			// 選項之後的非空行接到上一個選項
			options[options.length - 1].text += ` ${line.trim()}`;
		}
	}

	return { stem: stemLines.join("\n").trim(), options };
}
