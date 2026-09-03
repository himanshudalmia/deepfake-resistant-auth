import React, { useState } from 'react';
import { X, Send, AlertTriangle, Shield, DollarSign, User, Lock, FileText, Zap } from 'lucide-react';

const PRESET_TRANSCRIPTS = [
  {
    label: "🚨 Urgent CEO Wire Attack",
    exec: "exec_007",
    staff: "staff_042",
    channel: "video_call",
    type: "wire_transfer",
    amount: "500000",
    account: "XXXX-7721",
    isNew: true,
    recognized: false,
    text: "This is urgent and confidential CEO instruction: I need $500,000 wired immediately to new vendor beneficiary XXXX-7721. Do not loop in anyone else or delay."
  },
  {
    label: "✅ Standard Vendor Retainer",
    exec: "exec_007",
    staff: "staff_019",
    channel: "chat",
    type: "wire_transfer",
    amount: "4500",
    account: "XXXX-1120",
    isNew: false,
    recognized: true,
    text: "Standard monthly vendor retainer payment for design services as approved in Q3 budget."
  },
  {
    label: "⚠️ Off-Hours Credential Reset",
    exec: "exec_003",
    staff: "staff_088",
    channel: "email",
    type: "credential_reset",
    amount: "0",
    account: "N/A",
    isNew: false,
    recognized: true,
    text: "Need root credential reset for emergency server deployment before market open tomorrow morning."
  }
];

export default function RequestModal({ isOpen, onClose, onSubmit }) {
  const [executiveId, setExecutiveId] = useState("exec_007");
  const [staffId, setStaffId] = useState("staff_042");
  const [channel, setChannel] = useState("video_call");
  const [txType, setTxType] = useState("wire_transfer");
  const [amount, setAmount] = useState("250000");
  const [account, setAccount] = useState("XXXX-9981");
  const [isNewBeneficiary, setIsNewBeneficiary] = useState(true);
  const [isRecognizedDevice, setIsRecognizedDevice] = useState(false);
  const [transcript, setTranscript] = useState(
    "This is urgent and confidential, I need this wired within the hour, don't loop in anyone else on this."
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const applyPreset = (preset) => {
    setExecutiveId(preset.exec);
    setStaffId(preset.staff);
    setChannel(preset.channel);
    setTxType(preset.type);
    setAmount(preset.amount);
    setAccount(preset.account);
    setIsNewBeneficiary(preset.isNew);
    setIsRecognizedDevice(preset.recognized);
    setTranscript(preset.text);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const requestId = `req_${Date.now().toString().slice(-6)}`;
    const payload = {
      request_id: requestId,
      claimed_executive_id: executiveId,
      requested_by_staff_id: staffId,
      channel: channel,
      timestamp: new Date().toISOString(),
      transaction: {
        type: txType,
        amount: parseFloat(amount) || 0,
        currency: "USD",
        beneficiary_account: account,
        is_new_beneficiary: isNewBeneficiary
      },
      session_metadata: {
        caller_id: channel === "video_call" ? "+1-202-555-0179" : "internal_session",
        device_id: isRecognizedDevice ? "dev_recognized_01" : "unknown_device",
        ip_address: "198.51.100.20",
        is_recognized_device: isRecognizedDevice
      },
      request_transcript: transcript
    };

    await onSubmit(payload);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans animate-fade-in">
      <div className="bg-[#0c1019] border border-cyan-500/30 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl shadow-cyan-950/50 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-[#080c14] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono tracking-wide uppercase">
                INSPECT & INGEST TRANSACTION REQUEST
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Submit custom transcript and session metadata to test ML pressure scorer & rule engine.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Presets Bar */}
        <div className="px-5 py-3 bg-[#0a0e17] border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider shrink-0">
            Quick Presets:
          </span>
          {PRESET_TRANSCRIPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(p)}
              className="px-2.5 py-1 rounded text-xs font-mono bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700/80 transition-all shrink-0 hover:border-cyan-500/40"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Executive ID */}
            <div>
              <label className="block text-xs font-mono font-medium text-slate-400 mb-1">
                Claimed Executive ID
              </label>
              <select
                value={executiveId}
                onChange={(e) => setExecutiveId(e.target.value)}
                className="w-full bg-[#070a11] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="exec_007">exec_007 (Chief Executive Officer)</option>
                <option value="exec_003">exec_003 (Chief Financial Officer)</option>
                <option value="exec_012">exec_012 (VP Corporate Treasury)</option>
              </select>
            </div>

            {/* Staff ID */}
            <div>
              <label className="block text-xs font-mono font-medium text-slate-400 mb-1">
                Initiating Staff Member
              </label>
              <input
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full bg-[#070a11] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                placeholder="staff_042"
                required
              />
            </div>

            {/* Channel */}
            <div>
              <label className="block text-xs font-mono font-medium text-slate-400 mb-1">
                Communication Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full bg-[#070a11] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="video_call">Video Call (Deepfake Vishing Risk)</option>
                <option value="phone_call">Phone Call (Audio Voice Cloning)</option>
                <option value="chat">Chat / Instant Messaging</option>
                <option value="email">Business Email (BEC Risk)</option>
              </select>
            </div>

            {/* Transaction Type */}
            <div>
              <label className="block text-xs font-mono font-medium text-slate-400 mb-1">
                Transaction Type
              </label>
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value)}
                className="w-full bg-[#070a11] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="wire_transfer">Wire Transfer</option>
                <option value="credential_reset">Credential Reset</option>
                <option value="beneficiary_change">Beneficiary Account Change</option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-mono font-medium text-slate-400 mb-1">
                Transfer Amount ($ USD)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-[#070a11] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                placeholder="250000"
                required
              />
            </div>

            {/* Beneficiary Account */}
            <div>
              <label className="block text-xs font-mono font-medium text-slate-400 mb-1">
                Beneficiary Account
              </label>
              <input
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full bg-[#070a11] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                placeholder="XXXX-9981"
                required
              />
            </div>

          </div>

          {/* Security Posture Flags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-[#080c14] rounded-lg border border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-slate-300">
              <input
                type="checkbox"
                checked={isNewBeneficiary}
                onChange={(e) => setIsNewBeneficiary(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 bg-slate-900"
              />
              <span>Is New / Unverified Beneficiary</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-slate-300">
              <input
                type="checkbox"
                checked={isRecognizedDevice}
                onChange={(e) => setIsRecognizedDevice(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 bg-slate-900"
              />
              <span>Is Recognized Device Session</span>
            </label>
          </div>

          {/* Request Transcript */}
          <div>
            <label className="block text-xs font-mono font-medium text-slate-400 mb-1">
              Captured Communication Transcript (Analyzed by ML Scorer)
            </label>
            <textarea
              rows={3}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full bg-[#070a11] border border-slate-800 rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 leading-relaxed"
              placeholder="Paste or type request transcript snippet..."
              required
            />
          </div>

          {/* Submit Action */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-mono font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition-all shadow-lg shadow-cyan-950/50 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? "INGESTING..." : "INGEST & ANALYZE REQUEST"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
