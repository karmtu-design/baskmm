"use client";

import { tr, currentLocale } from "@/i18n";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button, Column, Heading, IconButton, Row, Text } from "@once-ui-system/core";

type Turn = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Какие лицензии истекают в ближайший год?",
  "Сколько у группы лицензий на добычу и у каких компаний?",
  "Перечисли все медные объекты",
  "У каких лицензий нет контура на карте?",
];

function Answer({ text }: { text: string }) {
  return (
    <div className="assistant-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) =>
            href?.startsWith("/") ? (
              <Link href={href}>{children}</Link>
            ) : (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [turns, open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history: Turn[] = [...turns, { role: "user", content: q }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, locale: currentLocale() }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const msg = (await res.text()) || tr("Ассистент сейчас недоступен.");
        setTurns([...history, { role: "assistant", content: `_${msg}_` }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setTurns([...history, { role: "assistant", content: text }]);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setTurns([...history, { role: "assistant", content: tr("_Нет связи с сервером. Проверьте интернет и попробуйте ещё раз._") }]);
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  return (
    <>
      {!open && (
        <button type="button" className="assistant-fab" onClick={() => setOpen(true)} aria-label={tr("Открыть ИИ-ассистента")}>
          <span aria-hidden>✦</span>{" "}{tr("Ассистент")}</button>
      )}

      {open && (
        <Column
          as="aside"
          className="assistant-panel"
          background="page"
          border
          radius="xl"
          shadow="xl"
          aria-label={tr("ИИ-ассистент")}
        >
          <Row padding="16" paddingBottom="12" vertical="center" horizontal="between" borderBottom>
            <Column gap="2">
              <Heading as="h2" variant="heading-strong-s">{tr("Ассистент BASK")}</Heading>
              <Text variant="body-default-xs" onBackground="neutral-weak">{tr("Отвечает по реестру лицензий и компаний")}</Text>
            </Column>
            <Row gap="4">
              {turns.length > 0 && (
                <IconButton icon="refresh" variant="ghost" size="s" tooltip={tr("Новый разговор")} onClick={() => setTurns([])} />
              )}
              <IconButton icon="close" variant="ghost" size="s" tooltip={tr("Закрыть")} onClick={() => setOpen(false)} />
            </Row>
          </Row>

          <div ref={list} className="assistant-list">
            {turns.length === 0 ? (
              <Column gap="12" padding="16">
                <Text variant="body-default-s" onBackground="neutral-weak">{tr("Спросите о лицензиях, сроках, компаниях и участках. Например:")}</Text>
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="assistant-suggestion" onClick={() => ask(tr(s))}>
                    {tr(s)}
                  </button>
                ))}
              </Column>
            ) : (
              <Column gap="12" padding="16">
                {turns.map((t, i) =>
                  t.role === "user" ? (
                    <div key={i} className="assistant-q">
                      {t.content}
                    </div>
                  ) : (
                    <div key={i} className="assistant-a">
                      {t.content ? <Answer text={t.content} /> : <span className="assistant-typing">{tr("Думаю…")}</span>}
                    </div>
                  )
                )}
              </Column>
            )}
          </div>

          <form
            className="assistant-form"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <textarea
              className="field"
              rows={2}
              placeholder={tr("Ваш вопрос…")}
              aria-label={tr("Вопрос ассистенту")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              maxLength={4000}
            />
            <Row horizontal="between" vertical="center" gap="8">
              <Text variant="body-default-xs" onBackground="neutral-weak">{tr("ИИ может ошибаться: сверяйте с карточкой лицензии.")}</Text>
              {busy ? (
                <Button type="button" size="s" variant="secondary" onClick={() => abort.current?.abort()}>{tr("Стоп")}</Button>
              ) : (
                <Button type="submit" size="s" suffixIcon="send" disabled={!input.trim()}>{tr("Спросить")}</Button>
              )}
            </Row>
          </form>
        </Column>
      )}
    </>
  );
}
