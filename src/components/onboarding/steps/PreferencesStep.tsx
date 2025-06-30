"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, Edit2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOnboardingState } from "../hooks/useOnboardingState";
import { NavigationButtons } from "../components/NavigationButtons";
import { FamilyMemberForm } from "@/components/onboarding/components/FamilyMemberForm";
import {
  DIETARY_TYPES,
  COMMON_ALLERGIES,
  CUISINE_PREFERENCES,
  type PreferencesData,
  type FamilyMemberData,
} from "@/types/onboarding";
import { useTranslations } from "next-intl";

// Form schema
const formSchema = z.object({
  dietaryType: z.array(z.string()).min(0),
  allergies: z.array(z.string()).min(0),
  cuisinePrefs: z.array(z.string()).min(0),
});

interface PreferencesStepProps {
  onFinish?: () => Promise<void>;
}

export function PreferencesStep({ onFinish }: PreferencesStepProps = {}) {
  const t = useTranslations("onboarding");
  const {
    state,
    setPreferences,
    setStep,
    addFamilyMember,
    updateFamilyMember,
    removeFamilyMember,
  } = useOnboardingState();
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [editingFamilyIndex, setEditingFamilyIndex] = useState<number | null>(
    null
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange", // Enable real-time validation
    defaultValues: state.preferences || {
      dietaryType: [],
      allergies: [],
      cuisinePrefs: [],
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const preferencesData: PreferencesData = {
      dietaryType: values.dietaryType,
      allergies: values.allergies,
      cuisinePrefs: values.cuisinePrefs,
    };

    setPreferences(preferencesData);

    // Call the onFinish handler if provided (for the last step)
    if (onFinish) {
      await onFinish();
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleAddFamilyMember = (member: FamilyMemberData) => {
    if (editingFamilyIndex !== null) {
      updateFamilyMember(editingFamilyIndex, member);
      setEditingFamilyIndex(null);
    } else {
      addFamilyMember(member);
    }
    setShowFamilyForm(false);
  };

  const handleEditFamilyMember = (index: number) => {
    setEditingFamilyIndex(index);
    setShowFamilyForm(true);
  };

  const handleCancelFamilyForm = () => {
    setShowFamilyForm(false);
    setEditingFamilyIndex(null);
  };

  const toggleArrayValue = (
    field: { value: string[]; onChange: (value: string[]) => void },
    value: string
  ) => {
    const currentValues = field.value || [];
    if (currentValues.includes(value)) {
      field.onChange(currentValues.filter((v: string) => v !== value));
    } else {
      field.onChange([...currentValues, value]);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Dietary Types */}
        <FormField
          control={form.control}
          name="dietaryType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("steps.preferences.dietaryTypes")}</FormLabel>
              <FormDescription>
                Select all that apply to your diet
              </FormDescription>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {DIETARY_TYPES.map((type) => (
                  <FormItem
                    key={type}
                    className="flex flex-row items-start space-x-3 space-y-0"
                  >
                    <FormControl>
                      <Checkbox
                        checked={field.value?.includes(type)}
                        onCheckedChange={() => toggleArrayValue(field, type)}
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">
                      {type}
                    </FormLabel>
                  </FormItem>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Allergies */}
        <FormField
          control={form.control}
          name="allergies"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("steps.preferences.allergies")}</FormLabel>
              <FormDescription>
                Select any allergies or dietary restrictions
              </FormDescription>
              <div className="grid grid-cols-3 gap-3 mt-3">
                {COMMON_ALLERGIES.map((allergy) => (
                  <FormItem
                    key={allergy}
                    className="flex flex-row items-start space-x-3 space-y-0"
                  >
                    <FormControl>
                      <Checkbox
                        checked={field.value?.includes(allergy)}
                        onCheckedChange={() => toggleArrayValue(field, allergy)}
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">
                      {allergy}
                    </FormLabel>
                  </FormItem>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Cuisine Preferences */}
        <FormField
          control={form.control}
          name="cuisinePrefs"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cuisine Preferences</FormLabel>
              <FormDescription>Select your preferred cuisines</FormDescription>
              <ScrollArea className="h-[120px] w-full rounded-md border p-4 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  {CUISINE_PREFERENCES.map((cuisine) => (
                    <FormItem
                      key={cuisine}
                      className="flex flex-row items-start space-x-3 space-y-0"
                    >
                      <FormControl>
                        <Checkbox
                          checked={field.value?.includes(cuisine)}
                          onCheckedChange={() =>
                            toggleArrayValue(field, cuisine)
                          }
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">
                        {cuisine}
                      </FormLabel>
                    </FormItem>
                  ))}
                </div>
              </ScrollArea>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Family Members */}
        <Card>
          <CardHeader>
            <CardTitle>{t("steps.preferences.familyMembers")}</CardTitle>
            <CardDescription>
              Add family members to include in meal planning
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.familyMembers.length > 0 ? (
              <div className="space-y-2 mb-4">
                {state.familyMembers.map((member, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.relationship}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditFamilyMember(index)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFamilyMember(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">
                No family members added yet
              </p>
            )}

            {!showFamilyForm ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFamilyForm(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("actions.addFamily")}
              </Button>
            ) : (
              <FamilyMemberForm
                member={
                  editingFamilyIndex !== null
                    ? state.familyMembers[editingFamilyIndex]
                    : undefined
                }
                onSubmit={handleAddFamilyMember}
                onCancel={handleCancelFamilyForm}
              />
            )}
          </CardContent>
        </Card>

        <NavigationButtons
          currentStep={2}
          totalSteps={3}
          onBack={handleBack}
          onNext={() => form.handleSubmit(onSubmit)()}
          onFinish={() => form.handleSubmit(onSubmit)()}
          canGoNext={true} // Preferences are optional
        />
      </form>
    </Form>
  );
}
