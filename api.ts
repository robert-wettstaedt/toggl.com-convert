import fetch from 'isomorphic-fetch'
import { TimeEntry, Project } from './types'

const auth = Buffer.from(`${process.env.API_TOKEN}:api_token`).toString('base64')

export const getProject = async (projectId: number) => {
  const res = await fetch(`${process.env.API_URL}projects/${projectId}`, {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
  })

  if (res.status !== 200) {
    throw new Error(`${res.status} - ${res.statusText}`)
  }

  const project: Project = (await res.json()).data

  return project
}

export const getTimeEntries = async (start: string, end: string) => {
  const res = await fetch(`${process.env.API_URL}time_entries?start_date=${start}&end_date=${end}`, {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
  })

  if (res.status !== 200) {
    throw new Error(`${res.status} - ${res.statusText}`)
  }

  const timeEntries: TimeEntry[] = await res.json()

  return timeEntries
}
