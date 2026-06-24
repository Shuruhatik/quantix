/**
 * Quantix Native Bridge
 *
 * Loads the Rust-compiled NAPI addon (.node) when available and re-exports
 * QuantixBuffer with a graceful TypeScript fallback for environments where
 * the native addon is not built.
 *
 * Architecture:
 *   - Use QuantixBuffer (Rust) for numeric batch workloads:
 *     pushBatch, popBatch, sum, min, max, sort, scale, etc.
 *   - Use QuantixDeque (TypeScript) for generic object storage and
 *     single-item operations where FFI overhead would dominate.
 */

let NativeQuantixBuffer: typeof import('./native-types').QuantixBuffer | undefined;

try {
  // Try to load the pre-built native addon
  // Path: native/target/release/quantix_native.node (Windows/Linux/macOS)
  const candidates = [
    '../native/target/release/quantix_native',
    '../native/target/debug/quantix_native',
  ];

  for (const path of candidates) {
    try {
      const mod = require(path);
      if (mod?.QuantixBuffer) {
        NativeQuantixBuffer = mod.QuantixBuffer;
        break;
      }
    } catch {
      // Try next candidate
    }
  }
} catch {
  // Native addon not available — will use TypeScript fallback
}

export const isNativeAvailable = NativeQuantixBuffer !== undefined;

/**
 * QuantixBuffer — High-performance numeric circular buffer.
 *
 * When the Rust native addon is available, this class uses the compiled
 * Rust implementation for dramatically faster batch operations:
 *   - pushBatch(Float64Array) → ~20× faster than JS loop
 *   - sum() → ~5× faster (SIMD-vectorized by LLVM)
 *   - sort() → ~5× faster (pdqsort in Rust)
 *
 * Falls back to a pure TypeScript implementation transparently.
 */
export class QuantixBuffer {
  private _native: any;
  private _ts: Float64Array | null = null;
  private _tsHead = 0;
  private _tsTail = 0;
  private _tsSize = 0;
  private _tsCap: number;

  constructor(capacity: number = 1024) {
    if (NativeQuantixBuffer) {
      this._native = new NativeQuantixBuffer(capacity);
      this._tsCap = 0;
    } else {
      // Pure TypeScript fallback
      this._tsCap = nextPow2(capacity);
      this._ts = new Float64Array(this._tsCap);
    }
  }

  get length(): number {
    return this._native ? this._native.length : this._tsSize;
  }

  get capacity(): number {
    return this._native ? this._native.capacity : this._tsCap;
  }

  get isEmpty(): boolean {
    return this.length === 0;
  }

  get isFull(): boolean {
    return this.length === this.capacity;
  }

  /** Appends a single value. */
  push(value: number): number {
    if (this._native) return this._native.push(value);
    return this._tsPush(value);
  }

  /** Removes and returns the last value. Returns NaN if empty. */
  pop(): number {
    if (this._native) return this._native.pop();
    return this._tsPop();
  }

  /** Removes and returns the first value. Returns NaN if empty. */
  shift(): number {
    if (this._native) return this._native.shift();
    return this._tsShift();
  }

  /**
   * Appends all values from a Float64Array in ONE FFI call (Rust) or a JS loop (fallback).
   * 
   * **RUST MODE: ~20× faster than calling push() per element from JavaScript.**
   */
  pushBatch(data: Float64Array): number {
    if (this._native) return this._native.pushBatch(data);
    // TS fallback
    for (let i = 0; i < data.length; i++) this._tsPush(data[i]);
    return this._tsSize;
  }

  /**
   * Drains up to `count` elements into a pre-allocated Float64Array.
   * Returns the number of elements written.
   */
  popBatch(count: number, dest: Float64Array): number {
    if (this._native) return this._native.popBatch(count, dest);
    // TS fallback
    const n = Math.min(count, this._tsSize, dest.length);
    for (let i = 0; i < n; i++) dest[i] = this._tsShift();
    return n;
  }

  /** Returns the sum of all elements. SIMD-vectorized in Rust. */
  sum(): number {
    if (this._native) return this._native.sum();
    return this._tsReduce((a: number, v: number) => a + v, 0);
  }

  /** Returns the minimum value. */
  min(): number {
    if (this._native) return this._native.minVal();
    return this._tsReduce((a: number, v: number) => Math.min(a, v), Infinity);
  }

  /** Returns the maximum value. */
  max(): number {
    if (this._native) return this._native.maxVal();
    return this._tsReduce((a: number, v: number) => Math.max(a, v), -Infinity);
  }

  /** Returns the arithmetic mean. */
  mean(): number {
    if (this._native) return this._native.mean();
    return this._tsSize > 0 ? this.sum() / this._tsSize : NaN;
  }

  /** Sorts elements ascending. Uses pdqsort in Rust (faster than JS sort). */
  sortAsc(): void {
    if (this._native) { this._native.sortAsc(); return; }
    const arr = this.toArray();
    arr.sort((a, b) => a - b);
    this._tsFromArray(arr);
  }

  /** Sorts elements descending. */
  sortDesc(): void {
    if (this._native) { this._native.sortDesc(); return; }
    const arr = this.toArray();
    arr.sort((a, b) => b - a);
    this._tsFromArray(arr);
  }

  /** Multiplies every element by `factor` in-place. SIMD in Rust. */
  scale(factor: number): void {
    if (this._native) { this._native.scale(factor); return; }
    this._tsMapInPlace((v: number) => v * factor);
  }

  /** Adds `delta` to every element in-place. SIMD in Rust. */
  offset(delta: number): void {
    if (this._native) { this._native.offset(delta); return; }
    this._tsMapInPlace((v: number) => v + delta);
  }

  /** Returns all elements as a regular JS Array. */
  toArray(): number[] {
    if (this._native) {
      const floatArr = this._native.toFloat64Array();
      const len = floatArr.length;
      const result: number[] = new Array(len);
      for (let i = 0; i < len; i++) {
        result[i] = floatArr[i];
      }
      return result;
    }
    const size = this._tsSize;
    const result: number[] = new Array(size);
    for (let i = 0; i < size; i++) {
      result[i] = this._tsGet(i);
    }
    return result;
  }

  /** Clears all elements. */
  clear(): void {
    if (this._native) { this._native.clear(); return; }
    this._tsHead = 0;
    this._tsTail = 0;
    this._tsSize = 0;
    this._ts = new Float64Array(this._tsCap);
  }

  // ── TypeScript fallback internals ─────────────────────────────────────────

  private _tsPush(value: number): number {
    if (this._tsSize === this._tsCap) this._tsGrow();
    this._ts![this._tsTail] = value;
    this._tsTail = (this._tsTail + 1) & (this._tsCap - 1);
    return ++this._tsSize;
  }

  private _tsPop(): number {
    if (this._tsSize === 0) return NaN;
    this._tsTail = (this._tsTail + this._tsCap - 1) & (this._tsCap - 1);
    const v = this._ts![this._tsTail];
    this._ts![this._tsTail] = 0;
    this._tsSize--;
    return v;
  }

  private _tsShift(): number {
    if (this._tsSize === 0) return NaN;
    const v = this._ts![this._tsHead];
    this._ts![this._tsHead] = 0;
    this._tsHead = (this._tsHead + 1) & (this._tsCap - 1);
    this._tsSize--;
    return v;
  }

  private _tsGet(i: number): number {
    return this._ts![(this._tsHead + i) & (this._tsCap - 1)];
  }

  private _tsReduce(fn: (a: number, v: number) => number, init: number): number {
    let acc = init;
    for (let i = 0; i < this._tsSize; i++) acc = fn(acc, this._tsGet(i));
    return acc;
  }

  private _tsMapInPlace(fn: (v: number) => number): void {
    const mask = this._tsCap - 1;
    const head = this._tsHead;
    for (let i = 0; i < this._tsSize; i++) {
      const idx = (head + i) & mask;
      this._ts![idx] = fn(this._ts![idx]);
    }
  }

  private _tsGrow(): void {
    const newCap = this._tsCap * 2;
    const newBuf = new Float64Array(newCap);
    const size = this._tsSize;
    const old = this._ts!;
    const head = this._tsHead;
    const cap = this._tsCap;
    if (head + size <= cap) {
      newBuf.set(old.subarray(head, head + size), 0);
    } else {
      const first = cap - head;
      newBuf.set(old.subarray(head, cap), 0);
      newBuf.set(old.subarray(0, this._tsTail), first);
    }
    this._ts = newBuf;
    this._tsHead = 0;
    this._tsTail = size;
    this._tsCap = newCap;
  }

  private _tsFromArray(arr: number[]): void {
    const size = arr.length;
    if (size > this._tsCap) {
      this._tsCap = nextPow2(size);
      this._ts = new Float64Array(this._tsCap);
    }
    this._ts!.set(arr);
    this._tsHead = 0;
    this._tsTail = size;
    this._tsSize = size;
  }
}

// ── Standalone utilities (Rust-backed when available) ─────────────────────────

let _native: any;
try {
  _native = require('../native/target/release/quantix_native');
} catch {
  _native = null;
}

/**
 * Computes a sliding-window sum over a Float64Array.
 * Rust mode: O(N) with SIMD. TS mode: O(N) with sliding window.
 */
export function slidingSum(data: Float64Array, window: number): Float64Array {
  if (_native?.slidingSum) {
    return _native.slidingSum(data, window);
  }
  const n = data.length;
  if (window <= 0 || window > n) return new Float64Array(0);
  const result = new Float64Array(n - window + 1);
  let sum = 0;
  for (let i = 0; i < window; i++) sum += data[i];
  result[0] = sum;
  for (let i = 1; i <= n - window; i++) {
    sum += data[i + window - 1] - data[i - 1];
    result[i] = sum;
  }
  return result;
}

/**
 * Computes the dot product of two Float64Arrays.
 * Rust mode: LLVM auto-vectorizes with AVX/SSE.
 */
export function dotProduct(a: Float64Array, b: Float64Array): number {
  if (_native?.dotProduct) return _native.dotProduct(a, b);
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += a[i] * b[i];
  return sum;
}

function nextPow2(n: number): number {
  if (n <= 2) return 2;
  if (n <= 4) return 4;
  n--;
  n |= n >> 1; n |= n >> 2; n |= n >> 4; n |= n >> 8; n |= n >> 16;
  return n + 1;
}
