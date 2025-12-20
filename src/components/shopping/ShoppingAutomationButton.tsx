"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Bot, Sparkles, Play, Loader2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { cn } from "@/lib/utils";
import { useShoppingAutomation } from "@/hooks/use-shopping-automation";
import { ShoppingProgressModal } from "./ShoppingProgressModal";
import { getShoppingPreferences } from "@/actions/shopping-automation";
import type { ShoppingListIngredient } from "@/types/shopping-list";
import type { SupportedStore } from "@/types/shopping-preferences";

// ============================================================================
// Types
// ============================================================================

interface ShoppingAutomationButtonProps {
  ingredients: ShoppingListIngredient[];
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function ShoppingAutomationButton({
  ingredients,
  disabled = false,
  className,
}: ShoppingAutomationButtonProps) {
  const t = useTranslations("shopping.automation");
  const [showModal, setShowModal] = useState(false);
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<SupportedStore | null>(null);
  const [preferences, setPreferences] = useState<{
    preferOrganic: boolean;
    preferStoreBrand: boolean;
    allowSubstitutions: boolean;
    maxPricePerItem: number | null;
  } | null>(null);

  const {
    state,
    startAutomation,
    cancelAutomation,
    retryFailedItems,
    reset,
    isLoading,
  } = useShoppingAutomation();

  // Load preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      setIsLoadingPrefs(true);
      setPreferencesError(null);
      try {
        const result = await getShoppingPreferences();
        if (result.data) {
          setSelectedStore(result.data.selectedStore as SupportedStore | null);
          setPreferences({
            preferOrganic: result.data.preferOrganic,
            preferStoreBrand: result.data.preferStoreBrand,
            allowSubstitutions: result.data.allowSubstitutions,
            maxPricePerItem: result.data.maxPricePerItem,
          });
        }
      } catch (error) {
        console.error("Failed to load preferences:", error);
        setPreferencesError("Failed to load store preferences");
      } finally {
        setIsLoadingPrefs(false);
      }
    }

    loadPreferences();
  }, []);

  // Handle start automation
  const handleStartAutomation = useCallback(async () => {
    if (!selectedStore || ingredients.length === 0) return;

    setShowModal(true);

    await startAutomation({
      store: selectedStore,
      items: ingredients.map((ing) => ({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        category: ing.category,
        notes: ing.originalNames.length > 1
          ? `Also known as: ${ing.originalNames.slice(1).join(", ")}`
          : undefined,
      })),
      preferences: preferences
        ? {
            preferOrganic: preferences.preferOrganic,
            preferStoreBrand: preferences.preferStoreBrand,
            allowSubstitutions: preferences.allowSubstitutions,
            maxPricePerItem: preferences.maxPricePerItem ?? undefined,
          }
        : undefined,
    });
  }, [selectedStore, ingredients, preferences, startAutomation]);

  // Handle retry failed items (reserved for future use)
  const _handleRetryFailed = useCallback(async () => {
    if (state.result?.notFoundItems) {
      await retryFailedItems(state.result.notFoundItems);
    }
  }, [retryFailedItems, state.result?.notFoundItems]);

  // Handle modal close
  const handleModalClose = useCallback((open: boolean) => {
    if (!open && !isLoading) {
      setShowModal(false);
    }
  }, [isLoading]);

  // Determine if button should be disabled
  const isButtonDisabled =
    disabled ||
    isLoadingPrefs ||
    !selectedStore ||
    ingredients.length === 0 ||
    isLoading;

  // Get tooltip message
  const getTooltipMessage = () => {
    if (isLoadingPrefs) return "Loading preferences...";
    if (!selectedStore) return "Please select a store in settings first";
    if (ingredients.length === 0) return "Generate a shopping list first";
    if (isLoading) return "Automation in progress...";
    return t("startAutomationDesc");
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={className}>
              <Button
                onClick={handleStartAutomation}
                disabled={isButtonDisabled}
                className={cn(
                  "relative group overflow-hidden",
                  "bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700",
                  "shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30",
                  "transition-all duration-300",
                  isButtonDisabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {/* Animated Background */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  initial={{ x: "-100%" }}
                  animate={{ x: "200%" }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 3,
                    ease: "linear",
                  }}
                />

                {/* Content */}
                <span className="relative flex items-center gap-2">
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">{t("startAutomation")}</span>
                  <span className="sm:hidden">
                    <Play className="w-4 h-4" />
                  </span>
                  {!isLoading && (
                    <Sparkles className="w-3 h-3 text-gold-300" />
                  )}
                </span>
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p>{getTooltipMessage()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Error Alert */}
      {preferencesError && (
        <Alert variant="destructive" className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{preferencesError}</AlertDescription>
        </Alert>
      )}

      {/* Progress Modal */}
      <ShoppingProgressModal
        open={showModal}
        onOpenChange={handleModalClose}
        state={state}
        onCancel={cancelAutomation}
        onRetryFailed={async () => {
          if (state.result?.notFoundItems) {
            await retryFailedItems(state.result.notFoundItems);
          }
        }}
        onReset={reset}
        itemCount={ingredients.length}
      />
    </>
  );
}
