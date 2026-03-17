import apiClient from './client'
import type { ValidationReport } from '@/types'

export const validateGraph = () => apiClient.get<ValidationReport>('/graph/validate')
