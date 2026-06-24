import { QuantixDeque } from '../src/index';
import Denque from 'denque';
import { Deque as JSSDSLDeque } from 'js-sdsl';

// ─── Extreme Benchmark Configuration ─────────────────────────────────────────
const RUNS = 5;

console.log('==================================================');
console.log('     QUANTIX DEQUE — EXTREME HARSH BENCHMARK      ');
console.log('==================================================\n');
console.log(`Running each benchmark ${RUNS} times, reporting the median.\n`);

// JS Array Wrapper
class JSArrayWrapper {
  private arr: any[] = [];
  push(val: any)  { this.arr.push(val); }
  pop()           { return this.arr.pop(); }
  unshift(val: any) { this.arr.unshift(val); }
  shift()         { return this.arr.shift(); }
  get(i: number)  { return this.arr[i]; }
  get length()    { return this.arr.length; }
}

// js-sdsl Wrapper
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

function measure(fn: () => void, runs: number = RUNS): number {
  if (typeof global.gc === 'function') {
    global.gc();
  }
  fn(); // warm up
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
  return times[Math.floor(times.length / 2)];
}

function pct(winner: number, loser: number): string {
  if (winner < loser) {
    return `${((loser - winner) / loser * 100).toFixed(2)}% faster`;
  }
  return `${((winner - loser) / winner * 100).toFixed(2)}% slower`;
}

function ops(ms: number, iters: number): string {
  return Math.round(iters / ms * 1000).toLocaleString();
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTREME BENCHMARK 1 · High Memory Churn & GC Pressure (FIFO with Object Instances)
// ─────────────────────────────────────────────────────────────────────────────
function runGCBenchmark() {
  const QUEUE_SIZE = 500_000;
  const CYCLES = 5_000_000;
  console.log('═══════════════════════════════════════════════');
  console.log('  BENCHMARK 1 · High Memory Churn & GC Pressure');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Queue: ${QUEUE_SIZE.toLocaleString()} objects, cycles: ${CYCLES.toLocaleString()}\n`);

  // Quantix (Safe/clear)
  const qdSafeTime = measure(() => {
    const qd = new QuantixDeque<any>({ capacity: QUEUE_SIZE, clearOnPop: true });
    for (let i = 0; i < QUEUE_SIZE; i++) qd.push({ data: i });
    for (let i = 0; i < CYCLES; i++) {
      qd.push({ data: i });
      qd.shift();
    }
  });
  console.log(`  Quantix (Safe/clear):     ${qdSafeTime.toFixed(2).padStart(9)} ms  [${ops(qdSafeTime, CYCLES)} ops/s]`);

  // Quantix (Fast/no-clear) - will hold references to objects, increasing GC pressure
  const qdFastTime = measure(() => {
    const qd = new QuantixDeque<any>({ capacity: QUEUE_SIZE, clearOnPop: false });
    for (let i = 0; i < QUEUE_SIZE; i++) qd.push({ data: i });
    for (let i = 0; i < CYCLES; i++) {
      qd.push({ data: i });
      qd.shift();
    }
  });
  console.log(`  Quantix (Fast/no-clear):  ${qdFastTime.toFixed(2).padStart(9)} ms  [${ops(qdFastTime, CYCLES)} ops/s]`);

  // Denque
  const dqTime = measure(() => {
    const dq = new Denque<any>();
    for (let i = 0; i < QUEUE_SIZE; i++) dq.push({ data: i });
    for (let i = 0; i < CYCLES; i++) {
      dq.push({ data: i });
      dq.shift();
    }
  });
  console.log(`  Denque:                   ${dqTime.toFixed(2).padStart(9)} ms  [${ops(dqTime, CYCLES)} ops/s]`);

  // js-sdsl
  const sdslTime = measure(() => {
    const sdsl = new JSSDSLWrapper();
    for (let i = 0; i < QUEUE_SIZE; i++) sdsl.push({ data: i });
    for (let i = 0; i < CYCLES; i++) {
      sdsl.push({ data: i });
      sdsl.shift();
    }
  });
  console.log(`  js-sdsl:                  ${sdslTime.toFixed(2).padStart(9)} ms  [${ops(sdslTime, CYCLES)} ops/s]`);

  const winner = Math.min(qdSafeTime, qdFastTime);
  console.log(`\n  📊 Quantix Winner vs Denque:  ${pct(winner, dqTime)}`);
  console.log(`  📊 Quantix Winner vs js-sdsl: ${pct(winner, sdslTime)}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTREME BENCHMARK 2 · Random Indexing on Huge Deque
// ─────────────────────────────────────────────────────────────────────────────
function runIndexingBenchmark() {
  const QUEUE_SIZE = 1_000_000;
  const READS = 10_000_000;
  console.log('═══════════════════════════════════════════════');
  console.log('  BENCHMARK 2 · Random Access on 1M Size Deque');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Queue size: ${QUEUE_SIZE.toLocaleString()}, Random reads: ${READS.toLocaleString()}\n`);

  const readIndices = new Int32Array(READS);
  for (let i = 0; i < READS; i++) {
    readIndices[i] = Math.floor(Math.random() * QUEUE_SIZE);
  }

  const qd = new QuantixDeque<number>({ capacity: QUEUE_SIZE });
  const dq = new Denque<number>();
  const sdsl = new JSSDSLDeque<number>();
  for (let i = 0; i < QUEUE_SIZE; i++) {
    qd.push(i);
    dq.push(i);
    sdsl.pushBack(i);
  }

  const qdTime = measure(() => {
    let sum = 0;
    for (let i = 0; i < READS; i++) {
      sum += qd.get(readIndices[i])!;
    }
  });
  console.log(`  Quantix:                  ${qdTime.toFixed(2).padStart(9)} ms  [${ops(qdTime, READS)} reads/s]`);

  const dqTime = measure(() => {
    let sum = 0;
    for (let i = 0; i < READS; i++) {
      sum += dq.peekAt(readIndices[i])!;
    }
  });
  console.log(`  Denque:                   ${dqTime.toFixed(2).padStart(9)} ms  [${ops(dqTime, READS)} reads/s]`);

  // js-sdsl is notoriously slow on getElementByPos, so we run fewer iterations for it to prevent hanging
  const sdslReads = 200_000;
  const sdslRaw = measure(() => {
    let sum = 0;
    for (let i = 0; i < sdslReads; i++) {
      sum += sdsl.getElementByPos(readIndices[i])!;
    }
  });
  const sdslTime = sdslRaw * (READS / sdslReads);
  console.log(`  js-sdsl (extrapolated):   ${sdslTime.toFixed(2).padStart(9)} ms  [${ops(sdslTime, READS)} reads/s]`);

  console.log(`\n  📊 Quantix vs Denque:  ${pct(qdTime, dqTime)}`);
  console.log(`  📊 Quantix vs js-sdsl: ${pct(qdTime, sdslTime)}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTREME BENCHMARK 3 · Mass Resizing Cycles
// ─────────────────────────────────────────────────────────────────────────────
function runResizingBenchmark() {
  const SIZE = 2_000_000;
  console.log('═══════════════════════════════════════════════');
  console.log('  BENCHMARK 3 · Resizing Stress (2M Elements)  ');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Pushing ${SIZE.toLocaleString()} elements from cap 4, then popping all.\n`);

  const qdTime = measure(() => {
    const qd = new QuantixDeque<number>({ capacity: 4, clearOnPop: false });
    for (let i = 0; i < SIZE; i++) qd.push(i);
    for (let i = 0; i < SIZE; i++) qd.pop();
  });
  console.log(`  Quantix (Fast):           ${qdTime.toFixed(2).padStart(9)} ms`);

  const dqTime = measure(() => {
    const dq = new Denque<number>();
    for (let i = 0; i < SIZE; i++) dq.push(i);
    for (let i = 0; i < SIZE; i++) dq.pop();
  });
  console.log(`  Denque:                   ${dqTime.toFixed(2).padStart(9)} ms`);

  const sdslTime = measure(() => {
    const sdsl = new JSSDSLDeque<number>();
    for (let i = 0; i < SIZE; i++) sdsl.pushBack(i);
    for (let i = 0; i < SIZE; i++) sdsl.popBack();
  });
  console.log(`  js-sdsl:                  ${sdslTime.toFixed(2).padStart(9)} ms`);

  const winner = qdTime;
  console.log(`\n  📊 Quantix vs Denque:  ${pct(winner, dqTime)}`);
  console.log(`  📊 Quantix vs js-sdsl: ${pct(winner, sdslTime)}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTREME BENCHMARK 4 · Massive Zero-Copy Slicing
// ─────────────────────────────────────────────────────────────────────────────
function runSlicingBenchmark() {
  const DEQUE_SIZE = 1_000_000;
  const SLICE_SIZE = 500_000;
  const ITERATIONS = 10_000;
  console.log('═══════════════════════════════════════════════');
  console.log('  BENCHMARK 4 · Slicing Views (Zero-Copy)      ');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Deque size: ${DEQUE_SIZE.toLocaleString()}. Slice size: ${SLICE_SIZE.toLocaleString()}. Iterations: ${ITERATIONS.toLocaleString()}\n`);

  const qd = new QuantixDeque<number>({ capacity: DEQUE_SIZE });
  const dq = new Denque<number>();
  const sdsl = new JSSDSLDeque<number>();

  for (let i = 0; i < DEQUE_SIZE; i++) {
    qd.push(i);
    dq.push(i);
    sdsl.pushBack(i);
  }

  // 1. Quantix sliceView (O(1) zero-copy)
  const viewTime = measure(() => {
    for (let i = 0; i < ITERATIONS; i++) {
      const view = qd.sliceView(250_000, 750_000);
      const _val = view.get(0);
    }
  });
  console.log(`  Quantix .sliceView():    ${viewTime.toFixed(2).padStart(9)} ms  [${ops(viewTime, ITERATIONS)} views/s]  O(1) ZERO-COPY`);

  // 2. Quantix slice (O(N) copy)
  const copyIters = 10;
  const copyRaw = measure(() => {
    for (let i = 0; i < copyIters; i++) {
      qd.slice(250_000, 750_000);
    }
  });
  const copyTime = copyRaw * (ITERATIONS / copyIters);
  console.log(`  Quantix .slice() (copy):  ${copyTime.toFixed(2).padStart(9)} ms  [${ops(copyTime, ITERATIONS)} slices/s]  O(N) copy`);

  // 3. Denque toArray().slice()
  const denqueRaw = measure(() => {
    for (let i = 0; i < copyIters; i++) {
      dq.toArray().slice(250_000, 750_000);
    }
  });
  const denqueTime = denqueRaw * (ITERATIONS / copyIters);
  console.log(`  Denque toArray().slice(): ${denqueTime.toFixed(2).padStart(9)} ms  [${ops(denqueTime, ITERATIONS)} slices/s]  O(N) copy`);

  // 4. js-sdsl manual slice loop
  const sdslRaw = measure(() => {
    for (let i = 0; i < copyIters; i++) {
      const slice: number[] = [];
      for (let j = 250_000; j < 750_000; j++) {
        slice.push(sdsl.getElementByPos(j)!);
      }
    }
  });
  const sdslTime = sdslRaw * (ITERATIONS / copyIters);
  console.log(`  js-sdsl manual loop:     ${sdslTime.toFixed(2).padStart(9)} ms  [${ops(sdslTime, ITERATIONS)} slices/s]  O(N) copy`);

  console.log(`\n  📊 sliceView vs Denque:  ${Math.round(denqueTime / viewTime).toLocaleString()}× faster`);
  console.log(`  📊 sliceView vs js-sdsl: ${Math.round(sdslTime / viewTime).toLocaleString()}× faster\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTREME BENCHMARK 5 · Extreme Mixed Workload
// ─────────────────────────────────────────────────────────────────────────────
function runMixedBenchmark() {
  const N = 10_000_000;
  const START_SIZE = 100_000;
  console.log('═══════════════════════════════════════════════');
  console.log('  BENCHMARK 5 · Extreme Mixed Workload         ');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Start size: ${START_SIZE.toLocaleString()}, ops: ${N.toLocaleString()}\n`);

  const qdTime = measure(() => {
    const qd = new QuantixDeque<number>({ capacity: START_SIZE, clearOnPop: false });
    for (let i = 0; i < START_SIZE; i++) qd.push(i);
    for (let i = 0; i < N; i++) {
      const r = i % 10;
      if (r < 4)      qd.push(i);
      else if (r < 7) qd.shift();
      else if (r < 9) qd.get((i * 7) % (qd.length || 1));
      else            qd.unshift(i);
    }
  });
  console.log(`  Quantix:                  ${qdTime.toFixed(2).padStart(9)} ms`);

  const dqTime = measure(() => {
    const dq = new Denque<number>();
    for (let i = 0; i < START_SIZE; i++) dq.push(i);
    for (let i = 0; i < N; i++) {
      const r = i % 10;
      if (r < 4)      dq.push(i);
      else if (r < 7) dq.shift();
      else if (r < 9) dq.peekAt((i * 7) % (dq.length || 1));
      else            dq.unshift(i);
    }
  });
  console.log(`  Denque:                   ${dqTime.toFixed(2).padStart(9)} ms`);

  const sdslTime = measure(() => {
    const sdsl = new JSSDSLWrapper();
    for (let i = 0; i < START_SIZE; i++) sdsl.push(i);
    for (let i = 0; i < N; i++) {
      const r = i % 10;
      if (r < 4)      sdsl.push(i);
      else if (r < 7) sdsl.shift();
      else if (r < 9) sdsl.get((i * 7) % (sdsl.length || 1));
      else            sdsl.unshift(i);
    }
  });
  console.log(`  js-sdsl:                  ${sdslTime.toFixed(2).padStart(9)} ms`);

  console.log(`\n  📊 vs Denque:  ${pct(qdTime, dqTime)}`);
  console.log(`  📊 vs js-sdsl: ${pct(qdTime, sdslTime)}\n`);
}

// Run All
runGCBenchmark();
runIndexingBenchmark();
runResizingBenchmark();
runSlicingBenchmark();
runMixedBenchmark();

console.log('==================================================');
console.log('              BENCHMARK COMPLETE                   ');
console.log('==================================================');
