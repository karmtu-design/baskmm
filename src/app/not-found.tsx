import { Button, Column, Heading, Text } from "@once-ui-system/core";

export default function NotFound() {
  return (
    <Column fillWidth minHeight="100vh" center gap="12" padding="24" align="center" background="page">
      <Heading as="h1" variant="display-strong-xs">
        Такой страницы нет
      </Heading>
      <Text onBackground="neutral-weak">Возможно, запись удалили или ссылка набрана с ошибкой.</Text>
      <Button href="/" variant="secondary" prefixIcon="home">
        Вернуться к обзору портфеля
      </Button>
    </Column>
  );
}
