import { redirect } from "react-router";
import type { Route } from "./+types/index";
import { getCurrentUser } from "../lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  throw redirect(user ? "/home" : "/login");
}
