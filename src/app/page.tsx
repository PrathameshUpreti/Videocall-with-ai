"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { VideoCallOptions } from '@/components/VideoCallOptions';
import { VideoCall } from '@/components/VideoCall';
import { io } from 'socket.io-client';
import { Socket } from 'socket.io-client';

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inCall, setInCall] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [roomInfo, setRoomInfo] = useState<{
    id: string;
    username: string;
    isCreator: boolean;
  } | null>(null);
  const [serverHealthy, setServerHealthy] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Clear any stale room data on first page load
  useEffect(() => {
    if (isFirstLoad) {
      // On initial page load, always start fresh unless explicitly told to auto-rejoin
      const shouldAutoRejoin = localStorage.getItem('autoRejoin') === 'true';
      const preventAutoRejoin = localStorage.getItem('preventAutoRejoin') === 'true';
      
      console.log("First page load, should auto-rejoin:", shouldAutoRejoin, "prevent auto-rejoin:", preventAutoRejoin);
      
      // If we shouldn't auto-rejoin or if explicitly prevented, clear all room data
      if (!shouldAutoRejoin || preventAutoRejoin) {
        console.log("Clearing any stale room info");
        localStorage.removeItem('roomInfo');
        localStorage.removeItem('autoRejoin');
        localStorage.removeItem('preventAutoRejoin');
      }
      
      setIsFirstLoad(false);
    }
  }, [isFirstLoad]);

  // Load call state from localStorage on component mount
  useEffect(() => {
    // Check if we're coming from a direct link or if auto-rejoin is enabled
    const autoRejoin = localStorage.getItem('autoRejoin') === 'true';
    const preventAutoRejoin = localStorage.getItem('preventAutoRejoin') === 'true';
    
    console.log("Checking if should auto-rejoin:", autoRejoin, "prevent:", preventAutoRejoin);
    
    // Only auto-rejoin if specifically enabled AND not explicitly prevented
    if (autoRejoin && !preventAutoRejoin) {
      const savedRoomInfo = localStorage.getItem('roomInfo');
      if (savedRoomInfo) {
        try {
          const parsedRoomInfo = JSON.parse(savedRoomInfo);
          console.log("Auto-rejoining room:", parsedRoomInfo.id);
          setRoomInfo(parsedRoomInfo);
          setInCall(true);
          // Reset the flags
          localStorage.removeItem('autoRejoin');
          localStorage.removeItem('preventAutoRejoin');
        } catch (error) {
          console.error("Failed to parse saved room info:", error);
          localStorage.removeItem('roomInfo');
          localStorage.removeItem('autoRejoin');
          localStorage.removeItem('preventAutoRejoin');
        }
      } else {
        console.log("No saved room info found, cannot auto-rejoin");
        localStorage.removeItem('autoRejoin');
      }
    } else {
      console.log("Not auto-rejoining room");
    }
  }, []);

  // Add this effect to hide the navbar when in a call
  useEffect(() => {
    if (inCall) {
      // Add a class to body to hide navbar when in video call
      document.body.classList.add('hide-navbar');
      
      // Save room info to localStorage when entering a call
      if (roomInfo) {
        localStorage.setItem('roomInfo', JSON.stringify(roomInfo));
        // Don't set autoRejoin here - only set it when user is refreshing
      }
    } else {
      // Remove the class when not in a call
      document.body.classList.remove('hide-navbar');
      // Clear saved room info when leaving a call
      localStorage.removeItem('roomInfo');
      localStorage.removeItem('autoRejoin');
    }
    
    // Cleanup function
    return () => {
      document.body.classList.remove('hide-navbar');
    };
  }, [inCall, roomInfo]);

  // Add beforeunload event handler to warn when refreshing during a call
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (inCall) {
        // Set flag to auto-rejoin on refresh if user was in a call
        localStorage.setItem('autoRejoin', 'true');
        
        const message = "You are currently in a call. If you refresh, you may be disconnected. Are you sure you want to leave?";
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [inCall]);

  useEffect(() => {
    // Check URL parameters - if we have a clean load with no params, clear all room state
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('join') !== 'true' && !urlParams.get('room')) {
      console.log("Clean app load, clearing any room state");
      localStorage.removeItem('roomInfo');
      localStorage.removeItem('autoRejoin');
      localStorage.removeItem('preventAutoRejoin');
    }
    
    // Use dynamic hostname detection instead of hardcoded IP
    // This will automatically work both on computer and mobile devices
    const hostname = window.location.hostname; // Gets current hostname (IP or domain)
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    const port = '3001'; // Server port
    const socketUrl = `${protocol}://${hostname}:${port}`;
    
    console.log("Connecting to socket at:", socketUrl);
    
    // First check if the server is actually running before trying to connect
    fetch(`${socketUrl}/healthcheck`)
      .then(response => {
        if (response.ok) {
          console.log("Server is healthy, connecting socket");
          setServerHealthy(true);
          initializeSocket(socketUrl);
          
          // If we're reconnecting from a refresh during a call, rejoin the room
          if (roomInfo) {
            console.log("Reconnecting to room after page refresh:", roomInfo.id);
            // We'll handle the actual room rejoining in the socket.on('connect') handler
          }
        } else {
          throw new Error("Server healthcheck failed");
        }
      })
      .catch(error => {
        console.error("Server healthcheck error:", error);
        setConnectionError(`Cannot connect to video server at ${socketUrl}. Please make sure the server is running.`);
        setIsLoading(false);
      });
    
    // Initialize the socket connection
    const initializeSocket = (url: string) => {
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 5;
      
      const newSocket = io(url, {
        transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        timeout: 20000, // Increase timeout for mobile networks
        autoConnect: true,
        forceNew: true, // Force a new connection 
        query: {
          // Add client information to the connection query
          userAgent: navigator.userAgent,
          timestamp: Date.now().toString()
        }
      });
      
      newSocket.on('connect', () => {
        console.log("Socket connected successfully with ID:", newSocket.id);
        setConnectionError(null);
        setIsLoading(false);
        
        // Send client info to server for better debugging
        const clientInfo = {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          url: window.location.href,
          screenSize: `${window.screen.width}x${window.screen.height}`,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          networkType: (navigator as any).connection ? (navigator as any).connection.effectiveType : 'unknown'
        };
        console.log("Sending client info:", clientInfo);
        newSocket.emit('client-info', clientInfo);
        
        // Automatically rejoin the room if we're reconnecting after a refresh
        const savedRoomInfo = localStorage.getItem('roomInfo');
        if (savedRoomInfo && inCall) {
          try {
            const parsedRoomInfo = JSON.parse(savedRoomInfo);
            console.log("Rejoining room after reconnection:", parsedRoomInfo.id);
            
            // Emit join-room event to reconnect to the same room
            newSocket.emit('join-room', {
              roomId: parsedRoomInfo.id,
              username: parsedRoomInfo.username
            });
          } catch (error) {
            console.error("Failed to parse saved room info for reconnection:", error);
          }
        }
        
        // Set up ping/pong to keep connection alive
        const pingInterval = setInterval(() => {
          if (newSocket.connected) {
            newSocket.emit('ping');
          }
        }, 10000);
        
        return () => clearInterval(pingInterval);
      });
      
      newSocket.on('connect_error', (error) => {
        console.error("Socket connection error:", error);
        reconnectAttempts++;
        
        if (reconnectAttempts >= maxReconnectAttempts) {
          setConnectionError(`Failed to connect to the video server. Please check your network connection. Error: ${error.message}`);
          setIsLoading(false);
        }
      });
      
      newSocket.on('disconnect', (reason) => {
        console.log("Socket disconnected:", reason);
        if (reason === 'io server disconnect') {
          // the disconnection was initiated by the server, reconnect manually
          newSocket.connect();
        }
      });
      
      // Handle pong response
      newSocket.on('pong', () => {
        console.log('Received pong from server');
      });
      
      setSocket(newSocket);
    };
    
    // Cleanup function
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, []);

  const handleJoinRoom = useCallback((roomId: string, username: string, isCreator: boolean) => {
    // Normalize the room ID by trimming whitespace to ensure consistent handling
    const normalizedRoomId = roomId.trim(); 
    setRoomInfo({
      id: normalizedRoomId,
      username,
      isCreator
    });
    setInCall(true);
  }, []);

  const handleLeaveRoom = useCallback(() => {
    // Clear the localStorage state when intentionally leaving
    localStorage.removeItem('roomInfo');
    localStorage.removeItem('autoRejoin');
    // Set a flag to explicitly indicate we don't want to auto-rejoin
    localStorage.setItem('preventAutoRejoin', 'true');
    
    setInCall(false);
    setRoomInfo(null);
    
    // Notify the server that we're leaving the room
    if (socket) {
      socket.emit('leave-room');
    }
    
    console.log("User explicitly left room, clearing all room state");
  }, [socket]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#101112]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }
  
  if (connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#101112]">
        <div className="bg-red-800 text-white p-4 rounded-lg max-w-md">
          <h2 className="font-bold text-xl mb-2">Connection Error</h2>
          <p>{connectionError}</p>
          <div className="mt-4 flex gap-2">
            <button 
              className="bg-white text-red-800 px-4 py-2 rounded"
              onClick={() => window.location.reload()}
            >
              Retry Connection
            </button>
            <button 
              className="bg-gray-700 text-white px-4 py-2 rounded"
              onClick={() => {
                // Try to connect to localhost if not already
                if (window.location.hostname !== 'localhost') {
                  window.location.href = 'http://localhost:3000';
                }
              }}
            >
              Try Localhost
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen relative">
      {(!inCall || new URLSearchParams(window.location.search).get('force_options') === 'true') ? (
        <VideoCallOptions onJoinRoom={handleJoinRoom} />
      ) : (
        roomInfo && socket && (
          <VideoCall
            socket={socket}
            roomId={roomInfo.id}
            username={roomInfo.username}
            onLeaveRoom={handleLeaveRoom}
            isCreator={roomInfo.isCreator}
          />
        )
      )}
    </main>
  );
}
