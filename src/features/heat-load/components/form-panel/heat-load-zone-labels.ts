const zoneLabelByCode: Record<string, string> = {
  A: "Very light room mass",
  B: "Light room mass",
  C: "Medium room mass",
  D: "Heavy room mass",
};

export function getAshraeZoneCode(value: string | undefined) {
  const rawValue = value ?? "";
  const exactCode = rawValue.match(/\b([A-D])\b/)?.[1];

  if (exactCode) {
    return exactCode;
  }

  const labelMatch = Object.entries(zoneLabelByCode).find(([, label]) =>
    rawValue.toLowerCase().includes(label.toLowerCase()),
  );

  return labelMatch?.[0] ?? "C";
}

export function getAshraeZoneLabel(value: string | undefined) {
  return zoneLabelByCode[getAshraeZoneCode(value)];
}
