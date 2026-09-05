import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";

const NAVY = rgb(0x0a / 255, 0x23 / 255, 0x40 / 255);
const GOLD = rgb(1, 0xc2 / 255, 0x20 / 255);
const BLACK = rgb(0, 0, 0);

export type LabelData = {
  publicId: string;
  po: string;
  pn: string;
  qty: number;
  customer: string;
  description?: string;
  date: string;
  qrUrl: string;
  inventreeRef?: string;
};

const POINTS_PER_INCH = 72;

/**
 * Renders a package label as a single-page PDF.
 * - `format: "thermal"` -> pure black on white, max legibility (4x6 default).
 * - `format: "office"` -> navy header + gold rule, for a color laser printer.
 */
export async function renderLabelPdf(
  data: LabelData,
  format: "thermal" | "office" = "thermal",
  sizeInches: [number, number] = [4, 6],
): Promise<Uint8Array> {
  const [wIn, hIn] = sizeInches;
  const width = wIn * POINTS_PER_INCH;
  const height = hIn * POINTS_PER_INCH;

  const doc = await PDFDocument.create();
  const page = doc.addPage([width, height]);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  const qrPng = await QRCode.toBuffer(data.qrUrl, { margin: 1, width: 320 });
  const qrImage = await doc.embedPng(qrPng);

  let cursorY = height - 16;

  if (format === "office") {
    page.drawRectangle({ x: 0, y: height - 40, width, height: 40, color: NAVY });
    page.drawRectangle({ x: 0, y: height - 44, width, height: 4, color: GOLD });
    page.drawText("AM/PM Receiving", { x: 12, y: height - 26, size: 14, font, color: rgb(1, 1, 1) });
    cursorY = height - 56;
  } else {
    page.drawText("AM/PM Receiving", { x: 12, y: cursorY - 10, size: 12, font, color: BLACK });
    page.drawLine({
      start: { x: 12, y: cursorY - 18 },
      end: { x: width - 12, y: cursorY - 18 },
      thickness: 1.5,
      color: BLACK,
    });
    cursorY -= 30;
  }

  const qrSize = Math.min(width - 24, 160);
  page.drawImage(qrImage, { x: (width - qrSize) / 2, y: cursorY - qrSize, width: qrSize, height: qrSize });
  cursorY -= qrSize + 16;

  const line = (label: string, value: string, size = 12) => {
    page.drawText(`${label}: ${value}`, { x: 12, y: cursorY, size, font: fontRegular, color: BLACK, maxWidth: width - 24 });
    cursorY -= size + 8;
  };

  page.drawText(data.publicId, { x: 12, y: cursorY, size: 16, font, color: BLACK });
  cursorY -= 24;
  line("PO", data.po, 13);
  line("PN", data.pn, 13);
  line("Qty", String(data.qty), 13);
  line("Customer", data.customer, 11);
  if (data.description) line("Desc", data.description, 9);
  line("Received", data.date, 10);
  if (data.inventreeRef) line("InvenTree", data.inventreeRef, 9);

  return doc.save();
}
