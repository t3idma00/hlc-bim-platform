import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import HeatLoadWorkspace from "@/features/heat-load/components/heat-load-workspace";   

export default async function Home() {
  const supabase = await createClient();

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  return <HeatLoadWorkspace />;
}