'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card,
  Title,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  Divider,
  ProgressBar,
  Metric,
  Text,
  Grid,
  Col,
  Flex,
  Button
} from '@tremor/react';
import GmailIntegration from './GmailIntegration';
import { GitLabIntegration } from './GitLabIntegration';
import { 
  EnvelopeIcon, 
  CodeBracketIcon, 
  Cog6ToothIcon, 
  CloudIcon,
  ArrowPathIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

export default function MCPIntegration() {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<{
    gmail: 'connected' | 'disconnected' | 'checking',
    gitlab: 'connected' | 'disconnected' | 'checking'
  }>({
    gmail: 'checking',
    gitlab: 'checking'
  });
  
  // Check connection status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [gmailRes, gitlabRes] = await Promise.all([
          fetch('/mcp/gmail/status'),
          fetch('/mcp/gitlab/status')
        ]);
        
        const gmailData = await gmailRes.json();
        const gitlabData = await gitlabRes.json();
        
        setConnectionStatus({
          gmail: gmailData.authenticated ? 'connected' : 'disconnected',
          gitlab: gitlabData.authenticated ? 'connected' : 'disconnected'
        });
      } catch (error) {
        console.error('Error checking connection status:', error);
        setConnectionStatus({
          gmail: 'disconnected',
          gitlab: 'disconnected'
        });
      } finally {
        setLoading(false);
      }
    };
    
    checkStatus();
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <Card className="w-full bg-slate-800/70 border-slate-700/50 text-white shadow-xl overflow-hidden backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center space-x-3">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ 
                duration: 0.4, 
                delay: 0.2,
                type: "spring",
                stiffness: 300
              }}
            >
              <CloudIcon className="h-8 w-8 text-blue-400" />
            </motion.div>
            <div>
              <Title className="text-xl text-white">Multi-Channel Platform (MCP)</Title>
              <Text className="text-sm text-blue-200/70">Seamlessly connect with your communication and development tools</Text>
            </div>
          </div>
          
          {loading ? (
            <div className="flex items-center">
              <ArrowPathIcon className="h-5 w-5 text-blue-400 animate-spin mr-2" />
              <Text className="text-blue-200">Checking connections...</Text>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="flex space-x-2"
            >
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2, delay: 0.4 }}
                className="flex items-center mr-2"
              >
                <motion.div 
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [1, 0.8, 1]
                  }}
                  transition={{
                    duration: 0.8, 
                    repeat: 3,
                    repeatType: "reverse"
                  }}
                  className={`h-2 w-2 rounded-full mr-1 ${connectionStatus.gmail === 'connected' ? 'bg-emerald-500' : 'bg-red-500'}`}
                ></motion.div>
                <Text className="text-xs text-blue-200">Gmail</Text>
              </motion.div>
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2, delay: 0.6 }}
                className="flex items-center"
              >
                <motion.div 
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [1, 0.8, 1]
                  }}
                  transition={{
                    duration: 0.8, 
                    repeat: 3,
                    repeatType: "reverse",
                    delay: 0.2
                  }}
                  className={`h-2 w-2 rounded-full mr-1 ${connectionStatus.gitlab === 'connected' ? 'bg-emerald-500' : 'bg-red-500'}`}
                ></motion.div>
                <Text className="text-xs text-blue-200">GitLab</Text>
              </motion.div>
            </motion.div>
          )}
        </motion.div>
        
        <TabGroup index={activeTab} onIndexChange={setActiveTab}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <TabList variant="solid" className="mb-6 bg-slate-900/80 border border-slate-700/50 p-1 rounded-lg">
              <Tab 
                icon={EnvelopeIcon} 
                className="transition-all duration-300 rounded-md text-blue-200"
              >
                <div className="flex items-center">
                  <span>Gmail</span>
                  {connectionStatus.gmail === 'connected' && (
                    <motion.span 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-2 inline-flex h-2 w-2 rounded-full bg-emerald-500"
                    ></motion.span>
                  )}
                </div>
              </Tab>
              <Tab 
                icon={CodeBracketIcon}
                className="transition-all duration-300 rounded-md text-blue-200"
              >
                <div className="flex items-center">
                  <span>GitLab</span>
                  {connectionStatus.gitlab === 'connected' && (
                    <motion.span 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-2 inline-flex h-2 w-2 rounded-full bg-emerald-500"
                    ></motion.span>
                  )}
                </div>
              </Tab>
              <Tab 
                icon={Cog6ToothIcon}
                className="transition-all duration-300 rounded-md text-blue-200"
              >
                Settings
              </Tab>
            </TabList>
          </motion.div>
          
          {loading ? (
            <div className="py-12 text-center">
              <div className="max-w-sm mx-auto">
                <Text className="text-center mb-4 text-blue-200">Loading your integrations...</Text>
                <ProgressBar value={65} color="blue" className="mb-2" />
                <Text className="text-xs text-blue-200/70">This may take a moment</Text>
              </div>
            </div>
          ) : (
            <TabPanels>
              <TabPanel>
                <AnimatePresence mode="wait">
                  <motion.div 
                    key="gmail-panel"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="mt-2 mb-6"
                  >
                    <GmailIntegration />
                  </motion.div>
                </AnimatePresence>
              </TabPanel>
              
              <TabPanel>
                <AnimatePresence mode="wait">
                  <motion.div 
                    key="gitlab-panel"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="mt-2 mb-6"
                  >
                    <GitLabIntegration />
                  </motion.div>
                </AnimatePresence>
              </TabPanel>
              
              <TabPanel>
                <AnimatePresence mode="wait">
                  <motion.div 
                    key="settings-panel"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="p-6 border border-slate-700/50 rounded-lg shadow-lg bg-slate-900/50 backdrop-blur-sm"
                  >
                    <div className="flex items-center mb-4">
                      <Cog6ToothIcon className="h-6 w-6 text-blue-400 mr-2" />
                      <Title className="text-lg text-white">MCP Settings</Title>
                    </div>
                    
                    <Grid numItems={1} numItemsMd={2} className="gap-6">
                      <Col>
                        <div className="space-y-4">
                          <div className="border border-indigo-500/30 rounded-lg p-5 bg-gradient-to-r from-indigo-900/40 to-blue-900/40 backdrop-blur-sm">
                            <Title className="text-white mb-2">Gmail Settings</Title>
                            <Text className="text-blue-200/70 mb-4">Configure your Gmail integration settings</Text>
                            <Button variant="secondary" size="xs">
                              Configure
                            </Button>
                          </div>
                          
                          <div className="border border-indigo-500/30 rounded-lg p-5 bg-gradient-to-r from-indigo-900/40 to-blue-900/40 backdrop-blur-sm">
                            <Title className="text-white mb-2">GitLab Settings</Title>
                            <Text className="text-blue-200/70 mb-4">Configure your GitLab integration settings</Text>
                            <Button variant="secondary" size="xs">
                              Configure
                            </Button>
                          </div>
                        </div>
                      </Col>
                      
                      <Col>
                        <div className="border border-indigo-500/30 rounded-lg p-5 bg-gradient-to-r from-indigo-900/40 to-blue-900/40 backdrop-blur-sm">
                          <Title className="text-white mb-2">Connection Status</Title>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Text className="text-blue-200">Gmail</Text>
                              <div className="flex items-center">
                                <div className={`h-2 w-2 rounded-full mr-2 ${connectionStatus.gmail === 'connected' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                <Text className="text-sm text-blue-200/70">
                                  {connectionStatus.gmail === 'connected' ? 'Connected' : 'Disconnected'}
                                </Text>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <Text className="text-blue-200">GitLab</Text>
                              <div className="flex items-center">
                                <div className={`h-2 w-2 rounded-full mr-2 ${connectionStatus.gitlab === 'connected' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                <Text className="text-sm text-blue-200/70">
                                  {connectionStatus.gitlab === 'connected' ? 'Connected' : 'Disconnected'}
                                </Text>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Col>
                    </Grid>
                  </motion.div>
                </AnimatePresence>
              </TabPanel>
            </TabPanels>
          )}
        </TabGroup>
      </Card>
    </div>
  );
} 