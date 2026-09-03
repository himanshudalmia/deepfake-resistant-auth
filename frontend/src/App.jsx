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
  RefreshCw
} from 'lucide-react';

const INITIAL_STATS = {
  total_requests: 0,
  attack_block_rate: 0,
  legitimate_approval_success_rate: 0,
  false_challenge_rate: 0,
  avg_verification_time_seconds: 0,
  prevented_fraudulent_value: 0
};

export default function App() {
  const [activeTab, setActiveTab] = useState('soc'); // 'soc' | 'exec'
  
  // Events state stored as map of request_id -> event object, and order array of request_ids
  const [eventsById, setEventsById] = useState({});
  const [eventOrder, setEventOrder] = useState([]);
  
  const [stats, setStats] = useState(INITIAL_STATS);
  const [wsStatus, setWsStatus] = useState('CONNECTING'); // 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [actionNotification, setActionNotification] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Upsert single event or array of events cleanly maintaining order (newest on top)
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

  // 1. Fetch History on Mount (http://localhost:8000/history?limit=50)
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('http://localhost:8000/history?limit=50');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            upsertEvents(data);
          }
        }
      } catch (err) {
        console.warn('Backend history endpoint unavailable:', err.message);
      }
    };

    fetchHistory();
  }, []);

  // 2. Poll Stats every 5 seconds (http://localhost:8000/stats)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('http://localhost:8000/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.warn('Backend stats endpoint unavailable:', err.message);
      }
    };

    fetchStats();
    const intervalId = setInterval(fetchStats, 5000);

    return () => clearInterval(intervalId);
  }, []);

  // 3. WebSocket Connection (ws://localhost:8000/ws) with Auto-reconnect
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
          console.log('WebSocket connected to ws://localhost:8000/ws');
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
          console.warn('WebSocket connection error:', error);
          setWsStatus('DISCONNECTED');
        };

        socket.onclose = () => {
          if (!isComponentMounted) return;
          console.warn('WebSocket connection closed.');
          setWsStatus('DISCONNECTED');

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isComponentMounted) {
              connectWS();
            }
          }, 4000);
        };
      } catch (err) {
        console.warn('WebSocket init exception:', err);
        setWsStatus('DISCONNECTED');
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isComponentMounted) {
            connectWS();
          }
        }, 4000);
      }
    };

    connectWS();

    return () => {
      isComponentMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Executive Device Action Handler (calls POST /requests/{id}/respond)
  const handleDecision = async (requestId, response) => {
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

    setActionNotification({
      id: requestId,
      response,
      message: `Sending ${response.toUpperCase()} out-of-band response to backend for ${requestId}...`
    });

    try {
      const payload = {
        request_id: requestId,
        challenge_code: "482913",
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
      } else {
        const errData = await res.json().catch(() => ({}));
        console.warn('Backend respond endpoint error:', res.status, errData);
        setActionNotification({
          id: requestId,
          response,
          message: `Challenge ${requestId} ${response.toUpperCase()} (Backend offline / fallback: ${res.status})`
        });
      }
    } catch (err) {
      console.warn('Network error reaching backend respond endpoint:', err.message);
      setActionNotification({
        id: requestId,
        response,
        message: `Challenge ${requestId} ${response.toUpperCase()} (Applied locally; backend offline)`
      });
    }

    setTimeout(() => {
      setActionNotification(null);
    }, 4000);
  };

  // Simulate Attack Request Handler
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

    setActionNotification({
      id: attackPayload.request_id,
      response: 'denied',
      message: `SIMULATING ATTACK: Dispatching ${attackPayload.request_id} ($500,000 Wire Transfer)...`
    });

    try {
      const res = await fetch('http://localhost:8000/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attackPayload)
      });

      if (res.ok) {
        const decisionEvent = await res.json();
        upsertEvents(decisionEvent);
      } else {
        const fallbackDecision = {
          ...attackPayload,
          risk_score: 0.96,
          decision: "block_pending_verification",
          triggered_rules: ["new_beneficiary_high_amount", "unrecognized_device", "high_pressure_language"],
          pressure_score: 0.92,
          pressure_signals: [
            { signal: "urgency_language", value: true, contribution: 0.35 },
            { signal: "secrecy_language", value: true, contribution: 0.35 }
          ],
          challenge_status: "sent"
        };
        upsertEvents(fallbackDecision);
      }
    } catch (err) {
      const fallbackDecision = {
        ...attackPayload,
        risk_score: 0.96,
        decision: "block_pending_verification",
        triggered_rules: ["new_beneficiary_high_amount", "unrecognized_device", "high_pressure_language"],
        pressure_score: 0.92,
        pressure_signals: [
          { signal: "urgency_language", value: true, contribution: 0.35 },
          { signal: "secrecy_language", value: true, contribution: 0.35 }
        ],
        challenge_status: "sent"
      };
      upsertEvents(fallbackDecision);
    }

    setTimeout(() => {
      setActionNotification(null);
    }, 4000);
  };

  const getDecisionBadge = (decision) => {
    switch (decision) {
      case 'auto_approve':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            AUTO APPROVE
          </span>
        );
      case 'step_up_verification':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-amber-950/60 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            STEP UP VERIFICATION
          </span>
        );
      case 'step_up_approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-cyan-950/60 text-cyan-400 border border-cyan-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            VERIFIED & APPROVED
          </span>
        );
      case 'block_pending_verification':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-rose-950/60 text-rose-400 border border-rose-500/30 animate-pulse-subtle">
            <ShieldAlert className="w-3.5 h-3.5" />
            BLOCK PENDING VERIFICATION
          </span>
        );
      case 'blocked':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-rose-950/90 text-rose-400 border border-rose-600/50">
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
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-700/50">SENT (PENDING)</span>;
      case 'approved':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/50">APPROVED</span>;
      case 'denied':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-rose-950 text-rose-300 border border-rose-700/50">DENIED</span>;
      case 'not_required':
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-400 border border-slate-700">NOT REQUIRED</span>;
    }
  };

  const eventsList = eventOrder.map(id => eventsById[id]).filter(Boolean);
  const pendingChallenges = eventsList.filter(e => e.challenge_status === 'sent');

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col selection:bg-cyan-500/30">
      {/* Top Cyber Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-[#0c1018]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 text-cyan-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base tracking-wide text-white uppercase font-mono">AEGIS AUTH</h1>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800/60 rounded">DEEPFAKE-RESISTANT v1.0</span>
              </div>
              <p className="text-xs text-slate-400 font-mono">Out-Of-Band Executive Transaction Authorization</p>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex items-center p-1 bg-slate-900/90 border border-slate-800 rounded-lg">
            <button
              onClick={() => setActiveTab('soc')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-mono font-semibold transition-all ${
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
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-mono font-semibold transition-all relative ${
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
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {actionNotification && (
          <div className={`p-4 rounded-lg border flex items-center justify-between font-mono text-xs ${
            actionNotification.response === 'approved' 
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
          }`}>
            <div className="flex items-center gap-3">
              {actionNotification.response === 'approved' ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-rose-400" />}
              <span>{actionNotification.message}</span>
            </div>
            <span className="text-[10px] text-slate-400">STATE SYNCHRONIZED</span>
          </div>
        )}

        {activeTab === 'soc' ? (
          /* SOC DASHBOARD TAB */
          <div className="space-y-6">
            
            {/* KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              
              <div className="bg-[#0b0f19] border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-mono font-medium uppercase">Attack Block Rate</span>
                  <ShieldAlert className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-emerald-400">{(stats.attack_block_rate * 100).toFixed(0)}%</span>
                  <span className="text-[10px] font-mono text-emerald-500/80 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/40">Target &gt;90%</span>
                </div>
              </div>

              <div className="bg-[#0b0f19] border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-mono font-medium uppercase">Legitimate Approval</span>
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-cyan-400">{(stats.legitimate_approval_success_rate * 100).toFixed(0)}%</span>
                  <span className="text-[10px] font-mono text-slate-400">Low Friction</span>
                </div>
              </div>

              <div className="bg-[#0b0f19] border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-mono font-medium uppercase">False Challenge Rate</span>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-amber-400">{(stats.false_challenge_rate * 100).toFixed(0)}%</span>
                  <span className="text-[10px] font-mono text-emerald-400">Target &lt;8.0%</span>
                </div>
              </div>

              <div className="bg-[#0b0f19] border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-mono font-medium uppercase">Avg Verification Time</span>
                  <Clock className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-indigo-300">{stats.avg_verification_time_seconds}s</span>
                  <span className="text-[10px] font-mono text-slate-400">Out-of-band OTP</span>
                </div>
              </div>

              <div className="bg-[#0b0f19] border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-mono font-medium uppercase">Prevented Fraud</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-xl font-bold font-mono text-white">
                    ${(stats.prevented_fraudulent_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

            </div>

            {/* Live Authorization Stream Section */}
            <div className="bg-[#0b0f19] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800/80 bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    wsStatus === 'CONNECTED' ? 'bg-emerald-500 animate-ping' :
                    wsStatus === 'CONNECTING' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                  }`} />
                  <h2 className="font-mono text-sm font-semibold tracking-wider text-slate-200 uppercase flex items-center gap-2">
                    <Radio className="w-4 h-4 text-cyan-400" />
                    LIVE AUTHORIZATION REQUEST STREAM
                  </h2>
                </div>
                
                <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                  <button
                    onClick={handleSimulateAttack}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/90 hover:bg-rose-900 border border-rose-500/50 text-rose-300 font-mono text-xs font-bold transition-all shadow-md active:scale-95"
                  >
                    <Zap className="w-3.5 h-3.5 text-rose-400" />
                    SIMULATE ATTACK
                  </button>
                  <span className="text-slate-600">|</span>
                  <span>WS FEED: {
                    wsStatus === 'CONNECTED' ? (
                      <strong className="text-emerald-400">CONNECTED • LIVE</strong>
                    ) : wsStatus === 'CONNECTING' ? (
                      <strong className="text-amber-400">CONNECTING...</strong>
                    ) : (
                      <strong className="text-rose-400 flex-inline items-center gap-1">
                        <WifiOff className="w-3 h-3 inline mr-1" />
                        DISCONNECTED (BACKEND OFFLINE)
                      </strong>
                    )
                  }</span>
                  <span className="text-slate-600">|</span>
                  <span>FEED COUNT: <strong className="text-white">{eventsList.length}</strong></span>
                </div>
              </div>

              {/* Feed List */}
              {eventsList.length > 0 ? (
                <div className="divide-y divide-slate-800/60">
                  {eventsList.map((evt) => {
                    const isExpanded = expandedRequestId === evt.request_id;
                    const riskColorClass = getRiskColor(evt.risk_score || 0);

                    return (
                      <div key={evt.request_id} className="transition-colors hover:bg-slate-900/40">
                        {/* Primary Summary Row */}
                        <div 
                          onClick={() => setExpandedRequestId(isExpanded ? null : evt.request_id)}
                          className="p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          {/* ID, Risk Bar & Basic Info */}
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
                              <div className="text-xs text-slate-400 mt-0.5">
                                {evt.transaction ? `${(evt.transaction.type || 'REQUEST').toUpperCase()} • $${(evt.transaction.amount || 0).toLocaleString()}` : 'EXEC TRANSACTION AUTH'}
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

                        {/* Expandable Risk Breakdown Panel */}
                        {isExpanded && (
                          <div className="px-6 py-5 bg-[#090d15] border-t border-b border-slate-800/80 space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              
                              {/* Left: ML Pressure Signals Breakdown */}
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
                                    No coercive language patterns detected in transcript.
                                  </div>
                                )}
                              </div>

                              {/* Right: Session Metadata & Transcript Context */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-mono font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                                  SESSION METADATA & TRANSCRIPT
                                </h4>

                                <div className="bg-[#0c111c] p-3 rounded-lg border border-slate-800 space-y-2 text-xs font-mono">
                                  <div className="grid grid-cols-2 gap-2 text-slate-400 pb-2 border-b border-slate-800">
                                    <div>Claimed Exec: <span className="text-slate-200">{evt.claimed_executive_id || 'N/A'}</span></div>
                                    <div>Staff ID: <span className="text-slate-200">{evt.requested_by_staff_id || 'N/A'}</span></div>
                                    <div>Channel: <span className="text-cyan-400">{evt.channel || 'N/A'}</span></div>
                                    <div>Device: <span className={evt.session_metadata?.is_recognized_device ? "text-emerald-400" : "text-rose-400"}>
                                      {evt.session_metadata?.device_id || "Unknown"}
                                    </span></div>
                                  </div>

                                  <div className="pt-1">
                                    <div className="text-[11px] text-slate-500 uppercase mb-1">Captured Communication Transcript</div>
                                    <blockquote className="italic text-slate-300 bg-slate-900/80 p-2.5 rounded border border-slate-800 font-sans">
                                      "{evt.request_transcript || 'No transcript text available for this request.'}"
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
                  <RefreshCw className="w-8 h-8 text-cyan-500/60 animate-spin mx-auto" />
                  <div className="font-mono text-sm text-slate-300 font-semibold">WAITING FOR AUTHORIZATION EVENTS</div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto font-mono">
                    {wsStatus === 'CONNECTED' 
                      ? 'Listening to live WebSocket stream at ws://localhost:8000/ws...' 
                      : 'Connecting to backend stream at ws://localhost:8000/ws (backend currently offline)...'}
                  </p>
                </div>
              )}
            </div>

          </div>
        ) : (
          /* EXECUTIVE DEVICE TAB */
          <div className="max-w-2xl mx-auto space-y-6">
            
            {/* Header info */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-mono text-xs">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                OUT-OF-BAND HARDWARE TOKEN (DEVICE #EXEC-007)
              </div>
              <h2 className="text-xl font-bold text-white tracking-wide">Executive Authorization Queue</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Transactions requiring out-of-band verification appear here. Voice/video identity is un-trusted without hardware token confirmation.
              </p>
            </div>

            {/* Simulated Phone / Security Token Container */}
            <div className="bg-[#0b0f19] border-2 border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-4 bg-slate-900 rounded-b-xl border-b border-l border-r border-slate-800" />
              
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-b border-slate-800 pb-3">
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  ENCRYPTED CHANNEL
                </span>
                <span>PENDING: {pendingChallenges.length}</span>
              </div>

              {pendingChallenges.length > 0 ? (
                <div className="space-y-6">
                  {pendingChallenges.map((evt) => (
                    <div key={evt.request_id} className="bg-[#0d1322] border border-cyan-500/40 rounded-xl p-5 space-y-4 shadow-lg relative">
                      
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                          <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block">CHALLENGE REQUEST</span>
                          <span className="font-mono text-base font-bold text-white">{evt.request_id}</span>
                        </div>
                        <span className="px-2.5 py-1 rounded bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-mono font-bold animate-pulse">
                          HIGH RISK AUTHORIZATION
                        </span>
                      </div>

                      {/* Transaction Summary Card */}
                      <div className="space-y-3 bg-[#080c16] p-4 rounded-lg border border-slate-800 font-mono text-xs">
                        <div className="flex justify-between items-center text-slate-300 border-b border-slate-800/80 pb-2">
                          <span className="text-slate-400">Transaction Type</span>
                          <span className="font-bold text-white uppercase">{evt.transaction?.type ? evt.transaction.type.replace('_', ' ') : 'HIGH VALUE TRANSFER'}</span>
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

                        <div className="flex justify-between items-center text-slate-300 border-b border-slate-800/80 pb-2">
                          <span className="text-slate-400">Initiating Staff ID</span>
                          <span className="text-slate-200">{evt.requested_by_staff_id || 'staff_042'}</span>
                        </div>

                        <div className="pt-1">
                          <span className="text-[10px] uppercase text-amber-400/90 font-bold block mb-1">
                            Flagged Call / Communication Transcript
                          </span>
                          <p className="italic text-slate-300 bg-slate-900 p-2.5 rounded border border-slate-800 font-sans text-xs">
                            "{evt.request_transcript || 'No transcript text available for this request.'}"
                          </p>
                        </div>
                      </div>

                      {/* Interactive Authorization Action Buttons */}
                      <div className="grid grid-cols-2 gap-3 pt-2">
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
                <div className="py-12 text-center space-y-3 bg-[#080c16] rounded-xl border border-slate-800/80">
                  <ShieldCheck className="w-12 h-12 text-emerald-400/80 mx-auto" />
                  <div className="font-mono text-sm text-slate-200 font-semibold">ALL CLEAR</div>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto font-mono">
                    No pending out-of-band challenge requests at this time. All high-risk transactions resolved.
                  </p>
                </div>
              )}

            </div>

          </div>
        )}

      </main>
    </div>
  );
}
