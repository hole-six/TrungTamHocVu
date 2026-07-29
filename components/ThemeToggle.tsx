"use client";

import { useTheme } from "./ThemeProvider";
import { useEffect, useState } from "react";

type ThemeToggleVariant = "button" | "dropdown" | "icon";

type ThemeToggleProps = {
  variant?: ThemeToggleVariant;
  className?: string;
};

export default function ThemeToggle({ variant = "button", className = "" }: ThemeToggleProps) {
  const { theme, actualTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`h-9 w-9 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700 ${className}`} />
    );
  }

  if (variant === "icon") {
    return (
      <button
        onClick={() => setTheme(actualTheme === "light" ? "dark" : "light")}
        className={`btn-icon group relative ${className}`}
        aria-label={`Chuyển sang chế độ ${actualTheme === "light" ? "tối" : "sáng"}`}
        title={`Chuyển sang chế độ ${actualTheme === "light" ? "tối" : "sáng"}`}
      >
        {/* Sun icon (light mode) */}
        <svg
          className={`h-5 w-5 transition-all duration-300 ${
            actualTheme === "light" ? "rotate-0 scale-100" : "rotate-90 scale-0 absolute"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
        </svg>

        {/* Moon icon (dark mode) */}
        <svg
          className={`h-5 w-5 transition-all duration-300 ${
            actualTheme === "dark" ? "rotate-0 scale-100" : "-rotate-90 scale-0 absolute"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </button>
    );
  }

  if (variant === "dropdown") {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest(".theme-dropdown")) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener("click", handleClickOutside);
      }

      return () => document.removeEventListener("click", handleClickOutside);
    }, [isOpen]);

    return (
      <div className={`theme-dropdown relative ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="btn-ghost-sm flex items-center gap-2"
        >
          {actualTheme === "light" ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
          <span className="text-xs font-medium">
            {theme === "light" ? "Sáng" : theme === "dark" ? "Tối" : "Hệ thống"}
          </span>
          <svg
            className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {isOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-40 rounded-xl border shadow-lg z-50"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-primary)",
            }}
          >
            <div className="p-1">
              <button
                onClick={() => {
                  setTheme("light");
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  theme === "light"
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
                </svg>
                <span>Sáng</span>
                {theme === "light" && (
                  <svg className="ml-auto h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => {
                  setTheme("dark");
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  theme === "dark"
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                <span>Tối</span>
                {theme === "dark" && (
                  <svg className="ml-auto h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => {
                  setTheme("system");
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  theme === "system"
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8m-4-4v4" />
                </svg>
                <span>Hệ thống</span>
                {theme === "system" && (
                  <svg className="ml-auto h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default button variant - toggle between light/dark
  return (
    <button
      onClick={() => setTheme(actualTheme === "light" ? "dark" : "light")}
      className={`btn-ghost-sm flex items-center gap-2 ${className}`}
    >
      {actualTheme === "light" ? (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
          </svg>
          <span className="text-xs font-medium">Chế độ sáng</span>
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
          <span className="text-xs font-medium">Chế độ tối</span>
        </>
      )}
    </button>
  );
}
