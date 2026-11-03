import { FilterForm, SelectControl, ActionButton } from "../../components/ui";
import type { Route } from "./+types/course-result";
import { requireRole } from "../../lib/auth.server";
import { getSemesterFilter, getStudentOfferings } from "../../lib/enrollments.server";
import { StudentCourseList } from "./student-course-list";

export function meta() { return [{ title: "選課結果｜校務資訊系統" }]; }

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, "student");
  const { semester, semesters } = getSemesterFilter(request);
  return { semester, semesters, offerings: getStudentOfferings(user.id, semester).filter((offering) => offering.selected) };
}

export default function CourseResult({ loaderData }: Route.ComponentProps) {
  const { semester, semesters, offerings } = loaderData;
  return <StudentCourseList title="選課結果查詢" description={`目前已選的 ${semester} 課程，共 ${offerings.length} 門、${offerings.reduce((n, o) => n + o.credits, 0)} 學分。`} semester={semester} mode="result" offerings={offerings}
    searchControls={<FilterForm method="get" key={semester} className="course-catalog-filters"><label>學期<SelectControl name="semester" defaultValue={semester}>{semesters.map((s) => <option key={s}>{s}</option>)}</SelectControl></label><ActionButton type="submit">查詢</ActionButton></FilterForm>} />;
}
