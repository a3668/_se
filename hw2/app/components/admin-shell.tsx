import type { ReactNode } from "react";
import { AppShell } from "./app-shell";
import { ADMIN_NAVIGATION } from "../lib/admin-navigation";
import { ADMIN_BASE_PATH, ADMIN_LOGOUT_PATH } from "../lib/admin-paths";

export function AdminShell({ children, username }: { children: ReactNode; username: string }) {
  return <AppShell username={username} roleLabel="管理員" groups={ADMIN_NAVIGATION}
    homePath={ADMIN_BASE_PATH} logoutPath={ADMIN_LOGOUT_PATH} reloadLogout>{children}</AppShell>;
}
