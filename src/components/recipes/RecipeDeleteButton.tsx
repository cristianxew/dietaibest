"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteRecipe } from "@/actions/recipe";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

interface RecipeDeleteButtonProps {
  recipeId: string;
  recipeName: string;
  showText?: boolean;
  className?: string;
  variant?: "outline" | "ghost" | "destructive" | "secondary" | "link" | "default";
}

export function RecipeDeleteButton({
  recipeId,
  recipeName,
  showText = false,
  className,
  variant = "outline",
}: RecipeDeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const locale = useLocale();

  const handleDelete = async () => {
    setIsDeleting(true);

    const { error } = await deleteRecipe(recipeId);

    if (error) {
      toast.error(error);
      setIsDeleting(false);
    } else {
      toast.success("Recipe deleted successfully");
      router.push(`/${locale}/recipes`);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant={variant}
          size={showText ? "default" : "icon"}
          className={cn(showText ? "w-full" : "h-9 w-9 shrink-0", className)}
          disabled={isDeleting}
          aria-label={showText ? undefined : "Delete Recipe"}
        >
          <Trash2 className={showText ? "h-4 w-4 mr-2" : "h-4 w-4"} />
          {showText && "Delete Recipe"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Recipe</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{recipeName}&quot;? This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
