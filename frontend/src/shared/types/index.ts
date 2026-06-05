// 所有与后端交互的类型定义（与后端 Pydantic schema 对齐）

export interface Member {
  id: number
  name: string
  role: string
  age: number
  initial: string
  color?: string
}

export interface MemberProfile {
  member_id: number
  height?: number
  weight?: number
  allergies?: string[]
  diet_restrictions?: string[]
  chronic_conditions?: string[]
  cold_sensitive?: boolean
  taste_preferences?: string[]
  exercise_preferences?: string[]
}

export interface Note {
  id: number
  member_id: number
  content: string
  source: 'text' | 'voice' | 'photo'
  created_at: string
}

export interface Memory {
  id: number
  member_id: number
  type: 'fact' | 'episode'
  domain: 'dressing' | 'diet' | 'exercise' | 'general'
  content: string
  confidence: number
  expires_at?: string
  source_note_id?: number
  created_at: string
}

export interface Recommendation {
  id: number
  member_id: number
  domain: 'dressing' | 'diet' | 'exercise'
  content: string
  memory_ids: number[]
  created_at: string
}

export interface Feedback {
  recommendation_id: number
  accepted: boolean
}

export interface PairingToken {
  server_url: string
  pairing_token: string
  expires_at: string
}
