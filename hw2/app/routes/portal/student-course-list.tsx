import { Form, Link } from "react-router";
import type { StudentOffering } from "../../lib/enrollments.server";

const weekdays = ["", "一", "二", "三", "四", "五", "六", "日"];

export function formatSchedules(offering: StudentOffering) {
  return offering.schedules.length
    ? offering.schedules.map((item) => `週${weekdays[item.weekday]} ${item.startPeriod}–${item.endPeriod} 節 · ${item.classroom}`)
    : ["時段未定"];
}

type Props = {
  title: string;
  description: string;
  offerings: StudentOffering[];
  mode: "add" | "drop" | "result";
  error?: string;
  message?: string;
};

export function StudentCourseList({ title, description, offerings, mode, error, message }: Props) {
  return (
    <div className="portal-page course-catalog-page">
      <nav aria-label="麵包屑" className="portal-breadcrumb">
        <Link to="/home">系統首頁</Link><span aria-hidden="true">/</span><span aria-current="page">{title}</span>
      </nav>
      <header className="course-catalog-heading">
        <p className="portal-kicker">115-1 Course selection</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      {error ? <p className="student-course-message is-error" role="alert">{error}</p> : null}
      {message ? <p className="student-course-message" role="status">{message}</p> : null}
      {offerings.length ? (
        <div className="course-catalog-table-wrap">
          <table className="course-catalog-table">
            <thead><tr>
              <th scope="col">課程</th><th scope="col">年級／類別</th><th scope="col">學分</th>
              <th scope="col">教師／時段</th><th scope="col">名額</th><th scope="col">狀態</th>
            </tr></thead>
            <tbody>{offerings.map((offering) => {
              const status = offering.selected ? "已選" : offering.enrolledCount >= offering.capacity ? "額滿"
                : !offering.schedules.length ? "時段未定" : offering.conflict ? "時段衝突" : "可加選";
              return (
                <tr key={offering.id}>
                  <td><strong>{offering.name}</strong><small>{offering.code} · {offering.section} 班</small></td>
                  <td>{offering.grade} 年級 · {offering.category === "required" ? "必修" : "選修"}</td>
                  <td>{offering.credits}</td>
                  <td>{offering.teacherName}{formatSchedules(offering).map((schedule) => <small key={schedule}>{schedule}</small>)}</td>
                  <td>{offering.enrolledCount} / {offering.capacity}</td>
                  <td>{mode === "add" && !offering.selected && status === "可加選" ? (
                    <Form method="post"><input type="hidden" name="offeringId" value={offering.id} /><button className="student-course-button" type="submit">加選</button></Form>
                  ) : mode === "drop" ? (
                    <Form method="post"><input type="hidden" name="offeringId" value={offering.id} /><button className="student-course-button" type="submit">退選</button></Form>
                  ) : <span>{status}</span>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : <p className="course-catalog-empty">{mode === "add" ? "目前沒有可查詢的本系課程。" : "目前沒有已選課程。"}</p>}
    </div>
  );
}
