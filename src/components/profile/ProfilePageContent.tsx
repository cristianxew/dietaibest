"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { User, Target, Utensils, Users, Plus, Trash2, Edit2, Loader2 } from "lucide-react";
import {
  StyledTabs as Tabs,
  StyledTabsContent as TabsContent,
  StyledTabsList as TabsList,
  StyledTabsTrigger as TabsTrigger,
} from "@/components/custom-ui/styled-tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FamilyMemberForm } from "@/components/onboarding/components/FamilyMemberForm";
import {
  ACTIVITY_LEVELS,
  DIETARY_GOALS,
  DIETARY_TYPES,
  COMMON_ALLERGIES,
  CUISINE_PREFERENCES,
  type FamilyMemberData,
} from "@/types/onboarding";
import {
  updatePersonalInfo,
  updateGoals,
  updatePreferences,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
} from "@/actions/profile";
import { calculateMacros } from "@/utils/macroCalculator";

// Validation schemas
const personalInfoSchema = z.object({
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other"]),
  heightCm: z.coerce.number().min(100).max(250),
  weightKg: z.coerce.number().min(30).max(300),
  activityLevel: z.enum(["sedentary", "light", "moderate", "very", "extra"]),
});

const goalsSchema = z.object({
  dietaryGoal: z.enum(["lose", "maintain", "gain"]),
  dailyCalories: z.coerce.number().min(1000).max(5000),
  proteinGrams: z.coerce.number().min(0).max(500),
  carbsGrams: z.coerce.number().min(0).max(1000),
  fatGrams: z.coerce.number().min(0).max(500),
});

const preferencesSchema = z.object({
  dietaryType: z.array(z.string()),
  allergies: z.array(z.string()),
  cuisinePrefs: z.array(z.string()),
});

interface ProfileData {
  id: string;
  dateOfBirth: string;
  gender: string;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  dietaryGoal: string;
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  dietaryType: string[];
  allergies: string[];
  cuisinePrefs: string[];
  familyMembers: Array<{
    id: string;
    name: string;
    relationship: string;
    dateOfBirth: string;
    gender: string;
    heightCm: number | null;
    weightKg: number | null;
    dietaryNeeds: string[];
  }>;
  onboardingCompleted: boolean;
}

interface ProfilePageContentProps {
  initialData: ProfileData;
}

export function ProfilePageContent({ initialData }: ProfilePageContentProps) {
  const t = useTranslations("profile");
  const [activeTab, setActiveTab] = useState("personal");
  const [familyMembers, setFamilyMembers] = useState(initialData.familyMembers);
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [editingMember, setEditingMember] = useState<ProfileData["familyMembers"][0] | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Personal Info Form
  const personalForm = useForm<z.infer<typeof personalInfoSchema>>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      dateOfBirth: initialData.dateOfBirth.split("T")[0],
      gender: initialData.gender as "male" | "female" | "other",
      heightCm: initialData.heightCm,
      weightKg: initialData.weightKg,
      activityLevel: initialData.activityLevel as "sedentary" | "light" | "moderate" | "very" | "extra",
    },
  });

  // Goals Form
  const goalsForm = useForm<z.infer<typeof goalsSchema>>({
    resolver: zodResolver(goalsSchema),
    defaultValues: {
      dietaryGoal: initialData.dietaryGoal as "lose" | "maintain" | "gain",
      dailyCalories: initialData.dailyCalories,
      proteinGrams: initialData.proteinGrams,
      carbsGrams: initialData.carbsGrams,
      fatGrams: initialData.fatGrams,
    },
  });

  // Preferences Form
  const preferencesForm = useForm<z.infer<typeof preferencesSchema>>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      dietaryType: initialData.dietaryType,
      allergies: initialData.allergies,
      cuisinePrefs: initialData.cuisinePrefs,
    },
  });

  // Handle personal info submit
  const handlePersonalSubmit = async (values: z.infer<typeof personalInfoSchema>) => {
    setIsSubmitting(true);
    try {
      const result = await updatePersonalInfo({
        ...values,
        dateOfBirth: new Date(values.dateOfBirth).toISOString(),
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("saved"));
      }
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle goals submit
  const handleGoalsSubmit = async (values: z.infer<typeof goalsSchema>) => {
    setIsSubmitting(true);
    try {
      const result = await updateGoals(values);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("saved"));
      }
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle preferences submit
  const handlePreferencesSubmit = async (values: z.infer<typeof preferencesSchema>) => {
    setIsSubmitting(true);
    try {
      const result = await updatePreferences(values);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("saved"));
      }
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle recalculate macros based on current form values
  const handleRecalculateMacros = () => {
    const personalValues = personalForm.getValues();
    const goalValue = goalsForm.getValues().dietaryGoal;

    const macros = calculateMacros({
      dateOfBirth: new Date(personalValues.dateOfBirth),
      gender: personalValues.gender,
      heightCm: personalValues.heightCm,
      weightKg: personalValues.weightKg,
      activityLevel: personalValues.activityLevel,
      dietaryGoal: goalValue,
    });

    goalsForm.setValue("dailyCalories", macros.dailyCalories);
    goalsForm.setValue("proteinGrams", macros.proteinGrams);
    goalsForm.setValue("carbsGrams", macros.carbsGrams);
    goalsForm.setValue("fatGrams", macros.fatGrams);
  };

  // Handle add/edit family member
  const handleFamilyMemberSubmit = async (data: FamilyMemberData) => {
    setIsSubmitting(true);
    try {
      if (editingMember) {
        const result = await updateFamilyMember(editingMember.id, {
          ...data,
          dateOfBirth: new Date(data.dateOfBirth).toISOString(),
        });

        if (result.error) {
          toast.error(result.error);
        } else {
          setFamilyMembers(prev =>
            prev.map(m => m.id === editingMember.id
              ? { ...m, ...data, id: editingMember.id }
              : m
            )
          );
          toast.success(t("familyMemberUpdated"));
        }
      } else {
        const result = await addFamilyMember({
          ...data,
          dateOfBirth: new Date(data.dateOfBirth).toISOString(),
        });

        if (result.error) {
          toast.error(result.error);
        } else {
          setFamilyMembers(prev => [...prev, {
            id: result.data?.id || crypto.randomUUID(),
            ...data,
            heightCm: data.heightCm || null,
            weightKg: data.weightKg || null,
          }]);
          toast.success(t("familyMemberAdded"));
        }
      }
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setIsSubmitting(false);
      setShowFamilyForm(false);
      setEditingMember(null);
    }
  };

  // Handle delete family member
  const handleDeleteMember = async () => {
    if (!deletingMemberId) return;

    setIsSubmitting(true);
    try {
      const result = await deleteFamilyMember(deletingMemberId);

      if (result.error) {
        toast.error(result.error);
      } else {
        setFamilyMembers(prev => prev.filter(m => m.id !== deletingMemberId));
        toast.success(t("familyMemberDeleted"));
      }
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setIsSubmitting(false);
      setDeletingMemberId(null);
    }
  };

  // Toggle array value helper
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
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="personal" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tabs.personal")}</span>
          </TabsTrigger>
          <TabsTrigger value="goals" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tabs.goals")}</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Utensils className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tabs.preferences")}</span>
          </TabsTrigger>
          <TabsTrigger value="family" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tabs.family")}</span>
          </TabsTrigger>
        </TabsList>

        {/* Personal Info Tab */}
        <TabsContent value="personal" className="mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border border-border/50">
            <CardHeader>
              <CardTitle>{t("tabs.personal")}</CardTitle>
              <CardDescription>{t("personalDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...personalForm}>
                <form onSubmit={personalForm.handleSubmit(handlePersonalSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={personalForm.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("fields.dateOfBirth")}</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={personalForm.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("fields.gender")}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="male">{t("fields.genderMale")}</SelectItem>
                              <SelectItem value="female">{t("fields.genderFemale")}</SelectItem>
                              <SelectItem value="other">{t("fields.genderOther")}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={personalForm.control}
                      name="heightCm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("fields.height")}</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormDescription>{t("fields.heightUnit")}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={personalForm.control}
                      name="weightKg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("fields.weight")}</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" {...field} />
                          </FormControl>
                          <FormDescription>{t("fields.weightUnit")}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={personalForm.control}
                    name="activityLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fields.activityLevel")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ACTIVITY_LEVELS.map((level) => (
                              <SelectItem key={level.value} value={level.value}>
                                {level.label} - {level.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("save")}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Goals Tab */}
        <TabsContent value="goals" className="mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border border-border/50">
            <CardHeader>
              <CardTitle>{t("tabs.goals")}</CardTitle>
              <CardDescription>{t("goalsDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...goalsForm}>
                <form onSubmit={goalsForm.handleSubmit(handleGoalsSubmit)} className="space-y-6">
                  <FormField
                    control={goalsForm.control}
                    name="dietaryGoal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fields.dietaryGoal")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DIETARY_GOALS.map((goal) => (
                              <SelectItem key={goal.value} value={goal.value}>
                                {goal.label} - {goal.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRecalculateMacros}
                    >
                      {t("recalculateMacros")}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={goalsForm.control}
                      name="dailyCalories"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("fields.dailyCalories")}</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormDescription>{t("fields.caloriesUnit")}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={goalsForm.control}
                      name="proteinGrams"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("fields.protein")}</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormDescription>{t("fields.gramsUnit")}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={goalsForm.control}
                      name="carbsGrams"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("fields.carbs")}</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormDescription>{t("fields.gramsUnit")}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={goalsForm.control}
                      name="fatGrams"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("fields.fat")}</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormDescription>{t("fields.gramsUnit")}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("save")}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border border-border/50">
            <CardHeader>
              <CardTitle>{t("tabs.preferences")}</CardTitle>
              <CardDescription>{t("preferencesDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...preferencesForm}>
                <form onSubmit={preferencesForm.handleSubmit(handlePreferencesSubmit)} className="space-y-6">
                  {/* Dietary Types */}
                  <FormField
                    control={preferencesForm.control}
                    name="dietaryType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fields.dietaryTypes")}</FormLabel>
                        <FormDescription>{t("fields.dietaryTypesDescription")}</FormDescription>
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
                    control={preferencesForm.control}
                    name="allergies"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fields.allergies")}</FormLabel>
                        <FormDescription>{t("fields.allergiesDescription")}</FormDescription>
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
                    control={preferencesForm.control}
                    name="cuisinePrefs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fields.cuisines")}</FormLabel>
                        <FormDescription>{t("fields.cuisinesDescription")}</FormDescription>
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
                                    onCheckedChange={() => toggleArrayValue(field, cuisine)}
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

                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("save")}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Family Members Tab */}
        <TabsContent value="family" className="mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border border-border/50">
            <CardHeader>
              <CardTitle>{t("tabs.family")}</CardTitle>
              <CardDescription>{t("familyDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              {familyMembers.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {familyMembers.map((member) => (
                    <div
                      key={member.id}
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
                          onClick={() => {
                            setEditingMember(member);
                            setShowFamilyForm(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingMemberId(member.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">
                  {t("noFamilyMembers")}
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
                  {t("addFamilyMember")}
                </Button>
              ) : (
                <FamilyMemberForm
                  member={editingMember ? {
                    name: editingMember.name,
                    relationship: editingMember.relationship,
                    dateOfBirth: editingMember.dateOfBirth.split("T")[0],
                    gender: editingMember.gender as "male" | "female" | "other",
                    heightCm: editingMember.heightCm || undefined,
                    weightKg: editingMember.weightKg || undefined,
                    dietaryNeeds: editingMember.dietaryNeeds,
                  } : undefined}
                  onSubmit={handleFamilyMemberSubmit}
                  onCancel={() => {
                    setShowFamilyForm(false);
                    setEditingMember(null);
                  }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingMemberId} onOpenChange={() => setDeletingMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteFamilyMember")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteFamilyMemberConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMember}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
