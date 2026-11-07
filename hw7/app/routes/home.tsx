import { Link } from "react-router";

import { listChapters } from "../lib/questions.server";
import type { Route } from "./+types/home";

export function meta() {
	return [{ title: "考古題庫" }];
}

export async function loader({ context }: Route.LoaderArgs) {
	const chapters = await listChapters(context.cloudflare.env.hw7_db);
	return { chapters };
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const { chapters } = loaderData;

	return (
		<div>
			<h1 className="text-2xl font-bold text-slate-900">章節</h1>
			<p className="mt-1 text-slate-600">選擇章節開始練習。</p>

			{chapters.length === 0 ? (
				<p className="mt-8 text-slate-500">目前還沒有題目。</p>
			) : (
				<ul className="mt-6 grid gap-3">
					{chapters.map((c) => (
						<li key={c.chapter}>
							<Link
								to={`/questions?chapter=${encodeURIComponent(c.chapter)}`}
								className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-sky-300 hover:shadow-sm"
							>
								<span className="font-medium text-slate-900">{c.chapter}</span>
								<span className="shrink-0 text-sm text-slate-500">
									{c.total} 題 · 已有答案 {c.answered}
								</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
