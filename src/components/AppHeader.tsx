"use client";

import { tr } from "@/i18n";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Fade, Line, Row, Text, ToggleButton, useTheme, type IconName } from "@once-ui-system/core";
import BrandLogo from "./BrandLogo";
import { signOut } from "@/app/login/actions";
import { openNavigator } from "./SiteNavigator";
import LanguageSwitch from "./LanguageSwitch";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/map", label: "Карта", icon: "globe" },
  { href: "/licenses", label: "Лицензии", icon: "document" },
  { href: "/companies", label: "Компании", icon: "organization" },
  { href: "/projects", label: "Проекты", icon: "trendUp" },
  { href: "/presentations", label: "Презентации", icon: "screen" },
  { href: "/tasks", label: "Задачи", icon: "checkbox" },
];

function ThemeToggle() {
  const { setTheme } = useTheme();
  const [current, setCurrent] = useState<"light" | "dark">("dark");
  useEffect(() => {
    const read = () => setCurrent(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  const next = current === "dark" ? "light" : "dark";
  return (
    <ToggleButton
      prefixIcon={current === "dark" ? "light" : "dark"}
      onClick={() => setTheme(next)}
      aria-label={next === "light" ? tr("Светлая тема") : tr("Тёмная тема")}
    />
  );
}

export default function AppHeader({ email, readOnly = false }: { email?: string | null; readOnly?: boolean }) {
  const path = usePathname() ?? "";

  const pill = (
    <Row
      background="page"
      border
      radius="m-4"
      shadow="l"
      padding="4"
      gap="4"
      vertical="center"
      textVariant="body-default-s"
    >
      <ToggleButton prefixIcon="home" href="/" aria-label={tr("Обзор портфеля")} selected={path === "/"} />
      <Line background="neutral-alpha-medium" vert maxHeight="24" />
      {NAV.map((item) => (
        <Row key={item.href}>
          <Row m={{ hide: true }}>
            <ToggleButton prefixIcon={item.icon} href={item.href} label={tr(item.label)} selected={path.startsWith(item.href)} />
          </Row>
          <Row hide m={{ hide: false }}>
            <ToggleButton prefixIcon={item.icon} href={item.href} aria-label={tr(item.label)} title={tr(item.label)} selected={path.startsWith(item.href)} />
          </Row>
        </Row>
      ))}
      <Line background="neutral-alpha-medium" vert maxHeight="24" />
      <ToggleButton prefixIcon="grid" onClick={openNavigator} aria-label={tr("Все разделы (Ctrl+K)")} />
      <ThemeToggle />
      <form action={signOut} style={{ display: "contents" }}>
        <ToggleButton prefixIcon="logout" aria-label={tr("Выйти")} type="submit" />
      </form>
    </Row>
  );

  return (
    <>
      <Fade s={{ hide: true }} fillWidth position="fixed" top="0" left="0" height="80" zIndex={9} />
      <Fade hide s={{ hide: false }} fillWidth position="fixed" bottom="0" left="0" to="top" height="80" zIndex={9} />
      <Row
        as="header"
        className="app-header"
        style={{ viewTransitionName: "app-header" }}
        position="fixed"
        top="0"
        left="0"
        fillWidth
        padding="8"
        vertical="center"
        zIndex={9}
      >
        <Row fillWidth paddingLeft="12" vertical="center" className="app-header-side">
          <BrandLogo href="/" height={36} />
        </Row>
        <Row fillWidth horizontal="center" className="app-header-pill">
          {pill}
        </Row>
        <Row fillWidth horizontal="end" vertical="center" gap="12" paddingRight="12" m={{ hide: true }} className="app-header-side">
          {readOnly && (
            <span className="role-badge role-viewer" title={tr("Вы можете смотреть, но не менять данные. Права выдаёт администратор на странице «Сотрудники».")}>
              {tr("Только просмотр")}
            </span>
          )}
          <LanguageSwitch compact />
          <Text variant="body-default-s" onBackground="neutral-weak" truncate>
            {email}
          </Text>
        </Row>
      </Row>
    </>
  );
}
