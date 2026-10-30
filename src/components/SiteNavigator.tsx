"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button, Icon, type IconName } from "@once-ui-system/core";
import InstallApp from "./InstallApp";

const OPEN_EVENT = "bask:open-navigator";

export function openNavigator() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** The «Все разделы» button for page content (the home page hero). */
export function NavigatorButton() {
  return (
    <Button prefixIcon="grid" onClick={openNavigator} suffixIcon="chevronDown">
      Все разделы
    </Button>
  );
}

/** Every page of the system, in the order shown in the «Все разделы» window. */
export const PAGES: { href: string; title: string; icon: IconName }[] = [
  { href: "/", title: "Обзор портфеля", icon: "home" },
  { href: "/map", title: "Карта участков", icon: "globe" },
  { href: "/licenses", title: "Реестр лицензий", icon: "document" },
  { href: "/companies", title: "Компании группы", icon: "organization" },
  { href: "/projects", title: "Потенциальные проекты", icon: "trendUp" },
  { href: "/presentations", title: "Презентации", icon: "screen" },
  { href: "/documents", title: "Документы", icon: "document" },
  { href: "/stats", title: "Аналитика", icon: "barChart" },
  { href: "/analysis", title: "Геоанализ портфеля", icon: "radialGauge" },
  { href: "/tasks", title: "Задачи и сроки", icon: "checkbox" },
  { href: "/audit", title: "Журнал изменений", icon: "time" },
];

export default function SiteNavigator() {
  const router = useRouter();
  const path = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setActive(0);
      setTimeout(() => list.current?.querySelector<HTMLButtonElement>("button")?.focus(), 30);
      document.documentElement.style.overflow = "hidden";
    } else document.documentElement.style.overflow = "";
  }, [open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  if (!open) return null;
  const current = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="nav-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="nav-dialog" role="dialog" aria-modal="true" aria-label="Все разделы">
        <div className="nav-head">
          <span>Все разделы</span>
          <button type="button" className="nav-close" onClick={() => setOpen(false)} aria-label="Закрыть">
            <Icon name="close" size="s" />
          </button>
        </div>
        <div
          className="nav-body"
          ref={list}
          onKeyDown={(e) => {
            const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
            if (!step) return;
            e.preventDefault();
            const next = (active + step + PAGES.length) % PAGES.length;
            setActive(next);
            list.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
          }}
        >
          <div className="nav-grid">
            {PAGES.map((p, i) => (
              <button
                key={p.href}
                type="button"
                className={`nav-item${i === active ? " is-active" : ""}${current(p.href) ? " is-current" : ""}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => go(p.href)}
                aria-current={current(p.href) ? "page" : undefined}
              >
                <span className="nav-icon">
                  <Icon name={p.icon} size="s" />
                </span>
                <span className="nav-title">{p.title}</span>
              </button>
            ))}
          </div>
          <InstallApp />
        </div>
      </div>
    </div>
  );
}
