export const PAGE_SIZE = 20;

/** 解析網址上的 page 參數;不合法時回到第 1 頁 */
export function parsePage(raw: string | null): number {
	const page = Number(raw);
	return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function pageCount(total: number, size = PAGE_SIZE): number {
	return Math.max(1, Math.ceil(total / size));
}
