'use client';

import React, { useState, useEffect } from 'react';
import MCPIntegration from '@/components/MCPIntegration';
import Link from 'next/link';
import { ArrowLeftIcon, HomeIcon, EnvelopeIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

export default function MCPPage() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-slate-900 via-indigo-950 to-blue-950 text-white">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 px-4 py-8 md:py-12">
        {/* Header with navigation */}
        <div className="max-w-7xl mx-auto mb-8">
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={isLoaded ? { opacity: 1, y: 0 } : {}} 
            transition={{ duration: 0.5 }}
            className="flex justify-between items-center mb-12"
          >
            <div className="flex items-center">
              <Link 
                href="/" 
                className="group flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-300"
              >
                <ArrowLeftIcon className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
                <span>Back to Video Call</span>
              </Link>
            </div>
            
            <Link 
              href="/" 
              className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-300"
            >
              <HomeIcon className="w-5 h-5" />
            </Link>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={isLoaded ? { opacity: 1, y: 0 } : {}} 
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-center mb-12"
          >
            <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-4">
              Multi-Channel Platform
            </h1>
            <p className="text-xl text-blue-100/80 max-w-2xl mx-auto">
              Manage your communications across Gmail and Gitlab from a single interface
            </p>
          </motion.div>

          {/* Feature Cards */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={isLoaded ? { opacity: 1, y: 0 } : {}} 
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16"
          >
            <div className="group p-6 rounded-xl bg-gradient-to-br from-indigo-800/50 to-blue-900/50 backdrop-blur-md border border-indigo-500/30 hover:border-indigo-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10">
              <EnvelopeIcon className="w-10 h-10 text-indigo-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-semibold text-white mb-2">Gmail Integration</h3>
              <p className="text-blue-200/70">Access your emails, compose new messages, and manage your inbox directly from the platform.</p>
            </div>
            <div className="group p-6 rounded-xl bg-gradient-to-br from-blue-800/50 to-purple-900/50 backdrop-blur-md border border-blue-500/30 hover:border-blue-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10">
              <ChatBubbleLeftRightIcon className="w-10 h-10 text-blue-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-semibold text-white mb-2">Gitlab Integration</h3>
              <p className="text-blue-200/70">Send and receive Gitlab messages, manage conversations, and stay connected with your contacts.</p>
            </div>
          </motion.div>
        </div>
        
        {/* Main content */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }} 
          animate={isLoaded ? { opacity: 1, y: 0 } : {}} 
          transition={{ duration: 0.5, delay: 0.6 }}
          className="max-w-7xl mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-slate-800/70 to-slate-900/70 border border-slate-700/50 backdrop-blur-md shadow-xl"
        >
          <MCPIntegration />
        </motion.div>
        
        {/* Footer */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={isLoaded ? { opacity: 1 } : {}} 
          transition={{ duration: 0.5, delay: 0.8 }}
          className="max-w-7xl mx-auto mt-16 pt-8 border-t border-slate-700/50"
        >
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-slate-400">
              &copy; 2025 Marina App |  Integration
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="/mcp/help" className="text-sm text-slate-400 hover:text-white transition-colors">Help</Link>
              <Link href="/mcp/settings" className="text-sm text-slate-400 hover:text-white transition-colors">Settings</Link>
              <a href="https://github.com/yourusername/video_call_app" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-400 hover:text-white transition-colors">GitHub</a>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
} 