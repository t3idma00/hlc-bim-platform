import assemblyRows from "./ashrae-tables/wall-assemblies-1989.json";
import constructionRows from "./ashrae-tables/wall-construction-table30-1989.json";
import archetypeRows from "./ashrae-tables/wall-archetypes-1997.json";

export type Ashrae1989WallAssemblyOption = {
  id: string;
  label: string;
  legacyType: string;
  coreThicknessMm: number;
  table30Category: string;
  table30Description: string;
  layerCodes: string[];
  uValueWPerM2K?: number;
};

type Ashrae1989WallConstructionRow = {
  construction_category: string;
  description_of_construction: string;
  group_no: string;
};

type ArchetypeLayer = {
  materialId: string;
  thicknessMm?: number;
};

type ArchetypePath = {
  fraction: number;
  layers: ArchetypeLayer[];
};

export type Ashrae1997WallArchetype = {
  id: string;
  label: string;
  dropdownLabel: string;
  thicknessSummary: string;
  optionLabel: string;
  dropdownOrder: number;
  legacyType: string;
  scope: "opaque-wall" | "fenestration";
  regions: string;
  massClass: string;
  coreThicknessMm: number;
  method: "series-layers" | "parallel-paths" | "fixed-resistance";
  layers?: ArchetypeLayer[];
  paths?: ArchetypePath[];
  fixedResistanceWithoutSurfacesM2KPerW?: number;
  cltdTable30Category: string;
  cltdTable30Description: string;
  uFactorBasis: string;
  auditNote: string;
};

const assemblies1989 = assemblyRows as Ashrae1989WallAssemblyOption[];
const constructions1989 = constructionRows as Ashrae1989WallConstructionRow[];
const archetypes1997 = archetypeRows as Ashrae1997WallArchetype[];

function normalizedTableText(value: string) {
  return value.trim().toLowerCase();
}

export const ashrae1989WallAssemblyLabels = assemblies1989.map((assembly) => assembly.label);
export const ashrae1997WallArchetypeLabels = archetypes1997
  .filter((archetype) => archetype.scope === "opaque-wall")
  .sort((left, right) => left.dropdownOrder - right.dropdownOrder)
  .map((archetype) => archetype.label);

export function getAshrae1989WallAssembly(type: string) {
  return assemblies1989.find((assembly) => assembly.label === type) ?? null;
}

export function getAshrae1997WallArchetype(type: string) {
  const typeId = type.match(/^W\d+/)?.[0];

  return archetypes1997.find((archetype) =>
    archetype.label === type ||
    archetype.id === type ||
    archetype.id === typeId
  ) ?? null;
}

export function getAshrae1997WallReference(type: string) {
  const archetype = getAshrae1997WallArchetype(type);

  if (!archetype) {
    return null;
  }

  return `${getAshrae1997WallOptionLabel(type)}. ${archetype.uFactorBasis} ${archetype.auditNote}`;
}

export function getAshrae1997WallOptionLabel(type: string) {
  const archetype = getAshrae1997WallArchetype(type);

  if (!archetype) {
    return type;
  }

  const group = getAshrae1989WallConstructionGroup(archetype);
  const groupText = group ? `; ASHRAE 1989 construction group ${group}` : "";

  return `${archetype.optionLabel}${groupText}`;
}

export function getAshrae1997WallDropdownLabel(type: string) {
  return getAshrae1997WallArchetype(type)?.dropdownLabel ?? type;
}

export function getAshrae1997WallDetails(type: string) {
  const archetype = getAshrae1997WallArchetype(type);

  if (!archetype) {
    return null;
  }

  const group = getAshrae1989WallConstructionGroup(archetype);
  const groupText = group ? `Group ${group}` : "No matching construction group";

  return {
    dropdownLabel: archetype.dropdownLabel,
    thicknessSummary: archetype.thicknessSummary,
    construction: archetype.optionLabel,
    group: groupText,
    table30Mapping: `${archetype.cltdTable30Category}: ${archetype.cltdTable30Description}`,
    note: archetype.auditNote,
  };
}

export function getAshrae1989WallConstructionGroup(archetype: Ashrae1997WallArchetype) {
  const row = constructions1989.find(
    (construction) =>
      normalizedTableText(construction.construction_category) ===
        normalizedTableText(archetype.cltdTable30Category) &&
      normalizedTableText(construction.description_of_construction) ===
        normalizedTableText(archetype.cltdTable30Description),
  );

  return row?.group_no ?? null;
}

export function getWallTypeFamily(type: string) {
  return getAshrae1997WallArchetype(type)?.legacyType ?? getAshrae1989WallAssembly(type)?.legacyType ?? type;
}

export function getWallCoreThicknessMm(type: string) {
  return getAshrae1997WallArchetype(type)?.coreThicknessMm ?? getAshrae1989WallAssembly(type)?.coreThicknessMm ?? null;
}

export function migrateLegacyWallAssembly(type: string, thicknessMm: number) {
  if (getAshrae1997WallArchetype(type) || getAshrae1989WallAssembly(type)) {
    return type;
  }

  const useThickAssembly = thicknessMm >= 150;
  const match = assemblies1989.find(
    (assembly) =>
      assembly.legacyType === type &&
      (useThickAssembly ? assembly.coreThicknessMm >= 150 : assembly.coreThicknessMm < 150),
  );

  return match?.label ?? type;
}
