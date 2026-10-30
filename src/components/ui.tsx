import { tr } from "@/i18n";
import { dn, dp } from "@/lib/translit";
import Link from "next/link";
import { Button, Column, Heading, Row, SmartLink, Tag, Text } from "@once-ui-system/core";
import { daysUntil, formatDate, mineralColor, mineralGroup, type License } from "@/lib/types";

export function StatusBadge({ status }: { status: string | null }) {
  const s = status || "—";
  const scheme = s === "действует" ? "success" : s === "истекла" || s === "приостановлена" ? "danger" : "warning";
  return <Tag as="span" size="s" scheme={scheme} label={tr(s)} />;
}

export function TestMark() {
  return <Tag as="span" size="s" scheme="warning" label={tr("тестовые данные")} />;
}

export function MineralSwatch({ mineral }: { mineral: string | null }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span aria-hidden style={{ width: 12, height: 12, borderRadius: 3, background: mineralColor(mineral) }} />
      {mineral || "—"}
    </span>
  );
}

export function Legend({ licenses }: { licenses: Pick<License, "mineral">[] }) {
  const groups = Array.from(new Set(licenses.map((l) => mineralGroup(l.mineral))));
  const colorOf = (g: string) => mineralColor(licenses.find((l) => mineralGroup(l.mineral) === g)!.mineral);
  return (
    <Row as="ul" wrap gap="20" textVariant="body-default-s" onBackground="neutral-weak" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {groups.map((g) => (
        <li key={g} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden style={{ width: 20, height: 12, borderRadius: 3, background: colorOf(g) }} />
          {tr(g)}
        </li>
      ))}
    </Row>
  );
}

export function ExpiryText({ date }: { date: string | null }) {
  const d = daysUntil(date);
  if (d == null) return <span>—</span>;
  const color = d < 0 ? "var(--danger-on-background-strong)" : d <= 180 ? "var(--warning-on-background-strong)" : undefined;
  const hint = d < 0 ? tr("истекла {0} дн. назад", { 0: -d }) : d <= 365 ? tr("через {0} дн.", { 0: d }) : null;
  return (
    <span style={{ color }}>
      {formatDate(date)}
      {hint && <span style={{ display: "block", fontSize: 12 }}>{hint}</span>}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <Column as="header" gap="8" marginBottom="32">
      {back && (
        <Row>
          <SmartLink href={back.href} prefixIcon="chevronLeft" className="back-link">
            {back.label}
          </SmartLink>
        </Row>
      )}
      <Row wrap gap="16" vertical="end" horizontal="between">
        <Column gap="8">
          <Heading as="h1" variant="display-strong-s">
            {title}
          </Heading>
          {subtitle && (
            <Text variant="body-default-l" onBackground="neutral-weak" className="page-subtitle">
              {subtitle}
            </Text>
          )}
        </Column>
        {actions && (
          <Row gap="8" wrap>
            {actions}
          </Row>
        )}
      </Row>
    </Column>
  );
}

export function ButtonLink({ href, children, primary }: { href: string; children: string; primary?: boolean }) {
  return (
    <Button href={href} variant={primary ? "primary" : "secondary"} size="m" prefixIcon={primary ? "plus" : undefined}>
      {children}
    </Button>
  );
}

/** A static panel: the library's surface recipe. */
export function Panel({ children, title, padding = "24" }: { children: React.ReactNode; title?: string; padding?: "16" | "24" }) {
  return (
    <Column background="surface" border radius="l" padding={padding} gap="16" fillWidth>
      {title && (
        <Heading as="h2" variant="heading-strong-m">
          {title}
        </Heading>
      )}
      {children}
    </Column>
  );
}

export function LicenseTable({ licenses, showCompany = true }: { licenses: License[]; showCompany?: boolean }) {
  if (licenses.length === 0)
    return (
      <Column border radius="l" padding="24" style={{ borderStyle: "dashed" }}>
        <Text onBackground="neutral-weak">{tr("Лицензий пока нет. Добавьте первую кнопкой «Добавить лицензию».")}</Text>
      </Column>
    );
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>{tr("Участок")}</th>
            <th>{tr("Полезное ископаемое")}</th>
            <th>{tr("Вид")}</th>
            {showCompany && <th>{tr("Компания")}</th>}
            <th>{tr("Действует до")}</th>
            <th>{tr("Статус")}</th>
          </tr>
        </thead>
        <tbody>
          {licenses.map((l) => (
            <tr key={l.id}>
              <td>
                <Link href={`/licenses/${l.id}`}>{dn(l.deposit_name) || tr("Без названия")}</Link>
                <div style={{ fontSize: 12, color: "var(--neutral-on-background-weak)" }}>{l.license_number}</div>
              </td>
              <td>
                <MineralSwatch mineral={l.mineral} />
              </td>
              <td>
                {l.license_type ? tr(l.license_type) : "—"}
                {l.category && <span style={{ color: "var(--neutral-on-background-weak)" }}>, {tr(l.category)}</span>}
              </td>
              {showCompany && <td>{dn(l.company_name)}</td>}
              <td>
                <ExpiryText date={l.expiry_date} />
              </td>
              <td>
                <StatusBadge status={l.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
