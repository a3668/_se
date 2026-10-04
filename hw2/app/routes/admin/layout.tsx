import { Link, Outlet } from "react-router";
import { AdminShell } from "../../components/admin-shell";
import type { Route } from "./+types/layout";
import { requireAdmin } from "../../lib/admin-auth.server";
import { ADMIN_BASE_PATH, ADMIN_ENROLLMENT_SETTINGS_PATH, ADMIN_GENERAL_SELECTION_SETTINGS_PATH, ADMIN_STUDENTS_PATH, ADMIN_TEACHERS_PATH, ADMIN_WITHDRAWAL_SETTINGS_PATH } from "../../lib/admin-paths";

export async function loader({ request }: Route.LoaderArgs) {
  return { admin: await requireAdmin(request) };
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  return (
    <AdminShell username={loaderData.admin.username}>
      <nav className="admin-nav" aria-label="管理功能">
        <a href={`${ADMIN_BASE_PATH}/`}>首頁</a>
        <Link to={ADMIN_STUDENTS_PATH}>學生管理</Link>
        <Link to={ADMIN_TEACHERS_PATH}>教師管理</Link>
        <Link to={ADMIN_ENROLLMENT_SETTINGS_PATH}>加退選管理</Link>
        <Link to={ADMIN_WITHDRAWAL_SETTINGS_PATH}>停修管理</Link>
        <Link to={ADMIN_GENERAL_SELECTION_SETTINGS_PATH}>通識初選管理</Link>
      </nav>
      <Outlet />
    </AdminShell>
  );
}
