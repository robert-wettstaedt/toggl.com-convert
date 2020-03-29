require('dotenv').config()

import { getTimeEntries } from './api'
import { TimeEntry, DateTimeEntry, DateTimeMap, WorkTimeEntry } from './types'
import * as fs from 'fs'
import * as path from 'path'

if (process.env.API_TOKEN == null) {
  throw new TypeError('API_TOKEN missing from env')
}

const MS_TO_MIN_FACTOR = 60000
const ROUNDING_INTERVAL = 15

const fn = async () => {
  const date = new Date(2020, 3, 0)
  const lastDay = date.getDate()

  const startDateString = '2020-03-01'
  const startDate = new Date(startDateString)
  const startString = startDate.toISOString()

  const endDateString = `2020-03-${lastDay}`
  const endDate = new Date(endDateString)
  const endString = endDate.toISOString()

  const filePath = './dist/'
  const fileName = `${startDateString}-${endDateString}.csv`

  try {
    const timeEntries = await getTimeEntries(startString, endString)

    const dateTimeMap = getDateTimeMap(timeEntries)
    const workTimeEntries = getWorkTimeEntries(dateTimeMap)
    const csvContent = getCsvContent(workTimeEntries)
    await saveCsv(csvContent, filePath, fileName)

    console.log(`Your csv file was succesfully saved to ${fileName}`)
  } catch (error) {
    console.error(error)
  }
}

fn()

const getDateTimeMap = (timeEntries: TimeEntry[]) => {
  return timeEntries.reduce((dateTimeMap, timeEntry) => {
    const startDate = new Date(timeEntry.start)
    const stopDate = new Date(timeEntry.stop)

    const dateTimeEntry: DateTimeEntry = { ...timeEntry, startDate, stopDate }

    const startDay = startDate.getDate()

    const dayEntries = dateTimeMap[startDay] ?? []
    dateTimeMap[startDay] = [...dayEntries, dateTimeEntry]

    return dateTimeMap
  }, {} as DateTimeMap)
}

const getWorkTimeEntries = (dateTimeMap: DateTimeMap) => {
  // const entries: DateTimeEntry[][] = [Object.values(dateTimeMap)[0]]
  const entries: DateTimeEntry[][] = Object.values(dateTimeMap)

  const workTimeEntries = entries.reduce((workTimeEntries, dateTimeEntries) => {
    const startDate = roundDate(dateTimeEntries[0].startDate)
    const stopDate = roundDate(dateTimeEntries[dateTimeEntries.length - 1].stopDate)

    const breakSumMinutes = dateTimeEntries.slice(1).reduce((sum, dateTimeEntry, index) => {
      const prev = dateTimeEntries[index]
      const breakTime = dateTimeEntry.startDate.getTime() - prev.stopDate.getTime()

      return sum + breakTime / MS_TO_MIN_FACTOR
    }, 0)

    const roundedBreakSumMinutes = roundMinutes(breakSumMinutes)
    const workSumMinutes = (stopDate.getTime() - startDate.getTime()) / MS_TO_MIN_FACTOR - roundedBreakSumMinutes

    return [
      ...workTimeEntries,
      {
        breakTime: timeConvert(roundedBreakSumMinutes),
        date: startDate.toLocaleDateString(),
        startHours: startDate.getHours(),
        startMinutes: startDate.getMinutes(),
        stopHours: stopDate.getHours(),
        stopMinutes: stopDate.getMinutes(),
        workTime: timeConvert(workSumMinutes),
      } as WorkTimeEntry,
    ]
  }, [] as WorkTimeEntry[])

  return workTimeEntries
}

const getCsvContent = (workTimeEntries: WorkTimeEntry[]) => {
  const header = 'date;startHours;startMinutes;stopHours;stopMinutes;breakTime\n'
  const body = workTimeEntries
    .map(
      workTimeEntry =>
        `${workTimeEntry.date};${workTimeEntry.startHours};${workTimeEntry.startMinutes};${workTimeEntry.stopHours};${workTimeEntry.stopMinutes};${workTimeEntry.breakTime}`,
    )
    .join('\n')

  return header + body
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
  const rest = minutes % ROUNDING_INTERVAL

  if (rest > ROUNDING_INTERVAL / 2) {
    return ROUNDING_INTERVAL - rest
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
