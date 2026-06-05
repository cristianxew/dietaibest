"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { toggleFavorite } from "@/actions/recipe";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface RecipeFavoriteButtonProps {
  recipeId: string;
  initialFavorited: boolean;
  showText?: boolean;
  compact?: boolean;
  className?: string;
}

export function RecipeFavoriteButton({
  recipeId,
  initialFavorited,
  showText = false,
  compact = false,
  className,
}: RecipeFavoriteButtonProps) {
  const t = useTranslations("recipes");
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggleFavorite = async () => {
    setIsToggling(true);
    const previousState = isFavorited;

    // Optimistic update
    setIsFavorited(!isFavorited);

    const { data, error } = await toggleFavorite(recipeId);

    if (error) {
      // Revert on error
      setIsFavorited(previousState);
      toast.error(error);
    } else {
      toast.success(
        data?.favorited ? t("favoriteAdded") : t("favoriteRemoved")
      );
    }

    setIsToggling(false);
  };

  const label = compact
    ? isFavorited ? t("favorited") : t("favorite")
    : isFavorited ? t("removeFavorite") : t("addFavorite");

  return (
    <Button
      variant={isFavorited ? "default" : "outline"}
      size={showText ? "default" : "icon"}
      className={cn(showText && !compact ? "w-full" : "", className)}
      onClick={handleToggleFavorite}
      disabled={isToggling}
    >
      <Heart
        className={cn(
          showText ? "h-4 w-4 mr-2" : "h-4 w-4",
          isFavorited && "fill-current"
        )}
      />
      {showText && label}
    </Button>
  );
}
