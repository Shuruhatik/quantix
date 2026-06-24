# Quantix

[![npm version](https://img.shields.io/npm/v/quantix.svg?style=flat-square)](https://www.npmjs.com/package/quantix)
[![npm downloads](https://img.shields.io/npm/dm/quantix.svg?style=flat-square)](https://www.npmjs.com/package/quantix)
[![license](https://img.shields.io/npm/l/quantix.svg?style=flat-square)](https://github.com/Shuruhatik/quantix/blob/main/LICENSE)
[![Rust Powered](https://img.shields.io/badge/rust-powered-orange.svg?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![build status](https://img.shields.io/github/actions/workflow/status/Shuruhatik/quantix/ci.yml?branch=main&style=flat-square)](https://github.com/Shuruhatik/quantix/actions)

Quantix is an ultra-fast, hybrid double-ended queue, circular buffer, and ring-buffer library built for TypeScript/JavaScript and powered by an optional, precompiled **Rust Native Layer** with CPU-level SIMD acceleration.

By combining V8-optimized contiguous memory layouts in TypeScript with raw mathematical speed in Rust, Quantix offers unmatched performance for both generic object queues and heavy numerical batch streams.

> **Important: Rust Native Acceleration**
> Quantix embeds a pre-compiled **Rust Native Layer** via Node-API. Standard numerical and vector operations cross the JS-Rust boundary *once per batch*, offering up to **20x faster sorting** and **SIMD acceleration** on compatible hardware. Best of all, **no local Rust toolchain or build setup is required** by end-users.

---

## Why Quantix?

* **Hybrid Architecture**: Pure TypeScript for high-speed JS object handling, with transparent fallback if Rust binaries are not available.
* **Rust Native Layer (`QuantixBuffer`)**: Accelerates heavy numerical data with SIMD vectorization (AVX/SSE) and native **Rust** `pdqsort`.
* **100% Memory Efficient**: Uses an explicit size counter allowing all $N$ slots of the array to be populated (unlike competitors who waste space).
* **Zero-Copy Slices (`.sliceView()`)**: Extract sub-ranges of a deque in **O(1) time** — *up to 38,000× faster than copying elements*.
* **Bitwise Masking**: Fast random access in O(1) via cached register variables and bitwise indexing `(head + i) & mask`.

---

## Performance at a Glance 🔥🚀

*Node.js v24.11.1 · Median of 5 runs · Clean GC-isolated environment*

### Standard Workloads (10M Operations)
* **FIFO Queue (Push & Shift)**: Quantix is **6.1% faster** than `denque` and **12.9% faster** than `js-sdsl`.
* **Stack Cycle (Push & Pop)**: Quantix is **25.1% faster** than `denque` and **30.6% faster** than `js-sdsl`.
* **Random Indexing (`get(i)`)**: Quantix is **58.8% faster** than `denque` and **76.7% faster** than `js-sdsl`.
* **Zero-Copy Slicing (`sliceView`)**: Quantix is **19,483× faster** than `denque` and **38,835× faster** than `js-sdsl`.

### Extreme Big-Data Workloads (5M–10M Operations)
* **High Memory/GC Pressure**: Quantix is **1.47% faster** than `denque` and **7.88% faster** than `js-sdsl`.
* **Extreme Mixed Workloads**: Quantix is **9.1% faster** than `denque` and **2.8% faster** than `js-sdsl`.

---

## Installation

Install Quantix using your preferred package manager:

### npm
```bash
npm install quantix
```

### yarn
```bash
yarn add quantix
```

### pnpm
```bash
pnpm add quantix
```

### bun
```bash
bun add quantix
```

> **Note:** The **Rust** binary comes pre-compiled for major platforms (Windows, macOS, Linux). End-users **do not need** to have Rust installed on their machine to get maximum native performance.

---

## Quick Start

### 1. High-Speed Generic Queue (Pure TypeScript)
```typescript
import { QuantixDeque } from 'quantix';

// Create a growable deque
const queue = new QuantixDeque<string>({ capacity: 1024 });

// Add items
queue.push("User A");
queue.push("User B");
queue.unshift("Admin"); // Prepend to front

// Fast O(1) random reads
console.log(queue.get(0)); // "Admin"
console.log(queue.size);   // 3

// Draining items
console.log(queue.shift()); // "Admin"
console.log(queue.pop());   // "User B"
```

### 2. Rust-Powered Numeric Buffer (SIMD & Batch Operations)
```typescript
import { QuantixBuffer } from 'quantix';

// Initialize pre-allocated numeric buffer
const buffer = new QuantixBuffer(1_000_000);

// Zero-copy batch insert (crosses JS-Rust boundary exactly once)
const chunk = new Float64Array([10.5, 20.0, 30.5, 40.0]);
buffer.pushBatch(chunk);

// Scale all elements by 2.5 and add 10 in-place (SIMD in Rust)
buffer.scale(2.5);
buffer.offset(10.0);

// Sort ascending using native Rust pdqsort (19× faster than V8 sort)
buffer.sortAsc();

console.log(buffer.sum()); // Native aggregate sum
```

---

## Learn More

Check out the detailed documentation:
- [API Reference](https://github.com/Shuruhatik/quantix/blob/main/docs/api.md) — Complete parameter specifications and classes.
- [Architecture & Optimizations](https://github.com/Shuruhatik/quantix/blob/main/docs/architecture.md) — Deep-dive on packed arrays, register caching, and NAPI bridging.
- [Full Benchmark Report](https://github.com/Shuruhatik/quantix/blob/main/BENCHMARK_REPORT.md) — Standard and extreme performance results.

---

## Contact

Feel free to reach out to the developer at [hi@shuruhatik.dev](mailto:hi@shuruhatik.dev) :)
