import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";
import { ADMIN_ROUTE_SEGMENT } from "./lib/admin-paths";

export default [
  index("routes/index.ts"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.ts"),
  layout("routes/portal/layout.tsx", [
    route("home", "routes/home.tsx"),
    route("query/class-data", "routes/portal/course-catalog.tsx"),
    route("course/add", "routes/portal/course-add.tsx"),
    route("course/drop", "routes/portal/course-drop.tsx"),
    route("course/result", "routes/portal/course-result.tsx"),
    route("query/my-schedule", "routes/portal/my-schedule.tsx"),
    route(":section/:feature", "routes/portal/feature.tsx"),
  ]),
  route(`${ADMIN_ROUTE_SEGMENT}/login`, "routes/admin/login.tsx"),
  route(`${ADMIN_ROUTE_SEGMENT}/logout`, "routes/admin/logout.ts"),
  route(ADMIN_ROUTE_SEGMENT, "routes/admin/layout.tsx", [
    index("routes/admin/home.tsx"),
    route("enrollment-settings", "routes/admin/enrollment-settings.tsx"),
    route("withdrawal-settings", "routes/admin/withdrawal-settings.tsx"),
    route("general-selection-settings", "routes/admin/general-selection-settings.tsx"),
    route("midterm-alert-settings", "routes/admin/midterm-alert-settings.tsx"),
    route("semester-grade-settings", "routes/admin/semester-grade-settings.tsx"),
    route(":kind", "routes/admin/accounts.tsx"),
    route(":kind/new", "routes/admin/account-new.tsx"),
    route(":kind/:userId", "routes/admin/account-detail.tsx"),
    route(":kind/:userId/edit", "routes/admin/account-edit.tsx"),
  ]),
] satisfies RouteConfig;
