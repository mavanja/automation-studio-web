// Communication with the Chrome Extension
const DEFAULT_EXTENSION_ID = 'ppjgapkplgefadennimahopgbiphmlcp'

let extensionId = DEFAULT_EXTENSION_ID

export function setExtensionId(id) {
  extensionId = id
}

export function getExtensionId() {
  return extensionId
}

export async function detectExtension() {
  // Try to find the extension by sending a ping
  // The extension must have externally_connectable matching this domain
  return new Promise((resolve) => {
    if (!chrome?.runtime?.sendMessage) {
      resolve(false)
      return
    }
    // Try known extension ID or broadcast
    try {
      chrome.runtime.sendMessage(extensionId, { type: 'GET_EXT_DETAILS' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          resolve(false)
        } else {
          resolve(response)
        }
      })
    } catch {
      resolve(false)
    }
  })
}

export function sendToExtension(message) {
  return new Promise((resolve, reject) => {
    if (!extensionId || !chrome?.runtime?.sendMessage) {
      reject(new Error('Extension not connected'))
      return
    }
    chrome.runtime.sendMessage(extensionId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError)
      } else {
        resolve(response)
      }
    })
  })
}
