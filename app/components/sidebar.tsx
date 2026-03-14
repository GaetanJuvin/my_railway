import { NavLink, Form } from "react-router";
import { Button } from "~/components/ui/button";
import { FolderOpen, LayoutDashboard } from "lucide-react";

interface SidebarProps {
  user: { id: string; name: string; email: string };
}

export function Sidebar({ user }: SidebarProps) {
  return (
    <aside className="flex w-64 flex-col border-r bg-muted/40 p-4">
      <div className="mb-8 flex items-center gap-2">
        <LayoutDashboard className="h-5 w-5" />
        <h1 className="text-xl font-bold">my_railway</h1>
      </div>
      <nav className="flex-1 space-y-1">
        <NavLink
          to="/projects"
          end
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            }`
          }
        >
          <FolderOpen className="h-4 w-4" />
          Projects
        </NavLink>
      </nav>
      <div className="border-t pt-4">
        <p className="mb-1 truncate text-sm font-medium">{user.name}</p>
        <p className="mb-3 truncate text-xs text-muted-foreground">
          {user.email}
        </p>
        <Form method="post">
          <Button
            variant="ghost"
            size="sm"
            type="submit"
            className="w-full justify-start"
          >
            Sign out
          </Button>
        </Form>
      </div>
    </aside>
  );
}
