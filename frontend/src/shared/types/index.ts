// 所有与后端交互的类型定义（与后端 Pydantic schema 对齐）
// Members.tsx 中的 ApiMember / MemberProfileForm 是表单专用 UI 类型，不在此处

import type { Domain } from '../constants'

export type { Domain }

export interface Member {
  id: number
  name: string
  birthday: string | null
  relation: string
  bound: boolean
  profile: MemberProfile
}

export interface MemberProfile {
  height: number | null
  weight: number | null
  allergies: string[]
  diet_restrictions: string[]
  chronic_conditions: string[]
  injury_history: string
  thermal_sensitivity: number   // -2 怕冷 ~ +2 怕热
  taste_preference: string
  exercise_preference: string
}

export interface Note {
  id: number
  member_id: number | null
  content: string
  source: 'text' | 'voice' | 'photo'
  status: string
  created_at: string
}

export type NoteCreatePayload = Pick<Note, 'member_id' | 'content' | 'source'>

export interface Memory {
  id: number
  member_id: number | null
  type: 'fact' | 'episode'
  domain: Domain | 'general'
  content: string
  confidence: number
  expires_at?: string
  source_note_id?: number | null
  created_at: string
}

export interface Recommendation {
  domain: Domain
  content: string
  basis: string[]       // 引用记忆的摘要文本，用于展示「依据 XXX」
  basis_refs: RecommendationBasisRef[]
}

export interface RecommendationBasisRef {
  memory_id: number
  source_note_id: number | null
  content: string
}

export interface RecommendationBatch {
  recommendations: Recommendation[]
}

export interface Feedback {
  domain: Domain
  member_id: number | null
  content: string
  accepted: boolean
}

export interface PairingToken {
  member_id: number
  server_url: string
  pairing_token: string
  pairing_url: string
  expires_at: string
}

export interface MemberDeviceSession {
  token_hash: string
  member_id: number
  member_name: string
  device_name: string
  revoked: boolean
  created_at: string
}
