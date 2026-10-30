import type { MetadataRoute } from "next";

/** Lets the site be installed on a phone or computer as the BASK app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BASK Metals and Mining",
    short_name: "BASK",
    description: "Портфель недропользования группы: лицензии, карта, проекты, документы, задачи.",
    lang: "ru",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#101820",
    theme_color: "#101820",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Карта участков", url: "/map" },
      { name: "Реестр лицензий", url: "/licenses" },
      { name: "Задачи и сроки", url: "/tasks" },
    ],
  };
}
