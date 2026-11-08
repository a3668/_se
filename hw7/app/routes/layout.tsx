import { Form, Link, Outlet, useSearchParams } from "react-router";

export default function Layout() {
	const [searchParams] = useSearchParams();

	return (
		<div className="min-h-screen">
			<header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
				<div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
					<Link to="/" className="shrink-0 text-lg font-bold text-slate-900">
						考古題庫
					</Link>
					<Form action="/questions" className="ml-auto w-full max-w-xs">
						<input
							type="search"
							name="q"
							defaultValue={searchParams.get("q") ?? ""}
							placeholder="搜尋題目關鍵字…"
							aria-label="搜尋題目"
							className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
						/>
					</Form>
				</div>
			</header>
			<main className="mx-auto max-w-4xl px-4 py-8">
				<Outlet />
			</main>
		</div>
	);
}
