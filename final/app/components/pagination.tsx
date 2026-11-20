import { Link, useLocation } from "react-router";

/** 上一頁 / 下一頁,保留其他查詢參數 */
export function Pagination({ page, pages }: { page: number; pages: number }) {
	const location = useLocation();
	if (pages <= 1) return null;

	function hrefFor(target: number) {
		const params = new URLSearchParams(location.search);
		if (target === 1) params.delete("page");
		else params.set("page", String(target));
		const qs = params.toString();
		return `${location.pathname}${qs ? `?${qs}` : ""}`;
	}

	const linkClass =
		"rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100";
	const disabledClass =
		"rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-300";

	return (
		<nav aria-label="分頁" className="mt-6 flex items-center justify-center gap-3">
			{page > 1 ? (
				<Link to={hrefFor(page - 1)} className={linkClass}>← 上一頁</Link>
			) : (
				<span className={disabledClass}>← 上一頁</span>
			)}
			<span className="text-sm text-stone-600">
				第 {page} / {pages} 頁
			</span>
			{page < pages ? (
				<Link to={hrefFor(page + 1)} className={linkClass}>下一頁 →</Link>
			) : (
				<span className={disabledClass}>下一頁 →</span>
			)}
		</nav>
	);
}
