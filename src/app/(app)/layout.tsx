import { tr } from "@/i18n";
import { Column } from "@once-ui-system/core";
import AppHeader from "@/components/AppHeader";
import AssistantPanel from "@/components/AssistantPanel";
import SiteNavigator from "@/components/SiteNavigator";
import PageBackground from "@/components/PageBackground";
import { createClient } from "@/lib/supabase/server";
import { myRole } from "@/lib/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Column fillWidth minHeight="100vh" horizontal="center" background="page" className="app-shell">
      <PageBackground />
      <a href="#main" className="skip-link">{tr("Перейти к содержимому")}</a>
      <AppHeader email={user?.email} readOnly={(await myRole()) === "viewer"} />
      <Column
        as="main"
        id="main"
        fillWidth
        maxWidth="xl"
        zIndex={1}
        className="app-main"
        paddingX="32"
        s={{ paddingX: "16" }}
      >
        {children}
      </Column>
      <AssistantPanel />
      <SiteNavigator />
    </Column>
  );
}
