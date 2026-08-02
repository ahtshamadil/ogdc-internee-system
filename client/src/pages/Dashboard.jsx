import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserCheck, GraduationCap, Award, Building2, CalendarClock,
  AlertTriangle, ArrowRight, Scale, Download, Clock,
} from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { useFilters } from '../context/FilterContext.jsx';
import { qs, downloadFile } from '../api/client.js';
import { num, pct, formatDate, relativeDays, STATUS_CLASS } from '../lib/format.js';
import { Card, CardHeader, Button, Segmented, Pill, Skeleton, EmptyState, ErrorState, PageHeader, Avatar } from '../components/ui/index.jsx';
import { KpiCard, ComparisonCard } from '../components/KpiCard.jsx';
import FilterBar from '../components/FilterBar.jsx';
import { TrendChart, BreakdownBar, BreakdownDonut, YoYChart, StatusBar } from '../charts/index.jsx';
import CrossTab from '../components/CrossTab.jsx';

const GRANULARITIES = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'quarter', label: 'Quarterly' },
  { value: 'year', label: 'Yearly' },
];

export default function Dashboard() {
  const { params, likeForLike, setLikeForLike } = useFilters();
  const [granularity, setGranularity] = useState('month');

  const query = qs({ ...params, like_for_like: likeForLike });
  const summary = useApi(`/analytics/summary${query}`);
  const trend = useApi(`/analytics/trend${qs({ ...params, granularity })}`);
  const breakdowns = useApi(`/analytics/breakdowns${qs({ ...params, dimensions: 'university,degree,city,department,status,year' })}`);
  const attention = useApi(`/analytics/attention${qs(params)}`);

  const totals = summary.data?.totals;
  const b = breakdowns.data?.breakdowns;

  const attentionItems = useMemo(() => {
    const a = attention.data;
    if (!a) return [];
    return [
      { key: 'overdue', label: 'Past end date, still marked active', tone: 'terminated', icon: AlertTriangle, rows: a.overdue, hint: 'Update their status to Completed.' },
      { key: 'endingSoon', label: 'Ending within 14 days', tone: 'extended', icon: CalendarClock, rows: a.endingSoon, hint: 'Prepare completion certificates.' },
      { key: 'certificatePending', label: 'Completed, certificate not issued', tone: 'upcoming', icon: Award, rows: a.certificatePending, hint: 'Issue and record the certificate.' },
      { key: 'startingSoon', label: 'Joining within 14 days', tone: 'active', icon: Clock, rows: a.startingSoon, hint: 'Confirm department and supervisor.' },
    ].filter((group) => group.rows?.length);
  }, [attention.data]);

  if (summary.error) return <ErrorState error={summary.error} onRetry={summary.reload} />;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Internee intake, composition and pace across the organisation."
        actions={
          <Button
            icon={Download}
            onClick={() => downloadFile(`/reports/interns.csv${qs(params)}`, 'OGDC-Internees.csv')}
          >
            Export CSV
          </Button>
        }
      />

      <FilterBar />

      {/* ---- headline totals ---- */}
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(196px, 1fr))' }}>
        <KpiCard
          label="Total internees"
          value={totals?.total}
          caption="all time"
          icon={Users}
          accent="var(--series-1)"
          sparkline={summary.data?.sparkline}
          loading={summary.loading}
        />
        <KpiCard
          label="Currently active"
          value={totals?.active}
          caption={totals ? `${pct((totals.active / (totals.total || 1)) * 100, 0)} of all internees` : ''}
          icon={UserCheck}
          accent="var(--success)"
          loading={summary.loading}
        />
        <KpiCard
          label="Completed"
          value={totals?.completed}
          caption={totals ? `${num(totals.certificates_issued)} certificates issued` : ''}
          icon={GraduationCap}
          accent="var(--info)"
          loading={summary.loading}
        />
        <KpiCard
          label="Certificates pending"
          value={totals?.certificates_pending}
          caption="completed, not yet issued"
          icon={Award}
          accent="var(--warning)"
          loading={summary.loading}
        />
        <KpiCard
          label="Universities"
          value={totals?.universities}
          caption={totals ? `${num(totals.departments)} departments · ${num(totals.cities)} cities` : ''}
          icon={Building2}
          accent="var(--series-7)"
          loading={summary.loading}
        />
      </div>

      {/* ---- period comparison ---- */}
      <Card className="mb-3">
        <CardHeader
          title="Intake compared with the previous period"
          subtitle={
            likeForLike
              ? 'Previous period trimmed to the same number of elapsed days, so the comparison is like for like.'
              : 'Previous period shown in full — a part-finished month will always look smaller.'
          }
          actions={
            <Segmented
              value={likeForLike ? 'lfl' : 'full'}
              onChange={(v) => setLikeForLike(v === 'lfl')}
              options={[
                { value: 'lfl', label: 'Like for like', title: 'Compare the same number of days' },
                { value: 'full', label: 'Full period', title: 'Compare against the complete previous period' },
              ]}
            />
          }
        />
        <div className="p-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(176px, 1fr))' }}>
            {(summary.data?.periods ?? Array.from({ length: 5 })).map((period, i) => (
              <ComparisonCard key={period?.key ?? i} period={period} loading={summary.loading} />
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-3" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            <Scale size={12} />
            {likeForLike
              ? 'Weeks, 3-month and 6-month figures are rolling windows and are always like for like.'
              : 'Switch back to “like for like” for a fair month-to-date and year-to-date comparison.'}
          </div>
        </div>
      </Card>

      {/* ---- trend ---- */}
      <Card className="mb-3">
        <CardHeader
          title="Joining trend"
          subtitle="How many internees joined, and how many finished, over time."
          actions={<Segmented value={granularity} onChange={setGranularity} options={GRANULARITIES} />}
        />
        {trend.loading ? (
          <div className="p-5">
            <Skeleton h={252} />
          </div>
        ) : (
          <div className="pt-3">
            <TrendChart rows={trend.data?.rows ?? []} />
          </div>
        )}
      </Card>

      {/* ---- status composition ---- */}
      <Card className="mb-3">
        <CardHeader title="Where internees stand right now" subtitle="Every record by status." />
        <div className="card-pad">
          {breakdowns.loading ? <Skeleton h={40} /> : <StatusBar rows={b?.status?.rows ?? []} />}
        </div>
      </Card>

      {/* ---- breakdown grid ---- */}
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <Card>
          <CardHeader
            title="Top universities"
            subtitle={
              b?.university
                ? `Top ${b.university.rows.length} of ${b.university.groupCount} universities represented`
                : ''
            }
            actions={
              <Button
                size="sm"
                variant="ghost"
                icon={Download}
                onClick={() => downloadFile(`/reports/breakdown.csv${qs({ ...params, dimension: 'university', limit: 100 })}`, 'universities.csv')}
                title="Download as CSV"
              />
            }
          />
          <div className="p-4">
            {breakdowns.loading ? <Skeleton h={280} /> : <BreakdownBar rows={b?.university?.rows ?? []} colorIndex={0} />}
          </div>
        </Card>

        <Card>
          <CardHeader title="Degree programmes" subtitle="Share of intake by qualification." />
          <div className="pt-3">
            {breakdowns.loading ? (
              <div className="p-4"><Skeleton h={260} /></div>
            ) : (
              <BreakdownDonut
                rows={b?.degree?.rows ?? []}
                remainder={b?.degree?.remainder ?? 0}
                grandTotal={b?.degree?.total}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="OGDC departments" subtitle="Where internees are placed." />
          <div className="p-4">
            {breakdowns.loading ? <Skeleton h={280} /> : <BreakdownBar rows={b?.department?.rows ?? []} colorIndex={2} />}
          </div>
        </Card>

        <Card>
          <CardHeader title="Home cities" subtitle="Where internees come from." />
          <div className="p-4">
            {breakdowns.loading ? <Skeleton h={280} /> : <BreakdownBar rows={b?.city?.rows ?? []} colorIndex={3} />}
          </div>
        </Card>
      </div>

      {/* ---- year over year ---- */}
      <Card className="mb-3">
        <CardHeader title="Year on year" subtitle="Total internees joining in each year." />
        <div className="p-4">
          {breakdowns.loading ? <Skeleton h={250} /> : <YoYChart rows={[...(b?.year?.rows ?? [])].reverse()} />}
        </div>
      </Card>

      {/* ---- cross-tab ---- */}
      <CrossTab className="mb-3" />

      {/* ---- needs attention ---- */}
      <Card>
        <CardHeader
          title="Needs attention"
          subtitle="Records where the dates and the stored status disagree, or a follow-up is due."
        />
        {attention.loading ? (
          <div className="card-pad">
            <Skeleton h={120} />
          </div>
        ) : attentionItems.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="Nothing needs attention"
            description="Every internship record is consistent and up to date."
          />
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            {attentionItems.map((group, i) => (
              <div
                key={group.key}
                style={{
                  borderTop: i > 0 || true ? '1px solid var(--hairline)' : undefined,
                  borderRight: '1px solid var(--hairline)',
                  padding: '14px 18px',
                }}
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <group.icon size={14} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{group.label}</span>
                  <Pill tone={group.tone}>{group.rows.length}</Pill>
                </div>
                <div className="grid gap-1">
                  {group.rows.slice(0, 5).map((row) => (
                    <Link
                      key={row.id}
                      to={`/interns/${row.id}`}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md link-quiet"
                      style={{ fontSize: 13.5, transition: 'background 0.12s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Avatar
                          internId={row.id}
                          photoPath={row.photo_path}
                          name={row.full_name}
                          size={22}
                        />
                        <span className="truncate-1">{row.full_name}</span>
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                        {group.key === 'startingSoon'
                          ? relativeDays(row.joining_date)
                          : group.key === 'certificatePending'
                            ? formatDate(row.end_date)
                            : relativeDays(row.end_date)}
                      </span>
                    </Link>
                  ))}
                </div>
                {group.rows.length > 5 && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '5px 8px 0' }}>
                    and {group.rows.length - 5} more
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '7px 8px 0' }}>{group.hint}</div>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end p-3" style={{ borderTop: '1px solid var(--hairline)' }}>
          <Link to="/interns" className="btn btn-ghost btn-sm">
            View all internees <ArrowRight size={13} />
          </Link>
        </div>
      </Card>
    </>
  );
}
