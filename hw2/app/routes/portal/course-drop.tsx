import { data, redirect } from "react-router";
import type { Route } from "./+types/course-drop";
import { requireRole } from "../../lib/auth.server";
import { getActiveSemester } from "../../lib/semester-settings.server";
import { dropEnrollment, getStudentOfferings, parseOfferingId } from "../../lib/enrollments.server";
import { isStudentEnrollmentOpen } from "../../lib/enrollment-settings.server";
import { StudentCourseList } from "./student-course-list";

export function meta() { return [{ title: "退選｜校務資訊系統" }]; }

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, "student");
  const semester = getActiveSemester();
  const enrollmentOpen = isStudentEnrollmentOpen(user.id, semester);
  if (!enrollmentOpen) return { offerings: [], dropped: false, enrollmentOpen, semester };
  return {
    offerings: getStudentOfferings(user.id).filter((offering) => offering.selected),
    dropped: new URL(request.url).searchParams.has("dropped"),
    enrollmentOpen, semester,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, "student");
  const form = await request.formData();
  const offeringId = parseOfferingId(form.get("offeringId"));
  const error = dropEnrollment(user.id, offeringId, form.get("originalSemester"));
  if (error) return data({ error }, { status: 400 });
  return redirect("/course/drop?dropped=1");
}

export default function CourseDrop({ loaderData, actionData }: Route.ComponentProps) {
  return <StudentCourseList semester={loaderData.semester} title="線上退選作業" description={`你的年級開放時，可退選目前已選的 ${loaderData.semester} 課程，包含預排必修。`} mode="drop" enrollmentOpen={loaderData.enrollmentOpen} offerings={loaderData.offerings} error={actionData?.error} message={loaderData.dropped ? "退選成功。" : undefined} />;
}
