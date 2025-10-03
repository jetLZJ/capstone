Feature: Frontend Scheduling Interface

This branch implements the Frontend Scheduling Interface tasks for issue #13.

Planned work items:

- [x] Build weekly schedule calendar view (timeline layout with holiday highlights and open-shift badges)
- [x] Create shift assignment interface (drag-to-reschedule, add/edit modals, open shift fill flow)
- [x] Implement staff schedule viewing component (role-aware Staff dashboard with upcoming shift list)
- [x] Develop shift management forms (ShiftEditor with conflict detection and repeat options)
- [x] Add shift coverage visualization (weekly coverage counters, status chips, active staff tally)
- [x] Create drag-and-drop scheduling interface (Dnd-kit based card interactions with keyboard support)

### October 2025 delivery snapshot

- **Manager tools** – enhanced week API (`/api/schedules/week`) returns open shifts, coverage metrics, and conflict warnings; calendar renders holiday context and timeline markers.
- **Staff experience** – new `StaffDashboard` surfaces notifications, acknowledgements, and next-shift cards pulled from `/api/schedules/notifications`.
- **Notification pipeline** – backend seeds `staff_notifications`, exposes acknowledgement endpoint, and updates tests to cover weekly fetch and notifications feed.
- **Test coverage** – expanded `tests/test_schedule.py` covers notifications, coverage counts, and conflict resolution.

Base branch: development-frontend
Based on commit: 009a3ec2e36e2cdd2007c436b972b08461d4cac0
