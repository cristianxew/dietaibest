"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { toggleFavorite } from "@/actions/recipe";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RecipeFavoriteButtonProps {
  recipeId: string;
  initialFavorited: boolean;
  showText?: boolean;
}

export function RecipeFavoriteButton({
  recipeId,
  initialFavorited,
  showText = false,
}: RecipeFavoriteButtonProps) {
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
        data?.favorited ? "Added to favorites" : "Removed from favorites"
      );
    }

    setIsToggling(false);
  };

  return (
    <Button
      variant={isFavorited ? "default" : "outline"}
      size={showText ? "default" : "icon"}
      className={showText ? "w-full" : ""}
      onClick={handleToggleFavorite}
      disabled={isToggling}
    >
      <Heart
        className={cn(
          showText ? "h-4 w-4 mr-2" : "h-4 w-4",
          isFavorited && "fill-current"
        )}
      />
      {showText && (isFavorited ? "Remove from Favorites" : "Add to Favorites")}
    </Button>
  );
}
