export type QuestionType = "choice" | "essay" | "truefalse";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
	choice: "選擇題",
	essay: "問答題",
	truefalse: "是非題",
};

export function isQuestionType(value: unknown): value is QuestionType {
	return value === "choice" || value === "essay" || value === "truefalse";
}

export type Question = {
	id: number;
	chapter: string;
	number: number;
	type: QuestionType;
	content: string;
	answer: string | null;
};

export type ChapterSummary = {
	chapter: string;
	total: number;
	answered: number;
};

export type QuestionFilters = {
	chapter?: string;
	type?: QuestionType;
	q?: string;
};
