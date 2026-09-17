import type { 
  ApiResponse, 
  Schedule, 
  Seat, 
  Booking, 
  QueueTicket, 
  LiveSystemMetrics, 
  Station,
  User 
} from '@latency-express/types';

const API_BASE = '/api/v1';

export function getAuthToken(): string | null {
  return localStorage.getItem('latency_express_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('latency_express_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('latency_express_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const json: ApiResponse<T> = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || `Request failed with status ${res.status}`);
  }

  return json.data as T;
}

export const api = {
  auth: {
    login: (body: any) => request<{ user: User; token: string }>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    register: (body: any) => request<{ user: User; token: string }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    me: () => request<{ user: User }>('/auth/me'),
  },
  trains: {
    search: (params?: { source?: string; destination?: string; date?: string }) => {
      const qs = new URLSearchParams(params as any).toString();
      return request<Schedule[]>(`/trains${qs ? `?${qs}` : ''}`);
    },
    getStations: () => request<Station[]>('/trains/stations'),
    getAvailability: (trainId: string, scheduleId: string) => 
      request<Seat[]>(`/trains/${trainId}/availability?scheduleId=${scheduleId}`),
  },
  bookings: {
    create: (body: any, idempotencyKey?: string) => {
      const key = idempotencyKey || `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      return request<{ booking?: Booking; status?: string; ticket?: QueueTicket }>('/bookings', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify(body),
      });
    },
    list: () => request<Booking[]>('/bookings'),
    get: (id: string) => request<Booking>(`/bookings/${id}`),
    cancel: (id: string) => request<{ message: string }>(`/bookings/${id}`, { method: 'DELETE' }),
  },
  queue: {
    getStatus: () => request<{ queueLength: number; jainsFairnessIndex: number; isOverloaded: boolean }>('/queue/status'),
    getPosition: (ticketId: string) => request<{
      ticketId: string;
      status: string;
      position: number;
      totalInQueue: number;
      booking?: Booking;
      error?: string;
    }>(`/queue/position?ticketId=${ticketId}`),
  },
  metrics: {
    getTelemetry: () => request<LiveSystemMetrics>('/admin/telemetry'),
  },
};
