import { supabase } from '@/lib/supabase'
import type { Goal, Kpi } from '@/types'

export async function listGoals(clientId: string): Promise<Goal[]> {
  try {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (error) { console.error('listGoals:', error.message); return [] }
    return (data ?? []) as Goal[]
  } catch { return [] }
}

export async function listKpis(clientId: string): Promise<Kpi[]> {
  try {
    const { data, error } = await supabase
      .from('kpis')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (error) { console.error('listKpis:', error.message); return [] }
    return (data ?? []) as Kpi[]
  } catch { return [] }
}
