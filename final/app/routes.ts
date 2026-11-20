import {
	type RouteConfig,
	index,
	layout,
	route,
} from "@react-router/dev/routes";

export default [
	layout("routes/layout.tsx", [
		index("routes/home.tsx"),
		route(":course", "routes/course.tsx"),
		route(":course/questions", "routes/questions.tsx"),
		route(":course/questions/:id", "routes/question.tsx"),
		route(":course/random", "routes/random.ts"),
	]),
] satisfies RouteConfig;
