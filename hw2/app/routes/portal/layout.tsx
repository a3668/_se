import { Outlet } from "react-router";
import { AppShell } from "../../components/app-shell";
import type { Route } from "./+types/layout";
import { requireUser } from "../../lib/auth.server";
import { getPortalNavigationForRole } from "../../lib/portal-navigation";

export async function loader({ request }: Route.LoaderArgs) {
  return { user: await requireUser(request) };
}

const roleLabels = {
  student: "學生",
  teacher: "老師",
} as const;

export default function PortalLayout({ loaderData }: Route.ComponentProps) {
  return <AppShell username={loaderData.user.username} roleLabel={roleLabels[loaderData.user.role]}
    groups={getPortalNavigationForRole(loaderData.user.role)}><Outlet /></AppShell>;
}
