/**
 * A zero-copy read-only view of a portion of a QuantixDeque.
 * It holds a reference to the backing buffer at the time of creation,
 * allowing instant slicing in O(1) time without copying memory.
 */
export class QuantixDequeView<T> implements Iterable<T> {
  private readonly _buffer: T[] | any;
  private readonly _head: number;
  private readonly _mask: number;
  private readonly _length: number;

  constructor(buffer: T[] | any, head: number, mask: number, start: number, length: number) {
    this._buffer = buffer;
    // Map the view's logical 0 index to the physical index in the circular buffer
    this._head = (head + start) & mask;
    this._mask = mask;
    this._length = length;
  }

  /**
   * Returns the number of elements in the view.
   */
  get length(): number {
    return this._length;
  }

  /**
   * Returns the element at the specified index.
   * Returns undefined if the index is out of bounds.
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this._length) {
      return undefined;
    }
    return this._buffer[(this._head + index) & this._mask];
  }

  /**
   * Converts the view into a standard JavaScript array (copies data).
   */
  toArray(): T[] {
    const arr = new Array<T>(this._length);
    const buffer = this._buffer;
    const head = this._head;
    const mask = this._mask;
    const len = this._length;

    for (let i = 0; i < len; i++) {
      arr[i] = buffer[(head + i) & mask];
    }
    return arr;
  }

  /**
   * Iterates over elements of the view.
   */
  [Symbol.iterator](): Iterator<T> {
    let i = 0;
    const len = this._length;
    const head = this._head;
    const mask = this._mask;
    const buffer = this._buffer;
    return {
      next(): IteratorResult<T> {
        if (i < len) {
          const val = buffer[(head + i) & mask];
          i++;
          return { value: val as T, done: false };
        }
        return { value: undefined as any, done: true };
      }
    };
  }
}
