// src/types/index.ts

export type FormValues = Record<string, string>;

export type SheetValues = Record<string, string>;

export type RoomWall = "North" | "East" | "South" | "West";

export type RoomPlacement = {
  x: number;
  y: number;
  rotation?: number;
  targetWall?: RoomWall;
  ownWall?: RoomWall;
  offsetMeters?: number;
  attachToRoomId?: string;
  targetAnchor?: string;
  ownAnchor?: string;
};

export type RoomData = {
  id: string;
  name: string;
  formValues: FormValues;
  sheetValues: SheetValues;
  placement?: RoomPlacement;
};

export type ProjectData = {
  version: string;
  rooms: RoomData[];
  // For backward compatibility with v1.1
  formValues?: FormValues;
  sheetValues?: SheetValues;
  lastSaved?: string;
};

export type Project = {
  id: string;
  user_id: string;           // Important: Supabase returns this
  name: string;
  data: ProjectData;
  created_at: string;
  updated_at: string;
};

export type UserSession = {
  id: string;
  email: string;
  name?: string;
};
