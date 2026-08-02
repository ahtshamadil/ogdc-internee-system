import { useState } from 'react';
import { SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import { useFilters, EMPTY_FILTERS } from '../context/FilterContext.jsx';
import { useLookups } from '../context/LookupContext.jsx';
import { Button, Select, Input, Field } from './ui/index.jsx';
import { formatDate } from '../lib/format.js';

const STATUSES = ['Active', 'Completed', 'Upcoming', 'Extended', 'Terminated'];

/**
 * The single filter surface. It writes to FilterContext, which the dashboard,
 * the intern list and reports all read -- so a filter set once follows the
 * user across pages instead of silently resetting.
 */
export default function FilterBar({ showSearch = false }) {
  const { filters, setFilter, reset, clearFilter, activeCount } = useFilters();
  const { universities, degrees, departments, cities } = useLookups();
  const [open, setOpen] = useState(false);

  const LABELS = {
    university_id: (v) => universities.find((u) => String(u.id) === String(v))?.name,
    degree_id: (v) => degrees.find((d) => String(d.id) === String(v))?.name,
    department_id: (v) => departments.find((d) => String(d.id) === String(v))?.name,
    city_id: (v) => cities.find((c) => String(c.id) === String(v))?.name,
    status: (v) => `Status: ${v}`,
    gender: (v) => `Gender: ${v}`,
    from: (v) => `From ${formatDate(v)}`,
    to: (v) => `To ${formatDate(v)}`,
    certificate: (v) => `Certificate: ${v}`,
    search: (v) => `“${v}”`,
  };

  const chips = Object.entries(filters)
    .filter(([key, value]) => value !== '' && value !== EMPTY_FILTERS[key])
    .map(([key, value]) => ({ key, label: LABELS[key]?.(value) ?? value }));

  return (
    <div className="mb-4 no-print">
      <div className="flex items-center gap-2 flex-wrap">
        {showSearch && (
          <Input
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            placeholder="Search name, code, CNIC…"
            style={{ maxWidth: 280 }}
          />
        )}

        <Button
          icon={SlidersHorizontal}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          style={activeCount ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined}
        >
          Filters
          {activeCount > 0 && (
            <span
              className="tnum"
              style={{
                background: 'var(--primary)',
                color: 'var(--primary-ink)',
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 700,
                padding: '0 5px',
                minWidth: 16,
                textAlign: 'center',
              }}
            >
              {activeCount}
            </span>
          )}
        </Button>

        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => clearFilter(chip.key)}
            className="pill pill-neutral"
            style={{ cursor: 'pointer', paddingRight: 5 }}
            title="Remove this filter"
          >
            <span className="truncate-1" style={{ maxWidth: 190 }}>
              {chip.label}
            </span>
            <X size={11} style={{ opacity: 0.6 }} />
          </button>
        ))}

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={reset}>
            Clear all
          </Button>
        )}
      </div>

      {open && (
        <div className="card card-pad mt-2.5 animate-in">
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            <Field label="University">
              <Select
                value={filters.university_id}
                onChange={(e) => setFilter('university_id', e.target.value)}
                placeholder="All universities"
                options={universities.map((u) => ({ value: u.id, label: u.short_name || u.name }))}
              />
            </Field>

            <Field label="Degree">
              <Select
                value={filters.degree_id}
                onChange={(e) => setFilter('degree_id', e.target.value)}
                placeholder="All degrees"
                options={degrees.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Field>

            <Field label="Department">
              <Select
                value={filters.department_id}
                onChange={(e) => setFilter('department_id', e.target.value)}
                placeholder="All departments"
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Field>

            <Field label="Home city">
              <Select
                value={filters.city_id}
                onChange={(e) => setFilter('city_id', e.target.value)}
                placeholder="All cities"
                options={cities.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>

            <Field label="Status">
              <Select
                value={filters.status}
                onChange={(e) => setFilter('status', e.target.value)}
                placeholder="Any status"
                options={STATUSES.map((s) => ({ value: s, label: s }))}
              />
            </Field>

            <Field label="Gender">
              <Select
                value={filters.gender}
                onChange={(e) => setFilter('gender', e.target.value)}
                placeholder="Any"
                options={[
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' },
                  { value: 'Other', label: 'Other' },
                ]}
              />
            </Field>

            <Field label="Certificate">
              <Select
                value={filters.certificate}
                onChange={(e) => setFilter('certificate', e.target.value)}
                placeholder="Any"
                options={[
                  { value: 'issued', label: 'Issued' },
                  { value: 'pending', label: 'Not issued' },
                ]}
              />
            </Field>

            <Field label="Joined from" hint="Filters on the joining date">
              <Input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
            </Field>

            <Field label="Joined up to">
              <Input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}
