"use client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

interface RecipeFormInstructionsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any; // Using any to avoid complex type matching with react-hook-form
  instructionFields: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fields: any[];
    append: (value: string) => void;
    remove: (index: number) => void;
  };
}

export function RecipeFormInstructions({
  form,
  instructionFields,
}: RecipeFormInstructionsProps) {
  const { fields, append, remove } = instructionFields;

  return (
    <div className="space-y-4 pt-4">
      <h3 className="font-semibold text-base tracking-wide">Instructions</h3>
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-8 h-8 mt-1.5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-medium">
              {index + 1}
            </div>
            <FormField
              control={form.control}
              name={`instructions.${index}`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Textarea
                      placeholder="Describe this step..."
                      className="min-h-[80px] bg-secondary/40 border-border rounded-xl resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              disabled={fields.length === 1}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-11 w-10 flex-shrink-0 rounded-xl mt-1.5"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          onClick={() => append("")}
          className="w-full h-12 border border-dashed border-primary/30 text-primary hover:text-primary hover:bg-transparent dark:hover:bg-transparent hover:border-primary rounded-xl font-medium mt-4 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add step
        </Button>
      </div>
    </div>
  );
}
