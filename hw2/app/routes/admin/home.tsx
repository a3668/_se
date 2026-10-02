import { Link } from "react-router";
import { ADMIN_STUDENTS_PATH, ADMIN_TEACHERS_PATH } from "../../lib/admin-paths";

export function meta() {
  return [{ title: "管理後台｜HW2" }, { name: "robots", content: "noindex, nofollow" }];
}

export default function AdminHome() {
  return (
    <main className="admin-home">
      <p className="admin-eyebrow">Administration</p>
      <h1>管理後台</h1>
      <p>管理學生與教師帳號及基本資料。</p>
      <div className="admin-home-links">
        <Link to={ADMIN_STUDENTS_PATH}>學生管理</Link>
        <Link to={ADMIN_TEACHERS_PATH}>教師管理</Link>
      </div>
    </main>
  );
}
