import { supabase } from '../lib/supabase'

export async function logEvent(
  event_type: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return  // not authenticated; silently skip

    const { error } = await supabase
      .from('analytics_events')
      .insert({ user_id: user.id, event_type, metadata })

    if (error) console.error('[SubRadar] analytics logEvent failed:', error)
  } catch (err) {
    console.error('[SubRadar] analytics logEvent threw:', err)
  }
}
