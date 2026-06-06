const UNPAIRED_MEMBER_NAME = '未配对'

export function getCurrentMemberId() {
  const raw = localStorage.getItem('member_id')
  const parsed = raw ? Number(raw) : null
  return parsed !== null && Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function getCurrentMemberName() {
  return localStorage.getItem('member_name') || UNPAIRED_MEMBER_NAME
}

export function hasPairedMember() {
  return Boolean(localStorage.getItem('token') && getCurrentMemberId() !== null)
}
