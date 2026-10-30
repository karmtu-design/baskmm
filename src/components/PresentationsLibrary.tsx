"use client";

import { tr, loc } from "@/i18n";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button, Column, Heading, Icon, Row, Text } from "@once-ui-system/core";
import { createClient } from "@/lib/supabase/client";
import { PRESENTATION_LANGUAGES, type Presentation } from "@/lib/types";
import { addPresentation, deletePresentation, updatePresentation } from "@/app/(app)/presentations/actions";

const PdfViewer = dynamic(() => import("./PdfViewer"), { ssr: false });
const OfficeViewer = dynamic(() => import("./OfficeViewer"), { ssr: false });

const BUCKET = "presentations";
import { MAX_UPLOAD_BYTES as MAX_BYTES, MAX_UPLOAD_MB, uploadFile } from "@/lib/upload";
const ACCEPT = ".pdf,.ppt,.pptx,.key,.odp,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip,.mp4";

const sizeText = (b: number | null) =>
  b == null ? "" : b < 1024 * 1024 ? tr("{0} КБ", { 0: Math.max(1, Math.round(b / 1024)) }) : tr("{0} МБ", { 0: (b / 1024 / 1024).toLocaleString(loc(), { maximumFractionDigits: 1 }) });
const dateText = (iso: string) => new Date(iso).toLocaleDateString(loc(), { day: "2-digit", month: "2-digit", year: "numeric" });
const extOf = (name: string) => (name.split(".").pop() ?? "").toLowerCase();
const KIND: Record<string, string> = { pdf: "PDF", ppt: "PPT", pptx: "PPT", key: "KEY", odp: "ODP", doc: "DOC", docx: "DOC", xls: "XLS", xlsx: "XLS", png: "IMG", jpg: "IMG", jpeg: "IMG", zip: "ZIP", mp4: "VIDEO" };

/** Storage keys must be plain Latin: the original Russian name is kept in the card and used for downloads. */
function storageKey(name: string) {
  const ext = extOf(name).replace(/[^a-z0-9]/g, "") || "bin";
  return `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
}

const LINK_DAYS = [
  { days: 1, label: "1 день" },
  { days: 7, label: "7 дней" },
  { days: 30, label: "30 дней" },
];

export default function PresentationsLibrary({ items, projects }: { items: Presentation[]; projects: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [shareFor, setShareFor] = useState<Presentation | null>(null);
  const [editFor, setEditFor] = useState<Presentation | null>(null);

  const allProjects = useMemo(
    () => [...new Set([...projects, ...items.map((i) => i.project).filter(Boolean) as string[]])].sort((a, b) => a.localeCompare(b, "ru")),
    [projects, items]
  );
  const shown = items.filter((p) => {
    const s = q.trim().toLowerCase();
    return (
      (!projectFilter || p.project === projectFilter) &&
      (!s || `${p.title} ${p.project ?? ""} ${p.file_name} ${p.description ?? ""} ${p.language ?? ""}`.toLowerCase().includes(s))
    );
  });

  return (
    <Column gap="32">
      <Uploader projects={allProjects} onDone={() => router.refresh()} />

      <Column gap="16">
        <Row wrap gap="8" vertical="center">
          <input
            type="search"
            className="field"
            placeholder={tr("Поиск: название, проект, язык…")}
            aria-label={tr("Поиск по презентациям")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 300, minHeight: 40 }}
          />
          <select aria-label={tr("Проект")} className="field" style={{ width: "auto", minHeight: 40 }} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">{tr("Все проекты")}</option>
            {allProjects.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <Text variant="body-default-s" onBackground="neutral-weak" style={{ marginLeft: "auto" }}>{tr("Файлов:")}{" "}{shown.length}{" "}{tr("из")}{" "}{items.length}
          </Text>
        </Row>

        {items.length === 0 ? (
          <Column border radius="l" padding="24" style={{ borderStyle: "dashed" }}>
            <Text onBackground="neutral-weak">{tr("Презентаций пока нет. Загрузите первую в блоке выше.")}</Text>
          </Column>
        ) : shown.length === 0 ? (
          <Text onBackground="neutral-weak">{tr("Ничего не найдено. Измените условия поиска.")}</Text>
        ) : (
          <div className="pres-grid">
            {shown.map((p) => (
              <PresentationCard key={p.id} p={p} onShare={() => setShareFor(p)} onEdit={() => setEditFor(p)} />
            ))}
          </div>
        )}
      </Column>

      {shareFor && <ShareDialog p={shareFor} onClose={() => setShareFor(null)} />}
      {editFor && <EditDialog p={editFor} projects={allProjects} onClose={() => setEditFor(null)} />}
    </Column>
  );
}

// ---------- upload ----------

function Uploader({ projects, onDone }: { projects: string[]; onDone: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [language, setLanguage] = useState(PRESENTATION_LANGUAGES[0]);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function pick(list: FileList | null) {
    if (!list?.length) return;
    const arr = [...list];
    setFiles(arr);
    setMsg(null);
    if (arr.length === 1) setTitle(arr[0].name.replace(/\.[^.]+$/, ""));
  }

  async function upload() {
    const big = files.find((f) => f.size > MAX_BYTES);
    if (big) return setMsg({ ok: false, text: tr("Файл «{0}» больше {1} МБ. Сожмите его (например, сохраните PDF в меньшем качестве) и загрузите снова.", { 0: big.name, 1: MAX_UPLOAD_MB }) });
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const failed: string[] = [];
    for (const f of files) {
      const path = storageKey(f.name);
      const { error } = await uploadFile(BUCKET, path, f, (share) => setProgress(files.length > 1 ? `${f.name}: ${Math.round(share * 100)}%` : `${Math.round(share * 100)}%`));
      if (error) {
        failed.push(`${f.name}: ${error}`);
        continue;
      }
      const r = await addPresentation({
        title: files.length === 1 ? title || f.name : f.name.replace(/\.[^.]+$/, ""),
        project: project || null,
        language,
        description: description || null,
        file_path: path,
        file_name: f.name,
        mime_type: f.type || null,
        size_bytes: f.size,
      });
      if (!r.ok) {
        failed.push(`${f.name}: ${r.message}`);
        await supabase.storage.from(BUCKET).remove([path]);
      }
    }
    setBusy(false);
    setProgress("");
    const okCount = files.length - failed.length;
    setMsg(failed.length ? { ok: false, text: tr("Загружено {0} из {1}. Ошибки: {2}", { 0: okCount, 1: files.length, 2: failed.join("; ") }) } : { ok: true, text: tr("Загружено файлов: {0}.", { 0: okCount }) });
    if (okCount) {
      setFiles([]);
      setTitle("");
      setDescription("");
      if (input.current) input.current.value = "";
      onDone();
    }
  }

  return (
    <Column background="surface" border radius="l" padding="24" gap="16">
      <Heading as="h2" variant="heading-strong-m">{tr("Загрузить презентацию")}</Heading>
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
              <b>{tr("Выберите файлы")}</b>{" "}{tr("или перетащите их сюда")}</>
          ) : (
            files.map((f) => `${f.name} (${sizeText(f.size)})`).join(", ")
          )}
        </span>
        <small>{tr("PDF, PowerPoint, Word, Excel, картинки, до {0} МБ на файл. Большие файлы загружаются частями и продолжают загрузку после обрыва связи.", { 0: MAX_UPLOAD_MB })}</small>
      </label>

      {files.length > 0 && (
        <div className="pres-form">
          {files.length === 1 && (
            <label className="field-label">{tr("Название")}<input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
          )}
          <label className="field-label">{tr("Проект или участок")}<input className="field" list="pres-projects" value={project} onChange={(e) => setProject(e.target.value)} placeholder={tr("например, Юкон")} />
            <datalist id="pres-projects">
              {projects.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
          <label className="field-label">{tr("Язык")}<select className="field" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {PRESENTATION_LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className="field-label" style={{ gridColumn: "1 / -1" }}>{tr("Короткое описание (необязательно)")}<input className="field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tr("для кого, какая версия")} />
          </label>
          <Row gap="12" vertical="center" style={{ gridColumn: "1 / -1" }}>
            <Button prefixIcon="upload" onClick={upload} loading={busy}>
              {files.length === 1 ? tr("Загрузить") : tr("Загрузить файлов: {0}", { 0: files.length })}
            </Button>
            <Button variant="tertiary" onClick={() => setFiles([])} disabled={busy}>{tr("Отмена")}</Button>
            {busy && progress && <span className="upload-progress">{tr("Загружено: {0}", { 0: progress })}</span>}
          </Row>
        </div>
      )}
      {msg && (
        <Text variant="body-default-s" onBackground={msg.ok ? "success-strong" : "danger-strong"} role="status">
          {msg.text}
        </Text>
      )}
    </Column>
  );
}

// ---------- card ----------

async function signedUrl(p: Presentation, seconds: number, download: boolean) {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(p.file_path, seconds, download ? { download: p.file_name } : undefined);
  if (error || !data)
    throw new Error(
      /not.?found/i.test(error?.message ?? "")
        ? tr("Файл не найден в хранилище. Удалите карточку и загрузите файл заново.")
        : tr("Не удалось получить ссылку на файл. Проверьте интернет и попробуйте ещё раз.")
    );
  return data.signedUrl;
}

function PresentationCard({ p, onShare, onEdit }: { p: Presentation; onShare: () => void; onEdit: () => void }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const ext = extOf(p.file_name);

  const [viewerUrl, setViewerUrl] = useState("");
  async function open(download: boolean) {
    setErr("");
    try {
      const url = await signedUrl(p, 600, download);
      if (download) {
        const a = document.createElement("a");
        a.href = url;
        a.download = p.file_name;
        a.click();
      } else if (["pdf", "docx", "xlsx", "csv"].includes(ext)) setViewerUrl(url);
      else window.open(url, "_blank", "noopener");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <article className="pres-card">
      {viewerUrl &&
        (ext === "pdf" ? (
          <PdfViewer url={viewerUrl} title={p.title} onClose={() => setViewerUrl("")} onDownload={() => open(true)} />
        ) : (
          <OfficeViewer url={viewerUrl} fileName={p.file_name} title={p.title} onClose={() => setViewerUrl("")} onDownload={() => open(true)} />
        ))}
      <div className="pres-top">
        <span className={`pres-kind kind-${KIND[ext] ?? "FILE"}`}>{KIND[ext] ?? ext.toUpperCase().slice(0, 4)}</span>
        <div style={{ minWidth: 0 }}>
          <h3 className="pres-title">{p.title}</h3>
          <div className="pres-meta">
            {[p.project, p.language, sizeText(p.size_bytes), dateText(p.created_at)].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
      {p.description && <p className="pres-desc">{p.description}</p>}
      <div className="pres-file" title={p.file_name}>
        {p.file_name}
        {p.uploaded_by && <span>{" "}{tr("· загрузил")}{" "}{p.uploaded_by}</span>}
      </div>
      <Row gap="8" wrap>
        <Button size="s" prefixIcon="send" onClick={onShare}>{tr("Поделиться")}</Button>
        <Button size="s" variant="secondary" prefixIcon="download" onClick={() => open(true)}>{tr("Скачать")}</Button>
        {(ext === "pdf" || KIND[ext] === "IMG" || ext === "mp4") && (
          <Button size="s" variant="tertiary" prefixIcon="eye" onClick={() => open(false)}>{tr("Открыть")}</Button>
        )}
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 4 }}>
          {confirm ? (
            <>
              <Button
                size="s"
                variant="danger"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const r = await deletePresentation(p.id);
                    if (!r.ok) setErr(r.message ?? tr("Ошибка"));
                    else router.refresh();
                    setConfirm(false);
                  })
                }
              >{tr("Удалить файл")}</Button>
              <Button size="s" variant="tertiary" onClick={() => setConfirm(false)}>{tr("Нет")}</Button>
            </>
          ) : (
            <>
              <Button size="s" variant="tertiary" prefixIcon="edit" aria-label={tr("Изменить описание")} onClick={onEdit} />
              <Button size="s" variant="tertiary" prefixIcon="trash" aria-label={tr("Удалить")} onClick={() => setConfirm(true)} />
            </>
          )}
        </span>
      </Row>
      {err && (
        <Text variant="body-default-xs" onBackground="danger-strong">
          {err}
        </Text>
      )}
    </article>
  );
}

// ---------- sharing ----------

function ShareDialog({ p, onClose }: { p: Presentation; onClose: () => void }) {
  const [days, setDays] = useState(7);
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [canShareFile, setCanShareFile] = useState(false);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    let alive = true;
    setUrl("");
    setErr("");
    signedUrl(p, days * 86400, false)
      .then((u) => alive && setUrl(u))
      .catch((e) => alive && setErr((e as Error).message));
    return () => {
      alive = false;
    };
  }, [p, days]);

  // The file itself is fetched in advance: phones only open the share sheet straight after a tap.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("canShare" in navigator)) return;
    if ((p.size_bytes ?? 0) > MAX_BYTES) return;
    let alive = true;
    setPreparing(true);
    signedUrl(p, 600, false)
      .then((u) => fetch(u))
      .then((r) => r.blob())
      .then((b) => {
        if (!alive) return;
        const f = new File([b], p.file_name, { type: p.mime_type || b.type || "application/octet-stream" });
        if (navigator.canShare({ files: [f] })) {
          setFile(f);
          setCanShareFile(true);
        }
      })
      .catch(() => {})
      .finally(() => alive && setPreparing(false));
    return () => {
      alive = false;
    };
  }, [p]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const until = new Date(Date.now() + days * 86400000).toLocaleDateString(loc(), { day: "numeric", month: "long" });
  const message = tr("{0} — BASK Metals and Mining.\nСсылка на файл действует до {1}: {2}", { 0: `${p.title}${p.project ? ` (${p.project})` : ""}`, 1: until, 2: url });
  const enc = encodeURIComponent;

  async function shareFile() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: p.title, text: `${p.title} — BASK Metals and Mining` });
    } catch {
      /* the person closed the share sheet */
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr(tr("Не удалось скопировать. Выделите ссылку ниже и скопируйте вручную."));
    }
  }

  const disabled = !url;
  return (
    <div className="nav-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="nav-dialog share-dialog" role="dialog" aria-modal="true" aria-label={tr("Поделиться презентацией")}>
        <div className="nav-head">
          <span>{tr("Поделиться:")}{" "}{p.title}</span>
          <button type="button" className="nav-close" onClick={onClose} aria-label={tr("Закрыть")}>
            <Icon name="close" size="s" />
          </button>
        </div>
        <div className="share-body">
          {(canShareFile || preparing) && (
            <section>
              <h4>{tr("Отправить сам файл")}</h4>
              <p>{tr("Откроется окно телефона или компьютера, где можно выбрать WhatsApp, Telegram, почту и другие приложения.")}</p>
              <Button prefixIcon="send" onClick={shareFile} loading={preparing} disabled={!file}>{tr("Отправить файлом")}</Button>
            </section>
          )}
          <section>
            <h4>{tr("Отправить ссылку на скачивание")}</h4>
            <p>{tr("Получатель откроет файл по ссылке без входа в систему. После срока ссылка перестанет работать.")}</p>
            <Row gap="8" vertical="center" wrap>
              <span className="share-label">{tr("Ссылка действует:")}</span>
              {LINK_DAYS.map((d) => (
                <button key={d.days} type="button" className={`chip${days === d.days ? " is-on" : ""}`} onClick={() => setDays(d.days)}>
                  {tr(d.label)}
                </button>
              ))}
            </Row>
            <div className="share-apps">
              <a className={`share-app wa${disabled ? " is-off" : ""}`} href={disabled ? undefined : `https://wa.me/?text=${enc(message)}`} target="_blank" rel="noopener noreferrer">
                <span className="share-dot" aria-hidden>W</span>WhatsApp
              </a>
              <a
                className={`share-app tg${disabled ? " is-off" : ""}`}
                href={disabled ? undefined : `https://t.me/share/url?url=${enc(url)}&text=${enc(tr("{0} — BASK Metals and Mining. Ссылка действует до {1}.", { 0: p.title, 1: until }))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="share-dot" aria-hidden>T</span>Telegram
              </a>
              <a className={`share-app mail${disabled ? " is-off" : ""}`} href={disabled ? undefined : `mailto:?subject=${enc(p.title)}&body=${enc(message)}`}>
                <span className="share-dot" aria-hidden>
                  <Icon name="mail" size="xs" />
                </span>{tr("Почта")}</a>
              <button type="button" className="share-app copy" onClick={copy} disabled={disabled}>
                <span className="share-dot" aria-hidden>
                  <Icon name={copied ? "check" : "copy"} size="xs" />
                </span>
                {copied ? tr("Скопировано") : tr("Копировать ссылку")}
              </button>
            </div>
            <input className="field share-url" readOnly value={url || tr("Готовлю ссылку…")} onFocus={(e) => e.target.select()} aria-label={tr("Ссылка на файл")} />
          </section>
          {url && <QrBlock url={url} name={p.title} until={until} />}
          {err && (
            <Text variant="body-default-s" onBackground="danger-strong">
              {err}
            </Text>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- edit ----------

function EditDialog({ p, projects, onClose }: { p: Presentation; projects: string[]; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(p.title);
  const [project, setProject] = useState(p.project ?? "");
  const [language, setLanguage] = useState(p.language ?? "");
  const [description, setDescription] = useState(p.description ?? "");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const r = await updatePresentation(p.id, { title, project: project || null, language: language || null, description: description || null });
      if (!r.ok) return setErr(r.message ?? tr("Ошибка"));
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="nav-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="nav-dialog share-dialog" role="dialog" aria-modal="true" aria-label={tr("Изменить описание")}>
        <div className="nav-head">
          <span>{tr("Изменить описание")}</span>
          <button type="button" className="nav-close" onClick={onClose} aria-label={tr("Закрыть")}>
            <Icon name="close" size="s" />
          </button>
        </div>
        <div className="share-body pres-form">
          <label className="field-label" style={{ gridColumn: "1 / -1" }}>{tr("Название")}<input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field-label">{tr("Проект или участок")}<input className="field" list="pres-projects-edit" value={project} onChange={(e) => setProject(e.target.value)} />
            <datalist id="pres-projects-edit">
              {projects.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </label>
          <label className="field-label">{tr("Язык")}<select className="field" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="">—</option>
              {PRESENTATION_LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className="field-label" style={{ gridColumn: "1 / -1" }}>{tr("Описание")}<input className="field" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <Row gap="8" style={{ gridColumn: "1 / -1" }}>
            <Button onClick={save} loading={pending}>{tr("Сохранить")}</Button>
            <Button variant="tertiary" onClick={onClose}>{tr("Отмена")}</Button>
          </Row>
          {err && (
            <Text variant="body-default-s" onBackground="danger-strong">
              {err}
            </Text>
          )}
          <Text variant="body-default-xs" onBackground="neutral-weak" style={{ gridColumn: "1 / -1" }}>{tr("Файл:")}{" "}{p.file_name}
          </Text>
        </div>
      </div>
    </div>
  );
}

/** A QR code of the download link: show it on a screen at a meeting, or put it on a slide or a printed page. */
function QrBlock({ url, name, until }: { url: string; name: string; until: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    import("qrcode")
      .then((QR) => QR.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 512, color: { dark: "#14181d", light: "#ffffff" } }))
      .then((d) => alive && setSrc(d))
      .catch(() => alive && setSrc(""));
    return () => {
      alive = false;
    };
  }, [url]);
  if (!src) return null;
  return (
    <section className="share-qr">
      <img src={src} alt={tr("QR-код ссылки на «{0}»", { 0: name })} width={168} height={168} />
      <div>
        <h4>{tr("QR-код")}</h4>
        <p>{tr("Покажите его на встрече: собеседник наведёт камеру телефона и сразу скачает файл. Действует до {0}, как и ссылка.", { 0: until })}</p>
        <a className="chip" href={src} download={`QR ${name.replace(/[\\/:*?"<>|]+/g, " ")}.png`}>
          {tr("Скачать QR-код")}
        </a>
      </div>
    </section>
  );
}
