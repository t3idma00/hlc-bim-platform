import { jsPDF } from "jspdf";

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
  const imageData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height],
    compress: true,
  });

  pdf.addImage(imageData, "JPEG", 0, 0, canvas.width, canvas.height, undefined, "FAST");
  pdf.save(ensureFileExtension(fileName, ".pdf"));
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

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}
