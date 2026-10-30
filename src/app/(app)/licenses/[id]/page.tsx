import { tr } from "@/i18n";
import { dn, dp } from "@/lib/translit";
import Link from "next/link";
import { ViewTransition } from "react";
import { Column, Grid, Heading, Row, Text } from "@once-ui-system/core";
import { notFound } from "next/navigation";
import LicenseMapTab from "@/components/LicenseMapTab";
import DrillholesTab from "@/components/DrillholesTab";
import LicenseForm from "@/components/LicenseForm";
import { ExpiryText, MineralSwatch, PageHeader, Panel, StatusBadge, TestMark } from "@/components/ui";
import { getCompanies, getDocuments, getDrillholes, getLicense, getAudit, getLicenses, getOverlays, getProjects, getTasks, getNotesAndBoards, getStaff } from "@/lib/data";
import { staffName } from "@/lib/types";
import { myRole } from "@/lib/roles";
import AuditList from "@/components/AuditList";
import NotesAndBoards from "@/components/NotesAndBoards";
import TaskBoard from "@/components/TaskBoard";
import { LicenseDocxButton } from "@/components/ExportButtons";
import DocumentsPanel from "@/components/DocumentsPanel";
import { formatDate, isTest } from "@/lib/types";
import { updateLicense } from "../../actions";

const TABS = [
  { id: "info", label: "Сведения" },
  { id: "map", label: "Карта и геоанализ" },
  { id: "drill", label: "Скважины 3D" },
  { id: "docs", label: "Документы" },
  { id: "history", label: "Исторические данные" },
  { id: "checklist", label: "Чек-лист" },
  { id: "tasks", label: "Задачи" },
  { id: "notes", label: "Заметки и схемы" },
] as const;

const CHECKLIST_DRAFT = {
  Разведка: [
    "Лицензия на разведку с приложениями (координаты, блоки)",
    "План разведки",
    "Экологическое разрешение или заключение по воздействию на окружающую среду",
    "Ликвидационный план и обеспечение ликвидации",
    "Отчёты по лицензионным обязательствам за прошедшие периоды",
    "Документы на доступ к земле: сервитут или договор с землепользователем",
    "Договоры с подрядчиками на геологоразведочные работы",
  ],
  Добыча: [
    "Лицензия на добычу с приложениями",
    "План горных работ",
    "Отчёт о подсчёте запасов и протокол утверждения запасов",
    "Экологическое разрешение",
    "Ликвидационный план и обеспечение ликвидации",
    "Отчёты по лицензионным обязательствам, включая расходы на обучение, НИОКР и развитие региона",
    "Документы на землю: право землепользования или сервитут",
    "Промышленная безопасность: декларация, план ликвидации аварий",
  ],
};

function Upcoming({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Column maxWidth="m" background="surface" border radius="l" padding="24" gap="12" style={{ borderStyle: "dashed" }}>
      <Heading as="h3" variant="heading-strong-m">
        {title}
      </Heading>
      <Column gap="8" textVariant="body-default-s" onBackground="neutral-weak">
        {children}
      </Column>
    </Column>
  );
}

export default async function LicensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab = "info" }] = await Promise.all([params, searchParams]);
  const license = await getLicense(Number(id));
  if (!license) notFound();
  const companies = tab === "info" ? await getCompanies() : [];
  const staffNames = tab === "info" ? (await getStaff()).staff.map(staffName) : [];
  const others = tab === "map" ? await getLicenses() : [];
  const images = tab === "map" ? await getOverlays(license.id) : [];
  const changes = tab === "info" ? await getAudit({ table: "licenses", recordId: license.id, limit: 10 }) : [];
  const [tasks, allLic, allProj, staffList] = tab === "tasks" ? await Promise.all([getTasks({ licenseId: license.id }), getLicenses(), getProjects(), getStaff()]) : [[], [], [], { staff: [] }];
  const role = await myRole();
  const holes = tab === "drill" ? await getDrillholes(license.id) : [];
  const nb = tab === "notes" ? await getNotesAndBoards({ licenseId: license.id }) : null;
  const docs = tab === "docs" || tab === "history" ? await getDocuments({ licenseId: license.id, kind: tab === "history" ? "history" : "document" }) : [];
  const update = updateLicense.bind(null, license.id);

  const facts: [string, React.ReactNode][] = [
    ["Компания", license.company_id ? <Link href={`/companies/${license.company_id}`} style={{ color: "var(--brand-on-background-strong)" }}>{dn(license.company_name)}</Link> : dn(license.company_name)],
    ["Вид лицензии", `${license.license_type ? tr(license.license_type) : "—"}${license.category ? `, ${tr(license.category)}` : ""}`],
    ["Полезное ископаемое", <MineralSwatch key="m" mineral={license.mineral} />],
    ["Дата выдачи", formatDate(license.issue_date)],
    ["Действует до", <ExpiryText key="e" date={license.expiry_date} />],
    ["Расположение", [license.region, license.district].filter(Boolean).join(", ") || "—"],
    ["Площадь", license.area_sq_km != null ? tr("{0} км²", { 0: license.area_sq_km }) : "—"],
    ["Ответственный", license.responsible || "—"],
  ];

  return (
    <Column>
      <PageHeader
        back={{ href: license.company_id ? `/companies/${license.company_id}` : "/", label: dn(license.company_name) }}
        title={
          <ViewTransition name={`lic-title-${license.id}`} share="morph" default="none">
            <span style={{ display: "inline-block" }}>{dn(license.deposit_name) || tr("Участок без названия")}</span>
          </ViewTransition>
        }
        subtitle={
          <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>{tr("Лицензия")}{" "}{license.license_number}
            <StatusBadge status={license.status} />
            {isTest(license) && <TestMark />}
          </span>
        }
        actions={<LicenseDocxButton license={license} />}
      />

      <Row as="nav" gap="4" marginBottom="24" borderBottom overflowX="auto" aria-label={tr("Разделы лицензии")} className="tab-row">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/licenses/${license.id}?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className="tab-link"
          >
            {tr(t.label)}
          </Link>
        ))}
      </Row>

      {tab === "info" && (
        <Column gap="24" maxWidth="l">
          <Panel>
            <Grid as="dl" columns="4" gap="20" m={{ columns: "2" }} s={{ columns: "1" }} style={{ margin: 0 }}>
              {facts.map(([k, v]) => (
                <Column key={k} gap="4">
                  <Text as="dt" variant="label-default-s" onBackground="neutral-weak">
                    {tr(k)}
                  </Text>
                  <Text as="dd" variant="body-default-m" style={{ margin: 0 }}>
                    {v}
                  </Text>
                </Column>
              ))}
              {license.notes && (
                <Column gap="4" style={{ gridColumn: "1 / -1" }}>
                  <Text as="dt" variant="label-default-s" onBackground="neutral-weak">{tr("Примечания")}</Text>
                  <Text as="dd" variant="body-default-m" style={{ margin: 0, whiteSpace: "pre-line" }}>
                    {license.notes}
                  </Text>
                </Column>
              )}
            </Grid>
          </Panel>
          <Panel title={tr("Последние изменения")}>
            <AuditList entries={changes} names={new Map()} showObject={false} />
            <Text variant="body-default-xs" onBackground="neutral-weak">{tr("Полный журнал: «Все разделы» → «Журнал изменений».")}</Text>
          </Panel>
          <Panel>
            <details>
              <summary>{tr("Изменить сведения о лицензии")}</summary>
              <div style={{ marginTop: 16 }}>
                <LicenseForm action={update} companies={companies} license={license} submitLabel={tr("Сохранить изменения")} people={staffNames} />
              </div>
            </details>
          </Panel>
        </Column>
      )}

      {tab === "map" && (
        <LicenseMapTab
          license={license}
          licenseArea={license.area_sq_km}
          contourSource={license.contour_source}
          others={others.map((o) => ({ id: o.id, deposit_name: o.deposit_name, license_number: o.license_number, company_name: o.company_name, contour: o.contour }))}
          images={images}
        />
      )}

      {tab === "drill" && (
        <DrillholesTab license={{ id: license.id, deposit_name: license.deposit_name, license_number: license.license_number, contour: license.contour }} holes={holes} />
      )}

      {tab === "docs" && <DocumentsPanel key="docs" kind="document" licenseId={license.id} items={docs} />}

      {tab === "history" && <DocumentsPanel key="history" kind="history" licenseId={license.id} items={docs} />}

      {tab === "checklist" && (
        <Upcoming title={tr("Чек-лист полноты документов появится на следующем этапе")}>
          <Text as="p">
            {license.license_type === "Добыча"
              ? tr("Каждый пункт можно будет отметить как «есть», «нет», «в работе» или «не требуется» и прикрепить файл. Черновой перечень для лицензии на добычу, который стоит согласовать с юристом:")
              : tr("Каждый пункт можно будет отметить как «есть», «нет», «в работе» или «не требуется» и прикрепить файл. Черновой перечень для лицензии на разведку, который стоит согласовать с юристом:")}
          </Text>
          <ol style={{ margin: 0, paddingLeft: 20, color: "var(--neutral-on-background-strong)", display: "grid", gap: 4 }}>
            {CHECKLIST_DRAFT[license.license_type === "Добыча" ? "Добыча" : "Разведка"].map((i) => (
              <li key={i}>{tr(i)}</li>
            ))}
          </ol>
        </Upcoming>
      )}

      {nb && <NotesAndBoards notes={nb.notes} boards={nb.boards} licenseId={license.id} readOnly={role === "viewer"} />}

      {tab === "tasks" && (
        <TaskBoard
          tasks={tasks}
          licenses={allLic.map((l) => ({ id: l.id, name: l.deposit_name || l.license_number }))}
          projects={allProj.map((p) => ({ id: p.id, name: p.name }))}
          people={[...new Set([...staffList.staff.map(staffName), license.responsible, ...allLic.map((l) => l.responsible)].filter(Boolean) as string[])]}
          fixed={{ license_id: license.id }}
        />
      )}
    </Column>
  );
}
