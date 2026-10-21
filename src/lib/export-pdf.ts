// Pure JavaScript PDF generator (no Python dependency)
// Uses jspdf with Vazirmatn font for Persian support
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Program } from '@prisma/client';

// Convert Persian numbers for display
function toPersianNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toLocaleString('en-US').replace(/\d/g, d => persianDigits[parseInt(d)]);
}

export async function generateProgramsPDF(
  programs: (Program & { genre: any })[],
  format: 'list' | 'table' | 'cards' = 'list'
): Promise<ArrayBuffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  
  // Page dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  
  // Header
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, pageWidth, 30, 'F');
  
  doc.setTextColor(34, 197, 94);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('BANKE RASANE - Bank of Media Programs', margin, 15);
  
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  doc.text(`Total Programs: ${programs.length}  |  Generated: ${new Date().toLocaleDateString('en-US')}`, margin, 22);
  
  let y = 40;
  
  if (format === 'table') {
    // Table format - compact
    autoTable(doc, {
      head: [['#', 'Title', 'Genre', 'Duration', 'Viewers', 'Status']],
      body: programs.map((p, idx) => [
        String(idx + 1),
        p.title.substring(0, 50),
        p.genre?.nameEn || '-',
        p.duration ? `${p.duration}min` : '-',
        toPersianNumber(p.viewersCount),
        p.status,
      ]),
      startY: y,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [34, 197, 94], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: margin, right: margin },
    });
  } else if (format === 'cards') {
    // Card format - visual
    const cardHeight = 40;
    const cardGap = 5;
    const cardsPerRow = 2;
    const cardWidth = (contentWidth - cardGap) / cardsPerRow;
    
    programs.forEach((p, idx) => {
      const col = idx % cardsPerRow;
      const row = Math.floor(idx / cardsPerRow);
      const x = margin + col * (cardWidth + cardGap);
      const cardY = y + row * (cardHeight + cardGap);
      
      // Check if we need a new page
      if (cardY + cardHeight > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
      
      // Card background
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'F');
      
      // Card border (color by genre)
      const color = hexToRgb(p.genre?.color || '#22c55e');
      doc.setDrawColor(color.r, color.g, color.b);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'S');
      
      // Title
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const titleLines = doc.splitTextToSize(p.title, cardWidth - 10);
      doc.text(titleLines.slice(0, 2), x + 5, cardY + 7);
      
      // Genre badge
      doc.setFillColor(color.r, color.g, color.b);
      doc.roundedRect(x + 5, cardY + 18, 30, 5, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text((p.genre?.nameEn || '').substring(0, 18), x + 7, cardY + 22);
      
      // Info
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`Duration: ${p.duration || '-'}min`, x + 5, cardY + 28);
      doc.text(`Viewers: ${toPersianNumber(p.viewersCount)}`, x + 5, cardY + 33);
      doc.text(`ID: ${p.id}`, x + cardWidth - 25, cardY + 33);
    });
  } else {
    // List format - detailed
    programs.forEach((p, idx) => {
      // Check page break
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }
      
      // Index number
      doc.setTextColor(34, 197, 94);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(String(idx + 1).padStart(3, '0'), margin, y);
      
      // Title
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(11);
      const titleLines = doc.splitTextToSize(p.title, contentWidth - 20);
      doc.text(titleLines.slice(0, 2), margin + 15, y);
      
      y += 7;
      
      // Genre and metadata
      const color = hexToRgb(p.genre?.color || '#22c55e');
      doc.setFillColor(color.r, color.g, color.b);
      doc.roundedRect(margin + 15, y - 3, 35, 5, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text((p.genre?.nameEn || '').substring(0, 20), margin + 17, y + 0.5);
      
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const meta = [
        `Duration: ${p.duration || '-'} min`,
        `Episodes: ${toPersianNumber(p.episodeCount)}`,
        `Viewers: ${toPersianNumber(p.viewersCount)}`,
        p.producer ? `Producer: ${p.producer}` : '',
        p.director ? `Director: ${p.director}` : '',
      ].filter(Boolean).join('  |  ');
      doc.text(meta, margin + 55, y + 0.5);
      
      y += 8;
      
      // Description (if exists)
      if (p.description) {
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(8);
        const descLines = doc.splitTextToSize(p.description, contentWidth - 15);
        doc.text(descLines.slice(0, 2), margin + 15, y);
        y += descLines.slice(0, 2).length * 4 + 2;
      }
      
      // Separator
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    });
  }
  
  // Footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Bank Rasane v1.1.0  -  Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }
  
  return doc.output('arraybuffer');
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 34, g: 197, b: 94 };
}
