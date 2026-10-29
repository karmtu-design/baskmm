import ProjectForm from "@/components/ProjectForm";
import { PageHeader } from "@/components/ui";
import { createProject } from "../actions";

export const metadata = { title: "Новый проект" };

export default function NewProjectPage() {
  return (
    <>
      <PageHeader back={{ href: "/projects", label: "Потенциальные проекты" }} title="Новый проект" subtitle="Обязательно только название. Остальное можно дополнить позже." />
      <ProjectForm action={createProject} submitLabel="Сохранить проект" />
    </>
  );
}
