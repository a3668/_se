import { Form, Link } from "react-router";

import { Highlight } from "../components/highlight";
import { Markdown } from "../components/markdown";
import { Pagination } from "../components/pagination";
import { TypeBadge } from "../components/type-badge";
import { requireCourse } from "../lib/course.server";
import { parseId } from "../lib/params";
import { pageCount, parsePage } from "../lib/pagination";
import { parseChoices } from "../lib/parse-choices";
import { listChapters, searchQuestions } from "../lib/queries.server";
import { isQuestionType, QUESTION_TYPE_LABELS, QUESTION_TYPES } from "../lib/types";
import type { Route } from "./+types/questions";

export function meta({ data }: Route.MetaArgs) {
	return [{ title: data ? `題目列表 · ${data.course.name} | 考古題庫` : "考古題庫" }];
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
	const db = context.cloudflare.env.DB;
	const course = await requireCourse(db, params.course);
	const url = new URL(request.url);

	const rawType = url.searchParams.get("type");
	const filters = {
		chapterId: parseId(url.searchParams.get("chapter")),
		type: isQuestionType(rawType) ? rawType : undefined,
		q: url.searchParams.get("q")?.trim() || undefined,
		page: parsePage(url.searchParams.get("page")),
	};

	const [chapters, result] = await Promise.all([
		listChapters(db, course.id),
		searchQuestions(db, course.id, filters),
	]);

	return { course, chapters, filters, ...result };
}

export default function Questions({ loaderData }: Route.ComponentProps) {
	const { course, chapters, filters, questions, total, terms } = loaderData;
	const chapter = chapters.find((c) => c.id === filters.chapterId);
	const base = `/${course.slug}`;

	return (
		<div>
			<Link to={base} className="text-sm text-indigo-700 hover:underline">
				← {course.name}
			</Link>
			<h1 className="mt-2 text-2xl font-bold text-stone-900">{chapter?.title ?? "全部題目"}</h1>

			{/* key 讓篩選條件改變(例如從頂部搜尋)時重設表單預設值 */}
			<Form
				key={`${filters.chapterId}|${filters.type}|${filters.q}`}
				className="mt-4 flex flex-wrap items-center gap-2"
			>
				<select
					name="chapter"
					defaultValue={filters.chapterId ?? ""}
					aria-label="章節"
					className="max-w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm"
				>
					<option value="">全部章節</option>
					{chapters.map((c) => (
						<option key={c.id} value={c.id}>{c.title}</option>
					))}
				</select>
				<select
					name="type"
					defaultValue={filters.type ?? ""}
					aria-label="題型"
					className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm"
				>
					<option value="">全部題型</option>
					{QUESTION_TYPES.map((t) => (
						<option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
					))}
				</select>
				<input
					type="search"
					name="q"
					defaultValue={filters.q ?? ""}
					placeholder="關鍵字(空白分隔多個)"
					aria-label="關鍵字"
					className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm"
				/>
				<button
					type="submit"
					className="rounded-lg bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-700"
				>
					篩選
				</button>
			</Form>

			<p className="mt-4 text-sm text-stone-500" aria-live="polite">共 {total} 題</p>

			<ul className="mt-3 grid gap-4">
				{questions.map((question) => (
					<li key={question.id} className="rounded-xl border border-stone-200 bg-white p-5">
						<div className="flex flex-wrap items-center gap-2">
							<Link
								to={`${base}/questions/${question.id}`}
								className="font-semibold text-stone-900 hover:text-indigo-700"
							>
								第 {question.number} 題
							</Link>
							<TypeBadge type={question.type} />
							{question.correct ? (
								<span className="text-xs text-emerald-700">可線上作答</span>
							) : (
								question.answer && <span className="text-xs text-stone-500">有參考答案</span>
							)}
							{!filters.chapterId && (
								<span className="ml-auto text-xs text-stone-400">{question.chapterTitle}</span>
							)}
						</div>
						<div className="mt-3 text-stone-700">
							{terms.length > 0 ? (
								<Highlight text={`${question.content}\n${question.answer ?? ""}`} terms={terms} />
							) : (
								<Markdown>
									{question.type === "choice"
										? parseChoices(question.content).stem || question.content
										: question.content}
								</Markdown>
							)}
						</div>
						<Link
							to={`${base}/questions/${question.id}`}
							className="mt-3 inline-block text-sm font-medium text-indigo-700 hover:underline"
						>
							{question.correct ? "開始作答 →" : "查看題目 →"}
						</Link>
					</li>
				))}
			</ul>

			{questions.length === 0 && (
				<p className="mt-8 text-stone-500">找不到符合條件的題目。</p>
			)}

			<Pagination page={filters.page} pages={pageCount(total)} />
		</div>
	);
}
