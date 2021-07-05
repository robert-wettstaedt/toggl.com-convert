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

export interface Project {
  active: boolean
  actual_hours: number
  at: string
  auto_estimates: boolean
  billable: boolean
  cid: number
  color: string
  created_at: string
  hex_color: string
  id: number
  is_private: boolean
  name: string
  template: boolean
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
