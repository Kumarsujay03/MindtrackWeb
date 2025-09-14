import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function formatDateDMY(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "object" && value && typeof (value as any).toDate === "function") {
    const d = (value as any).toDate() as Date;
    return toDMY(d);
  }
  if (value instanceof Date) return toDMY(value);
  if (typeof value === "number") {
    const ms = value > 1e12 ? value : value * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? String(value) : toDMY(d);
  }
  if (typeof value === "string") {
    const s = value.trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date(s);
    return isNaN(d.getTime()) ? (s || "-") : toDMY(d);
  }
  return String(value);
}

function toDMY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}-${mm}-${yyyy}`;
}
