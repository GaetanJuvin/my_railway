import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/_auth.login.tsx"),
  route("signup", "routes/_auth.signup.tsx"),
] satisfies RouteConfig;
