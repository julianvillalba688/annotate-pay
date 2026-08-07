import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function shortId(id: string, len = 6): string {
  return id.replace(/-/g, "").slice(0, len).toUpperCase();
}
