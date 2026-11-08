import type { ReactNode } from "react";
import { Link } from "react-router";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import SchoolOutlined from "@mui/icons-material/SchoolOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import AssignmentOutlined from "@mui/icons-material/AssignmentOutlined";

export function AuthLayout({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  return <main className="auth-layout">
    <aside className="auth-introduction">
      <Link to="/" className="auth-brand"><SchoolOutlined sx={{ fontSize: 30 }} /><span>校務資訊系統<small>Campus Portal</small></span></Link>
      <div className="auth-introduction-copy"><Chip label={admin ? "管理員專區" : "學生與教師專區"} className="auth-role-chip" />
        <h2>{admin ? <>讓校務管理，<br />清楚而有序。</> : <>讓校園日常，<br />從這裡開始。</>}</h2>
        <p>{admin ? "集中管理帳號與校務設定，讓每一項作業順利進行。" : "課程、學習與教學事務，在同一個地方輕鬆掌握。"}</p>
        <ul className="auth-features"><li><MenuBookOutlined />{admin ? "學生與教師帳號管理" : "課程查詢與選課作業"}</li><li><CalendarMonthOutlined />{admin ? "選課與停修開放設定" : "個人課表與授課安排"}</li><li><AssignmentOutlined />{admin ? "校務查詢與作業設定" : "學習紀錄與教學事務"}</li></ul>
      </div>
      <small className="auth-aside-footer">HW2</small>
    </aside>
    <section className="auth-form-region"><Paper variant="outlined" className="auth-card">{children}</Paper><p className="auth-footer">校務資訊系統 · {admin ? "管理員入口" : "學生／教師入口"}</p></section>
  </main>;
}
