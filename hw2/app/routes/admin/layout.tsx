import { Form, Outlet } from "react-router";
import type { Route } from "./+types/layout";
import { requireAdmin } from "../../lib/admin-auth.server";
import { ADMIN_LOGOUT_PATH } from "../../lib/admin-paths";

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
      <Outlet />
    </div>
  );
}
