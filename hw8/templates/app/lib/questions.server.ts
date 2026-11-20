import type {
	ChapterSummary,
	Question,
	QuestionFilters,
} from "../types/question";

const QUESTION_COLUMNS = `id, chapter, number, type, content, answer, correct`;

export async function listChapters(db: D1Database) {
	const result = await db
		.prepare(
			`SELECT chapter,
			        COUNT(*) AS total,
			        COUNT(COALESCE(correct, answer)) AS answered
			 FROM questions
			 GROUP BY chapter
			 ORDER BY MIN(id) ASC`,
		)
		.all<ChapterSummary>();

	return result.results;
}

export async function listQuestions(db: D1Database, filters: QuestionFilters) {
	const where: string[] = [];
	const params: (string | number)[] = [];

	if (filters.chapter) {
		where.push("chapter = ?");
		params.push(filters.chapter);
	}
	if (filters.type) {
		where.push("type = ?");
		params.push(filters.type);
	}
	if (filters.q) {
		// 跳脫 LIKE 的萬用字元,讓使用者輸入的 % 和 _ 被當成一般文字
		const escaped = filters.q.replace(/[\\%_]/g, (c) => `\\${c}`);
		where.push("content LIKE ? ESCAPE '\\'");
		params.push(`%${escaped}%`);
	}

	const result = await db
		.prepare(
			`SELECT ${QUESTION_COLUMNS}
			 FROM questions
			 ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
			 ORDER BY id ASC`,
		)
		.bind(...params)
		.all<Question>();

	return result.results;
}

export async function getQuestion(db: D1Database, id: number) {
	return db
		.prepare(`SELECT ${QUESTION_COLUMNS} FROM questions WHERE id = ?`)
		.bind(id)
		.first<Question>();
}

/** 同章節的上一題、下一題,用於題目頁的導覽 */
export async function getAdjacentQuestions(db: D1Database, question: Question) {
	const [prev, next] = await db.batch<{ id: number; number: number }>([
		db
			.prepare(
				`SELECT id, number FROM questions
				 WHERE chapter = ? AND id < ?
				 ORDER BY id DESC LIMIT 1`,
			)
			.bind(question.chapter, question.id),
		db
			.prepare(
				`SELECT id, number FROM questions
				 WHERE chapter = ? AND id > ?
				 ORDER BY id ASC LIMIT 1`,
			)
			.bind(question.chapter, question.id),
	]);

	return {
		prev: prev.results[0] ?? null,
		next: next.results[0] ?? null,
	};
}
