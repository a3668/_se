import { data, redirect } from "react-router";
import type { Route } from "./+types/course-drop";
import { requireRole } from "../../lib/auth.server";
import { ACTIVE_SEMESTER, dropEnrollment, getStudentOfferings, parseOfferingId } from "../../lib/enrollments.server";
import { isStudentEnrollmentOpen } from "../../lib/enrollment-settings.server";
import { StudentCourseList } from "./student-course-list";

export function meta() { return [{ title: "退選｜校務資訊系統" }]; }

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, "student");
  const enrollmentOpen = isStudentEnrollmentOpen(user.id, ACTIVE_SEMESTER);
  if (!enrollmentOpen) return { offerings: [], dropped: false, enrollmentOpen };
  return {
    offerings: getStudentOfferings(user.id).filter((offering) => offering.selected),
    dropped: new URL(request.url).searchParams.has("dropped"),
    enrollmentOpen,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, "student");
  const offeringId = parseOfferingId((await request.formData()).get("offeringId"));
  const error = dropEnrollment(user.id, offeringId);
  if (error) return data({ error }, { status: 400 });
  return redirect("/course/drop?dropped=1");
}

export default function CourseDrop({ loaderData, actionData }: Route.ComponentProps) {
  return <StudentCourseList title="線上退選作業" description="你的年級開放時，可退選目前已選的 115-1 課程，包含預排必修。" mode="drop" enrollmentOpen={loaderData.enrollmentOpen} offerings={loaderData.offerings} error={actionData?.error} message={loaderData.dropped ? "退選成功。" : undefined} />;
}
