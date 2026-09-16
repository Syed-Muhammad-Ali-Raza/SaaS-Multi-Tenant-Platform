import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const err = error as { response?: { data?: { message?: string | string[] } }; message?: string };
    const msg = err.response?.data?.message;
    if (Array.isArray(msg)) {
      return msg.join(", ");
    }
    if (typeof msg === "string") {
      return msg;
    }
    if (typeof err.message === "string") {
      return err.message;
    }
  }
  return "Something went wrong. Please try again.";
}