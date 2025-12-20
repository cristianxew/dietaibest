"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { DatePicker } from "@/components/custom-ui/date-picker";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOnboardingState } from "../hooks/useOnboardingState";
import { NavigationButtons } from "../components/NavigationButtons";
import { ACTIVITY_LEVELS, type DemographicsData } from "@/types/onboarding";
import { useTranslations } from "next-intl";
import { calculateAge } from "@/utils/macroCalculator";

// Form schema
const formSchema = z.object({
  dateOfBirth: z
    .date({
      required_error: "Date of birth is required",
    })
    .refine(
      (date) => {
        const age = calculateAge(date);
        return age >= 13 && age <= 120;
      },
      {
        message: "Age must be between 13 and 120 years",
      }
    ),
  gender: z.enum(["male", "female", "other"], {
    required_error: "Please select a gender",
  }),
  heightCm: z
    .number({
      required_error: "Height is required",
      invalid_type_error: "Height must be a number",
    })
    .min(100, "Height must be at least 100 cm")
    .max(250, "Height must be less than 250 cm"),
  weightKg: z
    .number({
      required_error: "Weight is required",
      invalid_type_error: "Weight must be a number",
    })
    .min(30, "Weight must be at least 30 kg")
    .max(300, "Weight must be less than 300 kg"),
  activityLevel: z.enum(["sedentary", "light", "moderate", "very", "extra"], {
    required_error: "Please select an activity level",
  }),
});

export function DemographicsStep() {
  const t = useTranslations("onboarding");
  const { state, setDemographics, setStep } = useOnboardingState();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange", // Enable real-time validation
    defaultValues: state.demographics
      ? {
        dateOfBirth: new Date(state.demographics.dateOfBirth),
        gender: state.demographics.gender,
        heightCm: state.demographics.heightCm,
        weightKg: state.demographics.weightKg,
        activityLevel: state.demographics.activityLevel,
      }
      : {
        dateOfBirth: undefined,
        gender: undefined,
        heightCm: undefined,
        weightKg: undefined,
        activityLevel: undefined,
      },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const demographicsData: DemographicsData = {
      dateOfBirth: values.dateOfBirth.toISOString(),
      gender: values.gender,
      heightCm: values.heightCm,
      weightKg: values.weightKg,
      activityLevel: values.activityLevel,
    };

    setDemographics(demographicsData);
    setStep(1); // Move to next step
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Date of Birth */}
        <FormField
          control={form.control}
          name="dateOfBirth"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>
                {t("steps.demographics.fields.dateOfBirth")}
              </FormLabel>
              <FormControl>
                <DatePicker
                  date={field.value}
                  onDateChange={field.onChange}
                  disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                  }
                  placeholder="Pick a date"
                />
              </FormControl>
              <FormDescription>
                Used to calculate your nutritional needs
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Gender */}
        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>{t("steps.demographics.fields.gender")}</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="male" />
                    </FormControl>
                    <FormLabel className="font-normal">Male</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="female" />
                    </FormControl>
                    <FormLabel className="font-normal">Female</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="other" />
                    </FormControl>
                    <FormLabel className="font-normal">Other</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          {/* Height */}
          <FormField
            control={form.control}
            name="heightCm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("steps.demographics.fields.height")}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="170"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? parseFloat(e.target.value) : undefined
                      )
                    }
                  />
                </FormControl>
                <FormDescription>In centimeters</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Weight */}
          <FormField
            control={form.control}
            name="weightKg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("steps.demographics.fields.weight")}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="70"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? parseFloat(e.target.value) : undefined
                      )
                    }
                  />
                </FormControl>
                <FormDescription>In kilograms</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Activity Level */}
        <FormField
          control={form.control}
          name="activityLevel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t("steps.demographics.fields.activityLevel")}
              </FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your activity level" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ACTIVITY_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      <div>
                        <div className="font-medium">{level.label}</div>
                        <div className="text-sm text-muted-foreground">
                          {level.description}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <NavigationButtons
          currentStep={0}
          totalSteps={3}
          onBack={() => { }}
          onNext={form.handleSubmit(onSubmit)}
          canGoNext={form.formState.isValid}
        />
      </form>
    </Form>
  );
}
