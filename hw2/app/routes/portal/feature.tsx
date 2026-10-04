import { Form, Link, data, redirect, useNavigation, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/feature";
import type { ReactNode } from "react";
import { requireRole } from "../../lib/auth.server";
import { getPortalNavigationItem } from "../../lib/portal-navigation";
import { ACTIVE_SEMESTER } from "../../lib/enrollments.server";
import { getAcademicData, saveAcademicAction } from "../../lib/academic.server";
import { TeacherTimetable } from "../../components/teacher-timetable";
import { Pagination } from "../../components/pagination";

function navigationItem(request: Request) {
  const item = getPortalNavigationItem(new URL(request.url).pathname);
  if (!item) throw new Response("Not Found", { status: 404 });
  return item;
}

export async function loader({ request }: Route.LoaderArgs) {
  const item = navigationItem(request);
  const user = await requireRole(request, ...item.roles);
  const params = new URL(request.url).searchParams;
  const module = getAcademicData(user, item.path, params);
  const requestedPage = Number(params.get("page"));
  const totalItems = module.records.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / 20));
  const currentPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1;
  const filterParams = new URLSearchParams(params);
  filterParams.delete("page");
  filterParams.delete("saved");
  if (filterParams.has("offeringId")) {
    if (module.offeringId) filterParams.set("offeringId", String(module.offeringId));
    else filterParams.delete("offeringId");
  }
  return { item, role: user.role, activeSemester: ACTIVE_SEMESTER, ...module, records: module.records.slice((currentPage - 1) * 20, currentPage * 20), pagination: { currentPage, totalPages, totalItems }, filterParams: filterParams.toString(), saved: params.get("saved") === "1" };
}

export async function action({ request }: Route.ActionArgs) {
  const item = navigationItem(request);
  const user = await requireRole(request, ...item.roles);
  if (request.method !== "POST") throw new Response("Method Not Allowed", { status: 405 });
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) throw new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  const values: Record<string, string> = {};
  for (const [key, value] of form) if (typeof value === "string") values[key] = value.slice(0, 1000);
  if (typeof form.get("intent") !== "string") return data({ error: "請選擇操作。", values }, { status: 400 });
  const error = saveAcademicAction(user, item.path, form);
  if (error) return data({ error, values }, { status: 400 });
  const url = new URL(request.url);
  url.searchParams.set("saved", "1");
  return redirect(url.pathname + url.search);
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data ? `${data.item.label}｜校務資訊系統` : "校務資訊系統" }];
}

function Editor({ title, intent, children, submitLabel = "儲存／送出" }: { title: string; intent: string; children: ReactNode; submitLabel?: string }) {
  const busy = useNavigation().state !== "idle";
  return <Form method="post" className="academic-editor"><fieldset disabled={busy}><legend>{title}</legend>
    {children}<button className="student-course-button" type="submit" name="intent" value={intent}>{busy ? "處理中…" : submitLabel}</button>
  </fieldset></Form>;
}

export default function PortalFeature({ loaderData: d, actionData }: Route.ComponentProps) {
  const path = d.item.path;
  const applicationClosed = (path === "/course/withdraw" && !d.withdrawalOpen)
    || (path === "/course/general" && !d.generalSelectionOpen);
  const allHistory = ["/query/history-grades", "/student/reward-punishment", "/teacher/discipline"].includes(path);
  const teacher = d.role === "teacher";
  const active = d.semester === d.activeSemester;
  const busy = useNavigation().state !== "idle";
  const failed = actionData?.values || {};
  const field = (key: string, fallback = "") => failed[key] ?? fallback;
  const pageHref = (page: number) => { const p = new URLSearchParams(d.filterParams); if (page > 1) p.set("page", String(page)); return `${path}${p.size ? `?${p}` : ""}`; };
  const courseOptions = d.courses.map((c) => <option key={c.id} value={c.id}>{c.name}（{c.code} · {c.section} 班）</option>);
  const courseField = <label>課程<select name="offeringId" defaultValue={field("offeringId", String(d.offeringId || ""))} required><option value="">請選擇課程</option>{courseOptions}</select></label>;
  const studentField = <label>學生<select name="studentId" defaultValue={field("studentId")} required><option value="">請選擇學生</option>{d.students.map((s) => <option key={s.id} value={s.id}>{s.username} · {s.name} · {s.grade} 年級</option>)}</select></label>;
  const selectedCourse = <input type="hidden" name="offeringId" value={d.offeringId || ""} />;
  const reason = <label>事由<textarea name="reason" maxLength={1000} defaultValue={field("reason")} required rows={3} /></label>;
  const dateField = <label>日期<input name="date" type="date" defaultValue={field("date")} required /></label>;
  const scopedCourse = teacher && ["/teacher/roster", "/teacher/grades", "/teacher/alerts", "/teacher/attendance"].includes(path);
  const timetable = path === "/query/teacher-schedule" || path === "/query/classroom-schedule";
  const application = ["/course/withdraw", "/course/general", "/student/military-service"].includes(path);
  const title = path === "/query/teacher-schedule" ? d.teachers.find((t) => t.id === d.teacherId)?.name || "教師" : d.classroom || "教室";

  return <div className="portal-page course-catalog-page">
    <nav aria-label="麵包屑" className="portal-breadcrumb"><Link to="/home">系統首頁</Link><span aria-hidden="true">/</span><span aria-current="page">{d.item.label}</span></nav>
    <header className="course-catalog-heading"><p className="portal-kicker">{allHistory ? "歷年資料" : d.semester} · {teacher ? "Teacher" : "Student"}</p><h1>{d.item.label}</h1>{d.note && !applicationClosed ? <p>{d.note}</p> : null}</header>
    {!applicationClosed && (actionData?.error ? <p className="student-course-message is-error" role="alert">{actionData.error}</p> : d.saved ? <p className="student-course-message" role="status">{path === "/course/withdraw" ? "停修已完成，已移除選課並留下停修紀錄。" : "資料已儲存。"}</p> : null)}
    {path === "/course/withdraw" ? <p className="student-course-message">目前狀態：{d.withdrawalOpen ? "全校開放停修申請" : "全校關閉停修申請"}</p> : null}
    {path === "/course/general" ? <p className="student-course-message">目前狀態：{d.generalSelectionOpen ? "全校開放通識初選" : "全校關閉通識初選"}</p> : null}
    {!applicationClosed ? <>
    {!allHistory ? <Form key={`${path}-${d.semester}-${d.offeringId}-${d.teacherId}-${d.classroom}`} method="get" className="course-catalog-filters">
      <label>學期<select name="semester" defaultValue={d.semester}>{d.semesters.map((s) => <option key={s}>{s}</option>)}</select></label>
      {scopedCourse ? <label>授課課程<select name="offeringId" defaultValue={String(d.offeringId || "")}><option value="">{d.courses.length ? "請選擇課程" : "目前沒有授課課程"}</option>{courseOptions}</select></label> : null}
      {path === "/query/teacher-schedule" ? <label>教師<select name="teacherId" defaultValue={String(d.teacherId || "")}><option value="">請選擇教師</option>{d.teachers.map((t) => <option key={t.id} value={t.id}>{t.department} · {t.name}</option>)}</select></label> : null}
      {path === "/query/classroom-schedule" ? <label>教室<select name="classroom" defaultValue={d.classroom}><option value="">請選擇教室</option>{d.classrooms.map((c) => <option key={c}>{c}</option>)}</select></label> : null}
      <button type="submit">查詢</button>
    </Form> : null}
    {d.summary.length ? <dl className="academic-summary">{d.summary.map((s) => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}</dl> : null}
    {!active && !allHistory && (teacher || application || path.startsWith("/entry/")) ? <p className="student-course-message">歷史學期僅供查詢；登錄與申請僅開放 {d.activeSemester}。</p> : null}
    <div key={`${path}-${d.semester}-${d.offeringId}-${JSON.stringify(failed)}`}>
      {active && path === "/teacher/courses" && d.courses.length ? <Editor title="通識初選設定" intent="general-setting">{courseField}<label>通識課程<select name="generalEducation" defaultValue={field("generalEducation", "1")}><option value="1">開放通識初選</option><option value="0">一般課程</option></select></label><p>設定僅影響這門開課的初選清單，不會更動已選學生。</p></Editor> : null}
      {active && path === "/teacher/grades" && d.students.length ? <Editor title="登錄／更正成績" intent="grade">{selectedCourse}{studentField}<label>分數<input type="number" name="score" min={0} max={100} step="0.01" defaultValue={field("score")} required /></label><label>公布狀態<select name="published" defaultValue={field("published", "0")}><option value="0">草稿</option><option value="1">公布給學生</option></select></label></Editor> : null}
      {active && path === "/teacher/alerts" && d.students.length ? <Form method="post" className="academic-editor"><fieldset disabled={busy}><legend>期中預警</legend>{selectedCourse}{studentField}<label>預警原因<textarea name="reason" maxLength={1000} defaultValue={field("reason")} rows={3} /></label><button className="student-course-button" name="intent" value="alert">儲存預警</button><button className="academic-secondary" name="intent" value="clear-alert">解除預警</button></fieldset></Form> : null}
      {active && path === "/teacher/attendance" && d.students.length ? <Editor title="登錄／更正出缺勤" intent="attendance">{selectedCourse}{studentField}{dateField}<label>節次<input type="number" name="period" min={1} max={14} defaultValue={field("period")} required /></label><label>狀態<select name="status" defaultValue={field("status", "absent")}><option value="absent">缺課</option><option value="late">遲到</option><option value="leave">請假</option><option value="present">出席（清除該節紀錄）</option></select></label><label>備註<textarea name="note" maxLength={1000} defaultValue={field("note")} rows={2} /></label></Editor> : null}
      {path === "/teacher/discipline" && d.students.length ? <Editor title="獎懲登錄" intent="discipline">{studentField}{dateField}<label>類型<select name="kind" defaultValue={field("kind", "reward")}><option value="reward">獎勵</option><option value="punishment">懲處</option></select></label>{reason}</Editor> : null}
      {active && application && (path !== "/course/withdraw" || d.withdrawalOpen) && (path === "/student/military-service" || d.courses.length > 0) ? <Editor title={path === "/course/withdraw" ? "申請停修" : "新增申請"} intent="apply" submitLabel={path === "/course/withdraw" ? "送出停修（立即生效）" : undefined}>{path !== "/student/military-service" ? courseField : null}{reason}</Editor> : null}
      {active && path === "/entry/teaching-evaluation" && d.courses.length ? <Editor title="填寫／更新教學評量" intent="evaluation">{courseField}<label>整體評分<select name="rating" defaultValue={field("rating", "5")}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} · {n === 1 ? "非常不滿意" : n === 5 ? "非常滿意" : n === 3 ? "普通" : n === 2 ? "不滿意" : "滿意"}</option>)}</select></label><label>評論（選填）<textarea name="comment" maxLength={1000} defaultValue={field("comment")} rows={3} /></label></Editor> : null}
      {active && path === "/teacher/questionnaires" && d.courses.length ? <Editor title="發布課程問卷" intent="questionnaire">{courseField}<label>問卷名稱<input name="title" maxLength={100} defaultValue={field("title")} required /></label><label>問題<textarea name="question" maxLength={1000} defaultValue={field("question")} rows={3} required /></label></Editor> : null}
    </div>
    {timetable ? (d.teacherId || d.classroom ? <>
      {d.lessons.length ? <TeacherTimetable lessons={d.lessons} teacherName={title} semester={d.semester} title={`${title}課表`} /> : <p className="course-catalog-empty">此學期沒有排課資料。</p>}
      {d.lessons.some((l) => l.weekday === null) ? <section className="student-unscheduled"><h2>時段未定</h2><ul>{d.lessons.filter((l) => l.weekday === null).map((l) => <li key={l.offeringId}>{l.name} · {l.section} 班</li>)}</ul></section> : null}
    </> : <p className="course-catalog-empty">請選擇{path === "/query/teacher-schedule" ? "教師" : "教室"}後查詢。</p>) : null}
    {d.columns.length ? <>
      {d.records.length ? <div className="course-catalog-table-wrap"><table className="course-catalog-table academic-table"><caption className="sr-only">{d.item.label}</caption><thead><tr>{d.columns.map((c) => <th scope="col" key={c}>{c}</th>)}{(application || path === "/teacher/applications" || path === "/teacher/discipline") ? <th scope="col">操作</th> : null}</tr></thead><tbody>{d.records.map((r) => <tr key={r.id}>{r.cells.map((cell, i) => <td key={i}>{path === "/teacher/courses" && i === 0 ? <><Link to={`/teacher/roster?semester=${d.semester}&offeringId=${r.id}`}>{cell}</Link><small><Link to={`/teacher/grades?semester=${d.semester}&offeringId=${r.id}`}>登錄成績</Link></small></> : cell || "—"}</td>)}
        {application || path === "/teacher/applications" || path === "/teacher/discipline" ? <td>
          {application && active && r.status === "pending" ? <Form method="post"><input type="hidden" name="recordId" value={r.id} /><button className="academic-secondary" name="intent" value="cancel-application" disabled={busy}>取消申請</button></Form> : null}
          {path === "/teacher/applications" && active && r.status === "pending" ? <Form method="post" className="academic-review"><input type="hidden" name="recordId" value={r.id} /><input type="hidden" name="intent" value="review" /><label>審核意見<textarea name="reviewNote" required maxLength={1000} rows={2} defaultValue={failed.recordId === String(r.id) ? field("reviewNote") : ""} /></label><button className="student-course-button" name="decision" value="approved" disabled={busy}>核准</button><button className="academic-secondary" name="decision" value="rejected" disabled={busy}>駁回</button></Form> : null}
          {path === "/teacher/discipline" ? <Form method="post"><input type="hidden" name="recordId" value={r.id} /><button className="academic-secondary" name="intent" value="delete-discipline" disabled={busy}>移除錯誤紀錄</button></Form> : null}
          {(application || path === "/teacher/applications") && (r.status !== "pending" || !active) ? "—" : null}
        </td> : null}
      </tr>)}</tbody></table></div> : <p className="course-catalog-empty">目前沒有符合條件的資料。</p>}
      <p className="admin-pagination-summary">共 {d.pagination.totalItems} 筆，第 {d.pagination.currentPage} / {d.pagination.totalPages} 頁</p><Pagination {...d.pagination} getPageHref={pageHref} label={`${d.item.label}分頁`} />
    </> : null}
    {(path === "/entry/questionnaire" || path === "/teacher/questionnaires") ? <section className="academic-surveys" aria-label="課程問卷">{d.surveys.length ? d.surveys.map((q) => <article key={q.id} className="academic-survey"><h2>{q.title}</h2><p>{q.courseName} · {q.isOpen ? "開放中" : "已關閉"}{teacher ? ` · ${q.count} 份回答` : ""}</p><p>{q.question}</p>
      {teacher ? (active ? <Form method="post"><input type="hidden" name="questionnaireId" value={q.id} /><input type="hidden" name="isOpen" value={q.isOpen ? "0" : "1"} /><button className="academic-secondary" name="intent" value="toggle-questionnaire" disabled={busy}>{q.isOpen ? "關閉問卷" : "重新開放"}</button></Form> : null)
        : q.isOpen && active ? <Form method="post"><input type="hidden" name="questionnaireId" value={q.id} /><label>你的回答<textarea key={`${q.answer}-${failed.questionnaireId === String(q.id) ? field("answer") : ""}`} name="answer" maxLength={1000} required rows={3} defaultValue={failed.questionnaireId === String(q.id) ? field("answer") : q.answer} /></label><button className="student-course-button" name="intent" value="response" disabled={busy}>{q.answer ? "更新回答" : "送出回答"}</button></Form> : <p>你的回答：{q.answer || "尚未填寫"}</p>}
    </article>) : <p className="course-catalog-empty">目前沒有課程問卷。</p>}</section> : null}
    </> : null}
    <Link className="portal-back-link" to="/home">返回系統首頁</Link>
  </div>;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const status = isRouteErrorResponse(error) ? error.status : 500;
  return <div className="portal-page"><section className="portal-feature-card"><h1>{status === 403 ? "沒有此功能的存取權限" : status === 400 ? "查詢條件無效" : status === 404 ? "找不到頁面" : "資料暫時無法載入"}</h1><p>{status === 500 ? "請確認已套用專案 migrations，再重新載入。" : "請重新選擇功能與查詢條件。"}</p><Link className="portal-back-link" to="/home">返回系統首頁</Link></section></div>;
}
