"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { daysInMonth, monthName, type Split } from "@/lib/periods";
import { formatMoney, formatPercent, formatRatio } from "@/lib/money";
import {
  distinctMonths,
  distinctYears,
  findRow,
  METRIC_KEYS,
  METRIC_LABELS,
  METRIC_FORMAT,
  type MetricKey,
  type PeriodRow,
} from "@/lib/view";
import type { BudgetTarget } from "@/lib/budget";
import type { Forecast } from "@/lib/forecast";
import { MoMLineChart, YoyBarChart } from "./Charts";
import { NoteCell } from "./NoteCell";
import { AdminActions } from "./AdminActions";
import { BudgetOverview } from "./BudgetOverview";
import { LedgerView } from "./LedgerView";

interface SourceStatus {
  shopify: boolean;
  google: boolean;
  meta: boolean;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
const KPI_KEYS: MetricKey[] = ["revenueInclVat", "db", "spend", "contributionMargin", "dbPct", "mer"];
const VAT = 1.25;

function fmtMetric(key: MetricKey, v: number): string {
  const f = METRIC_FORMAT[key];
  if (f === "percent") return formatPercent(v);
  if (f === "ratio") return formatRatio(v) + "×";
  return formatMoney(v);
}
function periodDate(year: number, month: number, split: Split): string {
  const day = split === "half" ? 15 : daysInMonth(year, month);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}
function yoyDelta(key: MetricKey, cur: number, prev: number | undefined): string | null {
  if (prev === undefined || prev === 0) return null;
  if (METRIC_FORMAT[key] === "percent") {
    const pp = (cur - prev) * 100;
    return `${pp >= 0 ? "+" : ""}${pp.toFixed(1)} pp`;
  }
  const pct = ((cur - prev) / prev) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)} %`;
}

function Sparkline({ series }: { series: number[] }) {
  if (series.length < 2) return null;
  const w = 150, h = 30, p = 2;
  const min = Math.min(...series), max = Math.max(...series), rng = max - min || 1;
  const x = (i: number) => p + (i * (w - 2 * p)) / (series.length - 1);
  const y = (v: number) => h - p - ((v - min) / rng) * (h - 2 * p);
  const d = series.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${d} L${x(series.length - 1).toFixed(1)} ${h} L${x(0).toFixed(1)} ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="30" preserveAspectRatio="none" aria-hidden="true" style={{ display: "block" }}>
      <path d={area} fill="var(--accent-tint)" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      <circle cx={x(series.length - 1)} cy={y(series[series.length - 1])} r="2.4" fill="var(--accent)" />
    </svg>
  );
}

const BAR_CAP = 1.4;
const barX = (v: number, b: number) => (Math.min(v / b, BAR_CAP) / BAR_CAP) * 100;
const budgetMarker = (1 / BAR_CAP) * 100;
const paceClass = (pct: number) => (pct >= 1 ? "ok" : pct >= 0.85 ? "warn" : "bad");

function Variance({ v, b }: { v: number; b: number }) {
  const p = ((v - b) / b) * 100;
  return <span className={`bvar ${p >= 0 ? "pos" : "neg"}`}>{`${p >= 0 ? "+" : ""}${p.toFixed(1)} %`}</span>;
}

function SolidRow({ label, actual, budget, basis }: { label: string; actual: number; budget: number; basis: string }) {
  return (
    <div className="brow">
      <div className="blabel">{label}<div className="tag" style={{ marginTop: 3 }}>{basis}</div></div>
      <div className="bar">
        <div className={`fill ${paceClass(actual / budget)}`} style={{ width: `${barX(actual, budget).toFixed(1)}%` }} />
        <div className="marker" style={{ left: `${budgetMarker.toFixed(1)}%` }} />
      </div>
      <div className="bvals"><span className="big">{formatMoney(actual)}</span> <span className="muted">/ {formatMoney(budget)}</span> · <Variance v={actual} b={budget} /></div>
    </div>
  );
}

function RangeRow({ label, mid, lo, hi, budget, basis }: { label: string; mid: number; lo: number; hi: number; budget: number; basis: string }) {
  const l = barX(lo, budget), h = barX(hi, budget), m = barX(mid, budget);
  return (
    <div className="brow">
      <div className="blabel">{label}<div className="tag" style={{ marginTop: 3 }}>{basis}</div></div>
      <div className="bar">
        <div className="band" style={{ left: `${l.toFixed(1)}%`, width: `${Math.max(h - l, 1).toFixed(1)}%` }} />
        <div className={`midtick ${paceClass(mid / budget)}`} style={{ left: `${m.toFixed(1)}%` }} />
        <div className="marker" style={{ left: `${budgetMarker.toFixed(1)}%` }} />
      </div>
      <div className="bvals">
        <span className="big">{formatMoney(mid)}</span> <span className="muted">/ {formatMoney(budget)}</span> · <Variance v={mid} b={budget} />
        <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>interval {formatMoney(lo)}–{formatMoney(hi)}</div>
      </div>
    </div>
  );
}

export function Dashboard({
  rows,
  status,
  budget,
}: {
  rows: PeriodRow[];
  status: SourceStatus;
  budget: Record<string, BudgetTarget>;
}) {
  const months = distinctMonths(rows);
  const years = distinctYears(rows);
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();

  const [month, setMonth] = useState<number>(months.includes(curMonth) ? curMonth : months[months.length - 1] ?? curMonth);
  const [metric, setMetric] = useState<MetricKey>("revenueInclVat");
  const [view, setView] = useState<"months" | "budget" | "ledger">("months");
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [forecastLoading, setForecastLoading] = useState(true);

  const loadForecast = useCallback(() => {
    // Initial load shows the "beregner" state (forecastLoading starts true); a
    // manual refresh keeps the current forecast visible until the new one lands.
    fetch("/api/forecast", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setForecast(d.forecast ?? null))
      .catch(() => setForecast(null))
      .finally(() => setForecastLoading(false));
  }, []);

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  const monthRows = useMemo(
    () => rows.filter((r) => r.month === month).sort((a, b) => a.year - b.year || (a.split === "half" ? -1 : 1)),
    [rows, month],
  );

  const fullYears = useMemo(
    () => rows.filter((r) => r.month === month && r.split === "full").map((r) => r.year).sort((a, b) => a - b),
    [rows, month],
  );
  const latestYear = fullYears[fullYears.length - 1];
  const kpiCur = latestYear ? findRow(rows, latestYear, month, "full") : undefined;
  const kpiPrev = latestYear ? findRow(rows, latestYear - 1, month, "full") : undefined;

  const fullsSorted = useMemo(
    () => rows.filter((r) => r.split === "full").sort((a, b) => a.year - b.year || a.month - b.month),
    [rows],
  );
  function sparkSeries(key: MetricKey): number[] {
    if (!latestYear) return [];
    const idx = fullsSorted.findIndex((r) => r.year === latestYear && r.month === month);
    if (idx < 0) return [];
    return fullsSorted.slice(Math.max(0, idx - 11), idx + 1).map((r) => r.metrics[key]);
  }

  const yoyData = useMemo(
    () =>
      years
        .map((y) => findRow(rows, y, month, "full"))
        .filter((r): r is PeriodRow => Boolean(r))
        .map((r) => ({ label: String(r.year), value: r.metrics[metric] })),
    [rows, years, month, metric],
  );
  const momData = useMemo(
    () =>
      months.map((m) => {
        const point: { month: string; [year: string]: string | number } = { month: MONTHS_SHORT[m - 1] };
        for (const y of years) {
          const r = findRow(rows, y, m, "full");
          if (r) point[String(y)] = r.metrics[metric];
        }
        return point;
      }),
    [rows, months, years, metric],
  );

  const allLive = status.shopify && status.google && status.meta;
  const missing = [!status.shopify && "Shopify", !status.google && "Google Ads", !status.meta && "Meta"].filter(Boolean);

  // Budget year for the selected month: latest year that has a budget for it.
  const budgetYear = useMemo(() => {
    const ys = Object.keys(budget).filter((k) => Number(k.split("-")[1]) === month).map((k) => Number(k.split("-")[0]));
    return ys.length ? Math.max(...ys) : month >= 10 ? curYear - 1 : curYear;
  }, [budget, month, curYear]);
  const bt = budget[`${budgetYear}-${String(month).padStart(2, "0")}`];
  const isCurrentMonth = budgetYear === curYear && month === curMonth;
  const budgetRow = kpiCur && kpiCur.year === budgetYear ? kpiCur : findRow(rows, budgetYear, month, "full");

  return (
    <div className="space-y-8">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--hair-strong)] bg-white p-10 text-center">
          <h2 className="text-lg font-semibold">Ingen data endnu</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Kør et pull eller en backfill for at hente data.</p>
          <div className="mt-4 flex justify-center"><AdminActions onDone={loadForecast} /></div>
        </div>
      ) : (
        <>
          <div className="metricbar" style={{ marginTop: 0, marginBottom: 8 }}>
            <button className="chip" aria-pressed={view === "months"} onClick={() => setView("months")}>Måneder</button>
            <button className="chip" aria-pressed={view === "budget"} onClick={() => setView("budget")}>Budget (år)</button>
            <button className="chip" aria-pressed={view === "ledger"} onClick={() => setView("ledger")}>Saldobalance</button>
          </div>

          {view === "budget" && <BudgetOverview rows={rows} budget={budget} forecast={forecast} />}
          {view === "ledger" && <LedgerView />}

          {view === "months" && (
          <>
          {/* Month tabs */}
          <nav className="tabs" role="tablist" aria-label="Måned">
            {months.map((m) => (
              <button key={m} role="tab" aria-selected={m === month} className="tab" onClick={() => setMonth(m)}>
                {monthName(m)}
              </button>
            ))}
          </nav>

          {/* KPI cards */}
          {kpiCur && (
            <>
              <div className="kpis">
                {KPI_KEYS.map((key) => {
                  const delta = yoyDelta(key, kpiCur.metrics[key], kpiPrev?.metrics[key]);
                  const cls = delta ? (delta.startsWith("+") ? "up" : "down") : "flat";
                  return (
                    <div key={key} className="kpi">
                      <div className="lbl">{METRIC_LABELS[key]}</div>
                      <div className="val">{fmtMetric(key, kpiCur.metrics[key])}</div>
                      <Sparkline series={sparkSeries(key)} />
                      <div className="foot">
                        {delta ? <span className={`delta ${cls}`}>{cls === "up" ? "▲" : "▼"} {delta}</span> : <span className="delta flat">–</span>}
                        <span className="tag">vs {latestYear! - 1}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="vatlegend">Omsætning &amp; MER vises <b>inkl. moms</b> · DB, DB %, Spend &amp; MPR er <b>ekskl. moms</b></p>
            </>
          )}

          {/* Budget & forecast */}
          {bt && (
            <section className="budget">
              {isCurrentMonth ? (
                forecastLoading ? (
                  <div className="budget-head"><h3>Budget · prognose <small>{monthName(month)} {budgetYear}</small></h3><span className="status pending">Beregner prognose…</span></div>
                ) : forecast && forecast.year === budgetYear && forecast.month === month ? (
                  (() => {
                    const omsMid = forecast.netSales.mid * VAT, omsLo = forecast.netSales.lo * VAT, omsHi = forecast.netSales.hi * VAT;
                    const budOms = bt.omsExVat * VAT;
                    const on = omsMid / budOms >= 1;
                    return (
                      <>
                        <div className="budget-head"><h3>Budget · prognose <small>{monthName(month)} {budgetYear}</small></h3><span className={`status ${on ? "on" : "off"}`}>{on ? "Prognose over budget" : "Prognose under budget"}</span></div>
                        <RangeRow label="Omsætning" mid={omsMid} lo={omsLo} hi={omsHi} budget={budOms} basis="inkl. moms" />
                        <RangeRow label="DB" mid={forecast.grossProfit.mid} lo={forecast.grossProfit.lo} hi={forecast.grossProfit.hi} budget={bt.dbExVat} basis="ekskl. moms" />
                        {forecast.contributionMargin && (
                          <RangeRow label="Contribution" mid={forecast.contributionMargin.mid} lo={forecast.contributionMargin.lo} hi={forecast.contributionMargin.hi} budget={bt.dbExVat - bt.marketingExVat} basis="ekskl. moms" />
                        )}
                        <div className="fcast-note">📈 <b>Prognose · dag {forecast.throughDay} af {forecast.daysInMonth}:</b> {formatMoney(forecast.mtdNet * VAT)} omsat hidtil. Resten af måneden er fremskrevet ud fra tidligere års {monthName(month).toLowerCase()} × jeres seneste vækst (+{Math.round(forecast.growth * 100)} % ÅoÅ). Midterskøn <b>{formatMoney(omsMid)}</b> · interval {formatMoney(omsLo)}–{formatMoney(omsHi)} · ~{Math.round((omsMid / budOms) * 100)} % af budget. Contribution = DB − annoncespend (Google+Meta); budget-CM trækker hele marketingbudgettet fra.</div>
                      </>
                    );
                  })()
                ) : (
                  <div className="budget-head"><h3>Budget <small>{monthName(month)} {budgetYear}</small></h3><span className="status pending">Prognose ikke tilgængelig</span></div>
                )
              ) : budgetRow ? (
                (() => {
                  const budOms = bt.omsExVat * VAT;
                  const on = budgetRow.metrics.revenueInclVat / budOms >= 1;
                  return (
                    <>
                      <div className="budget-head"><h3>Budget · faktisk <small>{monthName(month)} {budgetYear}</small></h3><span className={`status ${on ? "on" : "off"}`}>{on ? "På / over budget" : "Under budget"}</span></div>
                      <SolidRow label="Omsætning" actual={budgetRow.metrics.revenueInclVat} budget={budOms} basis="inkl. moms" />
                      <SolidRow label="DB" actual={budgetRow.metrics.db} budget={bt.dbExVat} basis="ekskl. moms" />
                      <SolidRow label="Contribution" actual={budgetRow.metrics.contributionMargin} budget={bt.dbExVat - bt.marketingExVat} basis="ekskl. moms" />
                      <p className="vatlegend" style={{ marginTop: 8 }}>Contribution = DB − annoncespend (Google+Meta); budget-CM trækker hele marketingbudgettet fra.</p>
                    </>
                  );
                })()
              ) : (
                <>
                  <div className="budget-head"><h3>Budget <small>{monthName(month)} {budgetYear} · endnu ingen data</small></h3><span className="status pending">Afventer</span></div>
                  <div className="brow"><div className="blabel">Omsætning<div className="tag" style={{ marginTop: 3 }}>inkl. moms</div></div><div /><div className="bvals muted">Budget {formatMoney(bt.omsExVat * VAT)}</div></div>
                  <div className="brow"><div className="blabel">DB<div className="tag" style={{ marginTop: 3 }}>ekskl. moms</div></div><div /><div className="bvals muted">Budget {formatMoney(bt.dbExVat)}</div></div>
                </>
              )}
            </section>
          )}

          {/* Metric selector + charts */}
          <div className="metricbar">
            <span className="mlbl">Nøgletal i grafer</span>
            {METRIC_KEYS.map((key) => (
              <button key={key} className="chip" aria-pressed={key === metric} onClick={() => setMetric(key)}>{METRIC_LABELS[key]}</button>
            ))}
          </div>

          <div className="charts">
            <div className="panel">
              <h3>{METRIC_LABELS[metric]} — år-til-år</h3>
              <p className="psub">Hel {monthName(month).toLowerCase()} på tværs af år</p>
              <YoyBarChart data={yoyData} format={METRIC_FORMAT[metric]} />
            </div>
            <div className="panel">
              <h3>{METRIC_LABELS[metric]} — hen over året</h3>
              <p className="psub">Hel måned, måned-for-måned</p>
              <MoMLineChart data={momData} years={years} format={METRIC_FORMAT[metric]} />
            </div>
          </div>

          {/* Detail table */}
          <div className="tablewrap">
            <div className="thead">
              <h3>{monthName(month)} — detaljer</h3>
              <span>Omsætning inkl. moms · DB/Spend ekskl. moms</span>
            </div>
            <div className="scroll">
              <table className="ll-table">
                <thead>
                  <tr>
                    <th>Periode</th><th>Split</th><th>Omsætning</th><th>DB</th><th>Spend</th>
                    <th>Contribution</th><th>DB&nbsp;%</th><th>MER</th><th>MPR</th><th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map((r, i) => (
                    <tr key={`${r.year}-${r.split}`} className={`${r.split === "full" ? "full " : ""}${r.split === "half" && i > 0 ? "yeargap" : ""}`}>
                      <td className="per">{periodDate(r.year, r.month, r.split)}</td>
                      <td className="splitcell">{r.split === "half" ? "Halv måned" : "Hel måned"}</td>
                      <td className={r.split === "full" ? "strong" : ""}>{formatMoney(r.metrics.revenueInclVat)}</td>
                      <td>{formatMoney(r.metrics.db)}</td>
                      <td>{formatMoney(r.metrics.spend)}</td>
                      <td>{formatMoney(r.metrics.contributionMargin)}</td>
                      <td>{formatPercent(r.metrics.dbPct)}</td>
                      <td>{formatRatio(r.metrics.mer)}</td>
                      <td>{formatRatio(r.metrics.mpr)}</td>
                      <td className="note"><NoteCell year={r.year} month={r.month} split={r.split} initial={r.note} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          </>
          )}

          {!allLive && (
            <p className="vatlegend">Viser mock-data for {missing.join(", ")} — tilføj API-nøgler for rigtige tal.</p>
          )}

          <div className="panel">
            <h3 style={{ marginBottom: 12 }}>Data-hentning</h3>
            <AdminActions onDone={loadForecast} />
          </div>
        </>
      )}
    </div>
  );
}
