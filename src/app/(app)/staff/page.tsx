import { tr } from "@/i18n";
import { pageTitle } from "@/i18n/meta";
import { Column } from "@once-ui-system/core";
import { PageHeader } from "@/components/ui";
import StaffManager from "@/components/StaffManager";
import { getStaff } from "@/lib/data";

export const generateMetadata = pageTitle("Сотрудники");

export default async function StaffPage() {
  const { staff, me } = await getStaff();
  const mine = staff.find((s) => s.user_id === me);
  return (
    <Column gap="32">
      <PageHeader
        title={tr("Сотрудники")}
        subtitle={tr("Кто может входить в систему и что может делать: администратор управляет сотрудниками, редактор меняет данные, «просмотр» только смотрит.")}
      />
      <StaffManager staff={staff} me={me} isAdmin={mine?.role === "admin"} serviceKey={!!process.env.SUPABASE_SERVICE_ROLE_KEY} />
    </Column>
  );
}
