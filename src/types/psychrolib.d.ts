declare module "psychrolib" {
  interface PsychrolibApi {
    IP: number;
    SI: number;
    GetUnitSystem(): number | undefined;
    SetUnitSystem(unitSystem: number): void;
    GetTWetBulbFromRelHum(dryBulbTemp: number, relativeHumidity: number, pressure: number): number;
    GetRelHumFromTWetBulb(dryBulbTemp: number, wetBulbTemp: number, pressure: number): number;
  }

  const psychrolib: PsychrolibApi;

  export default psychrolib;
}