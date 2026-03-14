import { requireUser } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { projects } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { Link, useLoaderData } from "react-router";
import { buttonVariants } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { Route } from "./+types/_dashboard.projects";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const userProjects = db
    .select()
    .from(projects)
    .where(eq(projects.userId, user.id))
    .all();
  return { projects: userProjects };
}

export default function ProjectsPage() {
  const { projects } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Projects</h2>
        <Link to="/projects/new" className={buttonVariants()}>
          New Project
        </Link>
      </div>
      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            No projects yet. Create one to get started.
          </p>
          <Link
            to="/projects/new"
            className={buttonVariants({ className: "mt-4" })}
          >
            Create your first project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <CardTitle>
                  <Link
                    to={`/project/${project.id}`}
                    className="hover:underline"
                  >
                    {project.name}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {project.description || "No description"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
