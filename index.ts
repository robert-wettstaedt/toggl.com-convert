require('dotenv').config()

import { getTimeEntries, getProject } from './api'
import { TimeEntry, DateTimeEntry, DateTimeMap, WorkTimeEntry, Project } from './types'
import * as fs from 'fs'
import * as path from 'path'

if (process.env.API_TOKEN == null) {
  throw new TypeError('API_TOKEN missing from env')
}

const { MS_TO_MIN_FACTOR, ROUNDING_INTERVAL, PROJECT_IDS, START_DATE, END_DATE } = process.env

if (
  PROJECT_IDS == null ||
  MS_TO_MIN_FACTOR == null ||
  ROUNDING_INTERVAL == null ||
  START_DATE == null ||
  END_DATE == null
) {
  throw new Error('env not configured correctly')
}

const PROJECT_IDS_ARR = PROJECT_IDS.split(',').map((id) => parseInt(id, 10))
const MS_TO_MIN_FACTOR_NUM = parseInt(MS_TO_MIN_FACTOR, 10)
const ROUNDING_INTERVAL_NUM = parseInt(ROUNDING_INTERVAL, 10)

const fn = async () => {
  const startDate = new Date(START_DATE)
  const startString = startDate.toISOString()

  const endDate = new Date(END_DATE)
  const endString = endDate.toISOString()

  const filePath = './dist/'
  const fileName = `${START_DATE}_${END_DATE}.csv`

  try {
    const projectPromises = PROJECT_IDS_ARR.map((projectId) => getProject(projectId))
    const projects = await Promise.all(projectPromises)
    const timeEntries = await getTimeEntries(startString, endString)
    const dateTimeMap = getDateTimeMap(timeEntries)
    const workTimeEntries = getWorkTimeEntries(dateTimeMap, projects)
    const projectSums = getProjectSums(workTimeEntries)
    const csvContent = getCsvContent(workTimeEntries, projectSums)
    await saveCsv(csvContent, filePath, fileName)

    console.log(`Your csv file was successfully saved to ${path.join(filePath, fileName)}`)
  } catch (error) {
    console.error(error)
  }
}

fn()

const getDateTimeMap = (timeEntries: TimeEntry[]) => {
  return timeEntries.reduce((dateTimeMap, timeEntry) => {
    if (PROJECT_IDS_ARR.includes(timeEntry.pid)) {
      const startDate = new Date(timeEntry.start)
      const stopDate = new Date(timeEntry.stop)

      const dateTimeEntry: DateTimeEntry = { ...timeEntry, startDate, stopDate }

      const startDay = startDate.getDate()

      const dayEntries = dateTimeMap[startDay] ?? {}
      const projectEntries = dayEntries[timeEntry.pid] ?? []
      dateTimeMap[startDay] = { ...dayEntries, [timeEntry.pid]: [...projectEntries, dateTimeEntry] }
    }

    return dateTimeMap
  }, {} as DateTimeMap)
}

const getWorkTimeEntries = (dateTimeMap: DateTimeMap, projects: Project[]): WorkTimeEntry[] => {
  // const entries: DateTimeEntry[][] = [Object.values(dateTimeMap)[0]]
  const entries: Record<number, DateTimeEntry[]>[] = Object.values(dateTimeMap)

  const workTimeEntries = entries.flatMap((projectEntries) => {
    const entries = Object.entries(projectEntries)

    return entries.reduce((workTimeEntries, [projectId, dateTimeEntries]) => {
      const startDate = roundDate(dateTimeEntries[0].startDate)
      const stopDate = roundDate(dateTimeEntries[dateTimeEntries.length - 1].stopDate)

      const breakSumMinutes = dateTimeEntries.slice(1).reduce((sum, dateTimeEntry, index) => {
        const prev = dateTimeEntries[index]
        const breakTime = dateTimeEntry.startDate.getTime() - prev.stopDate.getTime()

        return sum + breakTime / MS_TO_MIN_FACTOR_NUM
      }, 0)

      const roundedBreakSumMinutes = roundMinutes(breakSumMinutes)
      const workSumMinutes = (stopDate.getTime() - startDate.getTime()) / MS_TO_MIN_FACTOR_NUM - roundedBreakSumMinutes

      return [
        ...workTimeEntries,
        {
          breakTime: timeConvert(roundedBreakSumMinutes),
          date: `${startDate.getDate()}.${startDate.getMonth() + 1}.${startDate.getFullYear()}`,
          project: projects.find((project) => String(project.id) === projectId),
          startHours: startDate.getHours(),
          startMinutes: startDate.getMinutes(),
          stopHours: stopDate.getHours(),
          stopMinutes: stopDate.getMinutes(),
          workTime: timeConvert(workSumMinutes),
        } as WorkTimeEntry,
      ]
    }, [] as WorkTimeEntry[])
  })

  return workTimeEntries
}

const getProjectSums = (workTimeEntries: WorkTimeEntry[]): Record<string, string> => {
  const numberMap = workTimeEntries.reduce((map, entry) => {
    const prevSum = map[entry.project.id] ?? 0
    const nextSum = prevSum + parseFloat(entry.workTime.replace(',', '.'))

    return { ...map, [entry.project.id]: nextSum }
  }, {} as Record<string, number>)

  const stringMap = Object.entries(numberMap).reduce((map, [projectId, entry]) => {
    return { ...map, [projectId]: entry.toString().replace('.', ',') }
  }, {} as Record<string, string>)

  return stringMap
}

const getCsvContent = (workTimeEntries: WorkTimeEntry[], projectSums: Record<string, string>) => {
  const header = 'date;startHours;startMinutes;stopHours;stopMinutes;breakTime;totalWorkTime;gleitzeit;project'

  const body = workTimeEntries
    .map((workTimeEntry) => {
      const projectName = process.env[workTimeEntry.project.id] ?? workTimeEntry.project.name

      return `${workTimeEntry.date};${workTimeEntry.startHours};${workTimeEntry.startMinutes};${workTimeEntry.stopHours};${workTimeEntry.stopMinutes};${workTimeEntry.breakTime};;;${projectName}`
    })
    .join('\n')

  const footer = Object.entries(projectSums)
    .map(([projectId, sum]) => {
      const projectName = process.env[projectId]
      return `${sum}h ${projectName}`
    })
    .join('\n')

  return [header, body, '\n', footer].join('\n')
}

const roundDate = (date: Date) => {
  const minutes = date.getMinutes()

  const minutesToRound = getMinutesToRound(minutes)

  const newDate = new Date(date)
  newDate.setMinutes(minutes + minutesToRound, 0, 0)

  return newDate
}

const roundMinutes = (minutes: number) => Math.round(minutes) + getMinutesToRound(Math.round(minutes))

const getMinutesToRound = (minutes: number) => {
  const rest = minutes % ROUNDING_INTERVAL_NUM

  if (rest > ROUNDING_INTERVAL_NUM / 2) {
    return ROUNDING_INTERVAL_NUM - rest
  }

  return -rest
}

const timeConvert = (num: number) => {
  const hours = Math.floor(num / 60)
  const minutes = num % 60
  const minutesFraction = minutes / 60
  const sum = hours + minutesFraction
  const formatted = sum.toString().replace('.', ',')

  return formatted
}

const saveCsv = async (csvContent: string, filePath: string, fileName: string) => {
  try {
    await fs.promises.access(filePath)
  } catch (error) {
    await fs.promises.mkdir(filePath)
  }

  await fs.promises.writeFile(path.join(filePath, fileName), csvContent)
}
