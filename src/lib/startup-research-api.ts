// API client for the startup research service

// Type definitions
export interface StartupResearch {
  research_id: string;
  startup_idea: string;
  status: 'in_progress' | 'completed' | 'error';
  progress?: number;
  created_at: string;
  completed_at?: string;
  files?: Record<string, string>;
  error?: string;
}

export interface ResearchFile {
  name: string;
  type: string;
  url: string;
}

// API class
export class StartupResearchAPI {
  private baseUrl: string;

  constructor() {
    // Use environment variable or default to localhost in development
    this.baseUrl = process.env.NEXT_PUBLIC_STARTUP_API_URL || '/api/startup-research';
  }

  /**
   * Start evaluating a startup idea
   */
  async evaluateStartup(idea: string): Promise<{ research_id: string; status: string }> {
    const response = await fetch(`${this.baseUrl}/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idea }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start startup evaluation');
    }

    return response.json();
  }

  /**
   * Get the status of a research
   */
  async getResearchStatus(researchId: string): Promise<StartupResearch> {
    const response = await fetch(`${this.baseUrl}/status/${researchId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get research status');
    }

    return response.json();
  }

  /**
   * List all researches
   */
  async listResearches(): Promise<{ researches: StartupResearch[] }> {
    const response = await fetch(`${this.baseUrl}/list`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list researches');
    }

    return response.json();
  }

  /**
   * Get URL for a research file
   */
  getFileUrl(researchId: string, fileName: string): string {
    return `${this.baseUrl}/file/${researchId}/${fileName}`;
  }

  /**
   * Get all available files for a research
   */
  async getResearchFiles(research: StartupResearch): Promise<ResearchFile[]> {
    if (!research.files) {
      return [];
    }

    const files: ResearchFile[] = [];

    // Convert the file paths to file objects with URLs
    for (const [name, path] of Object.entries(research.files)) {
      // Determine the file type from the name
      let type = 'text/plain';
      if (name.endsWith('.md')) {
        type = 'text/markdown';
      } else if (name.endsWith('.html')) {
        type = 'text/html';
      } else if (name.endsWith('.docx')) {
        type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (name.endsWith('.pdf')) {
        type = 'application/pdf';
      }

      // Use the basename from the path
      const fileName = path.split('/').pop() || name;
      
      files.push({
        name: fileName,
        type,
        url: this.getFileUrl(research.research_id, fileName),
      });
    }

    return files;
  }
}

// Create a singleton instance
const startupResearchAPI = new StartupResearchAPI();
export default startupResearchAPI; 