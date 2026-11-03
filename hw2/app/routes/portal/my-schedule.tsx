import { PageHeading, FilterForm, SelectControl, ActionButton, EmptyState } from "../../components/ui";
import { TeacherTimetable } from "../../components/teacher-timetable";
import { Link } from "react-router";
import type { Route } from "./+types/my-schedule";
import { requireUser } from "../../lib/auth.server";
import { getSemesterFilter, getStudentOfferings } from "../../lib/enrollments.server";
import { getTeacherSchedule } from "../../lib/teacher-schedule.server";

export function meta() { return [{ title: "我的課表｜校務資訊系統" }]; }

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { semester, semesters } = getSemesterFilter(request);
  if (user.role === "teacher") {
    const { lessons } = getTeacherSchedule(user.id, semester);
    return {
      role: user.role,
      semester,
      semesters,
      lessons,
      courseCount: new Set(lessons.map((lesson) => lesson.offeringId)).size,
      unscheduled: lessons.filter((lesson) => lesson.weekday === null),
    };
  }
  const offerings = getStudentOfferings(user.id, semester).filter((offering) => offering.selected);
  return {
    role: user.role,
    semester,
    semesters,
    lessons: offerings.flatMap((offering) => offering.schedules.map((schedule) => ({
      offeringId: offering.id,
      code: offering.code,
      name: offering.name,
      section: offering.section,
      ...schedule,
    }))),
    courseCount: offerings.length,
    unscheduled: offerings.filter((offering) => !offering.schedules.length).map((offering) => ({
      offeringId: offering.id,
      code: offering.code,
      name: offering.name,
      section: offering.section,
    })),
  };
}

export default function MySchedule({ loaderData }: Route.ComponentProps) {
  const { role, semester, semesters, lessons, courseCount, unscheduled } = loaderData;
  const teacher = role === "teacher";

  return (
    <div className="portal-page course-catalog-page">
      <nav aria-label="麵包屑" className="portal-breadcrumb"><Link to="/home">系統首頁</Link><span aria-hidden="true">/</span><span aria-current="page">我的課表</span></nav>
      <PageHeading title="我的課表" context={`${semester} · 課表查詢`} description={`顯示 ${semester} ${teacher ? "授課" : "已選"}課程。`} />
      <FilterForm method="get" key={semester} className="course-catalog-filters"><label>學期<SelectControl name="semester" defaultValue={semester}>{semesters.map((s) => <option key={s}>{s}</option>)}</SelectControl></label><ActionButton type="submit">查詢</ActionButton></FilterForm>
      {courseCount ? (
        <TeacherTimetable lessons={lessons} teacherName="我的課表" semester={semester} title="我的課表" />
      ) : <EmptyState className="course-catalog-empty">{teacher ? "目前沒有授課課程。" : <>目前沒有已選課程。<Link to="/course/add">前往加選</Link></>}</EmptyState>}
      {unscheduled.length ? (
        <section className="student-unscheduled"><h2>尚未排時段的課程</h2><ul>{unscheduled.map((offering) => <li key={offering.offeringId}>{offering.name}（{offering.code} · {offering.section} 班）</li>)}</ul></section>
      ) : null}
      <p className="student-schedule-note">課表以資料庫{teacher ? "授課" : "已選"}課程為準。{courseCount ? `共 ${courseCount} 門課。` : ""}</p>
    </div>
  );
}
