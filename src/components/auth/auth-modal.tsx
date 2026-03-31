"use client";

import { useState } from "react";
import { signUp, signIn, signInWithGoogle } from "@/actions/auth";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError("");

    const result = mode === "login" 
      ? await signIn(formData) 
      : await signUp(formData);

    setLoading(false);

    if (result?.error) {
      setError(result.error);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-slate-900">
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl"
          >
            ×
          </button>
        </div>

        <form action={handleSubmit} className="space-y-5">
          {mode === "signup" && (
            <input
              name="name"
              type="text"
              placeholder="Full Name"
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#be123c]"
            />
          )}

          <input
            name="email"
            type="email"
            placeholder="Email Address"
            required
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#be123c]"
          />

          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#be123c]"
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#be123c] text-white py-3 rounded-lg font-medium hover:bg-[#9f1239] disabled:opacity-70"
          >
            {loading ? "Processing..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-slate-400 text-sm">OR</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          onClick={signInWithGoogle}
          className="w-full border border-slate-300 hover:border-slate-400 py-3 rounded-lg flex items-center justify-center gap-3 font-medium"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>

        <p className="text-center text-sm text-slate-600 mt-6">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
            className="text-[#be123c] font-medium hover:underline"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}