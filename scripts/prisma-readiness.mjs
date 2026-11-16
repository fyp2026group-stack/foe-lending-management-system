import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const src = join(root, 'src', 'lib', 'server');
const exceptions = new Set(['db.ts']);
const patterns = [
  /\blab\.[a-z][a-z0-9_]*\s*\(/gi,
  /\$queryRawUnsafe\s*\(/g,
];
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : entry.name.endsWith('.ts') ? [path] : [];
  });
}
const found = [];
for (const file of files(src)) {
  if (exceptions.has(file.split(/[\\/]/).at(-1))) continue;
  const text = readFileSync(file, 'utf8');
  for (const [i, line] of text.split(/\r?\n/).entries()) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) found.push(`${relative(root, file)}:${i + 1}: ${line.trim().slice(0, 180)}`);
    }
  }
}
console.log(`Prisma native-service readiness: ${found.length} legacy SQL invocation sites remain.`);
for (const item of found) console.log(item);
if (process.argv.includes('--enforce') && found.length) process.exitCode = 1;
