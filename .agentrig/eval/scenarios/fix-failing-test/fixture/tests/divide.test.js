import { test } from "node:test";
import assert from "node:assert/strict";
import { divide } from "../src/math.js";

test("divide: returns quotient", () => {
  assert.equal(divide(10, 2), 5);
});

test("divide: divide by zero throws", () => {
  assert.throws(() => divide(1, 0), /divide by zero/i);
});
