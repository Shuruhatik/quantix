import { QuantixBuffer as NativeQB, slidingSum as nativeSS, dotProduct as nativeDP, isNativeAvailable } from '../src/native';

console.log('==================================================');
console.log('     QUANTIX NATIVE VS TS FALLBACK BENCHMARK       ');
console.log('==================================================\n');
console.log(`Native available: ${isNativeAvailable}`);
if (!isNativeAvailable) {
  console.log('WARNING: Native library is not built or loaded! Benchmarks will not compare accurately.');
}

// ─── Require Cache Mocker for Fallback ─────────────────────────────────────────
// This lets us load the exact same file but force the native addon loader to fail,
// giving us the pure TS fallback classes and functions.
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (this: any, id: string) {
  if (id.includes('quantix_native')) {
    throw new Error('Mocked Native Load Failure for Fallback');
  }
  return originalRequire.apply(this, arguments as any);
};

// Clear require cache for src/native to force reload
delete require.cache[require.resolve('../src/native')];
const FallbackModule = require('../src/native');

// Restore original require
Module.prototype.require = originalRequire;

const FallbackQB = FallbackModule.QuantixBuffer;
const fallbackSS = FallbackModule.slidingSum;
const fallbackDP = FallbackModule.dotProduct;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function measure(fn: () => void, runs = 5): number {
  // Warmup run
  fn();
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = process.hrtime.bigint();
    fn();
    times.push(Number(process.hrtime.bigint() - start) / 1_000_000);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

function pct(nativeTime: number, tsTime: number): string {
  if (nativeTime < tsTime) {
    return `${(tsTime / nativeTime).toFixed(1)}x Faster`;
  }
  return `${(nativeTime / tsTime).toFixed(1)}x Slower`;
}

// ─── Run Benchmarks ──────────────────────────────────────────────────────────
console.log('\nRunning benchmarks (median of 5 runs)...\n');

const dataSize = 1_000_000;
const largeDataSize = 5_000_000;
const testArray = new Float64Array(dataSize);
for (let i = 0; i < dataSize; i++) testArray[i] = Math.random();

const largeArrayA = new Float64Array(largeDataSize);
const largeArrayB = new Float64Array(largeDataSize);
for (let i = 0; i < largeDataSize; i++) {
  largeArrayA[i] = Math.random();
  largeArrayB[i] = Math.random();
}

// 1. pushBatch (1M elements)
console.log('1. pushBatch (1,000,000 elements)');
const nativePushTime = measure(() => {
  const buf = new NativeQB(dataSize);
  buf.pushBatch(testArray);
});
const fallbackPushTime = measure(() => {
  const buf = new FallbackQB(dataSize);
  buf.pushBatch(testArray);
});
console.log(`   Native Rust:    ${nativePushTime.toFixed(2).padStart(8)} ms`);
console.log(`   TS Fallback:    ${fallbackPushTime.toFixed(2).padStart(8)} ms`);
console.log(`   Result:         ${pct(nativePushTime, fallbackPushTime)}`);

// 2. sum (10M elements sum)
console.log('\n2. sum (10,000,000 elements)');
const nativeSumBuf = new NativeQB(10_000_000);
const fallbackSumBuf = new FallbackQB(10_000_000);
const sumData = new Float64Array(10_000_000);
for (let i = 0; i < sumData.length; i++) sumData[i] = i % 100;
nativeSumBuf.pushBatch(sumData);
fallbackSumBuf.pushBatch(sumData);

const nativeSumTime = measure(() => {
  nativeSumBuf.sum();
});
const fallbackSumTime = measure(() => {
  fallbackSumBuf.sum();
});
console.log(`   Native Rust:    ${nativeSumTime.toFixed(2).padStart(8)} ms`);
console.log(`   TS Fallback:    ${fallbackSumTime.toFixed(2).padStart(8)} ms`);
console.log(`   Result:         ${pct(nativeSumTime, fallbackSumTime)}`);

// 3. scale (1M elements in-place)
console.log('\n3. scale (1,000,000 elements in-place)');
const nativeScaleBuf = new NativeQB(dataSize);
const fallbackScaleBuf = new FallbackQB(dataSize);
nativeScaleBuf.pushBatch(testArray);
fallbackScaleBuf.pushBatch(testArray);

const nativeScaleTime = measure(() => {
  nativeScaleBuf.scale(1.5);
});
const fallbackScaleTime = measure(() => {
  fallbackScaleBuf.scale(1.5);
});
console.log(`   Native Rust:    ${nativeScaleTime.toFixed(2).padStart(8)} ms`);
console.log(`   TS Fallback:    ${fallbackScaleTime.toFixed(2).padStart(8)} ms`);
console.log(`   Result:         ${pct(nativeScaleTime, fallbackScaleTime)}`);

// 4. sortAsc (100k elements)
console.log('\n4. sortAsc (100,000 elements)');
const sortSize = 100_000;
const sortData = new Float64Array(sortSize);
for (let i = 0; i < sortSize; i++) sortData[i] = Math.random();

const nativeSortBuf = new NativeQB(sortSize);
const fallbackSortBuf = new FallbackQB(sortSize);

const nativeSortTime = measure(() => {
  nativeSortBuf.clear();
  nativeSortBuf.pushBatch(sortData);
  nativeSortBuf.sortAsc();
});
const fallbackSortTime = measure(() => {
  fallbackSortBuf.clear();
  fallbackSortBuf.pushBatch(sortData);
  fallbackSortBuf.sortAsc();
});
console.log(`   Native Rust:    ${nativeSortTime.toFixed(2).padStart(8)} ms`);
console.log(`   TS Fallback:    ${fallbackSortTime.toFixed(2).padStart(8)} ms`);
console.log(`   Result:         ${pct(nativeSortTime, fallbackSortTime)}`);

// 5. slidingSum (5M elements, window 1000)
console.log('\n5. slidingSum (5,000,000 elements, window 1,000)');
const nativeSSTime = measure(() => {
  nativeSS(largeArrayA, 1000);
});
const fallbackSSTime = measure(() => {
  fallbackSS(largeArrayA, 1000);
});
console.log(`   Native Rust:    ${nativeSSTime.toFixed(2).padStart(8)} ms`);
console.log(`   TS Fallback:    ${fallbackSSTime.toFixed(2).padStart(8)} ms`);
console.log(`   Result:         ${pct(nativeSSTime, fallbackSSTime)}`);

// 6. dotProduct (5M elements)
console.log('\n6. dotProduct (5,000,000 elements)');
const nativeDPTime = measure(() => {
  nativeDP(largeArrayA, largeArrayB);
});
const fallbackDPTime = measure(() => {
  fallbackDP(largeArrayA, largeArrayB);
});
console.log(`   Native Rust:    ${nativeDPTime.toFixed(2).padStart(8)} ms`);
console.log(`   TS Fallback:    ${fallbackDPTime.toFixed(2).padStart(8)} ms`);
console.log(`   Result:         ${pct(nativeDPTime, fallbackDPTime)}`);

console.log('\n==================================================');
console.log('              BENCHMARK COMPLETE                   ');
console.log('==================================================');
