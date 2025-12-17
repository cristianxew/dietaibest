"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Label } from "recharts";


interface MacroDisplayProps {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
}

export function MacroDisplay({
  calories,
  protein,
  carbs,
  fat,
  fiber: _fiber,
}: MacroDisplayProps) {
  // Filter out invalid data
  if (
    calories === undefined ||
    calories === null ||
    !protein ||
    !carbs ||
    !fat
  ) {
    return null;
  }

  // Calculate percentages based on standard caloric values: Protein 4, Carbs 4, Fat 9
  const totalCals = (protein || 0) * 4 + (carbs || 0) * 4 + (fat || 0) * 9;
  // Use provided calories if available, otherwise calculated
  const displayCals = calories || totalCals;

  const getPercent = (grams: number, calsPerGram: number) => {
    if (!displayCals) return 0;
    return Math.round(((grams * calsPerGram) / displayCals) * 100);
  };

  const stats = [
    {
      label: "Carbs",
      value: carbs,
      unit: "g",
      color: "#D4A017", // Gold
      percent: getPercent(carbs || 0, 4)
    },
    {
      label: "Total Fat",
      value: fat,
      unit: "g",
      color: "#F47B5C", // Coral
      percent: getPercent(fat || 0, 9)
    },
    {
      label: "Protein",
      value: protein,
      unit: "g",
      color: "#64748B", // Slate
      percent: getPercent(protein || 0, 4)
    },
  ];

  const chartData = stats.map(s => ({ name: s.label, value: s.value, color: s.color }));

  return (
    <div className="flex flex-row items-center gap-8 py-4 px-2">
      {/* Donut Chart */}
      <div className="h-[100px] w-[100px] relative shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={48}
              paddingAngle={4}
              cornerRadius={8}
              dataKey="value"
              stroke="none"
              isAnimationActive={true}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-lg font-bold font-display"
                        >
                          {displayCals.toFixed(0)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 12}
                          className="fill-muted-foreground text-[9px] uppercase tracking-wider"
                        >
                          cals
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Stats Columns */}
      <div className="flex items-center gap-8 md:gap-12">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-0.5">
            <span className="text-xl font-bold font-display text-foreground">
              {stat.value?.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">{stat.unit}</span>
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              {stat.label}
            </span>
            <span
              className="text-xs font-bold"
              style={{ color: stat.color }}
            >
              {stat.percent}% cals
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
