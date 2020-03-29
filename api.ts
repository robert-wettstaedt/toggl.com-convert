import 'isomorphic-fetch'
import { TimeEntry } from './types'

const auth = Buffer.from(`${process.env.API_TOKEN}:api_token`).toString('base64')

export const getTimeEntries = async (start: string, end: string) => {
  const params = new URLSearchParams({ start_date: start, end_date: end })

  const res = await fetch(`${process.env.API_URL}time_entries?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
  })

  if (res.status !== 200) {
    throw new Error(`${res.status} - ${res.statusText}`)
  }

  const timeEntries: TimeEntry[] = await res.json()

  return timeEntries
}
