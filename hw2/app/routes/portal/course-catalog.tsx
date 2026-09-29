import { Form, Link } from "react-router";
import type { Route } from "./+types/course-catalog";
import { requireRole } from "../../lib/auth.server";
import { getDatabase } from "../../lib/db.server";

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
  const user = await requireRole(request, "student", "teacher");
  const db = getDatabase();
  const profileTable = user.role === "student" ? "students" : "teachers";
  const profile = db.prepare(`SELECT department FROM ${profileTable} WHERE user_id = ?`)
    .get(user.id) as { department: string } | undefined;
  const semesters = db.prepare("SELECT DISTINCT semester FROM course_offerings ORDER BY semester")
    .all() as { semester: string }[];
  const departments = db.prepare(
    `SELECT DISTINCT courses.department AS department
     FROM courses JOIN course_offerings ON course_offerings.course_id = courses.id
     ORDER BY courses.department`,
  ).all() as { department: string }[];

  const url = new URL(request.url);
  const semesterOptions = semesters.map((row) => row.semester);
  const departmentOptions = departments.map((row) => row.department);
  const requestedSemester = url.searchParams.get("semester");
  const requestedDepartment = url.searchParams.get("department");
  const semester = requestedSemester ?? (semesterOptions.includes("115-1") ? "115-1" : semesterOptions[0] ?? "");
  const department = requestedDepartment ?? (
    profile && departmentOptions.includes(profile.department) ? profile.department : departmentOptions[0] ?? ""
  );
  if ((semester && !semesterOptions.includes(semester)) || (department && !departmentOptions.includes(department))) {
    throw new Response("Bad Request", { status: 400 });
  }

  const rows = db.prepare(
    `SELECT course_offerings.id AS offering_id, courses.course_code, courses.name,
            courses.credits, courses.grade, courses.category, course_offerings.section,
            course_offerings.capacity, teachers.name AS teacher_name,
            course_schedules.weekday, course_schedules.start_period,
            course_schedules.end_period, course_schedules.classroom
     FROM course_offerings
     JOIN courses ON courses.id = course_offerings.course_id
     JOIN teachers ON teachers.user_id = course_offerings.teacher_user_id
     LEFT JOIN course_schedules ON course_schedules.offering_id = course_offerings.id
     WHERE course_offerings.semester = ? AND courses.department = ?
     ORDER BY courses.grade, courses.course_code, course_offerings.section,
              course_schedules.weekday, course_schedules.start_period`,
  ).all(semester, department) as CourseRow[];

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

  return { semester, department, semesters: semesterOptions, departments: departmentOptions, courses };
}

export function meta() {
  return [{ title: "課程資料查詢｜校務資訊系統" }];
}

export default function CourseCatalog({ loaderData }: Route.ComponentProps) {
  const { semester, department, semesters, departments, courses } = loaderData;
  return (
    <div className="portal-page course-catalog-page">
      <nav aria-label="麵包屑" className="portal-breadcrumb">
        <Link to="/home">系統首頁</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">課程資料查詢</span>
      </nav>
      <header className="course-catalog-heading">
        <p className="portal-kicker">Course catalog</p>
        <h1>課程資料查詢</h1>
        <p>以下為示範開課資料，非來源學校的正式課表。</p>
      </header>
      <Form className="course-catalog-filters" method="get">
        <label>學期
          <select name="semester" defaultValue={semester}>
            {semesters.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>系所
          <select name="department" defaultValue={department}>
            {departments.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <button type="submit">查詢</button>
      </Form>
      {courses.length ? (
        <div className="course-catalog-table-wrap">
          <table className="course-catalog-table">
            <thead><tr>
              <th scope="col">課程</th><th scope="col">年級／類別</th><th scope="col">學分</th>
              <th scope="col">班別／上限</th><th scope="col">授課教師</th><th scope="col">上課時段</th>
            </tr></thead>
            <tbody>{courses.map((course) => (
              <tr key={course.offering_id}>
                <td><strong>{course.name}</strong><small>{course.course_code}</small></td>
                <td>{course.grade} 年級 · {course.category === "required" ? "必修" : "選修"}</td>
                <td>{course.credits}</td>
                <td>{course.section} 班 · {course.capacity} 人</td>
                <td>{course.teacher_name}</td>
                <td>{course.schedules.length ? course.schedules.map((schedule) => <div key={schedule}>{schedule}</div>) : "時段未定"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="course-catalog-empty">此學期沒有符合條件的開課資料。</p>}
    </div>
  );
}
