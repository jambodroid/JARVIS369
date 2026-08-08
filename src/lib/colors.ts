import type { Priority } from "@/lib/tasks";

export type Category = "general" | "trading" | "social" | "health";
export type ColorName = "blue" | "green" | "yellow" | "purple" | "orange" | "red";

export const CATEGORIES: Category[] = ["general", "trading", "social", "health"];

export const CATEGORY_LABEL: Record<Category, string> = {
  general: "General",
  trading: "Trading",
  social: "Social Media",
  health: "Health",
};

const CATEGORY_COLOR: Record<Category, ColorName> = {
  general: "blue",
  trading: "green",
  social: "orange",
  health: "purple",
};

// High priority always wins, regardless of category.
export function resolveColor(category: Category, priority: Priority): ColorName {
  if (priority === "high") return "red";
  return CATEGORY_COLOR[category];
}

export const COLOR_CHIP_CLASS: Record<ColorName, string> = {
  blue: "bg-cat-blue/15 text-cat-blue",
  green: "bg-cat-green/15 text-cat-green",
  yellow: "bg-cat-yellow/15 text-cat-yellow",
  purple: "bg-cat-purple/15 text-cat-purple",
  orange: "bg-cat-orange/15 text-cat-orange",
  red: "bg-danger/15 text-danger",
};

export const COLOR_DOT_CLASS: Record<ColorName, string> = {
  blue: "bg-cat-blue",
  green: "bg-cat-green",
  yellow: "bg-cat-yellow",
  purple: "bg-cat-purple",
  orange: "bg-cat-orange",
  red: "bg-danger",
};

// Google Calendar's fixed event colorId palette.
export const GOOGLE_COLOR_ID: Record<ColorName, string> = {
  blue: "9", // Blueberry
  green: "10", // Basil
  yellow: "5", // Banana
  purple: "3", // Grape
  orange: "6", // Tangerine
  red: "11", // Tomato
};
