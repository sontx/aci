export const generateRandomChars = (length: number): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export function generateFunctionDisplayName(
  appName: string,
  functionName: string,
  separator: string = "__",
): string {
  let remainingName = functionName;

  // Remove appName prefix and separator if present
  if (functionName.startsWith(`${appName}${separator}`)) {
    remainingName = functionName.slice(appName.length + separator.length);
  }

  // Convert from upper snake case to title case
  return remainingName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
