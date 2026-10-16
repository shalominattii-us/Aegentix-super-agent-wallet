import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Sliders,
  Sparkles,
  Zap,
  Activity,
  Layers,
  Cpu,
  ShieldCheck,
  Share2,
  Brain,
  RotateCcw,
  Music,
  Flame,
  Radio,
  Clock,
  Gauge,
  SlidersHorizontal,
  Download,
  FolderDown,
  Check,
  Copy,
  ExternalLink,
  Disc,
  Settings2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileCode,
  Terminal,
  Video,
  VideoOff,
  Camera,
  Tv,
  Film,
  MonitorPlay,
  Wand2,
  CheckCircle2,
  Music2,
} from 'lucide-react';
import {
  ABLETON_REMOTE_SCRIPT_PYTHON,
  ABLETON_REMOTE_SCRIPT_INIT,
  ABLETON_OSC_INSTRUCTIONS,
} from '../utils/abletonRemoteScript';

export interface DAWTrack {
  id: string;
  name: string;
  role: string;
  color: string;
  accentBg: string;
  icon: 'BRAIN' | 'JUDGE' | 'TELEMETRY' | 'ARGON' | 'DAG' | 'EXECUTION';
  volume: number; // 0 - 1
  pan: number; // -1 to 1
  muted: boolean;
  soloed: boolean;
  soundType: 'SYNTH_LEAD' | 'SUB_BASS' | 'PERCUSSION' | 'PAD' | 'METALLIC' | 'ACID_PLUCK';
  baseFreq: number;
  baseMidiNote: number; // MIDI note pitch 0-127
  colorIndex: number; // Ableton Live color palette index (1-60)
  steps: boolean[]; // 16 steps
}

interface SymphonyCyberDAWProps {
  onNotify?: (message: string, type: 'ALERT' | 'SUCCESS' | 'INFO') => void;
  externalTriggerEvent?: { source: string; payload: string; timestamp: number } | null;
}

const PRESET_PATTERNS: Record<string, { bpm: number; tracks: Array<{ id: string; steps: boolean[]; volume?: number }> }> = {
  NEON_CONSENSUS_132: {
    bpm: 132,
    tracks: [
      { id: 'track-brain', steps: [true, false, false, true, false, false, true, false, true, false, false, true, false, true, false, false] },
      { id: 'track-judge', steps: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false] },
      { id: 'track-telemetry', steps: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, true] },
      { id: 'track-argon', steps: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false] },
      { id: 'track-dag', steps: [false, true, false, false, false, true, false, true, false, true, false, false, false, true, true, false] },
      { id: 'track-execution', steps: [false, false, true, true, false, false, true, true, false, false, true, true, false, true, false, true] },
    ],
  },
  SOVEREIGN_CYBER_ENCLAVE_118: {
    bpm: 118,
    tracks: [
      { id: 'track-brain', steps: [false, false, true, false, false, false, false, true, false, false, true, false, false, false, false, false] },
      { id: 'track-judge', steps: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, true, false] },
      { id: 'track-telemetry', steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false] },
      { id: 'track-argon', steps: [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] },
      { id: 'track-dag', steps: [false, false, true, false, false, true, false, false, false, false, true, false, false, true, false, false] },
      { id: 'track-execution', steps: [false, false, false, false, false, false, true, false, false, false, false, false, false, false, true, false] },
    ],
  },
  HIGH_FREQUENCY_ARBITRAGE_144: {
    bpm: 144,
    tracks: [
      { id: 'track-brain', steps: [true, true, false, true, true, false, true, true, false, true, true, false, true, true, true, false] },
      { id: 'track-judge', steps: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false] },
      { id: 'track-telemetry', steps: [true, false, true, false, true, false, true, false, true, false, true, false, true, true, true, true] },
      { id: 'track-argon', steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false] },
      { id: 'track-dag', steps: [false, true, true, false, false, true, true, false, false, true, true, false, false, true, true, false] },
      { id: 'track-execution', steps: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true] },
    ],
  },
};

export const SymphonyCyberDAW: React.FC<SymphonyCyberDAWProps> = ({
  onNotify,
  externalTriggerEvent,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(132);
  const [masterVolume, setMasterVolume] = useState(0.85);
  const [filterCutoff, setFilterCutoff] = useState(4800);
  const [filterResonance, setFilterResonance] = useState(3.5);
  const [isSonifyingLiveEvents, setIsSonifyingLiveEvents] = useState(true);
  const [activePreset, setActivePreset] = useState('NEON_CONSENSUS_132');

  // Ableton Live Master Suite State
  const [isAbletonSectionOpen, setIsAbletonSectionOpen] = useState(true);
  const [masteringStyle, setMasteringStyle] = useState<'HIGH_ENERGY_MASTER' | 'STREAMING_SPOTIFY' | 'CLUB_SUB_HEAVY' | 'AMBIENT_CLEAN'>('HIGH_ENERGY_MASTER');
  const [isExportingAls, setIsExportingAls] = useState(false);
  const [isExportingMid, setIsExportingMid] = useState(false);
  const [copiedCodeLabel, setCopiedCodeLabel] = useState<string | null>(null);

  // OBS Studio Broadcast Suite State
  const [isObsSectionOpen, setIsObsSectionOpen] = useState(true);
  const [obsStatus, setObsStatus] = useState<{
    processRunning: boolean;
    pid?: number;
    connected: boolean;
    recording: boolean;
    recordTimecode?: string;
    streaming: boolean;
    streamTimecode?: string;
    virtualCamActive: boolean;
    currentProgramScene?: string;
    fps?: number;
    cpuUsage?: number;
    memoryUsageMB?: number;
    availableDiskSpaceMB?: number;
  }>({
    processRunning: false,
    connected: false,
    recording: false,
    streaming: false,
    virtualCamActive: false,
  });
  const [isLaunchingObs, setIsLaunchingObs] = useState(false);
  const [isObsActionBusy, setIsObsActionBusy] = useState(false);
  const [customSceneInput, setCustomSceneInput] = useState('');

  // Music Production & Industry Suites State
  const [isProductionSuiteOpen, setIsProductionSuiteOpen] = useState(true);
  const [activeProductionTab, setActiveProductionTab] = useState<'MASTERING_CONFIGS' | 'OBS_AUDIO_MIXER' | 'CHORD_VAULT' | 'APEX_STREAM_DECK'>('MASTERING_CONFIGS');
  const [industryConfigs, setIndustryConfigs] = useState<any[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('izotope-ozone-11-club-maximizer');
  const [obsAudioInputs, setObsAudioInputs] = useState<any[]>([]);
  const [chordVault, setChordVault] = useState<any[]>([]);
  const [selectedChordGenre, setSelectedChordGenre] = useState<string>('ALL');
  const [isApplyingMastering, setIsApplyingMastering] = useState(false);
  const [isApplyingDspRack, setIsApplyingDspRack] = useState<string | null>(null);

  // Apex Legends LiveAPI & OBS Streaming State
  const [apexState, setApexState] = useState<any>({
    connected: false,
    gameStatus: 'LOBBY',
    squadsRemaining: 20,
    playersRemaining: 60,
    ringStage: 1,
    mySquad: { kills: 0, damage: 0 },
    recentEvents: [],
  });
  const [isDeployingApexOverlay, setIsDeployingApexOverlay] = useState(false);

  // Web MIDI API State
  const [midiDevices, setMidiDevices] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedMidiDevice, setSelectedMidiDevice] = useState<string>('');
  const [isMidiActive, setIsMidiActive] = useState(false);
  const [midiAccessInstance, setMidiAccessInstance] = useState<any>(null);
  const midiOutputRef = useRef<any>(null);

  // Tracks State
  const [tracks, setTracks] = useState<DAWTrack[]>([
    {
      id: 'track-brain',
      name: 'Heretic Core',
      role: 'INFERENCE_LEAD_SYNTH',
      color: '#06B6D4', // Cyan
      accentBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      icon: 'BRAIN',
      volume: 0.8,
      pan: -0.2,
      muted: false,
      soloed: false,
      soundType: 'SYNTH_LEAD',
      baseFreq: 440, // A4
      baseMidiNote: 69, // A4
      colorIndex: 48,
      steps: [true, false, false, true, false, false, true, false, true, false, false, true, false, true, false, false],
    },
    {
      id: 'track-judge',
      name: 'Sovereign Judge',
      role: 'HMAC_SUB_BASS',
      color: '#10B981', // Emerald
      accentBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      icon: 'JUDGE',
      volume: 0.9,
      pan: 0.0,
      muted: false,
      soloed: false,
      soundType: 'SUB_BASS',
      baseFreq: 55, // A1
      baseMidiNote: 33, // A1
      colorIndex: 12,
      steps: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
    },
    {
      id: 'track-telemetry',
      name: 'Orderbook Ingest',
      role: 'TICK_PERCUSSION',
      color: '#F59E0B', // Amber
      accentBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      icon: 'TELEMETRY',
      volume: 0.75,
      pan: 0.3,
      muted: false,
      soloed: false,
      soundType: 'PERCUSSION',
      baseFreq: 800,
      baseMidiNote: 42, // F#1 / Closed Hi-Hat
      colorIndex: 24,
      steps: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, true],
    },
    {
      id: 'track-argon',
      name: 'Gemini 4 Argon',
      role: 'QUANTUM_CHORD_PAD',
      color: '#38BDF8', // Sky Blue
      accentBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      icon: 'ARGON',
      volume: 0.7,
      pan: -0.4,
      muted: false,
      soloed: false,
      soundType: 'PAD',
      baseFreq: 220, // A3
      baseMidiNote: 60, // C4
      colorIndex: 40,
      steps: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false],
    },
    {
      id: 'track-dag',
      name: 'Federal DAG',
      role: 'CONSENSUS_CLAVE',
      color: '#F43F5E', // Rose
      accentBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      icon: 'DAG',
      volume: 0.7,
      pan: 0.4,
      muted: false,
      soloed: false,
      soundType: 'METALLIC',
      baseFreq: 1200,
      baseMidiNote: 72, // C5
      colorIndex: 3,
      steps: [false, true, false, false, false, true, false, true, false, true, false, false, false, true, true, false],
    },
    {
      id: 'track-execution',
      name: 'OmniCyberDex',
      role: 'HIGH_FREQ_ACID_ARP',
      color: '#A855F7', // Purple
      accentBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      icon: 'EXECUTION',
      volume: 0.8,
      pan: 0.1,
      muted: false,
      soloed: false,
      soundType: 'ACID_PLUCK',
      baseFreq: 660, // E5
      baseMidiNote: 45, // A2
      colorIndex: 56,
      steps: [false, false, true, true, false, false, true, true, false, false, true, true, false, true, false, true],
    },
  ]);

  // Web Audio Context & Nodes References
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sequencer Timing References
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentStepRef = useRef(0);
  const isPlayingRef = useRef(false);

  // Ableton Live 12 Real-Time IPC & Control Surface Telemetry
  const [abletonStatus, setAbletonStatus] = useState<{
    running: boolean;
    pid?: number;
    socketConnected: boolean;
    liveBpm?: number;
    livePlaying?: boolean;
    liveTracksCount?: number;
  }>({ running: false, socketConnected: false });
  const [isLaunchingAbleton, setIsLaunchingAbleton] = useState(false);
  const [isInjectingToLive, setIsInjectingToLive] = useState(false);

  // Poll Ableton process & OBS broadcast telemetry every 3 seconds
  useEffect(() => {
    let isMounted = true;
    const checkTelemetry = async () => {
      try {
        const [abletonRes, obsRes] = await Promise.allSettled([
          fetch('/api/cyberdaw/ableton/status'),
          fetch('/api/obs/status'),
        ]);

        if (abletonRes.status === 'fulfilled' && abletonRes.value.ok) {
          const data = await abletonRes.value.json();
          if (isMounted) {
            setAbletonStatus({
              running: Boolean(data.process?.running),
              pid: data.process?.pid,
              socketConnected: Boolean(data.socketBridge?.connected),
              liveBpm: data.liveState?.tempo,
              livePlaying: data.liveState?.is_playing,
              liveTracksCount: data.liveState?.tracks?.length,
            });
          }
        }

        if (obsRes.status === 'fulfilled' && obsRes.value.ok) {
          const data = await obsRes.value.json();
          if (isMounted && data.status) {
            setObsStatus(data.status);
          }
        }
      } catch (err) {
        // server offline or polling error
      }
    };
    checkTelemetry();
    const interval = setInterval(checkTelemetry, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch production datasets and industry configs
  const refreshObsAudioMixer = useCallback(() => {
    fetch('/api/obs/audio-mixer')
      .then(res => res.json())
      .then(data => {
        if (data.inputs) setObsAudioInputs(data.inputs);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/production/industry-configs')
      .then(res => res.json())
      .then(data => {
        if (data.configs) setIndustryConfigs(data.configs);
      })
      .catch(() => {});

    fetch('/api/production/datasets')
      .then(res => res.json())
      .then(data => {
        if (data.progressions) setChordVault(data.progressions);
      })
      .catch(() => {});

    refreshObsAudioMixer();
    const interval = setInterval(refreshObsAudioMixer, 4000);

    const checkApex = () => {
      fetch('/api/apex/status')
        .then(res => res.json())
        .then(data => {
          if (data?.state) setApexState(data.state);
        })
        .catch(() => {});
    };
    checkApex();
    const apexInterval = setInterval(checkApex, 2500);

    return () => {
      clearInterval(interval);
      clearInterval(apexInterval);
    };
  }, [refreshObsAudioMixer]);

  // Refresh available Web MIDI output ports
  const refreshMidiPorts = useCallback(() => {
    if (typeof navigator !== 'undefined' && (navigator as any).requestMIDIAccess) {
      (navigator as any).requestMIDIAccess({ sysex: false })
        .then((midiAccess: any) => {
          setMidiAccessInstance(midiAccess);
          const outputs: Array<{ id: string; name: string }> = [];
          midiAccess.outputs.forEach((port: any) => {
            outputs.push({ id: port.id, name: port.name || `MIDI Port ${port.id}` });
          });
          setMidiDevices(outputs);
          if (outputs.length > 0) {
            setSelectedMidiDevice(prev => {
              const target = outputs.find(o => o.id === prev) ? prev : outputs[0].id;
              midiOutputRef.current = midiAccess.outputs.get(target);
              setIsMidiActive(true);
              return target;
            });
            if (onNotify) onNotify(`Detected ${outputs.length} MIDI Port(s): ${outputs.map(o => o.name).join(', ')}`, 'SUCCESS');
          }

          midiAccess.onstatechange = () => {
            const updated: Array<{ id: string; name: string }> = [];
            midiAccess.outputs.forEach((port: any) => {
              updated.push({ id: port.id, name: port.name || `MIDI Port ${port.id}` });
            });
            setMidiDevices(updated);
            if (updated.length > 0) {
              setSelectedMidiDevice(prev => {
                const target = updated.find(o => o.id === prev) ? prev : updated[0].id;
                midiOutputRef.current = midiAccess.outputs.get(target);
                setIsMidiActive(true);
                return target;
              });
            }
          };
        })
        .catch(() => {
          console.warn('[WebMIDI] No MIDI Access granted or hardware available');
        });
    }
  }, [onNotify]);

  // Initialize Web MIDI API
  useEffect(() => {
    refreshMidiPorts();
  }, [refreshMidiPorts]);

  const handleMidiDeviceChange = (devId: string) => {
    setSelectedMidiDevice(devId);
    if (midiAccessInstance) {
      const port = midiAccessInstance.outputs.get(devId);
      midiOutputRef.current = port;
      setIsMidiActive(Boolean(port));
      if (onNotify && port) {
        onNotify(`Linked Ableton Live MIDI Output: ${port.name}`, 'SUCCESS');
      }
    }
  };

  // Initialize Web Audio Engine
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const ctx = new AudioCtxClass();
        const masterGain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        const analyser = ctx.createAnalyser();

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterCutoff, ctx.currentTime);
        filter.Q.setValueAtTime(filterResonance, ctx.currentTime);

        analyser.fftSize = 256;
        masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);

        filter.connect(masterGain);
        masterGain.connect(analyser);
        analyser.connect(ctx.destination);

        audioCtxRef.current = ctx;
        masterGainRef.current = masterGain;
        filterNodeRef.current = filter;
        analyserRef.current = analyser;
      }
    } else if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, [filterCutoff, filterResonance, masterVolume]);

  // Update Master Controls
  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setValueAtTime(masterVolume, audioCtxRef.current.currentTime);
    }
  }, [masterVolume]);

  useEffect(() => {
    if (filterNodeRef.current && audioCtxRef.current) {
      filterNodeRef.current.frequency.setValueAtTime(filterCutoff, audioCtxRef.current.currentTime);
      filterNodeRef.current.Q.setValueAtTime(filterResonance, audioCtxRef.current.currentTime);
    }
    // Also send CC 74 (Filter Cutoff) to connected Ableton MIDI port
    if (midiOutputRef.current) {
      const ccVal = Math.min(127, Math.floor((filterCutoff / 16000) * 127));
      midiOutputRef.current.send([0xB0, 74, ccVal]);
    }
  }, [filterCutoff, filterResonance]);

  // Trigger sound generator for a specific track
  const playTrackSound = (track: DAWTrack, time: number) => {
    if (!audioCtxRef.current || !filterNodeRef.current) return;
    const ctx = audioCtxRef.current;

    const trackGain = ctx.createGain();
    trackGain.gain.setValueAtTime(track.volume, time);

    if (track.soundType === 'SUB_BASS') {
      // 808 Sub-Bass Pitch Sweep
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(track.baseFreq * 1.5, time);
      osc.frequency.exponentialRampToValueAtTime(track.baseFreq, time + 0.08);

      trackGain.gain.setValueAtTime(track.volume * 1.2, time);
      trackGain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

      osc.connect(trackGain);
      trackGain.connect(filterNodeRef.current);
      osc.start(time);
      osc.stop(time + 0.45);
    } else if (track.soundType === 'SYNTH_LEAD') {
      // Neuro Lead with Filter Sweep
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(track.baseFreq, time);
      osc2.frequency.setValueAtTime(track.baseFreq * 1.01, time); // detuned chorus

      trackGain.gain.setValueAtTime(track.volume * 0.7, time);
      trackGain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

      osc1.connect(trackGain);
      osc2.connect(trackGain);
      trackGain.connect(filterNodeRef.current);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + 0.25);
      osc2.stop(time + 0.25);
    } else if (track.soundType === 'PERCUSSION') {
      // Cyber Percussive Noise Click / Snare
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const pFilter = ctx.createBiquadFilter();
      pFilter.type = 'bandpass';
      pFilter.frequency.setValueAtTime(track.baseFreq, time);
      pFilter.Q.setValueAtTime(4.0, time);

      trackGain.gain.setValueAtTime(track.volume * 1.1, time);
      trackGain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);

      noise.connect(pFilter);
      pFilter.connect(trackGain);
      trackGain.connect(filterNodeRef.current);

      noise.start(time);
      noise.stop(time + 0.08);
    } else if (track.soundType === 'PAD') {
      // Quantum Warm Pad
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(track.baseFreq, time);

      trackGain.gain.setValueAtTime(0.01, time);
      trackGain.gain.linearRampToValueAtTime(track.volume * 0.6, time + 0.05);
      trackGain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);

      osc.connect(trackGain);
      trackGain.connect(filterNodeRef.current);
      osc.start(time);
      osc.stop(time + 0.6);
    } else if (track.soundType === 'METALLIC') {
      // Hypergraph Resonant Ring
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(track.baseFreq, time);

      trackGain.gain.setValueAtTime(track.volume * 0.7, time);
      trackGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

      osc.connect(trackGain);
      trackGain.connect(filterNodeRef.current);
      osc.start(time);
      osc.stop(time + 0.18);
    } else if (track.soundType === 'ACID_PLUCK') {
      // 303 High Resonance Pluck
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(track.baseFreq, time);

      trackGain.gain.setValueAtTime(track.volume * 0.85, time);
      trackGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

      osc.connect(trackGain);
      trackGain.connect(filterNodeRef.current);
      osc.start(time);
      osc.stop(time + 0.12);
    }
  };

  // Step Sequencer Engine Loop
  const runSequencerStep = useCallback(() => {
    if (!isPlayingRef.current) return;

    const step = currentStepRef.current;
    setCurrentStep(step);

    const hasAnySolo = tracks.some(t => t.soloed);

    tracks.forEach((track, trackIdx) => {
      const isAudible = hasAnySolo ? track.soloed : !track.muted;
      if (isAudible && track.steps[step]) {
        playTrackSound(track, audioCtxRef.current?.currentTime || 0);

        // Real-time MIDI Stream to connected Ableton Port
        if (midiOutputRef.current) {
          const ch = trackIdx & 0x0F;
          const note = track.baseMidiNote || 60;
          const vel = step % 4 === 0 ? 115 : 100;
          // Send Note On
          midiOutputRef.current.send([0x90 | ch, note, vel]);
          // Schedule Note Off after 120ms
          setTimeout(() => {
            if (midiOutputRef.current) {
              midiOutputRef.current.send([0x80 | ch, note, 0x00]);
            }
          }, 120);
        }
      }
    });

    currentStepRef.current = (step + 1) % 16;

    // 16th note interval at given BPM: (60 / BPM) / 4 * 1000
    const stepDurationMs = ((60 / bpm) / 4) * 1000;
    stepTimerRef.current = setTimeout(runSequencerStep, stepDurationMs);
  }, [bpm, tracks]);

  // Handle Play / Stop Transport
  const handleTogglePlay = () => {
    initAudio();
    if (isPlaying) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);

      // Send MIDI Stop (0xFC)
      if (midiOutputRef.current) {
        midiOutputRef.current.send([0xFC]);
      }
    } else {
      isPlayingRef.current = true;
      setIsPlaying(true);
      runSequencerStep();
      if (onNotify) onNotify(`CyberDAW Transport Running at ${bpm} BPM`, 'SUCCESS');

      // Send MIDI Start (0xFA)
      if (midiOutputRef.current) {
        midiOutputRef.current.send([0xFA]);
      }

      // Also trigger AbletonOSC bridge on port :11000
      fetch('/api/cyberdaw/ableton/osc-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: '/live/song/start_playing', args: [] }),
      }).catch(() => {});
    }
  };

  const handleStop = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    currentStepRef.current = 0;
    setCurrentStep(0);

    // Send MIDI Stop
    if (midiOutputRef.current) {
      midiOutputRef.current.send([0xFC]);
    }
    fetch('/api/cyberdaw/ableton/osc-trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: '/live/song/stop_playing', args: [] }),
    }).catch(() => {});
  };

  // Preset Pattern Loader
  const handleLoadPreset = (presetKey: string) => {
    const preset = PRESET_PATTERNS[presetKey];
    if (!preset) return;

    setActivePreset(presetKey);
    setBpm(preset.bpm);
    setTracks(prev => prev.map(t => {
      const pTrack = preset.tracks.find(pt => pt.id === t.id);
      if (pTrack) {
        return { ...t, steps: [...pTrack.steps] };
      }
      return t;
    }));

    if (onNotify) onNotify(`Loaded CyberDAW Preset: ${presetKey.replace(/_/g, ' ')}`, 'INFO');
  };

  // Toggle Step Trigger on a Track
  const handleToggleStep = (trackId: string, stepIndex: number) => {
    initAudio();
    setTracks(prev => prev.map(t => {
      if (t.id === trackId) {
        const nextSteps = [...t.steps];
        nextSteps[stepIndex] = !nextSteps[stepIndex];
        // Preview sound on manual arm
        if (nextSteps[stepIndex] && !isPlaying) {
          playTrackSound(t, audioCtxRef.current?.currentTime || 0);
        }
        return { ...t, steps: nextSteps };
      }
      return t;
    }));
  };

  // Toggle Track Mute
  const handleToggleMute = (trackId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t));
  };

  // Toggle Track Solo
  const handleToggleSolo = (trackId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, soloed: !t.soloed } : t));
  };

  // Update Track Volume
  const handleTrackVolume = (trackId: string, val: number) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, volume: val } : t));
  };

  // Export Ableton Live Set (.als)
  const handleExportAbletonAls = async () => {
    setIsExportingAls(true);
    try {
      const res = await fetch('/api/cyberdaw/ableton/export-als', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: `Aegentix_CyberDAW_${activePreset}`,
          bpm,
          tracks,
          includeMasterChain: true,
          masteringStyle,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate Ableton Live Set');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Aegentix_CyberDAW_${activePreset}.als`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      if (onNotify) {
        onNotify(`Exported Ableton Live Set: Aegentix_CyberDAW_${activePreset}.als (${masteringStyle})`, 'SUCCESS');
      }
    } catch (err: any) {
      if (onNotify) onNotify(`Export error: ${err.message}`, 'ALERT');
    } finally {
      setIsExportingAls(false);
    }
  };

  // Export Standard MIDI (.mid)
  const handleExportMidi = async () => {
    setIsExportingMid(true);
    try {
      const res = await fetch('/api/cyberdaw/midi/export-mid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: `Aegentix_CyberDAW_${activePreset}`,
          bpm,
          tracks,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate MIDI file');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Aegentix_CyberDAW_${activePreset}.mid`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      if (onNotify) {
        onNotify(`Exported Multi-Track MIDI: Aegentix_CyberDAW_${activePreset}.mid`, 'SUCCESS');
      }
    } catch (err: any) {
      if (onNotify) onNotify(`MIDI export error: ${err.message}`, 'ALERT');
    } finally {
      setIsExportingMid(false);
    }
  };

  // Download Python Remote Script for Ableton Live
  const handleDownloadRemoteScript = () => {
    const blob = new Blob([ABLETON_REMOTE_SCRIPT_PYTHON], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Aegentix_CyberDAW.py';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    if (onNotify) {
      onNotify('Downloaded Aegentix_CyberDAW.py! Place into Documents/Ableton/User Library/Remote Scripts/', 'SUCCESS');
    }
  };

  const handleCopyCode = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeLabel(label);
    setTimeout(() => setCopiedCodeLabel(null), 2500);
    if (onNotify) onNotify(`Copied ${label} to clipboard!`, 'INFO');
  };

  // Launch Ableton Live 12 on Host
  const handleLaunchAbleton = async () => {
    setIsLaunchingAbleton(true);
    try {
      const res = await fetch('/api/cyberdaw/ableton/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectFile: 'OmniCyberDAW_Live_Master.als' }),
      });
      const data = await res.json();
      if (onNotify) onNotify(data.message || 'Launched Ableton Live 12!', 'SUCCESS');
    } catch (err: any) {
      if (onNotify) onNotify('Failed to launch Ableton Live: ' + err.message, 'ALERT');
    } finally {
      setIsLaunchingAbleton(false);
    }
  };

  // Live Transport Controls (Play / Stop / Record) via JSON-RPC
  const handleLiveTransport = async (action: 'play' | 'stop' | 'record') => {
    try {
      const method = action === 'play' ? 'song.play' : action === 'stop' ? 'song.stop' : 'song.record';
      const res = await fetch('/api/cyberdaw/ableton/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      });
      const data = await res.json();
      if (data.success) {
        if (onNotify) onNotify(`Ableton Live Engine: ${action.toUpperCase()} command dispatched!`, 'SUCCESS');
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      if (onNotify) onNotify(`Live API error: ${err.message}`, 'ALERT');
    }
  };

  // Synchronize CyberDAW BPM to Ableton Live
  const handleLiveSyncBpm = async () => {
    try {
      const res = await fetch('/api/cyberdaw/ableton/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'song.set_tempo', params: { bpm } }),
      });
      const data = await res.json();
      if (data.success) {
        if (onNotify) onNotify(`Ableton Live Tempo Synchronized: ${bpm} BPM`, 'SUCCESS');
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      if (onNotify) onNotify(`Live BPM sync error: ${err.message}`, 'ALERT');
    }
  };

  // High-level: Inject all 6 Agent Stems into Ableton Live as active tracks & clips
  const handleInjectAllStemsToLive = async () => {
    setIsInjectingToLive(true);
    let injected = 0;
    try {
      for (const track of tracks) {
        const res = await fetch('/api/cyberdaw/ableton/inject-agent-stem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackName: track.name,
            baseMidiNote: track.baseMidiNote,
            steps: track.steps,
            volume: track.volume,
            pan: track.pan,
            slotIndex: 0,
          }),
        });
        if (res.ok) injected++;
      }
      if (onNotify) onNotify(`Directly injected ${injected} agent stems & clips into Ableton Live!`, 'SUCCESS');
    } catch (err: any) {
      if (onNotify) onNotify(`Live injection error: ${err.message}`, 'ALERT');
    } finally {
      setIsInjectingToLive(false);
    }
  };

  // OBS Studio Broadcast Control Actions
  const handleLaunchObs = async () => {
    setIsLaunchingObs(true);
    try {
      const res = await fetch('/api/obs/launch', { method: 'POST' });
      const data = await res.json();
      if (onNotify) onNotify(data.message || 'Launched OBS Studio 32!', 'SUCCESS');
      const statusRes = await fetch('/api/obs/status');
      if (statusRes.ok) {
        const sData = await statusRes.json();
        if (sData.status) setObsStatus(sData.status);
      }
    } catch (err: any) {
      if (onNotify) onNotify('Failed to launch OBS: ' + err.message, 'ALERT');
    } finally {
      setIsLaunchingObs(false);
    }
  };

  const handleToggleObsRecord = async () => {
    setIsObsActionBusy(true);
    try {
      const res = await fetch('/api/obs/record/toggle', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const nextState = !obsStatus.recording;
        setObsStatus(prev => ({ ...prev, recording: nextState }));
        if (onNotify) onNotify(`OBS Recording ${nextState ? 'STARTED 🔴' : 'STOPPED ⏹️'}`, nextState ? 'ALERT' : 'SUCCESS');
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      if (onNotify) onNotify('OBS Record error: ' + err.message, 'ALERT');
    } finally {
      setIsObsActionBusy(false);
    }
  };

  const handleToggleObsStream = async () => {
    setIsObsActionBusy(true);
    try {
      const res = await fetch('/api/obs/stream/toggle', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const nextState = !obsStatus.streaming;
        setObsStatus(prev => ({ ...prev, streaming: nextState }));
        if (onNotify) onNotify(`OBS Streaming ${nextState ? 'LIVE ON AIR 🟣' : 'STOPPED ⏹️'}`, 'SUCCESS');
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      if (onNotify) onNotify('OBS Stream error: ' + err.message, 'ALERT');
    } finally {
      setIsObsActionBusy(false);
    }
  };

  const handleToggleObsVirtualCam = async () => {
    setIsObsActionBusy(true);
    try {
      const res = await fetch('/api/obs/virtualcam/toggle', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const nextState = !obsStatus.virtualCamActive;
        setObsStatus(prev => ({ ...prev, virtualCamActive: nextState }));
        if (onNotify) onNotify(`OBS Virtual Camera ${nextState ? 'ENABLED 🔵' : 'DISABLED'}`, 'INFO');
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      if (onNotify) onNotify('OBS Virtual Cam error: ' + err.message, 'ALERT');
    } finally {
      setIsObsActionBusy(false);
    }
  };

  const handleSaveObsReplay = async () => {
    setIsObsActionBusy(true);
    try {
      const res = await fetch('/api/obs/replay/save', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (onNotify) onNotify('OBS Replay Buffer Clip Saved! ⚡', 'SUCCESS');
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      if (onNotify) onNotify('OBS Replay error: ' + err.message, 'ALERT');
    } finally {
      setIsObsActionBusy(false);
    }
  };

  const handleSetObsScene = async (sceneName: string) => {
    try {
      const res = await fetch('/api/obs/scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneName }),
      });
      const data = await res.json();
      if (data.success) {
        setObsStatus(prev => ({ ...prev, currentProgramScene: sceneName }));
        if (onNotify) onNotify(`Switched OBS Scene to: ${sceneName}`, 'INFO');
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      if (onNotify) onNotify('Failed to switch OBS scene: ' + err.message, 'ALERT');
    }
  };

  // Industry Mastering & Production Suite Actions
  const handleApplyMasteringConfig = async (configId: string) => {
    setIsApplyingMastering(true);
    try {
      const res = await fetch('/api/production/apply-mastering-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedConfigId(configId);
        if (onNotify) onNotify(data.message, 'SUCCESS');
        refreshObsAudioMixer();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      if (onNotify) onNotify('Mastering config error: ' + err.message, 'ALERT');
    } finally {
      setIsApplyingMastering(false);
    }
  };

  const handleApplyDspRackToSource = async (sourceName: string) => {
    setIsApplyingDspRack(sourceName);
    try {
      const res = await fetch('/api/obs/audio-input/dsp-rack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceName }),
      });
      const data = await res.json();
      if (data.success) {
        if (onNotify) onNotify(`Applied Studio DSP Rack (RNNoise + Comp + Limiter) to ${sourceName}!`, 'SUCCESS');
        refreshObsAudioMixer();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      if (onNotify) onNotify('Failed to apply DSP rack: ' + err.message, 'ALERT');
    } finally {
      setIsApplyingDspRack(null);
    }
  };

  const handleSetInputVolume = async (inputName: string, volumeDb: number) => {
    try {
      await fetch('/api/obs/audio-input/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputName, volumeDb }),
      });
      setObsAudioInputs(prev => prev.map(inp => inp.inputName === inputName ? { ...inp, inputVolumeDb: volumeDb } : inp));
    } catch (_) {}
  };

  const handleToggleInputMute = async (inputName: string, currentMuted: boolean) => {
    try {
      await fetch('/api/obs/audio-input/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputName, muted: !currentMuted }),
      });
      setObsAudioInputs(prev => prev.map(inp => inp.inputName === inputName ? { ...inp, inputMuted: !currentMuted } : inp));
    } catch (_) {}
  };

  const handleInjectChordProgression = async (prog: any) => {
    try {
      const res = await fetch('/api/cyberdaw/ableton/inject-agent-stem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackName: `${prog.name.slice(0, 14)} (${prog.genre})`,
          baseMidiNote: prog.midiNotes[0]?.[0] || 60,
          steps: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
          volume: 0.85,
          pan: 0.0,
          slotIndex: 1,
        }),
      });
      if (res.ok) {
        if (onNotify) onNotify(`Injected "${prog.name}" chord progression directly into Ableton Live!`, 'SUCCESS');
      } else {
        throw new Error('Ableton injection failed');
      }
    } catch (err: any) {
      if (onNotify) onNotify('Injection error: ' + err.message, 'ALERT');
    }
  };

  // Apex Legends LiveAPI Combat Simulator & Sonifier
  const handleSimulateApexEvent = async (type: 'KILL' | 'DAMAGE' | 'SQUAD_WIPE' | 'RING_CLOSE' | 'VICTORY') => {
    try {
      const res = await fetch('/api/apex/simulate-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (data.success && data.state) {
        setApexState(data.state);
        if (onNotify) onNotify(`Apex Event: ${data.event.details}`, 'SUCCESS');

        // Real-Time Audio Sonification into CyberDAW & Ableton Live
        if (type === 'DAMAGE') {
          setFilterCutoff(prev => Math.min(16000, prev + 1200));
        } else if (type === 'KILL') {
          if (audioCtxRef.current) playTrackSound(tracks[0], audioCtxRef.current.currentTime);
        } else if (type === 'SQUAD_WIPE') {
          if (audioCtxRef.current) playTrackSound(tracks[1], audioCtxRef.current.currentTime);
          handleLiveTransport('record');
        } else if (type === 'RING_CLOSE') {
          setBpm(prev => Math.min(180, prev + 4));
        } else if (type === 'VICTORY') {
          handleLoadPreset('HIGH_FREQUENCY_ARBITRAGE_144');
          handleLiveTransport('play');
        }
      }
    } catch (err: any) {
      if (onNotify) onNotify('Apex simulation error: ' + err.message, 'ALERT');
    }
  };

  const handleDeployApexOverlayToObs = async () => {
    setIsDeployingApexOverlay(true);
    try {
      const res = await fetch('/api/obs/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'CreateInput',
          requestData: {
            sceneName: obsStatus.currentProgramScene || 'Scene',
            inputName: 'Apex Legends Stream Overlay',
            inputKind: 'browser_source',
            inputSettings: {
              url: 'http://localhost:3000/overlays/apex',
              width: 1920,
              height: 1080,
              fps: 60,
              shutdown: false,
              restart_when_active: true,
            },
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (onNotify) onNotify('Deployed Apex Legends 60FPS Stream Overlay to OBS Studio!', 'SUCCESS');
      } else {
        if (data.error && data.error.includes('already exists')) {
          if (onNotify) onNotify('Apex Legends Stream Overlay is already active in OBS!', 'INFO');
        } else {
          throw new Error(data.error);
        }
      }
    } catch (err: any) {
      if (onNotify) onNotify('Failed to deploy overlay to OBS: ' + err.message, 'ALERT');
    } finally {
      setIsDeployingApexOverlay(false);
    }
  };

  // Live Oscilloscope Visualizer Animation
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderOscilloscope = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw subtle background grid lines
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 15) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      if (analyserRef.current && isPlaying) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteTimeDomainData(dataArray);

        // Draw glowing neon waveform
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#06B6D4'; // Cyan neon
        ctx.shadowColor = '#06B6D4';
        ctx.shadowBlur = 8;
        ctx.beginPath();

        const sliceWidth = (canvas.width * 1.0) / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Flat standby resting laser line
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#1E293B';
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }

      animId = requestAnimationFrame(renderOscilloscope);
    };

    renderOscilloscope();
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  // Sonify External Live Symphony Events
  useEffect(() => {
    if (externalTriggerEvent && isSonifyingLiveEvents) {
      initAudio();
      // Trigger a special sonification chord
      const now = audioCtxRef.current?.currentTime || 0;
      const targetTrack = tracks[Math.floor(Math.random() * tracks.length)];
      playTrackSound(targetTrack, now);
      if (onNotify) onNotify(`Sonified event from ${externalTriggerEvent.source}`, 'INFO');
    }
  }, [externalTriggerEvent, isSonifyingLiveEvents]);

  const getTrackIcon = (icon: DAWTrack['icon']) => {
    switch (icon) {
      case 'BRAIN': return <Brain className="w-3.5 h-3.5 text-cyan-400" />;
      case 'JUDGE': return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
      case 'TELEMETRY': return <Activity className="w-3.5 h-3.5 text-amber-400" />;
      case 'ARGON': return <Sparkles className="w-3.5 h-3.5 text-blue-400" />;
      case 'DAG': return <Share2 className="w-3.5 h-3.5 text-rose-400" />;
      case 'EXECUTION': return <Zap className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  return (
    <div className="bg-[#050811] border border-purple-500/40 rounded-2xl overflow-hidden shadow-2xl font-mono text-slate-200 text-xs space-y-4">
      {/* ========================================================================= */}
      {/* 1. MASTER TRANSPORT & CYBERDAW HEADER BAR                                  */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 border-b border-purple-500/20 bg-gradient-to-r from-[#030611] via-[#0F0A1E] to-[#050914] flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-700 to-cyan-500 border border-purple-400/50 flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
            <Music className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-white tracking-wider uppercase font-sans">
                OMNICYBERDAW &middot; ABLETON LIVE MASTER STUDIO
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40">
                16-STEP SONIFICATION
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                ABLETON LIVE 11/12 NATIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Conductor Event Bus (:9005) &middot; Real-time acoustic telemetry, Web MIDI output &amp; master .als / .mid project export
            </p>
          </div>
        </div>

        {/* Master Transport & Ableton Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Preset Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Preset:</span>
            <select
              value={activePreset}
              onChange={(e) => handleLoadPreset(e.target.value)}
              className="bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-1 text-cyan-300 font-mono text-[11px] outline-hidden focus:border-cyan-400"
            >
              <option value="NEON_CONSENSUS_132">Neon Consensus (132 BPM)</option>
              <option value="SOVEREIGN_CYBER_ENCLAVE_118">Sovereign Enclave (118 BPM)</option>
              <option value="HIGH_FREQUENCY_ARBITRAGE_144">HF Arbitrage (144 BPM)</option>
            </select>
          </div>

          {/* Master Transport Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-750 p-1 rounded-xl">
            <button
              onClick={handleTogglePlay}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all shadow-md ${
                isPlaying
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 hover:opacity-90'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            <button
              onClick={handleStop}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg cursor-pointer transition-colors"
              title="Stop & Rewind"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* BPM Tempo Control */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-750 px-3 py-1 rounded-xl">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] text-slate-400 font-bold">BPM:</span>
            <input
              type="number"
              min={60}
              max={220}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-12 bg-transparent text-white font-mono font-bold text-xs outline-hidden text-center"
            />
          </div>

          {/* Ableton Master Toggle */}
          <button
            onClick={() => setIsAbletonSectionOpen(!isAbletonSectionOpen)}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 font-bold text-xs cursor-pointer transition-all ${
              isAbletonSectionOpen
                ? 'bg-purple-950/80 text-purple-300 border-purple-500 shadow-md shadow-purple-900/40'
                : 'bg-slate-900 text-slate-400 hover:text-white border-slate-700'
            }`}
          >
            <Disc className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ableton Live Suite</span>
            {isAbletonSectionOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* OBS Studio Broadcast Toggle */}
          <button
            onClick={() => setIsObsSectionOpen(!isObsSectionOpen)}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 font-bold text-xs cursor-pointer transition-all ${
              isObsSectionOpen
                ? 'bg-rose-950/80 text-rose-300 border-rose-500 shadow-md shadow-rose-900/40'
                : 'bg-slate-900 text-slate-400 hover:text-white border-slate-700'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-rose-400" />
            <span>OBS Studio</span>
            {obsStatus.recording && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            )}
            {obsStatus.connected && !obsStatus.recording && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
            {isObsSectionOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Industry Production & Mastering Suite Toggle */}
          <button
            onClick={() => setIsProductionSuiteOpen(!isProductionSuiteOpen)}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 font-bold text-xs cursor-pointer transition-all ${
              isProductionSuiteOpen
                ? 'bg-amber-950/80 text-amber-300 border-amber-500 shadow-md shadow-amber-900/40'
                : 'bg-slate-900 text-slate-400 hover:text-white border-slate-700'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Mastering & Industry Suites</span>
            {isProductionSuiteOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ABLETON LIVE 11/12 MASTER PRODUCTION WORKSTATION SUITE                 */}
      {/* ========================================================================= */}
      {isAbletonSectionOpen && (
        <div className="mx-4 p-4 rounded-xl bg-gradient-to-br from-[#070B1A] via-[#090618] to-[#040813] border border-cyan-500/30 shadow-xl space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold">
                  ABLETON LIVE 11 / 12 STUDIO MASTER
                </span>
                <span className="text-slate-400 text-xs">Direct .als Project Builder &middot; Multi-Track SMF MIDI &middot; Remote Scripting</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Transforms all 6 CyberDAW agent channels into a native, drag-and-drop Ableton Live Set with clips, volume/pan automation, and a 5-tier mastering chain.
              </p>
            </div>

            {/* Quick Export Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExportAbletonAls}
                disabled={isExportingAls}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs transition shadow-lg shadow-cyan-900/30 disabled:opacity-50 cursor-pointer"
              >
                <FolderDown className="w-3.5 h-3.5" />
                <span>{isExportingAls ? 'Compiling .als...' : 'Export Ableton Set (.als)'}</span>
              </button>

              <button
                onClick={handleExportMidi}
                disabled={isExportingMid}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-purple-400" />
                <span>{isExportingMid ? 'Building MIDI...' : 'Export MIDI (.mid)'}</span>
              </button>

              <button
                onClick={handleDownloadRemoteScript}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition cursor-pointer"
                title="Download Aegentix_CyberDAW.py Remote Script"
              >
                <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                <span>Remote Script</span>
              </button>
            </div>
          </div>

          {/* Ableton Controls & Mastering Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Column 1: Mastering Chain & Loudness Presets */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Master Bus Chain Preset</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">True Peak -0.3 dB</span>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 block">Loudness Target Profile:</label>
                <select
                  value={masteringStyle}
                  onChange={(e) => setMasteringStyle(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:border-cyan-400 outline-none"
                >
                  <option value="HIGH_ENERGY_MASTER">⚡ Club / High Energy (-8.5 LUFS)</option>
                  <option value="STREAMING_SPOTIFY">🎧 Streaming / Spotify (-14.0 LUFS)</option>
                  <option value="CLUB_SUB_HEAVY">🔊 Sub-Heavy Cyberpunk (-9.0 LUFS)</option>
                  <option value="AMBIENT_CLEAN">🌌 Ambient Delta-Neutral (-18.0 LUFS)</option>
                </select>
              </div>

              {/* Mastering Rack Device Chain Visualizer */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Pre-Configured DSP Rack:</span>
                <div className="grid grid-cols-5 gap-1 text-[9px] font-mono text-center">
                  <div className="p-1 rounded bg-slate-900 border border-slate-750 text-cyan-300" title="Bass Mono < 120Hz">
                    1. Utility
                  </div>
                  <div className="p-1 rounded bg-slate-900 border border-slate-750 text-emerald-300" title="25Hz 4x HPF, 320Hz dip, 12k air">
                    2. EQ Eight
                  </div>
                  <div className="p-1 rounded bg-slate-900 border border-slate-750 text-amber-300" title="2:1 Ratio, 30ms Attack, Auto Rel">
                    3. Glue
                  </div>
                  <div className="p-1 rounded bg-slate-900 border border-slate-750 text-rose-300" title="Analog Soft Clip 1.2dB">
                    4. Sat
                  </div>
                  <div className="p-1 rounded bg-slate-900 border border-slate-750 text-purple-300 font-bold" title="Ceiling -0.3 dBFS, Lookahead 5ms">
                    5. Limiter
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Web MIDI API Hardware/Software Loopback */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span className="flex items-center gap-1.5 text-purple-300">
                  <Radio className="w-3.5 h-3.5" />
                  <span>Live Web MIDI Loopback</span>
                </span>
                <span className={`w-2 h-2 rounded-full ${isMidiActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-slate-400 block">Ableton MIDI Input Port:</label>
                  <button
                    onClick={refreshMidiPorts}
                    type="button"
                    className="text-[9px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1 cursor-pointer bg-slate-900 px-1.5 py-0.5 rounded border border-slate-750 transition"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Scan Ports</span>
                  </button>
                </div>
                <select
                  value={selectedMidiDevice}
                  onChange={(e) => handleMidiDeviceChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-purple-300 font-mono text-[11px] focus:border-purple-400 outline-none"
                >
                  {midiDevices.map((dev) => (
                    <option key={dev.id} value={dev.id}>
                      {dev.name}
                    </option>
                  ))}
                  {midiDevices.length === 0 && (
                    <option value="">No Port Found &middot; Installer Open On Desktop</option>
                  )}
                </select>
              </div>

              <div className="p-2 rounded bg-slate-900/60 border border-slate-800 text-[10px] space-y-0.5 text-slate-400">
                <div className="flex justify-between">
                  <span>MIDI Clock:</span>
                  <span className={isPlaying ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    {isPlaying ? `TRANSMITTING (${bpm} BPM)` : 'IDLE'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Channel Routing:</span>
                  <span className="text-cyan-300">Ch 1-6 (Discrete Agent Stems)</span>
                </div>
              </div>
            </div>

            {/* Column 3: AbletonOSC Remote & Python Script */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span className="flex items-center gap-1.5 text-emerald-300">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Ableton Live Script Bridge</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">TCP :11000</span>
              </div>

              <div className="p-2 rounded bg-slate-900/60 border border-slate-800 text-[10px] space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Live 12 Process:</span>
                  <span className={abletonStatus.running ? 'text-emerald-400 font-bold flex items-center gap-1' : 'text-slate-500'}>
                    <span className={`w-1.5 h-1.5 rounded-full ${abletonStatus.running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                    {abletonStatus.running ? `RUNNING (PID ${abletonStatus.pid})` : 'NOT RUNNING'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Live API Bridge:</span>
                  <span className={abletonStatus.socketConnected ? 'text-cyan-400 font-bold' : 'text-amber-400'}>
                    {abletonStatus.socketConnected ? 'CONNECTED' : abletonStatus.running ? 'READY FOR SCRIPT' : 'STANDBY'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <button
                  onClick={() => handleCopyCode(ABLETON_REMOTE_SCRIPT_PYTHON, 'Python Remote Script')}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-mono flex items-center justify-center gap-1 cursor-pointer transition"
                >
                  {copiedCodeLabel === 'Python Remote Script' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copy Script</span>
                </button>

                <button
                  onClick={() => handleCopyCode(ABLETON_OSC_INSTRUCTIONS, 'OSC Protocol Guide')}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-mono flex items-center justify-center gap-1 cursor-pointer transition"
                >
                  {copiedCodeLabel === 'OSC Protocol Guide' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>OSC Protocol</span>
                </button>
              </div>
            </div>
          </div>

          {/* Full-Scale Live API Interactive Control Bar */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-950/40 via-slate-900/90 to-cyan-950/40 border border-purple-500/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/20 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <Zap className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide flex items-center gap-2">
                    <span>ABLETON LIVE 12 &middot; REAL-TIME LIVE API AUTOMATION ENGINE</span>
                    {abletonStatus.running && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                        PID: {abletonStatus.pid}
                      </span>
                    )}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Direct programmatic control over Ableton Live tracks, clips, notes, parameters, and transport via native Python JSON-RPC.
                  </p>
                </div>
              </div>

              {/* Host Launch Button */}
              <button
                onClick={handleLaunchAbleton}
                disabled={isLaunchingAbleton}
                className="py-1.5 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-500/20 cursor-pointer transition disabled:opacity-50"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{isLaunchingAbleton ? 'Launching...' : 'Launch Ableton Live 12'}</span>
              </button>
            </div>

            {/* Direct Action Toolbar */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                onClick={() => handleLiveTransport('play')}
                className="py-1.5 px-3 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow"
              >
                <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                <span>Play Live</span>
              </button>

              <button
                onClick={() => handleLiveTransport('stop')}
                className="py-1.5 px-3 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow"
              >
                <Square className="w-3 h-3 text-rose-400 fill-rose-400" />
                <span>Stop Live</span>
              </button>

              <button
                onClick={() => handleLiveTransport('record')}
                className="py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-red-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
              >
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>Toggle Live Rec</span>
              </button>

              <button
                onClick={handleLiveSyncBpm}
                className="py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
              >
                <Gauge className="w-3 h-3 text-cyan-400" />
                <span>Sync {bpm} BPM to Live</span>
              </button>

              <button
                onClick={handleInjectAllStemsToLive}
                disabled={isInjectingToLive}
                className="ml-auto py-1.5 px-3.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 cursor-pointer transition disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                <span>{isInjectingToLive ? 'Injecting Notes...' : 'Inject All 6 Agent Stems into Live Clips'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2B. OBS STUDIO 32 BROADCAST & STREAM PRODUCTION DECK                      */}
      {/* ========================================================================= */}
      {isObsSectionOpen && (
        <div className="mx-4 p-4 rounded-xl bg-gradient-to-br from-[#0B0614] via-[#060814] to-[#04060E] border border-rose-500/30 shadow-xl space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1.5">
                  <Video className="w-3 h-3 text-rose-400" />
                  <span>OBS STUDIO 32 BROADCAST DECK</span>
                </span>
                <span className="text-slate-400 text-xs">WebSocket v5 (Port 4455) &middot; Lossless Audio/Video Capture &middot; Scene Director</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Direct remote broadcast integration for OBS Studio 32. Switch scenes, record live Ableton Live audio/video stems, broadcast streams, or feed the DAW visualizer to Virtual Camera.
              </p>
            </div>

            {/* Quick OBS Action Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              {!obsStatus.processRunning ? (
                <button
                  onClick={handleLaunchObs}
                  disabled={isLaunchingObs}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs transition shadow-lg shadow-rose-900/30 disabled:opacity-50 cursor-pointer"
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>{isLaunchingObs ? 'Launching OBS...' : 'Launch OBS Studio'}</span>
                </button>
              ) : (
                <>
                  {/* Record Toggle Button */}
                  <button
                    onClick={handleToggleObsRecord}
                    disabled={isObsActionBusy}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold text-xs transition shadow-lg cursor-pointer ${
                      obsStatus.recording
                        ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse shadow-red-900/50'
                        : 'bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${obsStatus.recording ? 'bg-white' : 'bg-red-500'}`} />
                    <span>{obsStatus.recording ? `Stop Rec (${obsStatus.recordTimecode})` : 'Start Recording'}</span>
                  </button>

                  {/* Stream Toggle Button */}
                  <button
                    onClick={handleToggleObsStream}
                    disabled={isObsActionBusy}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs transition cursor-pointer ${
                      obsStatus.streaming
                        ? 'bg-purple-600 hover:bg-purple-500 text-white animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/40'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>{obsStatus.streaming ? `Stop Stream (${obsStatus.streamTimecode})` : 'Start Stream'}</span>
                  </button>

                  {/* Virtual Camera Button */}
                  <button
                    onClick={handleToggleObsVirtualCam}
                    disabled={isObsActionBusy}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs transition cursor-pointer ${
                      obsStatus.virtualCamActive
                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{obsStatus.virtualCamActive ? 'Virtual Cam ON' : 'Start Virtual Cam'}</span>
                  </button>

                  {/* Save Replay Buffer Button */}
                  <button
                    onClick={handleSaveObsReplay}
                    disabled={isObsActionBusy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 text-amber-200 text-xs font-semibold transition cursor-pointer"
                    title="Save Last Replay Buffer to disk"
                  >
                    <Film className="w-3.5 h-3.5 text-amber-400" />
                    <span>Save Replay</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* OBS Studio Telemetry & Scene Director Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Column 1: Hardware & Video Pipeline */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span className="flex items-center gap-1.5 text-rose-300">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Hardware & Video Pipeline</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Port :4455</span>
              </div>

              <div className="p-2 rounded bg-slate-900/60 border border-slate-800 text-[10px] space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">OBS Process:</span>
                  <span className={obsStatus.processRunning ? 'text-emerald-400 font-bold flex items-center gap-1' : 'text-slate-500'}>
                    <span className={`w-1.5 h-1.5 rounded-full ${obsStatus.processRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                    {obsStatus.processRunning ? `RUNNING (PID ${obsStatus.pid})` : 'OFFLINE'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">WebSocket v5:</span>
                  <span className={obsStatus.connected ? 'text-cyan-400 font-bold' : 'text-slate-500'}>
                    {obsStatus.connected ? 'AUTHENTICATED (SHA-256)' : 'DISCONNECTED'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Frame Rendering:</span>
                  <span className="text-white font-mono font-bold">
                    {obsStatus.fps ? `${obsStatus.fps} FPS` : '30 FPS'} &middot; {obsStatus.cpuUsage ? `${obsStatus.cpuUsage}% CPU` : '0.8% CPU'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">RAM Allocated:</span>
                  <span className="text-slate-300 font-mono">
                    {obsStatus.memoryUsageMB ? `${obsStatus.memoryUsageMB} MB` : '176 MB'}
                  </span>
                </div>
              </div>
            </div>

            {/* Column 2: Scene Director & Source Switching */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <MonitorPlay className="w-3.5 h-3.5" />
                  <span>Program Scene Director</span>
                </span>
                <span className="text-[10px] text-cyan-400 font-mono font-bold">
                  {obsStatus.currentProgramScene || 'Scene'}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 block">Switch Active Studio Scene:</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={customSceneInput}
                    onChange={(e) => setCustomSceneInput(e.target.value)}
                    placeholder="Scene name (e.g. Scene, Ableton Screen)"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono text-[11px] focus:border-rose-400 outline-none"
                  />
                  <button
                    onClick={() => {
                      if (customSceneInput.trim()) {
                        handleSetObsScene(customSceneInput.trim());
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 text-[10px] font-bold cursor-pointer transition"
                  >
                    Switch
                  </button>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={() => handleSetObsScene('Scene')}
                    className={`flex-1 py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 border text-[10px] font-mono cursor-pointer transition ${
                      obsStatus.currentProgramScene === 'Scene' ? 'border-rose-500 text-rose-300 font-bold' : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    Main Scene
                  </button>
                  <button
                    onClick={() => handleSetObsScene('Ableton Live')}
                    className={`flex-1 py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 border text-[10px] font-mono cursor-pointer transition ${
                      obsStatus.currentProgramScene === 'Ableton Live' ? 'border-rose-500 text-rose-300 font-bold' : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    Ableton Live
                  </button>
                </div>
              </div>
            </div>

            {/* Column 3: Live Audio Routing & Passthrough */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span className="flex items-center gap-1.5 text-purple-300">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Ableton Live + OBS Audio Sync</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Lossless WAV / AAC</span>
              </div>

              <div className="p-2 rounded bg-slate-900/60 border border-slate-800 text-[10px] space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Max for Live Device:</span>
                  <span className="text-emerald-400 font-mono font-bold">
                    AEGENTIX CYBERDAW
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Audio Routing:</span>
                  <span className="text-cyan-300 font-mono">
                    plugin~ &rarr; passthrough &rarr; plugout~
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Broadcast Recording:</span>
                  <span className={obsStatus.recording ? 'text-red-400 font-bold' : 'text-slate-400'}>
                    {obsStatus.recording ? `ACTIVE (${obsStatus.recordTimecode})` : 'READY TO CAPTURE'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <button
                  onClick={() => {
                    handleLiveTransport('play');
                    if (!obsStatus.recording) handleToggleObsRecord();
                  }}
                  className="w-full py-1.5 px-2 rounded-lg bg-gradient-to-r from-red-600/80 to-purple-600/80 hover:from-red-600 hover:to-purple-600 text-white font-bold text-[10px] flex items-center justify-center gap-1.5 cursor-pointer shadow transition"
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Sync Record (Ableton + OBS Capture)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2C. INDUSTRY AUDIO PRODUCTION & MASTERING SUITE                           */}
      {/* ========================================================================= */}
      {isProductionSuiteOpen && (
        <div className="mx-4 p-4 rounded-xl bg-gradient-to-br from-[#0F0B18] via-[#090818] to-[#040816] border border-amber-500/30 shadow-xl space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1.5">
                  <Wand2 className="w-3 h-3 text-amber-400" />
                  <span>INDUSTRY AUDIO PRODUCTION & MASTERING SUITE</span>
                </span>
                <span className="text-slate-400 text-xs">iZotope Ozone 11 &middot; FabFilter Pro &middot; Dolby.io &middot; Waves Abbey Road &middot; Audiomovers</span>
              </div>
              <p className="text-[11px] text-slate-300">
                End-to-end studio production architecture. Engineer live streams from OBS, inject 100+ genre chord progressions into Ableton Live, and apply industry-standard loudness & saturation chains.
              </p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveProductionTab('MASTERING_CONFIGS')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  activeProductionTab === 'MASTERING_CONFIGS'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Mastering Chains
              </button>
              <button
                onClick={() => setActiveProductionTab('OBS_AUDIO_MIXER')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  activeProductionTab === 'OBS_AUDIO_MIXER'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Stream Audio Mixer ({obsAudioInputs.length})
              </button>
              <button
                onClick={() => setActiveProductionTab('CHORD_VAULT')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  activeProductionTab === 'CHORD_VAULT'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Chord Progression Vault ({chordVault.length})
              </button>
              <button
                onClick={() => setActiveProductionTab('APEX_STREAM_DECK')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${
                  activeProductionTab === 'APEX_STREAM_DECK'
                    ? 'bg-rose-500 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                <span>Apex Legends Stream Deck</span>
                {apexState.squadsRemaining < 20 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            </div>
          </div>

          {/* TAB 1: MASTERING CONFIGURATIONS */}
          {activeProductionTab === 'MASTERING_CONFIGS' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {industryConfigs.map((cfg) => {
                  const isSelected = selectedConfigId === cfg.id;
                  return (
                    <div
                      key={cfg.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                        isSelected
                          ? 'bg-amber-950/30 border-amber-500 shadow-md shadow-amber-950/40 ring-1 ring-amber-500/40'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase bg-slate-900 border border-slate-750 text-amber-300">
                            {cfg.vendor} &middot; {cfg.category}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold">
                            {cfg.targetLufs} LUFS &middot; {cfg.truePeakCeilingDb} dBTP
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-white tracking-wide">
                          {cfg.title}
                        </h4>
                        <p className="text-[10px] text-slate-300 leading-relaxed">
                          {cfg.description}
                        </p>

                        {/* Signal Flow */}
                        <div className="p-2 rounded bg-slate-900/60 border border-slate-800 text-[9px] font-mono text-slate-400 space-y-0.5">
                          <span className="text-amber-400 font-semibold block mb-0.5">Signal Architecture:</span>
                          {cfg.signalFlow?.map((step: string, sIdx: number) => (
                            <div key={sIdx} className="truncate">{step}</div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => handleApplyMasteringConfig(cfg.id)}
                        disabled={isApplyingMastering}
                        className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow'
                            : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {isSelected ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>{isSelected ? 'Active Profile Deployed' : 'Deploy to OBS & Ableton'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: LIVE STREAM AUDIO MIXER & DSP RACKS */}
          {activeProductionTab === 'OBS_AUDIO_MIXER' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  <span>Real-Time OBS Stream Audio Sources & DSP Filter Racks</span>
                </span>
                <button
                  onClick={refreshObsAudioMixer}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] cursor-pointer"
                >
                  Refresh Mixer
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {obsAudioInputs.map((input) => (
                  <div
                    key={input.inputName}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{input.inputName}</span>
                          <span className="text-[9px] font-mono text-slate-500 uppercase">
                            ({input.inputKind})
                          </span>
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          Level: <strong className="text-cyan-300 font-mono">{input.inputVolumeDb.toFixed(1)} dB</strong>
                        </span>
                      </div>

                      <button
                        onClick={() => handleToggleInputMute(input.inputName, input.inputMuted)}
                        className={`p-1.5 rounded-lg border text-xs font-bold cursor-pointer transition ${
                          input.inputMuted
                            ? 'bg-rose-950/80 text-rose-300 border-rose-500'
                            : 'bg-slate-900 text-slate-300 hover:text-white border-slate-750'
                        }`}
                        title={input.inputMuted ? 'Unmute' : 'Mute'}
                      >
                        {input.inputMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Volume Slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>-60 dB</span>
                        <span>0 dB</span>
                        <span>+6 dB</span>
                      </div>
                      <input
                        type="range"
                        min={-60}
                        max={6}
                        step={0.5}
                        value={input.inputVolumeDb}
                        onChange={(e) => handleSetInputVolume(input.inputName, Number(e.target.value))}
                        className="w-full accent-cyan-400"
                      />
                    </div>

                    {/* Active Filters & 1-Click DSP Rack Button */}
                    <div className="pt-1 border-t border-slate-850 flex flex-col gap-2">
                      <div className="flex flex-wrap gap-1">
                        {input.filters?.length > 0 ? (
                          input.filters.map((f: any) => (
                            <span
                              key={f.filterName}
                              className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-cyan-950/80 border border-cyan-500/40 text-cyan-300"
                            >
                              ✓ {f.filterName}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">No DSP filters currently attached</span>
                        )}
                      </div>

                      <button
                        onClick={() => handleApplyDspRackToSource(input.inputName)}
                        disabled={isApplyingDspRack === input.inputName}
                        className="py-1 px-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-[10px] flex items-center justify-center gap-1.5 cursor-pointer shadow disabled:opacity-50"
                      >
                        <Wand2 className="w-3 h-3 text-amber-200" />
                        <span>{isApplyingDspRack === input.inputName ? 'Applying DSP...' : '1-Click Apply Studio DSP Rack (RNNoise + Comp + Limiter)'}</span>
                      </button>
                    </div>
                  </div>
                ))}

                {obsAudioInputs.length === 0 && (
                  <div className="col-span-2 p-6 text-center text-slate-500 text-xs">
                    No active OBS audio capture sources detected. Launch OBS Studio above to populate mixer.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CHORD PROGRESSION VAULT */}
          {activeProductionTab === 'CHORD_VAULT' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <span className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
                  <Music2 className="w-4 h-4 text-purple-400" />
                  <span>100+ Production-Ready Chord Progressions & Harmonic Voicings</span>
                </span>

                {/* Genre Filter Chips */}
                <div className="flex flex-wrap gap-1">
                  {['ALL', 'CYBERPUNK_SYNTHWAVE', 'LIQUID_DNB', 'TECHNO_ACID', 'CINEMATIC_AMBIENT', 'DEEP_HOUSE_GARAGE', 'NEUROFUNK_BASS'].map((g) => (
                    <button
                      key={g}
                      onClick={() => setSelectedChordGenre(g)}
                      className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer transition ${
                        selectedChordGenre === g
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {g.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {chordVault
                  .filter((p) => selectedChordGenre === 'ALL' || p.genre === selectedChordGenre)
                  .map((prog) => (
                    <div
                      key={prog.id}
                      className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between space-y-2.5"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-purple-950 text-purple-300 border border-purple-500/30">
                            {prog.genre.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {prog.key} &middot; {prog.bpm} BPM
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-white tracking-wide">{prog.name}</h4>
                        <p className="text-[10px] text-slate-300">{prog.description}</p>

                        {/* Chord Progression Bubbles */}
                        <div className="flex items-center gap-1.5 pt-1">
                          {prog.chords?.map((c: string, idx: number) => (
                            <div
                              key={idx}
                              className="flex-1 py-1 px-1 rounded bg-slate-900 border border-slate-750 text-center font-mono text-[10px] font-bold text-cyan-300"
                            >
                              <div className="text-[8px] text-slate-500">{prog.romanNumerals?.[idx]}</div>
                              <div>{c}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => handleInjectChordProgression(prog)}
                        className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow transition"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                        <span>Inject Chords into Ableton Live</span>
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 4: APEX LEGENDS LIVEAPI & OBS STREAM DECK */}
          {activeProductionTab === 'APEX_STREAM_DECK' && (
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1">
                      <Flame className="w-3 h-3 text-rose-400" />
                      <span>APEX LEGENDS LIVEAPI 2.0 &middot; STREAM BROADCAST SUITE</span>
                    </span>
                    <span className="text-slate-400 text-xs">Port :7777 WebSocket Bridge &middot; 60FPS OBS Browser Source</span>
                  </div>
                  <p className="text-[10px] text-slate-300 pt-0.5">
                    Connects directly to the Apex Legends client telemetry feed (ndekopon/overlaytools architecture). Renders real-time HUD overlays in OBS and dynamically sonifies kills, shield cracks, and ring stages into Ableton Live!
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleDeployApexOverlayToObs}
                    disabled={isDeployingApexOverlay}
                    className="py-1.5 px-3 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-900/30 cursor-pointer transition disabled:opacity-50"
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>{isDeployingApexOverlay ? 'Deploying...' : '1-Click Add Apex Overlay to OBS Studio'}</span>
                  </button>

                  <button
                    onClick={() => handleCopyCode('http://localhost:3000/overlays/apex', 'OBS Overlay URL')}
                    className="py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-750 text-xs font-mono flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCodeLabel === 'OBS Overlay URL' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy Overlay URL</span>
                  </button>
                </div>
              </div>

              {/* Apex Match Telemetry Status Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Squads Alive</span>
                  <span className="text-2xl font-black font-mono text-cyan-400">{apexState.squadsRemaining} / 20</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Players Alive</span>
                  <span className="text-2xl font-black font-mono text-emerald-400">{apexState.playersRemaining} / 60</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Squad Kills</span>
                  <span className="text-2xl font-black font-mono text-rose-400">{apexState.mySquad?.kills || 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Squad Damage</span>
                  <span className="text-2xl font-black font-mono text-amber-400">{apexState.mySquad?.damage || 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Ring Stage</span>
                  <span className="text-2xl font-black font-mono text-purple-400">Ring {apexState.ringStage}</span>
                </div>
              </div>

              {/* Combat Event Simulator & Ableton Sonifier Toolbar */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1.5 text-rose-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Real-Time Combat Telemetry Simulator & Ableton Live Sonifier</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Test Stream Overlay Reactions</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    onClick={() => handleSimulateApexEvent('DAMAGE')}
                    className="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-750 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition shadow"
                  >
                    💥 Deal 45 Damage (Filter Sweep)
                  </button>
                  <button
                    onClick={() => handleSimulateApexEvent('KILL')}
                    className="py-1.5 px-2 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-200 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition shadow"
                  >
                    🎯 Knock / Kill (Lead Accent)
                  </button>
                  <button
                    onClick={() => handleSimulateApexEvent('SQUAD_WIPE')}
                    className="py-1.5 px-2 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-600/50 text-amber-200 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition shadow"
                  >
                    💀 Squad Wipe (Sub-Bass Drop)
                  </button>
                  <button
                    onClick={() => handleSimulateApexEvent('RING_CLOSE')}
                    className="py-1.5 px-2 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-600/50 text-purple-200 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition shadow"
                  >
                    🔥 Ring Closing (+4 BPM Tempo)
                  </button>
                  <button
                    onClick={() => handleSimulateApexEvent('VICTORY')}
                    className="py-1.5 px-2 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-200 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition shadow"
                  >
                    👑 Champions (Victory Stems)
                  </button>
                </div>
              </div>

              {/* Live Combat Event Feed */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Recent Telemetry & Killfeed Stream:
                </span>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {apexState.recentEvents?.map((evt: any) => (
                    <div
                      key={evt.id}
                      className="p-1.5 rounded bg-slate-900/60 border border-slate-800 text-[10px] font-mono flex items-center justify-between text-slate-300"
                    >
                      <span>{evt.details}</span>
                      <span className="text-[8px] text-slate-500">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                  {(!apexState.recentEvents || apexState.recentEvents.length === 0) && (
                    <div className="text-slate-500 text-[10px] italic py-2 text-center">
                      Waiting for Apex Legends match events or click simulation buttons above.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. REAL-TIME OSCILLOSCOPE CANVAS & MASTER BUS CONTROLS                    */}
      {/* ========================================================================= */}
      <div className="px-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Oscilloscope Canvas */}
        <div className="lg:col-span-2 p-3 bg-[#02050E] border border-cyan-500/30 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-cyan-400 font-bold flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
              <span>REAL-TIME OSCILLOSCOPE &middot; TIME-DOMAIN ACOUSTIC SPECTRUM</span>
            </span>
            <span className="text-slate-400 font-mono">
              Step: <strong className="text-emerald-400">{currentStep + 1} / 16</strong> &middot; 44.1 kHz
            </span>
          </div>

          <div className="h-16 w-full rounded-lg overflow-hidden bg-black/60 relative">
            <canvas
              ref={canvasRef}
              width={640}
              height={64}
              className="w-full h-full block"
            />
          </div>
        </div>

        {/* Master Filter & Volume Knobs */}
        <div className="p-3 bg-[#070D1F] border border-purple-500/30 rounded-xl flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-[10px] border-b border-slate-800 pb-1.5">
            <span className="font-bold text-purple-300 uppercase flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" />
              <span>Master Cyber Bus</span>
            </span>
            <span className="text-slate-400 font-mono">{(masterVolume * 100).toFixed(0)}% Vol</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[10px]">
            <div>
              <span className="text-slate-500 block mb-1">Lowpass Cutoff: {filterCutoff}Hz (CC 74)</span>
              <input
                type="range"
                min={200}
                max={16000}
                step={100}
                value={filterCutoff}
                onChange={(e) => setFilterCutoff(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>
            <div>
              <span className="text-slate-500 block mb-1">Master Volume (CC 7)</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={masterVolume}
                onChange={(e) => setMasterVolume(Number(e.target.value))}
                className="w-full accent-purple-400"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-[10px]">
            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isSonifyingLiveEvents}
                onChange={(e) => setIsSonifyingLiveEvents(e.target.checked)}
                className="rounded accent-purple-500"
              />
              <span>Sonify Symphony Intents</span>
            </label>
            <span className="text-emerald-400 font-mono">0.0ms Jitter</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MULTI-TRACK 16-STEP SEQUENCER GRID                                     */}
      {/* ========================================================================= */}
      <div className="px-4 space-y-2 pb-4">
        {/* Step Marker Numbers Header */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-bold">
            Orchestra Tracks &middot; 16-Step Sequencing Matrix:
          </span>
          <span className="text-[9px] text-slate-500">
            Click any step to arm/disarm triggers &middot; Bar partitions marked every 4 steps &middot; Exportable to Ableton Live
          </span>
        </div>

        <div className="bg-[#070D1F] border border-slate-800 rounded-xl overflow-hidden p-3 space-y-3">
          {/* 16 Step Header Markers */}
          <div className="flex items-center gap-2">
            <div className="w-56 shrink-0 text-[10px] text-slate-500 font-bold uppercase">
              Agent Track Channel
            </div>

            <div className="grid grid-cols-16 gap-1 flex-1">
              {Array.from({ length: 16 }, (_, i) => (
                <div
                  key={i}
                  className={`text-center text-[9px] font-bold font-mono py-0.5 rounded ${
                    currentStep === i
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : i % 4 === 0
                      ? 'text-slate-300'
                      : 'text-slate-500'
                  }`}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Tracks Rows */}
          {tracks.map((track) => (
            <div key={track.id} className="flex flex-col sm:flex-row sm:items-center gap-2 border-t border-slate-800/80 pt-2.5">
              {/* Track Left Controls */}
              <div className="w-full sm:w-56 shrink-0 flex items-center justify-between pr-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-slate-900 border border-slate-800">
                    {getTrackIcon(track.icon)}
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block leading-tight">{track.name}</span>
                    <span className="text-[9px] text-slate-400 font-mono truncate block max-w-[120px]">
                      {track.role.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Track Mute / Solo Controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleMute(track.id)}
                    className={`w-5 h-5 rounded text-[9px] font-black cursor-pointer transition-colors ${
                      track.muted
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                    title="Mute Track"
                  >
                    M
                  </button>
                  <button
                    onClick={() => handleToggleSolo(track.id)}
                    className={`w-5 h-5 rounded text-[9px] font-black cursor-pointer transition-colors ${
                      track.soloed
                        ? 'bg-yellow-500 text-slate-950'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                    title="Solo Track"
                  >
                    S
                  </button>
                </div>
              </div>

              {/* 16 Step Trigger Buttons */}
              <div className="grid grid-cols-16 gap-1 flex-1">
                {track.steps.map((isActive, stepIdx) => {
                  const isCurrent = currentStep === stepIdx && isPlaying;
                  const isBarStart = stepIdx % 4 === 0;

                  return (
                    <button
                      key={stepIdx}
                      onClick={() => handleToggleStep(track.id, stepIdx)}
                      className={`h-9 rounded-md transition-all cursor-pointer relative overflow-hidden flex items-center justify-center ${
                        isActive
                          ? isCurrent
                            ? 'bg-white shadow-lg shadow-cyan-400/80 scale-105 z-10'
                            : `${track.accentBg} shadow-xs font-bold`
                          : isCurrent
                          ? 'bg-slate-700/60'
                          : isBarStart
                          ? 'bg-slate-900 hover:bg-slate-800 border border-slate-750'
                          : 'bg-slate-950 hover:bg-slate-850 border border-slate-850'
                      }`}
                    >
                      {isActive && (
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: track.color }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
