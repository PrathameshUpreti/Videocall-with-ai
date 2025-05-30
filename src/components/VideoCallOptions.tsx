"use client";

import { useState, useCallback, useEffect } from 'react';
import { Card, Tab, TabGroup, TabList, TabPanel, TabPanels } from '@tremor/react';
import Image from 'next/image';
import { useAuth, User } from '@/contexts/AuthContext';
import { ResearchStatusResponse } from '@/types/research';

interface VideoCallOptionsProps {
  onJoinRoom: (roomId: string, username: string, isCreator: boolean) => void;
}

export const VideoCallOptions = ({ onJoinRoom }: VideoCallOptionsProps) => {
  const [view, setView] = useState<'options' | 'create' | 'join'>('options');
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [isTestingDevices, setIsTestingDevices] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const authUser = user as User | null;
  const [uiRating, setUiRating] = useState<number | null>(null);
  const [usabilityRating, setUsabilityRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  
  // Startup idea search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [currentResearchId, setCurrentResearchId] = useState<string | null>(null);
  const [researchStatus, setResearchStatus] = useState<ResearchStatusResponse | null>(null);
  
  // Demo/placeholder results
  const [searchResults, setSearchResults] = useState<{
    title: string;
    description: string;
    potential: 'High' | 'Medium' | 'Low';
    devTime: string;
    fundingTrend: string;
  }[]>([
    {
      title: "AI-Powered Content Moderation",
      description: "Automated system for detecting and filtering inappropriate content across social platforms",
      potential: "High",
      devTime: "6 months",
      fundingTrend: "$2.4M avg"
    },
    {
      title: "Sustainable Packaging Marketplace",
      description: "Connect eco-friendly packaging producers with businesses looking to reduce environmental impact",
      potential: "Medium",
      devTime: "4 months",
      fundingTrend: "$1.2M avg"
    }
  ]);

  // Add state for report content
  const [reportContent, setReportContent] = useState<string | null>(null);

  // Automatically fetch the final report when research is completed
  useEffect(() => {
    if (
      currentResearchId &&
      researchStatus?.status === 'completed' &&
      researchStatus.files &&
      researchStatus.files['final_startup_evaluation.md']
    ) {
      fetch(`http://localhost:9001/api/startup-research/file/${currentResearchId}/final_startup_evaluation.md`)
        .then(res => res.text())
        .then(setReportContent)
        .catch(() => setReportContent('Could not load final report.'));
    }
  }, [currentResearchId, researchStatus]);

  // Set username from auth context if logged in, otherwise use localStorage
  useEffect(() => {
    if (isAuthenticated && authUser?.username) {
      setUsername(authUser.username);
    } else {
      const savedUsername = localStorage.getItem('video-call-username');
      if (savedUsername) {
        setUsername(savedUsername);
      }
    }
  }, [isAuthenticated, authUser]);

  // Add this effect to track scroll progress
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollTop = document.documentElement.scrollTop;
      const progress = (scrollTop / scrollHeight) * 100;
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Using useCallback to stabilize the function
  const generateRandomId = useCallback(() => {
    // Use more stable random ID generation
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const charactersLength = characters.length;
    
    // Generate an 8-character random ID
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    
    return result;
  }, []);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (username) {
      // Save username to local storage if not authenticated
      if (!isAuthenticated) {
        localStorage.setItem('video-call-username', username);
      }
      
      // Generate a random room ID
      const randomId = generateRandomId();
      onJoinRoom(randomId, username, true);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId && username) {
      // Save username to local storage if not authenticated
      if (!isAuthenticated) {
        localStorage.setItem('video-call-username', username);
      }
      
      // Normalize the room ID by trimming whitespace
      const normalizedRoomId = roomId.trim();
      onJoinRoom(normalizedRoomId, username, false);
    }
  };

  const generateRoomId = () => {
    const randomId = generateRandomId();
    setRoomId(randomId);
  };

  const testDevices = async () => {
    setIsTestingDevices(true);
    setDeviceError(null);
    
    try {
      // Check if we can access the camera and microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      // Stop the stream immediately
      stream.getTracks().forEach(track => track.stop());
      
      // Feedback that devices are working
      setDeviceError("✅ Camera and microphone are working properly.");
      
      // Clear the success message after 3 seconds
      setTimeout(() => {
        setDeviceError(null);
      }, 3000);
      
    } catch (error) {
      console.error('Error testing devices:', error);
      if (error instanceof Error) {
        setDeviceError(`❌ Device access error: ${error.message}`);
      } else {
        setDeviceError("❌ Could not access camera or microphone. Please check your permissions.");
      }
    } finally {
      setIsTestingDevices(false);
    }
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call to submit feedback
    setTimeout(() => {
      console.log('Feedback submitted:', {
        uiRating,
        usabilityRating,
        feedbackText
      });
      
      // Reset form
      setIsSubmitting(false);
      setFeedbackSubmitted(true);
      
      // Show success message temporarily
      setTimeout(() => {
        setFeedbackSubmitted(false);
        setUiRating(null);
        setUsabilityRating(null);
        setFeedbackText('');
      }, 3000);
    }, 1000);
  };
  
  // Import startup research API 
  const handleStartupSearch = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); // Prevent any default behavior
    
    if (!searchQuery) return;
    
    setIsSearching(true);
    setCurrentResearchId(null);
    setResearchStatus(null);
    
    try {
      // Start a new research
      const response = await fetch('http://localhost:9001/api/startup-research/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idea: searchQuery }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start research');
      }
      
      if (!data.research_id) {
        throw new Error('Invalid response: missing research_id');
      }
      
      setCurrentResearchId(data.research_id);
      setResearchStatus({
        status: 'in_progress',
        progress: 0
      });
      
      // Begin polling for status
      pollResearchStatus(data.research_id);
      
    } catch (error) {
      console.error('Error starting research:', error);
      setIsSearching(false);
      setResearchStatus({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to start research'
      });
    }
  };
  
  // Poll for research status
  const pollResearchStatus = (researchId: string) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`http://localhost:9001/api/startup-research/status/${researchId}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to get research status');
        }
        
        setResearchStatus(data);
        
        // If research is still in progress, continue polling
        if (data.status === 'in_progress') {
          setTimeout(checkStatus, 3000); // Poll every 3 seconds
        } else {
          setIsSearching(false);
        }
      } catch (error) {
        console.error('Error polling research status:', error);
        setIsSearching(false);
        setResearchStatus({
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to get research status'
        });
      }
    };
    
    // Start polling
    checkStatus();
  };

  // Handle opening research file
  const handleOpenResearchFile = async (fileName: string) => {
    if (!currentResearchId) return;
    
    try {
      const response = await fetch(`http://localhost:9001/api/startup-research/file/${currentResearchId}/${fileName}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch report: ${response.statusText}`);
      }
      
      const content = await response.text();
      
      if (!content) {
        throw new Error('Empty response received');
      }
      
      setReportContent(content);
      
    } catch (error) {
      console.error('Error fetching report:', error);
      setResearchStatus({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to fetch report'
      });
      setReportContent(null);
    }
  };

  // Display the initial options screen
  return (
    <div className="min-h-screen bg-[#101112] flex flex-col items-center justify-center p-4">
      <div className="fixed top-0 left-0 right-0 h-1 z-50">
        <div 
          className="h-full bg-blue-500"
          style={{ width: `${scrollProgress}%`, transition: 'width 0.2s' }}
        />
      </div>
      <div className="w-full max-w-4xl flex flex-col md:flex-row gap-8 items-center">
        {/* Left side brand and info */}
        <div className="flex-1 text-white">
          <div className="flex items-center mb-4">
            <h1 className="text-4xl font-bold text-white">Marina</h1>
            <div className="ml-3 bg-blue-600 text-white px-2 py-1 rounded text-xs">
              VC
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Make calls with AI</h2>
          <p className="text-gray-400 mb-6">
            Full AI-powered video call app with Jira and Gmail integrations. 
            Includes both desktop and mobile versions.
          </p>
          
          <div className="bg-[#18191b] p-4 rounded-lg mb-6">
            <h3 className="text-lg text-white mb-2 font-semibold">Features</h3>
            <ul className="text-gray-400 space-y-2">
              <li className="flex items-start">
                <svg className="h-5 w-5 text-blue-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Real-time video calls with up to 8 participants
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-blue-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Meeting summaries and transcription
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-blue-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Screen sharing and chat
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-blue-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Jira and GitLab integrations
              </li>
            </ul>
          </div>
          
          <button 
            onClick={testDevices} 
            disabled={isTestingDevices}
            className="w-full md:w-auto border border-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-800 transition-colors flex items-center justify-center"
          >
            {isTestingDevices ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Testing...
              </>
            ) : (
              <>
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 16l-5-5 1.41-1.41L11 13.17l7.59-7.59L20 7l-9 9z"/>
                </svg>
                Test Camera & Mic
              </>
            )}
          </button>
          
          {deviceError && (
            <div className={`mt-4 p-3 rounded ${deviceError.startsWith('✅') ? 'bg-green-900' : 'bg-red-900'}`}>
              {deviceError}
            </div>
          )}
        </div>

        {/* Right side with options */}
        <div className="w-full md:w-[440px] bg-[#18191b] rounded-lg p-6 shadow-xl">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center text-white mb-8">
              Video Conference
            </h2>
            
            <div className="space-y-4">
              <button
                onClick={() => setView('create')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md transition-colors flex items-center justify-center"
              >
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                New Meeting
              </button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-[#18191b] text-gray-400">or</span>
                </div>
              </div>
              
              <button
                onClick={() => setView('join')}
                className="w-full border border-gray-600 text-white py-3 px-4 rounded-md hover:bg-gray-800 transition-colors flex items-center justify-center"
              >
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h5a2 2 0 012 2v1h3a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                Join Meeting
              </button>
            </div>
            
            <div className="mt-8 flex justify-center space-x-6">
              <button className="text-gray-400 hover:text-white flex items-center text-sm">
                <svg className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Help
              </button>
              <button className="text-gray-400 hover:text-white flex items-center text-sm">
                <svg className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                Settings
              </button>
            </div>
          </div>

          {view === 'create' && (
            <div>
              <h2 className="text-2xl font-bold text-center text-white mb-6">Create New Meeting</h2>
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={`w-full px-3 py-2 bg-[#242526] border border-gray-700 rounded-md text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isAuthenticated ? 'opacity-80' : ''}`}
                    placeholder="Enter your name"
                    required
                    readOnly={isAuthenticated}
                  />
                  {isAuthenticated && (
                    <p className="mt-1 text-xs text-gray-400">Using your account username</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!username}
                  className={`w-full py-3 px-4 rounded-md flex items-center justify-center ${
                    username ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-800 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Start Meeting
                </button>
                <button
                  type="button"
                  onClick={() => setView('options')}
                  className="w-full bg-gray-700 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors mt-2"
                >
                  Back
                </button>
              </form>
            </div>
          )}

          {view === 'join' && (
            <div>
              <h2 className="text-2xl font-bold text-center text-white mb-6">Join Meeting</h2>
              <form onSubmit={handleJoinRoom} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={`w-full px-3 py-2 bg-[#242526] border border-gray-700 rounded-md text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isAuthenticated ? 'opacity-80' : ''}`}
                    placeholder="Enter your name"
                    required
                    readOnly={isAuthenticated}
                  />
                  {isAuthenticated && (
                    <p className="mt-1 text-xs text-gray-400">Using your account username</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Room Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                      className="flex-1 px-3 py-2 bg-[#242526] border border-gray-700 rounded-md text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter room code"
                      required
                    />
                    <button
                      type="button"
                      onClick={generateRoomId}
                      className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
                    >
                      Generate
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!roomId || !username}
                  className={`w-full py-3 px-4 rounded-md flex items-center justify-center ${
                    roomId && username ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-800 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                  Join Room
                </button>
                <button
                  type="button"
                  onClick={() => setView('options')}
                  className="w-full bg-gray-700 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors mt-2"
                >
                  Back
                </button>
              </form>
            </div>
          )}
          
          {/* Preview Image similar to the mockup */}
          {view === 'options' && (
            <div className="mt-8 bg-[#222326] p-2 rounded-md">
              <div className="relative aspect-video rounded overflow-hidden">
                <div className="absolute top-0 right-0 left-0 bg-[#222326] flex justify-between items-center p-1 text-xs text-gray-400">
                  <span>MarinaCall</span>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1 mt-4">
                  <div className="relative bg-gray-900 aspect-video rounded overflow-hidden">
                    <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 py-0.5 rounded">
                      You
                    </div>
                  </div>
                  <div className="relative bg-gray-900 aspect-video rounded overflow-hidden">
                    <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 py-0.5 rounded">
                      Alex
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-8 text-gray-500 text-sm">
        © 2025 Marina. All rights reserved.
      </div>
      
      {/* Startup Research Section */}
      <div id="startup-evaluation" className="mt-16 pt-16 border-t border-gray-800 w-full max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h2 className="text-4xl font-bold mt-4 mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Startup Research Engine
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto">
            Enter any startup idea to get comprehensive AI-powered research and analysis.
          </p>
        </div>
        
        {/* Research Interface */}
        <div className="mt-8">
          <div className="space-y-4">
            <div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter your startup idea..."
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            
            <button
              onClick={handleStartupSearch}
              disabled={isSearching || !searchQuery}
              className={`w-full px-6 py-3 rounded-lg font-semibold text-white ${
                isSearching || !searchQuery
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
              }`}
            >
              {isSearching ? 'Researching...' : 'Start Research'}
            </button>
          </div>

          {/* Research Status */}
          {isSearching && (
            <div className="mt-8 text-center">
              <div className="inline-block p-4 bg-gray-800 rounded-lg">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-blue-300 text-sm">
                  {researchStatus?.status === 'in_progress' 
                    ? `Research in progress... ${researchStatus.progress || 0}% complete`
                    : researchStatus?.status === 'error' 
                      ? `Error: ${researchStatus.error || 'Something went wrong'}`
                      : 'Processing results...'}
                </p>
              </div>
            </div>
          )}

          {/* Research Results */}
          {currentResearchId && researchStatus?.status === 'completed' && researchStatus.files && (
            <div className="mt-8">
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
                <h5 className="text-white text-lg mb-2">Research Report Available</h5>
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {Object.keys(researchStatus.files).map(fileName => (
                    <button
                      key={fileName}
                      onClick={() => handleOpenResearchFile(fileName)}
                      className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                    >
                      {fileName}
                    </button>
                  ))}
                </div>
                
                {/* Automatically Display Final Report Content */}
                {reportContent && (
                  <div className="mt-4 p-4 bg-gray-900 rounded-lg">
                    <h6 className="text-white text-lg mb-2">Final Report</h6>
                    <pre className="text-gray-300 whitespace-pre-wrap font-mono text-sm">
                      {reportContent}
                    </pre>
                  </div>
                )}
                
                {/* Error Display */}
                {researchStatus && researchStatus.status === 'error' && (
                  <div className="mt-4 p-4 bg-red-900/50 border border-red-700 rounded-lg">
                    <p className="text-red-300">{researchStatus.error}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Keep the scroll button but remove the startup-feedback-form reference */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end">
        {scrollProgress < 20 && (
          <div className="bg-blue-800 text-white text-sm py-1 px-3 rounded-lg mb-2 animate-pulse">
            Try our AI research tool
          </div>
        )}
        <button
          onClick={() => {
            document.getElementById('startup-evaluation')?.scrollIntoView({ 
              behavior: 'smooth',
              block: 'start'
            });
          }}
          className={`bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors flex items-center justify-center ${
            scrollProgress < 20 ? 'animate-bounce' : ''
          }`}
          aria-label="Scroll to AI research tool"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </div>
    </div>
  );
}; 