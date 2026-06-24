# Quantix Architecture & Optimizations

This document explains the internal design decisions and micro-optimizations that make Quantix Deque and QuantixBuffer the fastest circular queue implementations in the Node.js ecosystem.

---

## 1. Bitwise Circular Masking

Traditional circular queues track wrapping indices using modulo arithmetic:
```typescript
head = (head + 1) % capacity;
```
Division and modulo operations (`%`) are expensive on modern CPUs. 

Quantix forces all backing array capacities to be a **power of two** ($2^k$). This constraints capacity boundaries such that:
$$capacity - 1 = mask = 0b0111\dots11$$

This allows us to replace modulo arithmetic with a bitwise AND (`&`) operation, which compiles directly to a single-cycle CPU assembly instruction:
```typescript
head = (head + 1) & mask;
```

---

## 2. Register Caching of Heap Reads

In V8, reading a property from an object (e.g. `this._mask`) involves looking up the property on the object's shape/hidden class. In deep loops, these property lookups add CPU cycle overhead and prevent JIT compiler registers from optimization.

To eliminate this, Quantix hot-path routines copy instance properties into local registers (variables) at function entry:

```typescript
push(value: T): number {
  const size = this._size;
  let mask = this._mask; // Load once

  if (size > mask) {
    if (this._growable) {
      this._resize((mask + 1) << 1);
      mask = this._mask; // Reload ONLY on resize branch
    }
  }

  const tail = this._tail;
  this._buffer[tail] = value as any;
  this._tail = (tail + 1) & mask; // Uses local register variable
  return (this._size = size + 1);
}
```

This ensures that the CPU spends almost all its time reading and writing to registers rather than querying memory buses for object references.

---

## 3. Holey vs. Packed Arrays in V8

V8 classifies JavaScript arrays into several "elements kinds".
- **Packed Arrays** (e.g. `PACKED_ELEMENTS`): Contiguous arrays with no empty holes. V8 optimizes access to these arrays because it doesn't need to check the prototype chain for missing keys.
- **Holey Arrays** (e.g. `HOLEY_ELEMENTS`): Arrays initialized with empty slots (e.g., `new Array(1000)`). Readings/writings on holey arrays undergo check branch penalties.

### The Quantix Optimization
1. **Packed Initialization**: Quantix initializes small arrays and lets them grow packed, preserving V8 packed optimization JIT compilation.
2. **GC Safety via Safe Mode**: When `clearOnPop` is `true`, popped slots are set to `undefined`. This prevents reference pinning (memory leaks) and maintains array packaging.

---

## 4. Rust Native Layer & FFI Batch Boundaries

Calling compiled C/C++ or Rust functions from JavaScript is done via the **FFI (Foreign Function Interface)**. 
Crossing the FFI boundary (JS → C++ → Rust) has a small call stack overhead. Doing this **once per element** (e.g. calling `push()` 1,000,000 times) makes native code *slower* than pure JavaScript due to call stack transition costs.

### The Single-Crossing Strategy
Quantix resolves this by doing **batch operations**:
- **`pushBatch(Float64Array)`**: Passes a reference to a JS-allocated TypedArray. We cross the boundary **exactly once**, and let Rust iterate, resize, and copy the memory at bare-metal machine-code speeds.
- **`popBatch(n, Float64Array)`**: Drains numbers zero-copy directly into JS-allocated memory in a single FFI crossing.

---

## 5. SIMD Vectorization & pdqsort

When compiling the Rust native library (`quantix-native`), we target optimized release profiles. LLVM automatically compiles the loops (such as `sum`, `scale`, and `offset`) using **SIMD (Single Instruction, Multiple Data)** instructions:
- This allows the CPU to process multiple floating-point operations in parallel in a single clock cycle (using AVX or SSE registers).
- Sorting functions use **pdqsort (Pattern-defeating Quicksort)**, which is Rust's default unstable sort. It combines the fast average case of quicksort with the fast worst-case of heapsort, running up to **19× faster** than JavaScript's V8 array sort.
