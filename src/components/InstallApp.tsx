"use client";

import { useEffect, useState } from "react";
import { Button, Icon } from "@once-ui-system/core";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * «Установить приложение»: on Android and in desktop Chrome/Edge the browser offers it after a click;
 * on iPhone it is done from the Share menu, so a short hint is shown there instead.
 */
export default function InstallApp() {
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as PromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!prompt && !ios)) return null;
  return (
    <div className="install-app">
      <Button
        size="s"
        variant="secondary"
        prefixIcon="download"
        onClick={async () => {
          if (prompt) {
            await prompt.prompt();
            setPrompt(null);
          } else setHint((v) => !v);
        }}
      >
        Установить приложение BASK
      </Button>
      {hint && (
        <p>
          На iPhone: нажмите <Icon name="arrowUpRight" size="xs" /> «Поделиться» внизу экрана Safari, затем «На экран
          “Домой”». Появится иконка BASK, сайт будет открываться как приложение.
        </p>
      )}
    </div>
  );
}
