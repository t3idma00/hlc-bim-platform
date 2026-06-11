const MANUAL_SELECT_MARKER_VALUE = "1";

export function manualSelectMarkerKey(fieldKey: string) {
  return `${fieldKey}__manualSelect`;
}

export function manualSelectMarkerValue(value: string | undefined) {
  return value?.trim() ? MANUAL_SELECT_MARKER_VALUE : "";
}

export function isManualSelectComplete(values: Record<string, string>, fieldKey: string, value: string | undefined) {
  return Boolean(value?.trim() && values[manualSelectMarkerKey(fieldKey)] === MANUAL_SELECT_MARKER_VALUE);
}
