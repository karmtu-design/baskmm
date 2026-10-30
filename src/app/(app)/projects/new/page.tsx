import { pageTitle } from "@/i18n/meta";
import { tr } from "@/i18n";
import ProjectForm from "@/components/ProjectForm";
import { PageHeader } from "@/components/ui";
import { createProject } from "../actions";
import { getStaff } from "@/lib/data";
import { staffName } from "@/lib/types";

export const generateMetadata = pageTitle("Новый проект");

export default async function NewProjectPage() {
  const { staff } = await getStaff();
  return (
    <>
      <PageHeader back={{ href: "/projects", label: tr("Потенциальные проекты") }} title={tr("Новый проект")} subtitle={tr("Обязательно только название. Остальное можно дополнить позже.")} />
      <ProjectForm action={createProject} submitLabel={tr("Сохранить проект")} people={staff.map(staffName)} />
    </>
  );
}
