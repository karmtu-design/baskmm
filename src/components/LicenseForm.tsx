import { CATEGORIES, LICENSE_TYPES, STATUSES, type Company, type License } from "@/lib/types";

const input = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2";

export default function LicenseForm({
  action,
  companies,
  license,
  defaultCompanyId,
  submitLabel,
}: {
  action: (f: FormData) => void | Promise<void>;
  companies: Company[];
  license?: License;
  defaultCompanyId?: number;
  submitLabel: string;
}) {
  const v = (k: keyof License) => (license?.[k] as string | number | null | undefined) ?? "";
  return (
    <form action={action} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <label className="text-sm sm:col-span-2">
        Компания-недропользователь
        <select name="company_id" required defaultValue={license?.company_id ?? defaultCompanyId ?? ""} className={input}>
          <option value="" disabled>
            Выберите компанию
          </option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Номер лицензии
        <input name="license_number" required defaultValue={v("license_number")} className={input} />
      </label>
      <label className="text-sm">
        Участок или месторождение
        <input name="deposit_name" defaultValue={v("deposit_name")} className={input} />
      </label>
      <label className="text-sm">
        Вид лицензии
        <select name="license_type" defaultValue={v("license_type") || "Разведка"} className={input}>
          {LICENSE_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Категория полезных ископаемых
        <select name="category" defaultValue={v("category") || "ТПИ"} className={input}>
          {CATEGORIES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Полезное ископаемое
        <input name="mineral" placeholder="например, Cu-Mo-Au" defaultValue={v("mineral")} className={input} />
      </label>
      <label className="text-sm">
        Статус
        <select name="status" defaultValue={v("status") || "действует"} className={input}>
          {STATUSES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Дата выдачи
        <input type="date" name="issue_date" defaultValue={v("issue_date")} className={input} />
      </label>
      <label className="text-sm">
        Действует до
        <input type="date" name="expiry_date" defaultValue={v("expiry_date")} className={input} />
      </label>
      <label className="text-sm">
        Область
        <input name="region" defaultValue={v("region")} className={input} />
      </label>
      <label className="text-sm">
        Район
        <input name="district" defaultValue={v("district")} className={input} />
      </label>
      <label className="text-sm">
        Площадь по лицензии, км²
        <input name="area_sq_km" inputMode="decimal" defaultValue={v("area_sq_km")} className={input} />
      </label>
      <label className="text-sm">
        Ответственный сотрудник
        <input name="responsible" defaultValue={v("responsible")} className={input} />
      </label>
      <label className="text-sm sm:col-span-2">
        Примечания
        <textarea name="notes" rows={3} defaultValue={v("notes")} className={input} />
      </label>
      <div className="sm:col-span-2">
        <button className="rounded-md bg-patina px-4 py-2.5 text-sm font-medium text-white hover:bg-patina-deep">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
