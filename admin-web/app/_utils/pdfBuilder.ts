import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const PDF_PRIMARY: [number, number, number] = [46, 189, 140];
export const PDF_GRIS_LABEL: [number, number, number] = [110, 110, 110];
export const PDF_GRIS_TEXTO: [number, number, number] = [30, 30, 30];

export function fechaLarga(fecha: string | null): string {
  if (!fecha) return "—";
  const d = new Date(fecha + "T12:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}

// Las fuentes estándar de jsPDF (Helvetica) usan codificación WinAnsi y no
// soportan emoji ni otros símbolos fuera de Latin-1/dingbats básicos. Un
// carácter no soportado no solo se ve mal: puede corromper el espaciado de
// toda la cadena (ej. "🏋️ Press de banca" sale como "P r e s s..."). Por eso
// se limpian antes de escribir cualquier texto en el PDF.
const EMOJI_RE = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{2190}-\u{21FF}]/gu;

export function sanitizePdfText(text: string): string {
  return text.replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
}

export function slugArchivo(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD").replace(new RegExp("[̀-ͯ]", "g"), "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Constructor de PDFs reutilizable entre los distintos exportadores
 * (historial clínico, plan de nutrición, rutina de entrenamiento).
 * Encapsula paginación, tipografía y espaciado consistentes.
 */
export function createPdfBuilder() {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (h: number) => {
    if (y + h > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const heading1 = (text: string) => {
    ensureSpace(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...PDF_GRIS_TEXTO);
    doc.text(sanitizePdfText(text), margin, y);
    y += 9;
  };

  const heading2 = (text: string) => {
    ensureSpace(7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...PDF_GRIS_TEXTO);
    doc.text(sanitizePdfText(text), margin, y);
    y += 6.5;
  };

  const metaLine = (text: string) => {
    ensureSpace(5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...PDF_GRIS_LABEL);
    doc.text(sanitizePdfText(text), margin, y);
    y += 5;
  };

  const divider = () => {
    ensureSpace(8);
    y += 2;
    doc.setDrawColor(...PDF_PRIMARY);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    doc.setTextColor(...PDF_GRIS_TEXTO);
  };

  const sectionTitle = (text: string) => {
    ensureSpace(14);
    doc.setFillColor(...PDF_PRIMARY);
    doc.rect(margin, y - 4.5, contentWidth, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(sanitizePdfText(text), margin + 2.5, y);
    y += 9;
    doc.setTextColor(...PDF_GRIS_TEXTO);
  };

  const subheading = (text: string, color: [number, number, number] = PDF_PRIMARY) => {
    ensureSpace(9);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...color);
    doc.text(sanitizePdfText(text), margin, y);
    y += 6;
    doc.setTextColor(...PDF_GRIS_TEXTO);
  };

  const kv = (label: string, value?: string | null) => {
    if (value == null || !String(value).trim()) return;
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_GRIS_LABEL);
    doc.text(sanitizePdfText(label), margin, y);
    y += 4.3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_GRIS_TEXTO);
    const lines = doc.splitTextToSize(sanitizePdfText(String(value)), contentWidth);
    for (const line of lines) {
      ensureSpace(5);
      doc.text(line, margin, y);
      y += 5;
    }
    y += 2;
  };

  const bulletList = (items: string[]) => {
    if (items.length === 0) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_GRIS_TEXTO);
    for (const item of items) {
      const lines = doc.splitTextToSize(`•  ${sanitizePdfText(item)}`, contentWidth - 2);
      for (const line of lines) {
        ensureSpace(5);
        doc.text(line, margin, y);
        y += 5;
      }
    }
    y += 2;
  };

  const bullets = (label: string, items: string[]) => {
    if (items.length === 0) return;
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_GRIS_LABEL);
    doc.text(sanitizePdfText(label), margin, y);
    y += 4.3;
    bulletList(items);
  };

  const checklist = (label: string, items: [string, boolean][]) =>
    bullets(label, items.filter(([, v]) => v).map(([l]) => l));

  const empty = (text: string) => {
    ensureSpace(8);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(...PDF_GRIS_LABEL);
    doc.text(sanitizePdfText(text), margin, y);
    y += 7;
    doc.setTextColor(...PDF_GRIS_TEXTO);
  };

  const table = (
    head: string[],
    body: (string | number)[][],
    opts?: {
      foot?: (string | number)[][];
      columnStyles?: Record<number, { cellWidth?: number; halign?: "left" | "center" | "right" }>;
    }
  ) => {
    const clean = (v: string | number) => (typeof v === "string" ? sanitizePdfText(v) : v);
    ensureSpace(16);
    autoTable(doc, {
      startY: y,
      head: [head.map(clean)],
      body: body.map((row) => row.map(clean)),
      foot: opts?.foot?.map((row) => row.map(clean)),
      margin: { left: margin, right: margin, bottom: margin },
      styles: { fontSize: 8.5, cellPadding: 2, textColor: [30, 30, 30] },
      headStyles: { fillColor: PDF_PRIMARY, textColor: [255, 255, 255], fontStyle: "bold" },
      footStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 250, 249] },
      columnStyles: opts?.columnStyles,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  };

  const finish = (filename: string) => {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...PDF_GRIS_LABEL);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
      doc.text("MyFitTrack", margin, pageHeight - 8);
    }
    doc.save(filename);
  };

  return {
    doc, margin, pageWidth, pageHeight, contentWidth,
    ensureSpace, heading1, heading2, metaLine, divider, sectionTitle, subheading,
    kv, bullets, bulletList, checklist, empty, table, finish,
  };
}
