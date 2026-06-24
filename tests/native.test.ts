import * as path from 'path';
import { QuantixBuffer, slidingSum, dotProduct, isNativeAvailable } from '../src/native';

describe('QuantixBuffer (Native Rust Mode)', () => {
  if (!isNativeAvailable) {
    it('skipping native tests (not available in this env)', () => {
      console.log('Skipping native tests');
    });
    return;
  }

  it('should initialize with correct capacity and length', () => {
    const buf = new QuantixBuffer(10);
    expect(buf.capacity).toBeGreaterThanOrEqual(10);
    expect((buf.capacity & (buf.capacity - 1)) === 0).toBe(true);
    expect(buf.length).toBe(0);
  });

  it('should support single-item operations', () => {
    const buf = new QuantixBuffer(4);
    expect(buf.push(1.5)).toBe(1);
    expect(buf.push(2.5)).toBe(2);
    expect(buf.shift()).toBe(1.5);
    expect(buf.pop()).toBe(2.5);
  });

  it('should handle batch operations (pushBatch & popBatch)', () => {
    const buf = new QuantixBuffer(8);
    const data = new Float64Array([10.0, 20.0, 30.0, 40.0]);
    expect(buf.pushBatch(data)).toBe(4);
    expect(buf.length).toBe(4);
    expect(buf.toArray()).toEqual([10.0, 20.0, 30.0, 40.0]);

    const dest = new Float64Array(3);
    expect(buf.popBatch(3, dest)).toBe(3);
    expect(dest[0]).toBe(10.0);
    expect(dest[1]).toBe(20.0);
    expect(dest[2]).toBe(30.0);
    expect(buf.length).toBe(1);
  });

  it('should calculate numeric aggregates correctly', () => {
    const buf = new QuantixBuffer(8);
    buf.pushBatch(new Float64Array([1, 2, 3, 4, 5]));
    expect(buf.sum()).toBe(15);
    expect(buf.min()).toBe(1);
    expect(buf.max()).toBe(5);
    expect(buf.mean()).toBe(3);
  });

  it('should scale and offset elements in-place', () => {
    const buf = new QuantixBuffer(4);
    buf.pushBatch(new Float64Array([10, 20, 30]));
    buf.scale(0.5);
    expect(buf.toArray()).toEqual([5, 10, 15]);
    buf.offset(5);
    expect(buf.toArray()).toEqual([10, 15, 20]);
  });

  it('should sort elements ascending and descending', () => {
    const buf = new QuantixBuffer(8);
    buf.pushBatch(new Float64Array([5, 1, 9, 3, 7]));
    buf.sortAsc();
    expect(buf.toArray()).toEqual([1, 3, 5, 7, 9]);
    buf.sortDesc();
    expect(buf.toArray()).toEqual([9, 7, 5, 3, 1]);
  });

  it('should support clearing the buffer', () => {
    const buf = new QuantixBuffer(8);
    buf.pushBatch(new Float64Array([1, 2, 3]));
    buf.clear();
    expect(buf.length).toBe(0);
    expect(buf.toArray()).toEqual([]);
  });

  it('should compute sliding window sum correctly', () => {
    const res = slidingSum(new Float64Array([1, 2, 3, 4, 5]), 3);
    expect(Array.from(res)).toEqual([6, 9, 12]);
  });

  it('should compute dot product correctly', () => {
    expect(dotProduct(new Float64Array([1, 2, 3]), new Float64Array([4, 5, 6]))).toBe(32);
  });
});

describe('QuantixBuffer (Pure TypeScript Fallback Mode)', () => {
  let FallbackQB: any;
  let fallbackSS: any;
  let fallbackDP: any;

  beforeAll(() => {
    jest.resetModules();

    const releasePath = path.resolve(__dirname, '../native/target/release/quantix_native.node');
    const debugPath = path.resolve(__dirname, '../native/target/debug/quantix_native.node');
    const releasePathNoExt = path.resolve(__dirname, '../native/target/release/quantix_native');
    const debugPathNoExt = path.resolve(__dirname, '../native/target/debug/quantix_native');

    jest.doMock(releasePath, () => { throw new Error('Force fallback'); }, { virtual: true });
    jest.doMock(debugPath, () => { throw new Error('Force fallback'); }, { virtual: true });
    jest.doMock(releasePathNoExt, () => { throw new Error('Force fallback'); }, { virtual: true });
    jest.doMock(debugPathNoExt, () => { throw new Error('Force fallback'); }, { virtual: true });

    // Also mock the relative require forms because Node's module resolution might look for them
    jest.doMock('../native/target/release/quantix_native', () => { throw new Error('Force fallback'); }, { virtual: true });
    jest.doMock('../native/target/debug/quantix_native', () => { throw new Error('Force fallback'); }, { virtual: true });

    const fallbackModule = require('../src/native');
    FallbackQB = fallbackModule.QuantixBuffer;
    fallbackSS = fallbackModule.slidingSum;
    fallbackDP = fallbackModule.dotProduct;
  });

  afterAll(() => {
    jest.dontMock('../native/target/release/quantix_native');
    jest.dontMock('../native/target/debug/quantix_native');
    jest.resetModules();
  });

  it('should confirm isNativeAvailable is false in fallback mode', () => {
    const fallbackModule = require('../src/native');
    expect(fallbackModule.isNativeAvailable).toBe(false);
  });

  it('should initialize with correct capacity and length', () => {
    const buf = new FallbackQB(10);
    expect(buf.capacity).toBeGreaterThanOrEqual(10);
    expect((buf.capacity & (buf.capacity - 1)) === 0).toBe(true);
    expect(buf.length).toBe(0);
  });

  it('should support single-item operations', () => {
    const buf = new FallbackQB(4);
    expect(buf.push(1.5)).toBe(1);
    expect(buf.push(2.5)).toBe(2);
    expect(buf.shift()).toBe(1.5);
    expect(buf.pop()).toBe(2.5);
  });

  it('should handle batch operations (pushBatch & popBatch)', () => {
    const buf = new FallbackQB(8);
    const data = new Float64Array([10.0, 20.0, 30.0, 40.0]);
    expect(buf.pushBatch(data)).toBe(4);
    expect(buf.length).toBe(4);
    expect(buf.toArray()).toEqual([10.0, 20.0, 30.0, 40.0]);

    const dest = new Float64Array(3);
    expect(buf.popBatch(3, dest)).toBe(3);
    expect(dest[0]).toBe(10.0);
    expect(dest[1]).toBe(20.0);
    expect(dest[2]).toBe(30.0);
    expect(buf.length).toBe(1);
  });

  it('should calculate numeric aggregates correctly', () => {
    const buf = new FallbackQB(8);
    buf.pushBatch(new Float64Array([1, 2, 3, 4, 5]));
    expect(buf.sum()).toBe(15);
    expect(buf.min()).toBe(1);
    expect(buf.max()).toBe(5);
    expect(buf.mean()).toBe(3);
  });

  it('should scale and offset elements in-place', () => {
    const buf = new FallbackQB(4);
    buf.pushBatch(new Float64Array([10, 20, 30]));
    buf.scale(0.5);
    expect(buf.toArray()).toEqual([5, 10, 15]);
    buf.offset(5);
    expect(buf.toArray()).toEqual([10, 15, 20]);
  });

  it('should sort elements ascending and descending', () => {
    const buf = new FallbackQB(8);
    buf.pushBatch(new Float64Array([5, 1, 9, 3, 7]));
    buf.sortAsc();
    expect(buf.toArray()).toEqual([1, 3, 5, 7, 9]);
    buf.sortDesc();
    expect(buf.toArray()).toEqual([9, 7, 5, 3, 1]);
  });

  it('should support clearing the buffer', () => {
    const buf = new FallbackQB(8);
    buf.pushBatch(new Float64Array([1, 2, 3]));
    buf.clear();
    expect(buf.length).toBe(0);
    expect(buf.toArray()).toEqual([]);
  });

  it('should compute sliding window sum correctly', () => {
    const res = fallbackSS(new Float64Array([1, 2, 3, 4, 5]), 3);
    expect(Array.from(res)).toEqual([6, 9, 12]);
  });

  it('should compute dot product correctly', () => {
    expect(fallbackDP(new Float64Array([1, 2, 3]), new Float64Array([4, 5, 6]))).toBe(32);
  });
});
