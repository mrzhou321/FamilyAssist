// 开发环境 mock 数据，集中管理，不散落在组件内
// 生产环境组件应从 API 获取真实数据

import type { Memory, Note } from '../types'

export const MOCK_MEMBERS = [
  { id: 1, name: '张明远', role: '爸爸', age: 62, initial: '爸', color: 'var(--color-accent)' },
  { id: 2, name: '李秀梅', role: '妈妈', age: 59, initial: '妈', color: 'var(--color-sage)'   },
  { id: 3, name: '张小一', role: '自己', age: 28, initial: '我', color: 'var(--color-honey)'  },
]

export const MOCK_MEMORIES: Memory[] = [
  { id: 1, member_id: 2, type: 'fact',    domain: 'general',  content: '每周三全家吃面',           confidence: 0.9, created_at: '2026-06-02' },
  { id: 2, member_id: 2, type: 'fact',    domain: 'dressing', content: '妈妈怕冷，易手脚凉',        confidence: 0.95, created_at: '2026-05-28' },
  { id: 3, member_id: 2, type: 'fact',    domain: 'diet',     content: '不爱香菜 · 爱吃辣',        confidence: 0.9, created_at: '2026-05-20' },
  { id: 4, member_id: 3, type: 'fact',    domain: 'diet',     content: '朵朵对芒果过敏',            confidence: 1.0, created_at: '2026-05-01' },
  { id: 5, member_id: 1, type: 'episode', domain: 'exercise', content: '爸爸饭后散步 30 分钟',      confidence: 0.85, created_at: '2026-05-01' },
  { id: 6, member_id: 1, type: 'fact',    domain: 'diet',     content: '爸爸在控糖，少甜食',        confidence: 0.95, created_at: '2026-04-15' },
]

export const MOCK_RECENT_NOTES: Pick<Note, 'id' | 'member_id' | 'content' | 'source' | 'created_at'>[] = [
  { id: 1, member_id: 1, content: '爸爸晚饭后爱散步 30 分钟', source: 'text', created_at: '2026-06-04' },
  { id: 2, member_id: 3, content: '朵朵对芒果过敏',           source: 'text', created_at: '2026-06-03' },
  { id: 3, member_id: 2, content: '妈妈不吃香菜，喜欢清淡',   source: 'text', created_at: '2026-06-02' },
]
