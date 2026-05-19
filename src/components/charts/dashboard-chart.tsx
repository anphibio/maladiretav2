"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type DashboardChartPoint = {
  day: string;
  enviados: number;
  falhas: number;
};

export function DashboardChart({ data }: { data: DashboardChartPoint[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="enviados" fill="#0f766e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="falhas" fill="#dc2626" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
