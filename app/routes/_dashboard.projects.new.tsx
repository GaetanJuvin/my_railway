import { requireUser } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { projects } from "../../drizzle/schema";
import { redirect, Form, Link, useActionData, data } from "react-router";
import { randomUUID } from "crypto";
import { Button, buttonVariants } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { Route } from "./+types/_dashboard.projects.new";

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const name = (form.get("name") as string)?.trim();
  const description = (form.get("description") as string)?.trim() || null;

  if (!name) {
    return data({ error: "Project name is required" }, { status: 400 });
  }

  const projectId = randomUUID();
  const now = new Date();
  db.insert(projects)
    .values({
      id: projectId,
      userId: user.id,
      name,
      description,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return redirect(`/projects`);
}

export default function NewProjectPage() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">New Project</h2>
        <p className="text-sm text-muted-foreground">
          Create a new project to get started.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Project details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-4">
            {actionData?.error && (
              <p className="text-sm text-red-500">{actionData.error}</p>
            )}
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="my-app"
                required
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                name="description"
                type="text"
                placeholder="What does this project do?"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Create project</Button>
              <Link to="/projects" className={buttonVariants({ variant: "ghost" })}>
                Cancel
              </Link>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
