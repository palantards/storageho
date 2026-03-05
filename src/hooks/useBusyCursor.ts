"use client"

import { useEffect, useRef } from "react"

let busyCursorUsers = 0

function syncBusyCursor() {
  if (typeof document === "undefined") return
  if (busyCursorUsers > 0) {
    document.body.dataset.busy = "true"
  } else {
    delete document.body.dataset.busy
  }
}

export function useBusyCursor(isBusy: boolean) {
  const isActiveRef = useRef(false)

  useEffect(() => {
    if (isBusy && !isActiveRef.current) {
      busyCursorUsers += 1
      isActiveRef.current = true
      syncBusyCursor()
    } else if (!isBusy && isActiveRef.current) {
      busyCursorUsers = Math.max(0, busyCursorUsers - 1)
      isActiveRef.current = false
      syncBusyCursor()
    }

    return () => {
      if (!isActiveRef.current) return
      busyCursorUsers = Math.max(0, busyCursorUsers - 1)
      isActiveRef.current = false
      syncBusyCursor()
    }
  }, [isBusy])
}
