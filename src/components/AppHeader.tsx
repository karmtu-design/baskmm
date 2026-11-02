"use client";

// The site menu. On a computer: a column on the left with every section signed in words, the
// light/dark switch, language and the person's e-mail. On a phone: a slim bar on top and five
// buttons at the bottom (four main sections and «Ещё», which opens the list of all sections).
import { tr } from "@/i18n";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, useTheme, type IconName } from "@once-ui-system/core";
import BrandLogo from "./BrandLogo";
import { signOut } from "@/app/login/actions";
import { openNavigator } from "./SiteNavigator";
import LanguageSwitch from "./LanguageSwitch";

type Item = { href: string; label: string; icon: IconName };
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Портфель",
    items: [
      { href: "/", label: "Обзор", icon: "home" },
      { href: "/map", label: "Карта", icon: "globe" },
      { href: "/licenses", label: "Лицензии", icon: "document" },
      { href: "/companies", label: "Компании", icon: "organization" },
      { href: "/projects", label: "Проекты", icon: "trendUp" },
    ],
  },
  {
    title: "Работа",
    items: [
      { href: "/tasks", label: "Задачи", icon: "checkbox" },
      { href: "/finance", label: "Финансы", icon: "banknotes" },
      { href: "/documents", label: "Документы", icon: "document" },
      { href: "/presentations", label: "Презентации", icon: "screen" },
    ],
  },
  {
    title: "Анализ",
    items: [
      { href: "/stats", label: "Аналитика", icon: "barChart" },
      { href: "/analysis", label: "Геоанализ", icon: "radialGauge" },
    ],
  },
  {
    title: "Управление",
    items: [
      { href: "/staff", label: "Сотрудники", icon: "people" },
      { href: "/audit", label: "Журнал изменений", icon: "time" },
    ],
  },
];
const PHONE: Item[] = [
  { href: "/", label: "Обзор", icon: "home" },
  { href: "/map", label: "Карта", icon: "globe" },
  { href: "/licenses", label: "Лицензии", icon: "document" },
  { href: "/tasks", label: "Задачи", icon: "checkbox" },
];

const isHere = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

function useCurrentTheme() {
  const [current, setCurrent] = useState<"light" | "dark">("light");
  useEffect(() => {
    const read = () => setCurrent(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return current;
}

/** «Светлая / Тёмная»: two halves, the chosen one raised. */
function ThemeSwitch() {
  const { setTheme } = useTheme();
  const current = useCurrentTheme();
  return (
    <div className="theme-switch" role="group" aria-label={tr("Оформление")}>
      <button type="button" aria-pressed={current === "light"} onClick={() => setTheme("light")}>
        <Icon name="light" size="xs" />
        <span>{tr("Светлая")}</span>
      </button>
      <button type="button" aria-pressed={current === "dark"} onClick={() => setTheme("dark")}>
        <Icon name="dark" size="xs" />
        <span>{tr("Тёмная")}</span>
      </button>
    </div>
  );
}

/** One round button for the phone bar: shows the theme it switches to. */
function ThemeIconButton() {
  const { setTheme } = useTheme();
  const current = useCurrentTheme();
  const next = current === "dark" ? "light" : "dark";
  return (
    <button type="button" className="topbar-btn" onClick={() => setTheme(next)} aria-label={next === "light" ? tr("Светлая тема") : tr("Тёмная тема")}>
      <Icon name={current === "dark" ? "light" : "dark"} size="s" />
    </button>
  );
}

export default function AppHeader({ email, readOnly = false }: { email?: string | null; readOnly?: boolean }) {
  const path = usePathname() ?? "";
  const initial = (email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <>
      {/* computer: the column on the left */}
      <aside className="side-nav" aria-label={tr("Меню")}>
        <div className="side-nav-logo">
          <BrandLogo href="/" height={30} />
        </div>
        <button type="button" className="side-nav-search" onClick={openNavigator}>
          <Icon name="search" size="xs" />
          <span>{tr("Найти раздел")}</span>
          <kbd>Ctrl K</kbd>
        </button>
        <nav className="side-nav-list">
          {GROUPS.map((g) => (
            <div key={g.title} className="side-nav-group">
              <div className="side-nav-title">{tr(g.title)}</div>
              {g.items.map((it) => {
                const on = isHere(path, it.href);
                return (
                  <Link key={it.href} href={it.href} className={`side-nav-link${on ? " is-on" : ""}`} aria-current={on ? "page" : undefined}>
                    <Icon name={it.icon} size="s" />
                    <span>{tr(it.label)}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="side-nav-foot">
          <ThemeSwitch />
          <LanguageSwitch compact />
          <div className="side-nav-me">
            <span className="side-nav-avatar" aria-hidden>{initial}</span>
            <div className="side-nav-who">
              <span title={email ?? ""}>{email}</span>
              {readOnly && (
                <small title={tr("Вы можете смотреть, но не менять данные. Права выдаёт администратор на странице «Сотрудники».")}>{tr("Только просмотр")}</small>
              )}
            </div>
            <form action={signOut}>
              <button type="submit" className="side-nav-exit" aria-label={tr("Выйти")} title={tr("Выйти")}>
                <Icon name="logout" size="s" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* phone: a slim bar on top … */}
      <header className="topbar">
        <BrandLogo href="/" height={24} />
        <div className="topbar-actions">
          <ThemeIconButton />
          <form action={signOut}>
            <button type="submit" className="topbar-btn" aria-label={tr("Выйти")}>
              <Icon name="logout" size="s" />
            </button>
          </form>
        </div>
      </header>

      {/* … and five buttons at the bottom */}
      <nav className="tabbar" aria-label={tr("Меню")}>
        {PHONE.map((it) => {
          const on = isHere(path, it.href);
          return (
            <Link key={it.href} href={it.href} className={`tabbar-link${on ? " is-on" : ""}`} aria-current={on ? "page" : undefined}>
              <Icon name={it.icon} size="s" />
              <span>{tr(it.label)}</span>
            </Link>
          );
        })}
        <button type="button" className="tabbar-link" onClick={openNavigator}>
          <Icon name="grid" size="s" />
          <span>{tr("Ещё")}</span>
        </button>
      </nav>
    </>
  );
}
