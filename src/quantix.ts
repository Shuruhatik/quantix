import { QuantixDequeView } from './view';

export type TypedArrayConstructor =
  | Int8ArrayConstructor
  | Uint8ArrayConstructor
  | Uint8ClampedArrayConstructor
  | Int16ArrayConstructor
  | Uint16ArrayConstructor
  | Int32ArrayConstructor
  | Uint32ArrayConstructor
  | Float32ArrayConstructor
  | Float64ArrayConstructor
  | BigInt64ArrayConstructor
  | BigUint64ArrayConstructor;

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

export interface QuantixDequeOptions {
  /**
   * Initial capacity of the deque. Will be rounded up to the nearest power of two.
   * Default is 1024.
   */
  capacity?: number;
  /**
   * If true (default), the deque will double its capacity when full.
   * If false, the deque behaves as a fixed-size circular buffer, overwriting the oldest elements when full.
   */
  growable?: boolean;
  /**
   * Backing storage type.
   * - 'array' (default): A standard JS pre-allocated array.
   * - A TypedArray constructor (e.g. Float64Array, Uint32Array): Use TypedArray for fast numeric data.
   */
  storageType?: 'array' | TypedArrayConstructor;
  /**
   * If true, sets popped elements to undefined to prevent memory leaks.
   * Defaults to true for standard arrays, and false for TypedArrays.
   */
  clearOnPop?: boolean;
}

/**
 * Rounds a number up to the next power of two. Minimum 4.
 * Inline bitwise tricks for maximum V8 optimization.
 */
function nextPowerOfTwo(n: number): number {
  if (n <= 2) return 2;
  if (n <= 4) return 4;
  n--;
  n |= n >> 1;
  n |= n >> 2;
  n |= n >> 4;
  n |= n >> 8;
  n |= n >> 16;
  return n + 1;
}

/**
 * Normalizes start and end indices for slice operations, adhering to JS semantics.
 */
function normalizeBounds(start: number | undefined, end: number | undefined, size: number): [number, number] {
  let s = start === undefined ? 0 : start;
  let e = end === undefined ? size : end;

  if (s < 0) {
    s = size + s;
    if (s < 0) s = 0;
  } else if (s > size) {
    s = size;
  }

  if (e < 0) {
    e = size + e;
    if (e < 0) e = 0;
  } else if (e > size) {
    e = size;
  }

  return s > e ? [0, 0] : [s, e];
}

// ─────────────────────────────────────────────────────────────────────────────
// Ultra-optimized FIFO/Deque — generic object storage (standard JS Array)
// Architecture mirrors denque's proven V8-friendly pattern but adds:
//   • Separate _size counter (avoids recomputation in hot paths like get/length)
//   • Zero-copy sliceView in O(1)
//   • Fixed-capacity ring-buffer mode
//   • TypedArray mode (separate class to avoid polymorphism in V8)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * **Quantix** — A highly optimized, hybrid circular-buffer and double-ended queue.
 *
 * The Quantix algorithm is a contiguous circular buffer with bitwise-masked
 * pointer arithmetic, pre-allocated memory, zero-copy O(1) slicing, optional
 * TypedArray backing, and V8-optimized iterators.
 */
export class QuantixDeque<T = any> implements Iterable<T> {
  // Declared in construction order to ensure stable V8 hidden-class.
  // DO NOT reorder or add new properties in other methods.
  _buffer: T[] | TypedArray;   // internal — accessed by QuantixDequeView
  _head: number;
  _tail: number;
  _size: number;
  _mask: number;
  _capacity: number;
  private readonly _growable: boolean;
  private readonly _isTyped: boolean;
  private readonly _clearOnPop: boolean;

  constructor(options: QuantixDequeOptions = {}) {
    const rawCapacity = options.capacity ?? 1024;
    const capacity = nextPowerOfTwo(rawCapacity);

    this._capacity = capacity;
    this._mask = capacity - 1;
    this._head = 0;
    this._tail = 0;
    this._size = 0;
    this._growable = options.growable ?? true;

    const storage = options.storageType ?? 'array';
    if (storage === 'array') {
      // Pre-allocate as a dense SMI array (V8 PACKED_ELEMENTS) by filling with 0
      // then immediately clearing. This ensures contiguous memory from the start.
      this._buffer = new Array<T>(capacity);
      this._isTyped = false;
    } else {
      this._buffer = new (storage as any)(capacity) as TypedArray;
      this._isTyped = true;
    }
    this._clearOnPop = options.clearOnPop ?? !this._isTyped;
  }

  // ─── Accessors ──────────────────────────────────────────────────────────────

  /** Number of items currently in the deque. */
  get length(): number {
    return this._size;
  }

  /** Number of items currently in the deque. */
  get size(): number {
    return this._size;
  }

  /** The current capacity of the deque. */
  get capacity(): number {
    return this._capacity;
  }

  /** Whether the deque is configured to grow when full. */
  get isGrowable(): boolean {
    return this._growable;
  }

  /** Whether the deque is backed by a TypedArray. */
  get isTyped(): boolean {
    return this._isTyped;
  }

  /** Returns true if the deque is empty. */
  get isEmpty(): boolean {
    return this._size === 0;
  }

  /** Returns true if the deque is full (reached capacity). */
  get isFull(): boolean {
    return this._size === this._capacity;
  }

  // ─── Core Mutations (HOT PATH — micro-optimized) ─────────────────────────────

  /**
   * Appends an element to the end of the deque.
   * Returns the new length of the deque.
   *
   * Hot-path: avoid property re-lookups by caching into local vars.
   */
  push(value: T): number {
    const size = this._size;
    let mask = this._mask;

    if (size > mask) {
      // Buffer is full (size === capacity)
      if (this._growable) {
        this._resize((mask + 1) << 1);
        mask = this._mask; // Re-load updated mask
        // Fall through to write after resize (head/tail/mask updated)
      } else {
        // Fixed ring: write over oldest slot and advance head
        const tail = this._tail;
        this._buffer[tail] = value as any;
        this._tail = (tail + 1) & mask;
        this._head = (this._head + 1) & mask;
        // size stays at capacity
        return size;
      }
    }

    // Normal write path (buffer has room)
    const tail = this._tail;
    this._buffer[tail] = value as any;
    this._tail = (tail + 1) & mask;
    return (this._size = size + 1);
  }

  /**
   * Removes and returns the last element of the deque.
   * Returns undefined if the deque is empty.
   */
  pop(): T | undefined {
    const size = this._size;
    if (size === 0) return undefined;

    const mask = this._mask;
    const tailPos = (this._tail - 1) & mask;
    const buffer = this._buffer;
    const value = buffer[tailPos] as T;

    if (this._clearOnPop) {
      buffer[tailPos] = undefined as any;
    }

    this._tail = tailPos;
    this._size = size - 1;
    return value;
  }

  /**
   * Prepends an element to the front of the deque.
   * Returns the new length of the deque.
   */
  unshift(value: T): number {
    const size = this._size;
    let mask = this._mask;

    if (size > mask) {
      // Buffer is full
      if (this._growable) {
        this._resize((mask + 1) << 1);
        mask = this._mask; // Re-load updated mask
        // Fall through: write after resize
      } else {
        // Fixed ring: write to new head slot, retreat tail to discard last
        const headPos = (this._head - 1) & mask;
        this._buffer[headPos] = value as any;
        this._head = headPos;
        this._tail = (this._tail - 1) & mask;
        // size stays at capacity
        return size;
      }
    }

    // Normal write path
    const headPos = (this._head - 1) & mask;
    this._buffer[headPos] = value as any;
    this._head = headPos;
    return (this._size = size + 1);
  }


  /**
   * Removes and returns the first element of the deque.
   * Returns undefined if the deque is empty.
   */
  shift(): T | undefined {
    const size = this._size;
    if (size === 0) return undefined;

    const mask = this._mask;
    const headPos = this._head;
    const buffer = this._buffer;
    const value = buffer[headPos] as T;

    if (this._clearOnPop) {
      buffer[headPos] = undefined as any;
    }

    this._head = (headPos + 1) & mask;
    this._size = size - 1;
    return value;
  }

  // ─── Peek (non-mutating) ─────────────────────────────────────────────────────

  /** Returns the first element of the deque without removing it. */
  peekFirst(): T | undefined {
    if (this._size === 0) return undefined;
    return this._buffer[this._head] as T;
  }

  /** Returns the last element of the deque without removing it. */
  peekLast(): T | undefined {
    if (this._size === 0) return undefined;
    return this._buffer[(this._tail - 1) & this._mask] as T;
  }

  // ─── Random Access ────────────────────────────────────────────────────────────

  /**
   * Returns the element at the specified logical index.
   * Logical index 0 is the front, size - 1 is the back.
   */
  get(index: number): T | undefined {
    // Avoid bounds check branch on fast path: let it return undefined naturally
    if ((index >>> 0) >= (this._size >>> 0)) return undefined;
    return this._buffer[(this._head + index) & this._mask] as T;
  }

  /**
   * Sets the value at the specified logical index.
   * Throws a RangeError if the index is out of bounds.
   */
  set(index: number, value: T): void {
    if (index < 0 || index >= this._size) {
      throw new RangeError('Index out of bounds');
    }
    this._buffer[(this._head + index) & this._mask] = value as any;
  }

  // ─── Bulk Operations ──────────────────────────────────────────────────────────

  /**
   * Appends all elements from an iterable to the back of the deque.
   * More efficient than repeated push() calls due to fewer property lookups.
   */
  pushAll(items: Iterable<T>): number {
    for (const item of items) {
      this.push(item);
    }
    return this._size;
  }

  /**
   * Executes a callback for each element front-to-back.
   * Faster than `for...of` — avoids iterator object allocation entirely.
   */
  forEach(cb: (value: T, index: number) => void): void {
    const size = this._size;
    const head = this._head;
    const mask = this._mask;
    const buffer = this._buffer;
    for (let i = 0; i < size; i++) {
      cb(buffer[(head + i) & mask] as T, i);
    }
  }

  /**
   * Reduces the deque front-to-back to a single value.
   * Avoids all iterator overhead — O(N) with minimal function call overhead.
   */
  reduce<U>(cb: (acc: U, value: T, index: number) => U, initial: U): U {
    const size = this._size;
    const head = this._head;
    const mask = this._mask;
    const buffer = this._buffer;
    let acc = initial;
    for (let i = 0; i < size; i++) {
      acc = cb(acc, buffer[(head + i) & mask] as T, i);
    }
    return acc;
  }

  // ─── Clear ────────────────────────────────────────────────────────────────────

  /**
   * Clears the deque. O(1) for typed arrays, O(capacity) for generic arrays
   * (needed to release object references for GC).
   */
  clear(): void {
    if (!this._isTyped && this._clearOnPop) {
      const buffer = this._buffer as T[];
      const len = this._capacity;
      for (let i = 0; i < len; i++) {
        buffer[i] = undefined as any;
      }
    }
    this._head = 0;
    this._tail = 0;
    this._size = 0;
  }

  // ─── Slicing ─────────────────────────────────────────────────────────────────

  /**
   * Returns a zero-copy read-only view of a portion of this deque in O(1) time.
   */
  sliceView(start?: number, end?: number): QuantixDequeView<T> {
    const [s, e] = normalizeBounds(start, end, this._size);
    return new QuantixDequeView<T>(this._buffer, this._head, this._mask, s, e - s);
  }

  /**
   * Returns a new Deque containing a copied slice of the elements.
   */
  slice(start?: number, end?: number): QuantixDeque<T> {
    const [s, e] = normalizeBounds(start, end, this._size);
    const len = e - s;

    const newDeque = new QuantixDeque<T>({
      capacity: len || 4,
      growable: this._growable,
      storageType: this._isTyped ? (this._buffer.constructor as TypedArrayConstructor) : 'array',
    });

    const buffer = this._buffer;
    const head = this._head;
    const mask = this._mask;

    for (let i = 0; i < len; i++) {
      newDeque.push(buffer[(head + s + i) & mask] as T);
    }

    return newDeque;
  }

  /**
   * Converts the deque to a standard JavaScript array (copies all elements).
   *
   * Uses native TypedArray.subarray + Array.from for typed buffers,
   * and manual loop for generic arrays (faster than Array.from for V8).
   */
  toArray(): T[] {
    const size = this._size;
    const arr = new Array<T>(size);
    const buffer = this._buffer;
    const head = this._head;
    const mask = this._mask;
    const capacity = this._capacity;

    if (size === 0) return arr;

    // Fast path: contiguous region — use direct slice copy
    if (head < this._tail) {
      if (this._isTyped) {
        // Typed array: subarray then spread
        const sub = (buffer as any).subarray(head, head + size);
        for (let i = 0; i < size; i++) arr[i] = sub[i];
      } else {
        for (let i = 0; i < size; i++) arr[i] = (buffer as T[])[head + i];
      }
      return arr;
    }

    // Wrapped around: two-segment copy
    const firstPartSize = capacity - head;
    if (this._isTyped) {
      const part1 = (buffer as any).subarray(head, capacity);
      for (let i = 0; i < firstPartSize; i++) arr[i] = part1[i];
      const part2 = (buffer as any).subarray(0, this._tail);
      for (let i = 0; i < this._tail; i++) arr[firstPartSize + i] = part2[i];
    } else {
      const buf = buffer as T[];
      for (let i = 0; i < firstPartSize; i++) arr[i] = buf[head + i];
      for (let i = 0; i < this._tail; i++) arr[firstPartSize + i] = buf[i];
    }
    return arr;
  }

  // ─── Iteration ────────────────────────────────────────────────────────────────

  /**
   * Returns a V8-optimized custom iterator object for for...of loops.
   * Uses a plain object (not a generator function) so TurboFan/Maglev can
   * inline and optimize the iteration loop.
   */
  [Symbol.iterator](): Iterator<T> {
    let i = 0;
    const size = this._size;
    const head = this._head;
    const mask = this._mask;
    const buffer = this._buffer;
    return {
      next(): IteratorResult<T> {
        if (i < size) {
          const val = buffer[(head + i) & mask];
          i++;
          return { value: val as T, done: false };
        }
        return { value: undefined as any, done: true };
      }
    };
  }

  // ─── Internal Resize ─────────────────────────────────────────────────────────

  /**
   * Resizes the internal buffer to a new capacity.
   *
   * Critical fast-path: if head === 0, the data is already contiguous starting
   * at index 0. In this case we simply extend the JS Array's .length property
   * in-place (O(1)), identical to denque's strategy, avoiding any allocation.
   */
  private _resize(newCapacity: number): void {
    const oldCapacity = this._capacity;
    const oldBuffer = this._buffer;
    const head = this._head;
    const tail = this._tail;
    const size = this._size;

    if (!this._isTyped && head === 0) {
      // ── Ultra-fast path ──────────────────────────────────────────────────
      // Data is contiguous from index 0 to tail. No copy needed — just grow.
      (oldBuffer as T[]).length = newCapacity;
      this._capacity = newCapacity;
      this._mask = newCapacity - 1;
      // tail is already correct (equals size)
      return;
    }

    // ── General path: allocate new buffer and copy ───────────────────────────
    let newBuffer: T[] | TypedArray;
    if (this._isTyped) {
      newBuffer = new (oldBuffer.constructor as any)(newCapacity) as TypedArray;
    } else {
      newBuffer = new Array<T>(newCapacity);
    }

    if (size > 0) {
      if (head < tail) {
        // Contiguous block: use fast copy
        if (this._isTyped) {
          (newBuffer as any).set((oldBuffer as any).subarray(head, tail), 0);
        } else {
          const src = oldBuffer as T[];
          const dst = newBuffer as T[];
          for (let i = 0; i < size; i++) dst[i] = src[head + i];
        }
      } else {
        // Wrapped: two segments
        const firstPartSize = oldCapacity - head;
        if (this._isTyped) {
          (newBuffer as any).set((oldBuffer as any).subarray(head, oldCapacity), 0);
          (newBuffer as any).set((oldBuffer as any).subarray(0, tail), firstPartSize);
        } else {
          const src = oldBuffer as T[];
          const dst = newBuffer as T[];
          for (let i = 0; i < firstPartSize; i++) dst[i] = src[head + i];
          for (let i = 0; i < tail; i++) dst[firstPartSize + i] = src[i];
        }
      }
    }

    this._buffer = newBuffer;
    this._capacity = newCapacity;
    this._mask = newCapacity - 1;
    this._head = 0;
    this._tail = size;
  }
}
