import { add, cmp, sub } from './decimal.ts';
import type { AccountSnapshot, Reservation, SpotCurrency } from './types.ts';

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

export function openOrdersRequireHold(openOrderCount: number, hold: string): void {
  if (openOrderCount > 0 && cmp(hold, '0') <= 0) {
    throw new Error('Open orders exist but the venue hold is zero. Refusing to treat available balance as fully free.');
  }
}
