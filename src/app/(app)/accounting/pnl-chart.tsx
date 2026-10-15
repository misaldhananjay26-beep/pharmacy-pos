"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatINR } from "@/lib/utils";

export function PnlChart({ data }: { data: { day: string; revenuePaise: number }[] }) {
  const chartData = data.map((d) => ({
    day: d.day.slice(5), // MM-DD
    revenue: d.revenuePaise / 100,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={70}
            tickFormatter={(v) => formatINR(Number(v) * 100)}
          />
          <Tooltip
            formatter={(value) => formatINR(Number(value) * 100)}
            labelFormatter={(label) => `Day ${label}`}
            contentStyle={{ borderRadius: 8, border: "1px solid var(--border)" }}
          />
          <Bar dataKey="revenue" radius={[4, 4, 0, 0]} className="fill-primary" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
