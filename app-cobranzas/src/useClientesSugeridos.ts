import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Cliente = { id: string; nombre: string; numero_sap: string | null }

export function useClientesSugeridos(consulta: string) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [buscando, setBuscando] = useState(false)
  const [consultado, setConsultado] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true
    const texto = consulta.trim().replace(/[%,()\\]/g, ' ').trim()
    setClientes([])
    setConsultado(false)
    setError('')
    if (!texto) {
      setBuscando(false)
      return
    }

    setBuscando(true)
    const temporizador = window.setTimeout(async () => {
      const { data, error: errorConsulta } = await supabase.from('clientes')
        .select('id,nombre,numero_sap')
        .or(`nombre.ilike.%${texto}%,numero_sap.ilike.%${texto}%`)
        .order('nombre')
        .limit(8)
      if (!vigente) return
      setClientes(data ?? [])
      setError(errorConsulta?.message ?? '')
      setConsultado(true)
      setBuscando(false)
    }, 250)

    return () => {
      vigente = false
      window.clearTimeout(temporizador)
    }
  }, [consulta])

  return { clientes, buscando, consultado, error }
}
