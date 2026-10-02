import { Form, Link, Outlet } from "react-router";
import type { Route } from "./+types/layout";
import { requireAdmin } from "../../lib/admin-auth.server";
import { ADMIN_BASE_PATH, ADMIN_LOGOUT_PATH, ADMIN_STUDENTS_PATH, ADMIN_TEACHERS_PATH } from "../../lib/admin-paths";

export async function loader({ request }: Route.LoaderArgs) {
  return { admin: await requireAdmin(request) };
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  return (
    <div className="admin-layout">
      <header className="admin-header">
        <span>HW2 管理後台</span>
        <div>
          <span>{loaderData.admin.username}</span>
          <Form action={ADMIN_LOGOUT_PATH} method="post" reloadDocument>
            <button type="submit">登出</button>
          </Form>
        </div>
      </header>
      <nav className="admin-nav" aria-label="管理功能">
        <Link to={ADMIN_BASE_PATH}>首頁</Link>
        <Link to={ADMIN_STUDENTS_PATH}>學生管理</Link>
        <Link to={ADMIN_TEACHERS_PATH}>教師管理</Link>
      </nav>
      <Outlet />
    </div>
  );
}
