import { readFileSync, writeFileSync } from 'node:fs';

const path = process.argv[2] ?? 'prisma/schema.prisma';
const schema = readFileSync(path, 'utf8');
const start = schema.indexOf('model inv_assets {');
const end = schema.indexOf('\n}', start);
if (start === -1 || end === -1) {
  throw new Error('Expected inv_assets model missing from introspected database.');
}
const asset = schema.slice(start, end);
const oneToOne = /(^\s*inv_cells\s+)inv_cells\?(\s*$)/m;
const alreadyMany = /^\s*inv_cells\s+inv_cells\[\]\s*$/m;
if (alreadyMany.test(asset)) {
  console.log('Composite asset-to-cell relation already corrected.');
} else {
  if (!oneToOne.test(asset)) {
    throw new Error('Unexpected inv_assets relation shape; manual review required.');
  }
  const repaired = asset.replace(oneToOne, '$1inv_cells[]$2');
  const result = schema.slice(0, start) + repaired + schema.slice(end);
  writeFileSync(path, result);
  console.log('Mapped asset-to-stock-cell as many-to-one without inventing a UNIQUE constraint.');
}
