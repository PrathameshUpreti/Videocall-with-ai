'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { 
  Card, 
  Title, 
  Text, 
  Button, 
  TextInput,
  Textarea,
  Grid,
  Col,
  Divider,
  List,
  ListItem,
  Badge,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  Metric,
  ProgressBar,
  Select,
  SelectItem,
  DateRangePicker,
  BarChart,
  DonutChart,
  Flex
} from '@tremor/react';
import { toast } from 'react-toastify';
import { 
  XCircleIcon, 
  CheckCircleIcon, 
  EnvelopeIcon, 
  MagnifyingGlassIcon,
  DocumentDuplicateIcon,
  FolderIcon,
  InboxIcon,
  PaperAirplaneIcon,
  TrashIcon,
  ArrowPathIcon,
  StarIcon,
  EyeIcon,
  ArrowTopRightOnSquareIcon,
  ChartBarIcon,
  CalendarIcon,
  TagIcon,
  FunnelIcon,
  AdjustmentsHorizontalIcon,
  ClockIcon,
  BookmarkIcon,
  ArchiveBoxIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  XMarkIcon,
  MinusIcon,
  PaperClipIcon,
  DocumentIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface GmailMessage {
  id: string;
  subject: string;
  sender: string;
  date: string;
  snippet: string;
  read?: boolean;
  starred?: boolean;
  labels?: string[];
  category?: 'primary' | 'social' | 'promotions' | 'updates';
}

interface EmailStats {
  total: number;
  unread: number;
  starred: number;
  sent: number;
  category: {
    primary: number;
    social: number;
    promotions: number;
    updates: number;
  };
}

interface Email {
  id: string;
  subject: string;
  sender: string;
  preview: string;
  date: string;
  read: boolean;
  starred: boolean;
}

const GmailIntegration = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [emails, setEmails] = useState<Email[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Simulate loading emails
  useEffect(() => {
    const loadEmails = async () => {
      try {
        setIsLoading(true);
        
        // Simulate API call with a delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Mock data for demonstration
        const mockEmails: Email[] = [
          {
            id: '1',
            subject: 'Meeting Notes: Project Kickoff',
            sender: 'project-manager@example.com',
            preview: 'Here are the notes from our kickoff meeting today. Please review and provide feedback by...',
            date: '10:30 AM',
            read: false,
            starred: true
          },
          {
            id: '2',
            subject: 'Updated Design Mockups',
            sender: 'design-team@example.com',
            preview: 'Please find attached the updated design mockups for the video call interface...',
            date: 'Yesterday',
            read: true,
            starred: false
          },
          {
            id: '3',
            subject: 'API Documentation',
            sender: 'dev-team@example.com',
            preview: 'The updated API documentation is now available at the following link...',
            date: 'Jul 28',
            read: true,
            starred: false
          },
          {
            id: '4',
            subject: 'Invitation: Weekly Team Sync',
            sender: 'calendar-notifications@example.com',
            preview: 'You have been invited to the following event: Weekly Team Sync...',
            date: 'Jul 27',
            read: true,
            starred: false
          }
        ];
        
        setEmails(mockEmails);
        setIsConnected(true);
        setError(null);
      } catch (err) {
        console.error('Error loading emails:', err);
        setError('Failed to load emails. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadEmails();
  }, []);
  
  const handleConnect = async () => {
    setIsLoading(true);
    
    try {
      // Simulate connection process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock emails
      const mockEmails: Email[] = [
        {
          id: '1',
          subject: 'Meeting Notes: Project Kickoff',
          sender: 'project-manager@example.com',
          preview: 'Here are the notes from our kickoff meeting today. Please review and provide feedback by...',
          date: '10:30 AM',
          read: false,
          starred: true
        },
        {
          id: '2',
          subject: 'Updated Design Mockups',
          sender: 'design-team@example.com',
          preview: 'Please find attached the updated design mockups for the video call interface...',
          date: 'Yesterday',
          read: true,
          starred: false
        },
        {
          id: '3',
          subject: 'API Documentation',
          sender: 'dev-team@example.com',
          preview: 'The updated API documentation is now available at the following link...',
          date: 'Jul 28',
          read: true,
          starred: false
        },
        {
          id: '4',
          subject: 'Invitation: Weekly Team Sync',
          sender: 'calendar-notifications@example.com',
          preview: 'You have been invited to the following event: Weekly Team Sync...',
          date: 'Jul 27',
          read: true,
          starred: false
        }
      ];
      
      setEmails(mockEmails);
      setIsConnected(true);
    } catch (err) {
      console.error('Error connecting to Gmail:', err);
      setError('Failed to connect to Gmail. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRefresh = async () => {
    setIsLoading(true);
    
    try {
      // Simulate refresh
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Add a new email to the top
      setEmails(prev => [
        {
          id: 'new-1',
          subject: 'Urgent: Server Update Required',
          sender: 'system-admin@example.com',
          preview: 'We need to schedule an urgent server update to address recent security concerns...',
          date: 'Just now',
          read: false,
          starred: false
        },
        ...prev
      ]);
    } catch (err) {
      console.error('Error refreshing emails:', err);
      setError('Failed to refresh emails. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleToggleStar = (id: string) => {
    setEmails(prev => 
      prev.map(email => 
        email.id === id 
          ? { ...email, starred: !email.starred } 
          : email
      )
    );
  };
  
  const handleMarkAsRead = (id: string) => {
    setEmails(prev => 
      prev.map(email => 
        email.id === id 
          ? { ...email, read: true } 
          : email
      )
    );
  };

  if (isLoading && !isConnected) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-blue-200">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mb-4"></div>
        <Text>Connecting to Gmail...</Text>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <EnvelopeIcon className="h-16 w-16 text-blue-400 mb-4" />
        <Title className="text-xl text-white mb-2">Connect to Gmail</Title>
        <Text className="text-blue-200 mb-6 text-center">
          Link your Gmail account to access your emails directly from your calls
        </Text>
        
        {error && (
          <div className="bg-red-900/50 border border-red-700 p-3 rounded-lg text-red-200 mb-4 w-full">
            {error}
          </div>
        )}
        
        <Button 
          onClick={handleConnect} 
          icon={EnvelopeIcon}
          color="blue"
          size="lg"
        >
          Connect Gmail Account
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/70 border-slate-700/50 text-white">
        <Flex justifyContent="between" alignItems="center" className="mb-4">
          <Title className="text-white flex items-center">
            <EnvelopeIcon className="h-5 w-5 text-blue-400 mr-2" />
            Inbox
          </Title>
          <Flex justifyContent="end" alignItems="center" className="space-x-2">
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
            <Button 
              icon={PlusIcon} 
              variant="secondary" 
              color="blue" 
              size="xs"
            >
              Compose
            </Button>
          </Flex>
        </Flex>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <ArrowPathIcon className="h-6 w-6 text-blue-400 animate-spin" />
          </div>
        ) : emails.length > 0 ? (
          <List>
            {emails.map(email => (
              <ListItem key={email.id} className={email.read ? '' : 'bg-slate-700/30'}>
                <Flex justifyContent="start" alignItems="center" className="w-full">
                  <div className="flex-none flex items-center pr-3">
                    <button 
                      onClick={() => handleToggleStar(email.id)}
                      className={`hover:text-yellow-400 transition-colors ${email.starred ? 'text-yellow-400' : 'text-slate-500'}`}
                    >
                      <StarIcon className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div 
                    className="flex-grow cursor-pointer"
                    onClick={() => handleMarkAsRead(email.id)}
                  >
                    <Flex justifyContent="between" alignItems="center" className="w-full">
                      <div className="min-w-0">
                        <Text className={`font-medium ${email.read ? 'text-blue-200/70' : 'text-blue-200'}`}>
                          {email.subject}
                        </Text>
                        <Flex justifyContent="start" alignItems="center" className="mt-1">
                          <Text className={`text-xs truncate ${email.read ? 'text-blue-200/50' : 'text-blue-200/70'}`}>
                            <span className="font-medium">{email.sender}</span>
                            <span className="mx-1">—</span>
                            {email.preview}
                          </Text>
                        </Flex>
                      </div>
                      <div className="flex-none ml-3">
                        <Text className="text-xs text-blue-200/70">{email.date}</Text>
                        {!email.read && (
                          <div className="mt-1 w-2 h-2 bg-blue-500 rounded-full ml-auto"></div>
                        )}
                      </div>
                    </Flex>
                  </div>
                </Flex>
              </ListItem>
            ))}
          </List>
        ) : (
          <div className="text-center py-8">
            <Text className="text-blue-200/70">No emails found</Text>
          </div>
        )}
      </Card>
      
      <Card className="bg-slate-800/70 border-slate-700/50 text-white p-4">
        <Flex justifyContent="between" alignItems="center">
          <Text className="text-blue-200">Storage</Text>
          <Text className="text-blue-200/70 text-xs">2.4 GB of 15 GB used</Text>
        </Flex>
        
        <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
          <div className="bg-blue-500 h-2 rounded-full" style={{ width: '16%' }}></div>
        </div>
      </Card>
      
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-slate-800/70 border-slate-700/50 text-white p-4">
          <Flex justifyContent="center" flexDirection="col" alignItems="center">
            <InboxIcon className="h-6 w-6 text-blue-400 mb-2" />
            <Text className="text-blue-200 text-sm">Inbox</Text>
            <Badge color="blue" size="xs" className="mt-1">24</Badge>
          </Flex>
        </Card>
        
        <Card className="bg-slate-800/70 border-slate-700/50 text-white p-4">
          <Flex justifyContent="center" flexDirection="col" alignItems="center">
            <StarIcon className="h-6 w-6 text-yellow-400 mb-2" />
            <Text className="text-blue-200 text-sm">Starred</Text>
            <Badge color="yellow" size="xs" className="mt-1">5</Badge>
          </Flex>
        </Card>
        
        <Card className="bg-slate-800/70 border-slate-700/50 text-white p-4">
          <Flex justifyContent="center" flexDirection="col" alignItems="center">
            <PaperAirplaneIcon className="h-6 w-6 text-green-400 mb-2" />
            <Text className="text-blue-200 text-sm">Sent</Text>
            <Badge color="green" size="xs" className="mt-1">12</Badge>
          </Flex>
        </Card>
      </div>
    </div>
  );
};

export default GmailIntegration; 