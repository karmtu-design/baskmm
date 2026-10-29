import { Column } from "@once-ui-system/core";
import PortfolioGeo from "@/components/PortfolioGeo";
import { PageHeader } from "@/components/ui";
import { getLicenses } from "@/lib/data";

export const metadata = { title: "Геоанализ портфеля" };

export default async function AnalysisPage() {
  const licenses = await getLicenses();
  return (
    <Column>
      <PageHeader
        title="Геоанализ портфеля"
        subtitle="Пересечения участков между собой и расстояния до соседних объектов группы."
      />
      <PortfolioGeo licenses={licenses} />
    </Column>
  );
}
