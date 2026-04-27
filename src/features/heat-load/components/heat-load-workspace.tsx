"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { type User } from "@supabase/supabase-js";
import { HeatLoadCanvasPanel } from "../../bim-model/view2D";
import { HeatLoad3DPanel } from "../../bim-model/view3D";
import { type WorkspaceView } from "../../bim-model/workspace-view-toggle";
import { HeatLoadFormPanel, initialFormValues, type FormValues } from "./form-panel";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/actions/auth";
import { saveProject, getUserProjects } from "@/actions/projects";
import type { Project, ProjectData, RoomWall } from "@/types";

const ROOM_WALLS: RoomWall[] = ["North", "East", "South", "West"];

const OPPOSITE_ROOM_WALL: Record<RoomWall, RoomWall> = {
  North: "South",
  East: "West",
  South: "North",
  West: "East",
};

export default function HeatLoadWorkspace() {
  const [projectData, setProjectData] = useState<ProjectData>({
    version: "1.2",
    lastSaved: new Date().toISOString(),
    rooms: [
      {
        id: "room-1",
        name: "Room 1",
        formValues: initialFormValues,
        sheetValues: {},
        placement: { x: 0, y: 0, rotation: 0 },
      }
    ],
  });

  const [activeRoomId, setActiveRoomId] = useState<string>("room-1");

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

  // Add Room Modal
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [addRoomTargetRoomId, setAddRoomTargetRoomId] = useState("room-1");
  const [addRoomTargetWall, setAddRoomTargetWall] = useState<RoomWall>("East");
  const [addRoomOffset, setAddRoomOffset] = useState("0");

  // Edit Modal
  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState("");

  // Resize Logic
  const [leftWidthPercent, setLeftWidthPercent] = useState(40);
  const containerRef = useRef<HTMLElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(() => setIsDragging(true), []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
      if (newPercent > 20 && newPercent < 80) {
        setLeftWidthPercent(newPercent);
      }
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    };
  }, [isDragging]);

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
      rooms: prev.rooms.map((room) =>
        room.id === activeRoomId
          ? { ...room, formValues: { ...room.formValues, [name]: value } }
          : room
      ),
    }));
  };

  const handleSheetChange = (name: string, value: string) => {
    setProjectData((prev) => ({
      ...prev,
      rooms: prev.rooms.map((room) => {
        if (room.id === activeRoomId) {
          return {
            ...room,
            sheetValues: { ...room.sheetValues, [name]: value },
            formValues: applySheetValueToFormValues(room.formValues, name, value),
          };
        }
        return room;
      }),
    }));
  };

  const handleAddRoom = () => {
    const placedRooms = resolveRoomPlacements(projectData.rooms);
    const defaultTargetRoom = placedRooms.find((room) => room.id === activeRoomId) ?? placedRooms.at(-1);

    if (defaultTargetRoom) {
      setAddRoomTargetRoomId(defaultTargetRoom.id);
    }

    setAddRoomTargetWall("East");
    setAddRoomOffset("0");
    setShowAddRoomModal(true);
  };

  const handleConfirmAddRoom = () => {
    const newRoomId = `room-${Date.now()}`;
    const newRoomName = `Room ${projectData.rooms.length + 1}`;
    const placedRooms = resolveRoomPlacements(projectData.rooms);
    const targetRoom =
      placedRooms.find((room) => room.id === addRoomTargetRoomId) ?? placedRooms.at(-1);
    const ownWall = OPPOSITE_ROOM_WALL[addRoomTargetWall];
    const offsetMeters = parseSignedRoomNumber(addRoomOffset);

    setProjectData((prev) => ({
      ...prev,
      rooms: [
        ...prev.rooms,
        {
          id: newRoomId,
          name: newRoomName,
          formValues: createRoomFormValuesForSharedWall(
            targetRoom?.formValues,
            addRoomTargetWall
          ),
          sheetValues: {},
          placement: {
            x: 0,
            y: 0,
            rotation: 0,
            attachToRoomId: targetRoom?.id,
            targetWall: addRoomTargetWall,
            ownWall,
            targetAnchor: addRoomTargetWall,
            ownAnchor: ownWall,
            offsetMeters,
          },
        },
      ],
    }));
    setActiveRoomId(newRoomId);
    setShowAddRoomModal(false);
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
      version: "1.2",
      lastSaved: new Date().toISOString(),
      rooms: resolveRoomPlacements(projectData.rooms),
      formValues: projectData.rooms[0].formValues,
      sheetValues: projectData.rooms[0].sheetValues,
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

    let rooms = saved.rooms;
    if (!rooms || rooms.length === 0) {
      rooms = [
        {
          id: "room-1",
          name: "Room 1",
          formValues: saved.formValues || initialFormValues,
          sheetValues: saved.sheetValues || {},
        },
      ];
    }

    setProjectData({
      version: "1.2",
      lastSaved: saved.lastSaved || new Date().toISOString(),
      rooms: resolveRoomPlacements(rooms),
    });
    setActiveRoomId(rooms[0].id);

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

  const placedRooms = resolveRoomPlacements(projectData.rooms);

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

        <main ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden relative">
          {/* Left Panel */}
          <div style={{ width: `${leftWidthPercent}%` }} className="flex-shrink-0 flex flex-col h-full overflow-hidden">
            {/* Room Tabs */}
            <div className="flex border-b border-rose-200 bg-[#fff8fa] overflow-x-auto min-h-[40px] items-end px-2">
              {projectData.rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setActiveRoomId(room.id)}
                  className={`px-4 py-2 text-[10px] font-bold uppercase tracking-[0.05em] whitespace-nowrap transition-all rounded-t-lg -mb-px ${
                    activeRoomId === room.id
                      ? "bg-white text-[#9f1239] border border-b-0 border-rose-200 shadow-[0_-2px_4px_rgba(0,0,0,0.02)]"
                      : "text-slate-500 hover:text-slate-800 hover:bg-rose-50 border border-transparent"
                  }`}
                >
                  {room.name}
                </button>
              ))}
              <button
              
                onClick={handleAddRoom}
                className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.05em] text-rose-600 hover:bg-rose-50 hover:text-rose-800 whitespace-nowrap transition-colors rounded-t-lg border border-transparent"
              >
                + Add Room
              </button>
            </div>

            <HeatLoadFormPanel
              formValues={projectData.rooms.find((r) => r.id === activeRoomId)?.formValues || initialFormValues}
              sheetValues={projectData.rooms.find((r) => r.id === activeRoomId)?.sheetValues || {}}
              onFieldChange={handleFormChange}
              onSheetChange={handleSheetChange}
            />
          </div>

          {/* Draggable Divider */}
          <div
            onMouseDown={handleMouseDown}
            className="w-2 cursor-ew-resize bg-rose-100 hover:bg-[#be123c] active:bg-[#9f1239] transition-colors z-10 flex-shrink-0 flex flex-col items-center justify-center group shadow-sm"
            title="Drag to resize panels"
          >
            <div className="h-8 w-[2px] bg-rose-400 group-hover:bg-white rounded-full"></div>
          </div>

          {/* Right Panel */}
          <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
            {activeView === "2d" ? (
              <HeatLoadCanvasPanel
                formValues={projectData.rooms.find((r) => r.id === activeRoomId)?.formValues || initialFormValues}
                rooms={placedRooms}
                activeRoomId={activeRoomId}
                activeView={activeView}
                onViewChange={setActiveView}
                onFieldChange={handleFormChange}
              />
            ) : (
              <HeatLoad3DPanel
                formValues={projectData.rooms.find((r) => r.id === activeRoomId)?.formValues || initialFormValues}
                sheetValues={projectData.rooms.find((r) => r.id === activeRoomId)?.sheetValues || {}}
                activeView={activeView}
                onViewChange={setActiveView}
              />
            )}
          </div>
        </main>

        <footer className="border-t border-rose-100 bg-[#fffafb] px-5 py-2 text-center text-xs text-rose-600">
          HLC Platform - Thesis Project
        </footer>
      </div>

      {/* ====================== MODALS ====================== */}

      {/* Add Room Modal */}
      {showAddRoomModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-2xl font-semibold mb-2">Add Room</h2>
            <p className="text-slate-600 mb-6">Select which wall this room should share.</p>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Attach to</span>
                <select
                  value={addRoomTargetRoomId}
                  onChange={(event) => setAddRoomTargetRoomId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#be123c]"
                >
                  {placedRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Shared wall on existing room</span>
                <select
                  value={addRoomTargetWall}
                  onChange={(event) => setAddRoomTargetWall(event.target.value as RoomWall)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#be123c]"
                >
                  {ROOM_WALLS.map((wall) => (
                    <option key={wall} value={wall}>
                      {wall}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-slate-700">
                New room shared wall:{" "}
                <span className="font-semibold text-[#9f1239]">
                  {OPPOSITE_ROOM_WALL[addRoomTargetWall]}
                </span>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Offset along wall (m)</span>
                <input
                  type="text"
                  value={addRoomOffset}
                  onChange={(event) => setAddRoomOffset(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#be123c]"
                />
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowAddRoomModal(false)}
                className="flex-1 py-3 border border-slate-300 rounded-xl font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAddRoom}
                className="flex-1 py-3 bg-[#be123c] text-white rounded-xl font-medium hover:bg-[#9f1239]"
              >
                Add Room
              </button>
            </div>
          </div>
        </div>
      )}

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

function resolveRoomPlacements(rooms: ProjectData["rooms"]): ProjectData["rooms"] {
  const placedRooms: ProjectData["rooms"] = [];
  let cursorX = 0;

  rooms.forEach((room, index) => {
    if (index === 0 || !room.placement?.attachToRoomId) {
      const placement = {
        x: room.placement?.x ?? cursorX,
        y: room.placement?.y ?? 0,
        rotation: room.placement?.rotation ?? 0,
        attachToRoomId: room.placement?.attachToRoomId,
        targetWall: getPlacementWall(room.placement?.targetWall ?? room.placement?.targetAnchor),
        ownWall: getPlacementWall(room.placement?.ownWall ?? room.placement?.ownAnchor),
        targetAnchor: room.placement?.targetAnchor,
        ownAnchor: room.placement?.ownAnchor,
        offsetMeters: room.placement?.offsetMeters,
      };

      placedRooms.push({
        ...room,
        placement,
      });
      cursorX = Math.max(
        cursorX,
        placement.x + getRoomPlanWidth(room.formValues) + getRoomPlanWallThickness(room.formValues, "East")
      );
      return;
    }

    const previousRoom = placedRooms[index - 1];
    const targetRoom =
      placedRooms.find((placedRoom) => placedRoom.id === room.placement?.attachToRoomId) ??
      previousRoom;
    const targetWall = getPlacementWall(
      room.placement?.targetWall ?? room.placement?.targetAnchor,
      "East"
    );
    const ownWall = getPlacementWall(
      room.placement?.ownWall ?? room.placement?.ownAnchor,
      OPPOSITE_ROOM_WALL[targetWall]
    );
    const offsetMeters = Number.isFinite(room.placement?.offsetMeters)
      ? room.placement?.offsetMeters ?? 0
      : 0;
    const attachedPosition = targetRoom
      ? getAttachedRoomPosition(targetRoom, room.formValues, targetWall, offsetMeters)
      : { x: cursorX, y: 0 };
    const placement = {
      ...(room.placement ?? {}),
      x: attachedPosition.x,
      y: attachedPosition.y,
      rotation: room.placement?.rotation ?? 0,
      attachToRoomId: targetRoom?.id,
      targetWall,
      ownWall,
      targetAnchor: targetWall,
      ownAnchor: ownWall,
      offsetMeters,
    };

    placedRooms.push({
      ...room,
      placement,
    });
    cursorX = Math.max(
      cursorX,
      placement.x + getRoomPlanWidth(room.formValues) + getRoomPlanWallThickness(room.formValues, "East")
    );
  });

  return placedRooms;
}

function getRoomPlanWidth(formValues: FormValues | undefined) {
  if (!formValues) {
    return 6;
  }

  const north = parsePositiveRoomNumber(formValues.wallNorthLength);
  const south = parsePositiveRoomNumber(formValues.wallSouthLength);

  return Math.max(north, south, 5);
}

function getRoomPlanDepth(formValues: FormValues | undefined) {
  if (!formValues) {
    return 6;
  }

  const east = parsePositiveRoomNumber(formValues.wallEastLength);
  const west = parsePositiveRoomNumber(formValues.wallWestLength);

  return Math.max(east, west, 5);
}

function getRoomPlanWallThickness(formValues: FormValues | undefined, wall: RoomWall) {
  return parseWallThicknessMeters(formValues?.[getWallWidthFieldName(wall)], 0.2);
}

function getAttachedRoomPosition(
  targetRoom: ProjectData["rooms"][number],
  formValues: FormValues,
  targetWall: RoomWall,
  offsetMeters: number
) {
  const targetPlacement = targetRoom.placement ?? { x: 0, y: 0 };
  const targetWidth = getRoomPlanWidth(targetRoom.formValues);
  const targetDepth = getRoomPlanDepth(targetRoom.formValues);
  const targetWallThickness = getRoomPlanWallThickness(targetRoom.formValues, targetWall);
  const roomWidth = getRoomPlanWidth(formValues);
  const roomDepth = getRoomPlanDepth(formValues);

  switch (targetWall) {
    case "North":
      return {
        x: targetPlacement.x + offsetMeters,
        y: targetPlacement.y - targetWallThickness - roomDepth,
      };
    case "East":
      return {
        x: targetPlacement.x + targetWidth + targetWallThickness,
        y: targetPlacement.y + offsetMeters,
      };
    case "South":
      return {
        x: targetPlacement.x + offsetMeters,
        y: targetPlacement.y + targetDepth + targetWallThickness,
      };
    case "West":
      return {
        x: targetPlacement.x - targetWallThickness - roomWidth,
        y: targetPlacement.y + offsetMeters,
      };
  }
}

function getPlacementWall(value: string | undefined, fallback: RoomWall = "East"): RoomWall {
  return ROOM_WALLS.includes(value as RoomWall) ? (value as RoomWall) : fallback;
}

function parseWallThicknessMeters(value: string | undefined, fallback: number) {
  const parsed = parsePositiveRoomNumber(value);

  if (parsed <= 0) {
    return fallback;
  }

  return parsed > 20 ? parsed / 1000 : parsed;
}

function parsePositiveRoomNumber(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Number(value.replace(",", "."));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseSignedRoomNumber(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Number(value.replace(",", "."));

  return Number.isFinite(parsed) ? parsed : 0;
}

function createRoomFormValuesForSharedWall(
  targetFormValues: FormValues | undefined,
  targetWall: RoomWall
) {
  if (!targetFormValues) {
    return initialFormValues;
  }

  const ownWall = OPPOSITE_ROOM_WALL[targetWall];
  const nextFormValues: FormValues = {
    ...initialFormValues,
    wallNorthType: targetFormValues.wallNorthType ?? initialFormValues.wallNorthType,
    wallEastType: targetFormValues.wallEastType ?? initialFormValues.wallEastType,
    wallSouthType: targetFormValues.wallSouthType ?? initialFormValues.wallSouthType,
    wallWestType: targetFormValues.wallWestType ?? initialFormValues.wallWestType,
    wallNorthWidth: targetFormValues.wallNorthWidth ?? initialFormValues.wallNorthWidth,
    wallEastWidth: targetFormValues.wallEastWidth ?? initialFormValues.wallEastWidth,
    wallSouthWidth: targetFormValues.wallSouthWidth ?? initialFormValues.wallSouthWidth,
    wallWestWidth: targetFormValues.wallWestWidth ?? initialFormValues.wallWestWidth,
    roofType: targetFormValues.roofType ?? initialFormValues.roofType,
    roofThickness: targetFormValues.roofThickness ?? initialFormValues.roofThickness,
  };

  nextFormValues[getWallTypeFieldName(ownWall)] =
    targetFormValues[getWallTypeFieldName(targetWall)] ?? nextFormValues[getWallTypeFieldName(ownWall)];
  nextFormValues[getWallWidthFieldName(ownWall)] =
    targetFormValues[getWallWidthFieldName(targetWall)] ?? nextFormValues[getWallWidthFieldName(ownWall)];

  return nextFormValues;
}

function getWallTypeFieldName(wall: RoomWall) {
  return `wall${wall}Type`;
}

function getWallWidthFieldName(wall: RoomWall) {
  return `wall${wall}Width`;
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
    "1.6_type": "roofType",
    "1.6_thickness": "roofThickness",
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
