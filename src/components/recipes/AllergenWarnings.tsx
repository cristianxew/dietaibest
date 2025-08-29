"use client";

import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, Info, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface AllergenData {
  allergenId: string;
  allergenName: string;
  category: string;
  severity: string;
  detectionType: string;
  confidence: number;
  sources: string[];
  containsAmount?: string;
  warnings?: string[];
}

interface AllergenWarningsProps {
  allergens: AllergenData[];
  riskLevel: string;
  recommendedLabels?: string[];
  className?: string;
  compact?: boolean;
}

export function AllergenWarnings({
  allergens,
  riskLevel,
  recommendedLabels = [],
  className,
  compact = false,
}: AllergenWarningsProps) {
  if (allergens.length === 0 && riskLevel === "none") {
    if (compact) return null;

    return (
      <Alert className={cn("border-green-200 bg-green-50", className)}>
        <ShieldCheck className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">
          No Allergens Detected
        </AlertTitle>
        <AlertDescription className="text-green-700">
          This recipe appears to be free from common allergens.
        </AlertDescription>
      </Alert>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "severe":
        return <ShieldAlert className="h-4 w-4 text-red-600" />;
      case "moderate":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "severe":
        return "destructive";
      case "moderate":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRiskLevelAlert = () => {
    switch (riskLevel.toLowerCase()) {
      case "high":
        return {
          variant: "destructive" as const,
          icon: <ShieldAlert className="h-4 w-4" />,
          title: "High Allergen Risk",
          description: "This recipe contains multiple severe allergens.",
        };
      case "moderate":
        return {
          variant: "default" as const,
          icon: <AlertTriangle className="h-4 w-4" />,
          title: "Moderate Allergen Risk",
          description:
            "This recipe contains allergens that may affect sensitive individuals.",
        };
      default:
        return {
          variant: "default" as const,
          icon: <Info className="h-4 w-4" />,
          title: "Low Allergen Risk",
          description: "Minor allergen presence detected.",
        };
    }
  };

  if (compact) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex flex-wrap gap-2">
          {allergens.map((allergen) => (
            <TooltipProvider key={allergen.allergenId}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant={getSeverityColor(allergen.severity)}
                    className="cursor-help"
                  >
                    <div className="flex items-center gap-1">
                      {getSeverityIcon(allergen.severity)}
                      <span>{allergen.allergenName}</span>
                    </div>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <div className="space-y-1">
                    <p className="font-semibold">{allergen.allergenName}</p>
                    <p className="text-xs">Severity: {allergen.severity}</p>
                    <p className="text-xs">
                      Found in: {allergen.sources.join(", ")}
                    </p>
                    {allergen.warnings && allergen.warnings.length > 0 && (
                      <p className="text-xs text-red-600">
                        {allergen.warnings[0]}
                      </p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>
    );
  }

  const alertInfo = getRiskLevelAlert();

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Allergen Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant={alertInfo.variant}>
          {alertInfo.icon}
          <AlertTitle>{alertInfo.title}</AlertTitle>
          <AlertDescription>{alertInfo.description}</AlertDescription>
        </Alert>

        <div className="space-y-3">
          {allergens.map((allergen) => (
            <div
              key={allergen.allergenId}
              className="flex items-start justify-between border rounded-lg p-3"
            >
              <div className="flex items-start gap-3">
                {getSeverityIcon(allergen.severity)}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{allergen.allergenName}</span>
                    <Badge
                      variant={getSeverityColor(allergen.severity)}
                      className="text-xs"
                    >
                      {allergen.severity}
                    </Badge>
                    {allergen.confidence < 80 && (
                      <span className="text-xs text-muted-foreground">
                        ({allergen.confidence}% confidence)
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Found in: {allergen.sources.join(", ")}
                  </p>
                  {allergen.containsAmount && (
                    <p className="text-sm text-muted-foreground">
                      Amount: {allergen.containsAmount}
                    </p>
                  )}
                  {allergen.warnings && allergen.warnings.length > 0 && (
                    <p className="text-sm text-red-600 font-medium">
                      ⚠️ {allergen.warnings[0]}
                    </p>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {allergen.detectionType}
              </Badge>
            </div>
          ))}
        </div>

        {recommendedLabels.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Recommended Labels</h4>
            <div className="flex flex-wrap gap-2">
              {recommendedLabels.map((label) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
