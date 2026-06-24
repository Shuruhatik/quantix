export class QuantixBuffer {
  constructor(capacity: number);
  get length(): number;
  get capacity(): number;
  get isEmpty(): boolean;
  get isFull(): boolean;
  push(value: number): number;
  pop(): number;
  shift(): number;
  pushBatch(data: Float64Array): number;
  popBatch(count: number, dest: Float64Array): number;
  sum(): number;
  minVal(): number;
  maxVal(): number;
  mean(): number;
  sortAsc(): void;
  sortDesc(): void;
  scale(factor: number): void;
  offset(delta: number): void;
  toFloat64Array(): Float64Array;
  clear(): void;
}

export function slidingSum(data: Float64Array, window: number): Float64Array;
export function dotProduct(a: Float64Array, b: Float64Array): number;
