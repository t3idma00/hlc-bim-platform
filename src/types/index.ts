// src/types/index.ts

export type FormValues = Record<string, string>;

export type SheetValues = Record<string, string>;

export type ProjectData = {
  version: string;
  formValues: FormValues;
  sheetValues: SheetValues;
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