import { useState, useEffect } from 'react'
import { detectExtension, setExtensionId, sendToExtension, getExtensionId } from '../lib/extension'

export function useExtension() {
  const [connected, setConnected] = useState(false)
  const [extensionInfo, setExtensionInfo] = useState(null)

  useEffect(() => {
    // Try saved ID first, then default
    const savedId = localStorage.getItem('as_extension_id')
    if (savedId) setExtensionId(savedId)

    // Auto-detect on mount
    detectExtension().then(info => {
      if (info) {
        setConnected(true)
        setExtensionInfo(info)
      }
    })
  }, [])

  const connect = async (id) => {
    if (id) {
      setExtensionId(id)
      localStorage.setItem('as_extension_id', id)
    }
    const info = await detectExtension()
    if (info) {
      setConnected(true)
      setExtensionInfo(info)
      return true
    }
    return false
  }

  const send = async (message) => {
    return await sendToExtension(message)
  }

  return { connected, extensionInfo, connect, send, extensionId: getExtensionId() }
}
