/**
 * Reference daily intakes for micronutrients.
 *
 * Two reference systems are combined:
 *
 *  1. **FDA Daily Values (DV)** — the single adult/children-≥4 reference printed
 *     on Nutrition Facts labels (21 CFR 101.9, 2016 update). Used as the
 *     STANDARD fallback when we cannot personalize (no profile, gender "other",
 *     or a non-adult age). This is exactly what "% DV" means on a food label.
 *
 *  2. **DRI / RDA (or AI where no RDA exists)** — National Academies (IOM/NASEM)
 *     Dietary Reference Intakes, tabulated by life-stage group (age) and sex.
 *     Used to PERSONALIZE the reference from `UserProfile.dateOfBirth` + gender.
 *
 * Scope: adult life-stage bands × {male, female}. Pregnancy/lactation and
 * pediatric DRIs are out of scope (→ DV fallback). Vitamin K, potassium are AIs
 * (no RDA established) but are treated as "goal" references. Units match the
 * corresponding Recipe columns (see `nutrition-fields.ts`); folate is µg DFE.
 *
 * ⚠️ Health-sensitive data. Verify any change against the published DRI tables
 * and the FDA Daily Value list before editing.
 */
import type { MicronutrientKey } from "@/lib/nutrition-fields";

export type ReferenceType = "goal" | "limit";

export interface ReferenceIntake {
  /** Amount in the nutrient's stored unit. */
  value: number;
  /** "goal" = aim to reach; "limit" = stay at or below. */
  type: ReferenceType;
}

export type ReferenceSource = "personalized" | "standard";

export interface ReferenceIntakes {
  source: ReferenceSource;
  /** Undefined for nutrients with no reference (e.g. trans fat). */
  values: Partial<Record<MicronutrientKey, ReferenceIntake>>;
}

/** Minimal profile shape needed to personalize (subset of `UserProfile`). */
export interface ReferenceProfile {
  dateOfBirth: Date | string;
  gender: string;
}

type Sex = "male" | "female";
type AgeBand = "19-30" | "31-50" | "51-70" | "71+";

/** Goal nutrients that get personalized RDA/AI values. */
type GoalKey =
  | "vitaminA"
  | "vitaminC"
  | "vitaminD"
  | "vitaminE"
  | "vitaminK"
  | "vitaminB12"
  | "folate"
  | "iron"
  | "calcium"
  | "magnesium"
  | "potassium"
  | "zinc";

/**
 * Limit-type references (upper bounds, profile-independent). Sodium uses the
 * label DV (2300mg). Trans fat is intentionally absent — no safe level.
 */
const LIMITS: Partial<Record<MicronutrientKey, number>> = {
  sodium: 2300,
  cholesterol: 300,
  saturatedFat: 20,
  sugar: 50,
};

/** FDA Daily Values for the goal nutrients (standard fallback). */
const DV_GOALS: Record<GoalKey, number> = {
  vitaminA: 900,
  vitaminC: 90,
  vitaminD: 20,
  vitaminE: 15,
  vitaminK: 120,
  vitaminB12: 2.4,
  folate: 400,
  iron: 18,
  calcium: 1300,
  magnesium: 420,
  potassium: 4700,
  zinc: 11,
};

/** DRI RDA/AI by sex × adult age band. Each cell verified against NASEM tables. */
const RDA: Record<Sex, Record<AgeBand, Record<GoalKey, number>>> = {
  male: {
    "19-30": { vitaminA: 900, vitaminC: 90, vitaminD: 15, vitaminE: 15, vitaminK: 120, vitaminB12: 2.4, folate: 400, iron: 8, calcium: 1000, magnesium: 400, potassium: 3400, zinc: 11 },
    "31-50": { vitaminA: 900, vitaminC: 90, vitaminD: 15, vitaminE: 15, vitaminK: 120, vitaminB12: 2.4, folate: 400, iron: 8, calcium: 1000, magnesium: 420, potassium: 3400, zinc: 11 },
    "51-70": { vitaminA: 900, vitaminC: 90, vitaminD: 15, vitaminE: 15, vitaminK: 120, vitaminB12: 2.4, folate: 400, iron: 8, calcium: 1000, magnesium: 420, potassium: 3400, zinc: 11 },
    "71+":   { vitaminA: 900, vitaminC: 90, vitaminD: 20, vitaminE: 15, vitaminK: 120, vitaminB12: 2.4, folate: 400, iron: 8, calcium: 1200, magnesium: 420, potassium: 3400, zinc: 11 },
  },
  female: {
    "19-30": { vitaminA: 700, vitaminC: 75, vitaminD: 15, vitaminE: 15, vitaminK: 90, vitaminB12: 2.4, folate: 400, iron: 18, calcium: 1000, magnesium: 310, potassium: 2600, zinc: 8 },
    "31-50": { vitaminA: 700, vitaminC: 75, vitaminD: 15, vitaminE: 15, vitaminK: 90, vitaminB12: 2.4, folate: 400, iron: 18, calcium: 1000, magnesium: 320, potassium: 2600, zinc: 8 },
    "51-70": { vitaminA: 700, vitaminC: 75, vitaminD: 15, vitaminE: 15, vitaminK: 90, vitaminB12: 2.4, folate: 400, iron: 8, calcium: 1200, magnesium: 320, potassium: 2600, zinc: 8 },
    "71+":   { vitaminA: 700, vitaminC: 75, vitaminD: 20, vitaminE: 15, vitaminK: 90, vitaminB12: 2.4, folate: 400, iron: 8, calcium: 1200, magnesium: 320, potassium: 2600, zinc: 8 },
  },
};

/** Whole-year age at `now` from a date of birth. */
export function deriveAge(dateOfBirth: Date | string, now: Date = new Date()): number {
  const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function ageToBand(age: number): AgeBand | null {
  if (age < 19) return null; // pediatric → out of scope
  if (age <= 30) return "19-30";
  if (age <= 50) return "31-50";
  if (age <= 70) return "51-70";
  return "71+";
}

function buildValues(goals: Record<GoalKey, number>): ReferenceIntakes["values"] {
  const values: ReferenceIntakes["values"] = {};
  for (const key of Object.keys(goals) as GoalKey[]) {
    values[key] = { value: goals[key], type: "goal" };
  }
  for (const key of Object.keys(LIMITS) as MicronutrientKey[]) {
    values[key] = { value: LIMITS[key] as number, type: "limit" };
  }
  return values;
}

/**
 * Resolve the per-nutrient reference intakes for a user. Personalizes by age +
 * sex when the profile is an adult male/female; otherwise returns the standard
 * FDA Daily Values.
 */
export function getReferenceIntakes(
  profile?: ReferenceProfile | null,
  now: Date = new Date()
): ReferenceIntakes {
  const sex =
    profile?.gender === "male" || profile?.gender === "female"
      ? (profile.gender as Sex)
      : null;
  const band = profile ? ageToBand(deriveAge(profile.dateOfBirth, now)) : null;

  if (sex && band) {
    return { source: "personalized", values: buildValues(RDA[sex][band]) };
  }
  return { source: "standard", values: buildValues(DV_GOALS) };
}

/**
 * Percentage of a reference a total represents. Returns the real percentage
 * (never capped — callers cap the bar, not the number). Undefined when there is
 * no usable reference.
 */
export function percentOfReference(
  total: number,
  ref?: ReferenceIntake
): number | undefined {
  if (!ref || ref.value <= 0) return undefined;
  return Math.round((total / ref.value) * 100);
}
