import { NextResponse } from 'next/server';
import { Gitlab } from '@gitbeaker/node';

if (!process.env.GITLAB_TOKEN || !process.env.GITLAB_URL) {
  throw new Error('Missing required GitLab environment variables');
}

const api = new Gitlab({
  token: process.env.GITLAB_TOKEN,
  host: process.env.GITLAB_URL,
});

export async function GET() {
  try {
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