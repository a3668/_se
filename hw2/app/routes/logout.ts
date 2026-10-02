import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { clearUserSession } from "../lib/auth.server";

export function loader() {
  return redirect("/login");
}

export async function action({ request }: Route.ActionArgs) {
  return redirect("/login", {
    headers: {
      "Set-Cookie": await clearUserSession(request),
    },
  });
}
