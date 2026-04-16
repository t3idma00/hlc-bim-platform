"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  const router = useRouter();

  // Verify the recovery token from Supabase
  useEffect(() => {
    const verifyRecovery = async () => {
      const supabase = createClient();
      
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        setError("This reset link is invalid or has expired.");
        setTimeout(() => router.push("/login"), 3500);
        return;
      }

      setIsVerifying(false);
    };

    verifyRecovery();
  }, [router]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(error.message);
      } else {
        setSuccess("Password updated successfully! Redirecting to login...");
        setTimeout(() => router.push("/login"), 2000);
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[#fff4f6] flex items-center justify-center">
        <div className="text-center text-slate-600">Verifying reset link...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff4f6] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center bg-[#9f1239] text-white text-4xl font-bold rounded-2xl shadow-md">
            H
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900">
            Reset Password
          </h1>
          <p className="mt-2 text-slate-600">Enter your new password</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <form onSubmit={handleReset} className="space-y-5">
            <input
              type="password"
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:border-[#be123c]"
            />

            <input
              type="password"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:border-[#be123c]"
            />

            {error && <p className="text-red-600 text-sm text-center font-medium">{error}</p>}
            {success && <p className="text-green-600 text-sm text-center font-medium">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#be123c] hover:bg-[#9f1239] disabled:bg-rose-300 text-white font-semibold py-3.5 rounded-2xl transition-all"
            >
              {loading ? "Updating Password..." : "Update Password"}
            </button>
          </form>

          <div className="text-center mt-6">
            <button
              onClick={() => router.push("/login")}
              className="text-[#be123c] hover:underline text-sm"
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}