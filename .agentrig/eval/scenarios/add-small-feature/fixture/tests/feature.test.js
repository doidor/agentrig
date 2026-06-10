import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/slugify.js";

// Acceptance tests for SPEC.md. They are intentionally `.skip`-ped at the start;
// the producer must un-skip them AND make them pass.

test.skip("slugify: lowercases and replaces punctuation", () => {
  assert.equal(slugify("Hello, World!"), "hello-world");
});

test.skip("slugify: collapses whitespace runs", () => {
  assert.equal(slugify("  Two   spaces  "), "two-spaces");
});

test.skip("slugify: replaces underscores with dashes", () => {
  assert.equal(slugify("snake_case_words"), "snake-case-words");
});

test.skip("slugify: collapses and trims dashes", () => {
  assert.equal(slugify("---weird---"), "weird");
});

test.skip("slugify: empty in -> empty out", () => {
  assert.equal(slugify(""), "");
});

test.skip("slugify: non-string throws TypeError", () => {
  assert.throws(() => slugify(null), TypeError);
  assert.throws(() => slugify(undefined), { name: "TypeError", message: /input must be a string/ });
});
