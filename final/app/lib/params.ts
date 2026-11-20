/** 解析正整數 id 參數;不合法時回傳 undefined */
export function parseId(raw: string | null | undefined): number | undefined {
	const id = Number(raw);
	return raw && Number.isInteger(id) && id > 0 ? id : undefined;
}
