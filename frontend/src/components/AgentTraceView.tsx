"use client";

import React, { useState } from "react";
import type { AgentExecutionTrace } from "../lib/types";

interface AgentTraceViewProps {
  trace: AgentExecutionTrace;
}

export const AgentTraceView: React.FC<AgentTraceViewProps> = ({ trace }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!trace || !trace.tools_executed || trace.tools_executed.length === 0) {
    return null;
  }

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "DATA_RETRIEVAL":
        return {
          bg: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
          label: "Data Retrieval",
          icon: "📡",
        };
      case "QUANTITATIVE_ANALYSIS":
        return {
          bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
          label: "Quantitative Math",
          icon: "🧮",
        };
      case "SYNTHESIS":
        return {
          bg: "bg-purple-500/10 border-purple-500/30 text-purple-400",
          label: "Cognitive Synthesis",
          icon: "🧠",
        };
      case "GUARDRAIL":
        return {
          bg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
          label: "Guardrail",
          icon: "🛡️",
        };
      default:
        return {
          bg: "bg-slate-500/10 border-slate-500/30 text-slate-300",
          label: "Tool",
          icon: "⚙️",
        };
    }
  };

  return (
    <section
      aria-label="Jejak Eksekusi Otonom AI Agent"
      className="mt-6 rounded-2xl border border-emerald-500/20 bg-slate-900/70 backdrop-blur-md overflow-hidden transition-all duration-300 shadow-lg shadow-emerald-950/20"
    >
      {/* Header Accordion Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold text-sm">
            🤖
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white tracking-wide">
                Agentic Execution Trace & Tool Registry
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {trace.tools_executed.length} Tools Invoked
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Otonom multi-langkah: persepsi, pemanggilan tools, deterministik math, & sintesis ({trace.total_duration_ms}ms)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="hidden sm:inline-block text-xs font-mono text-emerald-400/90 bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-800/40">
            ⚡ {trace.total_duration_ms} ms
          </span>
          <span className="text-slate-400 text-sm transform transition-transform duration-200">
            {isOpen ? "▲ Sembunyikan" : "▼ Tampilkan Rincian"}
          </span>
        </div>
      </button>

      {/* Expanded Details */}
      {isOpen && (
        <div className="px-5 pb-5 pt-2 border-t border-slate-800/80 space-y-4">
          {/* Goal & Guardrail Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start space-x-3">
              <span className="text-lg">🎯</span>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Tujuan Agen (Goal)
                </p>
                <p className="text-sm text-slate-200 font-medium">{trace.goal}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-emerald-900/40 flex items-start space-x-3">
              <span className="text-lg">🛡️</span>
              <div>
                <div className="flex items-center space-x-2">
                  <p className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
                    Guardrail Anti-Halusinasi
                  </p>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                    VERIFIED
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {trace.guardrail_verification.rule}
                </p>
              </div>
            </div>
          </div>

          {/* Sequential Tool Execution Steps */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
              Alur Eksekusi Tools Otonom:
            </h4>
            <div className="space-y-2">
              {trace.tools_executed.map((step, idx) => {
                const badge = getCategoryBadge(step.category);
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-bold font-mono">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className="font-mono text-sm text-slate-200 font-semibold">
                            {step.tool}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${badge.bg}`}
                          >
                            <span className="mr-1">{badge.icon}</span>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{step.summary}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-end sm:self-center flex-shrink-0">
                      <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {step.duration_ms} ms
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        ✓ {step.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
