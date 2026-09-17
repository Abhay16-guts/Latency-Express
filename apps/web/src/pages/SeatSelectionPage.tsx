import React, { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Train, 
  Users, 
  CreditCard, 
  ShieldCheck, 
  AlertTriangle, 
  Lock, 
  ArrowLeft,
  Sparkles,
  Clock
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import type { Seat, BerthType } from '@latency-express/types';

export const SeatSelectionPage: React.FC = () => {
  const { trainId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const scheduleId = searchParams.get('scheduleId') || '';
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [activeCoach, setActiveCoach] = useState<string>('');
  const [passengers, setPassengers] = useState<
    { fullName: string; age: number; gender: 'MALE' | 'FEMALE' | 'OTHER'; berthPreference?: BerthType }[]
  >([
    { fullName: user?.fullName || 'Aarav Sharma', age: 29, gender: 'MALE', berthPreference: 'LOWER' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch seats for schedule
  const { data: seats = [], isLoading, refetch } = useQuery({
    queryKey: ['seats', trainId, scheduleId],
    queryFn: () => api.trains.getAvailability(trainId, scheduleId),
    enabled: !!trainId && !!scheduleId,
    refetchInterval: 3000, // auto-poll every 3s to reflect live concurrent bookings
  });

  // Unique coaches list
  const coaches = Array.from(new Set(seats.map((s) => s.coachNumber)));
  const currentCoach = activeCoach || coaches[0] || '';
  const currentSeats = seats.filter((s) => s.coachNumber === currentCoach);

  const toggleSeat = (seat: Seat) => {
    if (seat.status !== 'AVAILABLE') return;

    if (selectedSeatIds.includes(seat.id)) {
      const next = selectedSeatIds.filter((id) => id !== seat.id);
      setSelectedSeatIds(next);
      setPassengers(passengers.slice(0, Math.max(1, next.length)));
    } else {
      if (selectedSeatIds.length >= 4) {
        alert('Maximum 4 seats allowed per booking under Tatkal quota.');
        return;
      }
      const next = [...selectedSeatIds, seat.id];
      setSelectedSeatIds(next);
      if (passengers.length < next.length) {
        setPassengers([
          ...passengers,
          { fullName: '', age: 25, gender: 'FEMALE', berthPreference: 'LOWER' },
        ]);
      }
    }
  };

  const handlePassengerChange = (index: number, field: string, val: any) => {
    const next = [...passengers];
    next[index] = { ...next[index], [field]: val };
    setPassengers(next);
  };

  const selectedSeatsList = seats.filter((s) => selectedSeatIds.includes(s.id));
  const totalFare = selectedSeatsList.reduce((sum, s) => sum + s.basePrice, 0);

  const handleBooking = async () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    if (!selectedSeatIds.length) {
      setErrorMessage('Please select at least one seat to proceed.');
      return;
    }

    // Validate passenger fields
    for (let i = 0; i < passengers.length; i++) {
      if (!passengers[i].fullName.trim()) {
        setErrorMessage(`Please enter the full name for Passenger ${i + 1}.`);
        return;
      }
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const idempotencyKey = `tatkal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const res = await api.bookings.create(
        {
          scheduleId,
          seatIds: selectedSeatIds,
          passengers,
          simulatePaymentDelayMs: 300,
        },
        idempotencyKey
      );

      if (res.status === 'QUEUED' && res.ticket) {
        navigate(`/queue?ticketId=${res.ticket.ticketId}`);
      } else if (res.booking) {
        navigate(`/confirmation/${res.booking.id}`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Seat contention conflict. Another user secured this seat.');
      refetch();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Train Search
      </button>

      {/* Page Title & Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Train className="w-6 h-6 text-emerald-400" />
            Interactive Coach Berth Layout
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time seat contention engine with sub-millisecond PostgreSQL <span className="text-emerald-400 font-mono">FOR UPDATE</span> row-locking.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-slate-900 border border-slate-700"></span>
            <span className="text-slate-400">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-emerald-500/20 border-2 border-emerald-400"></span>
            <span className="text-emerald-300 font-medium">Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-500/20 border border-amber-500/50"></span>
            <span className="text-amber-400">Processing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-slate-950 border border-slate-800"></span>
            <span className="text-slate-600">Booked</span>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="my-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-bold">Contention / Reservation Alert</div>
            <div className="text-xs mt-0.5">{errorMessage}</div>
          </div>
        </div>
      )}

      {/* Main Grid: Coach & Seats on Left, Passenger & Summary on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
        
        {/* Left Column: Coaches & Seat Grid */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Coach Tab Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
            {coaches.map((c) => {
              const coachSeatSample = seats.find((s) => s.coachNumber === c);
              const isCurrent = c === currentCoach;
              return (
                <button
                  key={c}
                  onClick={() => setActiveCoach(c)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    isCurrent
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950 border border-emerald-400'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>Coach {c}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 font-mono">
                    {coachSeatSample?.coachClass}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Seat Grid Layout */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 tracking-wider uppercase font-mono">
                Coach {currentCoach} — Berth Layout (Lower / Middle / Upper / Side)
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">
                LIVE STATUS AUTO-POLLING
              </span>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5 animate-pulse">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-slate-800/50" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {currentSeats.map((seat) => {
                  const isSelected = selectedSeatIds.includes(seat.id);
                  const isAvailable = seat.status === 'AVAILABLE';
                  const isBooked = seat.status === 'BOOKED';
                  const isProcessing = seat.status === 'LOCKED' || seat.status === 'PROCESSING';

                  return (
                    <button
                      key={seat.id}
                      onClick={() => toggleSeat(seat)}
                      disabled={!isAvailable}
                      className={`relative p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 ring-2 ring-emerald-500 shadow-lg shadow-emerald-950 scale-95'
                          : isAvailable
                          ? 'bg-slate-950 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 text-slate-200 cursor-pointer'
                          : isProcessing
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 cursor-not-allowed'
                          : 'bg-slate-950/40 border-slate-900 text-slate-700 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <span className="text-sm font-black font-mono">#{seat.seatNumber}</span>
                      <span className="text-[9px] uppercase tracking-wider font-semibold opacity-75 mt-0.5">
                        {seat.berthType.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-mono mt-1 font-bold text-slate-400">
                        ₹{seat.basePrice}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Passenger Details & Summary */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
              <Users className="w-4 h-4 text-emerald-400" />
              Passenger Information ({selectedSeatIds.length} Selected)
            </h2>

            {selectedSeatIds.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                Click available berths on the left to allocate seats and specify passenger details.
              </div>
            ) : (
              <div className="space-y-4">
                {selectedSeatsList.map((seat, index) => (
                  <div key={seat.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span>Passenger {index + 1}</span>
                      <span className="text-emerald-400 font-mono">
                        Coach {seat.coachNumber} — #{seat.seatNumber} ({seat.berthType})
                      </span>
                    </div>

                    <input
                      type="text"
                      placeholder="Full Name as on ID"
                      value={passengers[index]?.fullName || ''}
                      onChange={(e) => handlePassengerChange(index, 'fullName', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Age</label>
                        <input
                          type="number"
                          value={passengers[index]?.age || 25}
                          onChange={(e) => handlePassengerChange(index, 'age', parseInt(e.target.value, 10))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Gender</label>
                        <select
                          value={passengers[index]?.gender || 'MALE'}
                          onChange={(e) => handlePassengerChange(index, 'gender', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Price Breakdown */}
                <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Base Fare ({selectedSeatIds.length} seat(s))</span>
                    <span className="font-mono text-white font-semibold">₹{totalFare}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Tatkal Premium Charge</span>
                    <span className="font-mono text-white font-semibold">₹0</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
                    <span>Total Fare</span>
                    <span className="font-mono text-emerald-400">₹{totalFare}</span>
                  </div>
                </div>

                {/* Reserve CTA */}
                <button
                  onClick={handleBooking}
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Acquiring Atomicity Lock...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Confirm & Reserve (Atomic)
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 text-center font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  PROTECTED BY IDEMPOTENCY KEY & ROW-LOCKING
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
