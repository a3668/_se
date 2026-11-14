import { QUESTION_TYPE_LABELS, type QuestionType } from "../types/question";

const STYLES: Record<QuestionType, string> = {
	choice: "bg-sky-50 text-sky-700 ring-sky-200",
	essay: "bg-amber-50 text-amber-700 ring-amber-200",
	truefalse: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function TypeBadge({ type }: { type: QuestionType }) {
	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[type]}`}
		>
			{QUESTION_TYPE_LABELS[type]}
		</span>
	);
}
