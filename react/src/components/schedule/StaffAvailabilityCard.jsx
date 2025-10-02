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
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">My availability</h3>
          <p className="text-xs text-slate-500">{heading}</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          disabled={!hasChanges || isSaving || isLoading}
          className="text-xs font-semibold text-slate-400 hover:text-slate-600 disabled:opacity-50"
        >
          Reset
        </button>
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="h-16 animate-pulse rounded-2xl bg-slate-100"
            />
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {draft.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              No availability preferences recorded for this week yet.
            </div>
          ) : null}
          {draft.map((entry) => {
            const status = entry.is_available;
            return (
              <div
                key={entry.date}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {formatDayLabel(entry.date)}
                    </div>
                    <div className="text-xs text-slate-400">
                      Choose whether you're available for shifts on this day.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggle(entry.date, true)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        status === true
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'border border-slate-200 text-slate-500 hover:border-emerald-200 hover:text-emerald-600'
                      }`}
                    >
                      Available
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(entry.date, false)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        status === false
                          ? 'bg-rose-100 text-rose-600'
                          : 'border border-slate-200 text-slate-500 hover:border-rose-200 hover:text-rose-600'
                      }`}
                    >
                      Unavailable
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Notes
                    <textarea
                      value={entry.notes}
                      onChange={(event) => handleNoteChange(entry.date, event.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none"
                      placeholder="Optional context for the manager"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-center justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || isSaving || isLoading || typeof onSave !== 'function'}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : 'Save availability'}
        </button>
      </div>
    </div>
  );
}
