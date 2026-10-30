"use client";

// Founding documents of a company (charter, registration certificate, founders' decisions…). Closed: only
// administrators and people an administrator allowed on the «Сотрудники» page see this list and the files.
// The database and the file storage check the access themselves, so a direct link does not open for others.
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Column, Row, Text } from "@once-ui-system/core";
import { tr, loc } from "@/i18n";
import { createClient } from "@/lib/supabase/client";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, uploadFile } from "@/lib/upload";
import { FOUNDING_CATEGORIES, formatDate, type FoundingDoc } from "@/lib/types";

const PdfViewer = dynamic(() => import("./PdfViewer"), { ssr: false });
const BUCKET = "founding";
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.tif,.tiff,.zip";
const extOf = (n: string) => (n.split(".").pop() ?? "").toLowerCase();
const sizeText = (b: number | null) =>
  b == null ? "" : b < 1024 * 1024 ? tr("{0} КБ", { 0: Math.max(1, Math.round(b / 1024)) }) : tr("{0} МБ", { 0: (b / 1024 / 1024).toLocaleString(loc(), { maximumFractionDigits: 1 }) });
const when = (iso: string) => new Date(iso).toLocaleDateString(loc(), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Almaty" });

async function link(d: FoundingDoc, download: boolean) {
  // a short-lived link (5 minutes), made only for someone the storage lets in
  const { data, error } = await createClient().storage.from(BUCKET).createSignedUrl(d.file_path, 300, download ? { download: d.file_name } : undefined);
  if (error || !data) throw new Error(tr("Не удалось открыть файл. Проверьте интернет и попробуйте ещё раз."));
  return data.signedUrl;
}

export default function FoundingDocs({ companyId, docs, canEdit }: { companyId: number; docs: FoundingDoc[]; canEdit: boolean }) {
  const router = useRouter();
  const [pdf, setPdf] = useState<{ url: string; doc: FoundingDoc } | null>(null);
  const [err, setErr] = useState("");

  async function open(d: FoundingDoc) {
    setErr("");
    try {
      if (extOf(d.file_name) === "pdf") setPdf({ url: await link(d, false), doc: d });
      else if (["png", "jpg", "jpeg"].includes(extOf(d.file_name))) window.open(await link(d, false), "_blank", "noopener");
      else await download(d);
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function download(d: FoundingDoc) {
    const a = document.createElement("a");
    a.href = await link(d, true);
    a.download = d.file_name;
    a.click();
  }
  async function remove(d: FoundingDoc) {
    if (!confirm(tr("Удалить документ «{0}»? Файл будет удалён без возможности восстановить.", { 0: d.title }))) return;
    const supabase = createClient();
    const { error } = await supabase.from("founding_documents").delete().eq("id", d.id);
    if (error) return setErr(tr("Не получилось: {0}", { 0: error.message }));
    await supabase.storage.from(BUCKET).remove([d.file_path]);
    router.refresh();
  }

  return (
    <Column gap="24">
      <div className="founding-note">
        <span aria-hidden>🔒</span>
        <Text variant="body-default-s">
          {tr("Закрытый раздел. Его видят только администраторы и сотрудники, которым администратор открыл доступ на странице «Сотрудники».")}
        </Text>
      </div>

      {canEdit && <Uploader companyId={companyId} onDone={() => router.refresh()} />}
      {err && (
        <Text variant="body-default-s" onBackground="danger-strong" role="alert">
          {err}
        </Text>
      )}

      {docs.length === 0 ? (
        <Text variant="body-default-m" onBackground="neutral-weak">
          {tr("Учредительных документов пока нет.")}
        </Text>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{tr("Документ")}</th>
                <th>{tr("Вид")}</th>
                <th>{tr("Дата документа")}</th>
                <th>{tr("Загрузил")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>
                    <button type="button" className="link-button" onClick={() => open(d)}>
                      {d.title}
                    </button>
                    <div className="staff-mail">
                      {d.file_name} · {sizeText(d.size_bytes)}
                    </div>
                  </td>
                  <td>{d.category ? tr(d.category) : "—"}</td>
                  <td>{formatDate(d.doc_date)}</td>
                  <td>
                    {d.uploaded_by ?? "—"}
                    <div className="staff-mail">{when(d.created_at)}</div>
                  </td>
                  <td>
                    <Row gap="4" wrap>
                      <Button size="s" variant="secondary" onClick={() => open(d)}>{tr("Открыть")}</Button>
                      <Button size="s" variant="tertiary" onClick={() => download(d).catch((e) => setErr(e.message))}>{tr("Скачать")}</Button>
                      {canEdit && <Button size="s" variant="tertiary" onClick={() => remove(d)}>{tr("Удалить")}</Button>}
                    </Row>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pdf && <PdfViewer url={pdf.url} title={pdf.doc.title} onClose={() => setPdf(null)} onDownload={() => download(pdf.doc)} />}
    </Column>
  );
}

function Uploader({ companyId, onDone }: { companyId: number; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(FOUNDING_CATEGORIES[0]);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function pick(f: File | null) {
    setMsg(null);
    if (f && f.size > MAX_UPLOAD_BYTES) {
      setMsg({ ok: false, text: tr("Файл больше {0} МБ — так много хранилище не принимает.", { 0: MAX_UPLOAD_MB }) });
      return;
    }
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(0);
    setMsg(null);
    const supabase = createClient();
    const safe = file.name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80);
    const path = `${companyId}/${Date.now()}-${safe}`;
    const up = await uploadFile(BUCKET, path, file, (s) => setBusy(s));
    if (up.error) {
      setBusy(null);
      return setMsg({ ok: false, text: tr("Не загрузилось: {0}", { 0: up.error }) });
    }
    const { data: s } = await supabase.auth.getSession();
    const { error } = await supabase.from("founding_documents").insert({
      company_id: companyId,
      title: title.trim() || file.name,
      category,
      doc_date: date || null,
      file_name: file.name,
      file_path: path,
      size_bytes: file.size,
      uploaded_by: s.session?.user.email ?? null,
    });
    setBusy(null);
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      return setMsg({ ok: false, text: tr("Не сохранилось: {0}", { 0: error.message }) });
    }
    setMsg({ ok: true, text: tr("Загружено: {0}", { 0: title.trim() || file.name }) });
    setFile(null);
    setTitle("");
    setDate("");
    if (input.current) input.current.value = "";
    onDone();
  }

  return (
    <form className="staff-add" onSubmit={submit}>
      <h2>{tr("Загрузить документ")}</h2>
      <div className="staff-add-grid">
        <label className="field-label">
          {tr("Файл (PDF, Word, скан) — до {0} МБ", { 0: MAX_UPLOAD_MB })}
          <input ref={input} className="field" type="file" accept={ACCEPT} onChange={(e) => pick(e.target.files?.[0] ?? null)} required />
        </label>
        <label className="field-label">
          {tr("Название")}
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr("например, Устав в редакции 2024 года")} required />
        </label>
        <label className="field-label">
          {tr("Вид документа")}
          <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            {FOUNDING_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tr(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          {tr("Дата документа")}
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <Row gap="12" vertical="center" wrap>
        <Button type="submit" prefixIcon="plus" loading={busy != null} disabled={!file}>
          {busy != null && busy > 0 && busy < 1 ? tr("Загружаю… {0}%", { 0: Math.round(busy * 100) }) : tr("Загрузить")}
        </Button>
        {msg && (
          <Text variant="body-default-s" onBackground={msg.ok ? "success-strong" : "danger-strong"} role="status">
            {msg.text}
          </Text>
        )}
      </Row>
    </form>
  );
}
