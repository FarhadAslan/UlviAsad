export type Role = "USER" | "STUDENT" | "TEACHER" | "ADMIN";
export type Category =
  | "QANUNVERICILIK"
  | "MANTIQ"
  | "AZERBAYCAN_DILI"
  | "INFORMATIKA"
  | "DQ_QEBUL";
export type QuizType = "SINAQ" | "TEST";
export type Visibility = "PUBLIC" | "STUDENT_ONLY";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  image?: string | null;
  active: boolean;
  createdAt: Date;
}

export interface Question {
  id: string;
  quizId: string;
  text: string;
  options: Option[];
  correctOption: string;
  order: number;
}

export interface Option {
  label: string;
  text: string;
}

export interface Quiz {
  id: string;
  title: string;
  category: Category;
  type: QuizType;
  duration?: number | null;
  visibility: Visibility;
  questions: Question[];
  results?: Result[];
  createdAt: Date;
  _count?: {
    questions: number;
    results: number;
  };
}

export interface Result {
  id: string;
  userId: string;
  user?: User;
  quizId: string;
  quiz?: Quiz;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  answers: Answer[];
  createdAt: Date;
}

export interface Answer {
  questionId: string;
  selected: string | null;
  isCorrect: boolean;
}

export interface Material {
  id: string;
  title: string;
  category: Category;
  fileUrl: string;
  fileType: string;
  visibility: Visibility;
  createdAt: Date;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  summary: string;
  createdAt: Date;
}

export interface Stats {
  totalQuizzes: number;
  totalMaterials: number;
  totalUsers: number;
  totalStudents: number;
}

export interface UserStats {
  totalQuizzes: number;
  averageScore: number;
  bestScore: number;
  totalPoints: number;
}
