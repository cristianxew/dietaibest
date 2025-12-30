"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Package,
  ArrowRight,
  BadgeCheck,
  Replace,
  Ban,
  Clipboard,
  PartyPopper,
  Coins,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { cn } from "@/lib/utils";
import { ShoppingAutomationResult, ShoppingItemResult } from "@/lib/browser-use";

// ============================================================================
// Types
// ============================================================================

interface ShoppingCompletionViewProps {
  result: ShoppingAutomationResult;
  /** Live URL to the browser session - preferred for accessing cart */
  liveUrl?: string | null;
  onRetryFailed: () => Promise<void>;
  onStartOver: () => void;
  onClose: () => void;
}

interface _SubstitutionCardProps {
  item: ShoppingItemResult;
  onAccept: () => void;
  onReject: () => void;
}

interface SkippedItemsListProps {
  items: ShoppingItemResult[];
  onCopyItem: (name: string) => void;
}

// ============================================================================
// Animation Variants
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
    },
  },
};

const celebrationVariants = {
  hidden: { scale: 0, rotate: -180 },
  visible: {
    scale: 1,
    rotate: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 20,
    },
  },
};

// ============================================================================
// Confetti Animation Component
// ============================================================================

function SuccessConfetti() {
  const colors = [
    "bg-brand-400",
    "bg-brand-500",
    "bg-gold-400",
    "bg-gold-500",
    "bg-sage-400",
    "bg-sage-500",
  ];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            "absolute w-2 h-2 rounded-full",
            colors[i % colors.length]
          )}
          initial={{
            x: "50%",
            y: "50%",
            opacity: 1,
            scale: 0,
          }}
          animate={{
            x: `${Math.random() * 100}%`,
            y: `${Math.random() * 100}%`,
            opacity: [1, 1, 0],
            scale: [0, 1, 0.5],
            rotate: Math.random() * 360,
          }}
          transition={{
            duration: 1.5,
            delay: i * 0.03,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Success Header Component
// ============================================================================

function SuccessHeader({
  status,
  itemCount,
  totalPrice,
}: {
  status: "success" | "partial" | "failed";
  itemCount: number;
  totalPrice?: number;
}) {
  const t = useTranslations("shopping.automation");

  const isSuccess = status === "success";
  const isPartial = status === "partial";

  return (
    <motion.div variants={itemVariants} className="relative text-center space-y-4">
      {isSuccess && <SuccessConfetti />}

      {/* Icon */}
      <motion.div
        variants={celebrationVariants}
        className={cn(
          "relative mx-auto w-20 h-20 rounded-3xl flex items-center justify-center shadow-sm",
          isSuccess && "bg-sage-100 dark:bg-sage-500/20 border border-sage-200/50 dark:border-sage-500/30",
          isPartial && "bg-gold-100 dark:bg-gold-500/20 border border-gold-200/50 dark:border-gold-500/30"
        )}
      >
        {isSuccess ? (
          <>
            <CheckCircle2 className="w-10 h-10 text-sage-600 dark:text-sage-400" />
            <motion.div
              className="absolute -top-1 -right-1"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
            >
              <PartyPopper className="w-6 h-6 text-gold-500" />
            </motion.div>
          </>
        ) : (
          <>
            <AlertTriangle className="w-10 h-10 text-gold-600 dark:text-gold-400" />
            <motion.div
              className="absolute -top-1 -right-1"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
            >
              <Package className="w-5 h-5 text-brand-500" />
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Title & Description */}
      <div>
        <h3 className="text-xl font-display font-semibold text-foreground">
          {isSuccess ? t("successTitle") : t("partialTitle")}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {isSuccess
            ? t("successDescription", { count: itemCount })
            : t("partialDescription")}
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-sage-100 dark:bg-sage-500/20">
          <Package className="w-4 h-4 text-sage-600 dark:text-sage-400" />
          <span className="text-sm font-medium text-sage-700 dark:text-sage-300">
            {itemCount} {t("itemsAdded")}
          </span>
        </div>

        {totalPrice !== undefined && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold-100 dark:bg-gold-500/20">
            <Coins className="w-4 h-4 text-gold-600 dark:text-gold-400" />
            <span className="text-sm font-medium text-gold-700 dark:text-gold-300">
              {totalPrice.toFixed(2)} PLN
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Found Items Summary
// ============================================================================

function FoundItemsSummary({ items }: { items: ShoppingItemResult[] }) {
  const t = useTranslations("shopping.automation");
  const [isExpanded, setIsExpanded] = useState(false);

  if (items.length === 0) return null;

  const displayItems = isExpanded ? items : items.slice(0, 3);
  const hasMore = items.length > 3;

  return (
    <motion.div variants={itemVariants}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="rounded-xl border border-sage-200/60 dark:border-sage-500/20 bg-sage-50/50 dark:bg-sage-500/5 overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 hover:bg-sage-100/50 dark:hover:bg-sage-500/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-sage-100 dark:bg-sage-500/20">
                  <BadgeCheck className="w-4 h-4 text-sage-600 dark:text-sage-400" />
                </div>
                <div className="text-left">
                  <h4 className="font-medium text-foreground">
                    {t("foundItems")}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {items.length} {t("items")}
                  </p>
                </div>
              </div>
              {hasMore && (
                <div className="flex items-center gap-1 text-sage-600 dark:text-sage-400">
                  <span className="text-xs">{isExpanded ? t("showLess") : t("showAll")}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              )}
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-2">
              {displayItems.map((item, index) => (
                <motion.div
                  key={`${item.name}-${index}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900/50"
                >
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-sage-500" />
                    <span className="text-sm text-foreground">{item.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.requestedAmount} {item.requestedUnit}
                    </span>
                  </div>
                  {item.foundProduct?.price && (
                    <span className="text-sm font-medium text-foreground">
                      {item.foundProduct.price.toFixed(2)} PLN
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </motion.div>
  );
}

// ============================================================================
// Substitution Card Component
// ============================================================================

function SubstitutionCard({ item }: { item: ShoppingItemResult }) {
  const t = useTranslations("shopping.automation");
  const [copiedOriginal, setCopiedOriginal] = useState(false);

  const handleCopyOriginal = async () => {
    if (item.substitution?.originalItem) {
      await navigator.clipboard.writeText(item.substitution.originalItem);
      setCopiedOriginal(true);
      setTimeout(() => setCopiedOriginal(false), 2000);
    }
  };

  if (!item.substitution) return null;

  return (
    <motion.div
      variants={itemVariants}
      className="p-4 rounded-xl border border-brand-200/60 dark:border-brand-500/20 bg-brand-50/50 dark:bg-brand-500/5"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-brand-100 dark:bg-brand-500/20 flex-shrink-0">
          <Replace className="w-4 h-4 text-brand-600 dark:text-brand-400" />
        </div>

        <div className="flex-1 space-y-3">
          {/* Original Item */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("originalItem")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground line-through opacity-60">
              {item.substitution.originalItem}
            </span>
            <button
              onClick={handleCopyOriginal}
              className="p-1.5 rounded-md hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-colors"
            >
              {copiedOriginal ? (
                <Check className="w-3.5 h-3.5 text-sage-500" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowRight className="w-4 h-4 text-brand-400 rotate-90" />
          </div>

          {/* Substitute */}
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("substitutedWith")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {item.substitution.substituteProduct}
            </span>
            {item.substitution.priceDifference !== 0 && (
              <Badge
                variant="outline"
                className={cn(
                  item.substitution.priceDifference > 0
                    ? "text-destructive border-destructive/30"
                    : "text-sage-600 border-sage-300"
                )}
              >
                {item.substitution.priceDifference > 0 ? "+" : ""}
                {item.substitution.priceDifference.toFixed(2)} PLN
              </Badge>
            )}
          </div>

          {/* Reason */}
          {item.substitution.reason && (
            <p className="text-xs text-muted-foreground italic">
              &ldquo;{item.substitution.reason}&rdquo;
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Substitutions List
// ============================================================================

function SubstitutionsList({ items }: { items: ShoppingItemResult[] }) {
  const t = useTranslations("shopping.automation");
  const [isExpanded, setIsExpanded] = useState(true);

  const substitutedItems = items.filter((item) => item.substitution);

  if (substitutedItems.length === 0) return null;

  return (
    <motion.div variants={itemVariants}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 rounded-xl bg-brand-50/50 dark:bg-brand-500/5 border border-brand-200/40 dark:border-brand-500/10 hover:bg-brand-100/50 dark:hover:bg-brand-500/10 transition-colors">
            <div className="flex items-center gap-3">
              <Replace className="w-5 h-5 text-brand-500" />
              <div className="text-left">
                <h4 className="font-medium text-foreground">
                  {t("substitutions")}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {substitutedItems.length} {t("itemsSubstituted")}
                </p>
              </div>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-brand-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-brand-500" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-3 space-y-3">
            {substitutedItems.map((item, index) => (
              <SubstitutionCard key={`${item.name}-${index}`} item={item} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  );
}

// ============================================================================
// Skipped Items List Component
// ============================================================================

function SkippedItemsList({ items, onCopyItem }: SkippedItemsListProps) {
  const t = useTranslations("shopping.automation");
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  const handleCopy = async (name: string, index: number) => {
    await navigator.clipboard.writeText(name);
    setCopiedIndex(index);
    onCopyItem(name);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <motion.div variants={itemVariants}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 rounded-xl bg-destructive/5 dark:bg-destructive/10 border border-destructive/20 hover:bg-destructive/10 transition-colors">
            <div className="flex items-center gap-3">
              <Ban className="w-5 h-5 text-destructive" />
              <div className="text-left">
                <h4 className="font-medium text-foreground">
                  {t("skippedItems")}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {items.length} {t("itemsNotFound")}
                </p>
              </div>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-destructive" />
            ) : (
              <ChevronDown className="w-5 h-5 text-destructive" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-3 space-y-2">
            {items.map((item, index) => (
              <motion.div
                key={`${item.name}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900/50 border border-border/40"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive/60" />
                  <div>
                    <span className="text-sm text-foreground">{item.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {item.requestedAmount} {item.requestedUnit}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(item.name, index)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {copiedIndex === index ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-sage-500" />
                      <span>{t("copied")}</span>
                    </>
                  ) : (
                    <>
                      <Clipboard className="w-3.5 h-3.5" />
                      <span>{t("copyToAdd")}</span>
                    </>
                  )}
                </button>
              </motion.div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ShoppingCompletionView({
  result,
  liveUrl,
  onRetryFailed,
  onStartOver,
  onClose,
}: ShoppingCompletionViewProps) {
  const t = useTranslations("shopping.automation");
  const [isRetrying, setIsRetrying] = useState(false);

  // Prefer liveUrl (browser session with state) over cartUrl (just a page URL)
  const browserUrl = liveUrl || result.liveUrl || result.cartUrl;
  const isLiveBrowser = Boolean(liveUrl || result.liveUrl);

  const handleOpenCart = () => {
    if (browserUrl) {
      window.open(browserUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetryFailed();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCopyItem = (name: string) => {
    // Could show a toast here
    console.log(`Copied: ${name}`);
  };

  const hasSubstitutions = result.substitutions.length > 0;
  const hasSkipped = result.notFoundItems.length > 0;
  const _isFullSuccess = result.status === "success";

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Success Header */}
      <SuccessHeader
        status={result.status}
        itemCount={result.itemCount}
        totalPrice={result.totalPrice}
      />

      {/* Open Cart Button - Primary Action */}
      {browserUrl && (
        <motion.div variants={itemVariants}>
          <Button
            size="lg"
            className={cn(
              "w-full h-14 text-base font-semibold",
              "bg-primary text-primary-foreground",
              "shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-0.5",
              "transition-all duration-200"
            )}
            onClick={handleOpenCart}
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            {isLiveBrowser ? t("openLiveBrowser") : t("openCart")}
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            {isLiveBrowser ? t("openLiveBrowserHint") : t("openCartHint")}
          </p>
        </motion.div>
      )}

      {/* Found Items Summary */}
      <FoundItemsSummary items={result.foundItems} />

      {/* Substitutions */}
      {hasSubstitutions && (
        <SubstitutionsList items={result.substitutions} />
      )}

      {/* Skipped Items */}
      {hasSkipped && (
        <SkippedItemsList
          items={result.notFoundItems}
          onCopyItem={handleCopyItem}
        />
      )}

      {/* Action Buttons */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3 pt-4">
        {hasSkipped && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                {t("retrying")}
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                {t("retryFailedItems")}
              </>
            )}
          </Button>
        )}

        <div className="flex gap-3">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={onStartOver}
          >
            {t("startOver")}
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
          >
            {t("done")}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
