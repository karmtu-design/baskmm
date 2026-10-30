"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Column, Heading, Icon, Row, Tag, Text } from "@once-ui-system/core";
import { createClient } from "@/lib/supabase/client";
import { DOC_CATEGORIES, HISTORY_CATEGORIES, formatDate, type DocKind, type DocumentRow } from "@/lib/types";
import { addDocument, deleteDocument, searchDocuments, updateDocument, type DocHit } from "@/app/(app)/documents/actions";

const PdfViewer = dynamic(() => import("./PdfViewer"), { ssr: false });

const BUCKET = "documents";
const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.tif,.tiff,.txt,.csv,.zip,.dwg,.dxf,.kml,.kmz";
const extOf = (name: string) => (name.split(".").pop() ?? "").toLowerCase();
const isImage = (n: string) => ["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"].includes(extOf(n));
const canRead = (n: string) => ["pdf", "docx", "xlsx", "txt", "csv"].includes(extOf(n)) || isImage(n);
const sizeText = (b: number | null) =>
  b == null ? "" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} КБ` : `${(b / 1024 / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ`;

type Owners = { licenses?: Record<number, string>; projects?: Record<number, string> };

const STATUS: Record<DocumentRow["text_status"], { label: string; scheme: "success" | "info" | "neutral" | "warning" | "danger" }> = {
  done: { label: "текст есть", scheme: "success" },
  ocr: { label: "скан распознан", scheme: "info" },
  none: { label: "текст не прочитан", scheme: "neutral" },
  unsupported: { label: "без текста", scheme: "neutral" },
  failed: { label: "текст не прочитался", scheme: "warning" },
};

async function signedUrl(path: string, fileName: string, download: boolean) {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 900, download ? { download: fileName } : undefined);
  if (error || !data) throw new Error("Не удалось открыть файл. Проверьте интернет и попробуйте ещё раз.");
  return data.signedUrl;
}

/** Reads text out of a file and stores it with the document, so search finds it. */
async function readAndSave(id: number, file: Blob, fileName: string, ocr: boolean, onStep: (s: string) => void) {
  const { extractText } = await import("@/lib/docText");
  const r = await extractText(file, fileName, {
    ocr,
    onProgress: (d, t, stage) => onStep(stage === "ocr" ? `распознаю скан: страница ${Math.min(d + 1, t)} из ${t}` : `читаю текст: страница ${d} из ${t}`),
  });
  const supabase = createClient();
  const { error } = await supabase
    .from("documents")
    .update({ text_content: r.text || null, text_status: r.text ? r.status : r.status === "done" ? "unsupported" : r.status, pages: r.pages })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return r;
}

export default function DocumentsPanel({
  kind,
  items,
  licenseId = null,
  projectId = null,
  owners,
  allowUpload = true,
}: {
  kind: DocKind;
  items: DocumentRow[];
  licenseId?: number | null;
  projectId?: number | null;
  owners?: Owners;
  allowUpload?: boolean;
}) {
  const router = useRouter();
  const categories = kind === "history" ? HISTORY_CATEGORIES : DOC_CATEGORIES;
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<DocHit[] | null>(null);
  const [searching, startSearch] = useTransition();
  const [searchErr, setSearchErr] = useState("");
  const [cat, setCat] = useState("");
  const [viewer, setViewer] = useState<{ url: string; doc: DocumentRow } | null>(null);
  const [edit, setEdit] = useState<DocumentRow | null>(null);

  const allCats = useMemo(() => [...new Set([...categories, ...(items.map((i) => i.category).filter(Boolean) as string[])])], [categories, items]);
  const byId = useMemo(() => new Map(items.map((d) => [d.id, d])), [items]);
  const list = hits ? (hits.map((h) => byId.get(h.id)).filter(Boolean) as DocumentRow[]) : items.filter((d) => !cat || d.category === cat);
  const snippet = useMemo(() => new Map((hits ?? []).map((h) => [h.id, h.snippet])), [hits]);

  function runSearch(text: string) {
    setSearchErr("");
    if (!text.trim()) return setHits(null);
    startSearch(async () => {
      const r = await searchDocuments(text, { licenseId: licenseId ?? undefined, projectId: projectId ?? undefined });
      if (r.message) setSearchErr(r.message);
      setHits(r.hits);
    });
  }

  async function open(d: DocumentRow) {
    try {
      if (extOf(d.file_name) === "pdf") setViewer({ url: await signedUrl(d.file_path, d.file_name, false), doc: d });
      else if (isImage(d.file_name)) window.open(await signedUrl(d.file_path, d.file_name, false), "_blank", "noopener");
      else download(d);
    } catch (e) {
      alertText((e as Error).message);
    }
  }
  async function download(d: DocumentRow) {
    const a = document.createElement("a");
    a.href = await signedUrl(d.file_path, d.file_name, true);
    a.download = d.file_name;
    a.click();
  }

  const owner = (d: DocumentRow) =>
    d.license_id && owners?.licenses?.[d.license_id] ? (
      <Link href={`/licenses/${d.license_id}?tab=${d.kind === "history" ? "history" : "docs"}`}>{owners.licenses[d.license_id]}</Link>
    ) : d.project_id && owners?.projects?.[d.project_id] ? (
      <Link href={`/projects/${d.project_id}`}>{owners.projects[d.project_id]}</Link>
    ) : null;

  return (
    <Column gap="24">
      {allowUpload && <Uploader kind={kind} categories={categories} licenseId={licenseId} projectId={projectId} onDone={() => router.refresh()} />}

      <Column gap="12">
        <Row wrap gap="8" vertical="center">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(q);
            }}
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <input
              type="search"
              className="field"
              placeholder="Поиск по названию и тексту документов"
              aria-label="Поиск по документам"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (!e.target.value) setHits(null);
              }}
              style={{ width: 320, minHeight: 40 }}
            />
            <Button type="submit" variant="secondary" size="m" prefixIcon="search" loading={searching}>
              Найти
            </Button>
          </form>
          {!hits && (
            <select aria-label="Категория" className="field" style={{ width: "auto", minHeight: 40 }} value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Все категории</option>
              {allCats.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
          <Text variant="body-default-s" onBackground="neutral-weak" style={{ marginLeft: "auto" }}>
            {hits ? `Найдено: ${list.length}` : `Документов: ${list.length}${cat ? ` из ${items.length}` : ""}`}
          </Text>
        </Row>
        {hits && (
          <Row>
            <Button
              size="s"
              variant="tertiary"
              prefixIcon="close"
              onClick={() => {
                setQ("");
                setHits(null);
              }}
            >
              Сбросить поиск
            </Button>
          </Row>
        )}
        {searchErr && (
          <Text variant="body-default-s" onBackground="danger-strong" role="alert">
            Поиск не сработал: {searchErr}
          </Text>
        )}

        {items.length === 0 ? (
          <Column border radius="l" padding="24" style={{ borderStyle: "dashed" }}>
            <Text onBackground="neutral-weak">
              {kind === "history"
                ? "Исторических материалов пока нет. Загрузите старые отчёты, подсчёты запасов, карты: текст сканов будет распознан, и по нему заработает поиск."
                : "Документов пока нет. Загрузите первый в блоке выше."}
            </Text>
          </Column>
        ) : list.length === 0 ? (
          <Text onBackground="neutral-weak">{hits ? "Ничего не найдено. Попробуйте другое слово." : "В этой категории документов нет."}</Text>
        ) : (
          <ul className="doc-list">
            {list.map((d) => (
              <DocItem
                key={d.id}
                d={d}
                owner={owner(d)}
                snippet={snippet.get(d.id)}
                onOpen={() => open(d)}
                onDownload={() => download(d)}
                onEdit={() => setEdit(d)}
                onChanged={() => router.refresh()}
              />
            ))}
          </ul>
        )}
      </Column>

      {viewer && <PdfViewer url={viewer.url} title={viewer.doc.title} onClose={() => setViewer(null)} onDownload={() => download(viewer.doc)} />}
      {edit && <EditDialog d={edit} categories={allCats} onClose={() => setEdit(null)} />}
    </Column>
  );
}

function alertText(t: string) {
  // a short status line instead of a browser dialog
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "alert");
  el.textContent = t;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

// ---------- one document ----------

function Highlight({ text }: { text: string }) {
  const parts = text.split(/<<|>>/);
  return (
    <p className="doc-snippet">
      …{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}…
    </p>
  );
}

function DocItem({
  d,
  owner,
  snippet,
  onOpen,
  onDownload,
  onEdit,
  onChanged,
}: {
  d: DocumentRow;
  owner: React.ReactNode;
  snippet?: string;
  onOpen: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [step, setStep] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const st = STATUS[d.text_status];
  const ext = extOf(d.file_name);

  async function reread() {
    setErr("");
    setStep("скачиваю файл");
    try {
      const url = await signedUrl(d.file_path, d.file_name, false);
      const blob = await (await fetch(url)).blob();
      const r = await readAndSave(d.id, blob, d.file_name, true, setStep);
      setStep(r.text ? "готово" : r.note ?? "текст не найден");
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
      setStep("");
    }
  }

  return (
    <li className="doc-item">
      <span className={`pres-kind kind-${ext === "pdf" ? "PDF" : ["doc", "docx"].includes(ext) ? "DOC" : ["xls", "xlsx", "csv"].includes(ext) ? "XLS" : isImage(d.file_name) ? "IMG" : ["ppt", "pptx"].includes(ext) ? "PPT" : "FILE"}`} aria-hidden>
        {ext.toUpperCase().slice(0, 4) || "FILE"}
      </span>
      <div className="doc-main">
        <button type="button" className="doc-title" onClick={onOpen}>
          {d.title}
        </button>
        <div className="doc-meta">
          {[
            d.category,
            d.doc_date ? formatDate(d.doc_date) : d.year ? `${d.year} г.` : null,
            d.source,
            d.pages ? `${d.pages} стр.` : null,
            sizeText(d.size_bytes),
          ]
            .filter(Boolean)
            .join(" · ")}
          {owner && <> · {owner}</>}
        </div>
        {snippet && <Highlight text={snippet} />}
        {d.notes && !snippet && <p className="doc-notes">{d.notes}</p>}
        <Row gap="8" wrap vertical="center" style={{ marginTop: 6 }}>
          <Tag as="span" size="s" scheme={st.scheme} label={st.label} />
          {step && (
            <Text variant="body-default-xs" onBackground="neutral-weak" role="status">
              {step}
            </Text>
          )}
          {err && (
            <Text variant="body-default-xs" onBackground="danger-strong" role="alert">
              {err}
            </Text>
          )}
        </Row>
      </div>
      <div className="doc-actions">
        <Button size="s" variant="secondary" prefixIcon={ext === "pdf" || isImage(d.file_name) ? "eye" : "download"} onClick={onOpen}>
          {ext === "pdf" || isImage(d.file_name) ? "Открыть" : "Скачать"}
        </Button>
        {(ext === "pdf" || isImage(d.file_name)) && <Button size="s" variant="tertiary" prefixIcon="download" aria-label="Скачать" onClick={onDownload} />}
        {canRead(d.file_name) && d.text_status !== "done" && d.text_status !== "ocr" && !step && (
          <Button size="s" variant="tertiary" prefixIcon="refresh" onClick={reread}>
            Распознать текст
          </Button>
        )}
        {confirm ? (
          <>
            <Button
              size="s"
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteDocument(d.id);
                  if (!r.ok) setErr(r.message ?? "Ошибка");
                  else onChanged();
                  setConfirm(false);
                })
              }
            >
              Удалить файл
            </Button>
            <Button size="s" variant="tertiary" onClick={() => setConfirm(false)}>
              Нет
            </Button>
          </>
        ) : (
          <>
            <Button size="s" variant="tertiary" prefixIcon="edit" aria-label="Изменить описание" onClick={onEdit} />
            <Button size="s" variant="tertiary" prefixIcon="trash" aria-label="Удалить" onClick={() => setConfirm(true)} />
          </>
        )}
      </div>
    </li>
  );
}

// ---------- upload ----------

type Job = { name: string; step: string; ok?: boolean };

function Uploader({
  kind,
  categories,
  licenseId,
  projectId,
  onDone,
}: {
  kind: DocKind;
  categories: string[];
  licenseId: number | null;
  projectId: number | null;
  onDone: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [docDate, setDocDate] = useState("");
  const [year, setYear] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [ocr, setOcr] = useState(true);
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function pick(list: FileList | null) {
    if (!list?.length) return;
    const arr = [...list];
    setFiles(arr);
    setJobs([]);
    if (arr.length === 1) setTitle(arr[0].name.replace(/\.[^.]+$/, ""));
    const y = arr[0].name.match(/(19[2-9]\d|20[0-4]\d)/);
    if (kind === "history" && y && !year) setYear(y[1]);
  }

  async function upload() {
    setBusy(true);
    const supabase = createClient();
    const list: Job[] = files.map((f) => ({ name: f.name, step: "в очереди" }));
    setJobs([...list]);
    const set = (i: number, step: string, ok?: boolean) => {
      list[i] = { ...list[i], step, ok };
      setJobs([...list]);
    };
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size > MAX_BYTES) {
        set(i, "больше 50 МБ, не загружен. Сожмите файл или разделите на части.", false);
        continue;
      }
      set(i, "загружаю файл");
      const path = `${licenseId ? `lic-${licenseId}` : projectId ? `proj-${projectId}` : "misc"}/${crypto.randomUUID()}.${extOf(f.name).replace(/[^a-z0-9]/g, "") || "bin"}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || undefined });
      if (error) {
        set(i, `не загрузился: ${error.message}`, false);
        continue;
      }
      const r = await addDocument({
        kind,
        license_id: licenseId,
        project_id: projectId,
        title: files.length === 1 ? title || f.name : f.name.replace(/\.[^.]+$/, ""),
        category,
        doc_date: docDate || null,
        year: year ? Number(year) : null,
        source: source || null,
        notes: notes || null,
        file_path: path,
        file_name: f.name,
        mime_type: f.type || null,
        size_bytes: f.size,
      });
      if (!r.ok || !r.id) {
        await supabase.storage.from(BUCKET).remove([path]);
        set(i, `не сохранился: ${r.message}`, false);
        continue;
      }
      if (canRead(f.name)) {
        try {
          const t = await readAndSave(r.id, f, f.name, ocr, (s) => set(i, s));
          set(i, t.text ? `готово, текст для поиска: ${t.text.length.toLocaleString("ru-RU")} знаков${t.note ? ` (${t.note})` : ""}` : `загружен; ${t.note ?? "текст не найден"}`, true);
        } catch (e) {
          set(i, `загружен, но текст не прочитался: ${(e as Error).message}`, true);
        }
      } else set(i, "загружен (текст из этого типа файлов не читается)", true);
    }
    setBusy(false);
    setFiles([]);
    setTitle("");
    setNotes("");
    if (input.current) input.current.value = "";
    onDone();
  }

  return (
    <Column background="surface" border radius="l" padding="24" gap="16">
      <Heading as="h2" variant="heading-strong-m">
        {kind === "history" ? "Загрузить исторические материалы" : "Загрузить документы"}
      </Heading>
      <label
        className={`drop-zone${drag ? " is-drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files);
        }}
      >
        <input ref={input} type="file" multiple accept={ACCEPT} onChange={(e) => pick(e.target.files)} className="visually-hidden" />
        <Icon name="upload" size="m" />
        <span>
          {files.length === 0 ? (
            <>
              <b>Выберите файлы</b> или перетащите их сюда
            </>
          ) : (
            files.map((f) => `${f.name} (${sizeText(f.size)})`).join(", ")
          )}
        </span>
        <small>PDF, сканы, Word, Excel, картинки, до 50 МБ на файл. Текст из файлов попадёт в поиск.</small>
      </label>

      {files.length > 0 && (
        <div className="pres-form">
          {files.length === 1 && (
            <label className="field-label">
              Название
              <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
          )}
          <label className="field-label">
            Категория
            <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {kind === "history" ? (
            <label className="field-label">
              Год
              <input className="field" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="например, 1972" />
            </label>
          ) : (
            <label className="field-label">
              Дата документа
              <input className="field" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
            </label>
          )}
          {kind === "history" && (
            <label className="field-label">
              Источник
              <input className="field" value={source} onChange={(e) => setSource(e.target.value)} placeholder="геолфонды, архив, автор отчёта" />
            </label>
          )}
          <label className="field-label" style={{ gridColumn: "1 / -1" }}>
            Примечание (необязательно)
            <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <Checkbox
              label="Распознавать сканы и фотографии (дольше: несколько секунд на страницу, до 40 страниц)"
              checked={ocr}
              onToggle={setOcr}
            />
          </div>
          <Row gap="12" vertical="center" style={{ gridColumn: "1 / -1" }}>
            <Button prefixIcon="upload" onClick={upload} loading={busy}>
              {files.length === 1 ? "Загрузить" : `Загрузить файлов: ${files.length}`}
            </Button>
            {!busy && (
              <Button variant="tertiary" onClick={() => setFiles([])}>
                Отмена
              </Button>
            )}
          </Row>
        </div>
      )}
      {jobs.length > 0 && (
        <ul className="job-list" aria-live="polite">
          {jobs.map((j, i) => (
            <li key={i} className={j.ok === false ? "is-bad" : j.ok ? "is-ok" : ""}>
              <b>{j.name}</b>: {j.step}
            </li>
          ))}
          {busy && <li className="job-hint">Не закрывайте страницу, пока идёт распознавание.</li>}
        </ul>
      )}
    </Column>
  );
}

// ---------- edit ----------

function EditDialog({ d, categories, onClose }: { d: DocumentRow; categories: string[]; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(d.title);
  const [category, setCategory] = useState(d.category ?? "");
  const [docDate, setDocDate] = useState(d.doc_date ?? "");
  const [year, setYear] = useState(d.year ? String(d.year) : "");
  const [source, setSource] = useState(d.source ?? "");
  const [notes, setNotes] = useState(d.notes ?? "");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const r = await updateDocument(d.id, { title, category: category || null, doc_date: docDate || null, year: year ? Number(year) : null, source: source || null, notes: notes || null });
      if (!r.ok) return setErr(r.message ?? "Ошибка");
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="nav-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="nav-dialog share-dialog" role="dialog" aria-modal="true" aria-label="Изменить описание документа">
        <div className="nav-head">
          <span>Изменить описание</span>
          <button type="button" className="nav-close" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" size="s" />
          </button>
        </div>
        <div className="share-body pres-form">
          <label className="field-label" style={{ gridColumn: "1 / -1" }}>
            Название
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field-label">
            Категория
            <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {d.kind === "history" ? (
            <label className="field-label">
              Год
              <input className="field" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            </label>
          ) : (
            <label className="field-label">
              Дата документа
              <input className="field" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
            </label>
          )}
          {d.kind === "history" && (
            <label className="field-label" style={{ gridColumn: "1 / -1" }}>
              Источник
              <input className="field" value={source} onChange={(e) => setSource(e.target.value)} />
            </label>
          )}
          <label className="field-label" style={{ gridColumn: "1 / -1" }}>
            Примечание
            <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <Row gap="8" style={{ gridColumn: "1 / -1" }}>
            <Button onClick={save} loading={pending}>
              Сохранить
            </Button>
            <Button variant="tertiary" onClick={onClose}>
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
  );
}
