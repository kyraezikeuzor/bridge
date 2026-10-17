export const LETTERS_PER_HOUR = 3;
export const MAX_LETTERS_PER_BATCH = 30;
export const MAX_PROOF_FILES = 10;
export const MAX_PROOF_FILE_BYTES = 10 * 1024 * 1024;

export function letterBatchError(letters: unknown): string | null {
  if (!Array.isArray(letters) || letters.length < LETTERS_PER_HOUR || letters.length > MAX_LETTERS_PER_BATCH || letters.length % LETTERS_PER_HOUR !== 0) {
    return "Submit letters in groups of three (up to 30 per batch).";
  }
  if (letters.some((letter) => typeof letter !== "string" || !letter.trim() || letter.length > 15000)) {
    return "Each letter must contain text and be no longer than 15,000 characters.";
  }
  return null;
}

export function validCompletedDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value <= new Date().toISOString().slice(0, 10);
}

export function validBatchId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9-]{16,80}$/.test(value);
}
