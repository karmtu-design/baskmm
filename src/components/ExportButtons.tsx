"use client";

import { useState } from "react";
import { Button, Icon, Row, Text } from "@once-ui-system/core";
import { createClient } from "@/lib/supabase/client";
import type { License, PotentialProject } from "@/lib/types";

/** «Справка в Word» on the licence card: facts, corner points, documents and open tasks. */
export function LicenseDocxButton({ license }: { license: License }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function run() {
    setBusy(true);
    setErr("");
    try {
      const supabase = createClient();
      const [docs, tasks] = await Promise.all([
        supabase.from("documents").select("title, category, doc_date, year").eq("license_id", license.id).order("created_at"),
        supabase.from("tasks").select("title, assignee, due_date").eq("license_id", license.id).neq("status", "done").order("due_date"),
      ]);
      const { downloadLicenseDocx } = await import("@/lib/docExport");
      await downloadLicenseDocx(license, { docs: docs.data ?? [], tasks: tasks.data ?? [] });
    } catch (e) {
      setErr(`Не получилось: ${(e as Error).message}`);
    }
    setBusy(false);
  }
  return (
    <Row gap="8" vertical="center">
      <Button variant="secondary" prefixIcon="download" loading={busy} onClick={run}>
        Справка в Word
      </Button>
      {err && (
        <Text variant="body-default-xs" onBackground="danger-strong" role="alert">
          {err}
        </Text>
      )}
    </Row>
  );
}

/** «Тизер PDF» on the project card: one page for investors, in Russian or English. */
export function TeaserButton({ project }: { project: PotentialProject }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<"ru" | "en">("ru");
  const [about, setAbout] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function run() {
    setBusy(true);
    setErr("");
    try {
      const { downloadProjectTeaser } = await import("@/lib/docExport");
      await downloadProjectTeaser(project, lang, about);
      setOpen(false);
    } catch (e) {
      setErr(`Не получилось: ${(e as Error).message}`);
    }
    setBusy(false);
  }
  return (
    <>
      <Button variant="secondary" prefixIcon="document" onClick={() => setOpen(true)}>
        Тизер PDF
      </Button>
      {open && (
        <div className="nav-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="nav-dialog share-dialog" role="dialog" aria-modal="true" aria-label="Тизер проекта">
            <div className="nav-head">
              <span>Тизер проекта для инвестора</span>
              <button type="button" className="nav-close" onClick={() => setOpen(false)} aria-label="Закрыть">
                <Icon name="close" size="s" />
              </button>
            </div>
            <div className="share-body">
              <p>
                Одна страница PDF с логотипом BASK: металл, расположение, координаты, формат сделки, запасы и условия.
                Владелец, контакты, источник и внутренние заметки в тизер не попадают.
              </p>
              <Row gap="8" vertical="center">
                <span className="share-label">Язык подписей:</span>
                <button type="button" className={`chip${lang === "ru" ? " is-on" : ""}`} onClick={() => setLang("ru")}>
                  Русский
                </button>
                <button type="button" className={`chip${lang === "en" ? " is-on" : ""}`} onClick={() => setLang("en")}>
                  English
                </button>
              </Row>
              {lang === "en" && (
                <p>Подписи будут на английском, а значения полей выводятся так, как они заполнены в карточке проекта.</p>
              )}
              <label className="field-label">
                Короткое описание для инвестора (необязательно)
                <textarea className="field" rows={5} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="2–4 предложения: что за объект, чем интересен, что уже сделано" />
              </label>
              <Row gap="8">
                <Button prefixIcon="download" loading={busy} onClick={run}>
                  Скачать PDF
                </Button>
                <Button variant="tertiary" onClick={() => setOpen(false)}>
                  Отмена
                </Button>
              </Row>
              {err && (
                <Text variant="body-default-s" onBackground="danger-strong" role="alert">
                  {err}
                </Text>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
