import { Button, Column, Grid, Text } from "@once-ui-system/core";
import ProjectRegister from "@/components/ProjectRegister";
import { ButtonLink, PageHeader } from "@/components/ui";
import { getProjects } from "@/lib/data";
import { PROJECT_STAGES } from "@/lib/types";

export const metadata = { title: "Потенциальные проекты" };

export default async function ProjectsPage() {
  const projects = await getProjects();
  const count = (s: string) => projects.filter((p) => p.stage === s).length;
  const active = PROJECT_STAGES.filter((s) => s !== "Отложен" && s !== "Отклонён");
  return (
    <Column>
      <PageHeader
        title="Потенциальные проекты"
        subtitle="Объекты, которые группа рассматривает для покупки, совместного предприятия или получения лицензии."
        actions={
          <>
            <Button href="/projects/import" variant="secondary" prefixIcon="upload">
              Загрузить из Excel
            </Button>
            <ButtonLink href="/projects/new" primary>
              Добавить проект
            </ButtonLink>
          </>
        }
      />
      {projects.length > 0 && (
        <Grid columns={String(active.length) as "5"} gap="12" m={{ columns: "3" }} s={{ columns: "2" }} marginBottom="24">
          {active.map((s) => (
            <Column key={s} background="surface" border radius="l" padding="16" gap="4">
              <Text variant="body-default-xs" onBackground="neutral-weak">
                {s}
              </Text>
              <Text variant="heading-strong-l">{count(s)}</Text>
            </Column>
          ))}
        </Grid>
      )}
      <ProjectRegister projects={projects} />
    </Column>
  );
}
