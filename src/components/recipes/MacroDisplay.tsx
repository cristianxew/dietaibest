import { Progress } from "@/components/ui/progress";

interface MacroDisplayProps {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  sodium?: number | null;
}

interface MacroItemProps {
  label: string;
  value: number | null | undefined;
  unit: string;
  color: string;
  maxValue?: number;
}

function MacroItem({ label, value, unit, color, maxValue }: MacroItemProps) {
  if (value === null || value === undefined) return null;

  const percentage = maxValue ? (value / maxValue) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {value.toFixed(1)} {unit}
        </span>
      </div>
      {maxValue && (
        <Progress
          value={percentage}
          className="h-2"
          style={{
            // @ts-expect-error - CSS variable
            "--progress-color": color,
          }}
        />
      )}
    </div>
  );
}

export function MacroDisplay({
  calories,
  protein,
  carbs,
  fat,
  fiber,
  sugar,
  sodium,
}: MacroDisplayProps) {
  // Daily recommended values for reference (can be customized)
  const dailyValues = {
    calories: 2000,
    protein: 50,
    carbs: 300,
    fat: 65,
    fiber: 28,
    sugar: 50,
    sodium: 2300,
  };

  return (
    <div className="space-y-4">
      {/* Main macros */}
      {calories !== null && calories !== undefined && (
        <div className="pb-4 border-b">
          <div className="text-3xl font-bold">{calories.toFixed(0)}</div>
          <div className="text-sm text-muted-foreground">Calories</div>
        </div>
      )}

      <div className="space-y-3">
        <MacroItem
          label="Protein"
          value={protein}
          unit="g"
          color="#ef4444"
          maxValue={dailyValues.protein}
        />
        <MacroItem
          label="Carbohydrates"
          value={carbs}
          unit="g"
          color="#f59e0b"
          maxValue={dailyValues.carbs}
        />
        <MacroItem
          label="Fat"
          value={fat}
          unit="g"
          color="#3b82f6"
          maxValue={dailyValues.fat}
        />
      </div>

      {/* Additional nutrients */}
      {(fiber || sugar || sodium) && (
        <div className="pt-3 border-t space-y-3">
          <MacroItem
            label="Fiber"
            value={fiber}
            unit="g"
            color="#10b981"
            maxValue={dailyValues.fiber}
          />
          <MacroItem
            label="Sugar"
            value={sugar}
            unit="g"
            color="#8b5cf6"
            maxValue={dailyValues.sugar}
          />
          <MacroItem
            label="Sodium"
            value={sodium}
            unit="mg"
            color="#6b7280"
            maxValue={dailyValues.sodium}
          />
        </div>
      )}

      <div className="pt-3 text-xs text-muted-foreground">
        * Percent Daily Values are based on a 2,000 calorie diet
      </div>
    </div>
  );
}
