# Quantix API Reference

This document provides detailed documentation of the classes, types, and standalone utilities available in the `quantix` package.

---

## 1. `QuantixDeque<T>`

A general-purpose, high-performance double-ended queue (deque) designed for arbitrary TypeScript types.

### Constructor

```typescript
constructor(options?: QuantixDequeOptions)
```

#### `QuantixDequeOptions`
- `capacity?: number`: The initial memory capacity. Will be rounded to the next power of two. (Default: `1024`, Minimum: `2`).
- `growable?: boolean`: If `true`, the deque doubles its capacity when full. If `false`, the deque operates as a fixed-size ring buffer, overwriting the oldest elements when full. (Default: `true`).
- `storageType?: 'array' | TypedArrayConstructor`: The backing array constructor. If `'array'`, a standard JavaScript array is used. Otherwise, you can pass a TypedArray constructor (e.g., `Float64Array`, `Uint32Array`). (Default: `'array'`).
- `clearOnPop?: boolean`: If `true`, slots are set to `undefined` on `pop()` and `shift()` to allow the V8 garbage collector to free object references. Set to `false` for maximum performance with primitives or TypedArrays. (Default: `true`).

---

### Properties

- **`size`** (`number`): The number of active elements currently in the deque. (Read-only).
- **`length`** (`number`): Alias for `size`.
- **`capacity`** (`number`): The physical size of the backing array. (Read-only).
- **`isEmpty`** (`boolean`): Returns `true` if `size === 0`.
- **`isFull`** (`boolean`): Returns `true` if `size === capacity`.
- **`isGrowable`** (`boolean`): Returns `true` if configured to auto-grow.
- **`isTyped`** (`boolean`): Returns `true` if backed by a TypedArray.

---

### Methods

#### Core Mutations (O(1) amortized)
- **`push(value: T): number`**: Appends an element to the back of the deque. Returns the new size.
- **`unshift(value: T): number`**: Prepends an element to the front of the deque. Returns the new size.
- **`pop(): T | undefined`**: Removes and returns the last element of the deque. Returns `undefined` if empty.
- **`shift(): T | undefined`**: Removes and returns the first element of the deque. Returns `undefined` if empty.
- **`clear(): void`**: Resets the deque, clearing all elements. For standard arrays, clears array slots to release object references.

#### Element Access (O(1))
- **`peekFirst(): T | undefined`**: Returns the front element without removing it.
- **`peekLast(): T | undefined`**: Returns the back element without removing it.
- **`get(index: number): T | undefined`**: Returns the element at the specified logical index (0 is front, size-1 is back). Returns `undefined` if the index is out of bounds.
- **`set(index: number, value: T): void`**: Overwrites the element at the logical index. Throws a `RangeError` if index is out of bounds.

#### Bulk & Slicing
- **`pushAll(items: Iterable<T>): number`**: Appends all items in the iterable to the back. Returns the new size.
- **`sliceView(start?: number, end?: number): QuantixDequeView<T>`**: Returns an **O(1) zero-copy view** of the sub-range. The view is read-only.
- **`slice(start?: number, end?: number): QuantixDeque<T>`**: Returns a new copied deque containing the sliced elements (O(N)).
- **`toArray(): T[]`**: Converts the deque elements into a standard JavaScript array (O(N)).

#### Iteration (JIT-optimized)
- **`forEach(cb: (value: T, index: number) => void): void`**: Executes a callback for each element front-to-back. Avoids ES6 iterator allocation overhead.
- **`reduce<U>(cb: (acc: U, value: T, index: number) => U, initial: U): U`**: Reduces the deque elements front-to-back.
- **`[Symbol.iterator](): Iterator<T>`**: Custom iterator object enabling `for (const x of deque)` loops. Optimized to bypass generator function allocation.

---

## 2. `QuantixBuffer`

A specialized circular buffer for `f64` (double-precision floating point) numbers, backed by an optional Rust native compiled module. 

### Constructor
```typescript
constructor(capacity?: number)
```
- `capacity`: Initial capacity (rounds to next power of 2, default: `1024`).

### Properties
- **`length`** (`number`): The number of active elements.
- **`capacity`** (`number`): The physical size of the buffer.
- **`isEmpty`** (`boolean`): Returns `true` if `length === 0`.
- **`isFull`** (`boolean`): Returns `true` if `length === capacity`.

### Methods
- **`push(value: number): number`**: Appends a single number.
- **`pop(): number`**: Removes and returns the last number. Returns `NaN` if empty.
- **`shift(): number`**: Removes and returns the first number. Returns `NaN` if empty.
- **`pushBatch(data: Float64Array): number`**: Appends all values from the TypedArray in a single FFI crossing. (Up to **20× faster** than looping push in JS).
- **`popBatch(count: number, dest: Float64Array): number`**: Drains up to `count` elements zero-copy directly into `dest`. Returns elements written.
- **`sum(): number`**: Returns the sum of all active elements (SIMD-accelerated).
- **`min(): number`**: Returns the minimum value (returns `Infinity` if empty).
- **`max(): number`**: Returns the maximum value (returns `-Infinity` if empty).
- **`mean(): number`**: Returns the arithmetic mean (returns `NaN` if empty).
- **`scale(factor: number): void`**: Multiplies all elements by `factor` in-place (SIMD-accelerated).
- **`offset(delta: number): void`**: Adds `delta` to all elements in-place (SIMD-accelerated).
- **`sortAsc(): void`**: Sorts elements in ascending order in-place (Rust `pdqsort`).
- **`sortDesc(): void`**: Sorts elements in descending order in-place.
- **`clear(): void`**: Clears the buffer.
- **`toArray(): number[]`**: Converts elements to a JS array (non-destructive).

---

## 3. Standalone Utilities

### `slidingSum`
```typescript
function slidingSum(data: Float64Array, window: number): Float64Array
```
Computes a sliding-window sum over the given data array. Returns a new `Float64Array` of length `data.length - window + 1`. Rust-accelerated.

### `dotProduct`
```typescript
function dotProduct(a: Float64Array, b: Float64Array): number
```
Computes the element-wise dot product of two arrays. Vectorized on the CPU.

### `isNativeAvailable`
```typescript
const isNativeAvailable: boolean;
```
A boolean constant that is `true` if the Rust native compiled library (`.node` file) is loaded, and `false` if the library fell back to the TypeScript implementation.
