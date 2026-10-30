import { tr, plural } from "@/i18n";
import Link from "next/link";
import { Suspense } from "react";
import MetalPrices, { MetalPricesSkeleton } from "@/components/MetalPrices";
import { Badge, Column, Heading, Row, Text } from "@once-ui-system/core";
import HeroVideo from "@/components/HeroVideo";
import { NavigatorButton } from "@/components/SiteNavigator";
import { ButtonLink, Panel, StatusBadge } from "@/components/ui";
import { getCompanies, getDocuments, getLicenses, getProjects, getTasks } from "@/lib/data";
import { IndustryNews, KeyFigures, PanelSkeleton } from "@/components/HomeWidgets";
import { BRAND } from "@/lib/brand";
import { isTest } from "@/lib/types";
import { dn } from "@/lib/translit";

export default async function Overview() {
  const [companies, licenses, projects, tasks, documents] = await Promise.all([getCompanies(), getLicenses(), getProjects(), getTasks(), getDocuments()]);
  const exploration = licenses.filter((l) => l.license_type === "Разведка").length;
  const mining = licenses.filter((l) => l.license_type === "Добыча").length;
  const attention = licenses.filter((l) => l.status && l.status !== "действует");

  return (
    <Column gap="40">
      <HeroVideo>
      <Column gap="16" maxWidth="m">
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
      </HeroVideo>

      <KeyFigures licenses={licenses} projects={projects} tasks={tasks} docs={documents.length} />

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

      <div className={attention.length > 0 ? "home-grid home-grid-1-2" : "home-grid"}>
        {attention.length > 0 && (
          <Panel title={tr("Требуют внимания")} padding="16">
            <Column>
              {attention.map((l) => (
                <Link key={l.id} href={`/licenses/${l.id}`} className="home-row">
                  <Text variant="label-strong-s">{dn(l.deposit_name)}</Text>
                  <StatusBadge status={l.status} />
                </Link>
              ))}
            </Column>
          </Panel>
        )}
        <Suspense fallback={<PanelSkeleton title={tr("Новости отрасли")} />}>
          <IndustryNews />
        </Suspense>
      </div>
    </Column>
  );
}
