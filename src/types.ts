export interface MarketAsset {
  symbol: string;
  name: string;
  cexPrice: number;
  dexPrice: number;
  spreadPct: number;
  cexDepthUsd: number;
  dexLiquidityUsd: number;
  gasCostUsd: number;
  rsi14: number;
  volatility24h: 'low' | 'medium' | 'high';
  fundingRate: number;
  direction: 'BUY_DEX_SELL_CEX' | 'BUY_CEX_SELL_DEX' | 'BALANCED';
}

export interface AutonomousSignal {
  id: string;
  timestamp: string;
  pair: string;
  action: 'ARBITRAGE' | 'REBALANCE' | 'HEDGE' | 'BUY' | 'SELL';
  sourceVenue: string;
  targetVenue: string;
  amount: number;
  asset: string;
  spreadPct: number;
  confidence: number;
  estimatedProfitUsd: number;
  estGasUsd: number;
  slippageLimit: number;
  rationale: string;
  status: 'PENDING' | 'EXECUTING' | 'EXECUTED' | 'DISMISSED';
  complianceHash?: string;
  executionStepSequence?: string[];
  rank?: number;
  urgencyScore?: number; // 1-100 bounded System 1 scoring
  drawdownRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
  compositeAlphaScore?: number;
  system1Schema?: {
    actionType: string;
    urgencyScore: number;
    riskTier: 'LOW' | 'MEDIUM' | 'HIGH';
    executionHops: string;
    netAlphaBps: number;
    decayTtlSeconds: number;
  };
}

export interface TransactionRecord {
  id: string;
  timestamp: string;
  type: 'DEX_SWAP' | 'CEX_ORDER' | 'CROSS_ARBITRAGE' | 'REBALANCE' | 'STOP_LOSS';
  venue: 'ON_CHAIN_DEX' | 'OFF_CHAIN_CEX' | 'CROSS_EXCHANGE';
  asset: string;
  pair: string;
  amount: number;
  executionPrice: number;
  feeUsd: number;
  slippagePct: number;
  txHash: string;
  status: 'CONFIRMED' | 'SETTLING' | 'SIMULATED';
  complianceHash: string;
}

export interface ComplianceBlock {
  height: number;
  timestamp: string;
  actorId: string;
  actionType: string;
  prevHash: string;
  hash: string;
  integrityScore: number;
}

export interface SecurityIndicator {
  name: string;
  value: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  score: number;
}

export interface SecurityPostures {
  decisionVelocity: number;
  spreadInvariant: number;
  gasSurgeStatus: string;
  slippageDriftPct: number;
  capitalDrawdownPct: number;
  anomalyScore: number;
  activeIndicators: SecurityIndicator[];
}

export interface ExchangeBridge {
  name: string;
  type: 'CEX' | 'DEX';
  status: 'ONLINE' | 'STANDBY' | 'DEGRADED';
  latencyMs: number;
  authenticated?: boolean;
  protocol?: string;
}

export interface WalletHolding {
  symbol: string;
  name: string;
  cexQty: number;
  dexQty: number;
  priceUsd: number;
}

export interface WalletBalances {
  totalUsd: number;
  cexUsd: number;
  dexUsd: number;
  dailyPnlUsd: number;
  dailyPnlPct: number;
  holdings: WalletHolding[];
}

export interface ThoughtLog {
  id: string;
  timestamp: string;
  level: 'ALERT' | 'INFO' | 'SECURITY' | 'COMPLIANCE';
  step?: string;
  message: string;
}

export interface LLMStatus {
  hasKey: boolean;
  inCooldown: boolean;
  cooldownSecondsRemaining: number;
  cooldownReason?: string;
  activeEngine: string;
}

export interface OodaTelemetryState {
  currentStage: 'OBSERVE' | 'ORIENT' | 'DECIDE' | 'ACT';
  heartbeatActive: boolean;
  heartbeatIntervalSeconds: number;
  lastPulseTimestamp: string;
  pulseCounter: number;
  totalProactiveAlphaUsd: number;
  marketContext: any;
  lastHereticSignal: string;
  lastComplianceBlock: any;
  lastExecutionResult: any;
  externalBridgeConnected: boolean;
  recentLogs: Array<{ timestamp: string; stage: string; message: string; type: string }>;
}

export interface PythonScriptInfo {
  id: string;
  name: string;
  title: string;
  port: number | null;
  command: string;
  runtime: string;
  role: string;
  code: string;
}

export interface NavHistoryPoint {
  timestamp: number;
  timeStr: string;
  navUsd: number;
  cexUsd: number;
  dexUsd: number;
  ethPriceCex: number;
  ethPriceDex: number;
  spreadPct: number;
  navDeviationPct: number;
}

export interface Telemetry24HourTrendPoint {
  time: string;
  fullTime: string;
  timestamp: number;
  dailyPnlUsd: number;
  dailyPnlPct: number;
  totalBalanceUsd: number;
  cexBalanceUsd: number;
  dexBalanceUsd: number;
  spreadPct: number;
}

export interface LiveTelemetryData {
  currentNav: number;
  cexUsd: number;
  dexUsd: number;
  dailyPnlUsd: number;
  dailyPnlPct: number;
  navHistory: NavHistoryPoint[];
  history24h?: Telemetry24HourTrendPoint[];
  deviationThresholdPct: number;
  currentDeviationPct: number;
  prices: {
    ETH: { cex: number; dex: number; spreadPct: number };
    BTC: { cex: number; dex: number; spreadPct: number };
    SOL: { cex: number; dex: number; spreadPct: number };
  };
  prometheusGauges: {
    aegentix_nav_usd: number;
    aegentix_market_price_eth_cex: number;
    aegentix_market_price_eth_dex: number;
    agent_alpha_spread_detected: number;
    agent_signals_generated_total: number;
    agent_signals_executed_total: number;
  };
}

export interface GeminiRebalanceOrder {
  symbol: string;
  name?: string;
  cexPrice?: number;
  dexPrice?: number;
  spreadPct?: number;
  direction: 'BUY_DEX_SELL_CEX' | 'BUY_CEX_SELL_DEX' | 'SELL_CEX_BUY_DEX' | 'SELL_DEX_BUY_CEX' | 'HOLD';
  tradeSizeUsd: number;
  expectedAlphaUsd: number;
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'NEUTRAL';
  route?: string;
}

export interface GeminiRebalanceMatrix {
  success: boolean;
  model: string;
  timestamp?: number;
  currentRatio: { cexPct: number; dexPct: number };
  targetRatio: { cexPct: number; dexPct: number };
  netImbalanceUsd: number;
  totalExpectedAlphaUsd?: number;
  orders: GeminiRebalanceOrder[];
  rationale: string;
  executedTransactions?: TransactionRecord[];
}

export interface GeminiTelemetryInsight {
  success: boolean;
  model: string;
  currentNav: number;
  prices: Record<string, { cex: number; dex: number }>;
  analysis: string;
  timestamp: number;
}

export interface AxlTaskGraphNode {
  id: string;
  taskName: string;
  planner: 'PENTAGI';
  executor: 'MANTIS';
  status: 'PENDING' | 'DISPATCHED' | 'VALIDATING' | 'COMMITTED' | 'REJECTED';
  targets: Record<string, string>;
  policies: {
    live_trading: 'permitted' | 'denied';
    order_placement: 'permitted' | 'denied';
    withdrawals: 'permitted' | 'denied';
    max_slippage_pct?: number;
    max_loss_usd?: number;
  };
  validation: {
    require_http_status: number;
    require_event_receipt: boolean;
    policy_passed: boolean;
  };
  ledger: {
    immutable: boolean;
    federate: boolean;
    receiptHash?: string;
  };
}

export interface AxlExecutionManifest {
  id: string;
  timestamp: string;
  eventName: string;
  source: string;
  mode: 'paper_safe' | 'live_sovereign' | 'enclave_isolated';
  zones: ('OpenClaw' | 'Nemotron' | 'Hermes' | 'Docker' | 'Manus')[];
  rawAxlCode: string;
  taskGraph: AxlTaskGraphNode[];
  layerStatus: {
    aegentisCore: { status: 'OPTIMAL' | 'EVALUATING'; lastPlan: string };
    pentagiPlanner: { status: 'OPTIMAL' | 'PLANNING'; activeGraphNodes: number };
    mantisSwarm: { status: 'OPTIMAL' | 'EXECUTING'; activeAgents: number };
    immutableLedger: { status: 'OPTIMAL' | 'SYNCED'; height: number; hash: string };
    vrSpatialLayer: { status: 'READY' | 'STREAMING'; sceneNodesCount: number };
  };
  validationGateStatus: 'CLEARED' | 'BLOCKED' | 'PENDING';
  validationMessage: string;
  federationReceipt: {
    envelopeSignature: string;
    federatedToNodes: string[];
    timestamp: string;
  };
}

