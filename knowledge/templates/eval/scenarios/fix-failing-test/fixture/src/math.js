// Intentionally buggy: integer division-by-zero is silently turned into Infinity
// instead of throwing. The accompanying test expects a thrown error.
export function divide(a, b) {
  return a / b;
}

export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}
