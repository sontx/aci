import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  ACCESS_TOKEN_KEY,
  ACTIVE_ORG_ID_KEY,
  ACTIVE_PROJECT_ID_PREFIX_KEY,
} from "@/lib/constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getStorageAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStorageActiveOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_ORG_ID_KEY);
}

export function getStorageActiveProjectId(orgId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`${ACTIVE_PROJECT_ID_PREFIX_KEY}${orgId}`);
}
