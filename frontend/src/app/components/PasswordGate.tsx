"use client";
import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "lifedata_auth";
const CORRECT = "intb-behoerdenansprache";

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUnlocked(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    if (unlocked === false) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [unlocked]);

  function submit() {
    if (input === CORRECT) {
      localStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
    } else {
      setError(true);
      setShaking(true);
      setInput("");
      setTimeout(() => setShaking(false), 500);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  if (unlocked === null) return null;
  if (unlocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-[color:var(--foreground)]">ABH Index</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">Bitte Passwort eingeben, um fortzufahren.</p>
        </div>

        <div className={`rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm ${shaking ? "animate-shake" : ""}`}>
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="pw" className="mb-1.5 block text-sm font-medium text-[color:var(--muted-strong)]">
                Passwort
              </label>
              <input
                ref={inputRef}
                id="pw"
                type="password"
                value={input}
                onChange={e => { setInput(e.target.value); setError(false); }}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder="••••••••••••••••••••••"
                autoComplete="current-password"
                className={`h-10 w-full rounded-md border bg-[color:var(--surface)] px-3 text-sm text-[color:var(--foreground)] shadow-sm outline-none transition-colors placeholder:text-[color:var(--muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] ${
                  error
                    ? "border-red-400 focus-visible:border-red-400 dark:border-red-600"
                    : "border-[color:var(--border-strong)] focus-visible:border-[color:var(--border-strong)]"
                }`}
              />
              {error && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">Falsches Passwort. Bitte erneut versuchen.</p>
              )}
            </div>

            <button
              onClick={submit}
              className="h-10 w-full rounded-md bg-[color:var(--foreground)] text-sm font-semibold text-[color:var(--background)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
            >
              Einloggen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
