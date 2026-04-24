import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("az-AZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("az-AZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    QANUNVERICILIK: "Qanunvericilik",
    MANTIQ: "Məntiq",
    AZERBAYCAN_DILI: "Azərbaycan Dili",
    INFORMATIKA: "İnformatika",
    DQ_QEBUL: "DQ Qəbul",
  };
  return labels[category] || category;
}

export function getTypeLabel(type: string): string {
  return type === "SINAQ" ? "Sınaq" : "Test";
}

export function getVisibilityLabel(visibility: string): string {
  return visibility === "PUBLIC" ? "Açıq" : "Tələbələr üçün";
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    USER: "İstifadəçi",
    STUDENT: "Tələbə",
    ADMIN: "Admin",
  };
  return labels[role] || role;
}

export function getFileTypeIcon(fileType: string): string {
  const icons: Record<string, string> = {
    PDF: "📄",
    DOC: "📝",
    DOCX: "📝",
    VIDEO: "🎥",
    MP4: "🎥",
    PPT: "📊",
    PPTX: "📊",
  };
  return icons[fileType.toUpperCase()] || "📁";
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

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}
