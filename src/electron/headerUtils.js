// Helper utilities for header trimming and sliding-window detection
function compactHeaders(rawHeaders, opts = {}) {
  const cfg = Object.assign(
    {
      enableTrim: true,
      useSlidingWindow: true,
      slidingWindowSize: 10,
      slidingDensityThreshold: 0.25,
    },
    opts || {}
  );

  const N = rawHeaders.length;
  const nonEmptyMask = rawHeaders.map((v) =>
    v != null && String(v).trim() !== "" ? 1 : 0
  );
  const totalNonEmpty = nonEmptyMask.reduce((a, b) => a + b, 0);

  if (!cfg.enableTrim || totalNonEmpty === 0) {
    // build headers from full range
    const headers = [];
    const seen = new Set();
    for (let i = 0; i < N; i++) {
      let val = rawHeaders[i] || `__EMPTY_${i}`;
      let cand = val;
      let dup = 1;
      while (seen.has(cand)) {
        cand = `${val} (${dup})`;
        dup++;
      }
      seen.add(cand);
      headers.push(cand);
    }
    return { headers, firstCol: 0, lastCol: N - 1 };
  }

  // Find minimal contiguous span containing any non-empty values
  let firstNonEmpty = -1,
    lastNonEmpty = -1;
  for (let i = 0; i < N; i++) {
    if (nonEmptyMask[i]) {
      if (firstNonEmpty === -1) firstNonEmpty = i;
      lastNonEmpty = i;
    }
  }

  if (firstNonEmpty === -1) {
    return { headers: [], firstCol: 0, lastCol: N - 1 };
  }

  // Try sliding window to find densest block
  if (cfg.useSlidingWindow) {
    const W = Math.min(cfg.slidingWindowSize, N);
    let bestStart = 0,
      bestCount = -1;
    let windowCount = 0;
    // initial window
    for (let i = 0; i < W; i++) windowCount += nonEmptyMask[i];
    bestCount = windowCount;
    for (let s = 1; s <= N - W; s++) {
      windowCount = windowCount - nonEmptyMask[s - 1] + nonEmptyMask[s + W - 1];
      if (windowCount > bestCount) {
        bestCount = windowCount;
        bestStart = s;
      }
    }

    const density = bestCount / W;
    if (density >= cfg.slidingDensityThreshold) {
      // use this window, but expand to include any adjacent non-empty columns just outside
      let s = bestStart,
        e = bestStart + W - 1;
      while (s > 0 && nonEmptyMask[s - 1]) s--;
      while (e < N - 1 && nonEmptyMask[e + 1]) e++;
      // build headers for s..e
      const headers = [];
      const seen = new Set();
      let emptyCounter = 0;
      for (let i = s; i <= e; i++) {
        let val = rawHeaders[i];
        if (!val) {
          val = emptyCounter === 0 ? "__EMPTY" : `__EMPTY_${emptyCounter}`;
          emptyCounter++;
        }
        let cand = val;
        let dup = 1;
        while (seen.has(cand)) {
          cand = `${val} (${dup})`;
          dup++;
        }
        seen.add(cand);
        headers.push(cand);
      }
      return { headers, firstCol: s, lastCol: e };
    }
  }

  // Fallback: use minimal contiguous span
  const s = firstNonEmpty,
    e = lastNonEmpty;
  const headers = [];
  const seen = new Set();
  let emptyCounter = 0;
  for (let i = s; i <= e; i++) {
    let val = rawHeaders[i];
    if (!val) {
      val = emptyCounter === 0 ? "__EMPTY" : `__EMPTY_${emptyCounter}`;
      emptyCounter++;
    }
    let cand = val;
    let dup = 1;
    while (seen.has(cand)) {
      cand = `${val} (${dup})`;
      dup++;
    }
    seen.add(cand);
    headers.push(cand);
  }
  return { headers, firstCol: s, lastCol: e };
}

module.exports = { compactHeaders };
