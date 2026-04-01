export type Project = {
  id: string
  user_id: string
  name: string
  data: Record<string, any>   // This will hold your formValues + canvas data
  created_at: string
  updated_at: string
}

export type UserSession = {
  id: string
  email: string
  name?: string
}