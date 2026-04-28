"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { ArrowRight, BookOpen, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ── Reusable field ────────────────────────────────────────────────────────────
export function AuthField({
  icon,
  type,
  value,
  onChange,
  placeholder,
  name,
  required,
  rightElement,
}: {
  icon: React.ElementType;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  name?: string;
  required?: boolean;
  rightElement?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const Icon = icon;

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="relative"
    >
      <div className="relative flex items-center overflow-hidden rounded-xl">
        <Icon
          size={15}
          className={cn(
            "absolute left-3 transition-all duration-300 z-10",
            focused ? "text-[rgb(147,204,255)]" : "text-white/30"
          )}
        />
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn(
            "w-full h-10 pl-9 pr-10 text-sm text-white placeholder:text-white/30",
            "rounded-xl border transition-all duration-300 outline-none",
            focused
              ? "border-[rgba(147,204,255,0.5)] shadow-[0_0_0_3px_rgba(147,204,255,0.1)]"
              : "border-white/8 hover:border-white/15"
          )}
          style={{
            background: focused ? "rgba(147,204,255,0.08)" : "rgba(255,255,255,0.05)",
            caretColor: "rgb(147,204,255)",
          }}
        />
        {rightElement && (
          <div className="absolute right-3 z-10">{rightElement}</div>
        )}
        {focused && (
          <motion.div
            layoutId={`field-glow-${name}`}
            className="absolute inset-0 rounded-xl -z-10"
            style={{ background: "rgba(147,204,255,0.04)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </div>
    </motion.div>
  );
}

// ── Auth Card ─────────────────────────────────────────────────────────────────
interface AuthCardProps {
  mode: "login" | "register";
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export function AuthCard({ mode, onSubmit, loading, children, title, subtitle }: AuthCardProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [10, -10]);
  const rotateY = useTransform(mouseX, [-300, 300], [-10, 10]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };
  const handleMouseLeave = () => { mouseX.set(0); mouseY.set(0); };

  // Traveling beam color — primary blue
  const beam = "bg-gradient-to-r from-transparent via-[rgb(147,204,255)] to-transparent";
  const beamV = "bg-gradient-to-b from-transparent via-[rgb(147,204,255)] to-transparent";

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(160deg,#0d2137 0%,#0a3d2e 100%)" }}
    >
      {/* Background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120vh] h-[60vh] rounded-b-[50%] blur-[80px] pointer-events-none"
        style={{ background: "rgba(147,204,255,0.07)" }} />
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[100vh] h-[60vh] rounded-b-full blur-[60px] pointer-events-none"
        style={{ background: "rgba(31,111,67,0.12)" }}
        animate={{ opacity: [0.5, 0.9, 0.5], scale: [0.98, 1.02, 0.98] }}
        transition={{ duration: 8, repeat: Infinity, repeatType: "mirror" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[90vh] h-[90vh] rounded-t-full blur-[60px] pointer-events-none"
        style={{ background: "rgba(147,204,255,0.05)" }}
        animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.1, 1] }}
        transition={{ duration: 6, repeat: Infinity, repeatType: "mirror", delay: 1 }}
      />

      {/* Grid */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(147,204,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(147,204,255,1) 1px,transparent 1px)",
          backgroundSize: "50px 50px",
        }} />

      {/* Back button */}
      <div className="absolute top-5 left-5 z-20">
        <Link href="/"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200"
          style={{
            background: "rgba(147,204,255,0.08)",
            color: "rgba(147,204,255,0.8)",
            border: "1px solid rgba(147,204,255,0.15)",
          }}>
          <ArrowLeft size={14} />
          Ana Səhifə
        </Link>
      </div>

      {/* 3D Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-sm relative z-10 px-4"
        style={{ perspective: 1500 }}
      >
        <motion.div
          className="relative"
          style={{ rotateX, rotateY }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          whileHover={{ z: 10 }}
        >
          <div className="relative group">

            {/* Card ambient glow */}
            <motion.div
              className="absolute -inset-[1px] rounded-2xl"
              animate={{
                boxShadow: [
                  "0 0 12px 2px rgba(147,204,255,0.06)",
                  "0 0 20px 6px rgba(147,204,255,0.12)",
                  "0 0 12px 2px rgba(147,204,255,0.06)",
                ],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatType: "mirror" }}
            />

            {/* Traveling border beams */}
            <div className="absolute -inset-[1px] rounded-2xl overflow-hidden pointer-events-none">
              {/* Top */}
              <motion.div
                className={`absolute top-0 left-0 h-[2px] w-[50%] ${beam} opacity-70`}
                animate={{ left: ["-50%", "100%"], opacity: [0.3, 0.8, 0.3] }}
                transition={{ left: { duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 }, opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror" } }}
              />
              {/* Right */}
              <motion.div
                className={`absolute top-0 right-0 h-[50%] w-[2px] ${beamV} opacity-70`}
                animate={{ top: ["-50%", "100%"], opacity: [0.3, 0.8, 0.3] }}
                transition={{ top: { duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1, delay: 0.6 }, opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror", delay: 0.6 } }}
              />
              {/* Bottom */}
              <motion.div
                className={`absolute bottom-0 right-0 h-[2px] w-[50%] ${beam} opacity-70`}
                animate={{ right: ["-50%", "100%"], opacity: [0.3, 0.8, 0.3] }}
                transition={{ right: { duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1, delay: 1.2 }, opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror", delay: 1.2 } }}
              />
              {/* Left */}
              <motion.div
                className={`absolute bottom-0 left-0 h-[50%] w-[2px] ${beamV} opacity-70`}
                animate={{ bottom: ["-50%", "100%"], opacity: [0.3, 0.8, 0.3] }}
                transition={{ bottom: { duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1, delay: 1.8 }, opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror", delay: 1.8 } }}
              />

              {/* Corner dots */}
              {[
                "top-0 left-0", "top-0 right-0",
                "bottom-0 left-0", "bottom-0 right-0",
              ].map((pos, i) => (
                <motion.div
                  key={i}
                  className={`absolute ${pos} w-[6px] h-[6px] rounded-full blur-[1px]`}
                  style={{ background: "rgb(147,204,255)" }}
                  animate={{ opacity: [0.2, 0.6, 0.2] }}
                  transition={{ duration: 2 + i * 0.3, repeat: Infinity, repeatType: "mirror", delay: i * 0.4 }}
                />
              ))}
            </div>

            {/* Hover border gradient */}
            <div className="absolute -inset-[0.5px] rounded-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-500"
              style={{ background: "linear-gradient(135deg,rgba(147,204,255,0.15),rgba(31,111,67,0.15),rgba(147,204,255,0.15))" }} />

            {/* Glass card */}
            <div
              className="relative rounded-2xl p-6 overflow-hidden"
              style={{
                background: "rgba(13,33,55,0.85)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(147,204,255,0.1)",
                boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
              }}
            >
              {/* Inner grid pattern */}
              <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
                style={{
                  backgroundImage: "linear-gradient(135deg,rgba(147,204,255,1) 0.5px,transparent 0.5px),linear-gradient(45deg,rgba(147,204,255,1) 0.5px,transparent 0.5px)",
                  backgroundSize: "28px 28px",
                }} />

              {/* Logo + header */}
              <div className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", duration: 0.8 }}
                  className="mx-auto w-11 h-11 rounded-xl flex items-center justify-center mb-3 relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg,#1f6f43,#2e8b57)",
                    border: "1px solid rgba(147,204,255,0.2)",
                    boxShadow: "0 0 20px rgba(31,111,67,0.4)",
                  }}
                >
                  <BookOpen size={20} className="text-white" />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl font-bold"
                  style={{
                    background: "linear-gradient(to bottom,#ffffff,rgba(255,255,255,0.8))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {title}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-xs mt-0.5"
                  style={{ color: "rgba(147,204,255,0.5)" }}
                >
                  {subtitle}
                </motion.p>
              </div>

              {/* Form */}
              <form onSubmit={onSubmit} className="space-y-3">
                {children}

                {/* Submit button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full relative group/btn mt-2"
                >
                  <div className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover/btn:opacity-50 transition-opacity duration-300"
                    style={{ background: "linear-gradient(135deg,#1f6f43,#2e8b57)" }} />
                  <div
                    className="relative h-10 rounded-xl flex items-center justify-center font-semibold text-sm text-white overflow-hidden transition-all duration-300"
                    style={{ background: "linear-gradient(135deg,#1f6f43 0%,#2e8b57 100%)" }}
                  >
                    {/* Shimmer on loading */}
                    <motion.div
                      className="absolute inset-0"
                      style={{
                        background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)",
                        opacity: loading ? 1 : 0,
                      }}
                      animate={loading ? { x: ["-100%", "100%"] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <AnimatePresence mode="wait">
                      {loading ? (
                        <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </motion.div>
                      ) : (
                        <motion.span key="txt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="flex items-center gap-1.5">
                          {mode === "login" ? "Daxil ol" : "Qeydiyyat"}
                          <ArrowRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform duration-300" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.button>
              </form>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
