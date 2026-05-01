import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Intl formatters-i bir dəfə yarat, hər çağırışda yenidən yaratma
// Format: "15 yanvar 2026" (gün ay il)
const dateFormatter = new Intl.DateTimeFormat("az-AZ", {
  day:   "numeric",
  month: "long",
  year:  "numeric",
});

// Format: "15 yan 2026, 14:30"
const dateTimeFormatter = new Intl.DateTimeFormat("az-AZ", {
  day:    "numeric",
  month:  "short",
  year:   "numeric",
  hour:   "2-digit",
  minute: "2-digit",
});

export function formatDate(date: Date | string): string {
  return dateFormatter.format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return dateTimeFormatter.format(new Date(date));
}

// Map-lər object lookup-dan daha sürətlidir
const CATEGORY_LABELS = new Map([
  ["QANUNVERICILIK", "Qanunvericilik"],
  ["MANTIQ", "Məntiq"],
  ["AZERBAYCAN_DILI", "Azərbaycan Dili"],
  ["INFORMATIKA", "İnformatika"],
  ["DQ_QEBUL", "DQ Qəbul"],
]);

const ROLE_LABELS = new Map([
  ["USER", "İstifadəçi"],
  ["STUDENT", "Tələbə"],
  ["ADMIN", "Admin"],
]);

const FILE_TYPE_ICONS = new Map([
  ["PDF", "📄"],
  ["DOC", "📝"],
  ["DOCX", "📝"],
  ["VIDEO", "🎥"],
  ["MP4", "🎥"],
  ["PPT", "📊"],
  ["PPTX", "📊"],
]);

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS.get(category) ?? category;
}

export function getTypeLabel(type: string): string {
  return type === "SINAQ" ? "Sınaq" : "Test";
}

export function getVisibilityLabel(visibility: string): string {
  return visibility === "PUBLIC" ? "Açıq" : "Tələbələr üçün";
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS.get(role) ?? role;
}

export function getFileTypeIcon(fileType: string): string {
  return FILE_TYPE_ICONS.get(fileType.toUpperCase()) ?? "📁";
}

export function calculateScore(correct: number, timeBonus: number = 0): number {
  return correct * 10 + 5 + timeBonus;
}

export function getScoreColor(percentage: number): string {
  if (percentage >= 80) return "text-green-400";
  if (percentage >= 60) return "text-yellow-400";
  if (percentage >= 40) return "text-orange-400";
  return "text-red-400";
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// Regex-i bir dəfə compile et
const HTML_TAG_REGEX = /<[^>]*>/g;

export function stripHtml(html: string): string {
  return html.replace(HTML_TAG_REGEX, "");
}
