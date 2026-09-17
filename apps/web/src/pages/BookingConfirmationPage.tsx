import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Train, Calendar, User, ShieldCheck, Printer, ArrowLeft, Clock } from 'lucide-react';
import { api } from '../lib/api.js';

export const BookingConfirmationPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const { data: booking, isLoading, isError } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.bookings.get(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto my-16 p-8 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse text-center">
        <Clock className="w-8 h-8 text-emerald-400 mx-auto animate-spin mb-3" />
        <div className="text-slate-400 text-sm font-medium">Retrieving transactional booking record...</div>
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
        <h2 className="text-lg font-bold text-white mb-2">Booking Record Not Found</h2>
        <p className="text-xs text-slate-400 mb-6">Unable to retrieve ticket details for this reference.</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Top action bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Book Another Ticket
        </button>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Print Ticket
        </button>
      </div>

      {/* Ticket Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Ticket Header */}
        <div className="bg-gradient-to-r from-emerald-900/40 via-slate-900 to-slate-900 border-b border-slate-800 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider">
                  TRANSACTION CONFIRMED (ACID COMMITTED)
                </span>
                <h1 className="text-2xl font-black text-white">Tatkal Reservation Confirmed</h1>
              </div>
            </div>

            <div className="text-left sm:text-right bg-slate-950/60 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-slate-800">
              <div className="text-[10px] font-mono text-slate-400 uppercase font-semibold">PNR Reference</div>
              <div className="text-xl font-mono font-black text-emerald-400 tracking-wider mt-0.5">
                {booking.pnr}
              </div>
            </div>
          </div>
        </div>

        {/* Train & Schedule Details */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 mr-2">
                  #{booking.trainNumber}
                </span>
                <span className="text-base font-bold text-white">{booking.trainName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Date: {booking.journeyDate}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 text-center items-center">
              <div className="text-left">
                <div className="text-xs text-slate-400">Boarding</div>
                <div className="text-lg font-black text-white font-mono">{booking.sourceStation}</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {new Date(booking.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-500 font-mono">DIRECT ROUTE</span>
                <div className="w-full h-0.5 bg-slate-800 relative my-1">
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-emerald-400"></div>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono font-semibold">ZERO-CONFLICT</span>
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-400">Destination</div>
                <div className="text-lg font-black text-white font-mono">{booking.destinationStation}</div>
                <div className="text-[11px] text-slate-500 font-mono">Scheduled Arrival</div>
              </div>
            </div>
          </div>

          {/* Passenger & Berth Breakdown */}
          <div>
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider font-mono mb-3">
              Allocated Passengers ({booking.passengers.length})
            </h2>

            <div className="space-y-2">
              {booking.passengers.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-mono font-bold text-[10px]">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{p.fullName}</div>
                      <div className="text-[10px] text-slate-400">
                        {p.age} yrs • {p.gender}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-emerald-400 text-sm">
                      Coach {p.coachNumber} • Seat #{p.seatNumber}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 uppercase">
                      {p.coachClass} ({p.berthPreference || 'BERTH'})
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial & Audit Summary */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-mono text-slate-300">Payment: SUCCESS (SIMULATED GATEWAY)</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Booking ID: {booking.id}
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-xs text-slate-400">Total Fare Charged</span>
              <div className="text-2xl font-black font-mono text-emerald-400">
                ₹{booking.totalFare}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
