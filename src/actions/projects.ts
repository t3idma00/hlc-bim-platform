// app/actions/projects.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveProject(formData: FormData) {
  const projectName = formData.get("projectName") as string;
  const fullDataJson = formData.get("formValues") as string;

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
        data: parsedData,
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

// NEW: Update existing project (for multi-room)
export async function updateProject(formData: FormData) {
  const projectId = formData.get("projectId") as string;
  const projectName = formData.get("projectName") as string;
  const fullDataJson = formData.get("formValues") as string;

  if (!projectId || !fullDataJson) {
    return { error: "Missing project ID or data" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to update projects" };
  }

  try {
    const parsedData = JSON.parse(fullDataJson);

    const { error } = await supabase
      .from("projects")
      .update({
        name: projectName.trim() || "Untitled Project",
        data: parsedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Update project error:", error);
      return { error: "Failed to update project. Please try again." };
    }

    revalidatePath("/");
    return { 
      success: true, 
      message: "Project updated successfully!" 
    };

  } catch (err) {
    console.error("Update project error:", err);
    return { error: "Invalid data format" };
  }
}

export async function getUserProjects() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
    return [];
  }

  return data || [];
}