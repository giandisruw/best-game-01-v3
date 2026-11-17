// EMBERDEEP — seeded random numbers.
// One clear job: a small deterministic generator (mulberry32) plus the
// helpers the world uses, so every run and every screenshot scene replays
// exactly from its seed.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // float in [min, max)
    range(min, max) {
      return min + next() * (max - min);
    },
    // integer in [min, max]
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    // pick one element of an array
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    // true with probability p
    chance(p) {
      return next() < p;
    },
    // Fisher-Yates shuffle, returns a new array
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
  };
}
