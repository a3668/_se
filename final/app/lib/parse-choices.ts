export type ChoiceOption = {
	/** 正規化後的代號(大寫字母或數字),用來比對答案 */
	key: string;
	/** 原始標記,保留原本大小寫,例如 "(a)" */
	label: string;
	text: string;
};

export type ParsedChoices = {
	stem: string;
	options: ChoiceOption[];
};

/** 選項行:"(A) ..."、"(a) ..." 或 "(1) ..." */
const OPTION_LINE = /^\s*\(([A-Za-z]|[1-9])\)\s*(.+)$/;
const CODE_FENCE = /^\s*```/;

/**
 * 把題目內容拆成題幹與選項。
 * 選項是以 "(A) ..." 開頭的獨立行;程式碼區塊內的行不算選項;
 * 選項後面的非空行視為上一個選項的延續。
 */
export function parseChoices(content: string): ParsedChoices {
	const stemLines: string[] = [];
	const options: ChoiceOption[] = [];
	let inCode = false;

	for (const line of content.split("\n")) {
		const isFence = CODE_FENCE.test(line);
		if (isFence) inCode = !inCode;

		const match = inCode || isFence ? null : OPTION_LINE.exec(line);
		if (match) {
			options.push({
				key: match[1].toUpperCase(),
				label: `(${match[1]})`,
				text: match[2].trim(),
			});
		} else if (options.length === 0) {
			stemLines.push(line);
		} else if (line.trim()) {
			options[options.length - 1].text += ` ${line.trim()}`;
		}
	}

	return { stem: stemLines.join("\n").trim(), options };
}
