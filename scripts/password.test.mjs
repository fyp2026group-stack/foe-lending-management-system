import {test} from "node:test";
import assert from "node:assert/strict";
import {hashPassword,verifyPassword} from "../src/lib/server/password.mjs";
test("salted hashes differ and verify only correct bounded input",()=>{const p="synthetic-password-123";const a=hashPassword(p);assert.notEqual(a,hashPassword(p));assert.equal(verifyPassword(p,a),true);assert.equal(verifyPassword("wrong",a),false);assert.equal(verifyPassword("x".repeat(129),a),false);assert.equal(verifyPassword(p,"malformed"),false);assert.throws(()=>hashPassword("short"));});

