import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { MinimalHeader } from './components/MinimalHeader';
import { AgentSidebar } from './components/AgentSidebar';
import { PortfolioOverview } from './components/PortfolioOverview';
import { MarketResearcher } from './components/MarketResearcher';
import { AutonomousSignalsFeed } from './components/AutonomousSignalsFeed';
import { TopSignalsLeaderboard } from './components/TopSignalsLeaderboard';
import { OodaAutonomousSuite } from './components/OodaAutonomousSuite';
import { LiveTelemetryNavSuite } from './components/LiveTelemetryNavSuite';
import { TransactionLedger } from './components/TransactionLedger';
import { HereticConsole } from './components/HereticConsole';
import { MoltbookHub } from './components/MoltbookHub';
import { ComplianceHeatmap } from './components/ComplianceHeatmap';
import { SymphonyConductor } from './components/SymphonyConductor';
import { AgentMesh } from './components/AgentMesh';
import { AutoHedgeSuite } from './components/AutoHedgeSuite';
import { RiskManagementDashboard } from './components/RiskManagementDashboard';
import { DriveAggregator } from './components/DriveAggregator';
import { GmailInboxViewer } from './components/GmailInboxViewer';
import { CyberneticSuite } from './components/CyberneticSuite';
import { AegisCipherProtocolView } from './components/AegisCipherProtocolView';
import { AgentEndpointSecuritySuite } from './components/AgentEndpointSecuritySuite';
import { AegentisOSSuite } from './components/AegentisOSSuite';
import { HaloCeVisorFPV } from './components/HaloCeVisorFPV';
import { EagleUserProfileMapView } from './components/EagleUserProfileMapView';
import { AgentsOfChaosMoEView } from './components/AgentsOfChaosMoEView';
import { SovereignCommandView } from './components/SovereignCommandView';
import { FaaSovLicenseView } from './components/FaaSovLicenseView';
import { SovereignPortalSuite } from './components/SovereignPortalSuite';
import { OmniCyberDexOrchestratorView } from './components/OmniCyberDexOrchestratorView';
import { SovereignHealthcareView } from './components/SovereignHealthcareView';
import { FederalCryptoRegistryView } from './components/FederalCryptoRegistryView';
import { FederalComplianceGovSuite } from './components/FederalComplianceGovSuite';
import { AgenticAmericaView } from './components/AgenticAmericaView';
import { SovereignGitHubForgeSuite } from './components/SovereignGitHubForgeSuite';
import { DagFederalNodeStatus } from './components/DagFederalNodeStatus';
import { InstitutionalTradingSuite } from './components/InstitutionalTradingSuite';
import { HerdrClusterView } from './components/HerdrClusterView';
import { RogCreatorSystemView } from './components/RogCreatorSystemView';
import { PromptTemplateModal } from './components/PromptTemplateModal';
import { HardwareSignOffModal } from './components/HardwareSignOffModal';
import { WalletConnectModal } from './components/WalletConnectModal';
import { TableOfContentsModal } from './components/TableOfContentsModal';
import { ExportAppModal } from './components/ExportAppModal';
import { WorkspaceNavigator } from './components/WorkspaceNavigator';
import { MetaCognitiveEngine } from './components/MetaCognitiveEngine';
import { SpaceBunnyAlphaSuite } from './components/SpaceBunnyAlphaSuite';
import { DesktopDeviceMappingSuite } from './components/DesktopDeviceMappingSuite';
import { KolibriOfflineSuite } from './components/KolibriOfflineSuite';
import { CyberGymProgressionSuite } from './components/CyberGymProgressionSuite';
import { PortfolioGrowthPlanSuite } from './components/PortfolioGrowthPlanSuite';
import { PinnacleDerivativesSuite } from './components/PinnacleDerivativesSuite';
import { PublicLandingPortal } from './components/PublicLandingPortal';
import { JarvisAppBuilderStudio } from './components/JarvisAppBuilderStudio';
import { GrokAuditModal } from './components/GrokAuditModal';
import { NexusSkillRegistrySuite } from './components/NexusSkillRegistrySuite';
import { ZeroCapitalFlywheelSuite } from './components/ZeroCapitalFlywheelSuite';
import { SovereignOriginNodeSuite } from './components/SovereignOriginNodeSuite';
import { AntiTraffickingSentinelSuite } from './components/AntiTraffickingSentinelSuite';
import { XamanRevenueBridgeView } from './components/XamanRevenueBridgeView';
import { 
  WalletBalances, 
  MarketAsset, 
  AutonomousSignal, 
  TransactionRecord, 
  ComplianceBlock, 
  SecurityPostures, 
  ExchangeBridge, 
  ThoughtLog,
  LLMStatus,
  OodaTelemetryState
} from './types';
import { AlertTriangle, CheckCircle2, Info, Trophy, Search, Radio, Layers, Cpu, Activity, Globe, ShieldAlert, Music, Network, Bot, Sliders, HardDrive, Mail, Workflow, Sparkles, Crosshair, Folder, Ship, Plane, HeartPulse, Landmark, TrendingUp, Share2, Atom, Brain, Award, Flag, Dumbbell, Github, Boxes, Users, Gamepad2, BookOpen } from 'lucide-react';

function deduplicateById<T extends { id?: string }>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (item && item.id) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
      }
    } else if (item) {
      out.push(item);
    }
  }
  return out;
}

export default function App() {
  // App Core State
  const [balances, setBalances] = useState<WalletBalances>({
    totalUsd: 48294.50,
    cexUsd: 26102.50,
    dexUsd: 22192.00,
    dailyPnlUsd: 1420.80,
    dailyPnlPct: 2.94,
    holdings: [],
  });

  const [marketFeed, setMarketFeed] = useState<MarketAsset[]>([]);
  const [signals, setSignals] = useState<AutonomousSignal[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [complianceChain, setComplianceChain] = useState<ComplianceBlock[]>([]);
  const [thoughtLogs, setThoughtLogs] = useState<ThoughtLog[]>([]);
  const [securityPostures, setSecurityPostures] = useState<SecurityPostures>({
    decisionVelocity: 0.35,
    spreadInvariant: 99.2,
    gasSurgeStatus: 'NOMINAL',
    slippageDriftPct: 0.09,
    capitalDrawdownPct: 0.18,
    anomalyScore: 4.8,
    activeIndicators: [],
  });
  const [exchangeBridges, setExchangeBridges] = useState<ExchangeBridge[]>([]);

  // Agent Configurations
  const [isAutopilot, setIsAutopilotState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('aegentix_autopilot');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const setIsAutopilot = (active: boolean | ((prev: boolean) => boolean)) => {
    setIsAutopilotState((prev) => {
      const next = typeof active === 'function' ? active(prev) : active;
      try {
        localStorage.setItem('aegentix_autopilot', String(next));
        fetch('/api/autonomous/continuous/toggle', { method: 'POST' }).catch(() => {});
      } catch {}
      return next;
    });
  };

  const [strategy, setStrategy] = useState('arbitrage_balanced');
  const [maxSlippage, setMaxSlippage] = useState(0.25);
  const [gasLimitGwei, setGasLimitGwei] = useState(25);
  const [cycleIntervalSeconds, setCycleIntervalSeconds] = useState(15);
  const [gasPriceGwei, setGasPriceGwei] = useState(18.4);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');
  const [llmStatus, setLlmStatus] = useState<LLMStatus | null>(null);

  // Modals & UI Controls
  const [isExpandedCanvas, setIsExpandedCanvas] = useState(false);
  const [isTocModalOpen, setIsTocModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isGrokModalOpen, setIsGrokModalOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState(false);
  const [pendingHardwareTrade, setPendingHardwareTrade] = useState<{
    pair: string;
    amount: number;
    action: string;
    targetVenue: string;
    estimatedValueUsd: number;
    signalId?: string;
  } | null>(null);

  const [isGeneratingSignal, setIsGeneratingSignal] = useState(false);
  const [isFormulatingTopSignals, setIsFormulatingTopSignals] = useState(false);
  const [isExecutingTrade, setIsExecutingTrade] = useState(false);
  const [isStressTesting, setIsStressTesting] = useState(false);
  const [isPulsingHeartbeat, setIsPulsingHeartbeat] = useState(false);
  const [alertBanner, setAlertBanner] = useState<{ message: string; type: 'ALERT' | 'SUCCESS' | 'INFO' } | null>(null);
  const [oodaState, setOodaState] = useState<OodaTelemetryState | null>(null);

  const resolveTabFromInput = (input?: string | null): any => {
    if (!input) return null;
    const clean = input.replace(/^[/#]+/, '').trim().toLowerCase();
    if (!clean) return null;
    const aliasMap: Record<string, string> = {
      'medical': 'HEALTHCARE_NET',
      'healthcare': 'HEALTHCARE_NET',
      'healthcare_net': 'HEALTHCARE_NET',
      'recruiter': 'HEALTHCARE_NET',
      'faithlines': 'HEALTHCARE_NET',
      'pinnacle': 'PINNACLE_DERIVATIVES',
      'pinnacle_derivatives': 'PINNACLE_DERIVATIVES',
      'derivatives': 'PINNACLE_DERIVATIVES',
      'showcase': 'PINNACLE_DERIVATIVES',
      'ledger': 'LEDGER',
      'sovereign_ledger': 'LEDGER',
      'trading': 'TRADING_COMMAND',
      'trading_command': 'TRADING_COMMAND',
      'exchanges': 'TRADING_COMMAND',
      'telemetry': 'LIVE_TELEMETRY',
      'live_telemetry': 'LIVE_TELEMETRY',
      'aegentis': 'AEGENTIS_OS',
      'aegentis_os': 'AEGENTIS_OS',
      'halo': 'HALO_CE_VISOR',
      'halo_ce_visor': 'HALO_CE_VISOR',
      'lounge': 'HALO_CE_VISOR',
      'spacebunny': 'SPACE_BUNNY_ALPHA',
      'space_bunny_alpha': 'SPACE_BUNNY_ALPHA',
      'herdr': 'HERDR',
      'rog': 'ROG_CREATOR_SYSTEM',
      'rog_creator_system': 'ROG_CREATOR_SYSTEM',
      'devices': 'DEVICE_SANDBOX_MAPPING',
      'device_sandbox_mapping': 'DEVICE_SANDBOX_MAPPING',
      'cybergym': 'CYBERGYM_PROGRESSION',
      'cybergym_progression': 'CYBERGYM_PROGRESSION',
      'growth': 'PORTFOLIO_GROWTH_PLAN',
      'portfolio_growth_plan': 'PORTFOLIO_GROWTH_PLAN',
      'dag': 'DAG_FEDERAL_NODE_STATUS',
      'dag_federal_node_status': 'DAG_FEDERAL_NODE_STATUS',
      'forge': 'GITHUB_FORGE',
      'github_forge': 'GITHUB_FORGE',
      'sovereign_portal': 'SOVEREIGN_PORTAL',
      'command': 'SOVEREIGN_COMMAND',
      'sovereign_command': 'SOVEREIGN_COMMAND',
      'kolibri': 'KOLIBRI_PLATFORM',
      'kolibri_platform': 'KOLIBRI_PLATFORM',
      'ooda': 'OODA_LOOP',
      'ooda_loop': 'OODA_LOOP',
      'mesh': 'AGENT_MESH',
      'agent_mesh': 'AGENT_MESH',
      'symphony': 'SYMPHONY',
      'cyberdaw': 'SYMPHONY',
      'omnicyberdaw': 'SYMPHONY',
      'ableton': 'SYMPHONY',
      'daw': 'SYMPHONY',
      'researcher': 'RESEARCHER',
      'all_feeds': 'ALL_FEEDS',
      'risk': 'RISK_DASHBOARD',
      'risk_dashboard': 'RISK_DASHBOARD',
      'cyberdeck': 'AEGENTIS_OS',
      'operator': 'AEGENTIS_OS',
      'dashboard': 'AEGENTIS_OS',
      'dev': 'AEGENTIS_OS',
      'landing': 'PORTAL_LANDING',
      'home': 'PORTAL_LANDING',
      'welcome': 'PORTAL_LANDING',
      'portal': 'PORTAL_LANDING',
      'public': 'PORTAL_LANDING',
      'builder': 'JARVIS_BUILDER',
      'studio': 'JARVIS_BUILDER',
      'jarvis': 'JARVIS_BUILDER',
      'app_builder': 'JARVIS_BUILDER',
      'nexus': 'NEXUS_REGISTRY',
      'skills': 'NEXUS_REGISTRY',
      'nexus_registry': 'NEXUS_REGISTRY',
      'zerocap': 'ZERO_CAP_FLYWHEEL',
      'zero_cap': 'ZERO_CAP_FLYWHEEL',
      'flywheel': 'ZERO_CAP_FLYWHEEL',
      'gastank': 'ZERO_CAP_FLYWHEEL',
      'gas': 'ZERO_CAP_FLYWHEEL',
      'zero_capital': 'ZERO_CAP_FLYWHEEL',
      'origin': 'SOVEREIGN_ORIGIN_NODE',
      'origin_node': 'SOVEREIGN_ORIGIN_NODE',
      'origin-node': 'SOVEREIGN_ORIGIN_NODE',
      'sovereign_origin': 'SOVEREIGN_ORIGIN_NODE',
      'sovereign_node': 'SOVEREIGN_ORIGIN_NODE',
      'agent_os': 'SOVEREIGN_ORIGIN_NODE',
      'agentos': 'SOVEREIGN_ORIGIN_NODE',
      'anti-trafficking': 'ANTI_TRAFFICKING_SENTINEL',
      'antitrafficking': 'ANTI_TRAFFICKING_SENTINEL',
      'anti_trafficking': 'ANTI_TRAFFICKING_SENTINEL',
      'trafficking': 'ANTI_TRAFFICKING_SENTINEL',
      'sentinel': 'ANTI_TRAFFICKING_SENTINEL',
      'freedom': 'ANTI_TRAFFICKING_SENTINEL',
      'fincen': 'ANTI_TRAFFICKING_SENTINEL',
      'forced_labor': 'ANTI_TRAFFICKING_SENTINEL',
      'xaman': 'XAMAN_REVENUE_BRIDGE',
      'zaman': 'XAMAN_REVENUE_BRIDGE',
      'zombie': 'XAMAN_REVENUE_BRIDGE',
      'rwb7': 'XAMAN_REVENUE_BRIDGE',
      'xumm': 'XAMAN_REVENUE_BRIDGE',
      'xaman_revenue_bridge': 'XAMAN_REVENUE_BRIDGE',
    };
    if (aliasMap[clean]) return aliasMap[clean];
    const upper = clean.toUpperCase();
    return upper;
  };

  const getInitialTab = () => {
    try {
      const fromPath = resolveTabFromInput(window.location.pathname);
      if (fromPath) return fromPath;
      const fromHash = resolveTabFromInput(window.location.hash);
      if (fromHash) return fromHash;
      const stored = localStorage.getItem('aegentix_active_tab');
      if (stored) {
        const fromStored = resolveTabFromInput(stored);
        if (fromStored) return fromStored;
      }
    } catch {}
    return 'PORTAL_LANDING';
  };

  const [centerTab, setCenterTabState] = useState<'PORTAL_LANDING' | 'JARVIS_BUILDER' | 'LIVE_TELEMETRY' | 'AEGENTIS_OS' | 'HERDR' | 'ROG_CREATOR_SYSTEM' | 'DEVICE_SANDBOX_MAPPING' | 'CYBERNETICS' | 'AEGIS_CIPHER' | 'ENDPOINT_SECURITY' | 'OODA_LOOP' | 'TOP_SIGNALS' | 'SYMPHONY' | 'AGENT_MESH' | 'AUTOHEDGE' | 'RISK_DASHBOARD' | 'GOOGLE_DRIVE' | 'GMAIL' | 'HEATMAP' | 'MOLTBOOK' | 'RESEARCHER' | 'META_COGNITIVE' | 'SPACE_BUNNY_ALPHA' | 'ALL_FEEDS' | 'LEDGER' | 'HALO_CE_VISOR' | 'USER_PROFILE_MAP' | 'AGENTS_OF_CHAOS' | 'SOVEREIGN_COMMAND' | 'FAA_SOV_LICENSE' | 'SOVEREIGN_PORTAL' | 'OMNICYBERDEX' | 'HEALTHCARE_NET' | 'FEDERAL_CRYPTO' | 'PINNACLE_DERIVATIVES' | 'TRADING_COMMAND' | 'PORTFOLIO_GROWTH_PLAN' | 'DAG_FEDERAL_NODE_STATUS' | 'GOV_OPPORTUNITIES' | 'AGENTIC_AMERICA' | 'CYBERGYM_PROGRESSION' | 'GITHUB_FORGE' | 'KOLIBRI_PLATFORM' | 'NEXUS_REGISTRY' | 'ZERO_CAP_FLYWHEEL' | 'SOVEREIGN_ORIGIN_NODE' | 'ANTI_TRAFFICKING_SENTINEL' | 'XAMAN_REVENUE_BRIDGE'>(getInitialTab);

  const setCenterTab = (tab: any) => {
    setCenterTabState(tab);
    try {
      localStorage.setItem('aegentix_active_tab', tab);
      const hashStr = '#' + String(tab).toLowerCase();
      if (window.location.hash !== hashStr) {
        window.history.pushState(null, '', hashStr);
      }
    } catch {}
  };

  useEffect(() => {
    const handleNavigationChange = () => {
      const fromHash = resolveTabFromInput(window.location.hash);
      const fromPath = resolveTabFromInput(window.location.pathname);
      const target = fromHash || fromPath;
      if (target) {
        setCenterTabState(target as any);
      }
    };
    window.addEventListener('hashchange', handleNavigationChange);
    window.addEventListener('popstate', handleNavigationChange);

    // Prevent any anchor clicks from reloading the app
    const handleGlobalClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a');
      if (target && target.getAttribute('href')) {
        const href = target.getAttribute('href')!;
        if (
          href.startsWith('#') ||
          (href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/api') && !href.startsWith('/downloads'))
        ) {
          const tab = resolveTabFromInput(href);
          if (tab) {
            e.preventDefault();
            setCenterTab(tab);
          }
        }
      }
    };
    document.addEventListener('click', handleGlobalClick);

    return () => {
      window.removeEventListener('hashchange', handleNavigationChange);
      window.removeEventListener('popstate', handleNavigationChange);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  const [connectedWallet, setConnectedWallet] = useState<{ address: string; type: string } | null>({
    address: '0x71C568a29A88F3c37e97123984FaA628469E849F',
    type: 'METAMASK',
  });

  // Fetch complete initial state from backend
  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) return;
      const data = await res.json();
      setBalances(data.balances);
      setMarketFeed(data.marketFeed);
      setSignals(deduplicateById(data.signals || []));
      setTransactions(deduplicateById(data.transactions || []));
      setComplianceChain(data.complianceChain);
      setThoughtLogs(deduplicateById(data.thoughtLogs || []));
      setSecurityPostures(data.securityPostures);
      setExchangeBridges(data.exchangeBridges);
      if (data.oodaState) setOodaState(data.oodaState);
      if (data.llmStatus) setLlmStatus(data.llmStatus);
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch {
      // Quiet fail during server restart
    }
  };

  useEffect(() => {
    fetchState();

    // Real-Time Nonstop Continuous Telemetry Stream
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/telemetry/stream');
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'CONTINUOUS_AUTONOMOUS_TICK' || payload.type === 'NAV_TELEMETRY_TICK') {
            if (payload.currentNav) {
              setBalances((prev) => ({
                ...prev,
                totalUsd: payload.currentNav,
                dailyPnlUsd: payload.dailyPnlUsd ?? prev.dailyPnlUsd,
                cexUsd: payload.cexUsd ?? prev.cexUsd,
                dexUsd: payload.dexUsd ?? prev.dexUsd,
              }));
              setLastSyncTime(new Date().toLocaleTimeString());
            }
            if (payload.type === 'CONTINUOUS_AUTONOMOUS_TICK') {
              setThoughtLogs((prev) => [
                {
                  id: `log-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  timestamp: new Date().toLocaleTimeString(),
                  step: 'EXECUTE',
                  message: `[Nonstop Autopilot] Captured +$${payload.latestAlpha} USD on ${payload.targetPair} (Spread: ${payload.spreadPct}%). Block #${payload.blockHeight}.`,
                  level: 'INFO'
                },
                ...prev.slice(0, 50)
              ]);
            }
          }
        } catch {}
      };
    } catch {}

    return () => {
      if (es) es.close();
    };
  }, []);

  // Autonomous Heartbeat Trigger (OODA Step)
  const handleTriggerHeartbeatPulse = async (pair = 'ETH/USDT') => {
    setIsPulsingHeartbeat(true);
    try {
      const res = await fetch('/api/autonomous/trigger-heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pair }),
      });
      const data = await res.json();
      if (data.success) {
        setOodaState(data.oodaState);
        setBalances(data.balances);
        if (data.complianceBlock) {
          setComplianceChain((prev) => [...prev, data.complianceBlock]);
        }
        fetchState();
        setAlertBanner({
          message: `[Heartbeat #${data.pulseCounter}] OODA Autonomous Loop self-triggered on ${pair}. Net Alpha Captured: +$${data.oodaState?.lastExecutionResult?.profitUsd || '28.98'} USD! Chained Block #${data.complianceBlock?.height || '10484'}.`,
          type: 'SUCCESS',
        });
        setTimeout(() => setAlertBanner(null), 6000);
      }
    } catch (err) {
      console.error('Error in trigger heartbeat:', err);
    } finally {
      setIsPulsingHeartbeat(false);
    }
  };

  // Autonomous Orchestration Cycle (OODA Loop)
  const runAutonomousCycle = async (targetPair?: string) => {
    setIsGeneratingSignal(true);
    try {
      // Step 1: Scrape & Observe
      const researchRes = await fetch('/api/market/research');
      const researchData = await researchRes.json();
      if (researchData.assets) {
        setMarketFeed(researchData.assets);
      }

      // Step 2 & 3: Orient & Decide (Prompting Heretic LLM with math rules)
      const chosenPair = targetPair || (researchData.assets?.find((a: MarketAsset) => a.spreadPct > 0.5)?.symbol || 'ETH/USDT');

      const signalRes = await fetch('/api/agent/generate-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredPair: chosenPair,
          strategy,
          maxSlippage,
        }),
      });

      const signalData = await signalRes.json();
      if (signalData.signal) {
        setSignals((prev) => deduplicateById([signalData.signal, ...prev]));

        // Add to thought log
        setThoughtLogs((prev) => deduplicateById([
          {
            id: `th-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            level: 'ALERT',
            step: 'ORIENT & DECIDE',
            message: `[Heretic] Signal Generated for ${signalData.signal.pair} via ${signalData.signal.sourceVenue} -> ${signalData.signal.targetVenue}. Net Alpha: +$${signalData.signal.estimatedProfitUsd}`,
          },
          ...prev,
        ]));

        setAlertBanner({
          message: `Autonomous Signal Generated: ${signalData.signal.action} on ${signalData.signal.pair} (+${signalData.signal.spreadPct}% spread)`,
          type: 'SUCCESS',
        });
        setTimeout(() => setAlertBanner(null), 5000);

        // Autopilot Auto-Execution Check
        if (isAutopilot && signalData.signal.confidence >= 0.85) {
          const estimatedValue = signalData.signal.amount * 2680; // approximate USD value
          if (estimatedValue > 1000) {
            // Mandate Hardware Sign-off
            setPendingHardwareTrade({
              pair: signalData.signal.pair,
              amount: signalData.signal.amount,
              action: signalData.signal.action,
              targetVenue: signalData.signal.targetVenue,
              estimatedValueUsd: estimatedValue,
              signalId: signalData.signal.id,
            });
            setIsHardwareModalOpen(true);
          } else {
            // Direct Auto-Execution
            executeSignal(signalData.signal.id);
          }
        }
      }
    } catch (err) {
      console.error('Error in autonomous cycle:', err);
    } finally {
      setIsGeneratingSignal(false);
    }
  };

  // Heartbeat loop when Autopilot is enabled
  useEffect(() => {
    if (!isAutopilot) return;

    const interval = setInterval(() => {
      runAutonomousCycle();
    }, cycleIntervalSeconds * 1000);

    return () => clearInterval(interval);
  }, [isAutopilot, cycleIntervalSeconds, strategy, maxSlippage]);

  // Execute a signal
  const executeSignal = async (signalId: string) => {
    setIsExecutingTrade(true);
    try {
      const res = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId }),
      });
      const data = await res.json();
      if (data.success) {
        setTransactions((prev) => deduplicateById([data.transaction, ...prev]));
        setComplianceChain((prev) => [...prev, data.complianceBlock]);
        setBalances(data.updatedBalances);
        setSignals((prev) =>
          prev.map((s) => (s.id === signalId ? { ...s, status: 'EXECUTED' } : s))
        );

        setAlertBanner({
          message: `Executed cross-exchange trade! Realized Net Alpha: +$${data.transaction.executionPrice ? (data.transaction.amount * 24.5).toFixed(2) : '33.60'}`,
          type: 'SUCCESS',
        });
        setTimeout(() => setAlertBanner(null), 5000);
      }
    } catch (err) {
      console.error('Execution error:', err);
    } finally {
      setIsExecutingTrade(false);
    }
  };

  // Flash Crash stress test simulator
  const handleStressTest = async () => {
    setIsStressTesting(true);
    try {
      const res = await fetch('/api/agent/stress-test', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setBalances(data.balances);
        setTransactions((prev) => deduplicateById([data.emergencyTx, ...prev]));
        setComplianceChain((prev) => [...prev, data.complianceBlock]);

        setAlertBanner({
          message: `[FLASH CRASH DEFENSE ACTIVATED] Market dropped 14.5%. Guardian automated stop-loss liquidated delta into USDC reserve.`,
          type: 'ALERT',
        });
        setTimeout(() => setAlertBanner(null), 8000);
      }
    } catch (err) {
      console.error('Stress test error:', err);
    } finally {
      setIsStressTesting(false);
    }
  };

  // Quick rebalance trigger from holding row
  const handleQuickRebalance = (symbol: string) => {
    const pair = `${symbol}/USDC`;
    runAutonomousCycle(pair);
  };

  // Formulate Top Signals via LIA System 1 Router
  const handleFormulateTopSignals = async () => {
    setIsFormulatingTopSignals(true);
    try {
      const res = await fetch('/api/agent/formulate-top-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy, maxSlippage }),
      });
      const data = await res.json();
      if (data.success && data.topSignals) {
        setSignals((prev) => {
          const executed = prev.filter((s) => s.status === 'EXECUTED');
          return deduplicateById([...data.topSignals, ...executed]);
        });
        if (data.complianceBlock) {
          setComplianceChain((prev) => [...prev, data.complianceBlock]);
        }
        setAlertBanner({
          message: `LIA System 1 Router formulated ${data.count} Top Alpha Signals! #1 Alpha: ${data.topSignals[0].pair} (+${data.topSignals[0].spreadPct}%)`,
          type: 'SUCCESS',
        });
        setTimeout(() => setAlertBanner(null), 6000);
        fetchState();
      }
    } catch (err) {
      console.error('Error formulating top signals:', err);
    } finally {
      setIsFormulatingTopSignals(false);
    }
  };

  // Batch Execute Top Signals
  const handleBatchExecuteTop = async (count = 3) => {
    setIsExecutingTrade(true);
    try {
      const res = await fetch('/api/agent/batch-execute-top', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      const data = await res.json();
      if (data.success) {
        setTransactions((prev) => deduplicateById([...data.transactions, ...prev]));
        if (data.complianceBlock) {
          setComplianceChain((prev) => [...prev, data.complianceBlock]);
        }
        setBalances(data.updatedBalances);
        fetchState();
        setAlertBanner({
          message: `Batch executed Top ${data.executedCount} Signals! Realized Net Alpha: +$${data.totalProfitUsd.toFixed(2)}`,
          type: 'SUCCESS',
        });
        setTimeout(() => setAlertBanner(null), 6000);
      }
    } catch (err) {
      console.error('Error in batch execute:', err);
    } finally {
      setIsExecutingTrade(false);
    }
  };

  // Confirm Hardware Sign-off
  const handleConfirmHardwareSign = () => {
    if (pendingHardwareTrade?.signalId) {
      executeSignal(pendingHardwareTrade.signalId);
    }
    setIsHardwareModalOpen(false);
    setPendingHardwareTrade(null);
  };

  const isOutwardPortalMode = ['PORTAL_LANDING', 'HEALTHCARE_NET', 'PINNACLE_DERIVATIVES', 'JARVIS_BUILDER', 'TRADING_COMMAND', 'LEDGER', 'NEXUS_REGISTRY', 'ZERO_CAP_FLYWHEEL', 'SOVEREIGN_ORIGIN_NODE', 'ANTI_TRAFFICKING_SENTINEL', 'XAMAN_REVENUE_BRIDGE'].includes(centerTab);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#080B10] text-slate-200 flex flex-col font-mono selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Dynamic Header: Minimalist Editorial Header in Portal / Origin Mode vs Technical Header in Cyberdeck */}
      {isOutwardPortalMode ? (
        <MinimalHeader
          currentTab={centerTab}
          onSelectTab={(tab) => setCenterTab(tab)}
          gasPriceGwei={gasPriceGwei}
          gasTankUsd={520.15}
        />
      ) : (
        <Header
          isAutopilot={isAutopilot}
          onToggleAutopilot={() => setIsAutopilot(!isAutopilot)}
          onOpenWalletModal={() => setIsWalletModalOpen(true)}
          onOpenPromptModal={() => setIsPromptModalOpen(true)}
          onOpenTocModal={() => setIsTocModalOpen(true)}
          onOpenExportModal={() => setIsExportModalOpen(true)}
          onTriggerStressTest={handleStressTest}
          isStressTesting={isStressTesting}
          connectedWallet={connectedWallet}
          gasPriceGwei={gasPriceGwei}
          lastSyncTime={lastSyncTime}
          llmStatus={llmStatus}
          isExpandedCanvas={isExpandedCanvas}
          onToggleExpandedCanvas={() => setIsExpandedCanvas(!isExpandedCanvas)}
          onOpenSpaceBunny={() => setCenterTab('SPACE_BUNNY_ALPHA')}
          onOpenDeviceMapping={() => setCenterTab('DEVICE_SANDBOX_MAPPING')}
          onOpenLounge={() => setCenterTab('HALO_CE_VISOR')}
          onOpenMedical={() => setCenterTab('HEALTHCARE_NET')}
          onOpenPinnacle={() => setCenterTab('PINNACLE_DERIVATIVES')}
          onOpenLedger={() => setCenterTab('LEDGER')}
          onOpenTrading={() => setCenterTab('TRADING_COMMAND')}
        />
      )}

      {/* Alert Notification Banner */}
      {alertBanner && (
        <div
          className={`px-4 py-2.5 text-xs font-mono font-medium flex items-center justify-between border-b ${
            alertBanner.type === 'ALERT'
              ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
              : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {alertBanner.type === 'ALERT' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            <span>{alertBanner.message}</span>
          </div>
          <button
            onClick={() => setAlertBanner(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Secondary Cyberdeck Utility Bar - only rendered inside Operator Cyberdeck */}
      {!isOutwardPortalMode && (
        <div className="bg-[#0B0F17] border-b border-slate-800/80 px-4 sm:px-6 py-2.5 sticky top-0 z-30 shadow-lg backdrop-blur-md">
          <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Left: Outward Portal Apps Navigation */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1 hidden lg:inline">MODES:</span>

              <button
                onClick={() => setCenterTab('PORTAL_LANDING')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shrink-0 cursor-pointer ${
                  centerTab === 'PORTAL_LANDING'
                    ? 'bg-blue-500/25 text-blue-200 border-blue-500/60 shadow-sm shadow-blue-500/20'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-800'
                }`}
              >
                <span>🌐</span>
                <span>Public Landing</span>
              </button>

              <button
                onClick={() => setCenterTab('HEALTHCARE_NET')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shrink-0 cursor-pointer ${
                  centerTab === 'HEALTHCARE_NET'
                    ? 'bg-rose-500/25 text-rose-200 border-rose-500/60 shadow-sm shadow-rose-500/20'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-800'
                }`}
              >
                <span>🩺</span>
                <span>Medical</span>
              </button>

              <button
                onClick={() => setCenterTab('TRADING_COMMAND')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shrink-0 cursor-pointer ${
                  centerTab === 'TRADING_COMMAND'
                    ? 'bg-emerald-500/25 text-emerald-200 border-emerald-500/60 shadow-sm shadow-emerald-500/20'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-800'
                }`}
              >
                <span>📈</span>
                <span>Exchanges</span>
              </button>

              <button
                onClick={() => setCenterTab('SOVEREIGN_ORIGIN_NODE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shrink-0 cursor-pointer ${
                  centerTab === 'SOVEREIGN_ORIGIN_NODE'
                    ? 'bg-indigo-500/25 text-indigo-200 border-indigo-500/60 shadow-sm shadow-indigo-500/20'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-800'
                }`}
              >
                <span>👑</span>
                <span>Origin Node</span>
              </button>
            </div>

            {/* Right: Operator Mode */}
            <div className="flex items-center gap-2 self-end md:self-auto shrink-0 font-mono">
              <button
                onClick={() => setCenterTab('SOVEREIGN_ORIGIN_NODE')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer bg-slate-900 text-slate-300 hover:text-white border-slate-800"
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Return to Origin</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Viewport: Outward Portal Presentation Mode vs Operator Cyberdeck Mode */}
      {isOutwardPortalMode ? (
        centerTab === 'PORTAL_LANDING' ? (
          <PublicLandingPortal
            onLaunchCyberdeck={() => setCenterTab('AEGENTIS_OS')}
            onLaunchOriginNode={() => setCenterTab('SOVEREIGN_ORIGIN_NODE')}
            onLaunchZeroCap={() => setCenterTab('ZERO_CAP_FLYWHEEL')}
            onLaunchSkillMatrix={() => setCenterTab('NEXUS_REGISTRY')}
            onLaunchAntiTrafficking={() => setCenterTab('ANTI_TRAFFICKING_SENTINEL')}
            onLaunchMedicalApp={() => setCenterTab('HEALTHCARE_NET')}
            onLaunchPinnacleApp={() => setCenterTab('PINNACLE_DERIVATIVES')}
            onLaunchJarvisBuilder={() => setCenterTab('JARVIS_BUILDER')}
            onLaunchTradingCommand={() => setCenterTab('TRADING_COMMAND')}
            onOpenLedger={() => setCenterTab('LEDGER')}
            onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
          />
        ) : (
          <main className="flex-1 p-3 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
            {/* TAB CONTENT: Anti-Human-Trafficking & Forced Labor Sentinel */}
            {centerTab === 'ANTI_TRAFFICKING_SENTINEL' && (
              <AntiTraffickingSentinelSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
                onBackToPortal={() => setCenterTab('PORTAL_LANDING')}
              />
            )}

            {/* TAB CONTENT: Jarvis App Studio (Visual Workflow Builder) */}
            {centerTab === 'JARVIS_BUILDER' && (
              <JarvisAppBuilderStudio
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
                onDeployApp={(deployedAppName) => {
                  setAlertBanner({ message: `Custom App "${deployedAppName}" deployed to portal!`, type: 'SUCCESS' });
                }}
              />
            )}

            {/* TAB CONTENT: Sovereign Healthcare Network (HIPAA-TSL Decoupled Web & API) */}
            {centerTab === 'HEALTHCARE_NET' && (
              <SovereignHealthcareView
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Pinnacle Derivatives (Public Facing B2B & Institutional Gateway) */}
            {centerTab === 'PINNACLE_DERIVATIVES' && (
              <PinnacleDerivativesSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Institutional Trading Command (Runbook, Playbooks, Signals & Quant Engine) */}
            {centerTab === 'TRADING_COMMAND' && (
              <InstitutionalTradingSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
                onOpenOmniCyberDex={() => setCenterTab('OMNICYBERDEX')}
                onOpenGrowthPlan={() => setCenterTab('PORTFOLIO_GROWTH_PLAN')}
              />
            )}

            {/* TAB CONTENT: Ledger */}
            {centerTab === 'LEDGER' && (
              <TransactionLedger transactions={transactions} />
            )}

            {/* TAB CONTENT: Nexus Skill Registry & NRCP Console */}
            {centerTab === 'NEXUS_REGISTRY' && (
              <NexusSkillRegistrySuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type: type === 'ERROR' ? 'ALERT' : type })}
              />
            )}

            {/* TAB CONTENT: Zero-Capital Self-Funding Flywheel & Autonomous Gas Tank */}
            {centerTab === 'ZERO_CAP_FLYWHEEL' && (
              <ZeroCapitalFlywheelSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Sovereign Origin Node & Multi-Runtime Mesh */}
            {centerTab === 'SOVEREIGN_ORIGIN_NODE' && (
              <SovereignOriginNodeSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Xaman (XUMM) XRPL Revenue Bridge & Zombie Wallet Engine */}
            {centerTab === 'XAMAN_REVENUE_BRIDGE' && (
              <XamanRevenueBridgeView
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
                onOpenFederalRegistry={() => setCenterTab('FEDERAL_CRYPTO')}
              />
            )}
          </main>
        )
      ) : (
        <main className="flex-1 p-3 sm:p-5 max-w-[1720px] w-full mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN: Controls, Bridges, Compliance (3 cols on 12-col grid) */}
          {!isExpandedCanvas && (
            <div className="lg:col-span-3">
              <AgentSidebar
                isAutopilot={isAutopilot}
                onToggleAutopilot={() => setIsAutopilot(!isAutopilot)}
                strategy={strategy}
                onSelectStrategy={setStrategy}
                maxSlippage={maxSlippage}
                onChangeMaxSlippage={setMaxSlippage}
                gasLimitGwei={gasLimitGwei}
                onChangeGasLimit={setGasLimitGwei}
                cycleIntervalSeconds={cycleIntervalSeconds}
                onChangeCycleInterval={setCycleIntervalSeconds}
                onRunAutonomousCycle={() => runAutonomousCycle()}
                isGeneratingSignal={isGeneratingSignal}
                onFormulateTopSignals={handleFormulateTopSignals}
                isFormulatingTopSignals={isFormulatingTopSignals}
                securityPostures={securityPostures}
                exchangeBridges={exchangeBridges}
                latestComplianceBlock={complianceChain[complianceChain.length - 1]}
                onOpenPromptModal={() => setIsPromptModalOpen(true)}
              />
            </div>
          )}

          {/* CENTER COLUMN: Full 12 cols when canvas expanded, or 6 cols in triage mode */}
          <div className={`${isExpandedCanvas ? 'lg:col-span-12' : 'lg:col-span-6'} space-y-5`}>
            {/* Unified Net Worth Visualizer */}
            <PortfolioOverview
              balances={balances}
              onQuickRebalance={handleQuickRebalance}
              onOpenGrowthPlan={() => setCenterTab('PORTFOLIO_GROWTH_PLAN')}
            />

            {/* Hierarchical Pillar & Module Workspace Navigator */}
            <WorkspaceNavigator
              activeTab={centerTab}
              onSelectTab={setCenterTab}
              onOpenTocModal={() => setIsTocModalOpen(true)}
              isExpandedCanvas={isExpandedCanvas}
              onToggleExpandedCanvas={() => setIsExpandedCanvas(!isExpandedCanvas)}
            />

            {/* TAB CONTENT: AEGENTIS-X 5-Layer Sovereign OS & AXL Engine */}
            {centerTab === 'AEGENTIS_OS' && (
              <AegentisOSSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Herdr Agent Herd Clustering & Peer Discovery Engine */}
            {centerTab === 'HERDR' && (
              <HerdrClusterView />
            )}

            {/* TAB CONTENT: ROG Ally X Free Creator System & Creator Compatibility Adapter (CCA) */}
            {centerTab === 'ROG_CREATOR_SYSTEM' && (
              <RogCreatorSystemView />
            )}

            {/* TAB CONTENT: AI Studio Desktop & Device Sandbox Mapping Suite */}
            {centerTab === 'DEVICE_SANDBOX_MAPPING' && (
              <DesktopDeviceMappingSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
                onOpenRogSystem={() => setCenterTab('ROG_CREATOR_SYSTEM')}
              />
            )}

            {/* TAB CONTENT: Halo CE Immersive Contact First-Person Visor View */}
            {centerTab === 'HALO_CE_VISOR' && (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-cyan-950/70 border border-emerald-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Crosshair className="w-4 h-4 text-emerald-400" />
                        <span>Halo CE &middot; MJOLNIR Mark V Immersive Contact First-Person Visor</span>
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        cybersecurity/halo-ce-universal &middot; Captain&apos;s Space Lounge
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Direct tactical combat HUD integration for <b>cybersecurity/halo-ce-universal</b> featuring the <b>Captain&apos;s Cannabis Smoking Lounge</b> immersive video render: downward reverse ventilation vortex, sacred ash canisters soil amendment, living plant grow wall, and orbital Earth deep space vista behind the MJOLNIR Mark V visor.
                    </p>
                  </div>
                </div>

                <HaloCeVisorFPV
                  onExecuteTrade={(pair, action) => executeSignal(signals[0]?.id || '')}
                  onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
                />
              </div>
            )}

            {/* TAB CONTENT: Cybernetic Autonomous & Hygienic Engine */}
            {centerTab === 'CYBERNETICS' && (
              <CyberneticSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
                onOpenSovereignCommand={() => setCenterTab('SOVEREIGN_COMMAND')}
              />
            )}

            {/* TAB CONTENT: AEGIS-7 Coordinate Cipher Protocol */}
            {centerTab === 'AEGIS_CIPHER' && (
              <AegisCipherProtocolView
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Agent Workforce Endpoint Security (EDR/XDR) */}
            {centerTab === 'ENDPOINT_SECURITY' && (
              <AgentEndpointSecuritySuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Google Drive Asset Aggregator */}
            {centerTab === 'GOOGLE_DRIVE' && (
              <DriveAggregator
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Gmail Inbox & Notification Dispatcher */}
            {centerTab === 'GMAIL' && (
              <GmailInboxViewer
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Risk Management & VaR Dashboard */}
            {centerTab === 'RISK_DASHBOARD' && (
              <RiskManagementDashboard
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: AutoHedge Swarm Architecture */}
            {centerTab === 'AUTOHEDGE' && (
              <AutoHedgeSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Autonomous Agent Mesh */}
            {centerTab === 'AGENT_MESH' && (
              <AgentMesh
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
                onOpenGitHubForge={() => setCenterTab('GITHUB_FORGE')}
              />
            )}

            {/* TAB CONTENT: Symphony Event Bus & Conductor */}
            {centerTab === 'SYMPHONY' && (
              <SymphonyConductor
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Compliance Chain Risk Heatmap */}
            {centerTab === 'HEATMAP' && (
              <ComplianceHeatmap
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Moltbook AI Agent Hub */}
            {centerTab === 'MOLTBOOK' && (
              <MoltbookHub
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Live Telemetry & Real-Time NAV Suite */}
            {centerTab === 'LIVE_TELEMETRY' && (
              <LiveTelemetryNavSuite
                onTriggerEventAlpha={(pair) => runAutonomousCycle(pair)}
              />
            )}

            {/* TAB CONTENT: OODA Proactive Autonomous Suite */}
            {centerTab === 'OODA_LOOP' && (
              <OodaAutonomousSuite
                oodaState={oodaState}
                onTriggerPulse={handleTriggerHeartbeatPulse}
                isPulsing={isPulsingHeartbeat}
                marketAssets={marketFeed}
              />
            )}

            {/* TAB CONTENT: Top Formulated Signals (System 1 Engine) */}
            {centerTab === 'TOP_SIGNALS' && (
              <>
                <TopSignalsLeaderboard
                  signals={signals}
                  onExecuteSignal={executeSignal}
                  onBatchExecuteTop={handleBatchExecuteTop}
                  onFormulateTopSignals={handleFormulateTopSignals}
                  isExecuting={isExecutingTrade}
                  isFormulating={isFormulatingTopSignals}
                />

                <MarketResearcher
                  assets={marketFeed}
                  onAnalyzeAsset={(symbol) => runAutonomousCycle(symbol)}
                  isAnalyzing={isGeneratingSignal}
                  onRefreshData={fetchState}
                />
              </>
            )}

            {/* TAB CONTENT: Market Researcher View */}
            {centerTab === 'RESEARCHER' && (
              <MarketResearcher
                assets={marketFeed}
                onAnalyzeAsset={(symbol) => runAutonomousCycle(symbol)}
                isAnalyzing={isGeneratingSignal}
                onRefreshData={fetchState}
              />
            )}

            {/* TAB CONTENT: Meta-Cognitive Reflexive Engine & Introspector */}
            {centerTab === 'META_COGNITIVE' && (
              <MetaCognitiveEngine
                signals={signals}
                onTriggerSelfOptimization={() => {
                  setAlertBanner({ message: 'Meta-Cognitive reflection cycle complete. Introspective calibration synchronized.', type: 'SUCCESS' });
                }}
              />
            )}

            {/* TAB CONTENT: Space Bunny Alpha Stealth Model Suite */}
            {centerTab === 'SPACE_BUNNY_ALPHA' && (
              <SpaceBunnyAlphaSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
                onExecuteStealthRoute={(pair, yieldUsd) => {
                  setAlertBanner({ message: `Space Bunny Alpha executed stealth private arbitrage on ${pair} (+$${yieldUsd.toFixed(2)} USD).`, type: 'SUCCESS' });
                }}
              />
            )}

            {/* TAB CONTENT: All Signals Queue */}
            {centerTab === 'ALL_FEEDS' && (
              <AutonomousSignalsFeed
                signals={signals}
                onExecuteSignal={executeSignal}
                isExecuting={isExecutingTrade}
              />
            )}

            {/* TAB CONTENT: Ledger */}
            {centerTab === 'LEDGER' && (
              <TransactionLedger transactions={transactions} />
            )}

            {/* TAB CONTENT: Eagle User Profile Map (140+ Workstation Artifacts) */}
            {centerTab === 'USER_PROFILE_MAP' && (
              <EagleUserProfileMapView
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
                onOpenMoEDefense={() => setCenterTab('AGENTS_OF_CHAOS')}
              />
            )}

            {/* TAB CONTENT: Agents of Chaos MoE Defense System (AgentsOfChaosMoE.ps1) */}
            {centerTab === 'AGENTS_OF_CHAOS' && (
              <AgentsOfChaosMoEView
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Sovereign Command 48m Expedition Platform & AI Security Division */}
            {centerTab === 'SOVEREIGN_COMMAND' && (
              <SovereignCommandView
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: FAA-SOV Class License & Sovereign Operations Certification */}
            {centerTab === 'FAA_SOV_LICENSE' && (
              <FaaSovLicenseView
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Sovereign Portal & Sovereign Kernel Operations Console (Manus Suite) */}
            {centerTab === 'SOVEREIGN_PORTAL' && (
              <SovereignPortalSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
                onOpenFaaLicense={() => setCenterTab('FAA_SOV_LICENSE')}
                onOpenSovereignCommand={() => setCenterTab('SOVEREIGN_COMMAND')}
              />
            )}

            {/* TAB CONTENT: OmniCyberDex Master Orchestrator (Dual Engine) */}
            {centerTab === 'OMNICYBERDEX' && (
              <OmniCyberDexOrchestratorView
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Sovereign Healthcare Network (HIPAA-TSL Decoupled Web & API) */}
            {centerTab === 'HEALTHCARE_NET' && (
              <SovereignHealthcareView
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Federal Registered Crypto Nodes & Tokens (OCC, NYDFS, FinCEN, FedNow) */}
            {centerTab === 'FEDERAL_CRYPTO' && (
              <FederalCryptoRegistryView
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Pinnacle Derivatives (Public Facing B2B & Institutional Gateway) */}
            {centerTab === 'PINNACLE_DERIVATIVES' && (
              <PinnacleDerivativesSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Institutional Trading Command (Runbook, Playbooks, Signals & Quant Engine) */}
            {centerTab === 'TRADING_COMMAND' && (
              <InstitutionalTradingSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
                onOpenOmniCyberDex={() => setCenterTab('OMNICYBERDEX')}
                onOpenGrowthPlan={() => setCenterTab('PORTFOLIO_GROWTH_PLAN')}
              />
            )}

            {/* TAB CONTENT: Portfolio Growth Chart Plan with all Trading & CyberGym Credentials */}
            {centerTab === 'PORTFOLIO_GROWTH_PLAN' && (
              <PortfolioGrowthPlanSuite
                currentNetWorthUsd={balances.totalUsd}
                onNotify={(msg, type) => {
                  const mappedType = type === 'ALERT' ? 'ALERT' : type === 'WARN' ? 'ALERT' : type === 'SUCCESS' ? 'SUCCESS' : 'INFO';
                  setAlertBanner({ message: msg, type: mappedType });
                }}
                onOpenTradingCommand={() => setCenterTab('TRADING_COMMAND')}
                onOpenCyberGym={() => setCenterTab('CYBERGYM_PROGRESSION')}
              />
            )}

            {/* TAB CONTENT: DAG Federal Node Status (Sync Status, Peers, Current Block Height, Throughput) */}
            {centerTab === 'DAG_FEDERAL_NODE_STATUS' && (
              <DagFederalNodeStatus
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Federal Compliance Enclave & Inducted Gov Opportunities Pipeline */}
            {centerTab === 'GOV_OPPORTUNITIES' && (
              <FederalComplianceGovSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: CyberGym Agent Achievement & Progression System */}
            {centerTab === 'CYBERGYM_PROGRESSION' && (
              <CyberGymProgressionSuite
                onNotify={(msg, type) => {
                  const mappedType = type === 'ALERT' ? 'ALERT' : type === 'WARN' ? 'ALERT' : type === 'SUCCESS' ? 'SUCCESS' : 'INFO';
                  setAlertBanner({ message: msg, type: mappedType });
                }}
                onOpenMesh={() => setCenterTab('AGENT_MESH')}
                onOpenCompliance={() => setCenterTab('GOV_OPPORTUNITIES')}
                onOpenGrowthPlan={() => setCenterTab('PORTFOLIO_GROWTH_PLAN')}
              />
            )}

            {/* TAB CONTENT: Agentic America (.gov) Digital Innovation, Civilian Labs & CyberGym */}
            {centerTab === 'AGENTIC_AMERICA' && (
              <AgenticAmericaView
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
                onOpenMesh={() => setCenterTab('AGENT_MESH')}
                onOpenCompliance={() => setCenterTab('GOV_OPPORTUNITIES')}
                onOpenGitHubForge={() => setCenterTab('GITHUB_FORGE')}
              />
            )}

            {/* TAB CONTENT: Sovereign GitHub Forge (shalominattii-us 88 Repositories) */}
            {centerTab === 'GITHUB_FORGE' && (
              <SovereignGitHubForgeSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
                onOpenMesh={() => setCenterTab('AGENT_MESH')}
                onOpenCyberGym={() => setCenterTab('AGENTIC_AMERICA')}
                onOpenCyberDAW={() => setCenterTab('SYMPHONY')}
              />
            )}

            {/* TAB CONTENT: Kolibri Offline Learning & Sovereign Repository */}
            {centerTab === 'KOLIBRI_PLATFORM' && (
              <KolibriOfflineSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Nexus Skill Registry & NRCP Console */}
            {centerTab === 'NEXUS_REGISTRY' && (
              <NexusSkillRegistrySuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type: type === 'ERROR' ? 'ALERT' : type })}
              />
            )}

            {/* TAB CONTENT: Zero-Capital Self-Funding Flywheel & Autonomous Gas Tank */}
            {centerTab === 'ZERO_CAP_FLYWHEEL' && (
              <ZeroCapitalFlywheelSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Sovereign Origin Node & Multi-Runtime Mesh */}
            {centerTab === 'SOVEREIGN_ORIGIN_NODE' && (
              <SovereignOriginNodeSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
              />
            )}

            {/* TAB CONTENT: Anti-Human-Trafficking & Forced Labor Sentinel */}
            {centerTab === 'ANTI_TRAFFICKING_SENTINEL' && (
              <AntiTraffickingSentinelSuite
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
                onBackToPortal={() => setCenterTab('PORTAL_LANDING')}
              />
            )}

            {/* TAB CONTENT: Xaman (XUMM) XRPL Revenue Bridge & Zombie Wallet Engine */}
            {centerTab === 'XAMAN_REVENUE_BRIDGE' && (
              <XamanRevenueBridgeView
                onNotify={(msg, type) => setAlertBanner({ message: msg, type })}
                onOpenFederalRegistry={() => setCenterTab('FEDERAL_CRYPTO')}
              />
            )}

            {/* Show Ledger Summary under Top Signals if desired */}
            {centerTab === 'TOP_SIGNALS' && (
              <TransactionLedger transactions={transactions.slice(0, 5)} />
            )}
          </div>

          {/* RIGHT COLUMN: Heretic LLM Console & Execution Feed (3 cols) */}
          {!isExpandedCanvas && (
            <div className="lg:col-span-3 sticky top-16">
              <HereticConsole
                logs={thoughtLogs}
                onClearLogs={() => setThoughtLogs([])}
                isAutopilot={isAutopilot}
              />
            </div>
          )}
        </div>
      </main>
    )}

      {/* Interactive Modals */}
      <PromptTemplateModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        onTestInference={(symbol) => {
          setIsPromptModalOpen(false);
          runAutonomousCycle(symbol);
        }}
        assets={marketFeed}
        isTesting={isGeneratingSignal}
      />

      <HardwareSignOffModal
        isOpen={isHardwareModalOpen}
        onConfirm={handleConfirmHardwareSign}
        onReject={() => {
          setIsHardwareModalOpen(false);
          setPendingHardwareTrade(null);
        }}
        tradeDetails={pendingHardwareTrade}
      />

      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        connectedWallet={connectedWallet}
        onConnectWallet={(type, address) => {
          setConnectedWallet({ type, address });
          setIsWalletModalOpen(false);
        }}
        onDisconnectWallet={() => setConnectedWallet(null)}
      />

      {/* Table of Contents Modal */}
      <TableOfContentsModal
        isOpen={isTocModalOpen}
        onClose={() => setIsTocModalOpen(false)}
        activeTab={centerTab}
        onSelectTab={(tabId) => setCenterTab(tabId)}
      />

      {/* Export Application Codebase Modal */}
      <ExportAppModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onOpenGitHubForge={() => setCenterTab('GITHUB_FORGE')}
      />

      {/* Grok (xAI) Production Auditor & Assistant Modal */}
      <GrokAuditModal
        isOpen={isGrokModalOpen}
        onClose={() => setIsGrokModalOpen(false)}
        onNotify={(msg, type) => setAlertBanner({ message: msg, type: type === 'ERROR' ? 'ALERT' : type })}
      />
    </div>
  );
}
