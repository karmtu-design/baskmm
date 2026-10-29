import { Column, Grid, Text } from "@once-ui-system/core";
import { PageHeader } from "@/components/ui";

const COLUMNS = ["Новые", "В работе", "На проверке", "Готово"];

export default function TasksPage() {
  return (
    <Column>
      <PageHeader
        title="Задачи сотрудников"
        subtitle="Доска задач с исполнителями, сроками и привязкой к компаниям и лицензиям появится на следующем этапе."
      />
      <Grid columns="4" gap="16" m={{ columns: "2" }} s={{ columns: "1" }} aria-hidden>
        {COLUMNS.map((c) => (
          <Column key={c} background="surface" border radius="l" padding="16" minHeight="160" style={{ borderStyle: "dashed", opacity: 0.7 }}>
            <Text variant="label-strong-s">{c}</Text>
          </Column>
        ))}
      </Grid>
    </Column>
  );
}
