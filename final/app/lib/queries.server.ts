import { PAGE_SIZE } from "./pagination";
import { parseSearch } from "./search";
import type {
	ChapterSummary,
	Course,
	CourseSummary,
	Question,
	QuestionFilters,
} from "./types";

const QUESTION_COLUMNS = `
	q.id,
	q.chapter_id AS chapterId,
	ch.title     AS chapterTitle,
	q.number,
	q.type,
	q.content,
	q.answer,
	q.correct`;

/** 題目在章節內的順序;章節之間依 chapters.sort_order */
const QUESTION_ORDER = `ch.sort_order, ch.id, q.number, q.id`;

export async function listCourses(db: D1Database) {
	const result = await db
		.prepare(
			`SELECT c.id, c.slug, c.name, c.description,
			        COUNT(DISTINCT ch.id) AS chapters,
			        COUNT(q.id)           AS questions
			 FROM courses c
			 LEFT JOIN chapters ch ON ch.course_id = c.id
			 LEFT JOIN questions q ON q.chapter_id = ch.id
			 GROUP BY c.id
			 ORDER BY c.sort_order, c.id`,
		)
		.all<CourseSummary>();
	return result.results;
}

export async function getCourse(db: D1Database, slug: string) {
	return db
		.prepare(`SELECT id, slug, name, description FROM courses WHERE slug = ?`)
		.bind(slug)
		.first<Course>();
}

export async function listChapters(db: D1Database, courseId: number) {
	const result = await db
		.prepare(
			`SELECT ch.id, ch.title,
			        COUNT(q.id)        AS total,
			        COUNT(q.correct)   AS quizzable,
			        COUNT(q.answer)    AS withAnswer
			 FROM chapters ch
			 LEFT JOIN questions q ON q.chapter_id = ch.id
			 WHERE ch.course_id = ?
			 GROUP BY ch.id
			 ORDER BY ch.sort_order, ch.id`,
		)
		.bind(courseId)
		.all<ChapterSummary>();
	return result.results;
}

/** 依章節、題型、關鍵字篩選題目並分頁,回傳該頁題目與符合條件的總數 */
export async function searchQuestions(
	db: D1Database,
	courseId: number,
	filters: QuestionFilters,
) {
	const where = ["ch.course_id = ?"];
	const params: (string | number)[] = [courseId];

	if (filters.chapterId) {
		where.push("q.chapter_id = ?");
		params.push(filters.chapterId);
	}
	if (filters.type) {
		where.push("q.type = ?");
		params.push(filters.type);
	}

	const search = parseSearch(filters.q ?? "");
	if (search.match) {
		where.push("q.id IN (SELECT rowid FROM questions_fts WHERE questions_fts MATCH ?)");
		params.push(search.match);
	}
	for (const like of search.likes) {
		where.push("(q.content LIKE ? ESCAPE '\\' OR q.answer LIKE ? ESCAPE '\\')");
		params.push(like, like);
	}

	const from = `FROM questions q JOIN chapters ch ON ch.id = q.chapter_id
	              WHERE ${where.join(" AND ")}`;
	const offset = (filters.page - 1) * PAGE_SIZE;

	const [count, rows] = await db.batch([
		db.prepare(`SELECT COUNT(*) AS total ${from}`).bind(...params),
		db
			.prepare(`SELECT ${QUESTION_COLUMNS} ${from} ORDER BY ${QUESTION_ORDER} LIMIT ? OFFSET ?`)
			.bind(...params, PAGE_SIZE, offset),
	]);

	return {
		total: (count.results[0] as { total: number }).total,
		questions: rows.results as Question[],
		terms: search.terms,
	};
}

export async function getQuestion(db: D1Database, courseId: number, id: number) {
	return db
		.prepare(
			`SELECT ${QUESTION_COLUMNS}
			 FROM questions q JOIN chapters ch ON ch.id = q.chapter_id
			 WHERE q.id = ? AND ch.course_id = ?`,
		)
		.bind(id, courseId)
		.first<Question>();
}

type QuestionLink = { id: number; number: number };

/** 同章節的上一題、下一題(依題號排序,同題號再依 id) */
export async function getAdjacentQuestions(db: D1Database, question: Question) {
	const [prev, next] = await db.batch<QuestionLink>([
		db
			.prepare(
				`SELECT id, number FROM questions
				 WHERE chapter_id = ? AND (number, id) < (?, ?)
				 ORDER BY number DESC, id DESC LIMIT 1`,
			)
			.bind(question.chapterId, question.number, question.id),
		db
			.prepare(
				`SELECT id, number FROM questions
				 WHERE chapter_id = ? AND (number, id) > (?, ?)
				 ORDER BY number ASC, id ASC LIMIT 1`,
			)
			.bind(question.chapterId, question.number, question.id),
	]);

	return {
		prev: prev.results[0] ?? null,
		next: next.results[0] ?? null,
	};
}

/** 隨機挑一題;可限定章節,並可排除目前這題 */
export async function randomQuestionId(
	db: D1Database,
	courseId: number,
	options: { chapterId?: number; excludeId?: number } = {},
) {
	const where = ["ch.course_id = ?"];
	const params: number[] = [courseId];
	if (options.chapterId) {
		where.push("q.chapter_id = ?");
		params.push(options.chapterId);
	}
	if (options.excludeId) {
		where.push("q.id <> ?");
		params.push(options.excludeId);
	}

	const row = await db
		.prepare(
			`SELECT q.id FROM questions q JOIN chapters ch ON ch.id = q.chapter_id
			 WHERE ${where.join(" AND ")}
			 ORDER BY RANDOM() LIMIT 1`,
		)
		.bind(...params)
		.first<{ id: number }>();
	return row?.id ?? null;
}
