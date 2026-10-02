import { Form, Link, data, redirect } from "react-router";
import { Pagination } from "../../components/pagination";
import type { Route } from "./+types/course-add";
import { requireRole } from "../../lib/auth.server";
import { addEnrollment, getStudentOfferingDepartments, getStudentOfferingGrades, getStudentOfferings, parseOfferingId } from "../../lib/enrollments.server";
import { StudentCourseList } from "./student-course-list";

const PAGE_SIZE = 20;

export function meta() { return [{ title: "加選｜校務資訊系統" }]; }

function getFilters(request: Request) {
  const params = new URL(request.url).searchParams;
  return {
    department: params.get("department")?.trim().slice(0, 100) ?? "",
    grade: params.get("grade")?.trim().slice(0, 100) ?? "",
  };
}

function getPageHref(filters: { department: string; grade: string }, page: number) {
  const params = new URLSearchParams();
  params.set("search", "1");
  if (filters.department) params.set("department", filters.department);
  if (filters.grade) params.set("grade", filters.grade);
  if (page > 1) params.set("page", String(page));
  return params.size ? `/course/add?${params}` : "/course/add";
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, "student");
  const params = new URL(request.url).searchParams;
  const filters = getFilters(request);
  const searched = params.get("search") === "1" || Boolean(filters.department || filters.grade);
  const pageValue = params.get("page");
  const parsedPage = Number(pageValue);
  const requestedPage = pageValue !== null && /^[1-9]\d*$/.test(pageValue)
    && Number.isSafeInteger(parsedPage) ? parsedPage : 1;
  const allOfferings = searched ? getStudentOfferings(user.id) : [];
  const grades = getStudentOfferingGrades();
  const departments = getStudentOfferingDepartments();
  const matchingOfferings = allOfferings.filter((offering) =>
    (!filters.grade || String(offering.grade) === filters.grade)
    && (!filters.department || offering.department === filters.department),
  );
  const totalItems = matchingOfferings.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  if (searched && pageValue !== null && (String(currentPage) !== pageValue || requestedPage === 1)) {
    const url = new URL(getPageHref(filters, currentPage), request.url);
    if (params.has("added")) url.searchParams.set("added", "1");
    return redirect(url.pathname + url.search);
  }
  return {
    ...filters, grades, departments, searched,
    offerings: matchingOfferings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    pagination: { currentPage, totalPages, totalItems },
    added: params.has("added"),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, "student");
  const offeringId = parseOfferingId((await request.formData()).get("offeringId"));
  const error = addEnrollment(user.id, offeringId);
  if (error) return data({ error }, { status: 400 });
  const params = new URL(request.url).searchParams;
  const pageValue = params.get("page") ?? "";
  const page = /^[1-9]\d*$/.test(pageValue) && Number.isSafeInteger(Number(pageValue)) ? Number(pageValue) : 1;
  const url = new URL(getPageHref(getFilters(request), page), request.url);
  url.searchParams.set("added", "1");
  return redirect(url.pathname + url.search);
}

export default function CourseAdd({ loaderData, actionData }: Route.ComponentProps) {
  const { department, grade, grades, departments, pagination, searched } = loaderData;
  return <StudentCourseList
    title="線上加選作業"
    description="開放 115-1 課程，可跨系、跨年級加選；額滿或時段衝突的課程無法加選。"
    mode="add" offerings={loaderData.offerings} error={actionData?.error}
    message={loaderData.added ? "加選成功。" : undefined}
    emptyMessage={searched ? "找不到符合條件的課程。" : "請先查詢課程。"}
    searchControls={
      <Form key={JSON.stringify([department, grade])} className="course-catalog-filters" method="get" action="/course/add">
        <input type="hidden" name="search" value="1" />
        <label htmlFor="course-add-department">科系
          <select id="course-add-department" name="department" defaultValue={department}>
            <option value="">全部科系</option>
            {department && !departments.includes(department) ? <option value={department}>{department}</option> : null}
            {departments.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label htmlFor="course-add-grade">年級
          <select id="course-add-grade" name="grade" defaultValue={grade}>
            <option value="">全部年級</option>
            {grade && !grades.some((value) => String(value) === grade) ? <option value={grade}>{grade} 年級</option> : null}
            {grades.map((value) => <option key={value} value={value}>{value} 年級</option>)}
          </select>
        </label>
        <button type="submit">查詢</button>
        {searched ? <Link to="/course/add">清除</Link> : null}
      </Form>
    }
    paginationControls={searched ? <>
      <p className="admin-help admin-pagination-summary">共 {pagination.totalItems} 筆，第 {pagination.currentPage} / {pagination.totalPages} 頁</p>
      <Pagination {...pagination} label="加選課程列表分頁" getPageHref={(page) => getPageHref({ department, grade }, page)} />
    </> : null}
  />;
}
