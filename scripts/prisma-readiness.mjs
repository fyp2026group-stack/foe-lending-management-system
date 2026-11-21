import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const src = join(root, 'src');
const patterns = [
  // Deliberate SQL business-RPC calls anywhere in the runtime source tree.
  /\b(?:SELECT|PERFORM|CALL)\s+lab\.[a-z][a-z0-9_]*\s*\(/gi,
  /\blab\.(?:identity_call|admin_governance|inventory_call|lending_call(?:_[a-z0-9_]+)?|google_student_(?:login|register|options)|admin_report|login_(?:start|finish)|admin_hash_admit|denial(?:_summary)?)\s*\(/gi,
  /\$queryRawUnsafe\s*\(/g,
  /\$executeRawUnsafe\s*\(/g,
  /\bclient\.query\s*\(/g,
];
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    // Prisma-generated documentation includes raw-query examples, not runtime
    // business calls. This ignored output can remain from an older generator.
    if (path === join(src, 'generated', 'prisma')) return [];
    return entry.isDirectory()
      ? files(path)
      : /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [path] : [];
  });
}
const found = [];
for (const file of files(src)) {
  const contents = readFileSync(file, 'utf8');
  for (const [i, line] of contents.split(/\r?\n/).entries()) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(line))
        found.push(`${relative(root, file)}:${i + 1}: ${line.trim().slice(0, 180)}`);
    }
  }
}
console.log(`Prisma native-service readiness: ${found.length} legacy SQL invocation sites remain.`);
for (const item of found) console.log(item);
if (process.argv.includes('--enforce') && found.length) process.exitCode = 1;
