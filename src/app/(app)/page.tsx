import { tr, plural } from "@/i18n";
import Link from "next/link";
import { Suspense } from "react";
import MetalPrices, { MetalPricesSkeleton } from "@/components/MetalPrices";
import { Badge, Column, Grid, Heading, Row, Text } from "@once-ui-system/core";
import { NavigatorButton } from "@/components/SiteNavigator";
import { ButtonLink, ExpiryText, Panel, StatusBadge } from "@/components/ui";
import { getCompanies, getLicenses } from "@/lib/data";
import { BRAND } from "@/lib/brand";
import { daysUntil, isTest } from "@/lib/types";

const rowLink: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  padding: "10px 0",
  textDecoration: "none",
  borderTop: "1px solid var(--neutral-alpha-weak)",
};

export default async function Overview() {
  const [companies, licenses] = await Promise.all([getCompanies(), getLicenses()]);
  const exploration = licenses.filter((l) => l.license_type === "Разведка").length;
  const mining = licenses.filter((l) => l.license_type === "Добыча").length;
  const deadlines = licenses
    .map((l) => ({ l, d: daysUntil(l.expiry_date) }))
    .filter((x) => x.d != null && x.d <= 365)
    .sort((a, b) => a.d! - b.d!);
  const attention = licenses.filter((l) => l.status && l.status !== "действует");

  return (
    <Column gap="40">
      <Column gap="16" paddingTop="24" maxWidth="m">
        <Row>
          <Badge title={BRAND.slogan} icon="sparkle" arrow={false} />
        </Row>
        <Heading as="h1" variant="display-strong-l" wrap="balance">{tr("Портфель группы")}</Heading>
        <Text variant="heading-default-l" onBackground="neutral-weak" wrap="balance">
          {plural(companies.length, "компания", "компании", "компаний")}{" "}{tr("и")}{" "}
          {plural(licenses.length, "лицензия", "лицензии", "лицензий")}: {exploration}{" "}{tr("на разведку и")}{" "}{mining}{" "}{tr("на добычу.")}</Text>
        <Row gap="8" paddingTop="8">
          <NavigatorButton />
          <ButtonLink href="/map">{tr("Открыть карту")}</ButtonLink>
        </Row>
      </Column>

      <Column gap="12">
        <Text variant="label-strong-m">{tr("Цены на металлы")}</Text>
        <Suspense fallback={<MetalPricesSkeleton />}>
          <MetalPrices />
        </Suspense>
      </Column>

      {licenses.some(isTest) && (
        <Row background="warning-alpha-weak" border="warning-alpha-medium" radius="l" padding="16">
          <Text variant="body-default-s">{tr("Сейчас в системе тестовые лицензии и условные контуры. Замените их реальными данными после настройки входа для сотрудников.")}</Text>
        </Row>
      )}

      <Grid columns={attention.length > 0 ? "3" : "2"} gap="24" m={{ columns: "1" }}>
        <Panel title={tr("Сроки в ближайший год")} padding="16">
          {deadlines.length === 0 ? (
            <Text variant="body-default-s" onBackground="neutral-weak">{tr("Ни одна лицензия не истекает в ближайшие 12 месяцев.")}</Text>
          ) : (
            <Column>
              {deadlines.map(({ l }) => (
                <Link key={l.id} href={`/licenses/${l.id}`} style={rowLink}>
                  <Column gap="2">
                    <Text variant="label-strong-s">{l.deposit_name}</Text>
                    <Text variant="body-default-xs" onBackground="neutral-weak">
                      {l.company_name}
                    </Text>
                  </Column>
                  <Text variant="body-default-s" align="right">
                    <ExpiryText date={l.expiry_date} />
                  </Text>
                </Link>
              ))}
            </Column>
          )}
        </Panel>

        <Panel title={tr("Компании")} padding="16">
          <Column>
            {companies.map((c) => (
              <Link key={c.id} href={`/companies/${c.id}`} style={rowLink}>
                <Text variant="label-strong-s">{c.name}</Text>
                <Text variant="body-default-s" onBackground="neutral-weak">
                  {plural(licenses.filter((l) => l.company_id === c.id).length, "лицензия", "лицензии", "лицензий")}
                </Text>
              </Link>
            ))}
          </Column>
        </Panel>

        {attention.length > 0 && (
          <Panel title={tr("Требуют внимания")} padding="16">
            <Column>
              {attention.map((l) => (
                <Link key={l.id} href={`/licenses/${l.id}`} style={{ ...rowLink, alignItems: "center" }}>
                  <Text variant="label-strong-s">{l.deposit_name}</Text>
                  <StatusBadge status={l.status} />
                </Link>
              ))}
            </Column>
          </Panel>
        )}
      </Grid>
    </Column>
  );
}
