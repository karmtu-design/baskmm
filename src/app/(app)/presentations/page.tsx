import { pageTitle } from "@/i18n/meta";
import { tr } from "@/i18n";
import { Column } from "@once-ui-system/core";
import PresentationsLibrary from "@/components/PresentationsLibrary";
import { PageHeader } from "@/components/ui";
import { getLicenses, getPresentations, getProjects } from "@/lib/data";

export const generateMetadata = pageTitle("Презентации");

export default async function PresentationsPage() {
  const [items, licenses, projects] = await Promise.all([getPresentations(), getLicenses(), getProjects()]);
  const names = [...licenses.map((l) => l.deposit_name || l.license_number), ...projects.map((p) => p.name)];
  return (
    <Column>
      <PageHeader
        title={tr("Презентации")}
        subtitle={tr("Все презентации и материалы для инвесторов в одном месте. Скачайте файл или отправьте его в WhatsApp, Telegram или по почте.")}
      />
      <PresentationsLibrary items={items} projects={names} />
    </Column>
  );
}
