import { QuantixDeque } from '../src/index';
import Denque from 'denque';
import { Deque as JSSDSLDeque } from 'js-sdsl';

// ─── Benchmark Configuration ──────────────────────────────────────────────────
const ITERATIONS_SMALL = 10_000_000;
const ITERATIONS_LARGE = 1_000_000;
const ITERATIONS_INDEX = 10_000_000;
const ITERATIONS_ITER  = 5_000;
const SLICE_ITERATIONS = 50_000;
const QUEUE_SIZE       = 10_000;
const RUNS             = 7;   // More runs → more stable average

console.log('==================================================');
console.log('     QUANTIX DEQUE — ULTIMATE BENCHMARK v3.0     ');
console.log('==================================================\n');
console.log(`Config: ${RUNS} runs per test, results averaged.\n`);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** JS Array wrapper to present the same API surface as Deque. */
class JSArrayWrapper {
  private arr: any[] = [];
  push(val: any)  { this.arr.push(val); }
  pop()           { return this.arr.pop(); }
  unshift(val: any) { this.arr.unshift(val); }
  shift()         { return this.arr.shift(); }
  get(i: number)  { return this.arr[i]; }
  get length()    { return this.arr.length; }
}

/** js-sdsl wrapper to present the same API surface. */
class JSSDSLWrapper {
  private q = new JSSDSLDeque<any>();
  push(val: any)  { this.q.pushBack(val); }
  pop()           { return this.q.popBack(); }
  unshift(val: any) { this.q.pushFront(val); }
  shift()         { return this.q.popFront(); }
  get(i: number)  { return this.q.getElementByPos(i); }
  get length()    { return this.q.size(); }
}

function hrToMs(ns: bigint): number {
  return Number(ns) / 1_000_000;
}

/**
 * Runs the benchmark function RUNS times and returns the MEDIAN time in ms.
 * Median is more robust than average against GC pauses and OS scheduling noise.
 */
function measure(fn: () => void, runs: number = RUNS): number {
  if (typeof global.gc === 'function') {
    global.gc();
  }
  // Discard first run (JIT warm-up)
  fn();
  const times: number[] = [];
  for (let r = 0; r < runs; r++) {
    if (typeof global.gc === 'function') {
      global.gc();
    }
    const start = process.hrtime.bigint();
    fn();
    times.push(hrToMs(process.hrtime.bigint() - start));
  }
  times.sort((a, b) => a - b);
  // Return median
  const mid = Math.floor(times.length / 2);
  return times.length % 2 !== 0 ? times[mid] : (times[mid - 1] + times[mid]) / 2;
}

function pct(winner: number, loser: number): string {
  return (((loser - winner) / loser) * 100).toFixed(2) + '%';
}

function ops(ms: number, iters: number): string {
  return Math.round(iters / ms * 1000).toLocaleString();
}

// ─── Global JIT warm-up ───────────────────────────────────────────────────────
// Force V8 to JIT-compile all hot functions before any measurement.
{
  const w = new QuantixDeque({ capacity: 1024 });
  for (let i = 0; i < 200_000; i++) { w.push(i); w.shift(); }
  for (let i = 0; i < 200_000; i++) { w.push(i); w.pop(); }
  const wd = new Denque<number>();
  for (let i = 0; i < 200_000; i++) { wd.push(i); wd.shift(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARK 1 · FIFO Queue Cycle (Push & Shift)
// ─────────────────────────────────────────────────────────────────────────────
function runQueueBenchmark() {
  console.log('═══════════════════════════════════════════════');
  console.log('  BENCHMARK 1 · FIFO Queue Cycle (Push+Shift) ');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Queue size: ${QUEUE_SIZE.toLocaleString()}, Cycles: ${ITERATIONS_SMALL.toLocaleString()}\n`);

  // ── Quantix (clearOnPop=false — matches denque behaviour numerically) ──────
  const qdFastTime = measure(() => {
    const qd = new QuantixDeque<number>({ capacity: QUEUE_SIZE, clearOnPop: false });
    for (let i = 0; i < QUEUE_SIZE; i++) qd.push(i);
    for (let i = 0; i < ITERATIONS_SMALL; i++) {
      qd.push(i & 0x7fffffff);
      qd.shift();
    }
  });
  console.log(`  Quantix (Fast/no-clear):  ${qdFastTime.toFixed(2).padStart(9)} ms  [${ops(qdFastTime, ITERATIONS_SMALL)} ops/s]`);

  // ── Quantix (clearOnPop=true — safe, GC-friendly) ─────────────────────────
  const qdSafeTime = measure(() => {
    const qd = new QuantixDeque<number>({ capacity: QUEUE_SIZE, clearOnPop: true });
    for (let i = 0; i < QUEUE_SIZE; i++) qd.push(i);
    for (let i = 0; i < ITERATIONS_SMALL; i++) {
      qd.push(i & 0x7fffffff);
      qd.shift();
    }
  });
  console.log(`  Quantix (Safe/clear):     ${qdSafeTime.toFixed(2).padStart(9)} ms  [${ops(qdSafeTime, ITERATIONS_SMALL)} ops/s]`);

  // ── Denque ────────────────────────────────────────────────────────────────
  const dqTime = measure(() => {
    const dq = new Denque<number>();
    for (let i = 0; i < QUEUE_SIZE; i++) dq.push(i);
    for (let i = 0; i < ITERATIONS_SMALL; i++) {
      dq.push(i & 0x7fffffff);
      dq.shift();
    }
  });
  console.log(`  Denque:                   ${dqTime.toFixed(2).padStart(9)} ms  [${ops(dqTime, ITERATIONS_SMALL)} ops/s]`);

  // ── js-sdsl ───────────────────────────────────────────────────────────────
  const sdslTime = measure(() => {
    const sdsl = new JSSDSLWrapper();
    for (let i = 0; i < QUEUE_SIZE; i++) sdsl.push(i);
    for (let i = 0; i < ITERATIONS_SMALL; i++) {
      sdsl.push(i & 0x7fffffff);
      sdsl.shift();
    }
  });
  console.log(`  js-sdsl:                  ${sdslTime.toFixed(2).padStart(9)} ms  [${ops(sdslTime, ITERATIONS_SMALL)} ops/s]`);

  // ── JS Array (extrapolated, O(n) shift makes it too slow at 10M) ──────────
  const jsIter = 100_000;
  const jsRaw = measure(() => {
    const jsArr = new JSArrayWrapper();
    for (let i = 0; i < QUEUE_SIZE; i++) jsArr.push(i);
    for (let i = 0; i < jsIter; i++) { jsArr.push(i); jsArr.shift(); }
  });
  const jsTime = jsRaw * (ITERATIONS_SMALL / jsIter);
  console.log(`  JS Array (extrapolated):  ${jsTime.toFixed(2).padStart(9)} ms  [${ops(jsTime, ITERATIONS_SMALL)} ops/s]  ⚠ O(n)`);

  const winner = Math.min(qdFastTime, qdSafeTime);
  console.log(`\n  📊 Quantix Fast vs Denque:  ${pct(winner, dqTime)} faster`);
  console.log(`  📊 Quantix Fast vs js-sdsl: ${pct(winner, sdslTime)} faster\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARK 2 · Stack Cycle (Push & Pop)
// ─────────────────────────────────────────────────────────────────────────────
function runStackBenchmark() {
  console.log('═══════════════════════════════════════════════');
  console.log('  BENCHMARK 2 · Stack Cycle (Push+Pop)        ');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Queue size: ${QUEUE_SIZE.toLocaleString()}, Cycles: ${ITERATIONS_SMALL.toLocaleString()}\n`);

  const qdFastTime = measure(() => {
    const qd = new QuantixDeque<number>({ capacity: QUEUE_SIZE, clearOnPop: false });
    for (let i = 0; i < QUEUE_SIZE; i++) qd.push(i);
    for (let i = 0; i < ITERATIONS_SMALL; i++) {
      qd.push(i & 0x7fffffff);
      qd.pop();
    }
  });
  console.log(`  Quantix (Fast):            ${qdFastTime.toFixed(2).padStart(9)} ms  [${ops(qdFastTime, ITERATIONS_SMALL)} ops/s]`);

  const qdSafeTime = measure(() => {
    const qd = new QuantixDeque<number>({ capacity: QUEUE_SIZE, clearOnPop: true });
    for (let i = 0; i < QUEUE_SIZE; i++) qd.push(i);
    for (let i = 0; i < ITERATIONS_SMALL; i++) {
      qd.push(i & 0x7fffffff);
      qd.pop();
    }
  });
  console.log(`  Quantix (Safe):            ${qdSafeTime.toFixed(2).padStart(9)} ms  [${ops(qdSafeTime, ITERATIONS_SMALL)} ops/s]`);

  const dqTime = measure(() => {
    const dq = new Denque<number>();
    for (let i = 0; i < QUEUE_SIZE; i++) dq.push(i);
    for (let i = 0; i < ITERATIONS_SMALL; i++) {
      dq.push(i & 0x7fffffff);
      dq.pop();
    }
  });
  console.log(`  Denque:                    ${dqTime.toFixed(2).padStart(9)} ms  [${ops(dqTime, ITERATIONS_SMALL)} ops/s]`);

  const sdslTime = measure(() => {
    const sdsl = new JSSDSLWrapper();
    for (let i = 0; i < QUEUE_SIZE; i++) sdsl.push(i);
    for (let i = 0; i < ITERATIONS_SMALL; i++) {
      sdsl.push(i & 0x7fffffff);
      sdsl.pop();
    }
  });
  console.log(`  js-sdsl:                   ${sdslTime.toFixed(2).padStart(9)} ms  [${ops(sdslTime, ITERATIONS_SMALL)} ops/s]`);

  const jsArrTime = measure(() => {
    const jsArr = new JSArrayWrapper();
    for (let i = 0; i < QUEUE_SIZE; i++) jsArr.push(i);
    for (let i = 0; i < ITERATIONS_SMALL; i++) {
      jsArr.push(i & 0x7fffffff);
      jsArr.pop();
    }
  });
  console.log(`  JS Array (native):         ${jsArrTime.toFixed(2).padStart(9)} ms  [${ops(jsArrTime, ITERATIONS_SMALL)} ops/s]`);

  const winner = Math.min(qdFastTime, qdSafeTime);
  console.log(`\n  📊 Quantix vs Denque:  ${pct(winner, dqTime)} faster`);
  console.log(`  📊 Quantix vs js-sdsl: ${pct(winner, sdslTime)} faster\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARK 3 · Element Indexing / Random Access
// ─────────────────────────────────────────────────────────────────────────────
function runIndexingBenchmark() {
  console.log('═══════════════════════════════════════════════');
  console.log('  BENCHMARK 3 · Element Indexing (get)        ');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Queue size: ${QUEUE_SIZE.toLocaleString()}, Reads: ${ITERATIONS_INDEX.toLocaleString()}\n`);

  // Pre-generate random indices (avoid rand() overhead in hot loop)
  const readIndices = new Int32Array(ITERATIONS_INDEX);
  for (let i = 0; i < ITERATIONS_INDEX; i++) {
    readIndices[i] = Math.floor(Math.random() * QUEUE_SIZE);
  }

  const qd = new QuantixDeque<number>({ capacity: QUEUE_SIZE });
  for (let i = 0; i < QUEUE_SIZE; i++) qd.push(i);

  const dq = new Denque<number>();
  for (let i = 0; i < QUEUE_SIZE; i++) dq.push(i);

  const sdsl = new JSSDSLDeque<number>();
  for (let i = 0; i < QUEUE_SIZE; i++) sdsl.pushBack(i);

  const jsArr: number[] = [];
  for (let i = 0; i < QUEUE_SIZE; i++) jsArr.push(i);

  const qdTime = measure(() => {
    let sink = 0;
    for (let i = 0; i < ITERATIONS_INDEX; i++) sink += qd.get(readIndices[i])!;
  });
  console.log(`  Quantix (get):             ${qdTime.toFixed(2).padStart(9)} ms  [${ops(qdTime, ITERATIONS_INDEX)} ops/s]`);

  const dqTime = measure(() => {
    let sink = 0;
    for (let i = 0; i < ITERATIONS_INDEX; i++) sink += dq.peekAt(readIndices[i])!;
  });
  console.log(`  Denque (peekAt):           ${dqTime.toFixed(2).padStart(9)} ms  [${ops(dqTime, ITERATIONS_INDEX)} ops/s]`);

  const sdslTime = measure(() => {
    let sink = 0;
    for (let i = 0; i < ITERATIONS_INDEX; i++) sink += sdsl.getElementByPos(readIndices[i])!;
  });
  console.log(`  js-sdsl (getElementByPos): ${sdslTime.toFixed(2).padStart(9)} ms  [${ops(sdslTime, ITERATIONS_INDEX)} ops/s]`);

  const jsArrTime = measure(() => {
    let sink = 0;
    for (let i = 0; i < ITERATIONS_INDEX; i++) sink += jsArr[readIndices[i]];
  });
  console.log(`  JS Array (native[i]):      ${jsArrTime.toFixed(2).padStart(9)} ms  [${ops(jsArrTime, ITERATIONS_INDEX)} ops/s]`);

  console.log(`\n  📊 vs Denque:  ${pct(qdTime, dqTime)} faster`);
  console.log(`  📊 vs js-sdsl: ${pct(qdTime, sdslTime)} faster\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARK 4 · Iteration Performance
// ─────────────────────────────────────────────────────────────────────────────
function runIterationBenchmark() {
  console.log('═══════════════════════════════════════════════');
  console.log('  BENCHMARK 4 · Iteration (for..of & index)   ');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Queue size: ${QUEUE_SIZE.toLocaleString()}, Complete iterations: ${ITERATIONS_ITER.toLocaleString()}\n`);

  const qd   = new QuantixDeque<number>({ capacity: QUEUE_SIZE });
  const sdsl = new JSSDSLDeque<number>();
  const dq   = new Denque<number>();
  const jsArr: number[] = [];

  for (let i = 0; i < QUEUE_SIZE; i++) { qd.push(i); sdsl.pushBack(i); dq.push(i); jsArr.push(i); }

  // A. ES6 for...of
  console.log('  A. ES6 for...of loop:');

  const qdIterTime = measure(() => {
    for (let i = 0; i < ITERATIONS_ITER; i++) {
      let sink = 0;
      for (const val of qd) sink += (val as number);
    }
  });
  console.log(`     Quantix:    ${qdIterTime.toFixed(2).padStart(9)} ms  [${ops(qdIterTime, ITERATIONS_ITER)} iter/s]`);

  const sdslIterTime = measure(() => {
    for (let i = 0; i < ITERATIONS_ITER; i++) {
      let sink = 0;
      for (const val of sdsl) sink += (val as number);
    }
  });
  console.log(`     js-sdsl:    ${sdslIterTime.toFixed(2).padStart(9)} ms  [${ops(sdslIterTime, ITERATIONS_ITER)} iter/s]`);

  const jsArrIterTime = measure(() => {
    for (let i = 0; i < ITERATIONS_ITER; i++) {
      let sink = 0;
      for (const val of jsArr) sink += val;
    }
  });
  console.log(`     JS Array:   ${jsArrIterTime.toFixed(2).padStart(9)} ms  [${ops(jsArrIterTime, ITERATIONS_ITER)} iter/s]`);
  console.log(`     📊 Quantix vs js-sdsl: ${pct(qdIterTime, sdslIterTime)} faster`);

  // B. Index loop
  console.log('\n  B. Manual index loop (for i):');

  const qdLoopTime = measure(() => {
    for (let i = 0; i < ITERATIONS_ITER; i++) {
      const len = qd.length;
      let sink = 0;
      for (let j = 0; j < len; j++) sink += qd.get(j)!;
    }
  });
  console.log(`     Quantix:    ${qdLoopTime.toFixed(2).padStart(9)} ms  [${ops(qdLoopTime, ITERATIONS_ITER)} iter/s]`);

  const dqLoopTime = measure(() => {
    for (let i = 0; i < ITERATIONS_ITER; i++) {
      const len = dq.length;
      let sink = 0;
      for (let j = 0; j < len; j++) sink += dq.peekAt(j)!;
    }
  });
  console.log(`     Denque:     ${dqLoopTime.toFixed(2).padStart(9)} ms  [${ops(dqLoopTime, ITERATIONS_ITER)} iter/s]`);

  const sdslLoopTime = measure(() => {
    for (let i = 0; i < ITERATIONS_ITER; i++) {
      const len = sdsl.size();
      let sink = 0;
      for (let j = 0; j < len; j++) sink += sdsl.getElementByPos(j)!;
    }
  });
  console.log(`     js-sdsl:    ${sdslLoopTime.toFixed(2).padStart(9)} ms  [${ops(sdslLoopTime, ITERATIONS_ITER)} iter/s]`);
  console.log(`     📊 Quantix vs Denque:  ${pct(qdLoopTime, dqLoopTime)} faster`);
  console.log(`     📊 Quantix vs js-sdsl: ${pct(qdLoopTime, sdslLoopTime)} faster\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARK 5 · TypedArray Core (Numeric FIFO)
// ─────────────────────────────────────────────────────────────────────────────
function runTypedArrayBenchmark() {
  console.log('═══════════════════════════════════════════════');
  console.log('  BENCHMARK 5 · TypedArray Core (Numeric FIFO)');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Queue size: ${QUEUE_SIZE.toLocaleString()}, Cycles: ${ITERATIONS_SMALL.toLocaleString()}\n`);

  const f64Time = measure(() => {
    const q = new QuantixDeque<number>({ capacity: QUEUE_SIZE, storageType: Float64Array });
    for (let i = 0; i < QUEUE_SIZE; i++) q.push(i);
    for (let i = 0; i < ITERATIONS_SMALL; i++) { q.push(i & 0x7fffffff); q.shift(); }
  });
  console.log(`  Quantix Float64:  ${f64Time.toFixed(2).padStart(9)} ms  [${ops(f64Time, ITERATIONS_SMALL)} ops/s]`);

  const u32Time = measure(() => {
    const q = new QuantixDeque<number>({ capacity: QUEUE_SIZE, storageType: Uint32Array });
    for (let i = 0; i < QUEUE_SIZE; i++) q.push(i);
    for (let i = 0; i < ITERATIONS_SMALL; i++) { q.push(i & 0x7fffffff); q.shift(); }
  });
  console.log(`  Quantix Uint32:   ${u32Time.toFixed(2).padStart(9)} ms  [${ops(u32Time, ITERATIONS_SMALL)} ops/s]`);

  const arrTime = measure(() => {
    const q = new QuantixDeque<number>({ capacity: QUEUE_SIZE });
    for (let i = 0; i < QUEUE_SIZE; i++) q.push(i);
    for (let i = 0; i < ITERATIONS_SMALL; i++) { q.push(i & 0x7fffffff); q.shift(); }
  });
  console.log(`  Quantix Array:    ${arrTime.toFixed(2).padStart(9)} ms  [${ops(arrTime, ITERATIONS_SMALL)} ops/s]\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARK 6 · Bulk Allocation & Resizing (Growth)
// ─────────────────────────────────────────────────────────────────────────────
function runBulkBenchmark() {
  console.log('═══════════════════════════════════════════════');
  console.log('  BENCHMARK 6 · Bulk Growth (1M elements)     ');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Push ${ITERATIONS_LARGE.toLocaleString()} elements (from cap 4), then pop all.\n`);

  // ── Quantix starting at minimal capacity (4) to maximize resizing work ─────
  const qdFastTime = measure(() => {
    const qd = new QuantixDeque<number>({ capacity: 4, clearOnPop: false });
    for (let i = 0; i < ITERATIONS_LARGE; i++) qd.push(i);
    for (let i = 0; i < ITERATIONS_LARGE; i++) qd.pop();
  });
  console.log(`  Quantix (Fast/cap=4):  ${qdFastTime.toFixed(2).padStart(9)} ms`);

  const qdSafeTime = measure(() => {
    const qd = new QuantixDeque<number>({ capacity: 4, clearOnPop: true });
    for (let i = 0; i < ITERATIONS_LARGE; i++) qd.push(i);
    for (let i = 0; i < ITERATIONS_LARGE; i++) qd.pop();
  });
  console.log(`  Quantix (Safe/cap=4):  ${qdSafeTime.toFixed(2).padStart(9)} ms`);

  const dqTime = measure(() => {
    const dq = new Denque<number>();
    for (let i = 0; i < ITERATIONS_LARGE; i++) dq.push(i);
    for (let i = 0; i < ITERATIONS_LARGE; i++) dq.pop();
  });
  console.log(`  Denque (default):      ${dqTime.toFixed(2).padStart(9)} ms`);

  const sdslTime = measure(() => {
    const sdsl = new JSSDSLDeque<number>();
    for (let i = 0; i < ITERATIONS_LARGE; i++) sdsl.pushBack(i);
    for (let i = 0; i < ITERATIONS_LARGE; i++) sdsl.popBack();
  });
  console.log(`  js-sdsl:               ${sdslTime.toFixed(2).padStart(9)} ms`);

  const winner = Math.min(qdFastTime, qdSafeTime);
  console.log(`\n  📊 Quantix vs Denque:  ${pct(winner, dqTime)} faster`);
  console.log(`  📊 Quantix vs js-sdsl: ${pct(winner, sdslTime)} faster\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARK 7 · Zero-Copy Slicing
// ─────────────────────────────────────────────────────────────────────────────
function runSlicingBenchmark() {
  const SLICE_SIZE = 25_000;
  console.log('═══════════════════════════════════════════════');
  console.log('  BENCHMARK 7 · Slicing Speed (Zero-Copy)     ');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Deque size: 50,000. Slice length: ${SLICE_SIZE.toLocaleString()}. Iterations: ${SLICE_ITERATIONS.toLocaleString()}\n`);

  const qd   = new QuantixDeque<number>({ capacity: 60_000 });
  const dq   = new Denque<number>();
  const sdsl = new JSSDSLDeque<number>();

  for (let i = 0; i < 50_000; i++) { qd.push(i); dq.push(i); sdsl.pushBack(i); }

  // 1. Quantix sliceView (O(1) zero-copy)
  const viewTime = measure(() => {
    for (let i = 0; i < SLICE_ITERATIONS; i++) {
      const view = qd.sliceView(12_500, 37_500);
      const _val = view.get(0);
    }
  });
  console.log(`  Quantix .sliceView():    ${viewTime.toFixed(2).padStart(9)} ms  [${ops(viewTime, SLICE_ITERATIONS)} views/s]  O(1) ZERO-COPY`);

  // 2. Quantix slice (O(N) copy)
  const copyIter = SLICE_ITERATIONS / 100;
  const copyRaw = measure(() => {
    for (let i = 0; i < copyIter; i++) qd.slice(12_500, 37_500);
  });
  const copyTime = copyRaw * (SLICE_ITERATIONS / copyIter);
  console.log(`  Quantix .slice():        ${copyTime.toFixed(2).padStart(9)} ms  [${ops(copyTime, SLICE_ITERATIONS)} slices/s]  O(N) copy`);

  // 3. Denque toArray().slice()
  const denqueRaw = measure(() => {
    for (let i = 0; i < copyIter; i++) dq.toArray().slice(12_500, 37_500);
  });
  const denqueSliceTime = denqueRaw * (SLICE_ITERATIONS / copyIter);
  console.log(`  Denque toArray().slice(): ${denqueSliceTime.toFixed(2).padStart(9)} ms  [${ops(denqueSliceTime, SLICE_ITERATIONS)} slices/s]  O(N) copy`);

  // 4. js-sdsl manual slice loop
  const sdslRaw = measure(() => {
    for (let i = 0; i < copyIter; i++) {
      const slice: number[] = [];
      for (let j = 12_500; j < 37_500; j++) slice.push(sdsl.getElementByPos(j)!);
    }
  });
  const sdslSliceTime = sdslRaw * (SLICE_ITERATIONS / copyIter);
  console.log(`  js-sdsl manual loop:     ${sdslSliceTime.toFixed(2).padStart(9)} ms  [${ops(sdslSliceTime, SLICE_ITERATIONS)} slices/s]  O(N) copy`);

  console.log(`\n  📊 sliceView vs Denque:  ${Math.round(denqueSliceTime / viewTime).toLocaleString()}× faster`);
  console.log(`  📊 sliceView vs js-sdsl: ${Math.round(sdslSliceTime / viewTime).toLocaleString()}× faster\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARK 8 · Mixed Workload (Real-world simulation)
// ─────────────────────────────────────────────────────────────────────────────
function runMixedBenchmark() {
  console.log('═══════════════════════════════════════════════');
  console.log('  BENCHMARK 8 · Mixed Workload (Real-world)   ');
  console.log('═══════════════════════════════════════════════');
  console.log('  Simulates: 40% push, 30% shift, 20% get, 10% unshift\n');

  const N = 2_000_000;

  const qdTime = measure(() => {
    const qd = new QuantixDeque<number>({ capacity: QUEUE_SIZE, clearOnPop: false });
    for (let i = 0; i < QUEUE_SIZE; i++) qd.push(i);
    for (let i = 0; i < N; i++) {
      const r = i % 10;
      if (r < 4)      qd.push(i);
      else if (r < 7) qd.shift();
      else if (r < 9) qd.get((i * 7) % (qd.length || 1));
      else            qd.unshift(i);
    }
  });
  console.log(`  Quantix:  ${qdTime.toFixed(2).padStart(9)} ms`);

  const dqTime = measure(() => {
    const dq = new Denque<number>();
    for (let i = 0; i < QUEUE_SIZE; i++) dq.push(i);
    for (let i = 0; i < N; i++) {
      const r = i % 10;
      if (r < 4)      dq.push(i);
      else if (r < 7) dq.shift();
      else if (r < 9) dq.peekAt((i * 7) % (dq.length || 1));
      else            dq.unshift(i);
    }
  });
  console.log(`  Denque:   ${dqTime.toFixed(2).padStart(9)} ms`);

  const sdslTime = measure(() => {
    const sdsl = new JSSDSLWrapper();
    for (let i = 0; i < QUEUE_SIZE; i++) sdsl.push(i);
    for (let i = 0; i < N; i++) {
      const r = i % 10;
      if (r < 4)      sdsl.push(i);
      else if (r < 7) sdsl.shift();
      else if (r < 9) sdsl.get((i * 7) % (sdsl.length || 1));
      else            sdsl.unshift(i);
    }
  });
  console.log(`  js-sdsl:  ${sdslTime.toFixed(2).padStart(9)} ms`);

  console.log(`\n  📊 vs Denque:  ${pct(qdTime, dqTime)} faster`);
  console.log(`  📊 vs js-sdsl: ${pct(qdTime, sdslTime)} faster\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Run all benchmarks
// ─────────────────────────────────────────────────────────────────────────────
runQueueBenchmark();
runStackBenchmark();
runIndexingBenchmark();
runIterationBenchmark();
runTypedArrayBenchmark();
runBulkBenchmark();
runSlicingBenchmark();
runMixedBenchmark();

console.log('==================================================');
console.log('              BENCHMARK COMPLETE                   ');
console.log('==================================================');
