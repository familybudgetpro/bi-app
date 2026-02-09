import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { ChartProps } from "@/types/dashboard";

// Hardcoded chart colors for SVG compatibility
const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899"];

export function PieChartWidget({ data, onClick, selectedElement }: ChartProps) {
  return (
    <div className="h-full w-full flex flex-col" style={{ minHeight: 250 }}>
      <div className="flex-1" style={{ minHeight: 150 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius="40%"
              outerRadius="70%"
              paddingAngle={3}
              dataKey="value"
              onClick={(d) => onClick && onClick({ name: d.name })}
              style={{ cursor: "pointer" }}
            >
              {data.map((entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={entry.color || COLORS[idx % COLORS.length]}
                  opacity={
                    selectedElement && selectedElement !== entry.name ? 0.3 : 1
                  }
                  stroke={
                    selectedElement === entry.name ? "#ffffff" : "transparent"
                  }
                  strokeWidth={2}
                  className="transition-all duration-300"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#e2e8f0",
                borderRadius: "0.5rem",
                color: "#0f172a",
              }}
              itemStyle={{ color: "#0f172a" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-1 px-2 mt-2">
        {data.map((t, idx) => (
          <div
            key={t.name}
            className="flex items-center gap-1.5 text-[10px] cursor-pointer hover:bg-gray-100 p-1 rounded transition-colors"
            onClick={() => onClick && onClick({ name: t.name })}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: t.color || COLORS[idx % COLORS.length],
              }}
            />
            <span className="text-gray-600 truncate">{t.name}</span>
            <span className="font-bold text-gray-900 ml-auto">{t.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
