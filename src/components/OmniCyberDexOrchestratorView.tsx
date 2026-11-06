import React, { useState } from 'react';
import {
  Zap,
  TrendingUp,
  Cpu,
  RefreshCw,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle2,
  Terminal,
  Activity,
  Layers,
  ArrowRight,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  INITIAL_ENGINES,
  INITIAL_ARBITRAGE,
  TradingEngineState,
  ArbitrageOpportunity,
} from '../data/omniCyberDexData';

interface OmniCyberDexOrchestratorViewProps {
  onNotify?: (message: string, type: 'ALERT' | 'SUCCESS' | 'INFO') => void;
}

export const OmniCyberDexOrchestratorView: React.FC<OmniCyberDexOrchestratorViewProps> = ({ onNotify }) => {
  const [engines, setEngines] = useState<TradingEngineState[]>(INITIAL_ENGINES);
  const [arbitrage, setArbitrage] = useState<ArbitrageOpportunity[]>(INITIAL_ARBITRAGE);
  const [isSyncing, setIsSyncing] = useState(false);
  const [executingPair, setExecutingPair] = useState<string | null>(null);

  const [orchestratorLogs, setOrchestratorLogs] = useState<string[]>([
    '[Ω] OMNICYBERDEX — MASTER ORCHESTRATOR INITIALIZED',
    '[Ω] Dual-Engine Bridge Connected: binance_us (PID 14920) & finance_us (PID 15104)',
    '[Ω] Active arbitrage channels monitoring 4 pairs (BTC, ETH, SOL, XRP, RLUSD)',
    '[Ω] Real-time latency: Binance US 14.2ms | Finance US 18.5ms | Jitter 0.4ms',
  ]);

  const handleToggleEngine = (id: string) => {
    setEngines(prev =>
      prev.map(eng => {
        if (eng.id === id) {
          const nextStatus = eng.status === 'ACTIVE_TRADING' ? 'PAUSED' : 'ACTIVE_TRADING';
          const msg = `Engine [${eng.name}] switched to ${nextStatus}`;
          setOrchestratorLogs(logs => [
            `[Ω] ${msg} at ${new Date().toLocaleTimeString()}`,
            ...logs.slice(0, 15),
          ]);
          if (onNotify) onNotify(msg, nextStatus === 'ACTIVE_TRADING' ? 'SUCCESS' : 'INFO');
          return { ...eng, status: nextStatus };
        }
        return eng;
      })
    );
  };

  const handleExecuteArbitrage = (arb: ArbitrageOpportunity) => {
    setExecutingPair(arb.pair);
    if (onNotify) onNotify(`⚡ Dispatching atomic dual-leg order for ${arb.pair}...`, 'INFO');

    setTimeout(() => {
      setExecutingPair(null);
      const profit = (arb.estProfitUsd * (0.95 + Math.random() * 0.1)).toFixed(2);
      const log = `[SIMULATION] Browser model only for ${arb.pair} (${arb.route}). Figure +$${profit} is not a Coinbase fill and is not live PnL.`;
      setOrchestratorLogs(logs => [log, ...logs.slice(0, 15)]);
      if (onNotify) onNotify(`Simulation only: browser model showed +$${profit}. This is not a live fill.`, 'INFO');
    }, 900);
  };

  const handleRelaunchAll = () => {
    setIsSyncing(true);
    setOrchestratorLogs(logs => [
      `[Ω] MASTER RESTART: Terminating & spawning subprocesses via python omnicyberdex.py...`,
      ...logs.slice(0, 15),
    ]);

    setTimeout(() => {
      setIsSyncing(false);
      setEngines(prev =>
        prev.map(eng => ({
          ...eng,
          status: 'ACTIVE_TRADING',
          latencyMs: Math.max(9, Math.floor(eng.latencyMs * (0.9 + Math.random() * 0.2))),
          lastHeartbeat: new Date().toISOString(),
        }))
      );
      setOrchestratorLogs(logs => [
        `[Ω] ✅ All engines successfully launched and operational at ${new Date().toLocaleTimeString()}`,
        ...logs.slice(0, 15),
      ]);
      if (onNotify) onNotify('✅ All OmniCyberDex engines successfully launched and synchronized!', 'SUCCESS');
    }, 1200);
  };

  const totalVolume = engines.reduce((acc, e) => acc + e.totalVolume24hUsd, 0);
  const totalOrders = engines.reduce((acc, e) => acc + e.ordersExecuted24h, 0);
  const totalPnl = engines.reduce((acc, e) => acc + e.pnl24hUsd, 0);

  return (
    <div className="bg-[#030508] border border-cyan-500/30 rounded-xl overflow-hidden shadow-2xl space-y-4 font-mono text-xs text-slate-200">
      <div className="px-4 py-2 bg-amber-950/80 border-b border-amber-500/40 text-amber-100 text-[11px] leading-relaxed">
        SIMULATION ONLY. The balances, fills, and PnL on this page are generated in the browser. They are not Coinbase Advanced Trade, not the spot orchestrator, and not live profit. Actual status is the authenticated route GET /api/coinbase-spot/status.
      </div>
      {/* HEADER BANNER */}
      <div className="p-4 sm:p-5 border-b border-cyan-500/20 bg-gradient-to-r from-[#030508] via-[#0A1420] to-[#040C18] flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-slate-900 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-cyan-300 tracking-wider uppercase font-sans">
                OMNICYBERDEX &middot; MASTER ORCHESTRATOR
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-black border flex items-center gap-1 bg-cyan-500/20 text-cyan-300 border-cyan-500/40">
                <Cpu className="w-3 h-3 text-cyan-400" />
                DUAL-ENGINE ORCHESTRATION
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black border flex items-center gap-1 bg-indigo-500/20 text-indigo-300 border-indigo-500/40">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                GEMINI CYBER VERSION: ANTI-MEV SHIELD
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black border flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                BINANCE_US + FINANCE_US
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Simulated display &middot; not an exchange connection &middot; not live execution
            </p>
          </div>
        </div>

        {/* Master Control Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRelaunchAll}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Relaunching...' : 'Relaunch All Engines'}</span>
          </button>
        </div>
      </div>

      {/* METRICS HUD STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-2 bg-[#060C14] border-y border-cyan-500/10 text-center">
        <div className="p-2 border-r border-slate-800">
          <div className="text-xl font-bold text-cyan-300 font-sans">${(totalVolume / 1000000).toFixed(2)}M</div>
          <div className="text-[10px] text-slate-400 uppercase">24h Orchestrated Volume</div>
        </div>
        <div className="p-2 border-r border-slate-800">
          <div className="text-xl font-bold text-emerald-400 font-sans">+{totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</div>
          <div className="text-[10px] text-slate-400 uppercase">24h Net Realized PnL</div>
        </div>
        <div className="p-2 border-r border-slate-800">
          <div className="text-xl font-bold text-amber-300 font-sans">{totalOrders}</div>
          <div className="text-[10px] text-slate-400 uppercase">Orders Executed</div>
        </div>
        <div className="p-2">
          <div className="text-xl font-bold text-purple-300 font-sans">16.3 ms</div>
          <div className="text-[10px] text-slate-400 uppercase">Avg Cross-Venue Latency</div>
        </div>
      </div>

      {/* MAIN CONTENT: ENGINES & ARBITRAGE */}
      <div className="p-4 space-y-4">
        {/* Dual Engine Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {engines.map(eng => (
            <div
              key={eng.id}
              className="p-4 bg-[#060C14] border border-slate-800 rounded-xl space-y-3 relative overflow-hidden"
            >
              <div
                className={`absolute top-0 left-0 right-0 h-1 ${
                  eng.status === 'ACTIVE_TRADING' ? 'bg-cyan-500' : 'bg-amber-500'
                }`}
              />

              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-cyan-400 text-xs font-bold">[Ω]</span>
                    <h3 className="font-bold text-white text-xs">{eng.name}</h3>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono block mt-0.5 truncate max-w-xs" title={eng.scriptPath}>
                    PID {eng.pid} &middot; {eng.scriptPath}
                  </span>
                </div>

                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${
                    eng.status === 'ACTIVE_TRADING'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {eng.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-lg text-center text-[10px]">
                <div>
                  <span className="text-slate-500 block">Latency</span>
                  <span className="font-bold text-cyan-300">{eng.latencyMs} ms</span>
                </div>
                <div>
                  <span className="text-slate-500 block">24h Vol</span>
                  <span className="font-bold text-white">${(eng.totalVolume24hUsd / 1000).toFixed(0)}k</span>
                </div>
                <div>
                  <span className="text-slate-500 block">24h PnL</span>
                  <span className="font-bold text-emerald-400">+{eng.pnl24hPct}%</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Active Pairs:</span>
                <div className="flex flex-wrap gap-1">
                  {eng.activePairs.map(p => (
                    <span key={p} className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300">
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[9px] text-slate-500">Uptime: {(eng.uptimeSeconds / 3600).toFixed(1)}h</span>
                <button
                  onClick={() => handleToggleEngine(eng.id)}
                  className={`px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                    eng.status === 'ACTIVE_TRADING'
                      ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/40 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40 border border-emerald-500/40'
                  }`}
                >
                  {eng.status === 'ACTIVE_TRADING' ? (
                    <>
                      <Pause className="w-3 h-3" />
                      <span>Pause Engine</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      <span>Resume Engine</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Real-Time Arbitrage Matrix */}
        <div className="bg-[#060C14] border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white text-xs flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Real-Time Cross-Engine Arbitrage Spreads</span>
            </span>
            <span className="text-[10px] text-slate-500">Sub-50ms Execution SLA</span>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0A1420] text-slate-400 text-[10px] uppercase border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Asset Pair</th>
                  <th className="py-2 px-3">Binance US</th>
                  <th className="py-2 px-3">Finance US</th>
                  <th className="py-2 px-3">Spread</th>
                  <th className="py-2 px-3">Est. Profit</th>
                  <th className="py-2 px-3">Optimal Route</th>
                  <th className="py-2 px-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/60">
                {arbitrage.map(arb => (
                  <tr key={arb.pair} className="hover:bg-slate-900/60">
                    <td className="py-2.5 px-3 font-bold text-cyan-300">{arb.pair}</td>
                    <td className="py-2.5 px-3 font-mono text-white">${arb.binancePrice}</td>
                    <td className="py-2.5 px-3 font-mono text-white">${arb.financeUsPrice}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">+{arb.spreadPct}%</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-300">+${arb.estProfitUsd}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                        {arb.route.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => handleExecuteArbitrage(arb)}
                        disabled={executingPair === arb.pair}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-[10px] cursor-pointer disabled:opacity-50 transition-all"
                      >
                        {executingPair === arb.pair ? 'Executing...' : 'Execute'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Master Orchestrator Python Log Feed */}
        <div className="p-3 bg-black/95 border border-slate-800 rounded-xl space-y-2 font-mono text-[11px]">
          <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1 text-[10px]">
            <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <Terminal className="w-3.5 h-3.5" />
              <span>omnicyberdex.py stdout console stream</span>
            </span>
            <span>Live supervisor polling</span>
          </div>

          <div className="space-y-1 max-h-36 overflow-y-auto">
            {orchestratorLogs.map((l, idx) => (
              <div key={idx} className="text-slate-300 leading-relaxed">
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
