import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ticket, Train, Calendar, User, XCircle, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';

export const MyBookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['myBookings'],
    queryFn: () => api.bookings.list(),
    enabled: isAuthenticated,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.bookings.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myBookings'] });
      setCancellingId(null);
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to cancel booking');
      setCancellingId(null);
    },
  });

  const handleCancel = (id: string, pnr: string) => {
    if (confirm(`Are you sure you want to cancel booking ${pnr}? Allocated seats will be atomically released back to inventory.`)) {
      setCancellingId(id);
      cancelMutation.mutate(id);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center">
        <Ticket className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white">Sign In to View Bookings</h2>
        <p className="text-xs text-slate-400 mt-1 mb-6">
          Access your confirmed Tatkal reservations and transaction history.
        </p>
        <button
          onClick={() => navigate('/login?redirect=/my-bookings')}
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-950"
        >
          Sign In Now
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-8">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Ticket className="w-6 h-6 text-emerald-400" />
            My Reservations & PNR History
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative transactional tickets issued with PostgreSQL consistency.
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          Book New Ticket
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="h-40 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && bookings.length === 0 && (
        <div className="p-12 rounded-3xl bg-slate-900/50 border border-slate-800 text-center">
          <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="font-bold text-white text-base">No active reservations</h3>
          <p className="text-xs text-slate-500 mt-1 mb-6 max-w-sm mx-auto">
            You haven't booked any Tatkal tickets yet. Search available trains to experience our sub-second atomic reservation engine.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
          >
            Search Schedules
          </button>
        </div>
      )}

      <div className="space-y-6">
        {bookings.map((booking) => {
          const isConfirmed = booking.status === 'CONFIRMED';
          const isCancelled = booking.status === 'CANCELLED';

          return (
            <div
              key={booking.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl"
            >
              {/* Card Top Banner */}
              <div className="p-5 sm:px-6 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    PNR: {booking.pnr}
                  </span>
                  <div className="text-xs text-slate-400 font-mono">
                    Booked on {new Date(booking.bookingTime).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                      isConfirmed
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}
                  >
                    {booking.status}
                  </span>

                  {isConfirmed && (
                    <button
                      onClick={() => handleCancel(booking.id, booking.pnr)}
                      disabled={cancellingId === booking.id}
                      className="px-3 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {cancellingId === booking.id ? 'Releasing...' : 'Cancel Booking'}
                    </button>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-white text-base">
                      #{booking.trainNumber} — {booking.trainName}
                    </h3>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      Journey Date: {booking.journeyDate} • Departure: {booking.sourceStation} → Arrival: {booking.destinationStation}
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-xs text-slate-400">Total Fare</span>
                    <div className="text-xl font-mono font-black text-emerald-400">
                      ₹{booking.totalFare}
                    </div>
                  </div>
                </div>

                {/* Passengers List */}
                <div className="pt-3 border-t border-slate-800">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Passengers
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {booking.passengers.map((p, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-200">{p.fullName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {p.age} yrs • {p.gender}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="text-emerald-400 font-bold">
                            Coach {p.coachNumber} • #{p.seatNumber}
                          </div>
                          <div className="text-[10px] text-slate-400 uppercase">
                            {p.coachClass} ({p.berthPreference || 'BERTH'})
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
