import { formatUnitValue, normalizeUnitSystem, toDisplayUnit, unitLabel, type UnitSystem } from "@/lib/units";
import type { RoomData } from "@/types";

import { buildInitialSections, summaryRows } from "./components/form-panel/heat-load-sheet-data";
import { normalizeSheetCellValue } from "./components/form-panel/heat-load-sheet-normalization";
import type { Column, Row, Section, SheetValues } from "./components/form-panel/heat-load-sheet-types";
import { getAshraeZoneLabel } from "./components/form-panel/heat-load-zone-labels";

type HeatLoadExportInput = {
  projectName: string;
  rooms: RoomData[];
};

type ExportCell = {
  value: string;
  align?: "left" | "right" | "center";
  weight?: number;
};

type ExportTable = {
  title: string;
  headers: ExportCell[];
  rows: ExportCell[][];
  notes: string[];
};

type ExportRoom = {
  name: string;
  location: string;
  unitSystem: UnitSystem;
  designRows: Array<[string, string]>;
  summaryRows: Array<[string, string, string]>;
  tables: ExportTable[];
  heatLoadW: number;
  totalKw: number;
  totalBtuh: number;
  totalRt: number;
};

type ExportReport = {
  projectName: string;
  generatedAt: Date;
  rooms: ExportRoom[];
  totals: {
    heatLoadW: number;
    totalKw: number;
    totalBtuh: number;
    totalRt: number;
  };
};

type WorksheetCell = string | number | null | {
  value: string | number;
  style?: number;
};

type Worksheet = {
  name: string;
  rows: WorksheetCell[][];
  columnWidths?: number[];
};

const PDF_PAGE_WIDTH = 842;
const PDF_PAGE_HEIGHT = 595;
const PDF_MARGIN = 34;
const PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const legacySection5RowIds: Record<string, string> = {
  "5.2": "5.3",
  "5.3": "5.4",
  "5.4": "5.5",
  "5.5": "5.6",
};

export function downloadHeatLoadPdf(input: HeatLoadExportInput) {
  const report = buildHeatLoadExportReport(input);
  const fileName = ensureFileExtension(sanitizeFileBase(input.projectName), ".pdf", "-heat-load-report");
  downloadBlob(createHeatLoadPdf(report), fileName);
}

export function downloadHeatLoadSpreadsheet(input: HeatLoadExportInput) {
  const report = buildHeatLoadExportReport(input);
  const fileName = ensureFileExtension(sanitizeFileBase(input.projectName), ".xlsx", "-heat-load-workbook");
  downloadBlob(createHeatLoadWorkbook(report), fileName);
}

function buildHeatLoadExportReport(input: HeatLoadExportInput): ExportReport {
  const rooms = input.rooms.map(buildExportRoom);
  const totals = rooms.reduce(
    (accumulator, room) => ({
      heatLoadW: accumulator.heatLoadW + room.heatLoadW,
      totalKw: accumulator.totalKw + room.totalKw,
      totalBtuh: accumulator.totalBtuh + room.totalBtuh,
      totalRt: accumulator.totalRt + room.totalRt,
    }),
    { heatLoadW: 0, totalKw: 0, totalBtuh: 0, totalRt: 0 },
  );

  return {
    projectName: input.projectName || "HLC BIM Project",
    generatedAt: new Date(),
    rooms,
    totals,
  };
}

function buildExportRoom(room: RoomData): ExportRoom {
  const formValues = room.formValues ?? {};
  const sheetValues = room.sheetValues ?? {};
  const unitSystem = normalizeUnitSystem(formValues.unitSystem);
  const tables = buildInitialSections().map((section) => buildExportTable(section, sheetValues, unitSystem));
  const summary = buildSummaryRows(sheetValues, unitSystem);
  const location = [formValues.selectedCity, formValues.selectedCountry].filter(Boolean).join(", ") || "Not selected";

  return {
    name: room.name || room.id || "Room",
    location,
    unitSystem,
    designRows: buildDesignRows(formValues, sheetValues, unitSystem),
    summaryRows: summary,
    tables,
    heatLoadW: parseNumber(sheetValues.summary_0),
    totalKw: parseNumber(sheetValues.summary_2),
    totalBtuh: parseNumber(sheetValues.summary_3),
    totalRt: parseNumber(sheetValues.summary_4),
  };
}

function buildDesignRows(
  formValues: Record<string, string>,
  sheetValues: SheetValues,
  unitSystem: UnitSystem,
): Array<[string, string]> {
  const outdoorType = formValues.conditionType || "Relative Humidity";
  const indoorType = formValues.indoorConditionType || "Relative Humidity";

  return [
    ["Location", [formValues.selectedCity, formValues.selectedCountry].filter(Boolean).join(", ") || "Not selected"],
    ["Design source", getDesignSourceLabel(formValues.designConditionSource)],
    ["Unit system", unitSystem === "imperial" ? "IP" : "SI"],
    ["Outdoor dry bulb", withUnit(formatUnitValue(formValues.dryBulbTemp, unitSystem, "temperature"), unitLabel(unitSystem, "temperature"))],
    ["Outdoor percentile", formValues.dryBulbPercentile ? `${formValues.dryBulbPercentile}%` : ""],
    ["Outdoor WB / RH", formatConditionValue(formValues.conditionValue, outdoorType, unitSystem)],
    ["Indoor dry bulb", withUnit(formatUnitValue(formValues.insideCondition, unitSystem, "temperature"), unitLabel(unitSystem, "temperature"))],
    ["Indoor WB / RH", formatConditionValue(formValues.indoorConditionValue, indoorType, unitSystem)],
    ["Temperature difference", withUnit(formatUnitValue(formValues.conditionDifference, unitSystem, "temperatureDelta"), unitLabel(unitSystem, "temperatureDelta"))],
    ["Solar DNI", withUnit(formValues.solarDni, "W/m2")],
    ["Solar DHI", withUnit(formValues.solarDhi, "W/m2")],
    ["Solar GHI", withUnit(formValues.solarGhi, "W/m2")],
    ["Roof type", formValues.roofType || ""],
    ["Roof ceiling detail", formValues.roofDetail || sheetValues["1.6_detail"] || sheetValues["3.4_typeB"] || ""],
    ["Roof thickness", withUnit(formatUnitValue(formValues.roofThickness, unitSystem, "thickness"), unitLabel(unitSystem, "thickness"))],
  ];
}

function getDesignSourceLabel(value: string | undefined) {
  if (value === "ashrae-2017" || value === "ashrae-2005") {
    return "ASHRAE station data";
  }

  return "Current historical weather";
}

function formatConditionValue(value: string | undefined, type: string, unitSystem: UnitSystem) {
  if (!value) {
    return "";
  }

  if (type === "Wet bulb temperature") {
    return `${type}: ${withUnit(formatUnitValue(value, unitSystem, "temperature"), unitLabel(unitSystem, "temperature"))}`;
  }

  return `${type}: ${value}%`;
}

function buildSummaryRows(sheetValues: SheetValues, unitSystem: UnitSystem): Array<[string, string, string]> {
  return summaryRows.map((row, index) => {
    const key = `summary_${index}`;
    const note = sheetValues[`${key}_note`] ?? row.note ?? "";
    const rawValue = sheetValues[key] ?? row.value ?? "";
    const label =
      index === 0
        ? `${row.label} (${unitLabel(unitSystem, "heat")})`
        : index === 1
          ? `${row.label} (%)`
          : row.label;
    const value = index === 0 ? formatUnitValue(rawValue, unitSystem, "heat") : rawValue;
    return [label, note, value];
  });
}

function buildExportTable(section: Section, sheetValues: SheetValues, unitSystem: UnitSystem): ExportTable {
  const headers: ExportCell[] = [
    { value: "Row", align: "center", weight: 5 },
    ...section.columns.map((column) => ({
      value: getColumnLabel(column, unitSystem),
      align: column.align,
      weight: parseColumnWeight(column.width),
    })),
  ];

  const rows: ExportCell[][] = section.rows.map((row) => [
    { value: row.id, align: "center" as const, weight: 5 },
    ...section.columns.map((column) => ({
      value: getCellDisplayValue(row, column, sheetValues, unitSystem),
      align: column.align,
      weight: parseColumnWeight(column.width),
    })),
  ]);

  return {
    title: `${section.number}. ${section.title}`,
    headers,
    rows,
    notes: buildSectionNotes(section, sheetValues),
  };
}

function buildSectionNotes(section: Section, sheetValues: SheetValues) {
  return section.rows.flatMap((row) => {
    const notes: string[] = [];
    const reference = sheetValues[`${row.id}_reference`] ?? row.values.reference ?? "";
    const calculationTrace = sheetValues[`${row.id}_calculationTrace`] ?? "";
    const sources = section.columns
      .map((column) => sheetValues[`${row.id}_${column.key}_source`])
      .filter((value): value is string => Boolean(value));

    if (reference) notes.push(`${row.id} reference: ${reference}`);
    if (sources.length > 0) notes.push(`${row.id} sources: ${Array.from(new Set(sources)).join("; ")}`);
    if (calculationTrace) notes.push(`${row.id} calculation: ${calculationTrace.replace(/\s+/g, " ")}`);

    return notes;
  });
}

function getColumnLabel(column: Column, unitSystem: UnitSystem) {
  return column.unit ? `${column.label} (${unitLabel(unitSystem, column.unit)})` : column.label;
}

function getCellDisplayValue(row: Row, column: Column, sheetValues: SheetValues, unitSystem: UnitSystem) {
  const legacyRowId = legacySection5RowIds[row.id];
  const rawValue =
    sheetValues[`${row.id}_${column.key}`] ??
    (legacyRowId ? sheetValues[`${legacyRowId}_${column.key}`] : undefined) ??
    row.values[column.key] ??
    "";
  const normalizedValue = normalizeSheetCellValue(row, column.key, rawValue);

  if (column.key === "zone") {
    return getAshraeZoneLabel(normalizedValue);
  }

  if (isSection6TotalHeatCell(row, column)) {
    const sensible = parseNumber(sheetValues[`${row.id}_sensible`] ?? row.values.sensible);
    const latent = parseNumber(sheetValues[`${row.id}_latent`] ?? row.values.latent);
    return toDisplayUnit(sensible + latent, unitSystem, "heat").toFixed(0);
  }

  if (isTotalHeatLoadColumn(column)) {
    return formatFixedHeatValue(normalizedValue, unitSystem);
  }

  return column.unit ? formatUnitValue(normalizedValue, unitSystem, column.unit) : normalizedValue;
}

function isSection6TotalHeatCell(row: Row, column: Column) {
  return row.id.startsWith("6.") && column.key === "heatLoad";
}

function isTotalHeatLoadColumn(column: Column) {
  return column.unit === "heat" && (column.key === "heatLoad" || column.key === "result");
}

function formatFixedHeatValue(value: string, unitSystem: UnitSystem) {
  const parsed = Number.parseFloat(value.replace(",", "."));

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return toDisplayUnit(parsed, unitSystem, "heat").toFixed(0);
}

function parseColumnWeight(width: string | undefined) {
  if (!width) {
    return 10;
  }

  const parsed = Number.parseFloat(width);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

function withUnit(value: string | undefined, unit: string) {
  return value ? `${value} ${unit}` : "";
}

function parseNumber(value: string | undefined) {
  const parsed = Number.parseFloat((value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function sanitizeFileBase(value: string) {
  const sanitized = value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").trim();
  return sanitized.length > 0 ? sanitized : "hlc-bim-project";
}

function ensureFileExtension(fileBase: string, extension: string, suffix: string) {
  const baseWithSuffix = fileBase.toLowerCase().endsWith(suffix) ? fileBase : `${fileBase}${suffix}`;
  return baseWithSuffix.toLowerCase().endsWith(extension) ? baseWithSuffix : `${baseWithSuffix}${extension}`;
}

function createHeatLoadPdf(report: ExportReport) {
  const pdf = new PdfDocument(PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT);
  const generatedAt = report.generatedAt.toLocaleString();

  pdf.addPage();
  pdf.drawTitle("Heat Load Calculation Report");
  pdf.drawText(`Project: ${report.projectName}`, PDF_MARGIN, 82, 11, "bold");
  pdf.drawText(`Generated: ${generatedAt}`, PDF_MARGIN, 98, 9);
  pdf.drawText(`Rooms: ${report.rooms.length}`, PDF_MARGIN, 112, 9);

  pdf.setCursor(134);
  pdf.drawKeyValueTable([
    ["Project heat load", `${report.totals.heatLoadW.toFixed(2)} W`],
    ["Total with safety", `${report.totals.totalKw.toFixed(2)} kW`],
    ["Total with safety", `${report.totals.totalBtuh.toFixed(2)} Btu/hr`],
    ["Total with safety", `${report.totals.totalRt.toFixed(2)} RT`],
  ], 300);

  pdf.addSectionTitle("Room Summary");
  pdf.drawTable(
    [
      { value: "Room", weight: 22 },
      { value: "Location", weight: 26 },
      { value: "Units", weight: 10, align: "center" },
      { value: "Heat load", weight: 14, align: "right" },
      { value: "Total kW", weight: 14, align: "right" },
      { value: "Total RT", weight: 14, align: "right" },
    ],
    report.rooms.map((room) => [
      { value: room.name },
      { value: room.location },
      { value: room.unitSystem === "imperial" ? "IP" : "SI", align: "center" },
      { value: `${room.heatLoadW.toFixed(2)} W`, align: "right" },
      { value: room.totalKw.toFixed(2), align: "right" },
      { value: room.totalRt.toFixed(2), align: "right" },
    ]),
    { fontSize: 7.2, maxLinesPerCell: 3 },
  );

  report.rooms.forEach((room, index) => {
    if (index > 0 || pdf.cursorY > PDF_PAGE_HEIGHT - 170) {
      pdf.addPage();
    }

    pdf.addSectionTitle(room.name);
    pdf.drawText(`Location: ${room.location}`, PDF_MARGIN, pdf.cursorY, 8);
    pdf.cursorY += 14;

    pdf.drawKeyValueTable(room.designRows, 380);
    pdf.addSectionTitle("Load Summary");
    pdf.drawTable(
      [
        { value: "Item", weight: 50 },
        { value: "Note", weight: 18 },
        { value: "Value", weight: 20, align: "right" },
      ],
      room.summaryRows.map(([label, note, value]) => [
        { value: label },
        { value: note },
        { value, align: "right" },
      ]),
      { fontSize: 7.4, maxLinesPerCell: 2 },
    );

    room.tables.forEach((table) => {
      pdf.addSectionTitle(table.title);
      pdf.drawTable(table.headers, table.rows, { fontSize: 6.3, maxLinesPerCell: 3 });

      const firstNotes = table.notes.slice(0, 4);
      if (firstNotes.length > 0) {
        pdf.drawNoteBlock("Calculation references", firstNotes);
      }
    });
  });

  return pdf.toBlob();
}

type PdfPage = {
  commands: string[];
};

class PdfDocument {
  private pages: PdfPage[] = [];
  cursorY = PDF_MARGIN;

  constructor(private width: number, private height: number) {}

  addPage() {
    this.pages.push({ commands: [] });
    this.cursorY = PDF_MARGIN;
    this.drawPageChrome();
  }

  drawTitle(title: string) {
    this.drawRect(0, 0, this.width, 56, [0.62, 0.07, 0.22], true);
    this.drawText(title, PDF_MARGIN, 34, 19, "bold", [1, 1, 1]);
    this.drawText("ASHRAE-oriented room cooling load schedule", PDF_MARGIN, 50, 8, "regular", [1, 0.88, 0.92]);
    this.cursorY = 76;
  }

  addSectionTitle(title: string) {
    this.ensureSpace(32);
    this.drawText(title, PDF_MARGIN, this.cursorY, 10, "bold", [0.08, 0.1, 0.16]);
    this.drawLine(PDF_MARGIN, this.cursorY + 5, this.width - PDF_MARGIN, this.cursorY + 5, [0.88, 0.18, 0.34], 0.8);
    this.cursorY += 17;
  }

  setCursor(y: number) {
    this.cursorY = y;
  }

  drawKeyValueTable(rows: Array<[string, string]>, width: number) {
    const x = PDF_MARGIN;
    const labelWidth = Math.min(150, width * 0.42);

    rows.forEach(([label, value], index) => {
      this.ensureSpace(18);
      const y = this.cursorY;
      const fill: [number, number, number] = index % 2 === 0 ? [0.98, 0.98, 0.99] : [1, 1, 1];
      this.drawRect(x, y - 9, width, 16, fill, true);
      this.drawRect(x, y - 9, width, 16, [0.82, 0.84, 0.88], false);
      this.drawText(label, x + 5, y + 1, 7.2, "bold");
      this.drawText(value, x + labelWidth + 5, y + 1, 7.2);
      this.drawLine(x + labelWidth, y - 9, x + labelWidth, y + 7, [0.82, 0.84, 0.88], 0.4);
      this.cursorY += 16;
    });

    this.cursorY += 8;
  }

  drawTable(headers: ExportCell[], rows: ExportCell[][], options: { fontSize: number; maxLinesPerCell: number }) {
    const widths = scaleWeights(headers.map((header) => header.weight ?? 10), PDF_CONTENT_WIDTH);
    const lineHeight = options.fontSize + 2.2;

    const drawHeader = () => {
      this.ensureSpace(28);
      const headerHeight = 22;
      this.drawTableRow(headers, widths, headerHeight, {
        fontSize: options.fontSize,
        fill: [1, 0.91, 0.94],
        font: "bold",
        maxLines: 2,
      });
    };

    drawHeader();

    rows.forEach((row, index) => {
      const rowLines = row.map((cell, cellIndex) =>
        wrapText(cell.value, widths[cellIndex] - 8, options.fontSize, options.maxLinesPerCell),
      );
      const rowHeight = Math.max(18, Math.max(...rowLines.map((lines) => lines.length)) * lineHeight + 8);

      if (this.cursorY + rowHeight > this.height - PDF_MARGIN) {
        this.addPage();
        drawHeader();
      }

      this.drawTableRow(row, widths, rowHeight, {
        fontSize: options.fontSize,
        fill: index % 2 === 0 ? [1, 1, 1] : [0.98, 0.98, 0.99],
        font: "regular",
        maxLines: options.maxLinesPerCell,
      });
    });

    this.cursorY += 8;
  }

  drawNoteBlock(title: string, notes: string[]) {
    const fontSize = 6.2;
    const lineHeight = 8;
    const wrappedNotes = notes.flatMap((note) => wrapText(note, PDF_CONTENT_WIDTH - 12, fontSize, 3));
    const height = Math.max(20, wrappedNotes.length * lineHeight + 18);
    this.ensureSpace(height + 6);
    this.drawRect(PDF_MARGIN, this.cursorY - 8, PDF_CONTENT_WIDTH, height, [0.99, 0.96, 0.97], true);
    this.drawRect(PDF_MARGIN, this.cursorY - 8, PDF_CONTENT_WIDTH, height, [0.9, 0.76, 0.8], false);
    this.drawText(title, PDF_MARGIN + 6, this.cursorY + 2, 6.8, "bold", [0.48, 0.05, 0.18]);
    this.cursorY += 13;

    wrappedNotes.forEach((line) => {
      this.drawText(line, PDF_MARGIN + 6, this.cursorY, fontSize, "regular", [0.16, 0.18, 0.24]);
      this.cursorY += lineHeight;
    });

    this.cursorY += 8;
  }

  drawText(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    font: "regular" | "bold" = "regular",
    color: [number, number, number] = [0, 0, 0],
  ) {
    this.command(
      `${color.map(formatPdfNumber).join(" ")} rg BT /${font === "bold" ? "F2" : "F1"} ${formatPdfNumber(fontSize)} Tf 1 0 0 1 ${formatPdfNumber(x)} ${formatPdfNumber(this.height - y)} Tm (${escapePdfText(text)}) Tj ET`,
    );
  }

  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: [number, number, number] = [0, 0, 0],
    width = 0.5,
  ) {
    this.command(
      `q ${color.map(formatPdfNumber).join(" ")} RG ${formatPdfNumber(width)} w ${formatPdfNumber(x1)} ${formatPdfNumber(this.height - y1)} m ${formatPdfNumber(x2)} ${formatPdfNumber(this.height - y2)} l S Q`,
    );
  }

  drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: [number, number, number],
    fill: boolean,
  ) {
    const command = fill ? "f" : "S";
    const colorOperator = fill ? "rg" : "RG";
    this.command(
      `q ${color.map(formatPdfNumber).join(" ")} ${colorOperator} ${formatPdfNumber(x)} ${formatPdfNumber(this.height - y - height)} ${formatPdfNumber(width)} ${formatPdfNumber(height)} re ${command} Q`,
    );
  }

  ensureSpace(height: number) {
    if (this.cursorY + height > this.height - PDF_MARGIN) {
      this.addPage();
    }
  }

  toBlob() {
    return createPdfBlob(this.pages, this.width, this.height);
  }

  private drawTableRow(
    cells: ExportCell[],
    widths: number[],
    rowHeight: number,
    options: {
      fontSize: number;
      fill: [number, number, number];
      font: "regular" | "bold";
      maxLines: number;
    },
  ) {
    let x = PDF_MARGIN;
    const y = this.cursorY;
    const lineHeight = options.fontSize + 2.2;

    cells.forEach((cell, index) => {
      const width = widths[index];
      this.drawRect(x, y - 10, width, rowHeight, options.fill, true);
      this.drawRect(x, y - 10, width, rowHeight, [0.78, 0.8, 0.84], false);

      const lines = wrapText(cell.value, width - 8, options.fontSize, options.maxLines);
      lines.forEach((line, lineIndex) => {
        const textWidth = approximateTextWidth(line, options.fontSize);
        const textX =
          cell.align === "right"
            ? x + width - textWidth - 4
            : cell.align === "center"
              ? x + (width - textWidth) / 2
              : x + 4;
        this.drawText(line, Math.max(x + 3, textX), y + lineIndex * lineHeight + 1, options.fontSize, options.font);
      });

      x += width;
    });

    this.cursorY += rowHeight;
  }

  private drawPageChrome() {
    this.drawText("HLC BIM Platform", PDF_MARGIN, this.height - 18, 7, "bold", [0.46, 0.05, 0.18]);
  }

  private command(value: string) {
    const page = this.pages[this.pages.length - 1];
    if (!page) {
      throw new Error("PDF page has not been initialized.");
    }
    page.commands.push(value);
  }
}

function scaleWeights(weights: number[], totalWidth: number) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  return weights.map((weight) => (weight / totalWeight) * totalWidth);
}

function wrapText(value: string, width: number, fontSize: number, maxLines: number) {
  const cleanValue = normalizePdfText(value);
  const maxCharacters = Math.max(4, Math.floor(width / (fontSize * 0.48)));
  const words = cleanValue.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  if (words.length === 0) {
    return [""];
  }

  words.forEach((word) => {
    const pieces = word.length > maxCharacters ? chunkWord(word, maxCharacters) : [word];
    pieces.forEach((piece) => {
      const candidate = current ? `${current} ${piece}` : piece;
      if (candidate.length > maxCharacters && current) {
        lines.push(current);
        current = piece;
      } else {
        current = candidate;
      }
    });
  });

  if (current) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    const limited = lines.slice(0, maxLines);
    limited[maxLines - 1] = truncateText(limited[maxLines - 1], maxCharacters);
    return limited;
  }

  return lines;
}

function chunkWord(word: string, size: number) {
  const chunks: string[] = [];
  for (let index = 0; index < word.length; index += size) {
    chunks.push(word.slice(index, index + size));
  }
  return chunks;
}

function truncateText(value: string, maxCharacters: number) {
  if (value.length <= maxCharacters) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxCharacters - 3))}...`;
}

function approximateTextWidth(value: string, fontSize: number) {
  return value.length * fontSize * 0.48;
}

function formatPdfNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(3).replace(/\.?0+$/, "") : "0";
}

function normalizePdfText(value: string) {
  return value
    .replace(/\u00B0/g, " deg ")
    .replace(/\u00B2/g, "2")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value: string) {
  return normalizePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createPdfBlob(pages: PdfPage[], width: number, height: number) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let byteLength = 0;

  const addString = (value: string) => addBytes(encoder.encode(value));
  const addBytes = (value: Uint8Array) => {
    chunks.push(value);
    byteLength += value.length;
  };
  const addObject = (objectNumber: number, body: string) => {
    offsets[objectNumber] = byteLength;
    addString(`${objectNumber} 0 obj\n${body}\nendobj\n`);
  };

  addString("%PDF-1.4\n");
  addObject(1, "<< /Type /Catalog /Pages 2 0 R >>");

  const fontObjectNumber = 3;
  const boldFontObjectNumber = 4;
  const pageObjectStart = 5;
  const pageReferences = pages.map((_, index) => `${pageObjectStart + index * 2} 0 R`).join(" ");

  addObject(2, `<< /Type /Pages /Kids [${pageReferences}] /Count ${pages.length} >>`);
  addObject(fontObjectNumber, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  addObject(boldFontObjectNumber, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  pages.forEach((page, index) => {
    const pageObjectNumber = pageObjectStart + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    const content = `${page.commands.join("\n")}\n`;
    const contentLength = encoder.encode(content).length;

    addObject(
      pageObjectNumber,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${fontObjectNumber} 0 R /F2 ${boldFontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
    addObject(contentObjectNumber, `<< /Length ${contentLength} >>\nstream\n${content}endstream`);
  });

  const objectCount = pageObjectStart + pages.length * 2;
  const xrefOffset = byteLength;
  addString(`xref\n0 ${objectCount}\n0000000000 65535 f \n`);
  for (let objectNumber = 1; objectNumber < objectCount; objectNumber += 1) {
    addString(`${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`);
  }
  addString(`trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const pdfBytes = new Uint8Array(byteLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    pdfBytes.set(chunk, offset);
    offset += chunk.length;
  });

  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

function createHeatLoadWorkbook(report: ExportReport) {
  const worksheets: Worksheet[] = [
    buildOverviewWorksheet(report),
    ...report.rooms.map((room, index) => buildRoomWorksheet(room, index)),
  ];

  return createXlsxBlob(worksheets);
}

function buildOverviewWorksheet(report: ExportReport): Worksheet {
  const rows: WorksheetCell[][] = [
    [{ value: "Heat Load Calculation Workbook", style: 1 }],
    ["Project", report.projectName],
    ["Generated", report.generatedAt.toLocaleString()],
    ["Room count", report.rooms.length],
    [],
    [{ value: "Project Totals", style: 2 }],
    ["Metric", "Value"],
    ["Heat load (W)", report.totals.heatLoadW],
    ["Total heat load (kW)", report.totals.totalKw],
    ["Total heat load (Btu/hr)", report.totals.totalBtuh],
    ["Total heat load (RT)", report.totals.totalRt],
    [],
    [{ value: "Room Summary", style: 2 }],
    [
      { value: "Room", style: 3 },
      { value: "Location", style: 3 },
      { value: "Units", style: 3 },
      { value: "Heat load (W)", style: 3 },
      { value: "Total kW", style: 3 },
      { value: "Total Btu/hr", style: 3 },
      { value: "Total RT", style: 3 },
    ],
    ...report.rooms.map((room) => [
      room.name,
      room.location,
      room.unitSystem === "imperial" ? "IP" : "SI",
      room.heatLoadW,
      room.totalKw,
      room.totalBtuh,
      room.totalRt,
    ]),
  ];

  return {
    name: "Overview",
    rows,
    columnWidths: [28, 30, 12, 18, 16, 20, 14],
  };
}

function buildRoomWorksheet(room: ExportRoom, index: number): Worksheet {
  const rows: WorksheetCell[][] = [
    [{ value: room.name, style: 1 }],
    ["Location", room.location],
    ["Unit system", room.unitSystem === "imperial" ? "IP" : "SI"],
    [],
    [{ value: "Design Conditions", style: 2 }],
    [{ value: "Field", style: 3 }, { value: "Value", style: 3 }],
    ...room.designRows.map(([label, value]) => [label, value]),
    [],
    [{ value: "Load Summary", style: 2 }],
    [{ value: "Item", style: 3 }, { value: "Note", style: 3 }, { value: "Value", style: 3 }],
    ...room.summaryRows.map(([label, note, value]) => [label, note, maybeNumber(value)]),
  ];

  room.tables.forEach((table) => {
    rows.push([]);
    rows.push([{ value: table.title, style: 2 }]);
    rows.push(table.headers.map((header) => ({ value: header.value, style: 3 })));
    table.rows.forEach((row) => {
      rows.push(row.map((cell) => maybeNumber(cell.value)));
    });

    if (table.notes.length > 0) {
      rows.push([]);
      rows.push([{ value: "Calculation References", style: 2 }]);
      table.notes.forEach((note) => rows.push([note]));
    }
  });

  return {
    name: uniqueSheetName(room.name || `Room ${index + 1}`, index),
    rows,
    columnWidths: [18, 26, 24, 24, 18, 18, 18, 18, 18, 18, 18, 18],
  };
}

function maybeNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /[A-Za-z/%]/.test(trimmed)) {
    return value;
  }

  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : value;
}

function uniqueSheetName(value: string, index: number) {
  const suffix = ` ${index + 1}`;
  const base = sanitizeSheetName(value).slice(0, 31 - suffix.length).trim() || "Room";
  return `${base}${suffix}`;
}

function sanitizeSheetName(value: string) {
  return value.replace(/[\[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim();
}

function createXlsxBlob(worksheets: Worksheet[]) {
  const files: Array<[string, string]> = [
    ["[Content_Types].xml", buildContentTypesXml(worksheets.length)],
    ["_rels/.rels", buildRootRelationshipsXml()],
    ["xl/workbook.xml", buildWorkbookXml(worksheets)],
    ["xl/_rels/workbook.xml.rels", buildWorkbookRelationshipsXml(worksheets.length)],
    ["xl/styles.xml", buildStylesXml()],
    ...worksheets.map((worksheet, index) => [`xl/worksheets/sheet${index + 1}.xml`, buildWorksheetXml(worksheet)] as [string, string]),
  ];

  return new Blob([zipStore(files)], { type: XLSX_MIME });
}

function buildContentTypesXml(sheetCount: number) {
  const sheetOverrides = Array.from({ length: sheetCount }, (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");

  return xmlDeclaration(
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetOverrides}</Types>`,
  );
}

function buildRootRelationshipsXml() {
  return xmlDeclaration(
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
}

function buildWorkbookXml(worksheets: Worksheet[]) {
  const sheets = worksheets
    .map((worksheet, index) => `<sheet name="${escapeXmlAttribute(worksheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join("");

  return xmlDeclaration(
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`,
  );
}

function buildWorkbookRelationshipsXml(sheetCount: number) {
  const sheetRelationships = Array.from({ length: sheetCount }, (_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("");

  return xmlDeclaration(
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRelationships}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
}

function buildStylesXml() {
  return xmlDeclaration(
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF111827"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF881337"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE7EE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF9F1239"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  );
}

function buildWorksheetXml(worksheet: Worksheet) {
  const maxColumns = Math.max(...worksheet.rows.map((row) => row.length), 1);
  const widths = worksheet.columnWidths ?? Array.from({ length: maxColumns }, () => 18);
  const cols = Array.from({ length: maxColumns }, (_, index) => {
    const width = widths[index] ?? 18;
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");
  const rows = worksheet.rows.map((row, rowIndex) => buildWorksheetRowXml(row, rowIndex + 1)).join("");

  return xmlDeclaration(
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><cols>${cols}</cols><sheetData>${rows}</sheetData></worksheet>`,
  );
}

function buildWorksheetRowXml(row: WorksheetCell[], rowNumber: number) {
  const cells = row.map((cell, columnIndex) => buildWorksheetCellXml(cell, rowNumber, columnIndex + 1)).join("");
  return `<row r="${rowNumber}">${cells}</row>`;
}

function buildWorksheetCellXml(cell: WorksheetCell, rowNumber: number, columnNumber: number) {
  if (cell === null || cell === undefined) {
    return "";
  }

  const ref = `${columnName(columnNumber)}${rowNumber}`;
  const value = typeof cell === "object" && "value" in cell ? cell.value : cell;
  const style = typeof cell === "object" && "value" in cell ? cell.style : undefined;
  const styleAttribute = style === undefined ? "" : ` s="${style}"`;

  if (typeof value === "number") {
    return `<c r="${ref}"${styleAttribute}><v>${Number.isFinite(value) ? value : 0}</v></c>`;
  }

  return `<c r="${ref}" t="inlineStr"${styleAttribute}><is><t>${escapeXmlText(value)}</t></is></c>`;
}

function columnName(columnNumber: number) {
  let dividend = columnNumber;
  let name = "";

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return name;
}

function xmlDeclaration(value: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${value}`;
}

function escapeXmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlAttribute(value: string) {
  return escapeXmlText(value).replace(/"/g, "&quot;");
}

function zipStore(files: Array<[string, string]>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach(([path, content]) => {
    const nameBytes = encoder.encode(path);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const localHeader = concatBytes([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(data.length),
      uint32(data.length),
      uint16(nameBytes.length),
      uint16(0),
      nameBytes,
    ]);

    localParts.push(localHeader, data);

    centralParts.push(concatBytes([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(data.length),
      uint32(data.length),
      uint16(nameBytes.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(offset),
      nameBytes,
    ]));

    offset += localHeader.length + data.length;
  });

  const centralDirectory = concatBytes(centralParts);
  const endRecord = concatBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(centralDirectory.length),
    uint32(offset),
    uint16(0),
  ]);

  return concatBytes([...localParts, centralDirectory, endRecord]).buffer as ArrayBuffer;
}

function uint16(value: number) {
  const bytes = new Uint8Array(2);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, value, true);
  return bytes;
}

function uint32(value: number) {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, value >>> 0, true);
  return bytes;
}

function concatBytes(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });

  return output;
}

const CRC_TABLE = createCrcTable();

function createCrcTable() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  return table;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;

  data.forEach((byte) => {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });

  return (crc ^ 0xffffffff) >>> 0;
}
