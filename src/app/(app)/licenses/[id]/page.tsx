import Link from "next/link";
import { ViewTransition } from "react";
import { Column, Grid, Heading, Row, Text } from "@once-ui-system/core";
import { notFound } from "next/navigation";
import LicenseMapTab from "@/components/LicenseMapTab";
import DrillholesTab from "@/components/DrillholesTab";
import LicenseForm from "@/components/LicenseForm";
import { ExpiryText, MineralSwatch, PageHeader, Panel, StatusBadge, TestMark } from "@/components/ui";
import { getCompanies, getDrillholes, getLicense, getLicenses } from "@/lib/data";
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
  const others = tab === "map" ? await getLicenses() : [];
  const holes = tab === "drill" ? await getDrillholes(license.id) : [];
  const update = updateLicense.bind(null, license.id);

  const facts: [string, React.ReactNode][] = [
    ["Компания", license.company_id ? <Link href={`/companies/${license.company_id}`} style={{ color: "var(--brand-on-background-strong)" }}>{license.company_name}</Link> : license.company_name],
    ["Вид лицензии", `${license.license_type ?? "—"}${license.category ? `, ${license.category}` : ""}`],
    ["Полезное ископаемое", <MineralSwatch key="m" mineral={license.mineral} />],
    ["Дата выдачи", formatDate(license.issue_date)],
    ["Действует до", <ExpiryText key="e" date={license.expiry_date} />],
    ["Расположение", [license.region, license.district].filter(Boolean).join(", ") || "—"],
    ["Площадь", license.area_sq_km != null ? `${license.area_sq_km} км²` : "—"],
    ["Ответственный", license.responsible || "—"],
  ];

  return (
    <Column>
      <PageHeader
        back={{ href: license.company_id ? `/companies/${license.company_id}` : "/", label: license.company_name }}
        title={
          <ViewTransition name={`lic-title-${license.id}`} share="morph" default="none">
            <span style={{ display: "inline-block" }}>{license.deposit_name || "Участок без названия"}</span>
          </ViewTransition>
        }
        subtitle={
          <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            Лицензия {license.license_number}
            <StatusBadge status={license.status} />
            {isTest(license) && <TestMark />}
          </span>
        }
      />

      <Row as="nav" gap="4" marginBottom="24" borderBottom overflowX="auto" aria-label="Разделы лицензии" className="tab-row">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/licenses/${license.id}?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className="tab-link"
          >
            {t.label}
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
                    {k}
                  </Text>
                  <Text as="dd" variant="body-default-m" style={{ margin: 0 }}>
                    {v}
                  </Text>
                </Column>
              ))}
              {license.notes && (
                <Column gap="4" style={{ gridColumn: "1 / -1" }}>
                  <Text as="dt" variant="label-default-s" onBackground="neutral-weak">
                    Примечания
                  </Text>
                  <Text as="dd" variant="body-default-m" style={{ margin: 0, whiteSpace: "pre-line" }}>
                    {license.notes}
                  </Text>
                </Column>
              )}
            </Grid>
          </Panel>
          <Panel>
            <details>
              <summary>Изменить сведения о лицензии</summary>
              <div style={{ marginTop: 16 }}>
                <LicenseForm action={update} companies={companies} license={license} submitLabel="Сохранить изменения" />
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
        />
      )}

      {tab === "drill" && (
        <DrillholesTab license={{ id: license.id, deposit_name: license.deposit_name, license_number: license.license_number, contour: license.contour }} holes={holes} />
      )}

      {tab === "docs" && (
        <Upcoming title="Документы появятся на следующем этапе">
          <Text as="p">
            Здесь можно будет загружать файлы по лицензии (PDF, Word, Excel, сканы) с категорией и датой, а также
            добавлять ссылки на папки в Google Drive. Поиск будет работать и по содержанию документов.
          </Text>
        </Upcoming>
      )}

      {tab === "history" && (
        <Upcoming title="Исторические данные появятся на следующем этапе">
          <Text as="p">
            Отчёты прошлых лет, данные по скважинам и пробам, подсчёты запасов и геологические карты, с годом и
            источником. Можно будет хранить как файлы, так и ссылки на архив.
          </Text>
        </Upcoming>
      )}

      {tab === "checklist" && (
        <Upcoming title="Чек-лист полноты документов появится на следующем этапе">
          <Text as="p">
            Каждый пункт можно будет отметить как «есть», «нет», «в работе» или «не требуется» и прикрепить файл.
            Черновой перечень для лицензии на {license.license_type === "Добыча" ? "добычу" : "разведку"}, который
            стоит согласовать с юристом:
          </Text>
          <ol style={{ margin: 0, paddingLeft: 20, color: "var(--neutral-on-background-strong)", display: "grid", gap: 4 }}>
            {CHECKLIST_DRAFT[license.license_type === "Добыча" ? "Добыча" : "Разведка"].map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ol>
        </Upcoming>
      )}

      {tab === "tasks" && (
        <Upcoming title="Задачи появятся на следующем этапе">
          <Text as="p">
            Задачи сотрудников, привязанные к этой лицензии: исполнитель, срок, статус. За 90, 30 и 7 дней до
            окончания срока лицензии задача будет создаваться автоматически.
          </Text>
        </Upcoming>
      )}
    </Column>
  );
}
