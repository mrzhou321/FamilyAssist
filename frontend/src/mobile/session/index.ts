import { LEGACY_MEMBER_TOKEN_KEY, MEMBER_ID_KEY, MEMBER_NAME_KEY, MEMBER_TOKEN_KEY } from '@shared/constants'

const UNPAIRED_MEMBER_NAME = '未配对'

export function getCurrentMemberId() {
  const raw = localStorage.getItem(MEMBER_ID_KEY)
  const parsed = raw ? Number(raw) : null
  return parsed !== null && Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function getCurrentMemberName() {
  return localStorage.getItem(MEMBER_NAME_KEY) || UNPAIRED_MEMBER_NAME
}

export function hasPairedMember() {
  return Boolean((localStorage.getItem(MEMBER_TOKEN_KEY) ?? localStorage.getItem(LEGACY_MEMBER_TOKEN_KEY)) && getCurrentMemberId() !== null)
}
