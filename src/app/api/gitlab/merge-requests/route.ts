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