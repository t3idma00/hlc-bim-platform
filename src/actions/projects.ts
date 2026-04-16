"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveProject(formData: FormData) {
  const projectName = formData.get("projectName") as string;
  const fullDataJson = formData.get("formValues") as string;   // This now contains the full ProjectData

  if (!projectName?.trim()) {
    return { error: "Project name is required" };
  }

  if (!fullDataJson) {
    return { error: "No form data to save" };
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to save projects" };
  }

  try {
    const parsedData = JSON.parse(fullDataJson);

    const { error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: projectName.trim(),
        data: parsedData,           // Save the full object (formValues + sheetValues)
      });

    if (error) {
      console.error("Save project error:", error);
      return { error: "Failed to save project. Please try again." };
    }

    revalidatePath("/");
    return { 
      success: true, 
      message: "Project saved successfully!" 
    };

  } catch (err) {
    console.error("Save project error:", err);
    return { error: "Invalid data format" };
  }
}

export async function getUserProjects() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("projects")
    .select("*")                    // Get everything including 'data'
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
    return [];
  }

  return data || [];
}