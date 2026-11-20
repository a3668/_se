import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

/** 題目內容的選項是用單一換行分隔,remark-breaks 讓單一換行也能顯示成換行 */
export function Markdown({ children }: { children: string }) {
	return (
		<div className="markdown">
			<ReactMarkdown remarkPlugins={[remarkBreaks]}>{children}</ReactMarkdown>
		</div>
	);
}
