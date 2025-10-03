import { useState, useCallback } from "react";
import convert, { Unit } from "convert-units";
import {
  getIngredientDensity,
  MassUnit,
  VolumeUnit,
  MeasurementSystem,
  UnitValidation,
} from "@/services/ingredientDensity";

export interface UnitConverterResult {
  value: number;
  unit: string;
  confidence: number;
  method: "direct" | "density" | "fallback";
  warning?: string;
}

/**
 * Hook for unit conversions in UI components
 * Provides functions for converting between units and getting supported units
 */
export function useUnitConverter() {
  const [error, setError] = useState<string | null>(null);

  const convertUnit = useCallback(
    (
      value: number,
      fromUnit: string,
      toUnit: string,
      ingredientName?: string
    ): UnitConverterResult => {
      setError(null);

      try {
        // Try direct conversion first (weight to weight, volume to volume)
        const result = convert(value)
          .from(fromUnit as Unit)
          .to(toUnit as Unit);

        return {
          value: result,
          unit: toUnit,
          confidence: 1.0,
          method: "direct",
        };
      } catch {
        // If direct conversion fails, try density-based (volume to weight)
        if (ingredientName) {
          const density = getIngredientDensity(ingredientName);
          if (density) {
            // Custom logic for volume-to-weight conversion
            try {
              // Convert volume to cups first
              let cups: number;
              try {
                cups = convert(value)
                  .from(fromUnit as Unit)
                  .to("cup");
              } catch {
                setError(`Cannot convert ${fromUnit} to ${toUnit}`);
                return {
                  value: value,
                  unit: fromUnit,
                  confidence: 0,
                  method: "fallback",
                  warning: `Cannot convert ${fromUnit} to ${toUnit}`,
                };
              }

              // Calculate weight in grams
              const grams = cups * density;

              // Convert grams to target unit
              try {
                const result = convert(grams)
                  .from("g")
                  .to(toUnit as Unit);

                return {
                  value: result,
                  unit: toUnit,
                  confidence: 0.95,
                  method: "density",
                };
              } catch {
                setError(`Cannot convert grams to ${toUnit}`);
                return {
                  value: grams,
                  unit: "g",
                  confidence: 0.95,
                  method: "density",
                  warning: `Cannot convert grams to ${toUnit}`,
                };
              }
            } catch {
              setError(
                `Cannot perform density-based conversion for ${ingredientName}`
              );
              return {
                value: value,
                unit: fromUnit,
                confidence: 0,
                method: "fallback",
                warning: `Cannot perform density-based conversion for ${ingredientName}`,
              };
            }
          }
        }

        setError(`Cannot convert ${fromUnit} to ${toUnit}`);
        return {
          value: value,
          unit: fromUnit,
          confidence: 0,
          method: "fallback",
          warning: `Cannot convert ${fromUnit} to ${toUnit}`,
        };
      }
    },
    []
  );

  const getSupportedUnits = useCallback((measure: "mass" | "volume") => {
    if (measure === "mass") {
      return convert()
        .possibilities()
        .filter((u) => convert().describe(u).measure === "mass");
    }
    return convert()
      .possibilities()
      .filter((u) => convert().describe(u).measure === "volume");
  }, []);

  const validateUnit = useCallback((unit: string): UnitValidation => {
    try {
      const unitInfo = convert().describe(unit as Unit);
      return {
        isValid: true,
        measure: unitInfo.measure as "mass" | "volume",
      };
    } catch {
      return {
        isValid: false,
      };
    }
  }, []);

  const getUnitDisplayName = useCallback(
    (unit: string, plural: boolean = false) => {
      try {
        const info = convert().describe(unit as Unit);
        return plural ? info.plural : info.singular;
      } catch {
        return unit;
      }
    },
    []
  );

  return {
    convertUnit,
    getSupportedUnits,
    validateUnit,
    getUnitDisplayName,
    error,
  };
}
