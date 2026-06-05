const DEFAULT_MEMBER_ID = 1
const DEFAULT_MEMBER_NAME = '爸爸'

export function getCurrentMemberId() {
  const raw = localStorage.getItem('member_id')
  const parsed = raw ? Number(raw) : DEFAULT_MEMBER_ID
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MEMBER_ID
}

export function getCurrentMemberName() {
  return localStorage.getItem('member_name') || DEFAULT_MEMBER_NAME
}

export function hasPairedMember() {
  return Boolean(localStorage.getItem('token') && localStorage.getItem('member_id'))
}
