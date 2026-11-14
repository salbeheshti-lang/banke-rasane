import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allNewShows as part1 } from './seed-data-part1';
import { polisiShows, ramazanShows } from './seed-data-part2';
import { safarShows, madreseShows, naghdShows, ghanunShows, pakhshShows, jasoosiShows } from './seed-data-part3';
import { zandanShows, ehdaShows } from './seed-data-part4';
import { tarikhiShows, radioShows } from './seed-data-part5';
import { rustaShows } from './seed-data-part6';
import { ketabShows } from './seed-data-part7';
import { sarmayeShows } from './seed-data-part8';

const sourceShows = [
  ...part1, ...polisiShows, ...ramazanShows, ...safarShows, ...madreseShows,
  ...naghdShows, ...ghanunShows, ...pakhshShows, ...jasoosiShows, ...zandanShows,
  ...ehdaShows, ...tarikhiShows, ...radioShows, ...rustaShows, ...ketabShows, ...sarmayeShows,
];
const scriptDir = dirname(fileURLToPath(import.meta.url));
const jsonPath = resolve(scriptDir, '../public/talk-shows-data.json');
const archive = JSON.parse(readFileSync(jsonPath, 'utf8'));
if (!Array.isArray(archive)) throw new Error('Archive seed JSON root must be an array.');

const sourceIds = new Set<number>();
const duplicateSourceIds: number[] = [];
for (const show of sourceShows) {
  if (sourceIds.has(show.num)) duplicateSourceIds.push(show.num);
  sourceIds.add(show.num);
}
const archiveById = new Map(archive.map((show: any) => [Number(show.num), show]));
const missingFromArchive = sourceShows.filter(show => !archiveById.has(show.num));
const mismatchedRecords = sourceShows.filter(show => {
  const current = archiveById.get(show.num) as any;
  return current && (current.name !== show.name || current.category !== show.category);
});

const report = {
  bundledArchiveCount: archive.length,
  sourceSeedCount: sourceShows.length,
  uniqueSourceIds: sourceIds.size,
  sourceIdsMissingFromArchive: missingFromArchive.length,
  missingIds: missingFromArchive.slice(0, 30).map(show => show.num),
  sourceRecordsWithNameOrCategoryDrift: mismatchedRecords.length,
  driftExamples: mismatchedRecords.slice(0, 10).map(show => ({
    num: show.num,
    sourceName: show.name,
    archiveName: (archiveById.get(show.num) as any)?.name,
    sourceCategory: show.category,
    archiveCategory: (archiveById.get(show.num) as any)?.category,
  })),
  duplicateSourceIds,
};
console.log(JSON.stringify(report, null, 2));

if (duplicateSourceIds.length || missingFromArchive.length) {
  throw new Error('The bundled archive does not contain every program from the checked-in seed source files.');
}
