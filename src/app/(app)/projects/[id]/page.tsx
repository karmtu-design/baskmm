import { tr, loc } from "@/i18n";
import { dn, dp } from "@/lib/translit";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Column, Grid, Heading, Row, SmartLink, Text } from "@once-ui-system/core";
import DeleteProjectButton from "@/components/DeleteProjectButton";
import { TeaserButton } from "@/components/ExportButtons";
import ProjectForm from "@/components/ProjectForm";
import { StageBadge } from "@/components/ProjectRegister";
import { PageHeader, Panel } from "@/components/ui";
import { getDocuments, getNotesAndBoards, getPresentations, getProject } from "@/lib/data";
import NotesAndBoards from "@/components/NotesAndBoards";
import DocumentsPanel from "@/components/DocumentsPanel";
import { updateProject } from "../actions";
import { getMetalBoard } from "@/lib/metals";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(Number(id));
  if (!project) notFound();
  const presentations = (await getPresentations()).filter(
    (p) => p.project && p.project.trim().toLowerCase() === project.name.trim().toLowerCase()
  );
  const hasPoint = project.lat != null && project.lon != null;
  const [docs, board, nb] = await Promise.all([
    getDocuments({ projectId: project.id }),
    getMetalBoard().catch(() => ({ quotes: [] })),
    getNotesAndBoards({ projectId: project.id }),
  ]);
  const prices = board.quotes.map((q) => ({ key: q.key, symbol: q.symbol, price: q.price, unit: q.unit }));

  return (
    <>
      <PageHeader
        back={{ href: "/projects", label: tr("Потенциальные проекты") }}
        title={dn(project.name)}
        subtitle={
          <Row as="span" gap="8" vertical="center" wrap>
            <StageBadge stage={project.stage} />
            {[project.commodity, dp(project.region), dn(project.holder)].filter(Boolean).join(" · ")}
          </Row>
        }
        actions={
          <>
            <TeaserButton project={project} prices={prices} />
            <DeleteProjectButton id={project.id} />
          </>
        }
      />
      <Grid columns="3" gap="32" m={{ columns: "1" }}>
        <Column className="span-2">
          <ProjectForm action={updateProject.bind(null, project.id)} project={project} submitLabel={tr("Сохранить изменения")} />
        </Column>
        <Column gap="24">
          <Panel title={tr("Презентации")} padding="16">
            {presentations.length === 0 ? (
              <Text variant="body-default-s" onBackground="neutral-weak">{tr("Пока нет. На странице «Презентации» при загрузке укажите проект «")}{project.name}{tr("», и файл появится здесь.")}</Text>
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
            <Link href="/presentations" style={{ fontSize: 14 }}>{tr("Перейти к презентациям →")}</Link>
          </Panel>
          {(hasPoint || project.link) && (
            <Panel title={tr("Ссылки")} padding="16">
              {hasPoint && (
                <SmartLink href={`https://www.google.com/maps?q=${project.lat},${project.lon}`} suffixIcon="arrowUpRight">{tr("Точка на Google Картах")}</SmartLink>
              )}
              {project.link && (
                <SmartLink href={project.link} suffixIcon="arrowUpRight">{tr("Материалы проекта")}</SmartLink>
              )}
            </Panel>
          )}
          <Text variant="body-default-xs" onBackground="neutral-weak">{tr("Добавлен")}{" "}{new Date(project.created_at).toLocaleDateString(loc())}{tr(", изменён")}{" "}
            {new Date(project.updated_at).toLocaleDateString(loc())}.
          </Text>
        </Column>
      </Grid>
      <Column gap="16" marginTop="48">
        <Heading as="h2" variant="heading-strong-l">{tr("Документы проекта")}</Heading>
        <DocumentsPanel kind="document" projectId={project.id} items={docs} />
      </Column>
      <Column gap="16" marginTop="48">
        <NotesAndBoards notes={nb.notes} boards={nb.boards} projectId={project.id} />
      </Column>
    </>
  );
}
