export type PersonnelRow = {
  empId: string
  name: string
  gender: string
  hireRank: string
  hireDate: Date | null
  promoteRank: string
  promoteDate: Date | null
  currentRank: string
  jobType: string
  birthDate: Date | null
  retirementPlannedRaw: Date | null
  status: string
  resignDate: Date | null
  resignReason: string
}

export type LeaveRow = {
  empId: string
  name: string
  rank: string
  gender: string
  leaveKind: string
  pregnancyShortStart: Date | null
  pregnancyShortEnd: Date | null
  childcareShortStart: Date | null
  childcareShortEnd: Date | null
  maternityStart: Date | null
  maternityEnd: Date | null
  leaveStart: Date | null
  leaveEnd: Date | null
  childInfo: string
}

export type TrainingRow = {
  empId: string
  name: string
  rank: string
  gender: string
  meritStart: Date | null
  meritEnd: Date | null
}

export type ParsedWorkbook = {
  personnel: PersonnelRow[]
  leave: LeaveRow[]
  training: TrainingRow[]
  sheetNotes: string[]
}
