"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Title, Text, List, ListItem, Button, TextInput, Textarea, Select, SelectItem, Badge } from '@tremor/react';
import { 
  CodeBracketIcon, 
  PlusIcon, 
  ArrowPathIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface GitLabProject {
  id: number;
  name: string;
  description: string;
  web_url: string;
  star_count: number;
  forks_count: number;
  last_activity_at: string;
}

interface GitLabIssue {
  id: number;
  title: string;
  description: string;
  state: string;
  web_url: string;
  created_at: string;
  updated_at: string;
  labels: string[];
}

export const GitLabIntegration = () => {
  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [issues, setIssues] = useState<GitLabIssue[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [newIssue, setNewIssue] = useState({
    title: '',
    description: ''
  });

  const checkAuth = async () => {
    try {
      const response = await axios.get('/mcp/gitlab/status');
      setIsAuthenticated(response.data.authenticated);
      if (response.data.authenticated) {
        fetchProjects();
      }
    } catch (error) {
      console.error('Error checking GitLab auth:', error);
      setIsAuthenticated(false);
    }
  };

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/mcp/gitlab/projects');
      setProjects(response.data.projects);
    } catch (error) {
      console.error('Error fetching GitLab projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchIssues = async (projectId: string) => {
    if (!projectId) return;
    setLoading(true);
    try {
      const response = await axios.get(`/mcp/gitlab/issues?project_id=${projectId}`);
      setIssues(response.data.issues);
    } catch (error) {
      console.error('Error fetching GitLab issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    fetchIssues(projectId);
  };

  const handleCreateIssue = async () => {
    if (!selectedProject || !newIssue.title) return;
    
    setLoading(true);
    try {
      await axios.post('/mcp/gitlab/create-issue', {
        project_id: selectedProject,
        title: newIssue.title,
        description: newIssue.description
      });
      
      // Reset form and refresh issues
      setNewIssue({ title: '', description: '' });
      fetchIssues(selectedProject);
    } catch (error) {
      console.error('Error creating issue:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'opened':
        return <ExclamationCircleIcon className="h-5 w-5 text-blue-500" />;
      case 'closed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  useEffect(() => {
    checkAuth();
  }, []);

  if (!isAuthenticated) {
    return (
      <Card className="bg-slate-800/70 border-slate-700/50 text-white">
        <div className="flex items-center space-x-3 mb-4">
          <CodeBracketIcon className="h-8 w-8 text-blue-400" />
          <Title className="text-xl text-white">GitLab Integration</Title>
        </div>
        <Text className="text-blue-200/70">Please configure your GitLab personal access token in the environment variables.</Text>
        <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
          <Text className="text-sm text-gray-400">Required environment variable:</Text>
          <code className="block mt-2 p-2 bg-slate-800 rounded text-blue-300 font-mono text-sm">
            GITLAB_TOKEN=your_personal_access_token
          </code>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/70 border-slate-700/50 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <CodeBracketIcon className="h-8 w-8 text-blue-400" />
            <Title className="text-xl text-white">GitLab Projects</Title>
          </div>
          <Button
            icon={ArrowPathIcon}
            variant="secondary"
            size="xs"
            onClick={fetchProjects}
            loading={loading}
          >
            Refresh
          </Button>
        </div>
        
        <Select
          value={selectedProject}
          onValueChange={handleProjectChange}
          className="mt-4"
        >
          <SelectItem value="">Select a project</SelectItem>
          {projects.map((project) => (
            <SelectItem 
              key={project.id} 
              value={project.id.toString()}
              className="hover:bg-slate-700/50"
            >
              <div className="flex flex-col">
                <span className="font-medium">{project.name}</span>
                <span className="text-sm text-gray-400">
                  Last activity: {formatDate(project.last_activity_at)}
                </span>
              </div>
            </SelectItem>
          ))}
        </Select>
      </Card>

      {selectedProject && (
        <>
          <Card className="bg-slate-800/70 border-slate-700/50 text-white">
            <div className="flex items-center space-x-3 mb-4">
              <PlusIcon className="h-6 w-6 text-blue-400" />
              <Title className="text-lg text-white">Create New Issue</Title>
            </div>
            <div className="space-y-4">
              <TextInput
                placeholder="Issue Title"
                value={newIssue.title}
                onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                className="bg-slate-900/50 border-slate-700/50 text-white"
              />
              <Textarea
                placeholder="Issue Description"
                value={newIssue.description}
                onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                className="bg-slate-900/50 border-slate-700/50 text-white"
              />
              <Button
                onClick={handleCreateIssue}
                loading={loading}
                disabled={!newIssue.title}
                className="w-full bg-blue-500 hover:bg-blue-600"
              >
                Create Issue
              </Button>
            </div>
          </Card>

          <Card className="bg-slate-800/70 border-slate-700/50 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <ExclamationCircleIcon className="h-6 w-6 text-blue-400" />
                <Title className="text-lg text-white">Project Issues</Title>
              </div>
              <Button
                icon={ArrowPathIcon}
                variant="secondary"
                size="xs"
                onClick={() => fetchIssues(selectedProject)}
                loading={loading}
              >
                Refresh
              </Button>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : (
              <List className="mt-4">
                {issues.map((issue) => (
                  <ListItem key={issue.id} className="hover:bg-slate-700/30 rounded-lg p-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {getStateIcon(issue.state)}
                        <Text className="font-medium text-white">{issue.title}</Text>
                        <Badge color={issue.state === 'opened' ? 'blue' : 'green'} size="sm">
                          {issue.state}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {issue.labels.map((label, index) => (
                          <Badge key={index} color="gray" size="sm">
                            {label}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-400">
                        <span>Created: {formatDate(issue.created_at)}</span>
                        <span>Updated: {formatDate(issue.updated_at)}</span>
                      </div>
                    </div>
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => window.open(issue.web_url, '_blank')}
                      className="ml-4"
                    >
                      View
                    </Button>
                  </ListItem>
                ))}
              </List>
            )}
          </Card>
        </>
      )}
    </div>
  );
}; 