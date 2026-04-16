export type SolarMode = "live" | "historical";

export type SolarLocationInput = {
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  timezone?: string;
};

export type ResolvedSolarLocation = {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  timezone?: string;
};

export type SolarLocationCandidate = {
  id: string;
  name: string;
  country?: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  population?: number | null;
  featureCode?: string;
  admin1?: string;
  missingFields: string[];
  hasRequiredData: boolean;
};

export type SolarIntensity = {
  ghi: number;
  dni: number;
  dhi: number;
  source: "open-meteo" | "open-meteo-archive" | "nasa-power";
  availability: {
    ghi: boolean;
    dni: boolean;
    dhi: boolean;
  };
  missingVariables: string[];
};

export type AmbientConditions = {
  dryBulbTemp: number;
  relativeHumidity: number;
  source: "open-meteo" | "open-meteo-archive";
  availability: {
    dryBulbTemp: boolean;
    relativeHumidity: boolean;
  };
  missingVariables: string[];
};

export type SolarPosition = {
  zenith: number;
  azimuth: number;
};

export type SHGFInput = {
  dni: number;
  dhi: number;
  ghi: number;
  zenith: number;
  azimuth: number;
  surfaceTilt?: number;
  surfaceAzimuth?: number;
  albedo?: number;
};

export type SHGFResult = {
  shgf: number;
  components: {
    beam: number;
    diffuse: number;
    reflected: number;
  };
  aoi: number;
  poa: number;
  poaShaded: number;
};
