export function tryParseJson<T = unknown>(
  jsonString: unknown,
  defaultValue: T | null = null,
): T | null {
  if (typeof jsonString === "object") {
    return jsonString as T;
  }

  try {
    return JSON.parse(jsonString as string);
  } catch {
    return defaultValue;
  }
}
