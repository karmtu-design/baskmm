import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form
        action={signIn}
        className="w-full max-w-sm rounded-lg border border-line bg-surface p-8"
      >
        <h1 className="text-xl font-semibold text-patina-deep">Bask Metals and Mining</h1>
        <p className="mt-1 text-sm text-muted">Вход для сотрудников группы</p>

        <label className="mt-6 block text-sm font-medium" htmlFor="email">
          Электронная почта
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
        />

        <label className="mt-4 block text-sm font-medium" htmlFor="password">
          Пароль
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
        />

        {error && (
          <p className="mt-4 text-sm text-danger" role="alert">
            Неверная почта или пароль. Проверьте раскладку клавиатуры и попробуйте снова.
          </p>
        )}

        <button className="mt-6 w-full rounded-md bg-patina px-4 py-2.5 font-medium text-white hover:bg-patina-deep">
          Войти
        </button>
        <p className="mt-4 text-xs text-muted">
          Доступ выдаёт администратор системы. Если у вас нет учётной записи, обратитесь к нему.
        </p>
      </form>
    </main>
  );
}
