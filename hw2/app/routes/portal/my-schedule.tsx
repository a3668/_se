import { TeacherTimetable } from "../../components/teacher-timetable";
import { Link } from "react-router";
import type { Route } from "./+types/my-schedule";
import { requireUser } from "../../lib/auth.server";
import { getStudentOfferings } from "../../lib/enrollments.server";
import type { StudentOffering } from "../../lib/enrollments.server";


export function meta() { return [{ title: "我的課表｜校務資訊系統" }]; }

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return {
    role: user.role,
    offerings: user.role === "student"
      ? getStudentOfferings(user.id).filter((offering) => offering.selected)
      : [],
  };
}

export default function MySchedule({ loaderData }: Route.ComponentProps) {
  if (loaderData.role === "teacher") {
    return (
      <div className="portal-page portal-feature-page">
        <nav aria-label="麵包屑" className="portal-breadcrumb"><Link to="/home">系統首頁</Link><span aria-hidden="true">/</span><span aria-current="page">我的課表</span></nav>
        <section className="portal-feature-card"><h1>我的課表</h1><p>此功能目前建置中，後續將逐步開放使用。</p><Link className="portal-back-link" to="/home">返回系統首頁</Link></section>
      </div>
    );
  }

  const offerings = loaderData.offerings as StudentOffering[];
  const lessons = offerings.flatMap((offering) => offering.schedules.map((schedule) => ({
    offeringId: offering.id,
    code: offering.code,
    name: offering.name,
    section: offering.section,
    classroom: schedule.classroom,
    weekday: schedule.weekday,
    startPeriod: schedule.startPeriod,
    endPeriod: schedule.endPeriod,
  })));

  return (
    <div className="portal-page course-catalog-page">
      <nav aria-label="麵包屑" className="portal-breadcrumb"><Link to="/home">系統首頁</Link><span aria-hidden="true">/</span><span aria-current="page">我的課表</span></nav>
      <header className="course-catalog-heading"><p className="portal-kicker">115-1 Timetable</p><h1>我的課表</h1><p>顯示已選的 115-1 課程。</p></header>
      {offerings.length ? (
        <TeacherTimetable lessons={lessons} teacherName="我的課表" semester="115-1" title="我的課表" />
      ) : <p className="course-catalog-empty">目前沒有已選課程。<Link to="/course/add">前往加選</Link></p>}
      {offerings.some((offering) => offering.schedules.length === 0) ? (
        <section className="student-unscheduled"><h2>尚未排時段的課程</h2><ul>{offerings.filter((offering) => !offering.schedules.length).map((offering) => <li key={offering.id}>{offering.name}（{offering.code}）</li>)}</ul></section>
      ) : null}
      <p className="student-schedule-note">課表以資料庫已選課程為準。{offerings.length ? `共 ${offerings.length} 門課。` : ""}</p>
    </div>
  );
}
