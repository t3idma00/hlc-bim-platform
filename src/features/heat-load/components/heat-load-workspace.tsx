"use client";

import { useState, useEffect } from "react";
import { type User } from "@supabase/supabase-js";
import { HeatLoadCanvasPanel } from "../../bim-model/view2D";
import { HeatLoad3DPanel } from "../../bim-model/view3D";
import { type WorkspaceView } from "../../bim-model/workspace-view-toggle";
import { HeatLoadFormPanel, initialFormValues, type FormValues } from "./form-panel";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/actions/auth";

export default function HeatLoadWorkspace() {
  const [formValues, setFormValues] = useState<FormValues>(initialFormValues);
  const [activeView, setActiveView] = useState<WorkspaceView>("2d");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to auth state
  useEffect(() => {
    const supabase = createClient();

    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    fetchUser();

    // Real-time auth listener
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleFieldChange = (name: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLogout = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fff4f6]">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#fff4f6] text-slate-900">
      <div className="flex h-screen w-full flex-col overflow-hidden">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-rose-100 bg-[#fffafb] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center bg-[#9f1239] text-lg font-semibold text-white">
              H
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#be123c]">HLC Platform</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">HVAC Design Studio</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <>
                <span className="text-sm text-slate-600 hidden md:block">
                  {user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-[#9f1239] hover:bg-rose-50 rounded-lg transition"
                >
                  Logout
                </button>
              </>
            )}

            <button className="border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-[#9f1239] hover:bg-rose-50 rounded-lg transition">
              Export
            </button>

            <button className="bg-[#be123c] px-5 py-2 text-sm font-semibold text-white hover:bg-[#9f1239] rounded-lg transition">
              Run Analysis
            </button>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[40%_60%]">
          <HeatLoadFormPanel 
            formValues={formValues} 
            onFieldChange={handleFieldChange} 
          />
          {activeView === "2d" ? (
            <HeatLoadCanvasPanel
              formValues={formValues}
              activeView={activeView}
              onViewChange={setActiveView}
            />
          ) : (
            <HeatLoad3DPanel
              formValues={formValues}
              activeView={activeView}
              onViewChange={setActiveView}
            />
          )}
        </main>

        <footer className="border-t border-rose-100 bg-[#fffafb] px-5 py-2 text-center text-xs text-rose-600">
          HLC Platform — Thesis Project
        </footer>
      </div>
    </div>
  );
}
