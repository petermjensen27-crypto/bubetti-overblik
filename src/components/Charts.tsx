"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatPercent, formatRatio } from "@/lib/money";

export type ValueFormat = "money" | "percent" | "ratio";

export function formatValue(value: number, format: ValueFormat): string {
  if (format === "percent") return formatPercent(value);
  if (format === "ratio") return formatRatio(value);
  return formatMoney(value, true);
}

// Year lines: palest → cognac accent for the most recent year.
const COLORS = ["#ddd3c4", "#c9bda9", "#6f6456", "#9a5a34", "#b23a2e", "#2f7d57"];

interface YoyDatum {
  label: string;
  value: number;
}

export function YoyBarChart({ data, format }: { data: YoyDatum[]; format: ValueFormat }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <YAxis
          tickFormatter={(v) => formatValue(Number(v), format)}
          tick={{ fontSize: 11 }}
          stroke="#94a3b8"
          width={72}
        />
        <Tooltip formatter={(v) => formatValue(Number(v), format)} />
        <Bar dataKey="value" fill="#9a5a34" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BudgetVsActualChart({
  data,
}: {
  data: Array<{ month: string; budget: number; actual: number | null }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <YAxis tickFormatter={(v) => formatValue(Number(v), "money")} tick={{ fontSize: 11 }} stroke="#94a3b8" width={72} />
        <Tooltip formatter={(v) => (v == null ? "–" : formatValue(Number(v), "money"))} />
        <Legend />
        <Bar dataKey="budget" name="Budget" fill="#d5cfc3" radius={[4, 4, 0, 0]} />
        <Bar dataKey="actual" name="Faktisk / prognose" fill="#9a5a34" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface MoMDatum {
  month: string;
  [year: string]: string | number;
}

export function MoMLineChart({
  data,
  years,
  format,
}: {
  data: MoMDatum[];
  years: number[];
  format: ValueFormat;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <YAxis
          tickFormatter={(v) => formatValue(Number(v), format)}
          tick={{ fontSize: 11 }}
          stroke="#94a3b8"
          width={72}
        />
        <Tooltip formatter={(v) => formatValue(Number(v), format)} />
        <Legend />
        {years.map((year, i) => (
          <Line
            key={year}
            type="monotone"
            dataKey={String(year)}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
