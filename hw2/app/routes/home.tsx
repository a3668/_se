import { Link, useRouteLoaderData, useLoaderData } from "react-router";
import { canAccessPortalPath } from "../lib/portal-navigation";
import type { loader as portalLoader } from "./portal/layout";
import { requireUser } from "../lib/auth.server";
import { getPortalDashboard } from "../lib/academic.server";

export async function loader({ request }: { request: Request }) {
  return getPortalDashboard(await requireUser(request));
}

export function meta() {
  return [
    { title: "系統首頁｜校務資訊系統" },
    { name: "description", content: "校務資訊系統首頁。" },
  ];
}

const quickLinks = [
  { label: "我的課表", path: "/query/my-schedule", description: "查看目前的課程安排" },
  { label: "選課結果", path: "/course/result", description: "查詢本學期選課結果" },
  { label: "學期成績", path: "/query/semester-grades", description: "查看各科目成績資訊" },
  { label: "缺曠明細", path: "/student/absence-details", description: "查詢個人出缺勤紀錄" },
];
const teacherQuickLinks = [
  { label: "我的課表", path: "/query/my-schedule", description: "查看本學期授課時段" },
  { label: "修課名單", path: "/teacher/roster", description: "查看自己授課的學生" },
  { label: "成績登錄", path: "/teacher/grades", description: "儲存草稿或公布成績" },
  { label: "申請審核", path: "/teacher/applications", description: "處理初選與兵役申請" },
];

const roleLabels = {
  student: "學生",
  teacher: "老師",
} as const;

export default function Home() {
  const dashboard = useLoaderData<typeof loader>();
  const portalData = useRouteLoaderData<typeof portalLoader>("routes/portal/layout");
  if (!portalData) return null;

  return (
    <div className="portal-page portal-home">
      <section className="portal-welcome">
        <div>
          <p className="portal-kicker">Welcome back</p>
          <h1>{dashboard.name}，歡迎回來</h1>
          <p>{dashboard.semester} · {dashboard.department}。{portalData.user.role === "teacher" ? "從授課名單開始，管理成績、出缺勤與學生申請。" : "查看課表、辦理選課，掌握自己的學習與申請進度。"}</p>
        </div>
        <dl className="portal-profile-summary">
          <div>
            <dt>登入帳號</dt>
            <dd>{portalData.user.username}</dd>
          </div>
          <div>
            <dt>身分類別</dt>
            <dd>{roleLabels[portalData.user.role]}</dd>
          </div>
        </dl>
      </section>

      <dl className="academic-summary">
        <div><dt>{portalData.user.role === "teacher" ? "授課門數" : "已選門數"}</dt><dd>{dashboard.courses.length}</dd></div>
        <div><dt>{portalData.user.role === "teacher" ? "授課學分" : "已選學分"}</dt><dd>{dashboard.courses.reduce((sum, c) => sum + c.credits, 0)}</dd></div>
        <div><dt>待審申請</dt><dd>{dashboard.pending}</dd></div>
      </dl>

      <section className="portal-section" aria-labelledby="quick-links-title">
        <div className="portal-section-heading">
          <div>
            <p className="portal-kicker">Quick access</p>
            <h2 id="quick-links-title">常用功能</h2>
          </div>
          <span>快速前往常用服務</span>
        </div>
        <div className="portal-quick-grid">
          {(portalData.user.role === "teacher" ? teacherQuickLinks : quickLinks)
            .filter((item) => canAccessPortalPath(item.path, portalData.user.role))
            .map((item, index) => (
              <Link key={item.path} to={item.path}>
                <span className="portal-quick-number">{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
                <span className="portal-quick-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
        </div>
      </section>

      <section className="portal-section" aria-labelledby="notice-title">
        <div className="portal-section-heading">
          <div>
            <p className="portal-kicker">Academic overview</p>
            <h2 id="notice-title">{dashboard.semester} 課程概況</h2>
          </div>
        </div>
        {dashboard.courses.length ? <div className="academic-course-cards">{dashboard.courses.map((c) => <Link key={c.id} to={portalData.user.role === "teacher" ? `/teacher/roster?offeringId=${c.id}` : "/course/result"}>
          <small>{c.code} · {c.section} 班</small><strong>{c.name}</strong><span>{c.credits} 學分 · {portalData.user.role === "teacher" ? `${c.enrolledCount} 位學生` : c.teacherName}</span>
        </Link>)}</div> : <p className="course-catalog-empty">目前沒有{portalData.user.role === "teacher" ? "授課" : "已選"}課程。</p>}
      </section>
    </div>
  );
}
