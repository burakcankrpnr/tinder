export const MINIMUM_AGE = 18;
export const MAXIMUM_AGE = 100;

export function calculateAge(birthDate: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function isAllowedAge(birthDate: Date, now: Date = new Date()): boolean {
  const age = calculateAge(birthDate, now);
  return age >= MINIMUM_AGE && age <= MAXIMUM_AGE;
}
