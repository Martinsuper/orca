import { useEffect, useState } from 'react'

function getLocalDate(now = new Date()): string {
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function millisecondsUntilNextLocalDate(now = new Date()): number {
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  return next.getTime() - now.getTime()
}

export function useTodoLocalDate(): string {
  const [localDate, setLocalDate] = useState(getLocalDate)

  useEffect(() => {
    let timeout: number
    const scheduleUpdate = () => {
      timeout = window.setTimeout(() => {
        setLocalDate(getLocalDate())
        scheduleUpdate()
      }, millisecondsUntilNextLocalDate())
    }
    scheduleUpdate()

    return () => window.clearTimeout(timeout)
  }, [])

  return localDate
}
