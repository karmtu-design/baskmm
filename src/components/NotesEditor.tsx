"use client";

// Notes with formatting (Tiptap): meeting minutes, call notes, conditions agreed — headings, lists, bold, tables.
// Saved automatically a second after typing stops; everyone in the group sees the same notes.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import DOMPurify from "dompurify";
import { tr, loc } from "@/i18n";
import { createClient } from "@/lib/supabase/client";
import type { Note } from "@/lib/types";

type Owner = { licenseId?: number; projectId?: number };
const when = (iso: string) => new Date(iso).toLocaleString(loc(), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });

export default function NotesPanel({ notes, owner, readOnly = false }: { notes: Note[]; owner: Owner; readOnly?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<number | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const supabase = createClient();
    const today = new Date().toLocaleDateString(loc(), { day: "2-digit", month: "2-digit", year: "numeric" });
    const { data, error } = await supabase
      .from("notes")
      .insert({ license_id: owner.licenseId ?? null, project_id: owner.projectId ?? null, title: tr("Встреча {0}", { 0: today }), html: "<p></p>" })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) return alert(tr("Не сохранилось: {0}", { 0: error?.message ?? "" }));
    setOpen(data.id);
    router.refresh();
  }

  const current = typeof open === "number" ? notes.find((n) => n.id === open) : null;
  return (
    <div className="notes">
      <div className="notes-list">
        {!readOnly && <button type="button" className="notes-new" onClick={create} disabled={busy}>
          ＋ {tr("Новая заметка")}
        </button>}
        {notes.length === 0 && <p className="notes-empty">{tr("Заметок пока нет. Запишите итоги встречи или звонка, договорённости, вопросы к владельцу.")}</p>}
        {notes.map((n) => (
          <button key={n.id} type="button" className={`notes-item${open === n.id ? " is-on" : ""}`} onClick={() => setOpen(n.id)}>
            <b>{n.title || tr("Без названия")}</b>
            <span>
              {when(n.updated_at)}
              {n.updated_by ? ` · ${n.updated_by}` : ""}
            </span>
            <small>{n.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 90)}</small>
          </button>
        ))}
      </div>
      <div className="notes-body">
        {current ? <NoteEditor key={current.id} note={current} readOnly={readOnly} onDeleted={() => (setOpen(null), router.refresh())} /> : <p className="notes-empty">{tr("Выберите заметку слева или создайте новую.")}</p>}
      </div>
    </div>
  );
}

function NoteEditor({ note, onDeleted, readOnly }: { note: Note; onDeleted: () => void; readOnly: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(note.title);
  const [state, setState] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef(title);
  titleRef.current = title;

  const editor = useEditor({
    editable: !readOnly,
    extensions: [StarterKit.configure({ link: { openOnClick: true, autolink: true } }), TableKit.configure({ table: { resizable: false } })],
    content: DOMPurify.sanitize(note.html),
    immediatelyRender: false,
    editorProps: { attributes: { class: "note-doc", "aria-label": tr("Текст заметки") } },
    onUpdate: () => schedule(),
  });

  function schedule() {
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 1000);
  }
  async function save() {
    if (!editor) return;
    setState("saving");
    const supabase = createClient();
    const { data: s } = await supabase.auth.getSession();
    const { error } = await supabase
      .from("notes")
      .update({ title: titleRef.current, html: editor.getHTML(), updated_at: new Date().toISOString(), updated_by: s.session?.user.email ?? null })
      .eq("id", note.id);
    setState(error ? "error" : "saved");
    if (!error) router.refresh();
  }
  // save what was typed when leaving the note
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void save();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor]
  );

  async function remove() {
    if (!confirm(tr("Удалить заметку «{0}»?", { 0: title || tr("Без названия") }))) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const { error } = await createClient().from("notes").delete().eq("id", note.id);
    if (error) return alert(tr("Не получилось: {0}", { 0: error.message }));
    onDeleted();
  }

  return (
    <div className="note-editor">
      <div className="note-head">
        <input
          className="note-title"
          readOnly={readOnly}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            schedule();
          }}
          aria-label={tr("Название заметки")}
          placeholder={tr("Название")}
        />
        <span className={`note-state is-${state}`} role="status">
          {state === "saved" ? tr("Сохранено") : state === "saving" ? tr("Сохраняю…") : state === "dirty" ? tr("Изменения…") : tr("Не сохранилось, проверьте интернет")}
        </span>
        {!readOnly && <button type="button" className="chip" onClick={remove}>
          {tr("Удалить")}
        </button>}
      </div>
      {editor && !readOnly && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    editor.on("selectionUpdate", f);
    editor.on("transaction", f);
    return () => {
      editor.off("selectionUpdate", f);
      editor.off("transaction", f);
    };
  }, [editor]);
  const c = () => editor.chain().focus();
  const b = (label: string, title: string, on: boolean, run: () => void) => (
    <button type="button" className={`note-tool${on ? " is-on" : ""}`} title={title} aria-label={title} aria-pressed={on} onMouseDown={(e) => e.preventDefault()} onClick={run}>
      {label}
    </button>
  );
  const inTable = editor.isActive("table");
  return (
    <div className="note-toolbar" role="toolbar" aria-label={tr("Оформление")}>
      {b("H1", tr("Заголовок"), editor.isActive("heading", { level: 2 }), () => c().toggleHeading({ level: 2 }).run())}
      {b("H2", tr("Подзаголовок"), editor.isActive("heading", { level: 3 }), () => c().toggleHeading({ level: 3 }).run())}
      <span className="note-sep" />
      {b("B", tr("Жирный"), editor.isActive("bold"), () => c().toggleBold().run())}
      {b("I", tr("Курсив"), editor.isActive("italic"), () => c().toggleItalic().run())}
      {b("U", tr("Подчёркнутый"), editor.isActive("underline"), () => c().toggleUnderline().run())}
      <span className="note-sep" />
      {b("•", tr("Список"), editor.isActive("bulletList"), () => c().toggleBulletList().run())}
      {b("1.", tr("Нумерованный список"), editor.isActive("orderedList"), () => c().toggleOrderedList().run())}
      {b("❝", tr("Цитата"), editor.isActive("blockquote"), () => c().toggleBlockquote().run())}
      <span className="note-sep" />
      {b("▦", tr("Вставить таблицу"), false, () => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
      {inTable && b("+ ↓", tr("Добавить строку"), false, () => c().addRowAfter().run())}
      {inTable && b("+ →", tr("Добавить столбец"), false, () => c().addColumnAfter().run())}
      {inTable && b("✕ ▦", tr("Удалить таблицу"), false, () => c().deleteTable().run())}
      <span className="note-sep" />
      {b("↶", tr("Отменить"), false, () => c().undo().run())}
      {b("↷", tr("Повторить"), false, () => c().redo().run())}
    </div>
  );
}
