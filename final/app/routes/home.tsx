import { Link } from "react-router";

import { listCourses } from "../lib/queries.server";
import type { Route } from "./+types/home";

export function meta() {
	return [
		{ title: "考古題庫" },
		{ name: "description", content: "資工課程考古題線上練習:依章節、題型與關鍵字刷題,立即看到詳解。" },
	];
}

export async function loader({ context }: Route.LoaderArgs) {
	const courses = await listCourses(context.cloudflare.env.DB);
	return { courses };
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const { courses } = loaderData;

	return (
		<div>
			<h1 className="text-2xl font-bold text-stone-900">課程</h1>
			<p className="mt-1 text-stone-600">選一門課開始刷題。</p>

			{courses.length === 0 ? (
				<p className="mt-8 text-stone-500">目前還沒有課程。</p>
			) : (
				<ul className="mt-6 grid gap-4 sm:grid-cols-2">
					{courses.map((c) => (
						<li key={c.id}>
							<Link
								to={`/${c.slug}`}
								className="block h-full rounded-xl border border-stone-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-sm"
							>
								<span className="text-lg font-semibold text-stone-900">{c.name}</span>
								{c.description && (
									<p className="mt-1 text-sm text-stone-600">{c.description}</p>
								)}
								<p className="mt-3 text-sm text-stone-500">
									{c.chapters} 個章節 · {c.questions} 題
								</p>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
