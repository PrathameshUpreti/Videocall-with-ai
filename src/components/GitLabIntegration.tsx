"use client";

import React, { useState, useEffect } from 'react';
import { Button, Text, Card, Metric, Title, Flex, List, ListItem, Badge } from '@tremor/react';
import { CodeBracketIcon, DocumentTextIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface Repository {
  id: number;
  name: string;
  description: string;
  stars: number;
  forks: number;
  lastActivity: string;
}

interface GitLabUser {
  username: string;
  email: string;
  avatarUrl: string;
}

const GitLabIntegration = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [user, setUser] = useState<GitLabUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Simulate loading GitLab data
  useEffect(() => {
    const loadGitLabData = async () => {
      try {
        setIsLoading(true);
        
        // Simulate API call with a delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Mock data for demonstration
        setIsConnected(true);
        setUser({
          username: 'dev_user',
          email: 'dev@example.com',
          avatarUrl: 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'
        });
        
        setRepositories([
          {
            id: 1,
            name: 'video-call-app',
            description: 'Real-time video conferencing application with WebRTC',
            stars: 32,
            forks: 8,
            lastActivity: '2 days ago'
          },
          {
            id: 2,
            name: 'api-service',
            description: 'Backend API service for video processing',
            stars: 17,
            forks: 4,
            lastActivity: '5 days ago'
          },
          {
            id: 3,
            name: 'ui-components',
            description: 'Reusable UI component library',
            stars: 24,
            forks: 6,
            lastActivity: '1 week ago'
          }
        ]);
        
        setError(null);
      } catch (err) {
        console.error('Error loading GitLab data:', err);
        setError('Failed to load GitLab data. Please try again.');
        setIsConnected(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadGitLabData();
  }, []);
  
  const handleConnect = async () => {
    setIsLoading(true);
    
    try {
      // Simulate connection process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setIsConnected(true);
      setUser({
        username: 'dev_user',
        email: 'dev@example.com',
        avatarUrl: 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'
      });
      
      // Mock repositories
      setRepositories([
        {
          id: 1,
          name: 'video-call-app',
          description: 'Real-time video conferencing application with WebRTC',
          stars: 32,
          forks: 8,
          lastActivity: '2 days ago'
        },
        {
          id: 2,
          name: 'api-service',
          description: 'Backend API service for video processing',
          stars: 17,
          forks: 4,
          lastActivity: '5 days ago'
        },
        {
          id: 3,
          name: 'ui-components',
          description: 'Reusable UI component library',
          stars: 24,
          forks: 6,
          lastActivity: '1 week ago'
        }
      ]);
    } catch (err) {
      console.error('Error connecting to GitLab:', err);
      setError('Failed to connect to GitLab. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRefresh = async () => {
    setIsLoading(true);
    
    try {
      // Simulate refresh
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update repositories with a new entry
      setRepositories(prev => [
        {
          id: prev.length + 1,
          name: 'notification-service',
          description: 'Push notification service for mobile apps',
          stars: 12,
          forks: 3,
          lastActivity: 'Just now'
        },
        ...prev
      ]);
    } catch (err) {
      console.error('Error refreshing GitLab data:', err);
      setError('Failed to refresh GitLab data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isConnected) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-blue-200">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mb-4"></div>
        <Text>Connecting to GitLab...</Text>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <CodeBracketIcon className="h-16 w-16 text-blue-400 mb-4" />
        <Title className="text-xl text-white mb-2">Connect to GitLab</Title>
        <Text className="text-blue-200 mb-6 text-center">
          Link your GitLab account to manage repositories and issues directly from your calls
        </Text>
        
        {error && (
          <div className="bg-red-900/50 border border-red-700 p-3 rounded-lg text-red-200 mb-4 w-full">
            {error}
          </div>
        )}
        
        <Button 
          onClick={handleConnect} 
          icon={CodeBracketIcon}
          color="blue"
          size="lg"
        >
          Connect GitLab Account
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User info */}
      {user && (
        <Card className="bg-slate-800/70 border-slate-700/50 text-white">
          <Flex justifyContent="between" alignItems="center">
            <Flex justifyContent="start" alignItems="center" className="space-x-4">
              <img 
                src={user.avatarUrl} 
                alt={user.username} 
                className="h-12 w-12 rounded-full border border-slate-600"
              />
              <div>
                <Text className="text-blue-200 font-medium">{user.username}</Text>
                <Text className="text-xs text-blue-200/70">{user.email}</Text>
              </div>
            </Flex>
            <Badge color="green" size="sm">Connected</Badge>
          </Flex>
        </Card>
      )}
      
      {/* Repositories */}
      <Card className="bg-slate-800/70 border-slate-700/50 text-white">
        <Flex justifyContent="between" alignItems="center" className="mb-4">
          <Title className="text-white">Repositories</Title>
          <Button 
            onClick={handleRefresh} 
            icon={ArrowPathIcon} 
            variant="secondary" 
            color="blue" 
            size="xs"
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Flex>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <ArrowPathIcon className="h-6 w-6 text-blue-400 animate-spin" />
          </div>
        ) : repositories.length > 0 ? (
          <List>
            {repositories.map(repo => (
              <ListItem key={repo.id}>
                <Flex justifyContent="start" alignItems="center" className="space-x-3">
                  <DocumentTextIcon className="h-5 w-5 text-blue-400" />
                  <div className="flex-1 min-w-0">
                    <Text className="text-blue-200 font-medium">{repo.name}</Text>
                    <Text className="text-xs text-blue-200/70 truncate">{repo.description}</Text>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Text className="text-xs text-blue-200/70">{repo.lastActivity}</Text>
                    <div className="flex items-center space-x-1">
                      <span className="text-yellow-400 text-xs">★</span>
                      <Text className="text-xs text-blue-200/70">{repo.stars}</Text>
                    </div>
                  </div>
                </Flex>
              </ListItem>
            ))}
          </List>
        ) : (
          <div className="text-center py-8">
            <Text className="text-blue-200/70">No repositories found</Text>
          </div>
        )}
      </Card>
    </div>
  );
};

export default GitLabIntegration; 