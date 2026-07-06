"use client";

import { formatMoney } from "@/lib/money";
import { monthName } from "@/lib/periods";
import { findRow, type PeriodRow } from "@/lib/view";
import type { BudgetTarget } from "@/lib/budget";
import type { Forecast } from "@/lib/forecast";
import { BudgetVsActualChart } from "./Charts";

const VAT = 1.25;

/** Fiscal year label for a calendar month (FY runs Oct[FY-1] – Sep[FY]). */
function fyOf(year: number, month: number): number {
  return month >= 10 ? year + 1 : year;
}

type RowState = "past" | "current" | "future";

interface Props {
  rows: PeriodRow[];
  budget: Record<string, BudgetTarget>;
  forecast: Forecast | null;
}

function pctText(actual: number | null, budget: number | null): { txt: string; cls: string } {
  if (actual == null || !budget) return { txt: "–", cls: "" };
  const p = ((actual - budget) / budget) * 100;
  return { txt: `${p >= 0 ? "+" : ""}${p.toFixed(1)} %`, cls: p >= 0 ? "pos" : "neg" };
}

function SummaryCard({ label, actual, budget }: { label: string; actual: number; budget: number }) {
  const v = pctText(actual, budget);
  return (
    <div className="kpi">
      <div className="lbl">{label}</div>
      <div className="val">{formatMoney(actual)}</div>
      <div className="foot">
        <span className="muted" style={{ fontSize: 12, color: "var(--muted)" }}>af {formatMoney(budget)}</span>
        <span className={`bvar ${v.cls}`}>{v.txt}</span>
      </div>
    </div>
  );
}

export function BudgetOverview({ rows, budget, forecast }: Props) {
  const now = new Date();
  const fys = [...new Set(Object.keys(budget).map((k) => {
    const [y, m] = k.split("-").map(Number);
    return fyOf(y, m);
  }))].sort((a, b) => a - b);
  const curFY = fyOf(now.getFullYear(), now.getMonth() + 1);
  const fy = fys.includes(curFY) ? curFY : fys[fys.length - 1];

  const seq: Array<{ year: number; month: number }> = [];
  for (const m of [10, 11, 12]) seq.push({ year: fy - 1, month: m });
  for (let m = 1; m <= 9; m++) seq.push({ year: fy, month: m });

  const ord = (y: number, m: number) => y * 12 + m;
  const curOrd = ord(now.getFullYear(), now.getMonth() + 1);

  const data = seq.map(({ year, month }) => {
    const bt = budget[`${year}-${String(month).padStart(2, "0")}`];
    const o = ord(year, month);
    const state: RowState = o < curOrd ? "past" : o === curOrd ? "current" : "future";
    let omsActual: number | null = null;
    let dbActual: number | null = null;
    let cmActual: number | null = null;
    if (state === "current" && forecast && forecast.year === year && forecast.month === month) {
      omsActual = forecast.netSales.mid * VAT;
      dbActual = forecast.grossProfit.mid;
      cmActual = forecast.contributionMargin ? forecast.contributionMargin.mid : null;
    } else if (state !== "future") {
      const r = findRow(rows, year, month, "full");
      if (r) {
        omsActual = r.metrics.revenueInclVat;
        dbActual = r.metrics.db;
        cmActual = r.metrics.contributionMargin;
      }
    }
    return {
      year, month, state,
      budOms: bt ? bt.omsExVat * VAT : null,
      budDB: bt ? bt.dbExVat : null,
      budCM: bt ? bt.dbExVat - bt.marketingExVat : null,
      omsActual, dbActual, cmActual,
    };
  });

  const sum = (f: (r: (typeof data)[number]) => number | null) =>
    data.reduce((s, r) => { const v = f(r); return v == null ? s : s + v; }, 0);

  const budOmsYear = sum((r) => r.budOms);
  const budDBYear = sum((r) => r.budDB);
  const budCMYear = sum((r) => r.budCM);
  const projOms = sum((r) => (r.state === "future" ? r.budOms : r.omsActual));
  const projDB = sum((r) => (r.state === "future" ? r.budDB : r.dbActual));
  const projCM = sum((r) => (r.state === "future" ? r.budCM : r.cmActual));
  const ytdBudOms = sum((r) => (r.state === "future" ? null : r.budOms));
  const ytdActOms = sum((r) => (r.state === "future" ? null : r.omsActual));

  const chartData = data.map((r) => ({
    month: monthName(r.month).slice(0, 3),
    budget: Math.round(r.budOms ?? 0),
    actual: r.omsActual == null ? null : Math.round(r.omsActual),
  }));

  const stateLabel: Record<RowState, string> = { past: "Faktisk", current: "Prognose", future: "Budget" };

  return (
    <div className="space-y-6">
      <div className="context">
        <h2>Budget — regnskabsår {fy}</h2>
        <span className="note-chip">okt {fy - 1} – sep {fy}</span>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <SummaryCard label="Omsætning — prognose år" actual={projOms} budget={budOmsYear} />
        <SummaryCard label="DB — prognose år" actual={projDB} budget={budDBYear} />
        <SummaryCard label="Contribution — prognose år" actual={projCM} budget={budCMYear} />
        <SummaryCard label="Omsætning — år til dato" actual={ytdActOms} budget={ytdBudOms} />
      </div>
      <p className="vatlegend">Omsætning <b>inkl. moms</b> · DB &amp; Contribution <b>ekskl. moms</b> · Contribution = DB − annoncespend (budget-CM = DB − marketing) · igangværende måned er prognose</p>

      <div className="panel">
        <h3>Omsætning vs budget — hver måned</h3>
        <p className="psub">Budget mod faktisk (prognose for igangværende måned), inkl. moms</p>
        <BudgetVsActualChart data={chartData} />
      </div>

      <div className="tablewrap">
        <div className="thead">
          <h3>Måned for måned</h3>
          <span>Omsætning inkl. moms · DB ekskl. moms</span>
        </div>
        <div className="scroll">
          <table className="ll-table">
            <thead>
              <tr>
                <th>Måned</th><th>Type</th>
                <th>Budget oms.</th><th>Faktisk oms.</th><th>Δ</th>
                <th>Budget DB</th><th>Faktisk DB</th><th>Δ</th>
                <th>Budget CM</th><th>Faktisk CM</th><th>Δ</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => {
                const vo = pctText(r.omsActual, r.budOms);
                const vd = pctText(r.dbActual, r.budDB);
                const vc = pctText(r.cmActual, r.budCM);
                return (
                  <tr key={`${r.year}-${r.month}`} className={r.state === "current" ? "full" : ""}>
                    <td className="per">{monthName(r.month)} {r.year}</td>
                    <td className="splitcell">{stateLabel[r.state]}</td>
                    <td>{r.budOms == null ? "–" : formatMoney(r.budOms)}</td>
                    <td className="strong">{r.omsActual == null ? "–" : formatMoney(r.omsActual)}</td>
                    <td><span className={`bvar ${vo.cls}`}>{vo.txt}</span></td>
                    <td>{r.budDB == null ? "–" : formatMoney(r.budDB)}</td>
                    <td>{r.dbActual == null ? "–" : formatMoney(r.dbActual)}</td>
                    <td><span className={`bvar ${vd.cls}`}>{vd.txt}</span></td>
                    <td>{r.budCM == null ? "–" : formatMoney(r.budCM)}</td>
                    <td>{r.cmActual == null ? "–" : formatMoney(r.cmActual)}</td>
                    <td><span className={`bvar ${vc.cls}`}>{vc.txt}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
