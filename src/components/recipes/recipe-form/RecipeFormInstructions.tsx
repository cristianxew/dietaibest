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
    <Card>
      <CardHeader>
        <CardTitle>Instructions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2">
            <div className="flex-shrink-0 w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-medium">
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
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => remove(index)}
              disabled={fields.length === 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => append("")}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Step
        </Button>
      </CardContent>
    </Card>
  );
}
