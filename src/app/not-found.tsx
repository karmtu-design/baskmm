import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold">Такой страницы нет</h1>
        <p className="mt-2 text-muted">Возможно, запись удалили или ссылка набрана с ошибкой.</p>
        <Link href="/" className="mt-4 inline-block font-medium text-patina hover:underline">
          Вернуться к обзору портфеля
        </Link>
      </div>
    </main>
  );
}
