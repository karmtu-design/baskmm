import { pageTitle } from "@/i18n/meta";
import { tr } from "@/i18n";
import ProjectImporter from "@/components/ProjectImporter";
import { PageHeader } from "@/components/ui";
import { getProjects } from "@/lib/data";

export const generateMetadata = pageTitle("Загрузка проектов из Excel");

export default async function ImportProjectsPage() {
  const projects = await getProjects();
  return (
    <>
      <PageHeader
        back={{ href: "/projects", label: tr("Потенциальные проекты") }}
        title={tr("Загрузка проектов из Excel")}
        subtitle={tr("Сначала система покажет, что будет добавлено или изменено. В базу ничего не попадёт, пока вы не нажмёте «Загрузить».")}
      />
      <ProjectImporter existingNames={projects.map((p) => p.name)} />
    </>
  );
}
