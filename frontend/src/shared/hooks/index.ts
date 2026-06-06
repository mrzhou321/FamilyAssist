import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from '@shared/api'
import type { Memory, Note, NoteCreatePayload } from '@shared/types'
import { cacheMemories, getCachedMemories } from '../../mobile/offline/cachedData'
import { enqueueNote, listQueuedNotes, syncQueuedNotes } from '../../mobile/offline/noteQueue'

export const useMemberMemories = (memberId: number | null, enabled = true) =>
  useQuery({
    queryKey: ['memories', memberId],
    queryFn: async () => {
      try {
        const items = await api.get<Memory[]>(memberId === null ? '/memories' : `/memories?member_id=${memberId}`)
        return cacheMemories(memberId, items)
      } catch (error) {
        const cached = await getCachedMemories(memberId)
        if (cached.length > 0) return cached
        throw error
      }
    },
    enabled,
  })

export const useMemberNotes = (memberId: number | null, enabled = true) =>
  useQuery({
    queryKey: ['notes', memberId],
    queryFn: () => api.get<Note[]>(memberId === null ? '/notes' : `/notes?member_id=${memberId}`),
    enabled,
  })

export const useCreateNote = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (note: NoteCreatePayload) => {
      if (!navigator.onLine) return enqueueNote(note)
      try {
        return await api.post<Note>('/notes', note)
      } catch (error) {
        if (error instanceof ApiError && [401, 403].includes(error.status)) throw error
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
