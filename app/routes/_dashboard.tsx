import { requireUser, logout } from "~/lib/auth.server";
import { Outlet, useLoaderData } from "react-router";
import { Sidebar } from "~/components/sidebar";
import type { Route } from "./+types/_dashboard";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user: { id: user.id, name: user.name, email: user.email } };
}

export async function action({ request }: Route.ActionArgs) {
  return logout(request);
}

export default function DashboardLayout() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="flex h-screen">
      <Sidebar user={user} />
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
