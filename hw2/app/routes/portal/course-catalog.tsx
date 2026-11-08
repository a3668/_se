import { PageHeading, FilterForm, InputControl, SelectControl, ActionButton, TableContainer, DataTable, TableHead, TableRow, TableCell, TableBody, EmptyState } from "../../components/ui";
import { Link } from "react-router";
import type { Route } from "./+types/course-catalog";
import { requireRole } from "../../lib/auth.server";
import { getDatabase } from "../../lib/db.server";
import { getSemesterFilter, getStudentOfferingDepartments, getStudentOfferingGrades } from "../../lib/enrollments.server";
import { Pagination } from "../../components/pagination";

type CourseRow = {
  offering_id: number;
  course_code: string;
  name: string;
  credits: number;
  grade: number;
  category: "required" | "elective";
  section: string;
  capacity: number;
  teacher_name: string;
  weekday: number | null;
  start_period: number | null;
  end_period: number | null;
  classroom: string | null;
};

const weekdays = ["", "一", "二", "三", "四", "五", "六", "日"];

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "student", "teacher");
  const db = getDatabase();
  const { semester, semesters } = getSemesterFilter(request);
  const departmentOptions = getStudentOfferingDepartments(semester);
  const gradeOptions = getStudentOfferingGrades(semester);
  const params = new URL(request.url).searchParams;
  const department = params.get("department")?.trim().slice(0, 100) ?? "";
  const grade = params.get("grade")?.trim().slice(0, 100) ?? "";
  const searched = params.get("search") === "1" || Boolean(department || grade);
  if ((department && !departmentOptions.includes(department))
    || (grade && !gradeOptions.some((value) => String(value) === grade))) {
    throw new Response("Bad Request", { status: 400 });
  }

  const rows = searched ? db.prepare(
    `SELECT course_offerings.id AS offering_id, courses.course_code, courses.name,
            courses.credits, courses.grade, courses.category, course_offerings.section,
            course_offerings.capacity, teachers.name AS teacher_name,
            course_schedules.weekday, course_schedules.start_period,
            course_schedules.end_period, course_schedules.classroom
     FROM course_offerings
     JOIN courses ON courses.id = course_offerings.course_id
     JOIN teachers ON teachers.user_id = course_offerings.teacher_user_id
     LEFT JOIN course_schedules ON course_schedules.offering_id = course_offerings.id
     WHERE course_offerings.semester = ?
       AND (? = '' OR courses.department = ?)
       AND (? = '' OR courses.grade = ?)
     ORDER BY courses.grade, courses.course_code, course_offerings.section,
              course_schedules.weekday, course_schedules.start_period`,
  ).all(semester, department, department, grade, grade) as CourseRow[] : [];

  const courses: Array<Omit<CourseRow, "weekday" | "start_period" | "end_period" | "classroom"> & { schedules: string[] }> = [];
  for (const row of rows) {
    let course = courses[courses.length - 1];
    if (course?.offering_id !== row.offering_id) {
      course = {
        offering_id: row.offering_id, course_code: row.course_code, name: row.name,
        credits: row.credits, grade: row.grade, category: row.category,
        section: row.section, capacity: row.capacity, teacher_name: row.teacher_name,
        schedules: [],
      };
      courses.push(course);
    }
    if (row.weekday !== null && row.start_period !== null && row.end_period !== null) {
      course.schedules.push(`週${weekdays[row.weekday]} ${row.start_period}–${row.end_period} 節 · ${row.classroom ?? "教室未定"}`);
    }
  }

  const totalItems = courses.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / 20));
  const page = Number(params.get("page"));
  const currentPage = Number.isSafeInteger(page) && page > 0 ? Math.min(page, totalPages) : 1;
  return { semester, semesters, department, grade, grades: gradeOptions, departments: departmentOptions,
    courses: courses.slice((currentPage - 1) * 20, currentPage * 20), searched,
    pagination: { totalItems, totalPages, currentPage } };
}

export function meta() {
  return [{ title: "課程資料查詢｜校務資訊系統" }];
}

export default function CourseCatalog({ loaderData }: Route.ComponentProps) {
  const { semester, semesters, department, grade, grades, departments, courses, searched, pagination } = loaderData;
  const pageHref = (page: number) => {
    const params = new URLSearchParams({ search: "1", semester });
    if (department) params.set("department", department);
    if (grade) params.set("grade", grade);
    if (page > 1) params.set("page", String(page));
    return `/query/class-data?${params}`;
  };
  return (
    <div className="portal-page course-catalog-page">
      <nav aria-label="麵包屑" className="portal-breadcrumb">
        <Link to="/home">系統首頁</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">課程資料查詢</span>
      </nav>
      <PageHeading title="課程資料查詢" context={`${semester} · 課程查詢`} description="依學期、科系與年級查詢開課資訊。" />
      <FilterForm key={JSON.stringify([semester, department, grade])} className="course-catalog-filters" method="get" action="/query/class-data">
        <InputControl type="hidden" name="search" value="1" />
        <label>學期<SelectControl name="semester" defaultValue={semester}>{semesters.map((s) => <option key={s}>{s}</option>)}</SelectControl></label>
        <label>科系
          <SelectControl name="department" defaultValue={department}>
            <option value="">全部科系</option>
            {departments.map((value) => <option key={value} value={value}>{value}</option>)}
          </SelectControl>
        </label>
        <label>年級
          <SelectControl name="grade" defaultValue={grade}>
            <option value="">全部年級</option>
            {grades.map((value) => <option key={value} value={value}>{value} 年級</option>)}
          </SelectControl>
        </label>
        <ActionButton type="submit">查詢</ActionButton>
        {searched ? <Link to="/query/class-data">清除</Link> : null}
      </FilterForm>
      {courses.length ? (
        <TableContainer className="course-catalog-table-wrap">
          <DataTable className="course-catalog-table">
            <TableHead><TableRow>
              <TableCell component="th" scope="col">課程</TableCell><TableCell component="th" scope="col">年級／類別</TableCell><TableCell component="th" scope="col">學分</TableCell>
              <TableCell component="th" scope="col">班別／上限</TableCell><TableCell component="th" scope="col">授課教師</TableCell><TableCell component="th" scope="col">上課時段</TableCell>
            </TableRow></TableHead>
            <TableBody>{courses.map((course) => (
              <TableRow key={course.offering_id}>
                <TableCell><strong>{course.name}</strong><small>{course.course_code}</small></TableCell>
                <TableCell>{course.grade} 年級 · {course.category === "required" ? "必修" : "選修"}</TableCell>
                <TableCell>{course.credits}</TableCell>
                <TableCell>{course.section} 班 · {course.capacity} 人</TableCell>
                <TableCell>{course.teacher_name}</TableCell>
                <TableCell>{course.schedules.length ? course.schedules.map((schedule) => <div key={schedule}>{schedule}</div>) : "時段未定"}</TableCell>
              </TableRow>
            ))}</TableBody>
          </DataTable>
        </TableContainer>
      ) : <EmptyState className="course-catalog-empty">{searched ? "此學期沒有符合條件的開課資料。" : "請先查詢課程。"}</EmptyState>}
      {searched ? <><p className="admin-pagination-summary">共 {pagination.totalItems} 筆，第 {pagination.currentPage} / {pagination.totalPages} 頁</p><Pagination {...pagination} label="課程查詢分頁" getPageHref={pageHref} /></> : null}
    </div>
  );
}
