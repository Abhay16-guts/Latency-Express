import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Train, 
  ArrowRightLeft, 
  Calendar, 
  Search, 
  Clock, 
  CheckCircle2, 
  Zap, 
  ShieldCheck, 
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { api } from '../lib/api.js';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const todayStr = new Date().toISOString().split('T')[0];

  const [source, setSource] = useState('NDLS');
  const [destination, setDestination] = useState('BCT');
  const [date, setDate] = useState(todayStr);

  const { data: stations = [] } = useQuery({
    queryKey: ['stations'],
    queryFn: () => api.trains.getStations(),
  });

  const { data: schedules = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['trains', source, destination, date],
    queryFn: () => api.trains.search({ source, destination, date }),
  });

  const handleSwap = () => {
    setSource(destination);
    setDestination(source);
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-b border-slate-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent pointer-events-none"></div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium mb-6">
            <Zap className="w-3.5 h-3.5" />
            TATKAL CONCURRENCY ENGINE READY • P99 &lt; 95ms
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
            Zero-Conflict Railway Reservation
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Engineered for high-volume demand spikes. Guaranteed strict seat consistency via PostgreSQL row-locking and Redis token-bucket admission control.
          </p>

          {/* Search Box */}
          <div className="mt-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur">
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center">
              
              {/* Origin */}
              <div className="md:col-span-2 text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Origin Station
                </label>
                <div className="relative">
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  >
                    {stations.map((st) => (
                      <option key={st.id} value={st.code}>
                        {st.code} — {st.city}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Swap Button */}
              <div className="flex justify-center md:pt-6">
                <button
                  type="button"
                  onClick={handleSwap}
                  className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-all"
                  title="Swap stations"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </button>
              </div>

              {/* Destination */}
              <div className="md:col-span-2 text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Destination Station
                </label>
                <div className="relative">
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  >
                    {stations.map((st) => (
                      <option key={st.id} value={st.code}>
                        {st.code} — {st.city}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date */}
              <div className="md:col-span-2 text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Journey Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Available Trains Section */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Train className="w-5 h-5 text-emerald-400" />
              Available Schedules ({schedules.length})
            </h2>
            <p className="text-xs text-slate-400">
              Real-time authoritative seat inventory synchronized with PostgreSQL ACID storage.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Refresh Seats
          </button>
        </div>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-36 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <h3 className="font-semibold text-red-300">Unable to retrieve schedules</h3>
            <p className="text-xs text-slate-400 mt-1">Please verify backend connectivity and try again.</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && schedules.length === 0 && (
          <div className="p-12 rounded-2xl bg-slate-900/50 border border-slate-800 text-center">
            <Train className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-300 text-base">No scheduled trains found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Try searching between <span className="text-emerald-400 font-mono">NDLS</span> and <span className="text-emerald-400 font-mono">BCT</span> or <span className="text-emerald-400 font-mono">BSB</span> on today's date.
            </p>
          </div>
        )}

        {/* Train Cards List */}
        <div className="space-y-4">
          {schedules.map((schedule) => {
            const hasSeats = (schedule.availableSeatsCount || 0) > 0;
            return (
              <div
                key={schedule.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all shadow-lg hover:shadow-xl"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  
                  {/* Train Identity */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-sm text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        #{schedule.trainNumber}
                      </span>
                      <h3 className="font-bold text-white text-base">{schedule.trainName}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-1">
                      <span>RUNS DAILY</span>
                      <span>•</span>
                      <span className="text-slate-300 font-medium">{schedule.journeyDate}</span>
                    </div>
                  </div>

                  {/* Route & Times */}
                  <div className="flex items-center gap-6 sm:text-center">
                    <div>
                      <div className="text-base font-bold text-white font-mono">
                        {new Date(schedule.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-xs text-slate-400">{schedule.sourceStationCode}</div>
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-500 font-mono mb-0.5">DIRECT</span>
                      <div className="w-16 sm:w-24 h-0.5 bg-slate-700 relative">
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-emerald-400"></div>
                      </div>
                    </div>

                    <div>
                      <div className="text-base font-bold text-white font-mono">
                        {new Date(schedule.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-xs text-slate-400">{schedule.destinationStationCode}</div>
                    </div>
                  </div>

                  {/* Availability Badge & Book Action */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    <div className="text-left sm:text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          hasSeats
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${hasSeats ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        {hasSeats ? `${schedule.availableSeatsCount} Available` : 'Sold Out'}
                      </span>
                    </div>

                    <button
                      onClick={() => navigate(`/book/${schedule.trainId}?scheduleId=${schedule.id}`)}
                      disabled={!hasSeats}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md ${
                        hasSeats
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Book Tatkal
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
