export interface Region {
  id: string;
  fr: string;
  en: string;
}

export const REGIONS: Region[] = [
  { id: "lit", fr: "Littoral", en: "Littoral" },
  { id: "ctr", fr: "Centre", en: "Centre" },
  { id: "ouest", fr: "Ouest", en: "West" },
  { id: "no", fr: "Nord-Ouest", en: "North-West" },
  { id: "so", fr: "Sud-Ouest", en: "South-West" },
  { id: "nord", fr: "Nord", en: "North" },
  { id: "exn", fr: "Extrême-Nord", en: "Far North" },
  { id: "ada", fr: "Adamaoua", en: "Adamawa" },
  { id: "est", fr: "Est", en: "East" },
  { id: "sud", fr: "Sud", en: "South" },
];

export const TOWNS: Record<string, string[]> = {
  lit: ["Douala", "Nkongsamba"],
  ctr: ["Yaoundé", "Mbalmayo"],
  ouest: ["Bafoussam", "Dschang"],
  no: ["Bamenda", "Kumbo"],
  so: ["Buea", "Limbé"],
  nord: ["Garoua"],
  exn: ["Maroua"],
  ada: ["Ngaoundéré"],
  est: ["Bertoua"],
  sud: ["Ebolowa"],
};
