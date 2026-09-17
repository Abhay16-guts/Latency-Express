import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Navbar } from './components/Navbar.js';
import { HomePage } from './pages/HomePage.js';
import { SeatSelectionPage } from './pages/SeatSelectionPage.js';
import { QueueWaitingPage } from './pages/QueueWaitingPage.js';
import { BookingConfirmationPage } from './pages/BookingConfirmationPage.js';
import { MyBookingsPage } from './pages/MyBookingsPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { Train, ShieldCheck, Activity } from 'lucide-react';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f17] text-slate-100 selection:bg-emerald-500 selection:text-white">
      <Navbar />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/book/:trainId" element={<SeatSelectionPage />} />
          <Route path="/queue" element={<QueueWaitingPage />} />
          <Route path="/confirmation/:id" element={<BookingConfirmationPage />} />
          <Route path="/my-bookings" element={<MyBookingsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="*"
            element={
              <div className="max-w-md mx-auto my-24 p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center">
                <h1 className="text-4xl font-black text-emerald-400 font-mono mb-2">404</h1>
                <h2 className="text-lg font-bold text-white mb-2">Station Not Found</h2>
                <p className="text-xs text-slate-400 mb-6">The requested platform or route does not exist.</p>
                <Link
                  to="/"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-block"
                >
                  Return to Central Station
                </Link>
              </div>
            }
          />
        </Routes>
      </main>

      {/* Modern Engineering Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-8 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-2">
            <Train className="w-4 h-4 text-emerald-500" />
            <span className="font-bold text-slate-300">LATENCY EXPRESS</span>
            <span>•</span>
            <span>High-Concurrency Tatkal Research Engine</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              Zero Double-Booking Guarantee
            </span>
            <span>•</span>
            <Link to="/dashboard" className="text-slate-400 hover:text-white flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Live Telemetry
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
