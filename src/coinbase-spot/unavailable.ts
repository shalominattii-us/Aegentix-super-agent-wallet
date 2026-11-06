export const OMNICYBERDEX_UNAVAILABLE = {
  success: false,
  implemented: false,
  status: 'UNAVAILABLE',
  liveTrading: false,
  engines: [],
  pnlUsd: null,
  pnl24hUsd: null,
  filled: false,
  reason:
    'OmniCyberDEX execution is not implemented. This response is not a fill, and no profit is available.',
} as const;

export function coinbaseSpotPublicStatus() {
  return {
    implemented: true,
    liveHttp: false,
    liveSubmission: false,
    armed: false,
    killSwitchDefault: 'engaged',
    products: ['BTC-USD', 'XRP-USD'],
    portfolioConfigured: false,
    credentialsLoaded: false,
    orderSubmission: 'disabled',
    blockers: [
      'Server route does not load credentials and does not submit orders.',
      'Construct a mock or disabled orchestrator from src/coinbase-spot. There is no live transport.',
      'One portfolio id and operator max slippage are required at staging time. They are not set here.',
    ],
  };
}
