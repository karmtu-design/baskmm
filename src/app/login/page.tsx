import { Badge, Button, Column, Heading, Input, Line, PasswordInput, Row, Text } from "@once-ui-system/core";
import BrandLogo from "@/components/BrandLogo";
import PageBackground from "@/components/PageBackground";
import { BRAND } from "@/lib/brand";
import { signIn } from "./actions";

const cover: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <Column fillWidth minHeight="100vh" background="page" horizontal="center" overflow="hidden">
      {/* background: a mining-site video or photo when provided, otherwise the relief-map pattern */}
      <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
        {BRAND.heroVideo ? (
          <video style={{ ...cover, opacity: 0.4 }} src={BRAND.heroVideo} poster={BRAND.heroImage ?? undefined} autoPlay muted loop playsInline preload="metadata" />
        ) : BRAND.heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img style={{ ...cover, opacity: 0.4 }} src={BRAND.heroImage} alt="" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="hero-topo" style={cover} src="/brand/topo.svg" alt="" />
        )}
      </div>
      <PageBackground />

      <Row as="header" fillWidth maxWidth="xl" paddingX="24" paddingY="20" vertical="center" horizontal="between" zIndex={1}>
        <BrandLogo height={44} />
        <Text variant="body-default-s" onBackground="neutral-weak" s={{ hide: true }}>
          Внутренняя система группы
        </Text>
      </Row>

      <Row
        as="main"
        fillWidth
        maxWidth="xl"
        flex={1}
        paddingX="24"
        paddingBottom="80"
        gap="64"
        vertical="center"
        zIndex={1}
        m={{ direction: "column", vertical: "start", gap: "40", paddingTop: "32" }}
      >
        <Column flex={1} gap="24">
          <Row>
            <Badge title="Портфель недропользования" icon="globe" arrow={false} />
          </Row>
          <Heading as="h1" variant="display-strong-xl" wrap="balance" style={{ letterSpacing: "0.02em", lineHeight: 1 }}>
            BASK
            <span style={{ display: "block", fontSize: "0.42em", fontWeight: 400, letterSpacing: "0.3em", marginTop: 8 }}>
              METALS AND MINING
            </span>
          </Heading>
          <Line background="brand-strong" maxWidth="64" />
          <Text
            variant="heading-default-xl"
            onBackground="neutral-medium"
            style={{ fontFamily: '"Jost Variable", var(--font-body)', fontWeight: 300, letterSpacing: "0.04em" }}
          >
            {BRAND.slogan}
          </Text>
          <Text variant="body-default-m" onBackground="neutral-weak" style={{ maxWidth: 460 }}>
            Лицензии на разведку и добычу, контуры участков, документы и задачи сотрудников группы в одном месте.
          </Text>
        </Column>

        <Column background="page" border radius="xl" padding="32" gap="20" shadow="l" width={26} m={{ width: "fit", fillWidth: true }}>
          <Column gap="4">
            <Heading as="h2" variant="heading-strong-l">
              Вход для сотрудников
            </Heading>
            <Text variant="body-default-s" onBackground="neutral-weak">
              Доступ выдаёт администратор системы.
            </Text>
          </Column>
          <form action={signIn}>
            <Column gap="12">
              <Input id="email" name="email" type="email" label="Электронная почта" required autoComplete="email" />
              <PasswordInput id="password" name="password" label="Пароль" required autoComplete="current-password" />
              {error && (
                <Text variant="body-default-s" onBackground="danger-strong" role="alert">
                  Неверная почта или пароль. Проверьте раскладку клавиатуры и попробуйте снова.
                </Text>
              )}
              <Button type="submit" fillWidth size="l" suffixIcon="arrowRight">
                Войти
              </Button>
            </Column>
          </form>
        </Column>
      </Row>
    </Column>
  );
}
