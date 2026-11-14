import {
	type RouteConfig,
	index,
	layout,
	route,
} from "@react-router/dev/routes";

export default [
	layout("routes/layout.tsx", [
		index("routes/home.tsx"),
		route("questions", "routes/questions.tsx"),
		route("questions/:id", "routes/question.tsx"),
	]),
] satisfies RouteConfig;
