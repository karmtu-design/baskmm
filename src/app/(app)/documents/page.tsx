import { pageTitle } from "@/i18n/meta";
import { tr } from "@/i18n";
import { Column } from "@once-ui-system/core";
import DocumentsPanel from "@/components/DocumentsPanel";
import { PageHeader } from "@/components/ui";
import { getDocuments, getLicenses, getProjects } from "@/lib/data";

export const generateMetadata = pageTitle("Документы");

export default async function DocumentsPage() {
  const [docs, licenses, projects] = await Promise.all([getDocuments(), getLicenses(), getProjects()]);
  const owners = {
    licenses: Object.fromEntries(licenses.map((l) => [l.id, l.deposit_name || l.license_number])),
    projects: Object.fromEntries(projects.map((p) => [p.id, p.name])),
  };
  return (
    <Column>
      <PageHeader
        title={tr("Документы")}
        subtitle={tr("Поиск по всем документам и историческим материалам группы, в том числе по распознанному тексту сканов. Загружаются документы в карточке лицензии или проекта.")}
      />
      <DocumentsPanel kind="document" items={docs} owners={owners} allowUpload={false} />
    </Column>
  );
}
