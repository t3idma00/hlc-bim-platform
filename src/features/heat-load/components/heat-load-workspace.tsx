"use client";

import { useState, useEffect } from "react";
import { type User } from "@supabase/supabase-js";
import { HeatLoadCanvasPanel } from "../../bim-model/view2D";
import { HeatLoad3DPanel } from "../../bim-model/view3D";
import { type WorkspaceView } from "../../bim-model/workspace-view-toggle";
import { HeatLoadFormPanel, initialFormValues, type FormValues } from "./form-panel";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/actions/auth";
import { saveProject, getUserProjects } from "@/actions/projects";
import type { Project, ProjectData } from "@/types";

export default function HeatLoadWorkspace() {
  const [projectData, setProjectData] = useState<ProjectData>({
    version: "1.1",
    lastSaved: new Date().toISOString(),
    formValues: initialFormValues,
    sheetValues: {},
  });

  const [activeView, setActiveView] = useState<WorkspaceView>("2d");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Save Modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // My Projects Modal
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState("");

  // Auth listener
  useEffect(() => {
    const supabase = createClient();

    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    fetchUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleFormChange = (name: string, value: string) => {
    setProjectData((prev) => ({
      ...prev,
      formValues: { ...prev.formValues, [name]: value },
    }));
  };

  const handleSheetChange = (name: string, value: string) => {
    setProjectData((prev) => ({
      ...prev,
      sheetValues: { ...prev.sheetValues, [name]: value },
      formValues: applySheetValueToFormValues(prev.formValues, name, value),
    }));
  };

  const handleLogout = async () => {
    await signOut();
  };

  const handleSaveProject = async () => {
    if (!projectName.trim()) {
      setSaveMessage({ type: "error", text: "Please enter a project name" });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    const dataToSave: ProjectData = {
      version: "1.1",
      lastSaved: new Date().toISOString(),
      formValues: projectData.formValues,
      sheetValues: projectData.sheetValues,
    };

    const formData = new FormData();
    formData.append("projectName", projectName.trim());
    formData.append("formValues", JSON.stringify(dataToSave));

    const result = await saveProject(formData);

    if (result.error) {
      setSaveMessage({ type: "error", text: result.error });
    } else {
      setSaveMessage({ type: "success", text: "Project saved successfully!" });
      setProjectName("");
      setTimeout(() => setShowSaveModal(false), 1800);
    }
    setSaving(false);
  };

  const loadMyProjects = async () => {
    if (loadingProjects) return;

    setLoadingProjects(true);
    setSaveMessage(null);

    try {
      const rawProjects = await getUserProjects();

      const mappedProjects: Project[] = rawProjects.map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        name: p.name,
        created_at: p.created_at,
        updated_at: p.updated_at,
        data: p.data || { version: "1.1", formValues: initialFormValues, sheetValues: {} },
      }));

      setProjects(mappedProjects);
      setShowProjectsModal(true);
    } catch (error) {
      console.error("Failed to load projects:", error);
      setSaveMessage({ type: "error", text: "Failed to load projects" });
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadProject = (project: Project) => {
    const saved = project.data || {};

    setProjectData({
      version: saved.version || "1.1",
      lastSaved: saved.lastSaved || new Date().toISOString(),
      formValues: saved.formValues || initialFormValues,
      sheetValues: saved.sheetValues || {},
    });

    setShowProjectsModal(false);
    setSaveMessage({ type: "success", text: `Loaded: ${project.name}` });
    setTimeout(() => setSaveMessage(null), 2500);
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;

    const supabase = createClient();
    const { error } = await supabase.from("projects").delete().eq("id", projectId);

    if (!error) {
      loadMyProjects();
    } else {
      alert("Failed to delete project");
    }
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setNewProjectName(project.name);
    setShowEditModal(true);
  };

  const handleUpdateProjectName = async () => {
    if (!editingProject || !newProjectName.trim()) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ name: newProjectName.trim() })
      .eq("id", editingProject.id);

    if (!error) {
      setShowEditModal(false);
      setEditingProject(null);
      loadMyProjects();
    } else {
      alert("Failed to update project name");
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[#fff4f6] text-slate-900">
      <div className="flex h-screen w-full flex-col overflow-hidden">
        <header className="flex flex-col gap-4 border-b border-rose-100 bg-[#fffafb] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center bg-[#9f1239] text-lg font-semibold text-white">H</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#be123c]">HLC Platform</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">HVAC Design Studio</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <>
                <span className="hidden text-sm text-slate-600 md:block">{user.email}</span>

                <button
                  onClick={() => setShowSaveModal(true)}
                  className="border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-[#9f1239] hover:bg-rose-50 rounded-lg transition"
                >
                  Save Project
                </button>

                <button
                  onClick={loadMyProjects}
                  disabled={loadingProjects}
                  className="border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-[#9f1239] hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                >
                  {loadingProjects ? "Loading..." : "My Projects"}
                </button>

                <button className="border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-[#9f1239] hover:bg-rose-50 rounded-lg transition">
                  Export
                </button>

                <button
                  onClick={handleLogout}
                  className="border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-[#9f1239] hover:bg-rose-50 rounded-lg transition"
                >
                  Logout
                </button>
              </>
            )}

            <button className="rounded-lg bg-[#be123c] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#9f1239]">
              Run Analysis
            </button>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[40%_60%]">
          <HeatLoadFormPanel
            formValues={projectData.formValues}
            sheetValues={projectData.sheetValues}
            onFieldChange={handleFormChange}
            onSheetChange={handleSheetChange}
          />

          {activeView === "2d" ? (
            <HeatLoadCanvasPanel
              formValues={projectData.formValues}
              activeView={activeView}
              onViewChange={setActiveView}
              onFieldChange={handleFormChange}
            />
          ) : (
            <HeatLoad3DPanel
              formValues={projectData.formValues}
              activeView={activeView}
              onViewChange={setActiveView}
            />
          )}
        </main>

        <footer className="border-t border-rose-100 bg-[#fffafb] px-5 py-2 text-center text-xs text-rose-600">
          HLC Platform - Thesis Project
        </footer>
      </div>

      {/* ====================== MODALS ====================== */}

      {/* Save Project Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-2xl font-semibold mb-2">Save Project</h2>
            <p className="text-slate-600 mb-6">Enter a name for your current project</p>
            <input
              type="text"
              placeholder="e.g. My First Room Test"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:border-[#be123c] mb-6"
              autoFocus
            />
            {saveMessage && (
              <p className={`text-center mb-4 text-sm font-medium ${saveMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                {saveMessage.text}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowSaveModal(false); setProjectName(""); setSaveMessage(null); }}
                className="flex-1 py-3 border border-slate-300 rounded-xl font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProject}
                disabled={saving || !projectName.trim()}
                className="flex-1 py-3 bg-[#be123c] text-white rounded-xl font-medium hover:bg-[#9f1239] disabled:bg-rose-300"
              >
                {saving ? "Saving..." : "Save Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Projects Modal */}
      {showProjectsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg mx-4 shadow-xl">
            <h2 className="text-2xl font-semibold mb-6">My Projects</h2>

            {loadingProjects ? (
              <p className="text-center py-12">Loading projects...</p>
            ) : projects.length === 0 ? (
              <p className="text-slate-500 text-center py-12">No projects saved yet.</p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-auto pr-2">
                {projects.map((project) => (
                  <div key={project.id} className="flex justify-between items-center p-4 border border-slate-200 rounded-xl hover:bg-slate-50 group">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{project.name}</p>
                      <p className="text-xs text-slate-500">
                        Updated: {new Date(project.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadProject(project)}
                        className="px-5 py-2 bg-[#be123c] text-white text-sm rounded-lg hover:bg-[#9f1239] transition"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => openEditModal(project)}
                        className="px-4 py-2 border border-slate-300 text-sm rounded-lg hover:bg-slate-50 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteProject(project.id)}
                        className="px-4 py-2 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button 
              onClick={() => setShowProjectsModal(false)} 
              className="mt-6 w-full py-3 border border-slate-300 rounded-xl font-medium hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Edit Project Name Modal */}
      {showEditModal && editingProject && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-2xl font-semibold mb-6">Edit Project Name</h2>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:border-[#be123c] mb-6"
              autoFocus
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setShowEditModal(false)} 
                className="flex-1 py-3 border border-slate-300 rounded-xl font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateProjectName} 
                className="flex-1 py-3 bg-[#be123c] text-white rounded-xl font-medium hover:bg-[#9f1239]}"
              >
                Update Name
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function applySheetValueToFormValues(
  formValues: FormValues,
  sheetKey: string,
  sheetValue: string
): FormValues {
  const wallFieldMap: Record<string, keyof FormValues> = {
    "1.1_type": "wallNorthType",
    "1.2_type": "wallEastType",
    "1.3_type": "wallSouthType",
    "1.4_type": "wallWestType",
    "1.1_thickness": "wallNorthWidth",
    "1.2_thickness": "wallEastWidth",
    "1.3_thickness": "wallSouthWidth",
    "1.4_thickness": "wallWestWidth",
  };

  const formField = wallFieldMap[sheetKey];

  if (!formField) {
    return formValues;
  }

  return {
    ...formValues,
    [formField]: sheetValue,
  };
}
