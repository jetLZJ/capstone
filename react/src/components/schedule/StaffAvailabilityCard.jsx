import { useEffect, useMemo, useState } from 'react';

const formatDayLabel = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const normalizeEntry = (entry = {}) => ({
  ...entry,
  notes: entry.notes || '',
  is_available:
    entry.is_available === null || entry.is_available === undefined
      ? null
      : Boolean(entry.is_available),
});

export default function StaffAvailabilityCard({
  entries = [],
  weekStart,
  onSave,
  isSaving = false,
  isLoading = false,
}) {
  const [baseline, setBaseline] = useState([]);
  const [draft, setDraft] = useState([]);

  useEffect(() => {
    const normalized = (entries || []).map((entry) => normalizeEntry(entry));
    setBaseline(normalized);
    setDraft(normalized);
  }, [entries]);

  const baselineLookup = useMemo(() => {
    const map = new Map();
    baseline.forEach((entry) => {
      map.set(entry.date, entry);
    });
    return map;
  }, [baseline]);

  const hasChanges = useMemo(() => {
    if (draft.length !== baseline.length) return true;
    return draft.some((entry) => {
      const original = baselineLookup.get(entry.date);
      if (!original) {
        return entry.is_available !== null || (entry.notes || '').trim().length > 0;
      }
      return (
        original.is_available !== entry.is_available ||
        (original.notes || '') !== (entry.notes || '')
      );
    });
  }, [draft, baseline.length, baselineLookup]);

  const handleToggle = (date, value) => {
    setDraft((prev) =>
      prev.map((entry) =>
        entry.date === date ? { ...entry, is_available: value } : entry,
      ),
    );
  };

  const handleNoteChange = (date, value) => {
    setDraft((prev) =>
      prev.map((entry) =>
        entry.date === date ? { ...entry, notes: value } : entry,
      ),
    );
  };

  const handleReset = () => {
    setDraft(baseline.map((entry) => ({ ...entry })));
  };

  const handleSave = () => {
    if (typeof onSave !== 'function') return;
    if (!hasChanges) return;

    const changes = draft
      .map((entry) => {
        const original = baselineLookup.get(entry.date) || {};
        const changed =
          original.is_available !== entry.is_available ||
          (original.notes || '') !== (entry.notes || '');
        if (!changed) {
          return null;
        }
        if (entry.is_available === null) {
          return null;
        }
        return {
          date: entry.date,
          is_available: entry.is_available,
          notes: entry.notes || '',
        };
      })
      .filter(Boolean);

    if (!changes.length) return;
    onSave(changes);
  };

  const heading = weekStart
    ? `Availability for week of ${new Date(weekStart).toLocaleDateString()}`
    : 'Availability';

  return (
    <div className="flex h-full min-h-0 flex-col rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] shadow-sm transition">
      <div className="px-6 pb-6 pt-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--app-text)]">My availability</h3>
            <p className="text-xs text-[var(--app-muted)]">{heading}</p>
          </div>
        </div>
      </div>

      {/* scrollable content area */}
      {isLoading ? (
        <div className="px-6 mt-6 flex-1 min-h-0 overflow-y-auto space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="h-16 animate-pulse rounded-2xl bg-[color-mix(in_srgb,var(--app-surface)_92%,_var(--app-bg)_8%)]"
            />
          ))}
        </div>
      ) : (
        <div className="px-6 mt-6 flex-1 min-h-0 overflow-y-auto space-y-4">
          {draft.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[rgba(15,23,42,0.06)] bg-[color-mix(in_srgb,var(--app-surface)_92%,_var(--app-bg)_8%)] p-4 text-sm text-[var(--app-muted)]">
              No availability preferences recorded for this week yet.
            </div>
          ) : null}
          {draft.map((entry) => {
            const status = entry.is_available;
            return (
              <div
                key={entry.date}
                className="rounded-2xl border border-[rgba(15,23,42,0.08)] p-4 transition bg-[var(--app-surface)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[var(--app-text)]">
                      {formatDayLabel(entry.date)}
                    </div>
                    <div className="text-xs text-[var(--app-muted)]">
                      Choose whether you're available for shifts on this day.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggle(entry.date, true)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        status === true
                          ? 'bg-[color-mix(in_srgb,var(--app-success)_12%,_var(--app-surface)_88%)] text-[var(--app-success)]'
                          : 'border border-[rgba(15,23,42,0.08)] text-[var(--app-text)] hover:border-[color-mix(in_srgb,var(--app-success)_30%,_rgba(0,0,0,0))] hover:text-[var(--app-success)]'
                      }`}
                    >
                      Available
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(entry.date, false)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        status === false
                          ? 'bg-[color-mix(in_srgb,var(--app-warning)_12%,_var(--app-surface)_88%)] text-[var(--app-warning)]'
                          : 'border border-[rgba(15,23,42,0.08)] text-[var(--app-text)] hover:border-[color-mix(in_srgb,var(--app-warning)_30%,_rgba(0,0,0,0))] hover:text-[var(--app-warning)]'
                      }`}
                    >
                      Unavailable
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                    Notes
                    <textarea
                      value={entry.notes}
                      onChange={(event) => handleNoteChange(entry.date, event.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-[rgba(15,23,42,0.12)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-info)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-surface)]"
                      placeholder="Optional context for the manager"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-6 border-t border-[rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={handleReset}
              disabled={!hasChanges || isSaving || isLoading}
              className="rounded-full border border-[rgba(15,23,42,0.12)] px-4 py-2 text-sm font-medium text-[var(--app-text)] transition hover:bg-[color-mix(in_srgb,var(--app-surface)_88%,_var(--app-bg)_12%)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || isSaving || isLoading || typeof onSave !== 'function'}
              className="rounded-lg bg-[var(--app-primary)] px-4 py-2 text-sm font-semibold text-[var(--app-primary-contrast)] shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save availability'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
