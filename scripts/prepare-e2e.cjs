/* eslint @typescript-eslint/no-require-imports: off */
const fs = require('node:fs');
const path = require('node:path');

const dir = path.resolve(__dirname, '..', '.e2e');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
fs.writeFileSync(path.join(dir, 'seed.json'), '[]', 'utf8');
console.log('Prepared isolated E2E API database and empty seed archive.');
