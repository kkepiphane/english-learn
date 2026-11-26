import { AirplaneTilt, Briefcase, Exam, GraduationCap, type Icon } from '@phosphor-icons/react'
import type { Dream } from '../lib/goals'

/** Interface icons for each dream (emojis stay for celebrations and badges). */
export const DREAM_ICON: Record<Dream, Icon> = { travel: AirplaneTilt, study: GraduationCap, work: Briefcase, exam: Exam }
