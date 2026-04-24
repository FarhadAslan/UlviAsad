"use client";

import React, {
  useState, useEffect, createContext,
  useContext, useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CircleCheck, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type ToastType     = "success" | "error" | "warning" | "info";
type ToastPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, position?: ToastPosition) => void;
  success: (message: string, position?: ToastPosition) => void;
  error:   (message: string, position?: ToastPosition) => void;
  warning: (message: string, position?: ToastPosition) => void;
  info:    (message: string, position?: ToastPosition) => void;
}

// ── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts,    setToasts]    = useState<{ toast: Toast; position: ToastPosition }[]>([]);
  const [mounted,   setMounted]   = useState(false);

  useEffect(() => setMounted(true), []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", position: ToastPosition = "top-right") => {
      const id = Date.now();
      setToasts((prev) => [...prev, { toast: { id, message, type }, position }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter(({ toast }) => toast.id !== id));
      }, 4500);
    },
    []
  );

  const success = useCallback((m: string, p?: ToastPosition) => showToast(m, "success", p), [showToast]);
  const error   = useCallback((m: string, p?: ToastPosition) => showToast(m, "error",   p), [showToast]);
  const warning = useCallback((m: string, p?: ToastPosition) => showToast(m, "warning", p), [showToast]);
  const info    = useCallback((m: string, p?: ToastPosition) => showToast(m, "info",    p), [showToast]);

  if (!mounted) return <>{children}</>;

  const positions: ToastPosition[] = [
    "top-left", "top-right", "bottom-left", "bottom-right", "center",
  ];

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      {positions.map((pos) => (
        <ToastContainer
          key={pos}
          toasts={toasts.filter((t) => t.position === pos)}
          position={pos}
          onDismiss={(id) =>
            setToasts((prev) => prev.filter(({ toast }) => toast.id !== id))
          }
        />
      ))}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};

// ── Container ────────────────────────────────────────────────────────────────
interface ContainerProps {
  toasts: { toast: Toast; position: ToastPosition }[];
  position: ToastPosition;
  onDismiss: (id: number) => void;
}

const positionClasses: Record<string, string> = {
  "top-left":     "top-4 left-4",
  "top-right":    "top-4 right-4",
  "bottom-left":  "bottom-4 left-4",
  "bottom-right": "bottom-4 right-4",
  "center":       "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
};

const ToastContainer: React.FC<ContainerProps> = ({ toasts, position, onDismiss }) => {
  const isTop = position.startsWith("top") || position === "center";

  return (
    <div
      className={`fixed z-[9999] ${positionClasses[position]} w-full max-w-sm px-4 sm:px-0 space-y-2 pointer-events-none`}
    >
      <AnimatePresence>
        {toasts.map(({ toast }) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: isTop ? -20 : 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{   opacity: 0, y: isTop ? -16 : 16, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="pointer-events-auto"
          >
            <ToastItem toast={toast} onDismiss={onDismiss} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// ── Single toast ─────────────────────────────────────────────────────────────
const config: Record<ToastType, {
  icon: React.ElementType;
  iconColor: string;
  border: string;
  bg: string;
  bar: string;
}> = {
  success: {
    icon: CircleCheck,
    iconColor: "#4ade80",
    border: "rgba(74,222,128,0.25)",
    bg:     "rgba(7,16,32,0.92)",
    bar:    "#4ade80",
  },
  error: {
    icon: AlertCircle,
    iconColor: "#f87171",
    border: "rgba(248,113,113,0.25)",
    bg:     "rgba(7,16,32,0.92)",
    bar:    "#f87171",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "#fbbf24",
    border: "rgba(251,191,36,0.25)",
    bg:     "rgba(7,16,32,0.92)",
    bar:    "#fbbf24",
  },
  info: {
    icon: Info,
    iconColor: "#7dbeff",
    border: "rgba(125,190,255,0.25)",
    bg:     "rgba(7,16,32,0.92)",
    bar:    "#7dbeff",
  },
};

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: number) => void }> = ({
  toast, onDismiss,
}) => {
  const { icon: Icon, iconColor, border, bg, bar } = config[toast.type];

  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-2xl flex items-start gap-3 px-4 py-3.5"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        backdropFilter: "blur(16px)",
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${border}`,
        minWidth: "280px",
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
        style={{ background: bar }}
      />

      {/* Icon */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
        style={{ background: `${iconColor}18`, border: `1px solid ${iconColor}30` }}
      >
        <Icon size={16} style={{ color: iconColor }} />
      </div>

      {/* Message */}
      <p className="flex-1 text-sm font-medium leading-snug pt-1" style={{ color: "#e0f0ff" }}>
        {toast.message}
      </p>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 mt-0.5 rounded-md p-1 transition-colors"
        style={{ color: "#4a7a9b" }}
      >
        <X size={14} />
      </button>

      {/* Progress bar */}
      <motion.div
        className="absolute bottom-0 left-0 h-[2px]"
        style={{ background: bar, opacity: 0.5 }}
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: 4.5, ease: "linear" }}
      />
    </div>
  );
};
