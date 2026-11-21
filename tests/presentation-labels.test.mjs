import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayLabel, personLabel } from '../src/components/display-labels.ts';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString('base64');
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const { readSession } = await import(moduleUrl(read('../src/components/identity/api.ts').replace('../display-labels', moduleUrl(read('../src/components/display-labels.ts')))));


test('equipment labels preserve exact supplied names including UUIDs and generic nouns', () => {
  for (const name of ['Equipment 5c362a93-ea83-4f7f-97dc-12f29c9c0f07', 'Equipment', 'Lab', 'Oscilloscope:']) {
    assert.equal(displayLabel(name, 'Equipment name unavailable'), name);
  }
  for (const name of [null, undefined, '', '  ', 'null', ' NULL ', 'undefined']) {
    assert.equal(displayLabel(name, 'Equipment name unavailable'), 'Equipment name unavailable');
  }
});

test('session presentation falls back to email without changing supplied account data', () => {
  for (const displayName of [null, 'null', ' undefined ', '']) {
    const original = { user: { id: 'officer', displayName, email: 'officer@example.invalid', roles: ['TECHNICAL_OFFICER'] }, csrfToken: 'token' };
    const session = readSession(original);
    assert.equal(session.user.displayName, 'officer@example.invalid');
    assert.equal(original.user.displayName, displayName);
    assert.equal(session.csrfToken, original.csrfToken);
    assert.deepEqual(session.user.roles, original.user.roles);
  }
  assert.equal(personLabel({ displayName: 'null', name: 'Technician', email: 'officer@example.invalid' }), 'Technician');
  assert.equal(personLabel({}), 'Name unavailable');
  assert.equal(personLabel({ displayName: 'Actual Name' }), 'Actual Name');
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('report failure renders unavailable instead of a successful empty result', async () => {
  const source = read('../src/components/hod-admin/workspace.tsx');
  const branch = source.slice(source.indexOf('{error ? (', source.indexOf('function Reports')), source.indexOf('<div className="admin-pagination">', source.indexOf('function Reports'))).trim();
  const component = `import {jsx as _jsx} from 'react/jsx-runtime';
    function Empty({title,detail}) { return <section><h2>{title}</h2><p>{detail}</p></section>; }
    function Skeleton(){return <div>Loading</div>;}
    export function View({error,current,result}) { return <div>${branch}</div>; }`;
  const output = ts.transpileModule(component, { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime'))).replaceAll("'react/jsx-runtime'", JSON.stringify(import.meta.resolve('react/jsx-runtime')));
  const { View } = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));
  const failed = renderToStaticMarkup(createElement(View, {error:'HTTP 503',current:{error:'HTTP 503'}}));
  assert.match(failed, /Report unavailable/);
  assert.doesNotMatch(failed, /No report records/);
  const empty = renderToStaticMarkup(createElement(View, {current:{},result:{items:[],total:0}}));
  assert.match(empty, /No report records/);
  const loading = renderToStaticMarkup(createElement(View, {}));
  assert.match(loading, /Loading/);
});

test('completion indicator is unnumbered while entry steps retain their sequence', async () => {
  const source = read('../src/components/lending/request-builder.tsx');
  const progress = source.slice(source.indexOf('const stepNames'), source.indexOf('const toLocal'));
  const output = ts.transpileModule(`import {jsx} from 'react/jsx-runtime'; function Check(){return <i>Done</i>;} ${progress}; export {RequestProgress};`, {compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText.replaceAll('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime'))).replaceAll("'react/jsx-runtime'",JSON.stringify(import.meta.resolve('react/jsx-runtime')));
  const {RequestProgress} = await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
  const html = renderToStaticMarkup(createElement(RequestProgress,{current:0}));
  assert.match(html,/Equipment/);
  assert.match(html,/Complete/);
  assert.doesNotMatch(html,/>4<\/span>/);
  assert.equal((html.match(/aria-current="step"/g)||[]).length,1);
});
