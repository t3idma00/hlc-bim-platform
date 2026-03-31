import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { HeatLoadWorkspace } from "@/features/heat-load";   // ← Named import

export default async function Home() {
  const supabase = await createClient();

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  return <HeatLoadWorkspace />;
}