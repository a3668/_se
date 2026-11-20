import { excerpt } from "../lib/excerpt";

/** 搜尋結果的純文字摘要,命中的關鍵字以 <mark> 標示 */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
	return (
		<p className="text-sm leading-relaxed text-stone-600">
			{excerpt(text, terms).map((segment, i) =>
				segment.hit ? (
					<mark key={i} className="rounded bg-amber-200/70 px-0.5 text-stone-900">
						{segment.text}
					</mark>
				) : (
					<span key={i}>{segment.text}</span>
				),
			)}
		</p>
	);
}
