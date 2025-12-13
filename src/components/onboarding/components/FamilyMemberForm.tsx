"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { RELATIONSHIP_TYPES, type FamilyMemberData } from "@/types/onboarding";

// Form schema
const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name is too long"),
  relationship: z.string().min(1, "Relationship is required"),
  dateOfBirth: z.date({
    required_error: "Date of birth is required",
  }),
  gender: z.enum(["male", "female", "other"], {
    required_error: "Please select a gender",
  }),
  heightCm: z.number().optional().nullable(),
  weightKg: z.number().optional().nullable(),
  dietaryNeeds: z.array(z.string()),
});

interface FamilyMemberFormProps {
  member?: FamilyMemberData;
  onSubmit: (data: FamilyMemberData) => void;
  onCancel: () => void;
}

export function FamilyMemberForm({
  member,
  onSubmit,
  onCancel,
}: FamilyMemberFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: member
      ? {
          name: member.name,
          relationship: member.relationship,
          dateOfBirth: new Date(member.dateOfBirth),
          gender: member.gender,
          heightCm: member.heightCm || null,
          weightKg: member.weightKg || null,
          dietaryNeeds: member.dietaryNeeds,
        }
      : {
          name: "",
          relationship: "",
          dateOfBirth: undefined,
          gender: undefined,
          heightCm: null,
          weightKg: null,
          dietaryNeeds: [],
        },
  });

  const [customNeed, setCustomNeed] = useState("");

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    const familyMemberData: FamilyMemberData = {
      name: values.name,
      relationship: values.relationship,
      dateOfBirth: values.dateOfBirth.toISOString(),
      gender: values.gender,
      heightCm: values.heightCm || undefined,
      weightKg: values.weightKg || undefined,
      dietaryNeeds: values.dietaryNeeds,
    };

    onSubmit(familyMemberData);
  };

  const addDietaryNeed = () => {
    if (customNeed.trim()) {
      const currentNeeds = form.getValues("dietaryNeeds");
      if (!currentNeeds.includes(customNeed.trim())) {
        form.setValue("dietaryNeeds", [...currentNeeds, customNeed.trim()]);
      }
      setCustomNeed("");
    }
  };

  const removeDietaryNeed = (need: string) => {
    const currentNeeds = form.getValues("dietaryNeeds");
    form.setValue(
      "dietaryNeeds",
      currentNeeds.filter((n) => n !== need)
    );
  };

  return (
    <Form {...form}>
      <div className="space-y-4 border rounded-lg p-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Relationship */}
          <FormField
            control={form.control}
            name="relationship"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Relationship</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {RELATIONSHIP_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Date of Birth */}
          <FormField
            control={form.control}
            name="dateOfBirth"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Date of Birth</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Gender */}
          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gender</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Height (Optional) */}
          <FormField
            control={form.control}
            name="heightCm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Height (cm) - Optional</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="170"
                    {...field}
                    value={field.value || ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Weight (Optional) */}
          <FormField
            control={form.control}
            name="weightKg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weight (kg) - Optional</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="70"
                    {...field}
                    value={field.value || ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Dietary Needs */}
        <FormField
          control={form.control}
          name="dietaryNeeds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dietary Needs</FormLabel>
              <FormDescription>
                Add any allergies, restrictions, or preferences
              </FormDescription>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., Gluten free"
                  value={customNeed}
                  onChange={(e) => setCustomNeed(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDietaryNeed();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addDietaryNeed}
                  disabled={!customNeed.trim()}
                >
                  Add
                </Button>
              </div>
              {field.value.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {field.value.map((need) => (
                    <Badge key={need} variant="secondary">
                      {need}
                      <button
                        type="button"
                        className="ml-1 text-xs hover:text-destructive"
                        onClick={() => removeDietaryNeed(need)}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button type="button" onClick={form.handleSubmit(handleSubmit)}>
            <Check className="h-4 w-4 mr-2" />
            {member ? "Update" : "Add"} Member
          </Button>
        </div>
      </div>
    </Form>
  );
}
