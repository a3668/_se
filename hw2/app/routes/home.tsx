import { Link, useRouteLoaderData } from "react-router";
import { canAccessPortalPath } from "../lib/portal-navigation";
import type { loader as portalLoader } from "./portal/layout";

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

const roleLabels = {
  student: "學生",
  teacher: "老師",
} as const;

export default function Home() {
  const portalData = useRouteLoaderData<typeof portalLoader>("routes/portal/layout");
  if (!portalData) return null;

  return (
    <div className="portal-page portal-home">
      <section className="portal-welcome">
        <div>
          <p className="portal-kicker">Welcome back</p>
          <h1>歡迎使用校務資訊系統</h1>
          <p>您可以從左側功能選單開始，或直接選擇下方常用功能。</p>
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

      <section className="portal-section" aria-labelledby="quick-links-title">
        <div className="portal-section-heading">
          <div>
            <p className="portal-kicker">Quick access</p>
            <h2 id="quick-links-title">常用功能</h2>
          </div>
          <span>快速前往常用服務</span>
        </div>
        <div className="portal-quick-grid">
          {quickLinks
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
            <p className="portal-kicker">Announcements</p>
            <h2 id="notice-title">系統公告</h2>
          </div>
        </div>
        <div className="portal-notice">
          <span aria-hidden="true">i</span>
          <div>
            <strong>目前沒有最新公告</strong>
            <p>系統通知與重要訊息將顯示於此處。</p>
          </div>
        </div>
      </section>
    </div>
  );
}
