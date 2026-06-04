import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Contact = {
  id: string
  owner_id: string
  name: string
  phone: string | null
  linked_user_id?: string | null
  created_at?: string
}

export type NewContact = { name: string; phone: string | null }

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('contacts').select('*').order('name')
    if (error) setError(error.message)
    else setContacts(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const addContact = useCallback(async (input: NewContact) => {
    const { data: u } = await supabase.auth.getUser()
    const owner_id = u.user?.id
    if (!owner_id) throw new Error('Not authenticated')
    const { data, error } = await supabase
      .from('contacts')
      .insert({ ...input, owner_id })
      .select()
      .single()
    if (error) throw error
    setContacts((prev) => [...prev, data as Contact].sort((a, b) => a.name.localeCompare(b.name)))
    return data as Contact
  }, [])

  const deleteContact = useCallback(async (id: string) => {
    const { error } = await supabase.from('contacts').delete().eq('id', id)
    if (error) throw error
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return { contacts, loading, error, addContact, deleteContact, reload }
}
