import { add, cmp, mul, sub } from './decimal.ts';
import type { AccountSnapshot, OpenOrder, Reservation, SpotCurrency } from './types.ts';
import { baseCurrency } from './types.ts';

export interface Spendable {
  currency: SpotCurrency;
  available: string;
  hold: string;
  localReserved: string;
  spendable: string;
}

/**
 * Spendable = venue available − local reservations that the venue does not know yet.
 * `hold` is reported for audit and is not subtracted: Coinbase `available` is already
 * net of open-order holds. Subtracting holds or open orders again would double-count.
 */
export function spendableBalance(
  account: AccountSnapshot,
  localReservations: readonly Reservation[],
): Spendable {
  const local = localReservations
    .filter((item) => item.currency === account.currency)
    .reduce((sum, item) => add(sum, item.amount), '0');
  const spendable = sub(account.available, local);
  if (cmp(spendable, '0') < 0) {
    throw new Error(`Local reservations exceed available ${account.currency}`);
  }
  return {
    currency: account.currency,
    available: account.available,
    hold: account.hold,
    localReserved: local,
    spendable,
  };
}

export function orderReservesCurrency(order: OpenOrder, currency: SpotCurrency): boolean {
  if (order.side === 'BUY') return currency === 'USD';
  return baseCurrency(order.productId) === currency;
}

/**
 * Accept the snapshot only when the account hold equals the sum of open-order holds
 * in that currency. A mismatch, a mix of present and missing hold fields, or a hold
 * with no open orders is ambiguous and must block a new spend. Available is not
 * reduced by this sum: Coinbase available is already net of the hold.
 */
export function attributeHolds(
  account: AccountSnapshot,
  orders: readonly OpenOrder[],
): { ok: true; attributed: string } | { ok: false; message: string } {
  if (orders.length === 0) {
    if (cmp(account.hold, '0') !== 0) {
      return { ok: false, message: 'Account hold is non-zero and no open order explains it. Spending is blocked.' };
    }
    return { ok: true, attributed: '0' };
  }
  const missing = orders.some((order) => order.outstandingHoldAmount === null);
  const present = orders.some((order) => order.outstandingHoldAmount !== null);
  if (missing && present) {
    return { ok: false, message: 'Some open orders omit outstanding_hold_amount. Hold attribution is ambiguous.' };
  }
  let sum = '0';
  for (const order of orders) {
    const remaining = sub(order.baseSize, order.filledBase);
    if (cmp(remaining, '0') < 0) {
      return { ok: false, message: `Order ${order.orderId} filled size exceeds order size.` };
    }
    const amount =
      order.outstandingHoldAmount !== null
        ? order.outstandingHoldAmount
        : order.side === 'BUY'
          ? mul(remaining, order.limitPrice)
          : remaining;
    sum = add(sum, amount);
  }
  if (cmp(sum, account.hold) !== 0) {
    return {
      ok: false,
      message: `Open-order holds sum to ${sum} ${account.currency} but the account hold is ${account.hold}. Spending is blocked.`,
    };
  }
  return { ok: true, attributed: sum };
}
