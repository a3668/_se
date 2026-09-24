import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { clearAdminSession } from "../../lib/admin-auth.server";
import { ADMIN_LOGIN_PATH } from "../../lib/admin-paths";

export function loader() {
  return redirect(ADMIN_LOGIN_PATH);
}

export async function action({ request }: Route.ActionArgs) {
  return redirect(ADMIN_LOGIN_PATH, {
    headers: { "Set-Cookie": await clearAdminSession(request) },
  });
}
