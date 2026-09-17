# Frontend Design, Responsiveness and Performance

## Design direction

TatkalCore should feel like a premium, technical, trustworthy
transportation platform rather than a generic CRUD dashboard.

Use restrained surfaces, strong hierarchy, semantic status colors,
readable typography, an 8px spacing rhythm, consistent radius and subtle
shadows.

Avoid excessive gradients, glassmorphism everywhere, decorative
animation and visual noise.

## Color semantics

Use a controlled primary accent plus neutral surfaces and semantic: -
success - warning - error - information

Never make color the only indicator of important state.

## Required pages

Public: - Landing - Search - Search Results - Train Details - Login -
Register

Booking: - Seat Selection - Passenger Details - Booking Review - Queue -
Booking Processing - Confirmation - My Bookings - Booking Details

Admin: - Dashboard - Train Management - Station Management - Schedule
Management - Live System Dashboard - Experiment Metrics

System/error: - 404 - 403 - 500 - Network Error - Service Unavailable -
Session Expired - Empty Results - Empty Booking History - Queue Closed -
Booking Failed - Seat No Longer Available

## Loading

Use layout-matching skeletons for cards, seats, tables, booking details
and dashboards. Avoid blank screens.

## Network error

Provide clear recovery: `Unable to connect → Try Again`. For booking
uncertainty, check booking status before blindly resubmitting.

## Seat map

States: `AVAILABLE`, `SELECTED`, `BOOKED`, `PROCESSING/LOCKED`,
`UNAVAILABLE`. Provide legend and keyboard/screen-reader support.

## Queue

Show queue position, connection status, useful waiting information and
system status. Do not fake exact wait times.

## Responsive design

Mobile-first. Build layout breakpoints based on content needs: - mobile:
booking/search/queue first - tablet: useful two-column layouts -
desktop: dashboards, charts and dense tables

## Accessibility

Semantic HTML, keyboard navigation, visible focus, labels, accessible
dialogs, status announcements, contrast and reduced-motion support.

## State management

Use TanStack Query for server state such as trains, availability,
bookings, queue and metrics. Keep local UI state local.

## Performance

Use: - route/code splitting - lazy loading - request deduplication -
debouncing where useful - pagination - virtualization for genuinely
large lists - memoization only where it prevents measured rerenders -
WebP/AVIF and responsive images - safe caching - small JSON payloads -
HTTP caching/conditional requests where appropriate

Never use cached availability as proof that a seat is still available.

## Animation

Use restrained transitions for navigation, queue/status changes and
dashboards. Avoid animating every element. Respect
`prefers-reduced-motion`.

## Dashboard

Show active users, requests/sec, queue length, successful/failed
bookings, P95, P99 and fairness index. Use charts only when they
communicate trends.

## UX checklist

Responsive mobile/tablet/desktop; skeletons; network errors; retries;
empty states; 404/403/500; booking-processing state; no duplicate
booking clicks; lazy routes; optimized images; accessibility; reduced
motion; no unnecessary rerenders.
