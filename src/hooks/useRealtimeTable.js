import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Subscribe to Supabase Realtime postgres_changes for a table.
 * Automatically cleans up on unmount.
 *
 * @param {string} table  - Table name
 * @param {{ onInsert?, onUpdate?, onDelete?, filter? }} handlers
 */
export function useRealtimeTable(table, { onInsert, onUpdate, onDelete, filter } = {}) {
  useEffect(() => {
    const cfg = { event: '*', schema: 'public', table }
    if (filter) cfg.filter = filter

    const channel = supabase
      .channel(`realtime-${table}-${Math.random()}`)
      .on('postgres_changes', cfg, (payload) => {
        if (payload.eventType === 'INSERT' && onInsert) onInsert(payload.new)
        if (payload.eventType === 'UPDATE' && onUpdate) onUpdate(payload.new)
        if (payload.eventType === 'DELETE' && onDelete) onDelete(payload.old)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table])
}
