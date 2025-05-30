import { NextResponse } from 'next/server';
import { Gitlab } from '@gitbeaker/node';

// Check for required environment variables
const hasGitLabCredentials = !!(process.env.GITLAB_TOKEN && process.env.GITLAB_URL);

// Only initialize GitLab client if credentials are available
const api = hasGitLabCredentials
  ? new Gitlab({
      token: process.env.GITLAB_TOKEN || '',
      host: process.env.GITLAB_URL || '',
    })
  : null;

export async function GET() {
  try {
    // If GitLab client is not initialized due to missing env vars, return error
    if (!api) {
      console.warn('GitLab integration is not configured. Missing environment variables.');
      return NextResponse.json(
        { error: 'GitLab integration is not configured' },
        { status: 503 }
      );
    }

    const issues = await api.Issues.all({
      scope: 'all',
      state: 'opened',
    });

    const formattedIssues = issues.map((issue: any) => ({
      title: issue.title,
      description: issue.description,
      state: issue.state,
      web_url: issue.web_url,
    }));

    return NextResponse.json(formattedIssues);
  } catch (error) {
    console.error('Error fetching GitLab issues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GitLab issues' },
      { status: 500 }
    );
  }
} 