import { data, redirect } from "react-router";

import { requireCourse } from "../lib/course.server";
import { parseId } from "../lib/params";
import { randomQuestionId } from "../lib/queries.server";
import type { Route } from "./+types/random";

/** 隨機挑一題後轉址;?chapter= 限定章節,?exclude= 避免抽到目前這題 */
export async function loader({ context, params, request }: Route.LoaderArgs) {
	const db = context.cloudflare.env.DB;
	const course = await requireCourse(db, params.course);
	const url = new URL(request.url);
	const chapterId = parseId(url.searchParams.get("chapter"));

	const id = await randomQuestionId(db, course.id, {
		chapterId,
		excludeId: parseId(url.searchParams.get("exclude")),
	}) ?? await randomQuestionId(db, course.id, { chapterId });

	if (!id) throw data("這個範圍內沒有題目", { status: 404 });

	const suffix = chapterId ? `?from=random&chapter=${chapterId}` : "?from=random";
	return redirect(`/${course.slug}/questions/${id}${suffix}`);
}
