export interface TimeEntry {
  at: string
  billable: boolean
  duration: number
  duronly: boolean
  guid: string
  id: number
  pid: number
  start: string
  stop: string
  uid: number
  wid: number
}

export interface DateTimeEntry extends TimeEntry {
  startDate: Date
  stopDate: Date
}

export interface DateTimeMap {
  [day: number]: DateTimeEntry[]
}

export interface WorkTimeEntry {
  breakTime: string
  date: string
  startHours: number
  startMinutes: number
  stopHours: number
  stopMinutes: number
  workTime: string
}
