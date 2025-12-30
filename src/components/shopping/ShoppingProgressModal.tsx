"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ShoppingCart,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Package,
  Sparkles,
  Clock,
  Store,
  Bot,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { cn } from "@/lib/utils";
import { SUPPORTED_STORES, ShoppingItemResult } from "@/lib/browser-use";
import {
  ShoppingAutomationState,
  ShoppingAutomationStatus,
} from "@/hooks/use-shopping-automation";
import { ShoppingCompletionView } from "./ShoppingCompletionView";

// ============================================================================
// Types
// ============================================================================

interface ShoppingProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ShoppingAutomationState;
  onCancel: () => Promise<void>;
  onRetryFailed: (items: ShoppingItemResult[]) => Promise<void>;
  onReset: () => void;
  itemCount: number;
}

// ============================================================================
// Animation Variants
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

const pulseVariants = {
  pulse: {
    scale: [1, 1.05, 1],
    opacity: [0.7, 1, 0.7],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
};

const floatVariants = {
  float: {
    y: [0, -8, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
};

// ============================================================================
// Status Icon Component
// ============================================================================

function StatusIcon({ status }: { status: ShoppingAutomationStatus }) {
  switch (status) {
    case "connecting":
    case "running":
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-6 h-6 text-brand-500" />
        </motion.div>
      );
    case "completed":
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
        >
          <CheckCircle2 className="w-6 h-6 text-sage-500" />
        </motion.div>
      );
    case "partial":
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
        >
          <AlertTriangle className="w-6 h-6 text-gold-500" />
        </motion.div>
      );
    case "failed":
    case "timeout":
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
        >
          <XCircle className="w-6 h-6 text-destructive" />
        </motion.div>
      );
    case "cancelled":
      return <X className="w-6 h-6 text-muted-foreground" />;
    default:
      return <ShoppingCart className="w-6 h-6 text-brand-500" />;
  }
}

// ============================================================================
// Progress Animation Component
// ============================================================================

function ProgressAnimation({
  progress,
  status,
  currentAction,
}: {
  progress: number;
  status: ShoppingAutomationStatus;
  currentAction?: string;
}) {
  const isActive = status === "connecting" || status === "running";

  // Animated progress stages
  const stages = [
    { icon: Store, label: "Opening store", threshold: 10 },
    { icon: Search, label: "Searching products", threshold: 30 },
    { icon: Package, label: "Adding to cart", threshold: 60 },
    { icon: ShoppingCart, label: "Reviewing cart", threshold: 85 },
    { icon: CheckCircle2, label: "Complete", threshold: 100 },
  ];

  const currentStageIndex = stages.findIndex((s) => progress < s.threshold);
  const activeStage = currentStageIndex === -1 ? stages.length - 1 : currentStageIndex;

  return (
    <div className="space-y-6">
      {/* Main Progress Bar */}
      <div className="relative">
        <Progress
          value={progress}
          className={cn(
            "h-3 bg-stone-100 dark:bg-slate-800",
            isActive && "overflow-hidden"
          )}
        />
        {isActive && (
          <motion.div
            className="absolute inset-0 h-3 rounded-full overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ["-100%", "400%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        )}
      </div>

      {/* Progress Percentage */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Progress
        </span>
        <span className="text-2xl font-display font-semibold text-foreground">
          {progress}%
        </span>
      </div>

      {/* Stage Indicators */}
      <div className="flex items-center justify-between gap-2">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const isCompleted = index < activeStage;
          const isCurrent = index === activeStage;

          return (
            <div key={stage.label} className="flex flex-col items-center gap-1.5">
              <motion.div
                className={cn(
                  "relative p-2 rounded-xl transition-colors duration-300",
                  isCompleted && "bg-sage-100 dark:bg-sage-500/20",
                  isCurrent && "bg-brand-100 dark:bg-brand-500/20",
                  !isCompleted && !isCurrent && "bg-stone-100 dark:bg-slate-800"
                )}
                animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1.5, repeat: isCurrent ? Infinity : 0 }}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 transition-colors duration-300",
                    isCompleted && "text-sage-600 dark:text-sage-400",
                    isCurrent && "text-brand-600 dark:text-brand-400",
                    !isCompleted && !isCurrent && "text-muted-foreground"
                  )}
                />
                {isCurrent && isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-xl border-2 border-brand-500/50"
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </motion.div>
              <span
                className={cn(
                  "text-[10px] font-medium text-center max-w-[60px] leading-tight",
                  isCompleted && "text-sage-600 dark:text-sage-400",
                  isCurrent && "text-brand-600 dark:text-brand-400",
                  !isCompleted && !isCurrent && "text-muted-foreground"
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current Action */}
      {currentAction && isActive && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-xl bg-stone-50 dark:bg-slate-900 border border-border/50"
        >
          <Bot className="w-4 h-4 text-brand-500 flex-shrink-0" />
          <span className="text-sm text-muted-foreground truncate">
            {currentAction}
          </span>
        </motion.div>
      )}
    </div>
  );
}

// ============================================================================
// Running State View
// ============================================================================

function RunningStateView({
  state,
  itemCount,
  storeName,
}: {
  state: ShoppingAutomationState;
  itemCount: number;
  storeName: string;
}) {
  const t = useTranslations("shopping.automation");
  const { progress } = state;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Hero Section */}
      <motion.div variants={itemVariants} className="text-center space-y-4">
        {/* Animated Robot Icon */}
        <motion.div
          className="relative mx-auto w-24 h-24"
          variants={floatVariants}
          animate="float"
        >
          <div className="absolute inset-0 bg-primary/10 rounded-3xl rotate-6" />
          <div className="absolute inset-0 bg-card rounded-3xl border border-border shadow-lg flex items-center justify-center">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Bot className="w-10 h-10 text-brand-500" />
            </motion.div>
          </div>
          {/* Sparkle Effects */}
          <motion.div
            className="absolute -top-2 -right-2"
            variants={pulseVariants}
            animate="pulse"
          >
            <Sparkles className="w-5 h-5 text-gold-500" />
          </motion.div>
        </motion.div>

        <div>
          <h3 className="text-xl font-display font-semibold text-foreground">
            {t("inProgress")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("shoppingAt", { store: storeName })}
          </p>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-brand-50/50 dark:bg-brand-500/10 border border-brand-200/50 dark:border-brand-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span className="text-xs font-medium text-brand-600 dark:text-brand-400 uppercase tracking-wide">
              {t("items")}
            </span>
          </div>
          <span className="text-2xl font-display font-semibold text-foreground">
            {itemCount}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-gold-50/50 dark:bg-gold-500/10 border border-gold-200/50 dark:border-gold-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-gold-600 dark:text-gold-400" />
            <span className="text-xs font-medium text-gold-600 dark:text-gold-400 uppercase tracking-wide">
              {t("step")}
            </span>
          </div>
          <span className="text-2xl font-display font-semibold text-foreground">
            {progress.currentStep}/{progress.totalEstimatedSteps}
          </span>
        </div>
      </motion.div>

      {/* Progress Animation */}
      <motion.div variants={itemVariants}>
        <ProgressAnimation
          progress={progress.progress}
          status={state.status}
          currentAction={progress.currentAction}
        />
      </motion.div>

      {/* Status Message */}
      <motion.div
        variants={itemVariants}
        className="text-center p-4 rounded-xl bg-stone-50 dark:bg-slate-900 border border-border/50"
      >
        <p className="text-sm text-foreground font-medium">{progress.message}</p>
        {progress.currentUrl && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {progress.currentUrl}
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ShoppingProgressModal({
  open,
  onOpenChange,
  state,
  onCancel,
  onRetryFailed,
  onReset,
  itemCount,
}: ShoppingProgressModalProps) {
  const t = useTranslations("shopping.automation");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const isActive = state.status === "connecting" || state.status === "running";
  const isComplete = state.status === "completed" || state.status === "partial";
  const isError = state.status === "failed" || state.status === "timeout";

  // Get store name
  const storeName = useMemo(() => {
    if (!state.store) return "Store";
    return SUPPORTED_STORES[state.store]?.name || state.store;
  }, [state.store]);

  // Handle cancel with confirmation
  const handleCancelClick = () => {
    if (isActive) {
      setShowCancelConfirm(true);
    } else {
      onReset();
      onOpenChange(false);
    }
  };

  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    try {
      await onCancel();
    } finally {
      setIsCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  // Handle close
  const handleClose = () => {
    if (isActive) {
      setShowCancelConfirm(true);
    } else {
      onReset();
      onOpenChange(false);
    }
  };

  // Handle retry
  const handleRetry = async () => {
    if (state.result?.notFoundItems) {
      await onRetryFailed(state.result.notFoundItems);
    }
  };

  // Handle start over
  const handleStartOver = () => {
    onReset();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          className={cn(
            "sm:max-w-xl max-h-[90vh] overflow-y-auto",
            "bg-card",
            "border-border/60"
          )}
        >
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2.5 rounded-xl",
                  isActive && "bg-brand-100 dark:bg-brand-500/20",
                  isComplete && "bg-sage-100 dark:bg-sage-500/20",
                  isError && "bg-destructive/10"
                )}
              >
                <StatusIcon status={state.status} />
              </div>
              <DialogTitle className="font-display text-xl font-semibold">
                {isActive && t("title")}
                {isComplete && t("completeTitle")}
                {isError && t("errorTitle")}
                {state.status === "cancelled" && t("cancelledTitle")}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="py-4">
            <AnimatePresence mode="wait">
              {/* Running State */}
              {isActive && (
                <motion.div
                  key="running"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <RunningStateView
                    state={state}
                    itemCount={itemCount}
                    storeName={storeName}
                  />
                </motion.div>
              )}

              {/* Completion State */}
              {isComplete && state.result && (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <ShoppingCompletionView
                    result={state.result}
                    liveUrl={state.liveUrl}
                    onRetryFailed={handleRetry}
                    onStartOver={handleStartOver}
                    onClose={() => {
                      onReset();
                      onOpenChange(false);
                    }}
                  />
                </motion.div>
              )}

              {/* Error State */}
              {isError && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center space-y-6 py-8"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center"
                  >
                    <XCircle className="w-10 h-10 text-destructive" />
                  </motion.div>

                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {t("errorTitle")}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      {state.error || t("genericError")}
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <Button variant="outline" onClick={handleClose}>
                      {t("close")}
                    </Button>
                    <Button onClick={handleStartOver}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {t("tryAgain")}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Cancelled State */}
              {state.status === "cancelled" && (
                <motion.div
                  key="cancelled"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center space-y-6 py-8"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center"
                  >
                    <X className="w-10 h-10 text-muted-foreground" />
                  </motion.div>

                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {t("cancelledTitle")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("cancelledDescription")}
                    </p>
                  </div>

                  <Button onClick={handleClose}>{t("close")}</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Actions - Only show during active state */}
          {isActive && (
            <div className="flex justify-end pt-4 border-t border-border/40">
              <Button
                variant="outline"
                onClick={handleCancelClick}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <X className="w-4 h-4 mr-2" />
                {t("cancel")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cancelConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              {t("continueAutomation")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("cancelling")}
                </>
              ) : (
                t("yesCancel")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
