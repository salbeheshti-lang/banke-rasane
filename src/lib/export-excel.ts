// Pure JavaScript Excel generator (no Python dependency)
// Uses exceljs for .xlsx generation
import ExcelJS from 'exceljs';
import type { Program } from '@prisma/client';

export async function generateProgramsExcel(
  programs: (Program & { genre: any })[]
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bank Rasane v1.1.0';
  workbook.created = new Date();
  
  // ===== Sheet 1: Programs (Detailed) =====
  const ws = workbook.addWorksheet('Programs', {
    properties: { defaultRowHeight: 22, tabColor: { argb: 'FF22C55E' } },
    views: [{ rightToLeft: true, showGridLines: false }],
  });
  
  // Title row
  ws.mergeCells('A1:I1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'بانک رسانه - لیست برنامه‌ها';
  titleCell.font = { name: 'Tahoma', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0A0A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 36;
  
  // Subtitle row
  ws.mergeCells('A2:I2');
  const subCell = ws.getCell('A2');
  subCell.value = `Total: ${programs.length} programs  •  Generated: ${new Date().toLocaleString('en-US')}`;
  subCell.font = { name: 'Tahoma', size: 10, color: { argb: 'FFA1A1AA' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF141414' } };
  subCell.alignment = { horizontal: 'center' };
  ws.getRow(2).height = 22;
  
  // Header row
  const headers = ['#', 'Title', 'Title (EN)', 'Genre', 'Duration (min)', 'Episodes', 'Viewers', 'Producer', 'Status'];
  const headerRow = ws.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Tahoma', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22C55E' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF15803D' } },
      bottom: { style: 'thin', color: { argb: 'FF15803D' } },
      left: { style: 'thin', color: { argb: 'FF15803D' } },
      right: { style: 'thin', color: { argb: 'FF15803D' } },
    };
  });
  
  // Data rows
  programs.forEach((p, idx) => {
    const row = ws.addRow([
      idx + 1,
      p.title,
      p.titleEn || '',
      p.genre?.nameEn || '',
      p.duration || 0,
      p.episodeCount || 1,
      p.viewersCount || 0,
      p.producer || '',
      p.status,
    ]);
    
    // Alternating row colors
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      });
    }
    
    row.eachCell((cell) => {
      cell.font = { name: 'Tahoma', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFD4D4D4' } },
      };
    });
    
    // Highlight viewers count
    const viewersCell = row.getCell(7);
    if (p.viewersCount && p.viewersCount > 0) {
      viewersCell.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FF15803D' } };
    }
  });
  
  // Column widths
  ws.columns = [
    { width: 6 },
    { width: 40 },
    { width: 28 },
    { width: 18 },
    { width: 14 },
    { width: 10 },
    { width: 12 },
    { width: 22 },
    { width: 12 },
  ];
  
  // Freeze panes (header)
  ws.views = [{ rightToLeft: true, showGridLines: false, state: 'frozen', ySplit: 3 }];
  
  // Auto filter
  ws.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3 + programs.length, column: headers.length },
  };
  
  // ===== Sheet 2: Summary by Genre =====
  const ws2 = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: 'FF3B82F6' } },
    views: [{ rightToLeft: true }],
  });
  
  ws2.mergeCells('A1:D1');
  const t2 = ws2.getCell('A1');
  t2.value = 'Summary by Genre';
  t2.font = { name: 'Tahoma', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0A0A' } };
  t2.alignment = { horizontal: 'center' };
  ws2.getRow(1).height = 30;
  
  const h2 = ws2.addRow(['Genre', 'Count', 'Total Viewers', 'Avg Duration']);
  h2.height = 26;
  h2.eachCell((cell) => {
    cell.font = { name: 'Tahoma', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
    cell.alignment = { horizontal: 'center' };
  });
  
  // Group by genre
  const genreMap = new Map<string, { count: number; viewers: number; totalDuration: number }>();
  programs.forEach(p => {
    const g = p.genre?.nameEn || 'Unknown';
    if (!genreMap.has(g)) {
      genreMap.set(g, { count: 0, viewers: 0, totalDuration: 0 });
    }
    const entry = genreMap.get(g)!;
    entry.count++;
    entry.viewers += p.viewersCount || 0;
    entry.totalDuration += p.duration || 0;
  });
  
  genreMap.forEach((v, k) => {
    const row = ws2.addRow([
      k,
      v.count,
      v.viewers,
      v.count > 0 ? Math.round(v.totalDuration / v.count) : 0,
    ]);
    row.eachCell((cell) => {
      cell.font = { name: 'Tahoma', size: 10 };
      cell.alignment = { horizontal: 'center' };
    });
  });
  
  ws2.columns = [{ width: 25 }, { width: 10 }, { width: 15 }, { width: 15 }];
  
  return await workbook.xlsx.writeBuffer() as ArrayBuffer;
}
