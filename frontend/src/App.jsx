import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  DollarSign, 
  Smartphone, 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Radio, 
  Lock, 
  Zap,
  Check,
  X,
  WifiOff,
  PlusCircle,
  Activity,
  Fingerprint,
  PhoneCall,
  Video,
  MessageSquare,
  Mail,
  Sliders,
  Sparkles,
  Info
} from 'lucide-react';
import RequestModal from './components/RequestModal';

const INITIAL_STATS = {
  total_requests: 214,
  attack_block_rate: 0.94,
  legitimate_approval_success_rate: 0.98,
  false_challenge_rate: 0.06,
  avg_verification_time_seconds: 42,
  prevented_fraudulent_value: 1850000.00
};

// Keyword highlighter for transcripts
function HighlightedTranscript({ text }) {
  if (!text) return <span>No transcript text available.</span>;

  const dangerKeywords = [
    'urgent', 'confidential', 'within the hour', 'don\'t loop in', 
    'do not call', 'immediately', 'secret', 'emergency', 'right now'
  ];

  const regex = new RegExp(`(${dangerKeywords.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) => {
        if (dangerKeywords.some(kw => kw.toLowerCase() === part.toLowerCase())) {
          return (
            <mark key={i} className="highlight-danger font-mono text-xs">
              {part}
            </mark>
          );
        }
        return part;
      })}
    </span>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('soc'); // 'soc' | 'exec'
  const [eventsById, setEventsById] = useState({});
  const [eventOrder, setEventOrder] = useState([]);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [wsStatus, setWsStatus] = useState('CONNECTING');
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [actionNotification, setActionNotification] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [challengeCodes, setChallengeCodes] = useState({}); // { [reqId]: '482913' }

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Helper to upsert single event or array into state
  const upsertEvents = (newEvents) => {
    const list = Array.isArray(newEvents) ? newEvents : [newEvents];
    if (list.length === 0) return;

    setEventsById(prev => {
      const next = { ...prev };
      list.forEach(evt => {
        if (!evt || !evt.request_id) return;
        const existing = next[evt.request_id] || {};
        next[evt.request_id] = { ...existing, ...evt };
      });
      return next;
    });

    setEventOrder(prevOrder => {
      let nextOrder = [...prevOrder];
      list.forEach(evt => {
        if (!evt || !evt.request_id) return;
        if (!nextOrder.includes(evt.request_id)) {
          nextOrder = [evt.request_id, ...nextOrder];
        }
      });
      return nextOrder;
    });
  };

  // 1. Fetch History on Mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('http://localhost:8000/history?limit=50');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            upsertEvents(data);
          }
        }
      } catch (err) {
        console.warn('Backend history endpoint unavailable:', err.message);
      }
    };

    fetchHistory();
  }, []);

  // 2. Poll Stats every 5 seconds
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('http://localhost:8000/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.warn('Backend stats polling unavailable:', err.message);
      }
    };

    fetchStats();
    const intervalId = setInterval(fetchStats, 5000);
    return () => clearInterval(intervalId);
  }, []);

  // 3. WebSocket Connection with Auto-reconnect
  useEffect(() => {
    let isComponentMounted = true;

    const connectWS = () => {
      if (!isComponentMounted) return;
      setWsStatus('CONNECTING');

      try {
        const socket = new WebSocket('ws://localhost:8000/ws');
        wsRef.current = socket;

        socket.onopen = () => {
          if (!isComponentMounted) return;
          setWsStatus('CONNECTED');
        };

        socket.onmessage = (event) => {
          if (!isComponentMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data && data.request_id) {
              upsertEvents(data);
            }
          } catch (e) {
            console.error('Failed to parse WebSocket JSON payload:', e);
          }
        };

        socket.onerror = (error) => {
          if (!isComponentMounted) return;
          setWsStatus('DISCONNECTED');
        };

        socket.onclose = () => {
          if (!isComponentMounted) return;
          setWsStatus('DISCONNECTED');
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isComponentMounted) connectWS();
          }, 4000);
        };
      } catch (err) {
        setWsStatus('DISCONNECTED');
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isComponentMounted) connectWS();
        }, 4000);
      }
    };

    connectWS();

    return () => {
      isComponentMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Submit custom request via Modal
  const handleCreateCustomRequest = async (payload) => {
    setActionNotification({
      id: payload.request_id,
      response: 'pending',
      message: `Ingesting transaction request ${payload.request_id} ($${payload.transaction.amount.toLocaleString()})...`
    });

    try {
      const res = await fetch('http://localhost:8000/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const decisionEvent = await res.json();
        upsertEvents(decisionEvent);
        setActionNotification({
          id: payload.request_id,
          response: 'approved',
          message: `Request ${payload.request_id} analyzed! Risk: ${(decisionEvent.risk_score * 100).toFixed(0)}% (${decisionEvent.decision}).`
        });
      } else {
        // Fallback local calculation if backend offline
        const fallbackDecision = {
          ...payload,
          risk_score: payload.transaction.amount > 100000 ? 0.92 : 0.25,
          decision: payload.transaction.amount > 100000 ? "block_pending_verification" : "auto_approve",
          triggered_rules: payload.transaction.amount > 100000 ? ["new_beneficiary_high_amount", "unrecognized_device"] : [],
          pressure_score: payload.request_transcript.includes("urgent") ? 0.85 : 0.15,
          pressure_signals: payload.request_transcript.includes("urgent") 
            ? [{ signal: "urgency_language", value: true, contribution: 0.35 }] 
            : [],
          challenge_status: payload.transaction.amount > 100000 ? "sent" : "not_required"
        };
        upsertEvents(fallbackDecision);
      }
    } catch (err) {
      // Fallback local update
      const fallbackDecision = {
        ...payload,
        risk_score: payload.transaction.amount > 100000 ? 0.92 : 0.25,
        decision: payload.transaction.amount > 100000 ? "block_pending_verification" : "auto_approve",
        triggered_rules: payload.transaction.amount > 100000 ? ["new_beneficiary_high_amount", "unrecognized_device"] : [],
        pressure_score: payload.request_transcript.includes("urgent") ? 0.85 : 0.15,
        pressure_signals: payload.request_transcript.includes("urgent") 
          ? [{ signal: "urgency_language", value: true, contribution: 0.35 }] 
          : [],
        challenge_status: payload.transaction.amount > 100000 ? "sent" : "not_required"
      };
      upsertEvents(fallbackDecision);
    }

    setTimeout(() => setActionNotification(null), 4000);
  };

  // Executive Device Respond Action
  const handleDecision = async (requestId, response) => {
    const code = challengeCodes[requestId] || "482913";

    // Immediate optimistic local update
    setEventsById(prev => {
      const existing = prev[requestId];
      if (!existing) return prev;
      return {
        ...prev,
        [requestId]: {
          ...existing,
          challenge_status: response === 'approved' ? 'approved' : 'denied',
          decision: response === 'approved' ? 'auto_approve' : 'blocked'
        }
      };
    });

    // Update stats dynamically for demo responsiveness
    if (response === 'denied') {
      const txAmount = eventsById[requestId]?.transaction?.amount || 250000;
      setStats(prev => ({
        ...prev,
        prevented_fraudulent_value: prev.prevented_fraudulent_value + txAmount,
        total_requests: prev.total_requests + 1
      }));
    }

    setActionNotification({
      id: requestId,
      response,
      message: `Verifying challenge ${requestId} code [${code}] via executive device...`
    });

    try {
      const payload = {
        request_id: requestId,
        challenge_code: code,
        response: response,
        responded_at: new Date().toISOString()
      };

      const res = await fetch(`http://localhost:8000/requests/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updatedEvent = await res.json();
        if (updatedEvent && updatedEvent.request_id) {
          upsertEvents(updatedEvent);
        }
        setActionNotification({
          id: requestId,
          response,
          message: `Challenge ${requestId} ${response.toUpperCase()} verified & broadcast by backend.`
        });
      }
    } catch (err) {
      console.warn('Network error reaching backend respond endpoint:', err.message);
    }

    setTimeout(() => setActionNotification(null), 4000);
  };

  // Quick Attack Simulation Button Handler
  const handleSimulateAttack = async () => {
    const timestampId = Date.now().toString().slice(-4);
    const attackPayload = {
      request_id: `req_sim_${timestampId}`,
      claimed_executive_id: "exec_007",
      requested_by_staff_id: "staff_042",
      channel: "video_call",
      timestamp: new Date().toISOString(),
      transaction: {
        type: "wire_transfer",
        amount: 500000.00,
        currency: "USD",
        beneficiary_account: "XXXX-7721",
        is_new_beneficiary: true
      },
      session_metadata: {
        caller_id: "+1-202-555-9988",
        device_id: "unknown_deepfake_source",
        ip_address: "198.51.100.99",
        is_recognized_device: false
      },
      request_transcript: "This is urgent CEO authorization: wire $500,000 to new beneficiary immediately. Confidential, do not verify via standard call."
    };

    handleCreateCustomRequest(attackPayload);
  };

  const getDecisionBadge = (decision) => {
    switch (decision) {
      case 'auto_approve':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-950">
            <CheckCircle2 className="w-3.5 h-3.5" />
            AUTO APPROVE
          </span>
        );
      case 'step_up_verification':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-500/40 shadow-sm shadow-amber-950">
            <AlertTriangle className="w-3.5 h-3.5" />
            STEP UP VERIFICATION
          </span>
        );
      case 'block_pending_verification':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-500/50 animate-pulse-subtle shadow-sm shadow-rose-950">
            <ShieldAlert className="w-3.5 h-3.5" />
            BLOCK PENDING VERIFICATION
          </span>
        );
      case 'blocked':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-600/70">
            <XCircle className="w-3.5 h-3.5" />
            BLOCKED
          </span>
        );
    }
  };

  const getRiskColor = (score) => {
    if (score < 0.3) return 'text-emerald-400 bg-emerald-500';
    if (score < 0.7) return 'text-amber-400 bg-amber-500';
    return 'text-rose-400 bg-rose-500';
  };

  const getChallengeBadge = (status) => {
    switch (status) {
      case 'sent':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-semibold">SENT (PENDING)</span>;
      case 'approved':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-semibold">APPROVED</span>;
      case 'denied':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-rose-950 text-rose-300 border border-rose-700/60 font-semibold">DENIED</span>;
      case 'not_required':
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 text-slate-400 border border-slate-800">NOT REQUIRED</span>;
    }
  };

  const getChannelIcon = (channel) => {
    switch (channel) {
      case 'video_call': return <Video className="w-3.5 h-3.5 text-cyan-400" />;
      case 'phone_call': return <PhoneCall className="w-3.5 h-3.5 text-amber-400" />;
      case 'chat': return <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />;
      case 'email': return <Mail className="w-3.5 h-3.5 text-emerald-400" />;
      default: return <Activity className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const eventsList = eventOrder.map(id => eventsById[id]).filter(Boolean);
  const pendingChallenges = eventsList.filter(e => e.challenge_status === 'sent');

  return (
    <div className="min-h-screen bg-[#06080d] text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Top Cyber Command Header */}
      <header className="border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 via-blue-600/20 to-purple-600/20 border border-cyan-500/40 text-cyan-400 shadow-lg shadow-cyan-950">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base tracking-wider text-white uppercase font-mono">
                  AEGIS AUTH
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-cyan-950/80 text-cyan-400 border border-cyan-700/50 rounded font-semibold">
                  DEEPFAKE-RESISTANT v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                <span>Microsoft Innovation Club • Cybersecurity</span>
              </p>
            </div>
          </div>

          {/* Action Center & View Toggle */}
          <div className="flex items-center gap-3">
            
            {/* Quick Actions */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-semibold transition-all shadow-md active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
                + NEW REQUEST
              </button>

              <button
                onClick={handleSimulateAttack}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/90 hover:bg-rose-900 border border-rose-500/50 text-rose-300 font-mono text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <Zap className="w-3.5 h-3.5 text-rose-400" />
                ⚡ ATTACK SIM
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center p-1 bg-slate-900/90 border border-slate-800 rounded-lg">
              <button
                onClick={() => setActiveTab('soc')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-mono font-semibold transition-all ${
                  activeTab === 'soc'
                    ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-950/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Terminal className="w-4 h-4" />
                SOC DASHBOARD
              </button>
              <button
                onClick={() => setActiveTab('exec')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-mono font-semibold transition-all relative ${
                  activeTab === 'exec'
                    ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-950/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                EXECUTIVE DEVICE
                {pendingChallenges.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white font-mono text-[10px] flex items-center justify-center font-bold animate-pulse">
                    {pendingChallenges.length}
                  </span>
                )}
              </button>
            </div>

          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Action Notification Toast */}
        {actionNotification && (
          <div className={`p-4 rounded-xl border flex items-center justify-between font-mono text-xs shadow-xl animate-fade-in ${
            actionNotification.response === 'approved' 
              ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
              : actionNotification.response === 'pending'
              ? 'bg-cyan-950/90 border-cyan-500/60 text-cyan-200'
              : 'bg-rose-950/90 border-rose-500/60 text-rose-200'
          }`}>
            <div className="flex items-center gap-3">
              {actionNotification.response === 'approved' ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : actionNotification.response === 'pending' ? (
                <Activity className="w-5 h-5 text-cyan-400 animate-spin shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <span className="font-semibold">{actionNotification.message}</span>
            </div>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest hidden sm:inline">STATE SYNCHRONIZED</span>
          </div>
        )}

        {activeTab === 'soc' ? (
          /* SOC DASHBOARD TAB */
          <div className="space-y-6 animate-fade-in">
            
            {/* KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              
              <div className="glass-panel glass-panel-hover rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-mono font-medium uppercase tracking-wider">Attack Block Rate</span>
                  <ShieldAlert className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-emerald-400">
                    {(stats.attack_block_rate * 100).toFixed(0)}%
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-700/50">
                    Target &gt;90%
                  </span>
                </div>
              </div>

              <div className="glass-panel glass-panel-hover rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-mono font-medium uppercase tracking-wider">Legitimate Approval</span>
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-cyan-400">
                    {(stats.legitimate_approval_success_rate * 100).toFixed(0)}%
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Low Friction</span>
                </div>
              </div>

              <div className="glass-panel glass-panel-hover rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-mono font-medium uppercase tracking-wider">False Challenge Rate</span>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-amber-400">
                    {(stats.false_challenge_rate * 100).toFixed(0)}%
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">Target &lt;8.0%</span>
                </div>
              </div>

              <div className="glass-panel glass-panel-hover rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-mono font-medium uppercase tracking-wider">Avg Verification Time</span>
                  <Clock className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-indigo-300">
                    {stats.avg_verification_time_seconds}s
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Out-of-band OTP</span>
                </div>
              </div>

              <div className="glass-panel glass-panel-hover rounded-xl p-4 flex flex-col justify-between sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-mono font-medium uppercase tracking-wider">Prevented Fraud</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-xl font-bold font-mono text-white">
                    ${(stats.prevented_fraudulent_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

            </div>

            {/* Live Stream Panel */}
            <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              
              {/* Table Toolbar Header */}
              <div className="p-4 border-b border-slate-800/80 bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    wsStatus === 'CONNECTED' ? 'bg-emerald-500 animate-ping' :
                    wsStatus === 'CONNECTING' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                  }`} />
                  <h2 className="font-mono text-sm font-semibold tracking-wider text-slate-200 uppercase flex items-center gap-2">
                    <Radio className="w-4 h-4 text-cyan-400" />
                    LIVE AUTHORIZATION STREAM
                  </h2>
                </div>
                
                <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                  <div className="md:hidden flex items-center gap-2">
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="px-2.5 py-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[11px] font-bold"
                    >
                      + NEW
                    </button>
                    <button
                      onClick={handleSimulateAttack}
                      className="px-2.5 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[11px] font-bold"
                    >
                      ⚡ ATTACK
                    </button>
                  </div>
                  
                  <span>WS FEED: {
                    wsStatus === 'CONNECTED' ? (
                      <strong className="text-emerald-400">CONNECTED • LIVE</strong>
                    ) : wsStatus === 'CONNECTING' ? (
                      <strong className="text-amber-400">CONNECTING...</strong>
                    ) : (
                      <strong className="text-rose-400 flex-inline items-center gap-1">
                        <WifiOff className="w-3 h-3 inline mr-1" />
                        BACKEND OFFLINE
                      </strong>
                    )
                  }</span>
                  <span className="text-slate-700">|</span>
                  <span>TOTAL: <strong className="text-white">{eventsList.length}</strong></span>
                </div>
              </div>

              {/* Feed Stream Rows */}
              {eventsList.length > 0 ? (
                <div className="divide-y divide-slate-800/60">
                  {eventsList.map((evt) => {
                    const isExpanded = expandedRequestId === evt.request_id;
                    const riskColorClass = getRiskColor(evt.risk_score || 0);

                    return (
                      <div key={evt.request_id} className="transition-colors hover:bg-slate-900/40">
                        
                        {/* Master Row */}
                        <div 
                          onClick={() => setExpandedRequestId(isExpanded ? null : evt.request_id)}
                          className="p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          
                          {/* ID & Type */}
                          <div className="flex items-center gap-4 min-w-[280px]">
                            <div className="text-slate-500 hover:text-slate-300 transition-colors">
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 font-mono text-sm font-bold text-cyan-300">
                                <span>{evt.request_id}</span>
                                {evt.timestamp && (
                                  <span className="text-xs font-normal text-slate-500 font-mono">
                                    {new Date(evt.timestamp).toLocaleTimeString()}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                                {getChannelIcon(evt.channel)}
                                <span className="font-mono">
                                  {evt.transaction ? `${(evt.transaction.type || 'REQUEST').toUpperCase()} • $${(evt.transaction.amount || 0).toLocaleString()}` : 'EXEC TRANSACTION AUTH'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Risk Score Indicator */}
                          <div className="flex items-center gap-3 w-48">
                            <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
                              <div 
                                className={`h-full ${riskColorClass.split(' ')[1]}`} 
                                style={{ width: `${(evt.risk_score || 0) * 100}%` }}
                              />
                            </div>
                            <span className={`font-mono text-xs font-bold w-12 text-right ${riskColorClass.split(' ')[0]}`}>
                              {((evt.risk_score || 0) * 100).toFixed(0)}%
                            </span>
                          </div>

                          {/* Decision & Status Badges */}
                          <div className="flex items-center gap-3">
                            {getDecisionBadge(evt.decision)}
                            {getChallengeBadge(evt.challenge_status)}
                          </div>

                          {/* Triggered Rules Tags */}
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {evt.triggered_rules && evt.triggered_rules.length > 0 ? (
                              evt.triggered_rules.map(rule => (
                                <span key={rule} className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-amber-300 border border-amber-800/40">
                                  {rule}
                                </span>
                              ))
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-500 border border-slate-800">
                                NO RULES FIRED
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expanded Panel */}
                        {isExpanded && (
                          <div className="px-6 py-5 bg-[#090d15] border-t border-b border-slate-800/80 space-y-4 animate-fade-in">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              
                              {/* Left Column: Pressure ML Signals */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-mono font-semibold tracking-wider text-cyan-400 uppercase flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5" />
                                    PRESSURE-LANGUAGE ML BREAKDOWN
                                  </h4>
                                  <span className="font-mono text-xs text-slate-400">
                                    Pressure Score: <strong className="text-amber-400">{((evt.pressure_score || 0) * 100).toFixed(0)}%</strong>
                                  </span>
                                </div>

                                {evt.pressure_signals && evt.pressure_signals.length > 0 ? (
                                  <div className="space-y-2 bg-[#0c111c] p-3 rounded-lg border border-slate-800">
                                    {evt.pressure_signals.map((sig, i) => (
                                      <div key={sig.signal || i} className="space-y-1">
                                        <div className="flex justify-between text-xs font-mono">
                                          <span className="text-slate-300">{sig.signal}</span>
                                          <span className="text-amber-400">+{(sig.contribution * 100).toFixed(0)}% risk</span>
                                        </div>
                                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                          <div 
                                            className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full" 
                                            style={{ width: `${Math.min(sig.contribution * 200, 100)}%` }}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="p-3 bg-[#0c111c] rounded-lg border border-slate-800/80 text-xs text-slate-500 font-mono">
                                    No coercive or pressure language patterns detected in transcript.
                                  </div>
                                )}
                              </div>

                              {/* Right Column: Metadata & Transcript with Highlighted Keywords */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-mono font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                                  SESSION POSTURE & CAPTURED TRANSCRIPT
                                </h4>

                                <div className="bg-[#0c111c] p-3 rounded-lg border border-slate-800 space-y-3 text-xs font-mono">
                                  <div className="grid grid-cols-2 gap-2 text-slate-400 pb-2 border-b border-slate-800">
                                    <div>Claimed Exec: <span className="text-slate-200">{evt.claimed_executive_id || 'N/A'}</span></div>
                                    <div>Staff ID: <span className="text-slate-200">{evt.requested_by_staff_id || 'N/A'}</span></div>
                                    <div>Channel: <span className="text-cyan-400">{evt.channel || 'N/A'}</span></div>
                                    <div>Device: <span className={evt.session_metadata?.is_recognized_device ? "text-emerald-400" : "text-rose-400"}>
                                      {evt.session_metadata?.device_id || "Unknown"}
                                    </span></div>
                                  </div>

                                  <div>
                                    <div className="text-[11px] text-slate-500 uppercase mb-1 font-semibold">
                                      Transcript Analysis (Coercive terms highlighted)
                                    </div>
                                    <blockquote className="italic text-slate-300 bg-slate-900/90 p-2.5 rounded border border-slate-800 font-sans leading-relaxed">
                                      "<HighlightedTranscript text={evt.request_transcript} />"
                                    </blockquote>
                                  </div>
                                </div>
                              </div>

                            </div>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-16 text-center space-y-3 bg-[#080c16]">
                  <Activity className="w-8 h-8 text-cyan-500/60 animate-spin mx-auto" />
                  <div className="font-mono text-sm text-slate-300 font-semibold">WAITING FOR AUTHORIZATION EVENTS</div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto font-mono">
                    Listening to live WebSocket stream at ws://localhost:8000/ws...
                  </p>
                </div>
              )}

            </div>

          </div>
        ) : (
          /* EXECUTIVE DEVICE TAB (HARDWARE TOKEN FRAME) */
          <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
            
            {/* Header Description */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-semibold shadow-md">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                OUT-OF-BAND EXECUTIVE HARDWARE TOKEN
              </div>
              <h2 className="text-xl font-bold text-white tracking-wide font-mono uppercase">
                Device Authorization Queue
              </h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Voice and video identity is untrusted without hardware token verification. Validate intent below.
              </p>
            </div>

            {/* Hardware Mobile Device Mockup Frame */}
            <div className="bg-[#0a0d16] border-4 border-slate-800 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden ring-1 ring-cyan-500/20">
              
              {/* Smartphone Notch & Speaker Bar */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-5 bg-slate-900 rounded-b-2xl border-b border-l border-r border-slate-800 flex items-center justify-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-800 border border-slate-700" />
                <div className="w-10 h-1 bg-slate-800 rounded-full" />
              </div>

              {/* Mobile Device Status Header */}
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-3 border-b border-slate-800/90 pb-3">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  TOTP ENCRYPTED
                </span>
                <span>DEVICE: EXEC-007</span>
                <span className="text-cyan-400 font-bold">QUEUE: {pendingChallenges.length}</span>
              </div>

              {/* Pending Challenge Cards */}
              <div className="pt-4">
                {pendingChallenges.length > 0 ? (
                  <div className="space-y-6">
                    {pendingChallenges.map((evt) => (
                      <div key={evt.request_id} className="bg-[#0c1220] border border-cyan-500/40 rounded-xl p-5 space-y-4 shadow-xl relative">
                        
                        {/* Request ID Header */}
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <div>
                            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block font-bold">
                              HIGH-RISK CHALLENGE
                            </span>
                            <span className="font-mono text-base font-bold text-white">{evt.request_id}</span>
                          </div>
                          <span className="px-2.5 py-1 rounded bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-mono font-bold animate-pulse">
                            INTENT VERIFICATION
                          </span>
                        </div>

                        {/* Transaction Context Card */}
                        <div className="space-y-2.5 bg-[#070b14] p-4 rounded-lg border border-slate-800 font-mono text-xs">
                          <div className="flex justify-between items-center text-slate-300 border-b border-slate-800/80 pb-2">
                            <span className="text-slate-400">Transaction Type</span>
                            <span className="font-bold text-white uppercase">{evt.transaction?.type ? evt.transaction.type.replace('_', ' ') : 'TRANSFER'}</span>
                          </div>
                          
                          <div className="flex justify-between items-center text-slate-300 border-b border-slate-800/80 pb-2">
                            <span className="text-slate-400">Transfer Amount</span>
                            <span className="font-bold text-emerald-400 text-sm">
                              ${(evt.transaction?.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} {evt.transaction?.currency || 'USD'}
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-slate-300 border-b border-slate-800/80 pb-2">
                            <span className="text-slate-400">Beneficiary Account</span>
                            <span className="text-white font-mono">{evt.transaction?.beneficiary_account || 'XXXX-9981'}</span>
                          </div>

                          <div className="pt-1">
                            <span className="text-[10px] uppercase text-amber-400 font-bold block mb-1">
                              Flagged Transcript Context
                            </span>
                            <p className="italic text-slate-300 bg-slate-900 p-2.5 rounded border border-slate-800 font-sans text-xs">
                              "<HighlightedTranscript text={evt.request_transcript} />"
                            </p>
                          </div>
                        </div>

                        {/* Challenge Code Display & Input */}
                        <div className="bg-[#080d18] p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                          <span className="text-xs font-mono text-slate-400">Verification Code:</span>
                          <input
                            type="text"
                            value={challengeCodes[evt.request_id] || "482913"}
                            onChange={(e) => setChallengeCodes({ ...challengeCodes, [evt.request_id]: e.target.value })}
                            className="bg-slate-900 border border-cyan-500/40 rounded px-2 py-1 font-mono text-sm text-cyan-300 text-center font-bold w-24 focus:outline-none"
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <button
                            onClick={() => handleDecision(evt.request_id, 'denied')}
                            className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-600/60 font-mono text-xs font-bold transition-all shadow-md active:scale-95"
                          >
                            <X className="w-4 h-4" />
                            DENY & BLOCK
                          </button>
                          
                          <button
                            onClick={() => handleDecision(evt.request_id, 'approved')}
                            className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/60 font-mono text-xs font-bold transition-all shadow-md shadow-emerald-950/50 active:scale-95"
                          >
                            <Check className="w-4 h-4" />
                            APPROVE INTENT
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-14 text-center space-y-3 bg-[#070b14] rounded-xl border border-slate-800/80">
                    <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto" />
                    <div className="font-mono text-sm text-slate-200 font-bold tracking-wider">ALL CHALLENGES RESOLVED</div>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto font-mono">
                      No pending out-of-band hardware token requests. All high-risk transactions authorized or blocked.
                    </p>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </main>

      {/* Modal Dialog Component */}
      <RequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateCustomRequest}
      />

    </div>
  );
}
