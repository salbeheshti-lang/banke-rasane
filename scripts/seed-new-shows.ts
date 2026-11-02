// ============================================================================
// SEED SCRIPT — Adds 449 new programs to DB + JSON file
// ============================================================================
import { Database } from 'bun:sqlite';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { allNewShows as part1 } from './seed-data-part1';
import { polisiShows, ramazanShows } from './seed-data-part2';
import { safarShows, madreseShows, naghdShows, ghanunShows, pakhshShows, jasoosiShows } from './seed-data-part3';
import { zandanShows, ehdaShows } from './seed-data-part4';
import { tarikhiShows, radioShows } from './seed-data-part5';
import { rustaShows } from './seed-data-part6';
import { ketabShows } from './seed-data-part7';
import { sarmayeShows } from './seed-data-part8';
import type { NewShow } from './seed-data-part1';

const DB_PATH = '/home/z/my-project/mini-services/api-service/bankresaneh.sqlite';
const JSON_PATH = '/home/z/my-project/public/talk-shows-data.json';

const allNewShows: NewShow[] = [
  ...part1,
  ...polisiShows,
  ...ramazanShows,
  ...safarShows,
  ...madreseShows,
  ...naghdShows,
  ...ghanunShows,
  ...pakhshShows,
  ...jasoosiShows,
  ...zandanShows,
  ...ehdaShows,
  ...tarikhiShows,
  ...radioShows,
  ...rustaShows,
  ...ketabShows,
  ...sarmayeShows,
];

console.log(`📦 Total new shows to seed: ${allNewShows.length}`);

// Validate num uniqueness
const nums = new Set<number>();
const dupNums: number[] = [];
for (const s of allNewShows) {
  if (nums.has(s.num)) dupNums.push(s.num);
  nums.add(s.num);
}
if (dupNums.length > 0) {
  console.error(`❌ Duplicate nums found: ${dupNums.join(', ')}`);
  process.exit(1);
}

// Validate names are non-empty
const emptyNames = allNewShows.filter(s => !s.name || s.name.trim().length === 0);
if (emptyNames.length > 0) {
  console.error(`❌ Empty names found: ${emptyNames.length} shows`);
  process.exit(1);
}

console.log(`✅ Validation passed. Num range: ${Math.min(...allNewShows.map(s => s.num))} - ${Math.max(...allNewShows.map(s => s.num))}`);

// Category breakdown
const catBreakdown: Record<string, number> = {};
for (const s of allNewShows) {
  catBreakdown[s.category] = (catBreakdown[s.category] || 0) + 1;
}
console.log('\n📊 Category breakdown:');
for (const [c, n] of Object.entries(catBreakdown)) {
  console.log(`   ${c}: ${n}`);
}

// ---------------------------------------------------------------------------
// 1) UPDATE JSON FILE
// ---------------------------------------------------------------------------
console.log('\n📝 Updating JSON file...');
const existingJson = JSON.parse(readFileSync(JSON_PATH, 'utf-8')) as any[];
console.log(`   Existing shows in JSON: ${existingJson.length}`);

// Build map of existing nums to skip duplicates
const existingNums = new Set(existingJson.map(s => s.num));
const toAddToJson = allNewShows.filter(s => !existingNums.has(s.num));
console.log(`   New shows to add to JSON: ${toAddToJson.length}`);

// Convert NewShow to JSON record format (matching existing structure)
function toJsonRecord(s: NewShow): any {
  const r: any = {
    num: s.num,
    name: s.name,
    category: s.category,
    source: s.source || 'متن',
    size: s.size || '',
    viewers: s.viewers || '',
    style: s.style || '',
    effects: s.effects || '',
    layout: s.layout || '',
    elements: s.elements || '',
    materials: s.materials || '',
    colors: s.colors || '',
    lighting: s.lighting || '',
    summary: s.summary || '',
    descriptionFa: s.descriptionFa || s.summary || '',
    youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(s.name)}`,
    imdb: `https://www.imdb.com/find?q=${encodeURIComponent(s.name)}`,
    wikipedia: `https://fa.wikipedia.org/w/index.php?search=${encodeURIComponent(s.name)}`,
    socialPost: `🎬 ${s.name}\n\n📝 ${s.summary || ''}\n\n🏷 ${s.category}\n\n#بانک_رسانه #${s.category.replace(/\s+/g, '_')}`,
  };
  if (s.tags && s.tags.length > 0) r.tags = s.tags;
  if (s.isFilm) r.isFilm = true;
  return r;
}

const newJsonRecords = toAddToJson.map(toJsonRecord);
const mergedJson = [...existingJson, ...newJsonRecords].sort((a, b) => a.num - b.num);
writeFileSync(JSON_PATH, JSON.stringify(mergedJson, null, 2), 'utf-8');
console.log(`   ✅ JSON file updated. Total: ${mergedJson.length} shows`);

// ---------------------------------------------------------------------------
// 2) UPDATE DATABASE
// ---------------------------------------------------------------------------
console.log('\n💾 Updating database...');
const db = new Database(DB_PATH);

// Check existing
const existingDb = db.prepare("SELECT num FROM shows WHERE num >= 561").all() as any[];
const existingDbNums = new Set(existingDb.map(r => r.num));
console.log(`   Existing shows in DB with num >= 561: ${existingDbNums.size}`);

const SHOW_COLUMNS = [
  'num', 'name', 'category', 'source', 'size', 'viewers', 'style', 'effects',
  'layout', 'elements', 'materials', 'colors', 'lighting', 'summary', 'descriptionFa',
  'youtube', 'imdb', 'wikipedia', 'socialPost', 'images', 'videos', 'is_film', 'tags',
];

function showToValues(s: NewShow): any[] {
  return [
    s.num, s.name, s.category, s.source || 'متن',
    s.size || '', s.viewers || '', s.style || '', s.effects || '',
    s.layout || '', s.elements || '', s.materials || '', s.colors || '',
    s.lighting || '', s.summary || '',
    s.descriptionFa || s.summary || '',
    `https://www.youtube.com/results?search_query=${encodeURIComponent(s.name)}`,
    `https://www.imdb.com/find?q=${encodeURIComponent(s.name)}`,
    `https://fa.wikipedia.org/w/index.php?search=${encodeURIComponent(s.name)}`,
    `🎬 ${s.name}\n\n📝 ${s.summary || ''}\n\n🏷 ${s.category}\n\n#بانک_رسانه #${s.category.replace(/\s+/g, '_')}`,
    '[]', '[]', s.isFilm ? 1 : 0,
    JSON.stringify(s.tags || []),
  ];
}

const insertStmt = db.prepare(
  `INSERT OR REPLACE INTO shows (${SHOW_COLUMNS.join(', ')}) VALUES (${SHOW_COLUMNS.map(() => '?').join(', ')})`
);

// Use a transaction for speed
db.exec('BEGIN IMMEDIATE');
try {
  let added = 0, skipped = 0;
  for (const s of allNewShows) {
    if (existingDbNums.has(s.num)) { skipped++; continue; }
    insertStmt.run(...showToValues(s));
    added++;
  }
  db.exec('COMMIT');
  console.log(`   ✅ DB inserted: ${added}, skipped (already existed): ${skipped}`);
} catch (e) {
  db.exec('ROLLBACK');
  console.error(`❌ DB transaction failed:`, e);
  process.exit(1);
}

// Rebuild FTS index to make new shows searchable
console.log('\n🔍 Rebuilding FTS index...');
try {
  db.exec("INSERT INTO shows_fts(shows_fts) VALUES ('rebuild')");
  console.log('   ✅ FTS index rebuilt');
} catch (e: any) {
  console.warn('   ⚠ FTS rebuild failed (may need manual rebuild):', e.message);
}

// Final verification
const finalCount = db.prepare("SELECT COUNT(*) as c FROM shows").get() as any;
const newCount = db.prepare("SELECT COUNT(*) as c FROM shows WHERE num >= 561").get() as any;
console.log(`\n📈 Final DB stats:`);
console.log(`   Total shows: ${finalCount.c}`);
console.log(`   New shows (num >= 561): ${newCount.c}`);

db.close();
console.log('\n🎉 Seed completed successfully!');
