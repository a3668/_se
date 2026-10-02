import { data, redirect } from "react-router";
import type { Route } from "./+types/course-add";
import { requireRole } from "../../lib/auth.server";
import { addEnrollment, getStudentOfferings, parseOfferingId } from "../../lib/enrollments.server";
import { StudentCourseList } from "./student-course-list";

export function meta() { return [{ title: "加選｜校務資訊系統" }]; }

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, "student");
  return { offerings: getStudentOfferings(user.id), added: new URL(request.url).searchParams.has("added") };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, "student");
  const offeringId = parseOfferingId((await request.formData()).get("offeringId"));
  const error = addEnrollment(user.id, offeringId);
  if (error) return data({ error }, { status: 400 });
  return redirect("/course/add?added=1");
}

export default function CourseAdd({ loaderData, actionData }: Route.ComponentProps) {
  return <StudentCourseList title="線上加選作業" description="僅開放本系 115-1 課程，可跨年級加選；額滿或時段衝突的課程無法加選。" mode="add" offerings={loaderData.offerings} error={actionData?.error} message={loaderData.added ? "加選成功。" : undefined} />;
}
