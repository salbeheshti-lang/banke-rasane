/* eslint @typescript-eslint/no-require-imports: off */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');

async function main() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('آرشیو برنامه‌ها', {
    views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }],
  });
  sheet.columns = [
    { header: 'شماره', key: 'num', width: 12 },
    { header: 'نام برنامه', key: 'name', width: 28 },
    { header: 'دسته‌بندی', key: 'category', width: 20 },
  ];
  sheet.addRow({ num: 1, name: 'برنامه آزمایشی', category: 'گفتگو' });
  const xlsx = Buffer.from(await workbook.xlsx.writeBuffer());
  assert.equal(xlsx.subarray(0, 2).toString('hex'), '504b', 'XLSX is a ZIP-based OOXML package');
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(xlsx);
  assert.equal(reopened.getWorksheet('آرشیو برنامه‌ها').getCell('B2').value, 'برنامه آزمایشی');
  assert.equal(reopened.getWorksheet('آرشیو برنامه‌ها').views[0].rightToLeft, true);
  console.log('PASS real XLSX generation, Persian values, and RTL worksheet metadata');

  const clientLogoPath = path.join(__dirname, '..', 'public', 'client-logo.png');
  const clientLogo = fs.readFileSync(clientLogoPath);
  assert.equal(clientLogo.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Commissioning logo is a valid PNG asset');
  const whiteClientLogo = fs.readFileSync(path.join(__dirname, '..', 'public', 'client-logo-white.png'));
  assert.equal(whiteClientLogo.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'White commissioning logo is a valid PNG asset');
  const clientLogoDataUrl = `data:image/png;base64,${clientLogo.toString('base64')}`;
  const htmlPdfRoute = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'api', 'export-pdf', 'route.ts'), 'utf8');
  assert.match(htmlPdfRoute, /\.print-footer\s*\{\s*display:\s*none;\s*\}/, 'HTML report footer is hidden on screen');
  assert.match(htmlPdfRoute, /@media print[\s\S]*?\.print-footer\s*\{\s*display:\s*flex/, 'HTML report footer is visible only when printing');
  console.log('PASS co-branding PNG asset and print-only HTML footer guards');

  const pdfModule = require('@digicole/pdfmake-rtl');
  const pdfMake = pdfModule.default || pdfModule;
  const virtualFonts = require('@digicole/pdfmake-rtl/build/vfs_fonts');
  for (const [filename, base64] of Object.entries(virtualFonts)) {
    pdfMake.virtualfs.writeFileSync(filename, Buffer.from(base64, 'base64'));
  }
  pdfMake.addFonts({
    Cairo: { normal: 'Cairo-Regular.ttf', bold: 'Cairo-Bold.ttf', italics: 'Cairo-Light.ttf', bolditalics: 'Cairo-SemiBold.ttf' },
    Roboto: { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf', italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-MediumItalic.ttf' },
  });
  const pdf = await pdfMake.createPdf({
    rtl: true,
    pageSize: 'A4',
    footer: () => ({
      columns: [
        { text: 'مانیتورینگ مرکز طرح و برنامه سیما', fontSize: 8, alignment: 'right' },
        { image: clientLogoDataUrl, width: 16, alignment: 'left' },
      ],
    }),
    content: [
      { image: clientLogoDataUrl, width: 28, alignment: 'center' },
      { text: 'بانک رسانه', fontSize: 20, bold: true },
      { text: 'تهیه‌شده برای: مانیتورینگ مرکز طرح و برنامه سیما', fontSize: 10, alignment: 'center' },
      { text: 'آزمون تولید فایل PDF فارسی', fontSize: 12 },
      { table: { widths: ['*', '*'], body: [['نام برنامه', 'دسته‌بندی'], ['برنامه آزمایشی', 'گفتگو']] } },
    ],
  }).getBuffer();
  const pdfBuffer = Buffer.from(pdf);
  assert.equal(pdfBuffer.subarray(0, 4).toString(), '%PDF', 'PDF output has a valid binary signature');
  assert.ok(pdfBuffer.length > 1000, 'PDF output contains a non-empty document');
  console.log('PASS binary PDF generation with Persian RTL text');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
