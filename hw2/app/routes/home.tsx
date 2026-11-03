import Paper from "@mui/material/Paper";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import SchoolOutlined from "@mui/icons-material/SchoolOutlined";
import AssignmentOutlined from "@mui/icons-material/AssignmentOutlined";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import { EmptyState, PageHeading } from "../components/ui";
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
  const teacher = portalData.user.role === "teacher";
  const stats = [
    { label: teacher ? "授課門數" : "已選門數", value: dashboard.courses.length, unit: "門", icon: <MenuBookOutlined />, tone: "blue" },
    { label: teacher ? "授課學分" : "已選學分", value: dashboard.courses.reduce((sum, c) => sum + c.credits, 0), unit: "學分", icon: <SchoolOutlined />, tone: "teal" },
    { label: "待審申請", value: dashboard.pending, unit: "件", icon: <AssignmentOutlined />, tone: "amber" },
  ];
  return <div className="portal-page dashboard-page">
    <PageHeading title={`${dashboard.name}，歡迎回來`} context={<><Chip label={dashboard.semester} color="primary" variant="outlined" /><span>{dashboard.department} · {roleLabels[portalData.user.role]}</span></>}
      description={teacher ? "掌握授課概況，處理教學事務與學生申請。" : "掌握本學期課程，安排你的學習與校園生活。"}
      actions={<Chip icon={<CalendarMonthOutlined />} label="本學期概況" variant="outlined" />} />
    <dl className="dashboard-stats">{stats.map((stat) => <Paper component="div" variant="outlined" key={stat.label} className="dashboard-stat">
      <span className={`stat-icon ${stat.tone}`}>{stat.icon}</span><div><dt>{stat.label}</dt><dd>{stat.value}<small>{stat.unit}</small></dd></div>
    </Paper>)}</dl>
    <section className="dashboard-section" aria-labelledby="quick-links-title">
      <div className="section-heading"><div><h2 id="quick-links-title">常用功能</h2><p>快速前往你的校務服務</p></div></div>
      <div className="quick-link-grid">{(teacher ? teacherQuickLinks : quickLinks)
        .filter((item) => canAccessPortalPath(item.path, portalData.user.role)).map((item, index) => <Paper variant="outlined" key={item.path}>
          <CardActionArea component={Link} to={item.path} className="quick-link-card"><span className="quick-link-icon">{index === 0 ? <CalendarMonthOutlined /> : index === 1 ? <MenuBookOutlined /> : <AssignmentOutlined />}</span><strong>{item.label}</strong><small>{item.description}</small><ArrowForwardOutlined className="card-arrow" fontSize="small" /></CardActionArea>
        </Paper>)}</div>
    </section>
    <section className="dashboard-section" aria-labelledby="courses-title">
      <div className="section-heading"><div><h2 id="courses-title">{teacher ? "我的授課課程" : "我的已選課程"}</h2><p>{dashboard.semester} 學期課程概況</p></div><Chip label={`${dashboard.courses.length} 門課程`} variant="outlined" /></div>
      {dashboard.courses.length ? <div className="dashboard-course-grid">{dashboard.courses.map((course) => <Paper key={course.id} variant="outlined">
        <CardActionArea component={Link} to={teacher ? `/teacher/roster?offeringId=${course.id}` : "/course/result"} className="dashboard-course-card">
          <span className="course-card-code">{course.code} · {course.section} 班</span><h3>{course.name}</h3><div><Chip label={`${course.credits} 學分`} /><span>{teacher ? `${course.enrolledCount} 位學生` : course.teacherName}</span></div><span className="course-card-footer">{teacher ? "查看修課名單" : "查看選課結果"}<ArrowForwardOutlined fontSize="small" /></span>
        </CardActionArea>
      </Paper>)}</div> : <EmptyState>目前沒有{teacher ? "授課" : "已選"}課程。</EmptyState>}
    </section>
  </div>;
}
