// 设计 token 对应的颜色常量，绑定 globals.css @theme 变量

export const MEMORY_TAG_COLORS: Record<string, string> = {
  习惯: 'var(--color-sage)',
  身体: 'var(--color-accent)',
  健康: 'var(--color-clay)',
  饮食: 'var(--color-honey)',
  过敏: 'var(--color-clay)',
  偏好: 'var(--color-marigold)',
}

// 三域建议卡片背景/描边，与 globals.css @theme 保持一致
export const DOMAIN_CARD_COLORS = {
  dressing: { bg: 'var(--color-dressing-bg)', border: 'var(--color-dressing-border)' },
  diet:     { bg: 'var(--color-diet-bg)', border: 'var(--color-diet-border)' },
  exercise: { bg: 'var(--color-exercise-bg)', border: 'var(--color-exercise-border)' },
} as const
