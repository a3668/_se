export type QuestionType = "choice" | "essay" | "truefalse";

export const QUESTION_TYPES: QuestionType[] = ["choice", "truefalse", "essay"];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
	choice: "選擇題",
	truefalse: "是非題",
	essay: "問答題",
};

export function isQuestionType(value: unknown): value is QuestionType {
	return QUESTION_TYPES.includes(value as QuestionType);
}

export type Course = {
	id: number;
	slug: string;
	name: string;
	description: string | null;
};

export type CourseSummary = Course & {
	chapters: number;
	questions: number;
};

export type ChapterSummary = {
	id: number;
	title: string;
	total: number;
	/** 有標準答案、可以線上作答的題數 */
	quizzable: number;
	/** 有詳解或參考答案的題數 */
	withAnswer: number;
};

export type Question = {
	id: number;
	chapterId: number;
	chapterTitle: string;
	number: number;
	type: QuestionType;
	content: string;
	answer: string | null;
	/** 標準答案:選擇題為選項代號(如 "ACD"),是非題為 "T" / "F",問答題為 null */
	correct: string | null;
};

export type QuestionFilters = {
	chapterId?: number;
	type?: QuestionType;
	q?: string;
	page: number;
};
