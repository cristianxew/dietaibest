"use client";

import { useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Utensils, Flame, Clock } from "lucide-react";
import type { Recipe } from "@/generated/prisma";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface DraggableRecipeCardProps {
  recipe: Recipe;
}

// Get difficulty color
function getDifficultyColor(difficulty: string | null) {
  switch (difficulty?.toLowerCase()) {
    case "easy":
      return "bg-sage-100 text-sage-700 border-sage-200 dark:bg-sage-500/20 dark:text-sage-400 dark:border-sage-500/30";
    case "medium":
      return "bg-gold-100 text-gold-700 border-gold-200 dark:bg-gold-500/20 dark:text-gold-400 dark:border-gold-500/30";
    case "hard":
      return "bg-brand-100 text-brand-700 border-brand-200 dark:bg-brand-500/20 dark:text-brand-400 dark:border-brand-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function DraggableRecipeCard({ recipe }: DraggableRecipeCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: `recipe-${recipe.id}`,
    data: {
      type: "recipe",
      recipe,
      recipeId: recipe.id,
    },
  });

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "group relative p-3 cursor-grab active:cursor-grabbing transition-all duration-200 overflow-hidden",
        "border-border/60 bg-card/80",
        "hover:border-brand-200/60 dark:hover:border-brand-500/30 hover:shadow-lg hover:-translate-y-0.5",
        isDragging && "opacity-50 scale-95 shadow-2xl"
      )}
      {...attributes}
      {...listeners}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-50/0 to-gold-50/0 group-hover:from-brand-50/30 group-hover:to-gold-50/20 dark:group-hover:from-brand-500/5 dark:group-hover:to-gold-500/5 transition-all duration-300 pointer-events-none" />

      <div className="relative flex items-start gap-3">
        {/* Drag Handle */}
        <div className="mt-1 text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Recipe Image */}
        {recipe.imageUrl ? (
          <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border border-border/40">
            <Image
              src={recipe.imageUrl}
              alt={recipe.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="56px"
            />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-100 to-gold-100 dark:from-brand-500/20 dark:to-gold-500/10 flex items-center justify-center flex-shrink-0 border border-brand-200/50 dark:border-brand-500/20">
            <Utensils className="w-6 h-6 text-brand-500 dark:text-brand-400" />
          </div>
        )}

        {/* Recipe Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
            {recipe.title}
          </p>

          {/* Macro badges */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {recipe.calories && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-5 rounded-full border-brand-200/60 bg-brand-50/50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400"
              >
                <Flame className="w-2.5 h-2.5 mr-0.5" />
                {Math.round(recipe.calories)}
              </Badge>
            )}
            {recipe.protein && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-5 rounded-full border-sage-200/60 bg-sage-50/50 text-sage-700 dark:border-sage-500/30 dark:bg-sage-500/10 dark:text-sage-400"
              >
                {Math.round(recipe.protein)}g P
              </Badge>
            )}
            {recipe.prepTime && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-5 rounded-full border-border/60 bg-muted/30 text-muted-foreground"
              >
                <Clock className="w-2.5 h-2.5 mr-0.5" />
                {recipe.prepTime}m
              </Badge>
            )}
          </div>

          {/* Difficulty */}
          {recipe.difficulty && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0 h-5 rounded-full mt-1.5 capitalize",
                getDifficultyColor(recipe.difficulty)
              )}
            >
              {recipe.difficulty}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
