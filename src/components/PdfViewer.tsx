"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Icon, Row, Text } from "@once-ui-system/core";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { openPdf } from "@/lib/docText";

/** A PDF opened on top of the page: page by page, with zoom, without downloading the file. */
export default function PdfViewer({
  url,
  title,
  onClose,
  onDownload,
}: {
  url: string;
  title: string;
  onClose: () => void;
  onDownload?: () => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const task = useRef<RenderTask | null>(null);

  useEffect(() => {
    let alive = true;
    let doc: PDFDocumentProxy | null = null;
    openPdf(url)
      .then((d) => {
        doc = d;
        if (alive) setPdf(d);
      })
      .catch((e) => alive && setErr(`Файл не открылся: ${(e as Error).message}`));
    return () => {
      alive = false;
      doc?.loadingTask.destroy();
    };
  }, [url]);

  const draw = useCallback(async () => {
    if (!pdf || !canvas.current || !box.current) return;
    setBusy(true);
    task.current?.cancel();
    const p = await pdf.getPage(page);
    const base = p.getViewport({ scale: 1 });
    const fit = Math.min(Math.min(box.current.clientWidth - 32, 980) / base.width, 3); // readable width, not edge to edge
    const scale = zoom === "fit" ? fit : zoom;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vp = p.getViewport({ scale: scale * dpr });
    const c = canvas.current;
    c.width = Math.floor(vp.width);
    c.height = Math.floor(vp.height);
    c.style.width = `${Math.floor(vp.width / dpr)}px`;
    c.style.height = `${Math.floor(vp.height / dpr)}px`;
    task.current = p.render({ canvas: c, viewport: vp });
    try {
      await task.current.promise;
    } catch {
      /* replaced by a newer render */
    }
    setBusy(false);
  }, [pdf, page, zoom]);

  useEffect(() => {
    draw();
  }, [draw]);
  useEffect(() => {
    const onResize = () => zoom === "fit" && draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw, zoom]);

  const pages = pdf?.numPages ?? 0;
  const go = (n: number) => setPage(Math.min(Math.max(1, n), pages || 1));
  const curZoom = typeof zoom === "number" ? zoom : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "PageDown") go(page + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(page - 1);
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  });

  return (
    <div className="pdf-overlay" role="dialog" aria-modal="true" aria-label={`Просмотр: ${title}`}>
      <div className="pdf-bar">
        <span className="pdf-title" title={title}>
          {title}
        </span>
        <Row gap="4" vertical="center" wrap>
          <Button size="s" variant="tertiary" prefixIcon="chevronLeft" aria-label="Предыдущая страница" onClick={() => go(page - 1)} disabled={page <= 1} />
          <Text variant="body-default-s" style={{ minWidth: 72, textAlign: "center" }}>
            {pages ? `${page} из ${pages}` : "…"}
          </Text>
          <Button size="s" variant="tertiary" prefixIcon="chevronRight" aria-label="Следующая страница" onClick={() => go(page + 1)} disabled={page >= pages} />
          <span className="pdf-sep" />
          <Button size="s" variant="tertiary" prefixIcon="minus" aria-label="Уменьшить" onClick={() => setZoom(Math.max(0.4, (curZoom ?? 1) - 0.25))} />
          <button type="button" className="chip" onClick={() => setZoom("fit")} aria-pressed={zoom === "fit"}>
            {zoom === "fit" ? "По ширине" : `${Math.round((curZoom ?? 1) * 100)}%`}
          </button>
          <Button size="s" variant="tertiary" prefixIcon="plus" aria-label="Увеличить" onClick={() => setZoom(Math.min(4, (curZoom ?? 1) + 0.25))} />
          {onDownload && (
            <>
              <span className="pdf-sep" />
              <Button size="s" variant="secondary" prefixIcon="download" onClick={onDownload}>
                Скачать
              </Button>
            </>
          )}
          <button type="button" className="nav-close" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" size="s" />
          </button>
        </Row>
      </div>
      <div className="pdf-stage" ref={box} onClick={(e) => e.target === e.currentTarget && onClose()}>
        {err ? (
          <Text onBackground="danger-strong" style={{ padding: 24 }}>
            {err}
          </Text>
        ) : (
          <canvas ref={canvas} className={`pdf-page${busy ? " is-busy" : ""}`} />
        )}
      </div>
    </div>
  );
}
