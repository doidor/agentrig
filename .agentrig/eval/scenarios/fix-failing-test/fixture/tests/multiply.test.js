import { test } from "node:test";
import assert from "node:assert/strict";
import { multiply } from "../src/math.js";

test("multiply: 2 * 3 = 6", () => {
  assert.equal(multiply(2, 3), 6);
});
