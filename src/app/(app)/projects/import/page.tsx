import ProjectImporter from "@/components/ProjectImporter";
import { PageHeader } from "@/components/ui";
import { getProjects } from "@/lib/data";

export const metadata = { title: "Загрузка проектов из Excel" };

export default async function ImportProjectsPage() {
  const projects = await getProjects();
  return (
    <>
      <PageHeader
        back={{ href: "/projects", label: "Потенциальные проекты" }}
        title="Загрузка проектов из Excel"
        subtitle="Сначала система покажет, что будет добавлено или изменено. В базу ничего не попадёт, пока вы не нажмёте «Загрузить»."
      />
      <ProjectImporter existingNames={projects.map((p) => p.name)} />
    </>
  );
}
