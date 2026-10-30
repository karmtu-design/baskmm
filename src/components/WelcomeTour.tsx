"use client";

// A short guided tour of the system (React Joyride) for new staff: starts by itself on the first visit
// to the home page, and can be repeated from «Все разделы» → «Экскурсия по системе».
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Joyride, STATUS, type EventData, type Step } from "react-joyride";
import { tr } from "@/i18n";

const DONE_KEY = "bask-tour-done";
export const TOUR_EVENT = "bask:tour";

/** The first element that is actually on screen (the header has separate phone and computer versions). */
function visible(selector: string): HTMLElement | string {
  const all = [...document.querySelectorAll<HTMLElement>(selector)];
  return all.find((e) => e.offsetParent !== null && e.getBoundingClientRect().width > 0) ?? selector;
}

function steps(): Step[] {
  const s: (Step | null)[] = [
    { target: "body", placement: "center", title: tr("Добро пожаловать в систему BASK"), content: tr("Здесь все лицензии, участки, проекты, документы и задачи группы. Короткая экскурсия на минуту: «Далее» — следующий шаг, «Пропустить» — закончить.") },
    document.querySelector(".kpi-grid") && { target: ".kpi-grid", title: tr("Главные цифры"), content: tr("Сколько лицензий и какая площадь, проекты в работе, просроченные задачи. Нажмите на плитку — откроется нужный раздел.") },
    document.querySelector(".metal-row") && { target: ".metal-row", title: tr("Цены на металлы"), content: tr("Биржевые цены обновляются каждый рабочий день. Нажмите на металл: откроется график и калькулятор стоимости месторождения.") },
    { target: visible('.app-header-pill a[href="/map"]'), title: tr("Карта"), content: tr("Все участки группы на карте: спутник, рельеф, линейка, профиль рельефа, сохранение в PDF.") },
    { target: visible('.app-header-pill a[href="/licenses"]'), title: tr("Лицензии"), content: tr("Реестр лицензий. В карточке лицензии: контур, документы, скважины в 3D, исторические отчёты, задачи, заметки и схемы.") },
    { target: visible('.app-header-pill a[href="/projects"]'), title: tr("Потенциальные проекты"), content: tr("Объекты на рассмотрении: этапы, следующий шаг, тизер PDF и презентация PowerPoint для инвестора одной кнопкой.") },
    { target: visible('.app-header-pill a[href="/presentations"]'), title: tr("Презентации"), content: tr("Все материалы для инвесторов: просмотр, ссылка на скачивание, WhatsApp, Telegram, QR-код.") },
    { target: visible('.app-header-pill a[href="/tasks"]'), title: tr("Задачи и сроки"), content: tr("Доска задач, календарь сроков и диаграмма лицензий. За 90 дней до окончания лицензии задача на продление появляется сама.") },
    { target: visible('[aria-label^="' + tr("Все разделы") + '"]'), title: tr("Все разделы"), content: tr("Полный список страниц: аналитика, документы, журнал изменений. Быстро открывается сочетанием Ctrl+K.") },
    document.querySelector(".lang-switch") && { target: visible(".lang-switch"), title: tr("Язык"), content: tr("Интерфейс на русском, английском или китайском. Удобно показывать систему партнёрам.") },
    { target: visible(".assistant-fab"), title: tr("ИИ-ассистент"), content: tr("Спросите обычными словами: «какие лицензии истекают в этом году?» — ассистент ответит по реестру и документам.") },
  ];
  return s.filter((x): x is Step => !!x);
}

export function startTour() {
  window.dispatchEvent(new Event(TOUR_EVENT));
}

export default function WelcomeTour() {
  const path = usePathname();
  const router = useRouter();
  const [run, setRun] = useState(false);
  const [list, setList] = useState<Step[]>([]);

  const begin = () => {
    // give the page a moment to draw its blocks
    setTimeout(() => {
      setList(steps());
      setRun(true);
    }, 600);
  };

  useEffect(() => {
    if (path !== "/") return;
    let done = true;
    try {
      done = localStorage.getItem(DONE_KEY) === "1";
    } catch {
      /* storage blocked: do not insist */
    }
    if (!done) begin();
  }, [path]);

  useEffect(() => {
    const on = () => {
      if (path !== "/") {
        router.push("/");
        setTimeout(begin, 900);
      } else begin();
    };
    window.addEventListener(TOUR_EVENT, on);
    return () => window.removeEventListener(TOUR_EVENT, on);
  }, [path, router]);

  function onEvent(d: EventData) {
    if (d.status === STATUS.FINISHED || d.status === STATUS.SKIPPED) {
      setRun(false);
      try {
        localStorage.setItem(DONE_KEY, "1");
      } catch {
        /* nothing to remember */
      }
    }
  }

  if (!run) return null;
  return (
    <Joyride
      run
      steps={list}
      continuous
      onEvent={onEvent}
      options={{
        primaryColor: "#C08A1E",
        backgroundColor: "#151b22",
        textColor: "#e8eaed",
        arrowColor: "#151b22",
        overlayColor: "rgba(4, 8, 12, 0.6)",
        zIndex: 1200,
        showProgress: true,
        buttons: ["back", "skip", "primary"],
        spotlightRadius: 12,
        targetWaitTimeout: 1500,
      }}
      locale={{ back: tr("Назад"), close: tr("Закрыть"), last: tr("Готово"), next: tr("Далее"), nextWithProgress: tr("Далее ({current} из {total})"), skip: tr("Пропустить") }}
    />
  );
}
