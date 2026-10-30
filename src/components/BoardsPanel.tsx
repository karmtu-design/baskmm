"use client";

// Drawing boards (Excalidraw): a deal scheme, a structure of companies, logistics to the site — boxes, arrows,
// text, pictures. Each board belongs to a licence or a project and is saved automatically.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { tr, loc, currentLocale } from "@/i18n";
import { createClient } from "@/lib/supabase/client";
import type { Board } from "@/lib/types";
import "@excalidraw/excalidraw/index.css";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Api = any;
const Excalidraw = dynamic(
  async () => {
    (window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = "/vendor/excalidraw/";
    return (await import("@excalidraw/excalidraw")).Excalidraw;
  },
  { ssr: false, loading: () => <p className="notes-empty">{tr("Загружается доска…")}</p> }
);

type Owner = { licenseId?: number; projectId?: number };
const when = (iso: string) => new Date(iso).toLocaleString(loc(), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });

export default function BoardsPanel({ boards, owner, readOnly = false }: { boards: Board[]; owner: Owner; readOnly?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<Board | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const { data, error } = await createClient()
      .from("boards")
      .insert({ license_id: owner.licenseId ?? null, project_id: owner.projectId ?? null, title: tr("Схема {0}", { 0: boards.length + 1 }) })
      .select("id, license_id, project_id, title, preview, created_by, updated_by, created_at, updated_at")
      .single();
    setBusy(false);
    if (error || !data) return alert(tr("Не сохранилось: {0}", { 0: error?.message ?? "" }));
    setOpen(data as Board);
    router.refresh();
  }

  return (
    <div className="boards">
      {!readOnly && <button type="button" className="board-card board-new" onClick={create} disabled={busy}>
        <span>＋</span>
        {tr("Новая схема")}
      </button>}
      {boards.map((b) => (
        <button key={b.id} type="button" className="board-card" onClick={() => setOpen(b)}>
          <span className="board-thumb">{b.preview ? <img src={b.preview} alt="" /> : <span>{tr("Пустая доска")}</span>}</span>
          <b>{b.title || tr("Без названия")}</b>
          <small>
            {when(b.updated_at)}
            {b.updated_by ? ` · ${b.updated_by}` : ""}
          </small>
        </button>
      ))}
      {open && <BoardEditor board={open} readOnly={readOnly} onClose={() => (setOpen(null), router.refresh())} />}
    </div>
  );
}

function BoardEditor({ board, onClose, readOnly }: { board: Board; onClose: () => void; readOnly: boolean }) {
  const [scene, setScene] = useState<Record<string, unknown> | null>(null);
  const [title, setTitle] = useState(board.title);
  const [state, setState] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const api = useRef<Api>(null);
  const lastVersion = useRef(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef(title);
  titleRef.current = title;

  useEffect(() => {
    createClient()
      .from("boards")
      .select("scene")
      .eq("id", board.id)
      .single()
      .then(({ data }) => setScene((data?.scene as Record<string, unknown>) ?? {}));
  }, [board.id]);

  const save = useCallback(async () => {
    const a = api.current;
    if (!a) return;
    setState("saving");
    const elements = a.getSceneElements();
    const appState = a.getAppState();
    const files = a.getFiles();
    let preview: string | null = null;
    try {
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      if (elements.length) {
        const blob: Blob = await exportToBlob({ elements, appState: { ...appState, exportBackground: true, viewBackgroundColor: "#ffffff" }, files, maxWidthOrHeight: 360, mimeType: "image/png" });
        preview = await new Promise((res) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result));
          r.readAsDataURL(blob);
        });
      }
    } catch {
      /* the small picture is optional */
    }
    const supabase = createClient();
    const { data: s } = await supabase.auth.getSession();
    const { error } = await supabase
      .from("boards")
      .update({
        title: titleRef.current,
        scene: { elements, appState: { viewBackgroundColor: appState.viewBackgroundColor, gridModeEnabled: appState.gridModeEnabled }, files },
        preview,
        updated_at: new Date().toISOString(),
        updated_by: s.session?.user.email ?? null,
      })
      .eq("id", board.id);
    setState(error ? "error" : "saved");
  }, [board.id]);

  function schedule() {
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 1500);
  }

  async function close() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      await save();
    }
    onClose();
  }
  async function remove() {
    if (!confirm(tr("Удалить схему «{0}»?", { 0: title || tr("Без названия") }))) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    await createClient().from("boards").delete().eq("id", board.id);
    onClose();
  }

  const lang = currentLocale();
  return createPortal(
    <div className="pdf-overlay board-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="pdf-bar">
        <input className="note-title board-title" readOnly={readOnly} value={title} onChange={(e) => (setTitle(e.target.value), schedule())} aria-label={tr("Название схемы")} />
        <div className="pdf-tools">
          <span className={`note-state is-${state}`} role="status">
            {state === "saved" ? tr("Сохранено") : state === "saving" ? tr("Сохраняю…") : state === "dirty" ? tr("Изменения…") : tr("Не сохранилось, проверьте интернет")}
          </span>
          {!readOnly && <button type="button" className="chip" onClick={remove}>
            {tr("Удалить")}
          </button>}
          <button type="button" className="nav-close" onClick={close} aria-label={tr("Закрыть")}>
            ×
          </button>
        </div>
      </div>
      <div className="board-stage">
        {scene && (
          <Excalidraw
            excalidrawAPI={(a: Api) => (api.current = a)}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            initialData={{ elements: (scene.elements as any[]) ?? [], appState: { ...((scene.appState as object) ?? {}), collaborators: new Map() }, files: (scene.files as any) ?? {}, scrollToContent: true }}
            viewModeEnabled={readOnly}
            langCode={lang === "ru" ? "ru-RU" : lang === "zh" ? "zh-CN" : "en"}
            onChange={(elements: readonly { version: number }[]) => {
              const v = elements.reduce((s, e) => s + e.version, 0) + elements.length;
              if (lastVersion.current === -1) {
                lastVersion.current = v;
                return;
              }
              if (v !== lastVersion.current) {
                lastVersion.current = v;
                schedule();
              }
            }}
            UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: { saveFileToDisk: true } } }}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
