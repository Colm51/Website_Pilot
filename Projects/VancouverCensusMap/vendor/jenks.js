/*
 * Natural-breaks classification adapted from the established Simple Statistics
 * Jenks implementation (ISC license):
 * https://github.com/simple-statistics/simple-statistics
 *
 * This small browser build exposes only ss.ckmeans(), the API needed by the map.
 * It uses the standard Jenks dynamic-programming variance minimization and
 * returns the resulting value clusters.
 */
(function (root) {
  "use strict";

  function matrices(data, classCount) {
    var lower = [];
    var variance = [];
    var i;
    var j;

    for (i = 0; i <= data.length; i += 1) {
      lower.push(new Array(classCount + 1).fill(0));
      variance.push(new Array(classCount + 1).fill(0));
    }

    for (i = 1; i <= classCount; i += 1) {
      lower[1][i] = 1;
      variance[1][i] = 0;
      for (j = 2; j <= data.length; j += 1) {
        variance[j][i] = Infinity;
      }
    }

    for (var length = 2; length <= data.length; length += 1) {
      var sum = 0;
      var sumSquares = 0;
      var weight = 0;
      var currentVariance = 0;

      for (var offset = 1; offset <= length; offset += 1) {
        var lowerLimit = length - offset + 1;
        var value = data[lowerLimit - 1];
        weight += 1;
        sum += value;
        sumSquares += value * value;
        currentVariance = sumSquares - (sum * sum) / weight;
        var previous = lowerLimit - 1;

        if (previous !== 0) {
          for (j = 2; j <= classCount; j += 1) {
            var candidate = currentVariance + variance[previous][j - 1];
            if (variance[length][j] >= candidate) {
              lower[length][j] = lowerLimit;
              variance[length][j] = candidate;
            }
          }
        }
      }
      lower[length][1] = 1;
      variance[length][1] = currentVariance;
    }

    return lower;
  }

  function ckmeans(values, classCount) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error("ckmeans requires at least one numeric value");
    }
    if (!Number.isInteger(classCount) || classCount < 1) {
      throw new Error("classCount must be a positive integer");
    }
    var data = values.slice().sort(function (a, b) { return a - b; });
    var uniqueCount = new Set(data).size;
    if (classCount > uniqueCount) {
      throw new Error("classCount cannot exceed the number of unique values");
    }
    if (data.some(function (value) { return !Number.isFinite(value); })) {
      throw new Error("ckmeans accepts finite numbers only");
    }

    var lower = matrices(data, classCount);
    var clusters = new Array(classCount);
    var right = data.length;

    for (var cluster = classCount; cluster >= 1; cluster -= 1) {
      var left = cluster === 1 ? 0 : lower[right][cluster] - 1;
      clusters[cluster - 1] = data.slice(left, right);
      right = left;
    }
    return clusters;
  }

  root.ss = Object.freeze({ ckmeans: ckmeans });
})(window);
