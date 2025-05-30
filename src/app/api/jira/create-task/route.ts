import { NextResponse } from 'next/server';
import JiraClient from 'jira-client';

if (!process.env.JIRA_HOST || !process.env.JIRA_USERNAME || !process.env.JIRA_API_TOKEN) {
  throw new Error('Missing required Jira environment variables');
}

const jira = new JiraClient({
  protocol: 'https',
  host: process.env.JIRA_HOST,
  username: process.env.JIRA_USERNAME,
  password: process.env.JIRA_API_TOKEN,
  apiVersion: '2',
  strictSSL: true,
});

export async function POST(request: Request) {
  try {
    const { summary, description, priority, assignee } = await request.json();

    const issueData = {
      fields: {
        project: {
          key: 'YOUR_PROJECT_KEY', // Replace with your Jira project key
        },
        summary: summary,
        description: description,
        issuetype: {
          name: 'Task',
        },
        priority: {
          name: priority,
        },
        ...(assignee && {
          assignee: {
            name: assignee,
          },
        }),
      },
    };

    const issue = await jira.addNewIssue(issueData);

    return NextResponse.json({
      success: true,
      issueKey: issue.key,
      self: issue.self,
    });
  } catch (error) {
    console.error('Error creating Jira task:', error);
    return NextResponse.json(
      { error: 'Failed to create Jira task' },
      { status: 500 }
    );
  }
} 