import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Member, Memory, Note, Recommendation, Feedback, PairingToken } from '../types'

export const useMembers = () =>
  useQuery({ queryKey: ['members'], queryFn: () => api.get<Member[]>('/members') })

export const useMemberMemories = (memberId: number) =>
  useQuery({
    queryKey: ['memories', memberId],
    queryFn: () => api.get<Memory[]>(`/members/${memberId}/memories`),
    enabled: !!memberId,
  })

export const useCreateNote = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (note: Omit<Note, 'id' | 'created_at'>) => api.post<Note>('/notes', note),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['memories', vars.member_id] }),
  })
}

export const useDeleteMemory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/memories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['memories'] }),
  })
}

export const useFeedback = () =>
  useMutation({
    mutationFn: (fb: Feedback) => api.post<void>('/feedback', fb),
  })

export const usePairingToken = () =>
  useMutation({
    mutationFn: (memberId: number) =>
      api.post<PairingToken>(`/admin/members/${memberId}/pairing`, {}),
  })

export const useRecommendations = (memberId: number) =>
  useQuery({
    queryKey: ['recommendations', memberId],
    queryFn: () => api.get<Recommendation[]>(`/members/${memberId}/recommendations`),
    enabled: !!memberId,
  })
