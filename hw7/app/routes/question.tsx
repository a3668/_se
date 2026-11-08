import { data, Link } from "react-router";

import { Markdown } from "../components/markdown";
import { Quiz, TRUE_FALSE_OPTIONS } from "../components/quiz";
import { TypeBadge } from "../components/type-badge";
import {
	getAdjacentQuestions,
	getQuestion,
} from "../lib/questions.server";
import { parseChoices } from "../lib/parse-choices";
import type { Question as QuestionData } from "../types/question";
import type { Route } from "./+types/question";

export function meta({ data }: Route.MetaArgs) {
	return [
		{
			title: data
				? `例題 ${data.question.number} | 考古題庫`
				: "找不到題目 | 考古題庫",
		},
	];
}

export async function loader({ context, params }: Route.LoaderArgs) {
	const db = context.cloudflare.env.hw7_db;
	const id = Number(params.id);

	if (!Number.isInteger(id) || id <= 0) {
		throw data("找不到題目", { status: 404 });
	}

	const question = await getQuestion(db, id);
	if (!question) {
		throw data("找不到題目", { status: 404 });
	}

	const adjacent = await getAdjacentQuestions(db, question);
	return { question, ...adjacent };
}

export default function Question({ loaderData }: Route.ComponentProps) {
	const { question, prev, next } = loaderData;
	const chapterUrl = `/questions?chapter=${encodeURIComponent(question.chapter)}`;
	const quiz = getQuiz(question);

	return (
		<article>
			<Link to={chapterUrl} className="text-sm text-sky-700 hover:underline">
				← {question.chapter}
			</Link>

			<div className="mt-3 flex items-center gap-2">
				<h1 className="text-2xl font-bold text-slate-900">
					例題 {question.number}
				</h1>
				<TypeBadge type={question.type} />
			</div>

			{quiz ? (
				<>
					<section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-slate-800">
						<Markdown>{quiz.stem}</Markdown>
					</section>
					{/* key 讓切換到其他題目時重設作答狀態 */}
					<Quiz
						key={question.id}
						options={quiz.options}
						correct={quiz.correct}
						explanation={question.answer}
						formatAnswer={quiz.formatAnswer}
					/>
				</>
			) : (
				<>
					<section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-slate-800">
						<Markdown>{question.content}</Markdown>
					</section>
					<AnswerReveal answer={question.answer} />
				</>
			)}

			<nav className="mt-8 flex justify-between text-sm font-medium">
				{prev ? (
					<Link to={`/questions/${prev.id}`} className="text-sky-700 hover:underline">
						← 例題 {prev.number}
					</Link>
				) : (
					<span />
				)}
				{next ? (
					<Link
						to={`/questions/${next.id}`}
						className="rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-700"
					>
						下一題:例題 {next.number} →
					</Link>
				) : (
					<Link to={chapterUrl} className="text-sky-700 hover:underline">
						本章結束,回到題目列表
					</Link>
				)}
			</nav>
		</article>
	);
}

/** 決定這題能否線上作答;不能的話(問答題或沒有標準答案)回傳 null */
function getQuiz(question: QuestionData) {
	if (!question.correct) return null;

	if (question.type === "truefalse") {
		return {
			stem: question.content,
			options: TRUE_FALSE_OPTIONS,
			correct: question.correct,
			formatAnswer: (keys: string[]) => (keys[0] === "T" ? "○ 對" : "✕ 錯"),
		};
	}

	if (question.type === "choice") {
		const { stem, options } = parseChoices(question.content);
		if (options.length < 2) return null;
		return { stem, options, correct: question.correct, formatAnswer: undefined };
	}

	return null;
}

function AnswerReveal({ answer }: { answer: string | null }) {
	return (
		<details className="group mt-4 rounded-xl border border-slate-200 bg-white">
			<summary className="cursor-pointer select-none px-6 py-4 font-medium text-slate-900">
				查看答案
			</summary>
			<div className="border-t border-slate-200 px-6 py-4 text-slate-700">
				{answer ? (
					<Markdown>{answer}</Markdown>
				) : (
					<p className="text-slate-500">答案尚未提供。</p>
				)}
			</div>
		</details>
	);
}
