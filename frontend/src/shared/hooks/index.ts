import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@shared/api'
import type { Member, Memory, Note, Recommendation, Feedback, PairingToken, Domain } from '@shared/types'
import { enqueueNote, listQueuedNotes, syncQueuedNotes } from '../../mobile/offline/noteQueue'

export const useMembers = () =>
  useQuery({ queryKey: ['members'], queryFn: () => api.get<Member[]>('/members') })

export const useMemberMemories = (memberId: number) =>
  useQuery({
    queryKey: ['memories', memberId],
    queryFn: () => api.get<Memory[]>(`/memories?member_id=${memberId}`),
    enabled: !!memberId,
  })

export const useMemberNotes = (memberId: number) =>
  useQuery({
    queryKey: ['notes', memberId],
    queryFn: () => api.get<Note[]>(`/notes?member_id=${memberId}`),
    enabled: !!memberId,
  })

export const useCreateNote = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (note: Omit<Note, 'id' | 'created_at'>) => {
      if (!navigator.onLine) return enqueueNote(note)
      try {
        return await api.post<Note>('/notes', note)
      } catch (error) {
        await enqueueNote(note)
        throw error
      }
    },
    onSettled: (_, __, vars) => {
      if (vars.member_id) qc.invalidateQueries({ queryKey: ['memories', vars.member_id] })
      qc.invalidateQueries({ queryKey: ['queued-notes'] })
    },
  })
}

export const useQueuedNotes = () =>
  useQuery({
    queryKey: ['queued-notes'],
    queryFn: listQueuedNotes,
  })

export const useSyncQueuedNotes = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: syncQueuedNotes,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['queued-notes'] })
      qc.invalidateQueries({ queryKey: ['memories'] })
    },
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
    mutationFn: (fb: Feedback) => api.post<void>('/recommendations/feedback', fb),
  })

export const usePairingToken = () =>
  useMutation({
    mutationFn: (memberId: number) =>
      api.post<PairingToken>(`/pairing/members/${memberId}`, {}),
  })

export const useRecommendation = (memberId: number, domain: Domain) =>
  useQuery({
    queryKey: ['recommendation', memberId, domain],
    queryFn: () => api.get<Recommendation>(`/recommendations/${domain}?member_id=${memberId}`),
    enabled: !!memberId && !!domain,
  })
