import { describe, it, expect } from 'bun:test';
import { calculateAge, calculateBMR, calculateMacros, validateMacroInput } from './macroCalculator';

const RealDate = Date;
const useFakeTimers = (date: Date) => {
  globalThis.Date = class extends RealDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        return new RealDate(date);
      }
      return new RealDate(...args) as any;
    }
    static now() {
      return new RealDate(date).getTime();
    }
  } as unknown as DateConstructor;
};
const useRealTimers = () => {
  globalThis.Date = RealDate;
};

describe('calculateAge', () => {
  it('returns correct age for birthdates', () => {
    useFakeTimers(new Date('2024-01-01'));
    expect(calculateAge(new Date('2000-01-01'))).toBe(24);
    expect(calculateAge(new Date('1999-12-31'))).toBe(24);
    expect(calculateAge(new Date('1990-06-30'))).toBe(33);
    useRealTimers();
  });
});

describe('calculateBMR', () => {

  const baseInput = {
    dateOfBirth: new Date('1990-01-01'),
    gender: 'male',
    heightCm: 180,
    weightKg: 75,
    activityLevel: 'moderate',
    dietaryGoal: 'maintain',
  } as const;

  it('calculates BMR for male', () => {
    useFakeTimers(new Date('2024-01-01'));
    expect(calculateBMR(baseInput)).toBe(1710);
    useRealTimers();
  });

  it('calculates BMR for female', () => {
    useFakeTimers(new Date('2024-01-01'));
    expect(
      calculateBMR({ ...baseInput, gender: 'female' })
    ).toBe(1544);
    useRealTimers();
  });
});

describe('calculateMacros', () => {

  const baseInput = {
    dateOfBirth: new Date('1990-01-01'),
    gender: 'male',
    heightCm: 180,
    weightKg: 75,
    activityLevel: 'moderate',
  } as const;

  it('calculates macros for weight loss', () => {
    useFakeTimers(new Date('2024-01-01'));
    const result = calculateMacros({ ...baseInput, dietaryGoal: 'lose' });
    expect(result).toEqual({
      dailyCalories: 2253,
      proteinGrams: 169,
      carbsGrams: 197,
      fatGrams: 88,
    });
    useRealTimers();
  });

  it('calculates macros for maintenance', () => {
    useFakeTimers(new Date('2024-01-01'));
    const result = calculateMacros({ ...baseInput, dietaryGoal: 'maintain' });
    expect(result).toEqual({
      dailyCalories: 2651,
      proteinGrams: 166,
      carbsGrams: 265,
      fatGrams: 103,
    });
    useRealTimers();
  });

  it('calculates macros for weight gain', () => {
    useFakeTimers(new Date('2024-01-01'));
    const result = calculateMacros({ ...baseInput, dietaryGoal: 'gain' });
    expect(result).toEqual({
      dailyCalories: 3048,
      proteinGrams: 191,
      carbsGrams: 343,
      fatGrams: 102,
    });
    useRealTimers();
  });
});

describe('validateMacroInput', () => {

  it('returns errors for missing fields', () => {
    useFakeTimers(new Date('2024-01-01'));
    expect(validateMacroInput({})).toEqual([
      'Date of birth is required',
      'Valid gender selection is required',
      'Height must be between 100 and 250 cm',
      'Weight must be between 30 and 300 kg',
      'Valid activity level selection is required',
      'Valid dietary goal selection is required',
    ]);
    useRealTimers();
  });

  it('validates age range', () => {
    useFakeTimers(new Date('2024-01-01'));
    const errors = validateMacroInput({
      dateOfBirth: new Date('2015-01-01'),
      gender: 'male',
      heightCm: 170,
      weightKg: 70,
      activityLevel: 'moderate',
      dietaryGoal: 'lose',
    });
    expect(errors).toContain('Age must be between 13 and 120 years');
    useRealTimers();
  });
});

