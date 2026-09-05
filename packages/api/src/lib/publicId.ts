/** Short human/QR-friendly package code, e.g. RX-2609-4F2A. */
export function generatePackagePublicId(date = new Date()): string {
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `RX-${yy}${mm}-${rand}`;
}
