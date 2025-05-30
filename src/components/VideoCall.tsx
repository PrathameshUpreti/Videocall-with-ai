"use client";

import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

interface VideoCallProps {
  socket: Socket;
  roomId: string;
  username: string;
  isCreator: boolean;
  onLeaveRoom: () => void;
}

export const VideoCall = ({ socket, roomId, username, isCreator, onLeaveRoom }: VideoCallProps) => {
  const [peers, setPeers] = useState<any[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    // Initialize the video call
    const init = async () => {
      try {
        // Get local media stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        // Set local stream and display in video element
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Emit join-room event to server
        socket.emit('join-room', {
          roomId,
          username
        });

      } catch (error) {
        console.error('Error accessing media devices:', error);
      }
    };
    
    init();
    
    // Clean up on component unmount
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomId, username, socket]);
  
  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };
  
  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };
  
  // Toggle screen sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing and revert to camera
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
      }
      
      setIsScreenSharing(false);
        } catch (error) {
        console.error('Error accessing media devices:', error);
      }
    } else {
      // Start screen sharing
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });
        
        if (localStream) {
          // Keep audio from the original stream
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) {
            stream.addTrack(audioTrack);
          }
          
          // Stop original video track
          localStream.getVideoTracks().forEach(track => track.stop());
        }
        
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        setIsScreenSharing(true);
        
        // Handle when user stops screen sharing via browser UI
        stream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };
      } catch (error) {
        console.error('Error starting screen share:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1115] flex flex-col">
      {/* Header with room info */}
      <div className="bg-[#18191e] p-4 shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-white text-xl font-semibold">Room: {roomId}</h1>
          <p className="text-gray-400 text-sm">Joined as: {username} {isCreator && "(Host)"}</p>
              </div>
        <div>
            <button
            onClick={onLeaveRoom}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
          >
            Leave Call
            </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Local video */}
        <div className="relative bg-[#232428] rounded-lg overflow-hidden aspect-video">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
  playsInline
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-sm px-2 py-1 rounded">
            {username} (You)
                            </div>
          {(isMuted || isVideoOff) && (
            <div className="absolute top-2 right-2 flex space-x-1">
              {isMuted && (
                <div className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                  Muted
                </div>
              )}
              {isVideoOff && (
                <div className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                  Video Off
                            </div>
                          )}
                            </div>
                          )}
                  </div>
                  
        {/* Placeholder for remote videos */}
        {peers.length === 0 && (
          <div className="bg-[#232428] rounded-lg flex items-center justify-center aspect-video">
            <p className="text-gray-400">Waiting for others to join...</p>
                </div>
              )}
                  </div>
                  
      {/* Controls */}
      <div className="bg-[#18191e] p-4 flex justify-center space-x-4">
                            <button
          onClick={toggleAudio}
          className={`p-3 rounded-full ${isMuted ? 'bg-red-600' : 'bg-gray-700'} text-white`}
                            title={isMuted ? 'Unmute' : 'Mute'}
                          >
                            {isMuted ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                              </svg>
                            ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                              </svg>
                            )}
                          </button>
        
                          <button 
                            onClick={toggleVideo} 
          className={`p-3 rounded-full ${isVideoOff ? 'bg-red-600' : 'bg-gray-700'} text-white`}
                            title={isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
                          >
                            {isVideoOff ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
        
                      <button 
                        onClick={toggleScreenShare}
          className={`p-3 rounded-full ${isScreenSharing ? 'bg-green-600' : 'bg-gray-700'} text-white`}
          title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                      >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
        </button>
      </div>
    </div>
  );
};