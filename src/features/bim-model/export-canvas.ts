export async function waitForCanvasById(
  canvasId: string,
  timeoutMs = 5000
): Promise<HTMLCanvasElement> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const canvas = document.getElementById(canvasId);
    const bounds =
      canvas instanceof HTMLCanvasElement ? canvas.getBoundingClientRect() : null;

    if (
      canvas instanceof HTMLCanvasElement &&
      !!bounds &&
      bounds.width > 0 &&
      bounds.height > 0 &&
      canvas.width > 0 &&
      canvas.height > 0
    ) {
      return canvas;
    }

    await waitForNextFrame();
  }

  throw new Error(`Canvas ${canvasId} was not ready for export.`);
}

export async function waitForRenderFrames(frameCount = 6) {
  for (let index = 0; index < frameCount; index += 1) {
    await waitForNextFrame();
  }
}

export async function downloadCanvasJpg(
  canvas: HTMLCanvasElement,
  fileName: string
) {
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
  downloadBlob(blob, ensureFileExtension(fileName, ".jpg"));
}

export async function downloadCanvasPdf(
  canvas: HTMLCanvasElement,
  fileName: string
) {
  const imageBlob = await canvasToBlob(canvas, "image/jpeg", 0.92);
  const pdfBlob = await createSingleImagePdf(imageBlob, canvas.width, canvas.height);
  downloadBlob(pdfBlob, ensureFileExtension(fileName, ".pdf"));
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
) {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });

  if (!blob) {
    throw new Error("Unable to create export image.");
  }

  return blob;
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

function ensureFileExtension(fileName: string, extension: string) {
  return fileName.toLowerCase().endsWith(extension) ? fileName : `${fileName}${extension}`;
}

async function createSingleImagePdf(imageBlob: Blob, width: number, height: number) {
  const imageBytes = new Uint8Array(await imageBlob.arrayBuffer());
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let byteLength = 0;

  const addString = (value: string) => addBytes(encoder.encode(value));
  const addBytes = (value: Uint8Array) => {
    chunks.push(value);
    byteLength += value.length;
  };
  const addObject = (objectNumber: number, body: string | Uint8Array, prefix = "", suffix = "\nendobj\n") => {
    offsets[objectNumber] = byteLength;
    addString(`${objectNumber} 0 obj\n${prefix}`);
    if (typeof body === "string") {
      addString(body);
    } else {
      addBytes(body);
    }
    addString(suffix);
  };

  addString("%PDF-1.4\n");
  addObject(1, "<< /Type /Catalog /Pages 2 0 R >>\n");
  addObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n");
  addObject(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Img1 5 0 R >> >> /Contents 4 0 R >>\n`,
  );

  const drawImage = `q\n${width} 0 0 ${height} 0 0 cm\n/Img1 Do\nQ`;
  addObject(4, `${drawImage}\nendstream`, `<< /Length ${encoder.encode(drawImage).length} >>\nstream\n`);
  addObject(
    5,
    imageBytes,
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
    "\nendstream\nendobj\n",
  );

  const xrefOffset = byteLength;
  addString("xref\n0 6\n0000000000 65535 f \n");
  for (let objectNumber = 1; objectNumber <= 5; objectNumber += 1) {
    addString(`${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`);
  }
  addString(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const pdfBytes = new Uint8Array(byteLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    pdfBytes.set(chunk, offset);
    offset += chunk.length;
  });

  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}
