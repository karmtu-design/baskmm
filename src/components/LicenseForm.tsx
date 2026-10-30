import { tr } from "@/i18n";
import { Button, Grid } from "@once-ui-system/core";
import { CATEGORIES, LICENSE_TYPES, STATUSES, type Company, type License } from "@/lib/types";

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
  const wide = { gridColumn: "1 / -1" };
  return (
    <form action={action} style={{ maxWidth: 760 }}>
      <Grid columns="2" gap="16" s={{ columns: "1" }}>
        <label className="field-label" style={wide}>{tr("Компания-недропользователь")}<select name="company_id" required defaultValue={license?.company_id ?? defaultCompanyId ?? ""} className="field">
            <option value="" disabled>{tr("Выберите компанию")}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">{tr("Номер лицензии")}<input name="license_number" required defaultValue={v("license_number")} className="field" />
        </label>
        <label className="field-label">{tr("Участок или месторождение")}<input name="deposit_name" defaultValue={v("deposit_name")} className="field" />
        </label>
        <label className="field-label">{tr("Вид лицензии")}<select name="license_type" defaultValue={v("license_type") || "Разведка"} className="field">
            {LICENSE_TYPES.map((t) => (
              <option key={t} value={t}>{tr(t)}</option>
            ))}
          </select>
        </label>
        <label className="field-label">{tr("Категория полезных ископаемых")}<select name="category" defaultValue={v("category") || "ТПИ"} className="field">
            {CATEGORIES.map((t) => (
              <option key={t} value={t}>{tr(t)}</option>
            ))}
          </select>
        </label>
        <label className="field-label">{tr("Полезное ископаемое")}<input name="mineral" placeholder={tr("например, Cu-Mo-Au")} defaultValue={v("mineral")} className="field" />
        </label>
        <label className="field-label">{tr("Статус")}<select name="status" defaultValue={v("status") || "действует"} className="field">
            {STATUSES.map((t) => (
              <option key={t} value={t}>{tr(t)}</option>
            ))}
          </select>
        </label>
        <label className="field-label">{tr("Дата выдачи")}<input type="date" name="issue_date" defaultValue={v("issue_date")} className="field" />
        </label>
        <label className="field-label">{tr("Действует до")}<input type="date" name="expiry_date" defaultValue={v("expiry_date")} className="field" />
        </label>
        <label className="field-label">{tr("Область")}<input name="region" defaultValue={v("region")} className="field" />
        </label>
        <label className="field-label">{tr("Район")}<input name="district" defaultValue={v("district")} className="field" />
        </label>
        <label className="field-label">{tr("Площадь по лицензии, км²")}<input name="area_sq_km" inputMode="decimal" defaultValue={v("area_sq_km")} className="field" />
        </label>
        <label className="field-label">{tr("Ответственный сотрудник")}<input name="responsible" defaultValue={v("responsible")} className="field" />
        </label>
        <label className="field-label" style={wide}>{tr("Примечания")}<textarea name="notes" rows={3} defaultValue={v("notes")} className="field" />
        </label>
        <div style={wide}>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </Grid>
    </form>
  );
}
