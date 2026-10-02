import { data, redirect } from "react-router";
import type { Route } from "./+types/course-drop";
import { requireRole } from "../../lib/auth.server";
import { dropEnrollment, getStudentOfferings, parseOfferingId } from "../../lib/enrollments.server";
import { StudentCourseList } from "./student-course-list";

export function meta() { return [{ title: "退選｜校務資訊系統" }]; }

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, "student");
  return { offerings: getStudentOfferings(user.id).filter((offering) => offering.selected), dropped: new URL(request.url).searchParams.has("dropped") };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, "student");
  const offeringId = parseOfferingId((await request.formData()).get("offeringId"));
  if (!dropEnrollment(user.id, offeringId)) return data({ error: "這門課不在你的已選課程中。" }, { status: 400 });
  return redirect("/course/drop?dropped=1");
}

export default function CourseDrop({ loaderData, actionData }: Route.ComponentProps) {
  return <StudentCourseList title="線上退選作業" description="可退選目前已選的 115-1 課程，包含預排必修。" mode="drop" offerings={loaderData.offerings} error={actionData?.error} message={loaderData.dropped ? "退選成功。" : undefined} />;
}
