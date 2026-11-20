import { data } from "react-router";

import { getCourse } from "./queries.server";

/** 依網址上的課程代號取得課程,找不到時回 404 */
export async function requireCourse(db: D1Database, slug: string | undefined) {
	const course = slug ? await getCourse(db, slug) : null;
	if (!course) {
		throw data("找不到這門課", { status: 404 });
	}
	return course;
}

