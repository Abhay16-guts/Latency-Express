import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, Activity } from 'lucide-react';
import { api } from '../lib/api.js';

export const QueueWaitingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const ticketId = searchParams.get('ticketId') || '';
  const navigate = useNavigate();

  const { data: ticketStatus, isLoading, isError } = useQuery({
    queryKey: ['queueTicket', ticketId],
    queryFn: () => api.queue.getPosition(ticketId),
    enabled: !!ticketId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'COMPLETED' || data?.status === 'FAILED') return false;
      return 1000; // poll every 1s while in queue
    },
  });

  useEffect(() => {
    if (ticketStatus?.status === 'COMPLETED' && ticketStatus.booking) {
      const timer = setTimeout(() => {
        navigate(`/confirmation/${ticketStatus.booking?.id}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [ticketStatus, navigate]);

  if (!ticketId) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
        <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white">Missing Queue Ticket</h2>
        <p className="text-xs text-slate-400 mt-1 mb-4">No active ticket was found for this waiting room.</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
        >
          Return Home
        </button>
      </div>
    );
  }

  const isCompleted = ticketStatus?.status === 'COMPLETED';
  const isFailed = ticketStatus?.status === 'FAILED';

  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden backdrop-blur">
        
        {/* Top Glow Background */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Status Indicator */}
        <div className="relative z-10 flex flex-col items-center">
          
          {isCompleted ? (
            <div className="w-20 h-20 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-6">
              <CheckCircle2 className="w-10 h-10" />
            </div>
          ) : isFailed ? (
            <div className="w-20 h-20 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mb-6">
              <AlertCircle className="w-10 h-10" />
            </div>
          ) : (
            <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-slate-800 border-t-emerald-400 animate-spin"></div>
              <Clock className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>
          )}

          {/* Heading */}
          <h1 className="text-2xl font-black text-white tracking-tight">
            {isCompleted
              ? 'Reservation Allocated!'
              : isFailed
              ? 'Reservation Unavailable'
              : 'You Are In The Tatkal Queue'}
          </h1>

          <p className="text-xs text-slate-400 mt-2 max-w-sm">
            {isCompleted
              ? 'Your seat has been reserved with transactional atomicity. Redirecting to confirmation...'
              : isFailed
              ? ticketStatus?.error || 'Another concurrent user secured the target seat.'
              : 'Dynamic admission control is actively regulating database concurrency to guarantee zero race-condition corruption.'}
          </p>

          {/* Queue Rank Badge */}
          {!isCompleted && !isFailed && (
            <div className="mt-8 p-6 rounded-2xl bg-slate-950 border border-slate-800 w-full max-w-xs shadow-inner">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Current Position In Line
              </div>
              <div className="text-4xl font-black font-mono text-emerald-400 mt-1">
                #{ticketStatus?.position || 1}
              </div>
              <div className="text-[11px] text-slate-400 mt-2 font-mono flex items-center justify-center gap-2">
                <Activity className="w-3 h-3 text-emerald-400" />
                Est. wait: ~{Math.max(1, (ticketStatus?.position || 1) * 2)}s
              </div>
            </div>
          )}

          {/* Ticket ID Reference */}
          <div className="mt-6 text-[10px] font-mono text-slate-500">
            Ticket ID: <span className="text-slate-400">{ticketId}</span>
          </div>

          {/* Actions */}
          {isCompleted && (
            <button
              onClick={() => navigate(`/confirmation/${ticketStatus.booking?.id}`)}
              className="mt-6 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-950"
            >
              View Confirmed Ticket
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {isFailed && (
            <button
              onClick={() => navigate('/')}
              className="mt-6 px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all"
            >
              Search Alternate Trains
            </button>
          )}

        </div>

      </div>
    </div>
  );
};
