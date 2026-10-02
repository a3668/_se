import { TeacherTimetable } from "../../components/teacher-timetable";
import { Link } from "react-router";
import type { Route } from "./+types/account-detail";
import { requireAdmin } from "../../lib/admin-auth.server";
import { accountLabel, accountListSearch, accountPath } from "../../lib/admin-accounts";
import { getAccount, parseAccountId, requireAccountKind } from "../../lib/admin-accounts.server";
import { getTeacherSchedule } from "../../lib/teacher-schedule.server";

export function meta() {
  return [{ title: "查看帳號資料｜HW2" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const kind = requireAccountKind(params.kind);
  const account = getAccount(kind, parseAccountId(params.userId));
  if (!account) throw new Response("Not Found", { status: 404 });
  const url = new URL(request.url);
  return {
    kind,
    account,
    schedule: kind === "teachers" ? getTeacherSchedule(account.user_id) : null,
    listSearch: accountListSearch(kind, url.search),
    notice: url.searchParams.has("created") ? "帳號已新增。"
      : url.searchParams.has("saved") ? "資料已儲存。" : null,
  };
}

export default function AccountDetail({ loaderData }: Route.ComponentProps) {
  const { kind, account, listSearch, notice, schedule } = loaderData;
  const basePath = accountPath(kind);
  return (
    <main className={`admin-main${kind === "students" ? " admin-narrow" : ""}`}>
      <p className="admin-eyebrow">Account Management</p>
      <h1>{accountLabel(kind)}資料</h1>
      {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
      <dl className="admin-account-details">
        <div><dt>{kind === "students" ? "學號" : "教師編號"}</dt><dd>{account.username}</dd></div>
        <div><dt>姓名</dt><dd>{account.name}</dd></div>
        <div><dt>生日</dt><dd>{account.birth_date}</dd></div>
        <div><dt>系所</dt><dd>{account.department}</dd></div>
        {kind === "students" ? <div><dt>年級</dt><dd>{account.grade} 年級</dd></div> : null}
      </dl>
      <div className="admin-actions">
        <Link className="admin-primary-link" to={`${basePath}/${account.user_id}/edit${listSearch}`}>編輯</Link>
        <Link to={`${basePath}${listSearch}`}>返回列表</Link>
      </div>
      {schedule ? (
        <section className="admin-teacher-schedule" aria-labelledby="teacher-schedule-heading">
          <h2 id="teacher-schedule-heading">教師課表</h2>
          <p className="admin-help">{schedule.semester} 學期</p>
          {schedule.lessons.length ? (
            <>
              <TeacherTimetable lessons={schedule.lessons} teacherName={account.name} semester={schedule.semester} />
              {schedule.lessons.some((lesson) => lesson.weekday === null) ? (
                <div>
                  <h3>尚未排時段的課程</h3>
                  <ul>{schedule.lessons.filter((lesson) => lesson.weekday === null).map((lesson) => (
                    <li key={lesson.offeringId}>{lesson.name}（{lesson.code} · {lesson.section} 班）</li>
                  ))}</ul>
                </div>
              ) : null}
            </>
          ) : <p className="admin-empty">此教師本學期尚無授課資料。</p>}
        </section>
      ) : null}
    </main>
  );
}
