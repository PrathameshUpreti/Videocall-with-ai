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

    const mergeRequests = await api.MergeRequests.all({
      scope: 'all',
      state: 'opened',
    });

    const formattedMRs = mergeRequests.map((mr: any) => ({
      title: mr.title,
      state: mr.state,
      web_url: mr.web_url,
    }));

    return NextResponse.json(formattedMRs);
  } catch (error) {
    console.error('Error fetching GitLab merge requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GitLab merge requests' },
      { status: 500 }
    );
  }
} 