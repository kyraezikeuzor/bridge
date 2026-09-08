"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export type ToastKind = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  kind: ToastKind;
};

type ToastContextValue = {
  push: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, kind: ToastKind = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { id, message, kind }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex max-w-[min(100vw-3rem,420px)] flex-col items-end gap-2">
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  className={`pointer-events-auto flex w-fit items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg ${
                    toast.kind === "error"
                      ? "w-full rounded-xl border-2 border-red-600 bg-white px-5 py-4 text-base text-red-700 shadow-xl"
                      : toast.kind === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-border bg-background text-foreground"
                  }`}
                  role={toast.kind === "error" ? "alert" : "status"}
                >
                  {toast.kind === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : toast.kind === "error" ? (
                    <XCircle className="h-5 w-5 shrink-0" />
                  ) : null}
                  <span>{toast.message}</span>
                </div>
              ))}
      </div>
    </ToastContext.Provider>
  );
}
