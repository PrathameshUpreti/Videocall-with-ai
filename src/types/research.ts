// Research status types
export type ResearchStatus = 'in_progress' | 'completed' | 'error';

export interface ResearchStatusResponse {
  status: ResearchStatus;
  progress?: number;
  files?: Record<string, string>;
  error?: string;
} 