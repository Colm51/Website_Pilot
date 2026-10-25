"use strict";

const assert = require("node:assert/strict");
const { shareClass, voteRadius, voteBreaks, voteClass, jaccardIndex } = require("../map.js");

assert.equal(shareClass(null), -1);
assert.equal(shareClass(0), 0);
assert.equal(shareClass(0.1), 1);
assert.equal(shareClass(0.499), 4);
assert.equal(shareClass(0.5), 5);

assert.equal(voteRadius(0, 100, 25), 0);
assert.equal(voteRadius(100, 100, 25), 25);
assert.equal(voteRadius(25, 100, 25), 12.5);
assert.equal(
  Math.PI * Math.pow(voteRadius(25, 100, 25), 2) /
    (Math.PI * Math.pow(voteRadius(100, 100, 25), 2)),
  0.25
);

assert.deepEqual(voteBreaks(100), [0, 25, 50, 75, 100]);
assert.equal(voteClass(0, 100), 0);
assert.equal(voteClass(24, 100), 0);
assert.equal(voteClass(25, 100), 1);
assert.equal(voteClass(74, 100), 2);
assert.equal(voteClass(75, 100), 3);
assert.equal(voteClass(100, 100), 3);

assert.equal(jaccardIndex(new Set([1, 2]), new Set([2, 3])), 1 / 3);
assert.equal(jaccardIndex(new Set(), new Set()), 0);

console.log("Map utility tests passed.");
