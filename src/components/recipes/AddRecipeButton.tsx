"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRecipeModal } from "@/hooks/use-recipe-modal";

interface AddRecipeButtonProps {
  label: string;
  className?: string;
}

export function AddRecipeButton({ label, className }: AddRecipeButtonProps) {
  const { openCreate } = useRecipeModal();
  return (
    <Button
      onClick={openCreate}
      className={cn(
        "h-10 px-4 shadow-sm",
        "bg-brand-500 hover:bg-brand-600 text-white transition-all",
        className
      )}
    >
      <Plus className="w-4 h-4 mr-1.5" />
      {label}
    </Button>
  );
}
