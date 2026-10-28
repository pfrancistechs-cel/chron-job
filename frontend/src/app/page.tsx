"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  RotateCw,
  Play,
  Layers,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Zap,
  Terminal,
  Activity,
  CheckCircle2,
  Calendar,
  Flame,
  ArrowRight
} from "lucide-react";

interface Task {
  id: string;
  topic: string;
  execute_at: string;
  payload: string;
  retries: number;
  max_retries: number;
  status: "SCHEDULED" | "EXECUTING" | "COMPLETED" | "FAILED_DLQ";
  slot_index: number;
}

interface DLQEntry {
  task: Task;
  failed_at: string;
  failure_desc: string;
}

export default function ChronJobDashboard() {
  const [currentSlot, setCurrentSlot] = useState(14);
  const [slotCount] = useState(30);
  const [totalFired, setTotalFired] = useState(1842);
  const [activeTasks, setActiveTasks] = useState<Task[]>([
    {
      id: "task_billing_01",
      topic: "billing.stripe_charge_settlement",
      execute_at: "In 4s",
      payload: '{"customer_id":"cus_8941","amount":4900}',
      retries: 0,
      max_retries: 3,
      status: "SCHEDULED",
      slot_index: 18,
    },
    {
      id: "task_email_02",
      topic: "notifications.digest_dispatch",
      execute_at: "In 12s",
      payload: '{"recipient":"director@enterprise.io"}',
      retries: 0,
      max_retries: 3,
      status: "SCHEDULED",
      slot_index: 26,
    },
    {
      id: "task_fraud_03",
      topic: "fraud.risk_score_evaluation",
      execute_at: "In 20s",
      payload: '{"txn_id":"tx_9981","risk":"medium"}',
      retries: 0,
      max_retries: 3,
      status: "SCHEDULED",
      slot_index: 4,
    },
  ]);

  const [dlqEntries, setDlqEntries] = useState<DLQEntry[]>([
    {
      task: {
        id: "task_dlq_901",
        topic: "payments.retry_webhook",
        execute_at: "2 hours ago",
        payload: '{"invoice_id":"inv_4821","dest":"https://partner.api/webhook"}',
        retries: 5,
        max_retries: 5,
        status: "FAILED_DLQ",
        slot_index: 0,
      },
      failed_at: "10:14:22 UTC",
      failure_desc: "HTTP 504 Gateway Timeout after 5 exponential backoff retries (Jitter exhausted)",
    },
  ]);

  const [topicInput, setTopicInput] = useState("auth.session_token_expiry");
  const [delayInput, setDelayInput] = useState("6");
  const [payloadInput, setPayloadInput] = useState('{"session_id":"sess_9021","user_id":"u_412"}');

  const [logs, setLogs] = useState<string[]>([
    "[TimingWheel] Slot pointer tick: Slot #14 -> #15 (1-second tick cadence)",
    "[Lease] Worker 'worker-pod-alpha' holds exclusive lease with Fencing Token #104",
    "[Scheduler] 3 tasks indexed in circular buckets across 30 slots (O(1) insertion)",
    "[DLQ] 1 quarantined task in dead-letter archive with replay protection",
  ]);

  // Simulate tick progression
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlot((prev) => {
        const next = (prev + 1) % slotCount;
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [slotCount]);

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const delaySec = parseInt(delayInput) || 5;
    const targetSlot = (currentSlot + delaySec) % slotCount;

    const newTask: Task = {
      id: `task_${Date.now().toString().slice(-6)}`,
      topic: topicInput,
      execute_at: `In ${delaySec}s`,
      payload: payloadInput,
      retries: 0,
      max_retries: 3,
      status: "SCHEDULED",
      slot_index: targetSlot,
    };

    setActiveTasks([newTask, ...activeTasks]);
    setLogs([
      `[SCHEDULED] Task '${newTask.id}' assigned to Slot #${targetSlot} (${delaySec}s delay) in O(1)`,
      ...logs.slice(0, 8),
    ]);
  };

  const handleReplayDLQ = (taskID: string) => {
    const entry = dlqEntries.find((e) => e.task.id === taskID);
    if (!entry) return;

    setDlqEntries(dlqEntries.filter((e) => e.task.id !== taskID));
    const targetSlot = (currentSlot + 3) % slotCount;
    const replayed: Task = {
      ...entry.task,
      status: "SCHEDULED",
      retries: 0,
      slot_index: targetSlot,
      execute_at: "In 3s",
    };

    setActiveTasks([replayed, ...activeTasks]);
    setLogs([
      `[DLQ REPLAY] Popped task '${taskID}' from dead-letter queue -> Rescheduled into Slot #${targetSlot}`,
      ...logs.slice(0, 8),
    ]);
  };

  return (
    <div className="min-h-screen bg-[#070912] text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-orange-950/60 bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-950 px-6 py-4 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30 flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-xl tracking-wider text-white">CHRON<span className="text-orange-400">JOB</span></span>
                <span className="bg-orange-500/20 text-orange-300 border border-orange-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Timing Wheel Core
                </span>
              </div>
              <p className="text-xs text-slate-400">Hierarchical Hashed Timing Wheel ($O(1)$) with Fencing Lease Coordination & DLQ Replay</p>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs font-mono">
            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center space-x-2">
              <span className="text-slate-400">Active Worker Lease:</span>
              <span className="font-bold text-orange-400">worker-pod-alpha (Token #104)</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-emerald-400">
              Total Fired: {totalFired.toLocaleString()}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full p-6 flex-1 space-y-6">
        {/* Timing Wheel Slot Track Visualizer */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <RotateCw className="w-4 h-4 text-orange-400 animate-spin" />
                <span>Timing Wheel Slot Progression (30 Slots • 1s Tick Interval)</span>
              </h3>
              <p className="text-xs text-slate-400">Advancing slot pointer discharges registered tasks with zero table-scan latency.</p>
            </div>
            <div className="text-xs font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              Current Head: <strong className="text-orange-400">Slot #{currentSlot}</strong>
            </div>
          </div>

          {/* Slot Track */}
          <div className="grid grid-cols-5 sm:grid-cols-10 lg:grid-cols-15 gap-2">
            {Array.from({ length: slotCount }).map((_, slotIdx) => {
              const isCurrent = slotIdx === currentSlot;
              const slotTasks = activeTasks.filter((t) => t.slot_index === slotIdx && t.status === "SCHEDULED");

              return (
                <div
                  key={slotIdx}
                  className={`border rounded-xl p-2.5 flex flex-col items-center justify-between transition-all ${
                    isCurrent
                      ? "bg-orange-500/20 border-orange-500 shadow-lg shadow-orange-950/50 scale-105 z-10"
                      : slotTasks.length > 0
                      ? "bg-slate-950/80 border-slate-700"
                      : "bg-slate-950/40 border-slate-800/60 opacity-60"
                  }`}
                >
                  <span className={`text-[10px] font-mono font-bold ${isCurrent ? "text-orange-400" : "text-slate-500"}`}>
                    #{slotIdx}
                  </span>
                  <div className="my-1">
                    {slotTasks.length > 0 ? (
                      <span className="w-5 h-5 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center shadow">
                        {slotTasks.length}
                      </span>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500">
                    {isCurrent ? "NOW" : `${slotIdx}s`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Schedule Task Form & Active Tasks List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Schedule Form */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl h-fit">
            <h4 className="font-bold text-sm text-white mb-2 flex items-center space-x-2">
              <Zap className="w-4 h-4 text-orange-400" />
              <span>Schedule Delayed Job</span>
            </h4>
            <p className="text-xs text-slate-400 mb-4">Inserts delayed job directly into calculated timing bucket in $O(1)$.</p>

            <form onSubmit={handleSchedule} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1 uppercase">Topic / Event Name</label>
                <input
                  type="text"
                  required
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1 uppercase">Delay (Seconds: 1 - 29)</label>
                <input
                  type="number"
                  min="1"
                  max="29"
                  required
                  value={delayInput}
                  onChange={(e) => setDelayInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1 uppercase">Task JSON Payload</label>
                <textarea
                  rows={2}
                  value={payloadInput}
                  onChange={(e) => setPayloadInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-orange-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-500 text-black font-extrabold py-2.5 rounded-lg text-xs transition-colors shadow-md shadow-orange-950/40"
              >
                Insert into Timing Wheel (O(1))
              </button>
            </form>
          </div>

          {/* Active Tasks & DLQ */}
          <div className="lg:col-span-2 space-y-6">
            {/* Scheduled Tasks */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h4 className="font-bold text-sm text-white flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-orange-400" />
                  <span>Pending Scheduled Queue ({activeTasks.length} Tasks)</span>
                </h4>
                <span className="text-xs text-slate-400 font-mono">Dispatches on matching tick</span>
              </div>

              <div className="space-y-2.5">
                {activeTasks.map((t) => (
                  <div key={t.id} className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-orange-400 font-bold">{t.id}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                          {t.topic}
                        </span>
                        <span className="text-[10px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded font-mono font-bold">
                          Slot #{t.slot_index}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] font-mono truncate max-w-md">
                        {t.payload}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-emerald-400 font-mono font-bold text-xs">{t.execute_at}</span>
                      <div className="text-[10px] text-slate-500 mt-0.5">Retries: {t.retries}/{t.max_retries}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dead-Letter Queue (DLQ) */}
            <div className="bg-slate-900/80 border border-rose-950/60 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-rose-950/60">
                <h4 className="font-bold text-sm text-white flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span>Dead-Letter Queue (DLQ Quarantine)</span>
                </h4>
                <span className="text-xs text-rose-400 font-mono">{dlqEntries.length} Quarantined</span>
              </div>

              {dlqEntries.length > 0 ? (
                dlqEntries.map((entry) => (
                  <div key={entry.task.id} className="bg-rose-950/20 border border-rose-900/50 p-3.5 rounded-xl flex items-center justify-between text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-rose-400 font-bold">{entry.task.id}</span>
                        <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded">
                          {entry.task.topic}
                        </span>
                      </div>
                      <div className="text-rose-200/80 text-[11px] leading-relaxed">
                        {entry.failure_desc}
                      </div>
                    </div>

                    <button
                      onClick={() => handleReplayDLQ(entry.task.id)}
                      className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1 shadow-md shadow-rose-950/40"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Replay Job</span>
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-xs text-slate-500">DLQ is empty. All scheduled executions nominal.</div>
              )}
            </div>
          </div>
        </div>

        {/* Live Scheduler Event Stream */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-slate-400" />
              <span>ChronJob Engine Telemetry Stream</span>
            </span>
            <span className="text-[10px] text-orange-400 font-mono">Daemon Port: :8087</span>
          </div>

          <div className="space-y-1.5 font-mono text-[11px] bg-slate-950 p-3 rounded-lg border border-slate-900 max-h-32 overflow-y-auto">
            {logs.map((log, idx) => (
              <div key={idx} className="text-slate-300 leading-relaxed">
                <span className="text-slate-600 mr-2">{idx + 1}.</span>
                {log}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-4 text-xs text-slate-500 text-center">
        ChronJob Durable Scheduler • Built with Go 1.25 + Next.js 15 App Router • Hierarchical Hashed Timing Wheel
      </footer>
    </div>
  );
}


<!-- /* Spoke hand canvas layer */ -->

<!-- /* Worker lease status table */ -->

<!-- /* DLQ inspector component */ -->

<!-- /* Radar sweep styling */ -->
