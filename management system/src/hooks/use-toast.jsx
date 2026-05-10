import { useSyncExternalStore } from 'react'

const TOAST_LIMIT = 4

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

/** @type {{ toasts: Array<Record<string, unknown>> }} */
let memoryState = { toasts: [] }

const listeners = new Set()

function dispatch(action) {
  switch (action.type) {
    case 'ADD_TOAST':
      memoryState = {
        ...memoryState,
        toasts: [action.toast, ...memoryState.toasts].slice(0, TOAST_LIMIT),
      }
      break
    case 'UPDATE_TOAST':
      memoryState = {
        ...memoryState,
        toasts: memoryState.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t,
        ),
      }
      break
    case 'DISMISS_TOAST': {
      const { toastId } = action
      memoryState = {
        ...memoryState,
        toasts:
          toastId === undefined
            ? []
            : memoryState.toasts.filter((t) => t.id !== toastId),
      }
      break
    }
    case 'REMOVE_TOAST':
      memoryState = {
        ...memoryState,
        toasts:
          action.toastId === undefined
            ? []
            : memoryState.toasts.filter((t) => t.id !== action.toastId),
      }
      break
    default:
      break
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return memoryState
}

function toast({ ...props }) {
  const id = genId()

  const update = (t) =>
    dispatch({
      type: 'UPDATE_TOAST',
      toast: { ...t, id },
    })

  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id })

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return { id, dismiss, update }
}

function useToast() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return {
    toasts: state.toasts,
    toast,
    dismiss: (toastId) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  }
}

export { useToast, toast }
