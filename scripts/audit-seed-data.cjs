const fs = require('node:fs');
const path = require('node:path');

const file = path.resolve(__dirname, '..', 'public', 'talk-shows-data.json');
const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(rows)) throw new Error('Seed data root must be an array.');

const seen = new Set();
const duplicateNums = [];
const missingNames = [];
const missingCategories = [];
const invalidNums = [];
for (const [index, row] of rows.entries()) {
  const num = Number(row?.num);
  if (!Number.isInteger(num) || num <= 0) invalidNums.push(index + 1);
  else if (seen.has(num)) duplicateNums.push(num);
  else seen.add(num);
  if (typeof row?.name !== 'string' || !row.name.trim()) missingNames.push(index + 1);
  if (typeof row?.category !== 'string' || !row.category.trim()) missingCategories.push(index + 1);
}

const nums = rows.map(row => Number(row?.num)).filter(Number.isInteger);
const report = {
  file: 'public/talk-shows-data.json',
  count: rows.length,
  uniqueIds: seen.size,
  minId: nums.length ? Math.min(...nums) : null,
  maxId: nums.length ? Math.max(...nums) : null,
  duplicateIds: duplicateNums,
  invalidIdRows: invalidNums.slice(0, 20),
  missingNameRows: missingNames.slice(0, 20),
  missingCategoryRows: missingCategories.slice(0, 20),
};
console.log(JSON.stringify(report, null, 2));

if (rows.length < 1302) throw new Error('Seed dataset regressed below the verified 1,302-show baseline.');
if (duplicateNums.length || invalidNums.length || missingNames.length || missingCategories.length) {
  throw new Error('Seed data integrity validation failed.');
}
