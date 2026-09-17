// Domain types for Latency Express

export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
}

export interface Station {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
}

export interface Train {
  id: string;
  trainNumber: string;
  name: string;
  trainType: string;
  isActive: boolean;
}

export interface Schedule {
  id: string;
  trainId: string;
  trainNumber: string;
  trainName: string;
  sourceStationId: string;
  sourceStationCode: string;
  sourceStationName: string;
  destinationStationId: string;
  destinationStationCode: string;
  destinationStationName: string;
  departureTime: string;
  arrivalTime: string;
  journeyDate: string;
  status: 'SCHEDULED' | 'BOARDING' | 'DEPARTED' | 'CANCELLED';
  availableSeatsCount?: number;
  totalSeatsCount?: number;
}

export type CoachClass = '1A' | '2A' | '3A' | 'SL' | 'CC' | 'EC';

export interface Coach {
  id: string;
  trainId: string;
  coachNumber: string;
  coachClass: CoachClass;
  totalSeats: number;
}

export type SeatStatus = 'AVAILABLE' | 'LOCKED' | 'PROCESSING' | 'BOOKED' | 'UNAVAILABLE';
export type BerthType = 'LOWER' | 'MIDDLE' | 'UPPER' | 'SIDE_LOWER' | 'SIDE_UPPER' | 'WINDOW';

export interface Seat {
  id: string;
  coachId: string;
  coachNumber: string;
  coachClass: CoachClass;
  scheduleId: string;
  seatNumber: string;
  berthType: BerthType;
  status: SeatStatus;
  basePrice: number;
  version: number;
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'FAILED';

export interface Passenger {
  id?: string;
  bookingId?: string;
  seatId?: string;
  seatNumber?: string;
  coachNumber?: string;
  coachClass?: CoachClass;
  fullName: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  berthPreference?: BerthType;
}

export interface Booking {
  id: string;
  pnr: string;
  userId: string;
  scheduleId: string;
  trainNumber: string;
  trainName: string;
  sourceStation: string;
  destinationStation: string;
  journeyDate: string;
  departureTime: string;
  status: BookingStatus;
  totalFare: number;
  passengers: Passenger[];
  paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED';
  bookingTime: string;
}

export type QueueStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'EXPIRED' | 'REJECTED' | 'FAILED';

export interface QueueTicket {
  ticketId: string;
  userId: string;
  scheduleId: string;
  seatIds: string[];
  position: number;
  totalInQueue: number;
  status: QueueStatus;
  estimatedWaitSeconds: number;
  enqueuedAt: number;
}

export interface BookingRequestDTO {
  scheduleId: string;
  seatIds: string[];
  passengers: {
    fullName: string;
    age: number;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    berthPreference?: BerthType;
  }[];
  simulatePaymentDelayMs?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export interface LiveSystemMetrics {
  timestamp: string;
  activeConnections: number;
  requestsPerSecond: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  activeQueueLength: number;
  successfulBookings: number;
  contentionConflicts: number;
  rateLimitRejections: number;
  doubleBookingsPrevented: number;
  dbPoolActive: number;
  dbPoolIdle: number;
  dbPoolTotal?: number;
  jainsFairnessIndex: number;
  currentMode: string;
}
