import { data, Link, useSearchParams } from "react-router";

import { Markdown } from "../components/markdown";
import { Quiz, TRUE_FALSE_OPTIONS } from "../components/quiz";
import { TypeBadge } from "../components/type-badge";
import { requireCourse } from "../lib/course.server";
import { parseId } from "../lib/params";
import { parseChoices } from "../lib/parse-choices";
import { getAdjacentQuestions, getQuestion } from "../lib/queries.server";
import type { Question as QuestionData } from "../lib/types";
import type { Route } from "./+types/question";

export function meta({ data }: Route.MetaArgs) {
	if (!data) return [{ title: "找不到題目 | 考古題庫" }];
	return [{ title: `第 ${data.question.number} 題 · ${data.course.name} | 考古題庫` }];
}

export async function loader({ context, params }: Route.LoaderArgs) {
	const db = context.cloudflare.env.DB;
	const course = await requireCourse(db, params.course);
	const id = parseId(params.id);
	const question = id ? await getQuestion(db, course.id, id) : null;
	if (!question) throw data("找不到題目", { status: 404 });

	const adjacent = await getAdjacentQuestions(db, question);
	return { course, question, ...adjacent };
}

export default function Question({ loaderData }: Route.ComponentProps) {
	const { course, question, prev, next } = loaderData;
	const [searchParams] = useSearchParams();
	const base = `/${course.slug}`;
	const chapterUrl = `${base}/questions?chapter=${question.chapterId}`;
	const quiz = getQuiz(question);

	// 從「隨機一題」進來時,主要按鈕改成再抽一題(沿用原本的章節範圍)
	const fromRandom = searchParams.get("from") === "random";
	const randomChapter = parseId(searchParams.get("chapter"));
	const randomUrl = `${base}/random?exclude=${question.id}${randomChapter ? `&chapter=${randomChapter}` : ""}`;

	return (
		<article>
			<nav aria-label="麵包屑" className="flex flex-wrap gap-1 text-sm text-stone-500">
				<Link to={base} className="text-indigo-700 hover:underline">{course.name}</Link>
				<span>/</span>
				<Link to={chapterUrl} className="text-indigo-700 hover:underline">{question.chapterTitle}</Link>
			</nav>

			<div className="mt-3 flex items-center gap-2">
				<h1 className="text-2xl font-bold text-stone-900">第 {question.number} 題</h1>
				<TypeBadge type={question.type} />
			</div>

			<section className="mt-6 rounded-xl border border-stone-200 bg-white p-6 text-stone-800">
				<Markdown>{quiz ? quiz.stem : question.content}</Markdown>
			</section>

			{quiz ? (
				// key 讓切換題目時重設作答狀態
				<Quiz
					key={question.id}
					options={quiz.options}
					correct={quiz.correct}
					explanation={question.answer}
					formatAnswer={quiz.formatAnswer}
				/>
			) : (
				<AnswerReveal key={question.id} answer={question.answer} />
			)}

			<nav className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm font-medium">
				{prev ? (
					<Link to={`${base}/questions/${prev.id}`} className="text-indigo-700 hover:underline">
						← 第 {prev.number} 題
					</Link>
				) : (
					<span />
				)}
				<div className="flex flex-wrap gap-2">
					{fromRandom ? (
						<Link to={randomUrl} className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
							再抽一題 →
						</Link>
					) : next ? (
						<Link
							to={`${base}/questions/${next.id}`}
							className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
						>
							下一題:第 {next.number} 題 →
						</Link>
					) : (
						<Link to={chapterUrl} className="rounded-lg border border-stone-300 px-4 py-2 text-stone-700 hover:bg-stone-100">
							本章結束,回到題目列表
						</Link>
					)}
				</div>
			</nav>
		</article>
	);
}

/** 決定這題能否線上作答;問答題或缺少標準答案時回傳 null */
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
		<details className="mt-4 rounded-xl border border-stone-200 bg-white">
			<summary className="cursor-pointer select-none px-6 py-4 font-medium text-stone-900">
				查看參考答案
			</summary>
			<div className="border-t border-stone-200 px-6 py-4 text-stone-700">
				{answer ? <Markdown>{answer}</Markdown> : <p className="text-stone-500">答案尚未提供。</p>}
			</div>
		</details>
	);
}
