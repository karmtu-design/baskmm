"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Icon, Text, type IconName } from "@once-ui-system/core";

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

type Item = { href: string; title: string; hint?: string; icon: IconName; group: string; keywords?: string };

const SECTIONS: Item[] = [
  { href: "/", title: "Обзор портфеля", hint: "Карта, ближайшие сроки, компании", icon: "home", group: "Разделы" },
  { href: "/map", title: "Карта участков", hint: "Все контуры, фильтры, 3D-рельеф", icon: "globe", group: "Разделы" },
  { href: "/licenses", title: "Реестр лицензий", hint: "Поиск, сортировка, выгрузка в Excel", icon: "document", group: "Разделы" },
  { href: "/analysis", title: "Геоанализ портфеля", hint: "Пересечения участков, соседние объекты", icon: "radialGauge", group: "Разделы" },
  { href: "/companies", title: "Компании группы", hint: "Реквизиты и лицензии каждой компании", icon: "organization", group: "Разделы" },
  { href: "/tasks", title: "Задачи сотрудников", hint: "Доска задач (в разработке)", icon: "checkbox", group: "Разделы" },
  { href: "/licenses/import", title: "Загрузка лицензий из Excel", hint: "Шаблон, проверка строк, загрузка", icon: "upload", group: "Действия" },
  { href: "/licenses/new", title: "Новая лицензия", hint: "Добавить лицензию вручную", icon: "plus", group: "Действия" },
];

export default function SiteNavigator({
  licenses,
  companies,
}: {
  licenses: { id: number; title: string; number: string; company: string }[];
  companies: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

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
      setQ("");
      setActive(0);
      setTimeout(() => input.current?.focus(), 30);
      document.documentElement.style.overflow = "hidden";
    } else document.documentElement.style.overflow = "";
  }, [open]);

  const items: Item[] = useMemo(
    () => [
      ...SECTIONS,
      ...licenses.map((l) => ({
        href: `/licenses/${l.id}`,
        title: l.title,
        hint: `${l.number} · ${l.company}`,
        icon: "document" as IconName,
        group: "Лицензии",
      })),
      ...licenses.map((l) => ({
        href: `/licenses/${l.id}?tab=drill`,
        title: `${l.title}: скважины 3D`,
        icon: "cube" as IconName,
        group: "Лицензии",
        keywords: "скважины 3d керн",
      })),
      ...companies.map((c) => ({ href: `/companies/${c.id}`, title: c.name, icon: "organization" as IconName, group: "Компании" })),
    ],
    [licenses, companies]
  );

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items.filter((i) => i.group === "Разделы" || i.group === "Действия" || (i.group !== "Лицензии" ? true : !i.href.includes("tab=")));
    return items.filter((i) => `${i.title} ${i.hint ?? ""} ${i.keywords ?? ""}`.toLowerCase().includes(s)).slice(0, 30);
  }, [items, q]);

  function go(i: Item) {
    setOpen(false);
    router.push(i.href);
  }

  if (!open) return null;
  const groups = [...new Set(shown.map((i) => i.group))];

  return (
    <div className="nav-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="nav-dialog" role="dialog" aria-modal="true" aria-label="Все разделы системы">
        <div className="nav-search">
          <Icon name="search" size="s" onBackground="neutral-weak" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(shown.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter" && shown[active]) go(shown[active]);
            }}
            placeholder="Куда перейти? Раздел, участок, номер лицензии, компания…"
            aria-label="Поиск раздела"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="nav-body">
          {shown.length === 0 && (
            <Text variant="body-default-s" onBackground="neutral-weak" style={{ padding: 16 }}>
              Ничего не найдено. Попробуйте другое слово.
            </Text>
          )}
          {groups.map((g) => (
            <section key={g}>
              <h3 className="nav-group">{g}</h3>
              <div className={g === "Разделы" || g === "Действия" ? "nav-grid" : "nav-list"}>
                {shown
                  .filter((i) => i.group === g)
                  .map((i) => {
                    const isActive = shown.indexOf(i) === active;
                    return (
                      <button
                        key={i.href}
                        type="button"
                        className={`nav-item${isActive ? " is-active" : ""}`}
                        onMouseEnter={() => setActive(shown.indexOf(i))}
                        onClick={() => go(i)}
                      >
                        <span className="nav-icon">
                          <Icon name={i.icon} size="s" />
                        </span>
                        <span className="nav-text">
                          <span className="nav-title">{i.title}</span>
                          {i.hint && <span className="nav-hint">{i.hint}</span>}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>
        <div className="nav-foot">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> выбрать · <kbd>Enter</kbd> перейти
          </span>
          <span>
            Открыть с любой страницы: <kbd>Ctrl</kbd> + <kbd>K</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
