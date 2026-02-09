import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { ChartProps } from "@/types/dashboard";

// Hardcoded chart colors for SVG compatibility
const CHART_COLORS = {
  blue: "#3b82f6",
  amber: "#f59e0b",
  primary: "#4f46e5",
};

export function ProductChart({ data, onClick, selectedElement }: ChartProps) {
  return (
    <div className="h-full w-full" style={{ minHeight: 250 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} style={{ cursor: "pointer" }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#e2e8f0"
          />
          <XAxis
            dataKey="product"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#64748b" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#64748b" }}
            tickFormatter={(v) => `$${v / 1000}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              borderColor: "#e2e8f0",
              borderRadius: "0.5rem",
              color: "#0f172a",
            }}
            cursor={{ fill: "#f1f5f9", opacity: 0.5 }}
          />
          <Bar
            dataKey="premium"
            name="Premium"
            fill={CHART_COLORS.blue}
            radius={[4, 4, 0, 0]}
            onClick={(data) => onClick && onClick(data as any)}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  selectedElement === entry.product
                    ? CHART_COLORS.primary
                    : CHART_COLORS.blue
                }
                opacity={
                  selectedElement && selectedElement !== entry.product ? 0.3 : 1
                }
                className="transition-all duration-300"
              />
            ))}
          </Bar>
          <Bar
            dataKey="claims"
            name="Claims"
            fill={CHART_COLORS.amber}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
