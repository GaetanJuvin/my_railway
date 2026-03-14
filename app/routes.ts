import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  // Auth routes (no layout)
  route("login", "routes/_auth.login.tsx"),
  route("signup", "routes/_auth.signup.tsx"),

  // Dashboard routes (with sidebar layout)
  layout("routes/_dashboard.tsx", [
    route("projects", "routes/_dashboard.projects.tsx"),
    route("projects/new", "routes/_dashboard.projects.new.tsx"),
  ]),
] satisfies RouteConfig;
