import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESLint } from 'eslint';

test('lint discovers invalid nested TypeScript on Windows and preserves exclusions', async () => {
  const lint = new ESLint();
  const [result] = await lint.lintText('export const probe: any = 1;\n', {
    filePath: 'src/components/nested/lint-probe.ts',
  });
  assert.ok(result.messages.some(message => message.ruleId === '@typescript-eslint/no-explicit-any'));
  for (const file of ['.next/probe.ts', '.cache/probe.ts', 'coverage/probe.ts', 'next-env.d.ts']) {
    assert.equal(await lint.isPathIgnored(file), true, file);
  }
  assert.equal(await lint.isPathIgnored('src/components/panel.tsx'), false);
});
