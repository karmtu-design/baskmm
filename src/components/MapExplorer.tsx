"use client";

import { useMemo, useState } from "react";
import { Checkbox, Column, Row, Text } from "@once-ui-system/core";
import LicensesMap from "./LicensesMap";
import { Legend } from "./ui";
import { mineralGroup, type Company, type License } from "@/lib/types";

export default function MapExplorer({ licenses, companies }: { licenses: License[]; companies: Company[] }) {
  const [company, setCompany] = useState("");
  const [type, setType] = useState("");
  const [group, setGroup] = useState("");
  const [labels, setLabels] = useState(true);

  const groups = useMemo(() => Array.from(new Set(licenses.map((l) => mineralGroup(l.mineral)))), [licenses]);
  const shown = useMemo(
    () =>
      licenses.filter(
        (l) =>
          (!company || String(l.company_id) === company) &&
          (!type || l.license_type === type) &&
          (!group || mineralGroup(l.mineral) === group)
      ),
    [licenses, company, type, group]
  );
  const missing = shown.filter((l) => !l.contour);
  const select = { width: "auto", minHeight: 40 } as const;

  return (
    <Column gap="12">
      <Row wrap gap="8" vertical="center">
        <select aria-label="Компания" className="field" style={select} value={company} onChange={(e) => setCompany(e.target.value)}>
          <option value="">Все компании</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select aria-label="Вид лицензии" className="field" style={select} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Разведка и добыча</option>
          <option value="Разведка">Разведка</option>
          <option value="Добыча">Добыча</option>
        </select>
        <select aria-label="Полезное ископаемое" className="field" style={select} value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">Все полезные ископаемые</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <Checkbox label="Подписи участков" checked={labels} onToggle={setLabels} />
        <Row flex={1} horizontal="end">
          <Text variant="body-default-s" onBackground="neutral-weak">
            Показано участков: {shown.length - missing.length}
          </Text>
        </Row>
      </Row>

      <LicensesMap licenses={shown} height={680} showLabels={labels} />
      <Legend licenses={licenses} />

      {missing.length > 0 && (
        <Text variant="body-default-s" onBackground="warning-strong">
          Без контура: {missing.map((l) => l.deposit_name).join(", ")}. Добавьте координаты в карточке лицензии.
        </Text>
      )}
    </Column>
  );
}
