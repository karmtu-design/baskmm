import { Column } from "@once-ui-system/core";
import AppHeader from "@/components/AppHeader";
import AssistantPanel from "@/components/AssistantPanel";
import SiteNavigator from "@/components/SiteNavigator";
import { getCompanies, getLicenses } from "@/lib/data";
import PageBackground from "@/components/PageBackground";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [licenses, companies] = user ? await Promise.all([getLicenses(), getCompanies()]) : [[], []];

  return (
    <Column fillWidth minHeight="100vh" horizontal="center" background="page">
      <PageBackground />
      <AppHeader email={user?.email} />
      <Column
        as="main"
        fillWidth
        maxWidth="xl"
        zIndex={1}
        paddingX="24"
        paddingTop="104"
        paddingBottom="80"
        s={{ paddingX: "16", paddingTop: "80", paddingBottom: "128" }}
      >
        {children}
      </Column>
      <AssistantPanel />
      <SiteNavigator
        licenses={licenses.map((l) => ({ id: l.id, title: l.deposit_name || l.license_number, number: l.license_number, company: l.company_name }))}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      />
    </Column>
  );
}
