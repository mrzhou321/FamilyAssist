// 集中管理所有常量，避免魔法字符串散落各组件

export const ADMIN_TOKEN_KEY = 'admin_token'
export const MEMBER_TOKEN_KEY = 'token'
export const LEGACY_MEMBER_TOKEN_KEY = 'hearth_token'
export const MEMBER_ID_KEY = 'member_id'
export const MEMBER_NAME_KEY = 'member_name'

export const DOMAINS = ['dressing', 'diet', 'exercise'] as const
export type Domain = (typeof DOMAINS)[number]

export const DOMAIN_LABELS: Record<Domain, string> = {
  dressing: '穿衣',
  diet:     '饮食',
  exercise: '运动',
}

export const DOMAIN_ICONS: Record<Domain, string> = {
  dressing: '👕',
  diet:     '🥗',
  exercise: '🏃',
}

export const CHRONIC_OPTIONS = ['糖尿病', '高血压', '心脏病', '哮喘', '痛风'] as const
