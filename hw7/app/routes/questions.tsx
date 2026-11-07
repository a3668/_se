import { Form, Link } from "react-router";

import { Markdown } from "../components/markdown";
import { TypeBadge } from "../components/type-badge";
import { listChapters, listQuestions } from "../lib/questions.server";
import {
	isQuestionType,
	QUESTION_TYPE_LABELS,
	type QuestionType,
} from "../types/question";
import type { Route } from "./+types/questions";

export function meta() {
	return [{ title: "題目列表 | 考古題庫" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
	const db = context.cloudflare.env.hw7_db;
	const url = new URL(request.url);

	const chapter = url.searchParams.get("chapter")?.trim() || undefined;
	const rawType = url.searchParams.get("type");
	const type = isQuestionType(rawType) ? rawType : undefined;
	const q = url.searchParams.get("q")?.trim() || undefined;

	const [chapters, questions] = await Promise.all([
		listChapters(db),
		listQuestions(db, { chapter, type, q }),
	]);

	return { chapters, questions, filters: { chapter, type, q } };
}

export default function Questions({ loaderData }: Route.ComponentProps) {
	const { chapters, questions, filters } = loaderData;

	return (
		<div>
			<h1 className="text-2xl font-bold text-slate-900">
				{filters.chapter ?? "全部題目"}
			</h1>

			{/* key 讓篩選條件改變(例如從頂部搜尋)時重設表單預設值 */}
			<Form
				key={`${filters.chapter}|${filters.type}|${filters.q}`}
				className="mt-4 flex flex-wrap items-center gap-2"
			>
				<select
					name="chapter"
					defaultValue={filters.chapter ?? ""}
					aria-label="章節"
					className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
				>
					<option value="">全部章節</option>
					{chapters.map((c) => (
						<option key={c.chapter} value={c.chapter}>
							{c.chapter}
						</option>
					))}
				</select>
				<select
					name="type"
					defaultValue={filters.type ?? ""}
					aria-label="題型"
					className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
				>
					<option value="">全部題型</option>
					{(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
						<option key={t} value={t}>
							{QUESTION_TYPE_LABELS[t]}
						</option>
					))}
				</select>
				<input
					type="search"
					name="q"
					defaultValue={filters.q ?? ""}
					placeholder="關鍵字"
					aria-label="關鍵字"
					className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
				/>
				<button
					type="submit"
					className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
				>
					篩選
				</button>
			</Form>

			<p className="mt-4 text-sm text-slate-500">共 {questions.length} 題</p>

			<ul className="mt-3 grid gap-4">
				{questions.map((question) => (
					<li
						key={question.id}
						className="rounded-xl border border-slate-200 bg-white p-5"
					>
						<div className="flex items-center gap-2">
							<Link
								to={`/questions/${question.id}`}
								className="font-semibold text-slate-900 hover:text-sky-700"
							>
								例題 {question.number}
							</Link>
							<TypeBadge type={question.type} />
							{question.answer && (
								<span className="text-xs text-slate-500">有答案</span>
							)}
						</div>
						<div className="mt-3 text-slate-700">
							<Markdown>{question.content}</Markdown>
						</div>
						<Link
							to={`/questions/${question.id}`}
							className="mt-3 inline-block text-sm font-medium text-sky-700 hover:underline"
						>
							查看題目 →
						</Link>
					</li>
				))}
			</ul>

			{questions.length === 0 && (
				<p className="mt-8 text-slate-500">找不到符合條件的題目。</p>
			)}
		</div>
	);
}
