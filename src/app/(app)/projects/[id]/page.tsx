import Link from "next/link";
import { notFound } from "next/navigation";
import { Column, Grid, Heading, Row, SmartLink, Text } from "@once-ui-system/core";
import DeleteProjectButton from "@/components/DeleteProjectButton";
import ProjectForm from "@/components/ProjectForm";
import { StageBadge } from "@/components/ProjectRegister";
import { PageHeader, Panel } from "@/components/ui";
import { getDocuments, getPresentations, getProject } from "@/lib/data";
import DocumentsPanel from "@/components/DocumentsPanel";
import { updateProject } from "../actions";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(Number(id));
  if (!project) notFound();
  const presentations = (await getPresentations()).filter(
    (p) => p.project && p.project.trim().toLowerCase() === project.name.trim().toLowerCase()
  );
  const hasPoint = project.lat != null && project.lon != null;
  const docs = await getDocuments({ projectId: project.id });

  return (
    <>
      <PageHeader
        back={{ href: "/projects", label: "Потенциальные проекты" }}
        title={project.name}
        subtitle={
          <Row as="span" gap="8" vertical="center" wrap>
            <StageBadge stage={project.stage} />
            {[project.commodity, project.region, project.holder].filter(Boolean).join(" · ")}
          </Row>
        }
        actions={<DeleteProjectButton id={project.id} />}
      />
      <Grid columns="3" gap="32" m={{ columns: "1" }}>
        <Column className="span-2">
          <ProjectForm action={updateProject.bind(null, project.id)} project={project} submitLabel="Сохранить изменения" />
        </Column>
        <Column gap="24">
          <Panel title="Презентации" padding="16">
            {presentations.length === 0 ? (
              <Text variant="body-default-s" onBackground="neutral-weak">
                Пока нет. На странице «Презентации» при загрузке укажите проект «{project.name}», и файл появится здесь.
              </Text>
            ) : (
              <Column gap="8">
                {presentations.map((p) => (
                  <Text key={p.id} variant="body-default-s">
                    {p.title}
                    {p.language && <span style={{ color: "var(--neutral-on-background-weak)" }}> · {p.language}</span>}
                  </Text>
                ))}
              </Column>
            )}
            <Link href="/presentations" style={{ fontSize: 14 }}>
              Перейти к презентациям →
            </Link>
          </Panel>
          {(hasPoint || project.link) && (
            <Panel title="Ссылки" padding="16">
              {hasPoint && (
                <SmartLink href={`https://www.google.com/maps?q=${project.lat},${project.lon}`} suffixIcon="arrowUpRight">
                  Точка на Google Картах
                </SmartLink>
              )}
              {project.link && (
                <SmartLink href={project.link} suffixIcon="arrowUpRight">
                  Материалы проекта
                </SmartLink>
              )}
            </Panel>
          )}
          <Text variant="body-default-xs" onBackground="neutral-weak">
            Добавлен {new Date(project.created_at).toLocaleDateString("ru-RU")}, изменён{" "}
            {new Date(project.updated_at).toLocaleDateString("ru-RU")}.
          </Text>
        </Column>
      </Grid>
      <Column gap="16" marginTop="48">
        <Heading as="h2" variant="heading-strong-l">
          Документы проекта
        </Heading>
        <DocumentsPanel kind="document" projectId={project.id} items={docs} />
      </Column>
    </>
  );
}
