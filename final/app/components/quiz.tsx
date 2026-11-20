import { useState } from "react";

import { answerKeys, isCorrect } from "../lib/grading";
import type { ChoiceOption } from "../lib/parse-choices";
import { Markdown } from "./markdown";

type QuizProps = {
	options: ChoiceOption[];
	/** 標準答案,例如 "B"、"ACD"、"T" */
	correct: string;
	explanation: string | null;
	/** 自訂正確答案的顯示方式;預設顯示選項標記,例如 "(A) (C)" */
	formatAnswer?: (keys: string[]) => string;
};

export const TRUE_FALSE_OPTIONS: ChoiceOption[] = [
	{ key: "T", label: "○", text: "對" },
	{ key: "F", label: "✕", text: "錯" },
];

export function Quiz({ options, correct, explanation, formatAnswer }: QuizProps) {
	const correctKeys = answerKeys(correct);
	const multiple = correctKeys.size > 1;

	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [submitted, setSubmitted] = useState(false);
	const right = submitted && isCorrect(selected, correct);

	function toggle(key: string) {
		if (submitted) return;
		setSelected((prev) => {
			if (!multiple) return new Set([key]);
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}

	function reset() {
		setSelected(new Set());
		setSubmitted(false);
	}

	const answerText = formatAnswer
		? formatAnswer([...correctKeys])
		: options
				.filter((o) => correctKeys.has(o.key))
				.map((o) => o.label)
				.join(" ");

	return (
		<div className="mt-4">
			{multiple && (
				<p className="mb-2 text-sm font-medium text-amber-700">
					複選題:請選出所有正確的選項
				</p>
			)}

			<div role={multiple ? "group" : "radiogroup"} aria-label="選項" className="grid gap-2">
				{options.map((option) => {
					const checked = selected.has(option.key);
					const isAnswer = correctKeys.has(option.key);

					let style = "border-stone-200 bg-white hover:border-indigo-300";
					if (submitted && isAnswer) style = "border-emerald-400 bg-emerald-50";
					else if (submitted && checked) style = "border-rose-400 bg-rose-50";
					else if (checked) style = "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100";

					return (
						<label
							key={option.key}
							className={`flex items-start gap-3 rounded-xl border p-4 transition ${style} ${submitted ? "cursor-default" : "cursor-pointer"}`}
						>
							<input
								type={multiple ? "checkbox" : "radio"}
								name="quiz-option"
								value={option.key}
								checked={checked}
								disabled={submitted}
								onChange={() => toggle(option.key)}
								className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
							/>
							<span className="shrink-0 font-semibold text-stone-700">{option.label}</span>
							<span className="min-w-0 flex-1 text-stone-800">
								<Markdown>{option.text}</Markdown>
							</span>
							{submitted && isAnswer && (
								<span className="shrink-0 text-sm font-medium text-emerald-700">正解</span>
							)}
						</label>
					);
				})}
			</div>

			{!submitted ? (
				<button
					type="button"
					disabled={selected.size === 0}
					onClick={() => setSubmitted(true)}
					className="mt-4 rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
				>
					送出答案
				</button>
			) : (
				<div
					role="status"
					className={`mt-4 rounded-xl border p-5 ${right ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"}`}
				>
					<p className={`text-lg font-bold ${right ? "text-emerald-800" : "text-rose-800"}`}>
						{right ? "✓ 答對了!" : "✗ 答錯了"}
					</p>
					<p className="mt-1 text-stone-700">正確答案:{answerText}</p>
					{explanation && (
						<div className="mt-3 border-t border-black/10 pt-3 text-stone-700">
							<Markdown>{explanation}</Markdown>
						</div>
					)}
					<button
						type="button"
						onClick={reset}
						className="mt-4 rounded-lg border border-stone-300 bg-white px-4 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
					>
						再作答一次
					</button>
				</div>
			)}
		</div>
	);
}
