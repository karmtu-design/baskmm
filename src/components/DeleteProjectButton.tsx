"use client";

import { tr } from "@/i18n";

import { useState, useTransition } from "react";
import { Button, Row } from "@once-ui-system/core";
import { deleteProject } from "@/app/(app)/projects/actions";

export default function DeleteProjectButton({ id }: { id: number }) {
  const [ask, setAsk] = useState(false);
  const [pending, start] = useTransition();
  if (!ask)
    return (
      <Button variant="tertiary" prefixIcon="trash" onClick={() => setAsk(true)}>{tr("Удалить")}</Button>
    );
  return (
    <Row gap="4">
      <Button variant="danger" loading={pending} onClick={() => start(() => deleteProject(id))}>{tr("Удалить проект")}</Button>
      <Button variant="tertiary" onClick={() => setAsk(false)}>{tr("Нет")}</Button>
    </Row>
  );
}
