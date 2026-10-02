import { Link, Outlet } from "react-router";
import { AdminShell } from "../../components/admin-shell";
import type { Route } from "./+types/layout";
import { requireAdmin } from "../../lib/admin-auth.server";
import { ADMIN_BASE_PATH, ADMIN_STUDENTS_PATH, ADMIN_TEACHERS_PATH } from "../../lib/admin-paths";

export async function loader({ request }: Route.LoaderArgs) {
  return { admin: await requireAdmin(request) };
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  return (
    <AdminShell username={loaderData.admin.username}>
      <nav className="admin-nav" aria-label="管理功能">
        <Link to={`${ADMIN_BASE_PATH}/`} reloadDocument>首頁</Link>
        <Link to={ADMIN_STUDENTS_PATH}>學生管理</Link>
        <Link to={ADMIN_TEACHERS_PATH}>教師管理</Link>
      </nav>
      <Outlet />
    </AdminShell>
  );
}
