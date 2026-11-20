/** trigram 斷詞至少要 3 個字元才查得到,較短的詞改用 LIKE */
export const MIN_FTS_LENGTH = 3;
const MAX_QUERY_LENGTH = 100;
const MAX_TERMS = 5;

export type SearchPlan = {
	/** 使用者輸入拆出來的關鍵字,用於畫面上的標示 */
	terms: string[];
	/** FTS5 MATCH 運算式;沒有夠長的詞時為 null */
	match: string | null;
	/** 短關鍵字的 LIKE 樣式(已跳脫 % _ \) */
	likes: string[];
};

/** 以空白分隔多個關鍵字,全部都要出現(AND) */
export function parseSearch(input: string): SearchPlan {
	const terms = [
		...new Set(input.slice(0, MAX_QUERY_LENGTH).trim().split(/\s+/).filter(Boolean)),
	].slice(0, MAX_TERMS);

	const phrases: string[] = [];
	const likes: string[] = [];

	for (const term of terms) {
		if ([...term].length >= MIN_FTS_LENGTH) {
			// 用雙引號包成片語,FTS5 的運算子(AND、OR、*、- 等)就會被當成一般文字
			phrases.push(`"${term.replaceAll('"', '""')}"`);
		} else {
			likes.push(`%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
		}
	}

	return { terms, match: phrases.length ? phrases.join(" AND ") : null, likes };
}
