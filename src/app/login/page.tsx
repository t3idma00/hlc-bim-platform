"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp, signInWithGoogle, resetPassword } from "@/actions/auth";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.push("/");
      }
    };
    checkSession();
  }, [router]);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      let result: any;

      if (mode === "login") {
        result = await signIn(formData);
      } else if (mode === "signup") {
        result = await signUp(formData);
      } else if (mode === "reset") {
        result = await resetPassword(formData);
      }

      // Safe handling of result
      if (result && typeof result === "object") {
        if ("error" in result && result.error) {
          setError(result.error);
        } else if ("success" in result && result.success) {
          const message = result.message || "Operation completed successfully";
          setSuccess(message);

          if (mode === "reset") {
            setTimeout(() => {
              setMode("login");
              setSuccess("");
            }, 2500);
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fff4f6] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center bg-[#9f1239] text-white text-4xl font-bold rounded-2xl shadow-md">
            H
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900">
            HLC BIM Platform
          </h1>
          <p className="mt-2 text-slate-600">Heat Load Calculation Studio</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-center mb-8 text-slate-900">
            {mode === "login" && "Sign In"}
            {mode === "signup" && "Create Account"}
            {mode === "reset" && "Reset Password"}
          </h2>

          <form action={handleSubmit} className="space-y-5">
            {mode === "signup" && (
              <input
                name="name"
                type="text"
                placeholder="Full Name"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:border-[#be123c]"
              />
            )}

            <input
              name="email"
              type="email"
              placeholder="Email Address"
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:border-[#be123c]"
            />

            {mode !== "reset" && (
              <input
                name="password"
                type="password"
                placeholder="Password"
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:border-[#be123c]"
              />
            )}

            {error && <p className="text-red-600 text-sm text-center font-medium">{error}</p>}
            {success && <p className="text-green-600 text-sm text-center font-medium">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#be123c] hover:bg-[#9f1239] disabled:bg-rose-300 text-white font-semibold py-3.5 rounded-2xl transition-all"
            >
              {loading 
                ? "Processing..." 
                : mode === "login" 
                  ? "Sign In" 
                  : mode === "signup" 
                    ? "Create Account" 
                    : "Send Reset Link"
              }
            </button>
          </form>

          {/* Google Sign In */}
          <div className="my-6">
            <button
              onClick={signInWithGoogle}
              className="w-full border border-slate-300 hover:bg-slate-50 py-3.5 rounded-2xl flex items-center justify-center gap-3 font-medium transition"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              Continue with Google
            </button>
          </div>

          {/* Toggle Links */}
          <div className="text-center text-sm text-slate-600 space-y-2">
            {mode === "login" && (
              <>
                Don't have an account?{" "}
                <button 
                  onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
                  className="text-[#be123c] font-medium hover:underline"
                >
                  Sign up
                </button>
                <br />
                <button 
                  onClick={() => { setMode("reset"); setError(""); setSuccess(""); }}
                  className="text-[#be123c] hover:underline"
                >
                  Forgot Password?
                </button>
              </>
            )}

            {(mode === "signup" || mode === "reset") && (
              <button 
                onClick={() => { 
                  setMode("login"); 
                  setError(""); 
                  setSuccess(""); 
                }} 
                className="text-[#be123c] font-medium hover:underline"
              >
                ← Back to Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}