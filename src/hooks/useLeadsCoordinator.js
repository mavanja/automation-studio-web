import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const EXT_ID = 'ehaendpolcffilhljadohefkgaaplfbg'

function sendToExtension(msg) {
  try {
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage(EXT_ID, msg, () => {})
    }
  } catch (e) {
    console.error('[AS] sendToExtension error:', e)
  }
}

/**
 * Leads Coordinator Hook
 * Replicates the old YunaPRO web app's per-user PROCESS_LEAD_USER_PROFILE flow.
 *
 * Listens for FROM_EXT_* messages from the extension content scripts (ypwContentScript1.js)
 * which are relayed via window.postMessage.
 */
export function useLeadsCoordinator({ onProgress, onComplete, onError, onBlocked }) {
  const taskRef = useRef(null)
  const userListRef = useRef([])
  const currentIndexRef = useRef(0)
  const sentCountRef = useRef(0)
  const fbInfoRef = useRef(null)
  const isRunningRef = useRef(false)

  const processNextUser = useCallback(() => {
    const users = userListRef.current
    const idx = currentIndexRef.current
    const task = taskRef.current

    if (!task || idx >= users.length) {
      console.log('[AS Web] All users processed. Sent:', sentCountRef.current)
      // Mark task complete
      if (task?.taskId) {
        supabase.from('tasks').update({
          status: 'completed',
          friend_request_sent: sentCountRef.current,
        }).eq('task_id', task.taskId).then(() => {})
      }
      isRunningRef.current = false
      if (onComplete) onComplete(sentCountRef.current)
      return
    }

    if (task.maxRequest && sentCountRef.current >= task.maxRequest) {
      console.log('[AS Web] Max requests reached:', sentCountRef.current)
      isRunningRef.current = false
      if (onComplete) onComplete(sentCountRef.current)
      return
    }

    const user = users[idx]
    const fbUser = user
    const profileUrl = `https://www.facebook.com/profile.php?id=${user.fbUserId || user.userName}`

    console.log('[AS Web] Processing user', idx + 1, '/', users.length, ':', user.name, '|', profileUrl)

    // Send PROCESS_LEAD_USER_PROFILE to extension (like old web app)
    sendToExtension({
      type: 'CREATE_TAB',
      data: {
        url: profileUrl + '&ypwSource=t',
        taskType: 'GET_LEADS_API_EXTERNAL',
        subTaskType: 'PROCESS_LEAD_USER_PROFILE',
        userName: task.facebookUserName,
        fbUser: fbUser,
        task: task,
        sentRequestCount: sentCountRef.current,
        exUserList: users.map(u => u.userName),
        currentTaskFbInfo: fbInfoRef.current,
        focusOnFb: false,
        pinned: true,
        skipMbasic: true,
        warningCounterForSentRequest: 0,
        cursorTimeGapMin: 500,
        cursorTimeGapMax: 1000,
        apiTimeGapMin: 2000,
        apiTimeGapMax: 4000,
      }
    })

    currentIndexRef.current = idx + 1
  }, [onComplete])

  useEffect(() => {
    function handleMessage(event) {
      if (!event.data?.type) return
      const { type, data } = event.data

      switch (type) {
        case 'FROM_EXT_GET_LEADS_STARTED':
          console.log('[AS Web] Leads started')
          break

        case 'FROM_EXT_GET_LEADS_PROGRESS': {
          const progressType = data?.type

          if (progressType === 'LEADS_USER_LIST') {
            // Received user list from extension
            const users = data.userList || []
            console.log('[AS Web] Got user list:', users.length, 'users')

            // Store FB info for later
            fbInfoRef.current = {
              authFBToken: data.authFBToken,
              pageInfo: data.pageInfo,
              userDetailsExternal: data.userDetailsExternal,
              isContentDataType: data.isContentDataType,
            }

            // Filter out self
            const filtered = users.filter(u =>
              u.userName !== data.task?.facebookUserName &&
              u.fbUserId !== data.task?.facebookUserName
            )

            userListRef.current = filtered
            taskRef.current = data.task
            currentIndexRef.current = 0
            sentCountRef.current = data.task?.friendRequestSent || 0
            isRunningRef.current = true

            if (onProgress) onProgress({ type: 'userList', users: filtered, total: filtered.length })

            // Start processing first user
            processNextUser()
          }

          if (progressType === 'LEADS_USER_PROFILE_SCAN') {
            // Result from profile scan
            const result = data.taskResult
            console.log('[AS Web] Profile scan result:', result?.name, '| FR sent:', result?.isFriendRequestSent)

            if (result?.isFriendRequestSent) {
              sentCountRef.current += 1

              // Update task in Supabase
              if (taskRef.current?.taskId) {
                supabase.from('tasks').update({
                  friend_request_sent: sentCountRef.current,
                }).eq('task_id', taskRef.current.taskId).then(() => {})
              }
            }

            // Save result to Supabase
            if (taskRef.current?.taskId) {
              supabase.from('task_results').insert({
                result_id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
                task_id: taskRef.current.taskId,
                user_id: taskRef.current.userId,
                result: result,
                created_by: 'extension',
              }).then(() => {})
            }

            if (onProgress) onProgress({ type: 'profileScan', result, sentCount: sentCountRef.current })

            // Process next user after delay
            setTimeout(() => processNextUser(), 2000)
          }

          if (progressType === 'LEADS_USER_SCAN_MUTUAL_FAILED') {
            console.log('[AS Web] Users filtered out (mutual count):', data.taskResult?.ignoredUsers?.length)
          }
          break
        }

        case 'FROM_EXT_GET_LEADS_END':
          console.log('[AS Web] Leads END from extension')
          // Don't stop if we're in the middle of processing users
          if (!isRunningRef.current) {
            if (onComplete) onComplete(sentCountRef.current)
          }
          break

        case 'FROM_EXT_GET_LEADS_BLOCKED':
          console.log('[AS Web] BLOCKED:', data?.message || data?.error?.message)
          isRunningRef.current = false
          if (onBlocked) onBlocked(data?.message || data?.error?.message)
          break

        case 'FROM_EXT_GET_LEADS_ERROR':
          console.log('[AS Web] ERROR:', data?.error?.message)
          isRunningRef.current = false
          if (onError) onError(data?.error?.message)
          break

        default:
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [processNextUser, onProgress, onComplete, onError, onBlocked])

  const stop = useCallback(() => {
    isRunningRef.current = false
    sendToExtension({ type: 'STOP_TASK_PROGRESS' })
  }, [])

  return { stop, isRunning: isRunningRef }
}
