import { Link } from "react-router";

import { requireCourse } from "../lib/course.server";
import { listChapters } from "../lib/queries.server";
import type { Route } from "./+types/course";

export function meta({ data }: Route.MetaArgs) {
	return [{ title: data ? `${data.course.name} | 考古題庫` : "考古題庫" }];
}

export async function loader({ context, params }: Route.LoaderArgs) {
	const db = context.cloudflare.env.DB;
	const course = await requireCourse(db, params.course);
	const chapters = await listChapters(db, course.id);
	return { course, chapters };
}

export default function Course({ loaderData }: Route.ComponentProps) {
	const { course, chapters } = loaderData;
	const total = chapters.reduce((sum, c) => sum + c.total, 0);
	const base = `/${course.slug}`;

	return (
		<div>
			<h1 className="text-2xl font-bold text-stone-900">{course.name}</h1>
			{course.description && <p className="mt-1 text-stone-600">{course.description}</p>}

			<div className="mt-4 flex flex-wrap gap-2">
				<Link
					to={`${base}/questions`}
					className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
				>
					瀏覽全部 {total} 題
				</Link>
				<Link
					to={`${base}/random`}
					className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
				>
					隨機一題
				</Link>
			</div>

			<h2 className="mt-10 text-lg font-semibold text-stone-900">章節</h2>
			{chapters.length === 0 ? (
				<p className="mt-4 text-stone-500">這門課還沒有題目。</p>
			) : (
				<ul className="mt-3 grid gap-3">
					{chapters.map((c) => (
						<li
							key={c.id}
							className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-stone-200 bg-white p-5"
						>
							<div className="min-w-0 flex-1">
								<Link
									to={`${base}/questions?chapter=${c.id}`}
									className="font-medium text-stone-900 hover:text-indigo-700"
								>
									{c.title}
								</Link>
								<p className="mt-1 text-sm text-stone-500">
									{c.total} 題 · 可線上作答 {c.quizzable} · 有詳解 {c.withAnswer}
								</p>
							</div>
							<div className="flex shrink-0 gap-2 text-sm font-medium">
								<Link
									to={`${base}/questions?chapter=${c.id}`}
									className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700"
								>
									開始練習
								</Link>
								<Link
									to={`${base}/random?chapter=${c.id}`}
									className="rounded-lg border border-stone-300 px-3 py-1.5 text-stone-700 hover:bg-stone-100"
								>
									隨機
								</Link>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
