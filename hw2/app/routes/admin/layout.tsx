import { Outlet } from "react-router";
import { AdminShell } from "../../components/admin-shell";
import type { Route } from "./+types/layout";
import { requireAdmin } from "../../lib/admin-auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  return { admin: await requireAdmin(request) };
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  return <AdminShell username={loaderData.admin.username}><Outlet /></AdminShell>;
}
