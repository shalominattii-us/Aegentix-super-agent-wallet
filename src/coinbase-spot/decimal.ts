const DECIMAL = /^(?:0|[1-9]\d*)(?:\.(\d+))?$/;
const SCALE = 18;
const SCALE_FACTOR = 10n ** BigInt(SCALE);

export function isDecimal(value: string): boolean {
  return typeof value === 'string' && DECIMAL.test(value);
}

export function assertDecimal(value: string, label: string): string {
  if (!isDecimal(value)) {
    throw new Error(`${label} must be a non-negative decimal string`);
  }
  const fraction = value.split('.')[1];
  if (fraction && fraction.length > SCALE) {
    throw new Error(`${label} has more than ${SCALE} decimal places`);
  }
  return value;
}

function toScaled(value: string): bigint {
  assertDecimal(value, 'decimal');
  const [whole, fraction = ''] = value.split('.');
  const frac = (fraction + '0'.repeat(SCALE)).slice(0, SCALE);
  return BigInt(whole) * SCALE_FACTOR + BigInt(frac);
}

function fromScaled(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / SCALE_FACTOR;
  const frac = (abs % SCALE_FACTOR).toString().padStart(SCALE, '0').replace(/0+$/, '');
  const text = frac.length > 0 ? `${whole.toString()}.${frac}` : whole.toString();
  return negative ? `-${text}` : text;
}

export function cmp(left: string, right: string): number {
  const delta = toScaled(left) - toScaled(right);
  return delta === 0n ? 0 : delta > 0n ? 1 : -1;
}

export function add(left: string, right: string): string {
  return fromScaled(toScaled(left) + toScaled(right));
}

export function sub(left: string, right: string): string {
  return fromScaled(toScaled(left) - toScaled(right));
}

export function mul(left: string, right: string): string {
  return fromScaled((toScaled(left) * toScaled(right)) / SCALE_FACTOR);
}

export function alignDown(amount: string, increment: string): string {
  const inc = toScaled(increment);
  if (inc <= 0n) throw new Error('increment must be positive');
  const scaled = toScaled(amount);
  if (scaled < 0n) throw new Error('amount must be non-negative');
  return fromScaled((scaled / inc) * inc);
}

export function alignUp(amount: string, increment: string): string {
  const inc = toScaled(increment);
  if (inc <= 0n) throw new Error('increment must be positive');
  const scaled = toScaled(amount);
  if (scaled < 0n) throw new Error('amount must be non-negative');
  if (scaled % inc === 0n) return fromScaled(scaled);
  return fromScaled((scaled / inc) * inc + inc);
}

export function divFloor(numerator: string, denominator: string, increment: string): string {
  const den = toScaled(denominator);
  if (den <= 0n) throw new Error('denominator must be positive');
  const ratio = (toScaled(numerator) * SCALE_FACTOR) / den;
  return alignDown(fromScaled(ratio), increment);
}

export function isAligned(amount: string, increment: string): boolean {
  return cmp(amount, alignDown(amount, increment)) === 0;
}

export function isPositive(amount: string): boolean {
  return toScaled(amount) > 0n;
}

export function min(left: string, right: string): string {
  return cmp(left, right) <= 0 ? left : right;
}

export function max(left: string, right: string): string {
  return cmp(left, right) >= 0 ? left : right;
}
