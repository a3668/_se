import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";
import { ADMIN_ROUTE_SEGMENT } from "./lib/admin-paths";

export default [
  index("routes/index.ts"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.ts"),
  layout("routes/portal/layout.tsx", [
    route("home", "routes/home.tsx"),
    route(":section/:feature", "routes/portal/feature.tsx"),
  ]),
  route(`${ADMIN_ROUTE_SEGMENT}/login`, "routes/admin/login.tsx"),
  route(`${ADMIN_ROUTE_SEGMENT}/logout`, "routes/admin/logout.ts"),
  route(ADMIN_ROUTE_SEGMENT, "routes/admin/layout.tsx", [
    index("routes/admin/home.tsx"),
    route(":kind", "routes/admin/accounts.tsx"),
    route(":kind/new", "routes/admin/account-new.tsx"),
    route(":kind/:userId", "routes/admin/account-edit.tsx"),
  ]),
] satisfies RouteConfig;
