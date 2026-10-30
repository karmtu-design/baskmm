import { tr } from "@/i18n";
import { Button, Grid } from "@once-ui-system/core";
import { DEAL_TYPES, PROJECT_STAGES, type PotentialProject } from "@/lib/types";

export default function ProjectForm({
  action,
  project,
  submitLabel,
  people = [],
}: {
  action: (f: FormData) => void | Promise<void>;
  project?: PotentialProject;
  submitLabel: string;
  people?: string[];
}) {
  const v = (k: keyof PotentialProject) => (project?.[k] as string | number | null | undefined) ?? "";
  const wide = { gridColumn: "1 / -1" };
  return (
    <form action={action} style={{ maxWidth: 860 }}>
      <Grid columns="2" gap="16" s={{ columns: "1" }}>
        <label className="field-label" style={wide}>{tr("Название проекта")}<input name="name" required defaultValue={v("name")} className="field" placeholder={tr("например, участок Каратас")} />
        </label>
        <label className="field-label">{tr("Полезное ископаемое")}<input name="commodity" defaultValue={v("commodity")} className="field" placeholder="Au, Cu-Mo, W…" />
        </label>
        <label className="field-label">{tr("Этап")}<select name="stage" defaultValue={v("stage") || "Новый"} className="field">
            {PROJECT_STAGES.map((s) => (
              <option key={s} value={s}>{tr(s)}</option>
            ))}
            {project?.stage && !PROJECT_STAGES.includes(project.stage) && <option>{project.stage}</option>}
          </select>
        </label>
        <label className="field-label">{tr("Область")}<input name="region" defaultValue={v("region")} className="field" />
        </label>
        <label className="field-label">{tr("Район")}<input name="district" defaultValue={v("district")} className="field" />
        </label>
        <label className="field-label">{tr("Тип сделки")}<input name="deal_type" list="deal-types" defaultValue={v("deal_type")} className="field" />
          <datalist id="deal-types">
            {DEAL_TYPES.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </label>
        <label className="field-label">{tr("Владелец / правообладатель")}<input name="holder" defaultValue={v("holder")} className="field" />
        </label>
        <label className="field-label">{tr("Откуда пришёл проект")}<input name="source" defaultValue={v("source")} className="field" placeholder={tr("брокер, знакомый, тендер…")} />
        </label>
        <label className="field-label">{tr("Контакт")}<input name="contact" defaultValue={v("contact")} className="field" placeholder={tr("имя, телефон, почта")} />
        </label>
        <label className="field-label" style={wide}>{tr("Запасы / ресурсы")}<textarea name="resources" rows={2} defaultValue={v("resources")} className="field" placeholder={tr("категории, тонны, содержания, год подсчёта")} />
        </label>
        <label className="field-label">{tr("Условия / цена")}<input name="terms" defaultValue={v("terms")} className="field" />
        </label>
        <label className="field-label">{tr("Ответственный")}<input name="responsible" list="staff-names" defaultValue={v("responsible")} className="field" />
          <datalist id="staff-names">
            {people.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
        <label className="field-label">{tr("Следующий шаг")}<input name="next_step" defaultValue={v("next_step")} className="field" placeholder={tr("что сделать дальше")} />
        </label>
        <label className="field-label">{tr("Срок следующего шага")}<input type="date" name="next_date" defaultValue={v("next_date")} className="field" />
        </label>
        <label className="field-label">{tr("Широта центра участка")}<input name="lat" inputMode="decimal" defaultValue={v("lat")} className="field" placeholder="48.1234" />
        </label>
        <label className="field-label">{tr("Долгота центра участка")}<input name="lon" inputMode="decimal" defaultValue={v("lon")} className="field" placeholder="79.6543" />
        </label>
        <label className="field-label" style={wide}>{tr("Ссылка на материалы (Google Drive, облако)")}<input name="link" type="url" defaultValue={v("link")} className="field" placeholder="https://…" />
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
