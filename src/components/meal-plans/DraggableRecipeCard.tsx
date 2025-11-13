"use client";

import { useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Image as ImageIcon } from "lucide-react";
import type { Recipe } from "@/generated/prisma";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface DraggableRecipeCardProps {
  recipe: Recipe;
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
        "p-2 cursor-grab active:cursor-grabbing transition-all hover:shadow-md",
        isDragging && "opacity-50"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2">
        {/* Drag Handle */}
        <div className="mt-0.5">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Recipe Image */}
        {recipe.imageUrl ? (
          <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0">
            <Image
              src={recipe.imageUrl}
              alt={recipe.title}
              fill
              className="object-cover"
              sizes="48px"
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          </div>
        )}

        {/* Recipe Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-2 leading-tight">
            {recipe.title}
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {recipe.calories && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {Math.round(recipe.calories)} cal
              </Badge>
            )}
            {recipe.protein && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {Math.round(recipe.protein)}g P
              </Badge>
            )}
          </div>
          {recipe.difficulty && (
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">
              {recipe.difficulty}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
