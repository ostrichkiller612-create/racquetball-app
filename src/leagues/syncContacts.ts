import { supabase } from '../lib/supabase'

/**
 * Ensures the current user has a contact for each given entry (matched by
 * case-insensitive name). Returns the number of contacts created.
 *
 * Used to mirror a league roster into the user's contacts so match logging
 * and name-based schedule linking work without manual contact entry.
 */
export async function ensureContacts(
  entries: Array<{ name: string; phone: string | null }>,
): Promise<number> {
  const { data: u } = await supabase.auth.getUser()
  const me = u.user?.id
  if (!me) throw new Error('Not authenticated')

  const { data: existing, error: exErr } = await supabase
    .from('contacts')
    .select('name')
    .eq('owner_id', me)
  if (exErr) throw exErr

  const have = new Set(
    ((existing ?? []) as Array<{ name: string }>).map((c) => c.name.trim().toLowerCase()),
  )

  let added = 0
  for (const e of entries) {
    const name = e.name.trim()
    if (!name || have.has(name.toLowerCase())) continue
    const { error } = await supabase.from('contacts').insert({
      owner_id: me,
      name,
      phone: e.phone?.trim() || null,
    })
    if (error) throw error
    have.add(name.toLowerCase())
    added += 1
  }
  return added
}
