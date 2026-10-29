import Link from "next/link";
import { notFound } from "next/navigation";
import ContourEditor from "@/components/ContourEditor";
import LicenseForm from "@/components/LicenseForm";
import { ExpiryText, MineralSwatch, PageHeader, StatusBadge, TestMark } from "@/components/ui";
import { getCompanies, getLicense } from "@/lib/data";
import { formatDate, isTest } from "@/lib/types";
import { updateLicense } from "../../actions";

const TABS = [
  { id: "info", label: "Сведения" },
  { id: "map", label: "Карта и контур" },
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
    <div className="max-w-3xl rounded-lg border border-dashed border-line bg-surface p-6">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-2 space-y-2 text-sm text-muted">{children}</div>
    </div>
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
  const update = updateLicense.bind(null, license.id);

  const facts: [string, React.ReactNode][] = [
    ["Компания", license.company_id ? <Link href={`/companies/${license.company_id}`} className="text-patina hover:underline">{license.company_name}</Link> : license.company_name],
    ["Вид лицензии", `${license.license_type ?? "—"}${license.category ? `, ${license.category}` : ""}`],
    ["Полезное ископаемое", <MineralSwatch key="m" mineral={license.mineral} />],
    ["Дата выдачи", formatDate(license.issue_date)],
    ["Действует до", <ExpiryText key="e" date={license.expiry_date} />],
    ["Расположение", [license.region, license.district].filter(Boolean).join(", ") || "—"],
    ["Площадь", license.area_sq_km != null ? `${license.area_sq_km} км²` : "—"],
    ["Ответственный", license.responsible || "—"],
  ];

  return (
    <>
      <PageHeader
        back={{ href: license.company_id ? `/companies/${license.company_id}` : "/", label: license.company_name }}
        title={
          <>
            {license.deposit_name || "Участок без названия"}
            {isTest(license) && <TestMark />}
          </>
        }
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-3">
            Лицензия {license.license_number}
            <StatusBadge status={license.status} />
          </span>
        }
      />

      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Разделы лицензии">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/licenses/${license.id}?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
              tab === t.id ? "border-patina font-medium text-patina-deep" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "info" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-lg border border-line bg-surface p-5 text-sm sm:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted">{k}</dt>
                <dd className="mt-0.5">{v}</dd>
              </div>
            ))}
            {license.notes && (
              <div className="sm:col-span-2">
                <dt className="text-muted">Примечания</dt>
                <dd className="mt-0.5 whitespace-pre-line">{license.notes}</dd>
              </div>
            )}
          </dl>
          <details className="rounded-lg border border-line bg-surface p-5">
            <summary className="cursor-pointer font-medium text-patina">Изменить сведения о лицензии</summary>
            <div className="mt-4">
              <LicenseForm action={update} companies={companies} license={license} submitLabel="Сохранить изменения" />
            </div>
          </details>
        </div>
      )}

      {tab === "map" && (
        <ContourEditor license={license} licenseArea={license.area_sq_km} contourSource={license.contour_source} />
      )}

      {tab === "docs" && (
        <Upcoming title="Документы появятся на следующем этапе">
          <p>
            Здесь можно будет загружать файлы по лицензии (PDF, Word, Excel, сканы) с категорией и датой, а также
            добавлять ссылки на папки в Google Drive. Поиск будет работать и по содержанию документов.
          </p>
        </Upcoming>
      )}

      {tab === "history" && (
        <Upcoming title="Исторические данные появятся на следующем этапе">
          <p>
            Отчёты прошлых лет, данные по скважинам и пробам, подсчёты запасов и геологические карты, с годом и
            источником. Можно будет хранить как файлы, так и ссылки на архив.
          </p>
        </Upcoming>
      )}

      {tab === "checklist" && (
        <Upcoming title="Чек-лист полноты документов появится на следующем этапе">
          <p>
            Каждый пункт можно будет отметить как «есть», «нет», «в работе» или «не требуется» и прикрепить файл.
            Черновой перечень для лицензии на {license.license_type === "Добыча" ? "добычу" : "разведку"}, который
            стоит согласовать с юристом:
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-ink">
            {CHECKLIST_DRAFT[license.license_type === "Добыча" ? "Добыча" : "Разведка"].map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ol>
        </Upcoming>
      )}

      {tab === "tasks" && (
        <Upcoming title="Задачи появятся на следующем этапе">
          <p>
            Задачи сотрудников, привязанные к этой лицензии: исполнитель, срок, статус. За 90, 30 и 7 дней до
            окончания срока лицензии задача будет создаваться автоматически.
          </p>
        </Upcoming>
      )}
    </>
  );
}
