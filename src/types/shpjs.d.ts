declare module "shpjs" {
  type FC = { type: "FeatureCollection"; features: { type: "Feature"; geometry: unknown; properties: Record<string, unknown> }[]; fileName?: string };
  type Parts = { shp: ArrayBuffer; dbf?: ArrayBuffer; prj?: string | ArrayBuffer; cpg?: string | ArrayBuffer };
  export default function getShapefile(input: ArrayBuffer | Parts): Promise<FC | FC[]>;
}
