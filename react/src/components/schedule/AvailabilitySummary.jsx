import React from 'react';

export default function AvailabilitySummary({ entries = [], weekStart, onOpen }) {
  const total = entries.length || 0;
  const available = entries.filter((e) => e.is_available === true).length;
  const unavailable = entries.filter((e) => e.is_available === false).length;

  const heading = weekStart
    ? `Availability for week of ${new Date(weekStart).toLocaleDateString()}`
    : 'Availability';

  return (
    <div className="rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-6 shadow-sm transition">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--app-text)]">My availability</h3>
          <p className="text-xs text-[var(--app-muted)]">{heading}</p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-full bg-[var(--app-primary)] px-4 py-2 text-xs font-semibold text-[var(--app-primary-contrast)] shadow-sm transition hover:opacity-90"
        >
          Update availability
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-xs text-[var(--app-muted)]">Available</div>
            <div className="text-xl font-bold text-[var(--app-success)]">{available}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--app-muted)]">Unavailable</div>
            <div className="text-xl font-bold text-[var(--app-warning)]">{unavailable}</div>
          </div>
        </div>
        <div className="text-sm text-[var(--app-muted)]">{total} day{total === 1 ? '' : 's'}</div>
      </div>
    </div>
  );
}
