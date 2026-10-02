import type { Route } from "./+types/course-result";
import { requireRole } from "../../lib/auth.server";
import { getStudentOfferings } from "../../lib/enrollments.server";
import { StudentCourseList } from "./student-course-list";

export function meta() { return [{ title: "選課結果｜校務資訊系統" }]; }

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, "student");
  return { offerings: getStudentOfferings(user.id).filter((offering) => offering.selected) };
}

export default function CourseResult({ loaderData }: Route.ComponentProps) {
  return <StudentCourseList title="選課結果查詢" description="目前已選的 115-1 課程。" mode="result" offerings={loaderData.offerings} />;
}
