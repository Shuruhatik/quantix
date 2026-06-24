import { QuantixDeque } from '../src/quantix';
import { QuantixDequeView } from '../src/view';

describe('QuantixDeque', () => {
  describe('Basic Operations', () => {
    it('should initialize empty with correct default properties', () => {
      const deque = new QuantixDeque();
      expect(deque.length).toBe(0);
      expect(deque.size).toBe(0);
      expect(deque.isEmpty).toBe(true);
      expect(deque.isFull).toBe(false);
      expect(deque.capacity).toBe(1024);
      expect(deque.isGrowable).toBe(true);
      expect(deque.isTyped).toBe(false);
    });

    it('should round capacity to the next power of two', () => {
      const deque = new QuantixDeque({ capacity: 10 });
      expect(deque.capacity).toBe(16);

      const deque2 = new QuantixDeque({ capacity: 1000 });
      expect(deque2.capacity).toBe(1024);
    });

    it('should push and pop elements from the back (FIFO / Stack style)', () => {
      const deque = new QuantixDeque<number>({ capacity: 4 });
      expect(deque.push(10)).toBe(1);
      expect(deque.push(20)).toBe(2);
      expect(deque.push(30)).toBe(3);

      expect(deque.length).toBe(3);
      expect(deque.peekLast()).toBe(30);
      expect(deque.peekFirst()).toBe(10);

      expect(deque.pop()).toBe(30);
      expect(deque.pop()).toBe(20);
      expect(deque.pop()).toBe(10);
      expect(deque.pop()).toBeUndefined();
      expect(deque.length).toBe(0);
    });

    it('should unshift and shift elements from the front', () => {
      const deque = new QuantixDeque<number>({ capacity: 4 });
      expect(deque.unshift(10)).toBe(1);
      expect(deque.unshift(20)).toBe(2);
      expect(deque.unshift(30)).toBe(3);

      expect(deque.length).toBe(3);
      expect(deque.peekFirst()).toBe(30);
      expect(deque.peekLast()).toBe(10);

      expect(deque.shift()).toBe(30);
      expect(deque.shift()).toBe(20);
      expect(deque.shift()).toBe(10);
      expect(deque.shift()).toBeUndefined();
      expect(deque.length).toBe(0);
    });

    it('should get and set elements by logical index', () => {
      const deque = new QuantixDeque<string>({ capacity: 4 });
      deque.push('a');
      deque.push('b');
      deque.push('c');

      expect(deque.get(0)).toBe('a');
      expect(deque.get(1)).toBe('b');
      expect(deque.get(2)).toBe('c');
      expect(deque.get(3)).toBeUndefined();
      expect(deque.get(-1)).toBeUndefined();

      deque.set(1, 'x');
      expect(deque.get(1)).toBe('x');
      expect(() => deque.set(5, 'y')).toThrow(RangeError);
    });

    it('should handle clearing the deque', () => {
      const deque = new QuantixDeque<number>();
      deque.push(1);
      deque.push(2);
      expect(deque.length).toBe(2);
      deque.clear();
      expect(deque.length).toBe(0);
      expect(deque.isEmpty).toBe(true);
      expect(deque.get(0)).toBeUndefined();
    });
  });

  describe('Wrapping and Resizing', () => {
    it('should wrap index correctly during mixed operations', () => {
      // Create a fixed-size deque to test wrapping without resize
      const deque = new QuantixDeque<number>({ capacity: 4, growable: false });
      deque.push(1);
      deque.push(2);
      deque.push(3);

      // head=0, tail=3. Queue = [1, 2, 3]
      expect(deque.shift()).toBe(1); // head=1, tail=3. Queue = [2, 3]
      expect(deque.push(4)).toBe(3);  // head=1, tail=0. Queue = [2, 3, 4]
      expect(deque.push(5)).toBe(4);  // fills buffer → isFull (size=4, cap=4)
      expect(deque.isFull).toBe(true);

      // Elements: [2, 3, 4, 5]
      expect(deque.get(0)).toBe(2);
      expect(deque.get(3)).toBe(5);

      expect(deque.toArray()).toEqual([2, 3, 4, 5]);
    });

    it('should auto-resize and maintain elements order when full (growable = true)', () => {
      const deque = new QuantixDeque<number>({ capacity: 4, growable: true });
      deque.push(1);
      deque.push(2);
      deque.push(3);
      deque.shift(); // Queue = [2, 3]
      deque.push(4); // Queue = [2, 3, 4]
      deque.push(5); // Queue = [2, 3, 4, 5] — capacity=4, now full
      expect(deque.capacity).toBe(4);
      expect(deque.isFull).toBe(true);
      expect(deque.length).toBe(4);

      // This push triggers resize. New capacity = 8.
      expect(deque.push(6)).toBe(5);
      expect(deque.capacity).toBe(8);
      expect(deque.isFull).toBe(false);

      expect(deque.toArray()).toEqual([2, 3, 4, 5, 6]);
      expect(deque.shift()).toBe(2);
      expect(deque.shift()).toBe(3);
      expect(deque.shift()).toBe(4);
      expect(deque.shift()).toBe(5);
      expect(deque.shift()).toBe(6);
      expect(deque.isEmpty).toBe(true);
    });
  }); // end Wrapping and Resizing


  describe('Fixed-Size Circular Overwrite Mode', () => {


    it('should overwrite oldest elements when full (growable = false) on push', () => {
      const deque = new QuantixDeque<number>({ capacity: 4, growable: false });
      deque.push(1);
      deque.push(2);
      deque.push(3);
      deque.push(4);
      expect(deque.isFull).toBe(true);
      expect(deque.toArray()).toEqual([1, 2, 3, 4]);

      // Push 5: Overwrites 1
      deque.push(5);
      expect(deque.length).toBe(4);
      expect(deque.toArray()).toEqual([2, 3, 4, 5]);

      // Push 6: Overwrites 2
      deque.push(6);
      expect(deque.toArray()).toEqual([3, 4, 5, 6]);
    });

    it('should drop last element when full (growable = false) on unshift', () => {
      const deque = new QuantixDeque<number>({ capacity: 4, growable: false });
      deque.push(1);
      deque.push(2);
      deque.push(3);
      deque.push(4);
      expect(deque.toArray()).toEqual([1, 2, 3, 4]);

      // Unshift 9: Drops the last element 4
      deque.unshift(9);
      expect(deque.length).toBe(4);
      expect(deque.toArray()).toEqual([9, 1, 2, 3]);

      // Unshift 8: Drops the last element 3
      deque.unshift(8);
      expect(deque.toArray()).toEqual([8, 9, 1, 2]);
    });
  });

  describe('TypedArray Backing Storage', () => {
    it('should initialize with Float64Array and enforce numbers', () => {
      const deque = new QuantixDeque<number>({ capacity: 4, storageType: Float64Array });
      expect(deque.isTyped).toBe(true);
      deque.push(1.5);
      deque.push(2.7);
      deque.push(3.9);

      expect(deque.toArray()).toEqual([1.5, 2.7, 3.9]);
      expect(deque.pop()).toBe(3.9);
    });

    it('should resize properly when backed by TypedArray', () => {
      const deque = new QuantixDeque<number>({ capacity: 2, storageType: Int32Array });
      deque.push(10);
      deque.push(20);
      expect(deque.capacity).toBe(2);
      
      deque.push(30); // Resize triggers
      expect(deque.capacity).toBe(4);
      expect(deque.toArray()).toEqual([10, 20, 30]);
    });
  });

  describe('Slicing and Zero-Copy Views', () => {
    it('should perform copying slice correctly', () => {
      const deque = new QuantixDeque<number>({ capacity: 8 });
      [10, 20, 30, 40, 50].forEach(x => deque.push(x));

      const sl1 = deque.slice(1, 4);
      expect(sl1).toBeInstanceOf(QuantixDeque);
      expect(sl1.toArray()).toEqual([20, 30, 40]);

      // Negative index support
      const sl2 = deque.slice(-3, -1);
      expect(sl2.toArray()).toEqual([30, 40]);
    });

    it('should create a valid zero-copy sliceView', () => {
      const deque = new QuantixDeque<number>({ capacity: 8 });
      [10, 20, 30, 40, 50].forEach(x => deque.push(x));

      const view = deque.sliceView(1, 4);
      expect(view).toBeInstanceOf(QuantixDequeView);
      expect(view.length).toBe(3);
      expect(view.get(0)).toBe(20);
      expect(view.get(1)).toBe(30);
      expect(view.get(2)).toBe(40);
      expect(view.get(3)).toBeUndefined();

      expect(view.toArray()).toEqual([20, 30, 40]);
      expect(Array.from(view)).toEqual([20, 30, 40]);
    });

    it('should preserve snapshot integrity on parent resize', () => {
      const deque = new QuantixDeque<number>({ capacity: 4, growable: true });
      deque.push(1);
      deque.push(2);
      deque.push(3);

      const view = deque.sliceView(1, 3); // View contains [2, 3]
      expect(view.toArray()).toEqual([2, 3]);

      // Resize parent
      deque.push(4);
      deque.push(5); // This triggers resize of parent
      expect(deque.capacity).toBe(8);

      // Verify view is still referencing the old buffer and has correct data
      expect(view.toArray()).toEqual([2, 3]);
    });
  });

  describe('Iterable Interface', () => {
    it('should iterate elements from front to back', () => {
      const deque = new QuantixDeque<string>();
      deque.push('x');
      deque.push('y');
      deque.push('z');

      const elements: string[] = [];
      for (const val of deque) {
        elements.push(val);
      }
      expect(elements).toEqual(['x', 'y', 'z']);
    });
  });
});
