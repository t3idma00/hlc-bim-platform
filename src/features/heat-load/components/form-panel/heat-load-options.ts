import { ashrae1997WallArchetypeLabels } from "./ashrae-wall-assemblies";
import { roofAssemblyLabels, roofRouteOptions } from "./ashrae-roof-assemblies";
import {
  ashraeTable5FrameOptions,
  ashraeTable5GlazingOptions,
  ashraeTable5ThicknessOptions,
} from "./ashrae-calculations/fenestration-u-table5";
import {
  ashrae1997DomedHorizontalSkylightOptions,
  ashrae1997SolarGlassTypeOptions,
} from "./ashrae-calculations/section-2";
import section6Data from "./section-6-data.json";

const ventilationApplications = Object.keys(section6Data.ventilationRates).filter((key) => key !== "default");
const interiorTransmissionGlassTypes = [
  "Single glazing - glass",
  "Double glazing - 6.4 mm air space",
  "Double glazing - 12.7 mm air space",
].filter((type) => ashraeTable5GlazingOptions.includes(type));
const interiorPartitionWallTypes = [
  "W11 Simple 200 mm brick wall with cement plaster",
  "W12 Simple 200 mm concrete wall with cement plaster",
  "W13 Simple 200 mm cement block wall with cement plaster",
].filter((type) => ashrae1997WallArchetypeLabels.includes(type));

// Centralized lookup lists make it straightforward to replace prototype values
// with researched datasets later without rewriting the table structure.
export const heatLoadLookupOptions = {
  directions: ["North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest", "HOR"],
  wallTypes: ashrae1997WallArchetypeLabels,
  roofTypes: roofAssemblyLabels,
  roofRouteTypes: roofRouteOptions,
  glassSolarTypes: ashrae1997SolarGlassTypeOptions,
  horizontalSkylightSolarTypes: [
    ...ashrae1997SolarGlassTypeOptions,
    ...ashrae1997DomedHorizontalSkylightOptions,
  ],
  glassShadingTypes: [
    "No inside shade",
    "Venetian blinds - medium",
    "Venetian blinds - light",
    "Venetian blinds - medium closed",
    "Venetian blinds - light closed",
    "Roller shade - opaque dark",
    "Roller shade - opaque white",
    "Roller shade - translucent light",
  ],
  glassThicknesses: ["3", "6", "10", "13"],
  ashraeZoneTypes: ["A", "B", "C", "D"],
  internalLoadHours: [
    "1", "2", "3", "4", "5", "6", "7", "8",
    "9", "10", "11", "12", "13", "14", "15", "16",
    "17", "18", "19", "20", "21", "22", "23", "24",
  ],
  internalLoadDurations: ["2", "4", "6", "8", "10", "12", "14", "16", "18"],
  internalLightDurations: ["8", "10", "12", "14", "16"],
  wallThicknesses: ["100", "200"],
  transmissionGlassTypes: ashraeTable5GlazingOptions,
  transmissionGlassThicknesses: ashraeTable5ThicknessOptions,
  glassFrameTypes: ashraeTable5FrameOptions,
  interiorTransmissionGlassTypes,
  interiorPartitionWallTypes,
  infiltrationComponents: ["Window", "Door"],
  infiltrationOccupancies: ["Residential", "Non residential"],
  peopleApplications: [
    "Seated at theater",
    "Seated at theater, night",
    "Seated, very light work",
    "Moderately active office work",
    "Standing, light work; walking",
    "Walking, standing",
    "Sedentary work",
    "Light bench work",
    "Moderate dancing",
    "Walking 4.8 km/h; light machine work",
    "Bowling",
    "Heavy work",
    "Heavy machine work; lifting",
    "Athletics",
  ],
  motorPowerFactors: ["(0.04)", "(0.06)", "(0.09)", "(0.12)", "(0.19)", "(0.25)", "(0.37)", "(0.56)", "(0.75)", "(1.10)", "(1.50)", "(2.20)"],
  lampApplications: [
    "User entered incandescent/tungsten watts",
    "Fluorescent fixture, Fsa 1.20",
    "Industrial discharge fixture, Fsa 1.20",
    "Ventilated/recessed fixture, user adjusted",
  ],
  applianceApplications: [
    "Personal computer and 430 mm monitor",
    "380 mm energy-saver monitor",
    "Laser printer",
    "Desktop copier",
    "Terminal",
    "Typewriter",
    "Small copier",
    "Microwave oven",
    "Water cooler",
  ],
  ventilationApplications,
} as const;
