"use client";

import dynamic from "next/dynamic";
import { tr } from "@/i18n";
import type { Board, Note } from "@/lib/types";

// both editors are large, so they load only on the page that shows them
const NotesPanel = dynamic(() => import("./NotesEditor"), { ssr: false, loading: () => <p className="notes-empty">{tr("Загружается…")}</p> });
const BoardsPanel = dynamic(() => import("./BoardsPanel"), { ssr: false, loading: () => <p className="notes-empty">{tr("Загружается…")}</p> });

/** «Заметки и схемы» of a licence or a project. */
export default function NotesAndBoards({ notes, boards, licenseId, projectId, readOnly = false }: { notes: Note[]; boards: Board[]; licenseId?: number; projectId?: number; readOnly?: boolean }) {
  const owner = { licenseId, projectId };
  return (
    <div className="nb">
      <section>
        <h2 className="nb-h">{tr("Заметки и протоколы встреч")}</h2>
        <NotesPanel notes={notes} owner={owner} readOnly={readOnly} />
      </section>
      <section>
        <h2 className="nb-h">{tr("Схемы")}</h2>
        <p className="notes-empty">{tr("Схема сделки, структура компаний, логистика до участка: прямоугольники, стрелки, текст, картинки. Сохраняется сама.")}</p>
        <BoardsPanel boards={boards} owner={owner} readOnly={readOnly} />
      </section>
    </div>
  );
}
