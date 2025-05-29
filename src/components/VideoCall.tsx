"use client";

import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import { Socket } from 'socket.io-client';
import axios from 'axios';

interface VideoCallProps {
  socket: Socket;
  roomId: string;
  username: string;
  onLeaveRoom: () => void;
  isCreator: boolean;
}

interface PeerConnection {
  peer: Peer.Instance;
  username: string;
}

interface UserJoinedEvent {
  signal: any;
  from: string;
  username: string;
}

interface UserConnectedEvent {
  userId: string;
  username: string;
}

interface UserDisconnectedEvent {
  userId: string;
}

interface RoomUser {
  userId: string;
  username: string;
}

type TabType = 'meeting' | 'summary' | 'contacts' | 'chat' | 'gmail';

interface Message {
  sender: string;
  text: string;
  time: string;
}

interface GmailMessage {
  id: string;
  subject: string;
  sender: string;
  date: string;
  snippet: string;
  read: boolean;
  starred: boolean;
}

export const VideoCall = ({ socket, roomId, username, onLeaveRoom, isCreator }: VideoCallProps) => {
  // Video call states
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<{ [key: string]: PeerConnection }>({});
  const [isInitializing, setIsInitializing] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('meeting');
  const [layout, setLayout] = useState<'grid' | 'focus'>('grid');
  const [focusedUser, setFocusedUser] = useState<string | null>(null);
  const [totalParticipants, setTotalParticipants] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showCopiedNotification, setShowCopiedNotification] = useState(false);

  // Chat states
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // Recording and transcription states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioTranscript, setAudioTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Research states
  const [summaryPoints, setSummaryPoints] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [researchResults, setResearchResults] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [isResearcherOpen, setIsResearcherOpen] = useState(false);
  const [researchQuery, setResearchQuery] = useState('');
  const [researchMode, setResearchMode] = useState<'summary' | 'deep'>('summary');

  // Gmail-related states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isComposingEmail, setIsComposingEmail] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<GmailMessage | null>(null);

  // Screen sharing states
  const [screenSharingStream, setScreenSharingStream] = useState<MediaStream | null>(null);

  // Refs
  const userVideo = useRef<HTMLVideoElement>(null);
  const peersContainerRef = useRef<HTMLDivElement>(null);
  const peersRef = useRef<{ [key: string]: { peer: Peer.Instance; username: string } }>({});
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerVideoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});
  const myScreenVideo = useRef<HTMLVideoElement | null>(null);
  const myUserVideo = useRef<HTMLVideoElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Dynamic API base URL using current hostname
  const API_BASE_URL = `http://${window.location.hostname}:9000`;
  const RECORDER_API_URL = `http://${window.location.hostname}:9001`;
  console.log("API calls will use:", API_BASE_URL);
  console.log("Recorder API calls will use:", RECORDER_API_URL);

  // Add a ref for recording ID
  const recordingIdRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Add effect to update totalParticipants whenever peers object changes
  useEffect(() => {
    // Set participant count based on peers plus the current user
    setTotalParticipants(Object.keys(peers).length + 1);
    console.log("Updated participant count:", Object.keys(peers).length + 1);
  }, [peers]);

  // Update video elements when peers change
  useEffect(() => {
    // Update video elements when peers change
    console.log('Peers changed, updating video elements');
    
    // For each peer, check if we need to update the video element
    Object.entries(peersRef.current).forEach(([peerId, { peer }]) => {
      // If we have a video element reference for this peer
      if (peerVideoRefs.current[peerId]) {
        // Get the current srcObject
        const currentSrcObject = peerVideoRefs.current[peerId].srcObject;
        
        // If there's no srcObject set, try to get the stream from the peer
        if (!currentSrcObject && (peer as any)._remoteStreams && (peer as any)._remoteStreams[0]) {
          console.log('Setting srcObject for peer', peerId);
          const stream = ensureVideoTrackEnabled((peer as any)._remoteStreams[0]);
          peerVideoRefs.current[peerId].srcObject = stream;
          peerVideoRefs.current[peerId].play().catch(err => {
            console.warn("Autoplay prevented, user interaction needed:", err);
          });
        }
      }
    });
  }, [peers]);

  useEffect(() => {
    let interval: NodeJS.Timeout; // Declare interval variable
    let reconnectionTimer: NodeJS.Timeout | null = null;
    let failedInitializationAttempts = 0;
    const MAX_INITIALIZATION_ATTEMPTS = 3;
    
    const initializeStream = async () => {
      try {
        console.log("Initializing stream and connecting to room:", roomId);
        const currentStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
            // Add additional constraints for stability
            frameRate: { ideal: 30 },
            aspectRatio: { ideal: 1.333333 }
          }, 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        }).catch(err => {
          console.error("Error getting user media:", err);
          // If video fails, try with just audio
          return navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }, 
            video: false
          });
        });
        
        // Ensure the stream is properly initialized
        const enabledStream = ensureVideoTrackEnabled(currentStream);
        setStream(enabledStream);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = enabledStream;
          // Add event listeners to monitor video element state
          localVideoRef.current.onloadedmetadata = () => {
            console.log('Local video metadata loaded');
            localVideoRef.current?.play().catch(err => {
              console.warn("Autoplay prevented:", err);
            });
          };
          localVideoRef.current.onerror = (e) => {
            console.error('Local video error:', e);
            // Attempt to restore video
            if (enabledStream) {
              localVideoRef.current!.srcObject = enabledStream;
            }
          };
        }

        // Helper function to safely signal a peer
        const safeSignal = (peer: Peer.Instance | undefined, signal: any) => {
  if (!peer) return false;
  try {
    if (peer.connected) {
      console.log('Peer already connected, skipping signal');
      return true;
    }
    peer.signal(signal);
    return true;
  } catch (err) {
    console.error('Error signaling peer:', err);
    return false;
  }
};

        // Join room after stream is ready - use normalized room ID
        const normalizedRoomId = roomId.trim();
        socket.emit('join-room', { roomId: normalizedRoomId, username });
        console.log('Joining room:', normalizedRoomId, 'as:', username, 'with socket ID:', socket.id);

        // Log socket connection status
        console.log('Socket connected:', socket.connected);
        if (!socket.connected) {
          console.warn('Socket is not connected! Attempting to reconnect...');
          socket.connect();
          // If not connected after reconnect attempt, try again with delay
          if (!socket.connected) {
            if (reconnectionTimer) clearTimeout(reconnectionTimer);
            reconnectionTimer = setTimeout(() => {
              if (!socket.connected) {
                socket.connect();
                socket.emit('join-room', { roomId: normalizedRoomId, username });
              }
            }, 2000);
          }
        }

        // Set up ping/pong to keep connection alive
        if (interval) clearInterval(interval);
        interval = setInterval(() => {
          if (socket.connected) {
            socket.emit('ping');
            socket.emit('join-room', { roomId: normalizedRoomId, username });
            console.log('Ping sent to maintain connection');
          } else {
            console.warn('Socket disconnected, attempting to reconnect...');
            socket.connect();
          }
        }, 30000); // every 30 seconds

        // Handle when we receive a signal from a new peer
        socket.on('user-joined', ({ signal, from, username: peerUsername }) => {
  if (from !== socket.id && !peersRef.current[from]) {
    const peer = addPeer(signal, from, currentStream, peerUsername);
    peersRef.current[from] = { peer, username: peerUsername };
    setPeers(prevPeers => ({ ...prevPeers, [from]: { peer, username: peerUsername } }));
  }
});

        // Handle when we receive the returned signal from a peer we initiated with
        socket.on('receiving-returned-signal', ({ signal, from }) => {
  if (from !== socket.id && peersRef.current[from]) {
    const peer = peersRef.current[from].peer;
    if (!safeSignal(peer, signal)) {
      console.warn('Signal failed, removing invalid peer:', from);
      delete peersRef.current[from];
      setPeers(prevPeers => {
        const newPeers = { ...prevPeers };
        delete newPeers[from];
        return newPeers;
      });
    }
  }
});

        // Handle when a new user connects to our room
        socket.on('user-connected', ({ userId: peerId, username: peerUsername }: UserConnectedEvent) => {
          console.log('New user connected:', peerUsername, 'ID:', peerId);
          if (socket.id && peerId !== socket.id) { // Don't create peer for ourselves
            // Check if we already have this peer to avoid duplicates
            if (peersRef.current[peerId]) {
              console.log(`Peer ${peerId} already exists, not creating again`);
              return;
            }

            // Add a small delay to ensure both sides are ready
            setTimeout(() => {
              if (!socket.id) return; // Check if socket.id is still valid
              
              // Check again in case peer was created during the timeout
              if (peersRef.current[peerId]) {
                console.log(`Peer ${peerId} created during timeout, not creating again`);
                return;
              }
              
              try {
            const peer = createPeer(peerId, socket.id, currentStream, peerUsername);
            peersRef.current[peerId] = { peer, username: peerUsername };
            setPeers(prevPeers => {
              console.log("Adding peer to state, now have", Object.keys(prevPeers).length + 1, "peers");
              return {
                ...prevPeers,
                [peerId]: { peer, username: peerUsername }
              };
            });
              } catch (err) {
                console.error("Error creating peer:", err);
              }
            }, 1000);
          }
        });

        // Periodic peer status check for debugging
        interval = setInterval(() => {
          console.log("Current peers:", Object.keys(peersRef.current).length);
          console.log("Socket ID:", socket.id);
          console.log("Socket connected:", socket.connected);
          Object.entries(peersRef.current).forEach(([id, { username }]) => {
            console.log(`- Peer ${id} (${username})`);
            
            // Check connection status of each peer
            try {
              const peerConn = peersRef.current[id].peer;
              console.log(`  - Connected: ${peerConn.connected}`);
            } catch (err) {
              console.error(`  - Error checking peer ${id}:`, err);
            }
          });
        }, 10000);

        // Handle when a user disconnects - add better error handling
        socket.on('user-disconnected', ({ userId: peerId }: UserDisconnectedEvent) => {
          console.log('User disconnected:', peerId);
          if (peersRef.current[peerId]) {
            try {
              const peer = peersRef.current[peerId].peer;
              if (peer && !peer.destroyed) {
                peer.destroy();
              }
            } catch (err) {
              console.error("Error destroying peer on disconnect:", err);
            }
            
            setPeers(prevPeers => {
              const newPeers = { ...prevPeers };
              delete newPeers[peerId];
              console.log("Removing peer from state, now have", Object.keys(newPeers).length, "peers");
              return newPeers;
            });
            delete peersRef.current[peerId];
            
            const videoEl = document.getElementById(`peer-${peerId}`);
            if (videoEl) {
              videoEl.remove();
            }
          }
        });

        // Handle initial room users
        socket.on('room-users', (users: RoomUser[]) => {
          console.log('Received room users:', users);
          if (users.length > 0) {
          users.forEach(({ userId, username: peerUsername }) => {
            if (userId !== socket.id && socket.id) {
                // Skip if we already have this peer
                if (peersRef.current[userId]) {
                  console.log(`Peer ${userId} already exists, not creating again`);
                  return;
                }
                
              console.log("Creating peer for existing room user:", peerUsername);
                // Add a small delay to ensure both sides are ready
                setTimeout(() => {
                  if (!socket.id) return; // Check if socket.id is still valid
                  
                  // Check again in case peer was created during the timeout
                  if (peersRef.current[userId]) {
                    console.log(`Peer ${userId} created during timeout, not creating again`);
                    return;
                  }
                  
                  try {
              const peer = createPeer(userId, socket.id, currentStream, peerUsername);
              peersRef.current[userId] = { peer, username: peerUsername };
              setPeers(prevPeers => ({
                ...prevPeers,
                [userId]: { peer, username: peerUsername }
              }));
                  } catch (err) {
                    console.error("Error creating peer from room-users:", err);
                  }
                }, 1000);
              }
            });
          } else {
            console.log("No other users in room yet");
          }
        });

        // Handle reconnection events
        socket.on('reconnect', () => {
          console.log('Socket reconnected, rejoining room:', normalizedRoomId);
          socket.emit('join-room', { roomId: normalizedRoomId, username });
        });

        socket.on('connect_error', (error: any) => {
          console.error('Socket connection error:', error);
        });

        // Add specific event listener for pong response
        socket.on('pong', () => {
          console.log('Pong received from server');
        });

        // Handle connection error with rejoin logic
        socket.on('error', (error: any) => {
          console.error('Socket error:', error);
          // Try to rejoin room on error
          setTimeout(() => {
            if (socket.connected) {
              socket.emit('join-room', { roomId: normalizedRoomId, username });
            }
          }, 2000);
        });

      } catch (error) {
        console.error('Error accessing media devices:', error);
        failedInitializationAttempts++;
        
        if (failedInitializationAttempts < MAX_INITIALIZATION_ATTEMPTS) {
          console.log(`Retrying initialization, attempt ${failedInitializationAttempts + 1}/${MAX_INITIALIZATION_ATTEMPTS}`);
          setTimeout(() => {
            initializeStream();
          }, 2000);
        } else {
          alert('Unable to access camera and microphone after multiple attempts. Please check your permissions and refresh the page.');
        }
      } finally {
        setIsInitializing(false);
      }
    };

    initializeStream();

    return () => {
      if (interval) clearInterval(interval);
      if (reconnectionTimer) clearTimeout(reconnectionTimer);
      
      // Remove socket listeners
      socket.off('user-joined');
      socket.off('receiving-returned-signal');
      socket.off('user-connected');
      socket.off('user-disconnected');
      socket.off('room-users');
      socket.off('reconnect');
      socket.off('connect_error');
      socket.off('error');
      socket.off('pong');
      
      // Clean up media streams
      if (stream) {
        try {
          stream.getTracks().forEach((track) => track.stop());
        } catch (err) {
          console.error("Error stopping stream tracks:", err);
        }
      }
      
      if (screenSharingStream) {
        try {
          screenSharingStream.getTracks().forEach((track) => track.stop());
        } catch (err) {
          console.error("Error stopping screen sharing tracks:", err);
        }
      }
      
      // Clean up peer connections
      cleanupPeerConnections();
      
      // Leave room
      socket.emit('leave-room', { roomId: roomId.trim() });
    };
  }, []);

  const ensureVideoTrackEnabled = (stream: MediaStream): MediaStream => {
    const videoTracks = stream.getVideoTracks();
    console.log('Ensuring video tracks are enabled, found:', videoTracks.length);
    
    if (videoTracks.length === 0) {
      console.warn('No video tracks found in stream');
      return stream;
    }
    
    // Enable all video tracks and ensure they stay enabled
    videoTracks.forEach(track => {
      track.enabled = true;
      // Add event listeners to monitor track state
      track.onended = () => {
        console.warn('Video track ended, attempting to restore');
        track.enabled = true;
      };
      track.onmute = () => {
        console.warn('Video track muted, attempting to restore');
        track.enabled = true;
      };
      console.log('Video track enabled:', track.id, track.enabled);
      console.log('Video track constraints:', track.getConstraints());
      console.log('Video track settings:', track.getSettings());
    });
    
    return stream;
  };

  function createPeer(userToSignal: string, callerId: string, stream: MediaStream, username: string) {
    console.log('Creating peer connection to:', userToSignal, 'as:', username);
    const configuration = {
        iceServers: [
          // Google's public STUN servers
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          // Public STUN servers
          { urls: 'stun:stun.stunprotocol.org:3478' },
          { urls: 'stun:stun.ekiga.net:3478' },
          // Free TURN servers
          { 
            urls: 'turn:numb.viagenie.ca:3478',
            username: 'webrtc@live.com',
            credential: 'muazkh'
          },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:global.turn.twilio.com:3478?transport=udp',
            username: 'open_user',
            credential: 'open_pass'
          }
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all' as RTCIceTransportPolicy
    };
    
    const peer = new Peer({
      initiator: true,
      trickle: true, // Enable trickle ICE for better connectivity
      stream: stream,
      config: configuration,
      sdpTransform: (sdp) => {
        // Add IP address handling improvements to SDP
        // This allows for better NAT traversal
        const modifiedSdp = sdp.replace(/a=ice-options:trickle\s\n/g, 
          'a=ice-options:trickle\na=setup:actpass\n');
        console.log("Outgoing SDP modified for better connectivity");
        return modifiedSdp;
      }
    });

    // Log ICE connection state changes
    peer.on('iceStateChange', (state) => {
      console.log(`ICE state change for peer to ${userToSignal}: ${state}`);
      
      // If ICE connection fails, we might want to retry with a different strategy
      if (state === 'failed') {
        console.warn(`ICE connection failed for peer ${userToSignal}. Trying to reconnect...`);
        // You could implement a reconnection strategy here
      }
    });

    peer.on('signal', signal => {
      console.log('Sending signal to:', userToSignal, 'Signal type:', signal.type);
      socket.emit('send-signal', { userToSignal, signal, from: callerId, username });
    });

    peer.on('stream', (peerStream: MediaStream) => {
      console.log('Received stream from peer:', userToSignal);
      // Ensure video tracks are enabled and stable
      peerStream = ensureVideoTrackEnabled(peerStream);
      
      // Add event listeners to monitor stream state
      peerStream.onaddtrack = (event) => {
        console.log('Track added to peer stream:', event.track.kind);
        if (event.track.kind === 'video') {
          event.track.enabled = true;
        }
      };
      
      peerStream.onremovetrack = (event) => {
        console.log('Track removed from peer stream:', event.track.kind);
      };
      
      // Find the video element for this peer and set its srcObject
      setTimeout(() => {
        if (peerVideoRefs.current[userToSignal]) {
          console.log('Setting srcObject for video element');
          const videoElement = peerVideoRefs.current[userToSignal];
          videoElement.srcObject = peerStream;
          
          // Add event listeners to monitor video element state
          videoElement.onloadedmetadata = () => {
            console.log('Peer video metadata loaded');
            videoElement.play().catch(err => {
              console.warn("Autoplay prevented:", err);
            });
          };
          
          videoElement.onerror = (e) => {
            console.error('Peer video error:', e);
            // Attempt to restore video
            videoElement.srcObject = peerStream;
          };
          
          // Try to play the video immediately
          videoElement.play().catch(err => {
            console.warn("Autoplay prevented, user interaction needed:", err);
          });
        } else {
          console.warn(`Video element for peer ${userToSignal} not found`);
        }
      }, 1000);
    });

    peer.on('error', (err) => {
      console.error('Peer connection error:', err);
    });

    peer.on('connect', () => {
      console.log('Peer connection established with:', userToSignal);
    });

    peer.on('close', () => {
      console.log('Peer connection closed with:', userToSignal);
    });

    return peer;
  }

  function addPeer(incomingSignal: any, callerId: string, stream: MediaStream, username: string) {
    console.log('Adding peer connection from:', callerId, 'as:', username);
    // Use the same configuration for consistency
    const configuration = {
        iceServers: [
          // Google's public STUN servers
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          // Public STUN servers
          { urls: 'stun:stun.stunprotocol.org:3478' },
          { urls: 'stun:stun.ekiga.net:3478' },
          // Free TURN servers
          { 
            urls: 'turn:numb.viagenie.ca:3478',
            username: 'webrtc@live.com',
            credential: 'muazkh'
          },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:global.turn.twilio.com:3478?transport=udp',
            username: 'open_user',
            credential: 'open_pass'
          }
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all' as RTCIceTransportPolicy
    };
    
    const peer = new Peer({
      initiator: false,
      trickle: true, // Enable trickle ICE for better connectivity
      stream,
      config: configuration,
      sdpTransform: (sdp) => {
        // Add IP address handling improvements to SDP
        // This allows for better NAT traversal
        const modifiedSdp = sdp.replace(/a=ice-options:trickle\s\n/g, 
          'a=ice-options:trickle\na=setup:actpass\n');
        console.log("Incoming SDP modified for better connectivity");
        return modifiedSdp;
      }
    });

    // Log ICE connection state changes
    peer.on('iceStateChange', (state) => {
      console.log(`ICE state change for peer from ${callerId}: ${state}`);
      
      // If ICE connection fails, we might want to retry
      if (state === 'failed') {
        console.warn(`ICE connection failed for peer ${callerId}. Trying to reconnect...`);
        // You could implement a reconnection strategy here
      }
    });

    peer.on('signal', signal => {
      console.log('Returning signal to:', callerId, 'Signal type:', signal.type);
      socket.emit('returning-signal', { signal, userToSignal: callerId, from: socket.id });
    });

    peer.on('stream', (peerStream: MediaStream) => {
      console.log('Received stream from peer:', callerId);
      // Ensure video tracks are enabled
      peerStream = ensureVideoTrackEnabled(peerStream);
      console.log('Stream has video tracks:', peerStream.getVideoTracks().length > 0);
      console.log('Video tracks enabled:', peerStream.getVideoTracks().map(t => t.enabled));
      
      // Find the video element for this peer and set its srcObject
      setTimeout(() => {
        if (peerVideoRefs.current[callerId]) {
          peerVideoRefs.current[callerId].srcObject = peerStream;
          // Try to play the video immediately
          peerVideoRefs.current[callerId].play().catch(err => {
            console.warn("Autoplay prevented, user interaction needed:", err);
          });
        } else {
          console.warn(`Video element for peer ${callerId} not found`);
        }
      }, 500);
    });

    peer.on('error', (err) => {
      console.error('Peer connection error:', err);
    });

    peer.on('connect', () => {
      console.log('Peer connection established with:', callerId);
    });

    peer.on('close', () => {
      console.log('Peer connection closed with:', callerId);
    });

    peer.signal(incomingSignal);
    return peer;
  }

  // Add cleanup function for peer connections
  const cleanupPeerConnections = () => {
    console.log("Cleaning up peer connections");
    Object.values(peersRef.current).forEach(({ peer }) => {
      if (peer) {
        try {
          if (!peer.destroyed) {
          peer.destroy();
          }
        } catch (err) {
          console.error("Error destroying peer:", err);
        }
      }
    });
    peersRef.current = {};
    setPeers({});
  };

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleLeaveRoom = () => {
    stream?.getTracks().forEach(track => track.stop());
    Object.values(peers).forEach(({ peer }) => peer.destroy());
    socket.emit('leave-room', { roomId });
    onLeaveRoom();
  };

  const generateSummary = () => {
    console.log('Generating AI summary of the meeting...');
    
    // Set loading state
    setIsResearching(true);
    setSummaryPoints([]);
    
    // Use the audio transcript if available, otherwise use chat messages
    let transcript = audioTranscript;
    
    // If no audio transcript is available, use chat messages as a fallback
    if (!transcript) {
      const messageText = messages.map(msg => `${msg.sender}: ${msg.text}`).join('\n');
      transcript = messageText || "This is a meeting about project planning and team coordination.";
    }
    
    // Call the Python backend API
    fetch(`${API_BASE_URL}/api/summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        // Set the summary points from the API response
        setSummaryPoints(data.summary_points || []);
        // Switch to the summary tab
    setActiveTab('summary');
        setIsResearching(false);
      })
      .catch(error => {
        console.error('Error generating summary:', error);
        // Set some default points in case of error
        setSummaryPoints([
          "Error generating meeting summary. Please try again later."
        ]);
        setIsResearching(false);
      });
  };

  const deepResearch = () => {
    setIsResearching(true);
    setResearchResults('');
    
    // Use the search query or meeting content as query
    const query = researchQuery.trim();
    if (!query) {
      setResearchResults('Please enter a search query');
      setIsResearching(false);
      return;
    }
    
    console.log(`Performing ${researchMode} research for query: "${query}"`);
    
    // Include the research mode in the API request
    fetch(`${API_BASE_URL}/api/research`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: query,
        mode: researchMode 
      }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Process and format the results based on research mode
      let formattedResults = '';
      
      if (data.results) {
        if (researchMode === 'summary') {
          // For summary mode, create formatted paragraphs
          formattedResults = data.results
            .replace(/\n\s*\n/g, '\n\n') // Normalize paragraph breaks
            .trim();
        } else {
          // For deep research mode, add proper markdown-style formatting
          // Add headings and structure if not already present
          const content = data.results.trim();
          
          if (!content.includes('#')) {
            // If there are no headings, add a structured format
            const sections = content.split('\n\n');
            formattedResults = `# Research Results for "${query}"\n\n`;
            
            if (sections.length > 1) {
              // Add sections with headings
              sections.forEach((section: string, index: number) => {
                if (index === 0) {
                  formattedResults += `${section}\n\n`;
                } else {
                  // Convert meaningful sections to headings
                  const sectionTitle = `## Key Point ${index}`;
                  formattedResults += `${sectionTitle}\n\n${section}\n\n`;
                }
              });
            } else {
              // Just add the content as is
              formattedResults = content;
            }
          } else {
            // Content already has headings, use as is
            formattedResults = content;
          }
        }
      } else {
        formattedResults = 'No results found';
      }
      
      setResearchResults(formattedResults);
      setActiveTab('summary');
    })
    .catch(error => {
      console.error('Error:', error);
      setResearchResults(`Error fetching research data: ${error.message}. Please try again.`);
    })
    .finally(() => {
      setIsResearching(false);
    });
  };

  const copyRoomIdToClipboard = () => {
    navigator.clipboard.writeText(roomId);
    setShowCopiedNotification(true);
    setTimeout(() => setShowCopiedNotification(false), 2000);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullScreen(false);
      }
    }
  };

  // Determine the grid layout based on number of participants
  const getGridTemplateColumns = () => {
    if (totalParticipants <= 1) return "1fr";
    if (totalParticipants === 2) return "1fr 1fr";
    if (totalParticipants === 3 || totalParticipants === 4) return "repeat(2, 1fr)";
    if (totalParticipants <= 6) return "repeat(3, 1fr)";
    return "repeat(4, 1fr)";
  };

  // Screen sharing function
  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        // Request screen sharing permissions
        const screenCaptureStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          } as MediaTrackConstraints,
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });
        
        setScreenStream(screenCaptureStream);
        
        // Save the video track to replace later
        if (stream) {
          // Store the original video track to be restored later
          const originalVideoTrack = stream.getVideoTracks()[0];
          
          // Replace all existing video tracks with screen share
          Object.keys(peersRef.current).forEach((peerID) => {
            try {
              const peer = peersRef.current[peerID].peer;
              if (!peer) {
                console.warn('No peer found for', peerID);
                return;
              }
              
              // Get the current video sender
              const videoTrack = screenCaptureStream.getVideoTracks()[0];
              if (!videoTrack) {
                console.error('No video track found in screen share stream');
                return;
              }
              
              // Access the internal RTCPeerConnection object from simple-peer
              // The _pc property is where simple-peer stores the RTCPeerConnection
              const peerConnection = (peer as any)._pc as RTCPeerConnection;
              if (!peerConnection) {
                console.warn('No RTCPeerConnection available for peer', peerID);
                return;
              }
              
              // Find the sender that's sending video
              const senders = peerConnection.getSenders();
              const videoSender = senders.find((sender: RTCRtpSender) => 
                sender.track && sender.track.kind === 'video'
              );
              
              if (videoSender) {
                console.log('Replacing video track with screen share for peer', peerID);
                videoSender.replaceTrack(videoTrack);
              } else {
                console.warn('No video sender found for peer', peerID);
              }
            } catch (error) {
              console.error('Error replacing track for peer:', error);
            }
          });
          
          // Set screen share as the current video source
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = screenCaptureStream;
          }
        } else {
          console.warn('No original stream found when starting screen share');
        }
        
        // Listen for when user ends screen sharing
        screenCaptureStream.getVideoTracks()[0].onended = () => {
          console.log('Screen sharing ended by the user');
          stopScreenSharing();
        };
        
        setIsScreenSharing(true);
        
        // Show a notification to users
        socket.emit('user-action', {
          roomId,
          action: 'screen-share-started',
          username
        });
      } else {
        stopScreenSharing();
      }
    } catch (error) {
      console.error('Error sharing screen:', error);
      
      // If user cancels the screen share dialog
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        console.log('User denied screen sharing permission');
      } else {
        alert('Failed to share screen. Please try again.');
      }
    }
  };
  
  const stopScreenSharing = () => {
    if (screenStream) {
      // Stop all tracks in the screen stream
      screenStream.getTracks().forEach(track => {
        track.stop();
      });
      
      // Replace screen tracks with camera video if available
      if (stream) {
        const originalVideoTrack = stream.getVideoTracks()[0];
        
        if (originalVideoTrack) {
          // Replace screen share with original camera for all peers
          Object.keys(peersRef.current).forEach((peerID) => {
            try {
              const peer = peersRef.current[peerID].peer;
              if (!peer) {
                console.warn('No peer found for', peerID);
                return;
              }
              
              // Access the internal RTCPeerConnection
              const peerConnection = (peer as any)._pc as RTCPeerConnection;
              if (!peerConnection) {
                console.warn('No RTCPeerConnection available for peer', peerID);
                return;
              }
              
              // Find the video sender
              const senders = peerConnection.getSenders();
              const videoSender = senders.find((sender: RTCRtpSender) => 
                sender.track && sender.track.kind === 'video'
              );
              
              if (videoSender) {
                console.log('Replacing screen share with original camera for peer', peerID);
                videoSender.replaceTrack(originalVideoTrack);
              } else {
                console.warn('No video sender found for peer', peerID);
              }
            } catch (error) {
              console.error('Error restoring original video track:', error);
            }
          });
          
          // Restore original video to local display
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        } else {
          console.warn('No original video track found when stopping screen share');
        }
      }
      
      setScreenStream(null);
      setIsScreenSharing(false);
      
      // Notify other users
      socket.emit('user-action', {
        roomId,
        action: 'screen-share-stopped',
        username
      });
    }
  };

  // Send message function
  const sendMessage = () => {
    if (newMessage.trim() === '') return;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageObj = {
      sender: username,
      text: newMessage,
      time
    };
    
    // Add message to local state
    setMessages(prev => [...prev, messageObj]);
    
    // Send to all peers
    socket.emit('chat-message', {
      roomId,
      message: messageObj
    });
    
    // Clear input
    setNewMessage('');
  };

  // Toggle layout view
  const toggleLayout = () => {
    setLayout(prev => prev === 'grid' ? 'focus' : 'grid');
  };

  // Focus on a specific user
  const focusOnUser = (userId: string) => {
    setFocusedUser(userId);
    setLayout('focus');
  };
  
  // Scroll to bottom of chat when new messages come in
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Listen for chat messages
  useEffect(() => {
    socket.on('chat-message', ({ sender, message }) => {
      if (sender !== socket.id) {
        console.log("Received chat message from:", sender, message);
        setMessages(prev => [...prev, message]);
      }
    });
    
    return () => {
      socket.off('chat-message');
    };
  }, [socket]);

  const handleResearchSubmit = () => {
    if (researchQuery.trim() === '') return;
    
    setIsResearching(true);
    deepResearch();
    setResearchQuery('');
  };

  // Effect to scroll to bottom of chat when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Effect to navigate to summary tab when research results are received
  useEffect(() => {
    if (researchResults && researchResults.trim() !== '') {
      // Add a small delay to allow UI to update
      const timer = setTimeout(() => {
        setActiveTab('summary');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [researchResults]);

  // Add mode toggle component to the research section
  const renderResearchModeToggle = () => {
    return (
      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => setResearchMode('summary')}
          className={`px-3 py-1 rounded-md text-sm font-medium ${
            researchMode === 'summary' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Quick Summary
        </button>
        <button
          onClick={() => setResearchMode('deep')}
          className={`px-3 py-1 rounded-md text-sm font-medium ${
            researchMode === 'deep' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Comprehensive Report
        </button>
      </div>
    );
  };

  // Updated audio recording functions
  const startRecording = async () => {
    if (!stream) {
      alert('No audio stream available. Please check your microphone permissions.');
      return;
    }
    
    try {
      setIsRecording(true);
      setRecordingTime(0);
      audioChunksRef.current = [];
      
      // Create audio context to mix only remote participants' audio streams
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();
      
      // We're intentionally NOT adding the local user's audio - only recording others
      console.log('Only recording remote participants, not local audio');
      
      // Add peer audio tracks when available
      Object.values(peers).forEach(({ peer }) => {
        try {
          const peerStream = (peer as any)._remoteStreams?.[0];
          if (peerStream && peerStream.getAudioTracks().length > 0) {
            const peerSource = audioContext.createMediaStreamSource(new MediaStream([peerStream.getAudioTracks()[0]]));
            peerSource.connect(destination);
            console.log('Added peer audio track to recording');
          }
        } catch (error) {
          console.error('Error adding peer audio to recording:', error);
        }
      });
      
      // Create a media recorder with the combined audio stream
      const combinedStream = destination.stream;
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      
      // Start the recorder server session
      const response = await fetch(`${RECORDER_API_URL}/api/start-recording`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_id: roomId,
          username: username
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to start recording session on the server');
      }
      
      const data = await response.json();
      recordingIdRef.current = data.recording_id;
      console.log('Started recording session with ID:', recordingIdRef.current);
      
      // Add data handler to send chunks to the server
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`Recorded chunk: ${event.data.size} bytes`);
          
          // Convert blob to base64
          const reader = new FileReader();
          reader.readAsDataURL(event.data);
          reader.onloadend = async () => {
            const base64data = reader.result as string;
            // Remove the "data:audio/webm;base64," part
            const base64Audio = base64data.split(',')[1];
            
            // Send to the server if we have a recording ID
            if (recordingIdRef.current) {
              try {
                await fetch(`${RECORDER_API_URL}/api/add-audio-chunk`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    recording_id: recordingIdRef.current,
                    audio_data: base64Audio,
                    format: 'webm'
                  }),
                });
              } catch (error) {
                console.error('Error sending audio chunk to server:', error);
              }
            }
          };
        }
      };
      
      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      
      // Start the timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      console.log('Started recording only remote participants\' audio (not recording local audio)');
    } catch (error: any) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
      recordingIdRef.current = null;
      alert(`Failed to start recording: ${error.message}. Please try again.`);
    }
  };
  
  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    
    try {
      // Stop the media recorder
      const mediaRecorder = mediaRecorderRef.current;
      
      // Create a promise that resolves when recording stops
      const recordingStopped = new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => resolve();
      });
      
      mediaRecorder.stop();
      console.log('Recording stopped, waiting for data...');
      
      // Stop the timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      // Wait for the recording to fully stop
      await recordingStopped;
      
      // Tell the server to stop recording and generate summary
      if (recordingIdRef.current) {
        const response = await fetch(`${RECORDER_API_URL}/api/stop-recording`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recording_id: recordingIdRef.current
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to stop recording session on the server');
        }
        
        const data = await response.json();
        console.log('Stopped recording session, status:', data.status);
        
        // Start polling for the summary
        pollForSummary(recordingIdRef.current);
      }
      
      // Clean up resources
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
    } catch (error: any) {
      console.error('Error stopping recording:', error);
      alert(`Recording error: ${error.message}. Please check your microphone permissions and try again.`);
    } finally {
      setIsRecording(false);
    }
  };
  
  const pollForSummary = async (recordingId: string) => {
    setIsTranscribing(true);
    
    const maxAttempts = 30; // Poll for up to 5 minutes (30 * 10 seconds)
    let attempts = 0;
    
    const checkSummary = async () => {
      try {
        const response = await fetch(`${RECORDER_API_URL}/api/get-summary?recording_id=${recordingId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch summary');
        }
        
        const data = await response.json();
        
        if (data.status === 'complete') {
          // We have a summary!
          setIsTranscribing(false);
          
          // Update the transcript and the research UI
          if (data.summary && data.summary.transcript) {
            setAudioTranscript(data.summary.transcript);
          }
          
          // Update the summary points
          if (data.summary && data.summary.key_points) {
            setSummaryPoints(data.summary.key_points);
          }
          
                    // Set research query if not already set
           if (data.summary && data.summary.key_points && data.summary.key_points.length > 0) {
             // Use the first key point as a research query suggestion
             const suggestion = data.summary.key_points[0];
             if (suggestion && suggestion.length > 0) {
               setResearchQuery(suggestion);
             }
           }
          
          // Switch to the summary tab to show results
          setActiveTab('summary');
          
          return true;
        } else if (data.status === 'processing' || data.status === 'in_progress') {
          // Still processing
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error('Timed out waiting for summary');
          }
          return false;
        } else {
          throw new Error(`Unexpected status: ${data.status}`);
        }
      } catch (error) {
        console.error('Error polling for summary:', error);
        setIsTranscribing(false);
        return true; // Stop polling on error
      }
    };
    
    const poll = async () => {
      const isDone = await checkSummary();
      if (!isDone) {
        setTimeout(poll, 10000); // Check every 10 seconds
      }
    };
    
    poll();
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    // This is now handled by the meeting recorder server
    // This method is kept for compatibility
    console.log('Using server-side transcription');
  };

  // Gmail functions
  const handleGmailAuth = async () => {
    try {
      const response = await axios.get('http://localhost:5001/mcp/gmail/status');
      if (response.data.authenticated) {
        setIsAuthenticated(true);
        fetchEmails();
      } else {
        // Instead of redirecting, we'll make the auth request and handle it here
        const authResponse = await axios.get('http://localhost:5001/mcp/gmail/auth', { withCredentials: true });
        if (authResponse.data.success) {
          setIsAuthenticated(true);
          fetchEmails();
        }
      }
    } catch (error) {
      console.error('Gmail authentication error:', error);
    }
  };

  const fetchEmails = async () => {
    try {
      setIsLoadingEmails(true);
      const response = await axios.get('http://localhost:5001/mcp/gmail/messages');
      setGmailMessages(response.data.messages || []);
    } catch (error) {
      console.error('Error fetching emails:', error);
    } finally {
      setIsLoadingEmails(false);
    }
  };

  const sendEmail = async () => {
    try {
      await axios.post('http://localhost:5001/mcp/gmail/send', {
        to: emailTo,
        subject: emailSubject,
        body: emailBody
      });
      setIsComposingEmail(false);
      setEmailTo('');
      setEmailSubject('');
      setEmailBody('');
      fetchEmails(); // Refresh the email list
    } catch (error) {
      console.error('Error sending email:', error);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Top navigation bar - Light modern UI style */}
      <div className="bg-white border-b border-gray-200 p-3 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-6">
          <h3 className="text-xl font-light text-gray-700 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="mr-2">
              <path fill="#6366f1" d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm0 18.6a6.6 6.6 0 1 1 0-13.2 6.6 6.6 0 0 1 0 13.2z"/>
              <circle cx="12" cy="12" r="4" fill="#818cf8"/>
            </svg>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 font-medium">Smart Meet</span>
          </h3>
          <div className="flex space-x-1 bg-gray-50 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('meeting')}
              className={`px-3 py-1.5 text-sm font-light rounded-md transition-all ${
                activeTab === 'meeting' 
                  ? 'bg-indigo-500 text-white shadow-sm' 
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                Meeting
              </div>
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 text-sm font-light rounded-md transition-all ${
                activeTab === 'chat' 
                  ? 'bg-indigo-500 text-white shadow-sm' 
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
                </svg>
                Chat
              </div>
            </button>
            <button
              onClick={() => setActiveTab('gmail')}
              className={`px-3 py-1.5 text-sm font-light rounded-md transition-all ${
                activeTab === 'gmail' 
                  ? 'bg-indigo-500 text-white shadow-sm' 
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                Gmail
              </div>
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-1.5 text-sm font-light rounded-md transition-all ${
                activeTab === 'summary' 
                  ? 'bg-indigo-500 text-white shadow-sm' 
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
                </svg>
                Summary
              </div>
            </button>
            <button
              onClick={() => setActiveTab('contacts')}
              className={`px-3 py-1.5 text-sm font-light rounded-md transition-all ${
                activeTab === 'contacts' 
                  ? 'bg-indigo-500 text-white shadow-sm' 
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
                People
              </div>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* User counter badge */}
          <div className="bg-indigo-50 text-indigo-600 py-1 px-3 rounded-full text-sm flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
            <span className="font-light">{totalParticipants} {totalParticipants === 1 ? 'Participant' : 'Participants'}</span>
          </div>
          <div className="flex items-center bg-gray-50 rounded-md px-3 py-1 border border-gray-200">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            <span className="text-gray-600 text-sm font-light">{roomId}</span>
            <button 
              onClick={copyRoomIdToClipboard}
              className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Copy room ID"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
            </button>
            {showCopiedNotification && (
              <span className="ml-2 text-green-500 text-xs">Copied!</span>
            )}
          </div>
          <button
            onClick={toggleFullScreen}
            className="p-2 bg-gray-50 text-gray-500 rounded-md hover:bg-gray-100 transition-colors border border-gray-200"
            title={isFullScreen ? "Exit Full Screen" : "Enter Full Screen"}
          >
            {isFullScreen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 4a1 1 0 00-1 1v4a1 1 0 01-2 0V5a3 3 0 013-3h4a1 1 0 010 2H5zM5 16a1 1 0 001-1v-4a1 1 0 112 0v4a3 3 0 01-3 3H5a1 1 0 010-2h4zM16 5a1 1 0 00-1-1h-4a1 1 0 100-2h4a3 3 0 013 3v4a1 1 0 11-2 0V5zM16 15a1 1 0 001 1h-4a1 1 0 110 2h4a3 3 0 003-3v-4a1 1 0 11-2 0v4a1 1 0 01-1 1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a2 2 0 012-2h4a1 1 0 010 2H5v4a1 1 0 01-2 0V5zm12 0a2 2 0 00-2-2h-4a1 1 0 100 2h4v4a1 1 0 102 0V5zM5 15a2 2 0 002 2h4a1 1 0 100-2H7v-4a1 1 0 10-2 0v4zm12 0a2 2 0 01-2 2h-4a1 1 0 110-2h4v-4a1 1 0 112 0v4z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="p-4 pb-20">
        {/* Main content area with sidebar and video grid */}
        <div className="flex h-[calc(100vh-60px)]">
          {/* Left sidebar for researcher panel */}
          {/* Smart Search Panel - Redesigned as a single cohesive container */}
          {isResearcherOpen && (
  <div className="w-1/3 bg-white border-r border-gray-200 overflow-y-auto animate-slide-right transition-all duration-300 ease-in-out shadow-xl rounded-xl">
    <div className="flex flex-col h-full">
      {/* Vibrant header with animated gradient */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 p-4 text-white rounded-t-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.1] opacity-20"></div>
        <div className="absolute -inset-x-20 -bottom-40 bg-gradient-to-r from-violet-600 to-indigo-600 opacity-20 blur-3xl h-40 rounded-full"></div>
        <h3 className="text-xl font-bold flex items-center mb-1 relative z-10">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-300" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          Smart Search
        </h3>
        <p className="text-xs text-blue-100 italic flex items-center relative z-10">
          <span className="w-2 h-2 bg-blue-300 rounded-full mr-1.5 animate-pulse"></span>
          Intelligent research assistant for your meetings
        </p>
      </div>
      
      {/* Modern search mode toggle */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Search Mode</span>
          <div className="bg-gray-100 rounded-full p-1 flex shadow-inner">
            <button
              onClick={() => setResearchMode('summary')}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-300 ${
                researchMode === 'summary' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-500 hover:bg-gray-200'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setResearchMode('deep')}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-300 ${
                researchMode === 'deep' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-500 hover:bg-gray-200'
              }`}
            >
              Research
            </button>
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 mb-3">
          <p className="text-xs text-blue-700 flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {researchMode === 'summary' 
              ? 'Summary mode provides a quick overview of search results' 
              : 'Research mode delivers comprehensive information on the topic'}
          </p>
        </div>
      </div>
      
      {/* Enhanced search input with animation */}
      <div className="px-4 mb-4">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative bg-white rounded-lg">
            <input
              type="text"
              value={researchQuery}
              onChange={(e) => setResearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleResearchSubmit()}
              className="w-full bg-white text-gray-700 border border-gray-200 rounded-lg py-3 pl-10 pr-20 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
              placeholder="Search for information..."
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 absolute left-3 top-3.5 text-gray-400 group-hover:text-blue-500 transition-colors"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
            <button
              onClick={handleResearchSubmit}
              className="absolute right-2 top-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-md px-3 py-1.5 text-sm hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md"
            >
              {researchMode === 'summary' ? 'Summary' : 'Research'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Visually engaging results container */}
      <div className="flex-grow px-4 pb-4">
        <div className="bg-gray-50 rounded-xl p-4 shadow-sm h-full overflow-y-auto border border-gray-200">
          {isResearching ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-t-4 border-b-4 border-blue-500 animate-spin"></div>
                <div className="absolute inset-3 rounded-full border-t-4 border-r-4 border-indigo-500 animate-spin animate-reverse"></div>
                <div className="absolute inset-6 rounded-full border-t-2 border-l-2 border-purple-500 animate-spin"></div>
              </div>
              <p className="text-gray-500 font-medium mt-6 animate-pulse">
                {researchMode === 'summary' ? 'Creating summary...' : 'Researching in depth...'}
              </p>
            </div>
          ) : researchResults ? (
            <div className="animate-fade-in">
              {/* Modern, visually appealing results container */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
                {/* Stylish header with gradient and icons */}
                <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 p-4 border-b border-gray-100 relative">
                  <div className="absolute top-0 right-0 h-full w-1/3 bg-gradient-to-l from-white/20 to-transparent"></div>
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-800 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clipRule="evenodd" />
                      </svg>
                      {researchMode === 'summary' ? 'Search Summary' : 'Research Results'}
                    </h4>
                    <span className="text-xs bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-1 rounded-full shadow-sm">
                      {researchMode === 'summary' ? 'Quick Overview' : 'Comprehensive'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center">
                    <div className="bg-white/70 rounded-lg px-3 py-1.5 text-sm text-gray-700 border border-gray-200 flex items-center flex-grow">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span className="font-medium truncate">{researchQuery || "Video Conferencing Best Practices"}</span>
                    </div>
                  </div>
                </div>
                
                {/* Content section with improved styling for dynamic content */}
                <div className="p-4 bg-white">
                  {/* Format and render the research results in a well-structured way */}
                  <div className="prose prose-blue max-w-none">
                    {researchResults ? (
                      <div className="search-results-formatted">
                        {/* Parse and format the content based on the research mode */}
                        {researchMode === 'summary' ? (
                          <div className="space-y-4">
                            {/* Summary points in a bulleted list with accent styling */}
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                              <h3 className="text-md font-medium text-blue-700 mb-2">Summary for "{researchQuery || 'your query'}"</h3>
                              <p className="text-sm text-blue-600">Quick overview of the most relevant information</p>
                            </div>
                            {researchResults.split('\n\n').map((paragraph: string, index: number) => (
                              <div key={index} className="mb-3 bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                                <div className="flex">
                                  <div className="mr-3 flex-shrink-0">
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                                      <span className="text-indigo-600 text-xs font-semibold">{index + 1}</span>
                                    </div>
                                  </div>
                                  <p className="text-gray-800 leading-relaxed">{paragraph}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Deep research with sections and structured content */}
                            <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 mb-4">
                              <h3 className="text-md font-medium text-indigo-700 mb-2">Comprehensive Research: "{researchQuery || 'your query'}"</h3>
                              <p className="text-sm text-indigo-600">In-depth analysis with relevant details and citations</p>
                            </div>
                            
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                              {researchResults.split('\n\n').map((paragraph: string, index: number) => {
                                // Check if this paragraph is a heading (starts with #)
                                if (paragraph.startsWith('#')) {
                                  const level = (paragraph.match(/^#+/) || ['#'])[0].length;
                                  const headingClass = level === 1 
                                    ? "text-xl font-bold text-indigo-700 bg-indigo-50 p-3 border-b border-indigo-100" 
                                    : "text-lg font-semibold text-indigo-600 px-4 pt-4 pb-2";
                                  
                                  return (
                                    <h3 key={index} className={headingClass}>
                                      {paragraph.replace(/^#+ /, '')}
                                    </h3>
                                  );
                                } else if (paragraph.startsWith('- ')) {
                                  // Handle bullet points with better styling
                                  return (
                                    <div key={index} className="px-4 py-2">
                                      <ul className="list-none space-y-2">
                                        {paragraph.split('\n').map((item: string, itemIndex: number) => (
                                          <li key={itemIndex} className="flex items-start">
                                            <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 mt-1.5 mr-2 flex-shrink-0"></span>
                                            <span className="text-gray-700">{item.replace(/^- /, '')}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  );
                                } else {
                                  // Regular paragraph with better styling
                                  return (
                                    <p key={index} className="text-gray-700 leading-relaxed px-4 py-2">
                                      {paragraph}
                                    </p>
                                  );
                                }
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500">No results found</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="relative w-24 h-24 mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full"></div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 absolute inset-0 m-auto text-blue-500 opacity-80" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-gray-700 font-medium text-lg mb-2">Ready to search</h3>
              <p className="text-sm text-gray-500 max-w-xs mb-6">Enter a search query to get AI-powered insights for your meeting</p>
              
              <div className="w-full max-w-xs space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Try searching for:</p>
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={() => {
                      setResearchQuery("Video meeting best practices");
                      handleResearchSubmit();
                    }}
                    className="text-left text-sm bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-700 py-2.5 px-4 rounded-lg transition-colors flex items-center"
                  >
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                    Video meeting best practices
                  </button>
                  <button 
                    onClick={() => {
                      setResearchQuery("Remote team collaboration tools");
                      handleResearchSubmit();
                    }}
                    className="text-left text-sm bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 text-purple-700 py-2.5 px-4 rounded-lg transition-colors flex items-center"
                  >
                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-2"></span>
                    Remote team collaboration tools
                  </button>
                  <button 
                    onClick={() => {
                      setResearchQuery("Meeting agenda templates");
                      handleResearchSubmit();
                    }}
                    className="text-left text-sm bg-gradient-to-r from-green-50 to-teal-50 hover:from-green-100 hover:to-teal-100 text-green-700 py-2.5 px-4 rounded-lg transition-colors flex items-center"
                  >
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                    Meeting agenda templates
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Modern Marina.AI attribution footer */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-600 flex items-center justify-center">
          <span className="relative w-4 h-4 mr-2">
            <span className="absolute inset-0 bg-blue-400 rounded-full opacity-60 animate-ping"></span>
            <span className="absolute inset-0.5 bg-blue-500 rounded-full"></span>
          </span>
          Powered by <span className="font-semibold text-blue-700 ml-1">Marina.AI</span>
        </p>
      </div>
    </div>
  </div>
)}






          {/* Video Grid Container - Main area */}
          <div 
            className={`${isResearcherOpen ? 'w-2/3' : 'w-full'} h-full flex flex-col transition-all duration-300 ease-in-out`}
          >
            {/* Tabs Content */}
            <div className="flex-grow overflow-hidden p-4">
              {activeTab === 'meeting' && (
                <div className="h-full bg-white rounded-lg overflow-hidden p-2 shadow-sm border border-gray-200">
                  {/* Video grid - light modern style with improved one-on-one layout */}
                  <div className={`grid ${totalParticipants === 1 ? 'grid-cols-1' : totalParticipants === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-4'} gap-2 h-full max-h-full overflow-hidden p-2`}>
                    {/* Conditionally render the screen share as a larger video */}
                    {screenSharingStream && (
                      <div className="col-span-full md:col-span-2 md:row-span-2 relative rounded-md overflow-hidden border border-indigo-200 bg-white">
                        <video
                          ref={screenVideoRef}
                          className="h-full w-full object-contain"
                          autoPlay
                          playsInline
                        />
                        <div className="absolute bottom-2 left-2 bg-white/80 backdrop-blur-sm text-gray-700 text-xs py-1 px-2 rounded-md flex items-center shadow-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
                          </svg>
                          Screen Share
                        </div>
                      </div>
                    )}

                    {/* User video container - larger in one-on-one calls and full width when alone */}
                    <div className={`relative rounded-md overflow-hidden bg-gray-50 border border-gray-200 shadow-sm ${
                      totalParticipants === 1 
                        ? 'col-span-full row-span-full min-h-[400px]' 
                        : totalParticipants === 2 
                          ? 'col-span-full md:col-span-1 row-span-1 md:row-span-2 min-h-[300px]' 
                          : ''
                    }`}>
                      <video
                        ref={localVideoRef}
                        className="h-full w-full object-cover"
                        autoPlay
                        playsInline
                        muted
                      />
                      <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center">
                        <div className="bg-white/80 backdrop-blur-sm rounded-md px-2 py-1 flex items-center shadow-sm">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 font-medium text-xs mr-1">
                            {username.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-gray-700 text-xs font-light">{username}</span>
                          {!isMuted ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Peer videos - only show if there are peers */}
                    {Object.entries(peers).map(([peerId, { username: peerUsername }]) => (
                      <div 
                        key={peerId} 
                        className={`relative rounded-md overflow-hidden bg-gray-50 border border-gray-200 shadow-sm ${
                          totalParticipants === 2 
                            ? 'col-span-full md:col-span-1 row-span-1 md:row-span-2 min-h-[300px]' 
                            : ''
                        }`}
                      >
                        <video
  ref={(element) => {
    if (element) {
      peerVideoRefs.current[peerId] = element;
      // If there's already a stream assigned, make sure it's properly set
      if (peerVideoRefs.current[peerId].srcObject) {
        console.log('Video element already has srcObject');
      }
    }
  }}
  className="h-full w-full object-cover bg-black" // Changed from bg-gray-800 to bg-black for better contrast
  autoPlay
  playsInline
  onClick={() => {
    // Explicit play on click to handle autoplay restrictions
    if (peerVideoRefs.current[peerId]) {
      peerVideoRefs.current[peerId].play().catch(err => {
        console.error("Error playing video on click:", err);
      });
    }
  }}
/>
                        <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center">
                          <div className="bg-white/80 backdrop-blur-sm rounded-md px-2 py-1 flex items-center shadow-sm">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 font-medium text-xs mr-1">
                              {(peerUsername || "User").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-gray-700 text-xs font-light">{peerUsername || "User"}</span>
                          </div>
                        </div>
                        <div className="absolute top-2 right-2">
                          <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></div>
                        </div>
                      </div>
                    ))}

                    {/* Empty placeholder tiles - don't show if in one-on-one mode or solo */}
                    {totalParticipants > 2 && Array.from({ length: Math.max(0, 8 - Object.keys(peers).length - 1) }).map((_, index) => (
                      <div
                        key={`empty-${index}`}
                        className="rounded-md bg-gray-50 border border-gray-200 flex items-center justify-center shadow-sm"
                      >
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="text-gray-400 text-sm font-light">Username {index + Object.keys(peers).length + 2}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'chat' && (
                <div className="bg-white rounded-lg p-0 flex flex-col h-[calc(100vh-120px)] overflow-hidden shadow-sm border border-gray-200">
                  <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-700 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                        <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                      </svg>
                      Team Chat
                    </h2>
                    <button 
                      onClick={() => setActiveTab('meeting')}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  
                  <div 
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
                  >
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-400 mt-10">
                        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 max-w-sm mx-auto">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
                          </svg>
                          <p className="text-gray-600 font-medium">No messages yet</p>
                          <p className="text-sm mt-1 text-gray-500">Start the conversation by sending a message below!</p>
                        </div>
                      </div>
                    ) : (
                      messages.map((message, index) => (
                        <div 
                          key={index} 
                          className={`flex ${message.sender === username ? 'justify-end' : 'justify-start'}`}
                        >
                          {message.sender !== username && (
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-2 mt-1 flex-shrink-0 border border-indigo-200">
                              <span className="text-indigo-600 text-xs font-semibold">{message.sender.charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                          <div 
                            className={`max-w-[75%] rounded-lg px-4 py-2 shadow-sm ${
                              message.sender === username 
                                ? 'bg-blue-50 text-gray-800 border border-blue-100' 
                                : 'bg-white text-gray-800 border border-gray-200'
                            } ${message.sender === username ? 'rounded-tr-none' : 'rounded-tl-none'}`}
                          >
                            {message.sender !== username && (
                              <div className="font-medium text-xs text-indigo-600 mb-1">{message.sender}</div>
                            )}
                            <p className="text-sm">{message.text}</p>
                            <div className="text-right text-xs text-gray-400 mt-1">{message.time}</div>
                          </div>
                          {message.sender === username && (
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center ml-2 mt-1 flex-shrink-0 border border-blue-200">
                              <span className="text-blue-600 text-xs font-semibold">Me</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  
                  <div className="p-3 bg-white border-t border-gray-200">
                    <form onSubmit={sendMessage} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className={`p-2.5 rounded-lg ${
                          newMessage.trim() 
                            ? 'bg-blue-500 text-white hover:bg-blue-600' 
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        } transition-colors shadow-sm`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {activeTab === 'summary' && (
                <div className="bg-white rounded-lg flex flex-col h-[calc(100vh-120px)] overflow-hidden shadow-sm border border-gray-200">
                  <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-700 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
                      </svg>
                      Meeting Summary
                    </h2>
                    <button 
                      onClick={() => setActiveTab('meeting')}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    <div className="mb-5">
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="text-md font-medium text-gray-700 mb-3 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                          </svg>
                          Meeting Audio Analysis
                        </h3>
                        
                        <div className="text-gray-500 text-sm mb-4">
                          {audioTranscript 
                            ? "Other participants' audio has been recorded and transcribed. Generate a summary to analyze what they said."
                            : "Record other participants' audio to generate an AI summary of what they discussed. Only their voices will be recorded, not yours."}
                        </div>
                        
                        {/* Recording Status */}
                        {isRecording && (
                          <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-md flex items-center space-x-2">
                            <div className="h-3 w-3 bg-red-600 rounded-full animate-pulse"></div>
                            <span className="font-medium">Recording in progress</span>
                            <span className="text-red-500 ml-2">
                              {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                            </span>
                          </div>
                        )}
                        
                        {/* Transcription Status */}
                        {isTranscribing && (
                          <div className="mb-4 bg-blue-50 text-blue-700 p-3 rounded-md flex items-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Transcribing audio... This may take a few moments.</span>
                          </div>
                        )}
                        
                        {/* Recording Controls */}
                        <div className="flex space-x-2 mb-4">
                          {!isRecording ? (
                            <button
                              onClick={startRecording}
                              disabled={isTranscribing}
                              className="flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                              </svg>
                              <span>Record Others' Audio</span>
                            </button>
                          ) : (
                            <button
                              onClick={stopRecording}
                              className="flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                              </svg>
                              <span>Stop Recording</span>
                            </button>
                          )}
                          
                          {audioTranscript && (
                            <button
                              onClick={() => setAudioTranscript('')}
                              className="flex items-center justify-center space-x-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              <span>Clear Transcript</span>
                            </button>
                          )}
                        </div>
                        
                        {/* Transcript Preview */}
                        {audioTranscript && (
                          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-md p-3 max-h-32 overflow-y-auto text-sm text-gray-700">
                            <div className="font-medium text-gray-600 mb-1">Transcript Preview:</div>
                            <div className="whitespace-pre-line">
                              {audioTranscript.length > 300 
                                ? `${audioTranscript.substring(0, 300)}...` 
                                : audioTranscript}
                            </div>
                          </div>
                        )}
                        
                        <p className="text-gray-500 text-sm mb-3">Generate AI summary of this meeting</p>
                        <button 
                          className="w-full bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 text-green-600 font-medium py-2.5 px-4 rounded-md shadow-sm transition-all duration-300 flex items-center justify-center gap-2 border border-green-200"
                          onClick={generateSummary}
                          disabled={isResearching}
                        >
                          {isResearching ? (
                            <>
                              <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Generating Summary...
                            </>
                          ) : (
                            <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414-1.414L9 10.586V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                          </svg>
                          Generate Meeting Summary
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    {summaryPoints.length > 0 ? (
                      <div className="space-y-5">
                        {/* Meeting Summary Section */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                          <h3 className="text-md font-medium text-gray-700 mb-3 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9 6a1 1 0 10-2 0v.01a1 1 0 102 0V11zm-6 0a1 1 0 10-2 0v.01a1 1 0 102 0V11zm-3 4a1 1 0 102 0v.01a1 1 0 10-2 0V15zm9 0a1 1 0 10-2 0v.01a1 1 0 102 0V15z" clipRule="evenodd" />
                            </svg>
                            Meeting Summary
                          </h3>
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <p className="text-gray-700 text-sm whitespace-pre-line">{audioTranscript ? 
                              (audioTranscript.length > 500 ? 
                                audioTranscript.substring(0, 500) + '...' : 
                                audioTranscript) : 
                              'No transcript available'}
                            </p>
                          </div>
                        </div>
                        
                        {/* Key Points Section */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                          <h3 className="text-md font-medium text-gray-700 mb-3 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Key Points
                          </h3>
                          <div className="space-y-2.5">
                            {summaryPoints.map((point, index) => (
                              <div key={index} className="flex items-start p-2 border-b border-gray-100 last:border-b-0">
                                <div className="bg-green-100 rounded-full w-5 h-5 flex items-center justify-center mt-0.5 mr-3 flex-shrink-0">
                                  <span className="text-green-600 text-xs font-medium">{index + 1}</span>
                                </div>
                                <p className="text-gray-700 text-sm">{point}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Action Items Section */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                          <h3 className="text-md font-medium text-gray-700 mb-3 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            Action Items
                          </h3>
                          <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                            {summaryPoints.length > 0 ? (
                              <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                                {summaryPoints.slice(0, 3).map((point, idx) => (
                                  <li key={`action-${idx}`} className="pl-1">
                                    <div className="flex items-start">
                                      <input type="checkbox" className="mt-1 mr-2" id={`action-item-${idx}`} />
                                      <label htmlFor={`action-item-${idx}`}>{point}</label>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-gray-500 text-sm">No action items identified in the meeting.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-400 mt-10">
                        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 max-w-sm mx-auto">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
                          </svg>
                          <p className="text-gray-600 font-medium">No summary available</p>
                          <p className="text-sm mt-1 text-gray-500">Generate a summary to see key meeting points here.</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-5 mb-5">
                      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <h3 className="text-md font-medium text-gray-700 mb-3 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                          </svg>
                          AI Research Assistant
                        </h3>
                        
                        {/* Research mode toggle */}
                        {renderResearchModeToggle()}
                        
                        <div className="mt-3">
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Enter a topic to research..."
                              className="flex-1 px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            <button
                              onClick={deepResearch}
                              disabled={isResearching}
                              className="bg-blue-500 text-white px-3 py-2 rounded-md hover:bg-blue-600 transition-colors text-sm flex items-center"
                            >
                              {isResearching ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Researching...
                                </>
                              ) : (
                                <>
                                  {researchMode === 'summary' ? 'Quick Research' : 'Deep Research'}
                                </>
                              )}
                            </button>
                          </div>
                          
                          {researchResults && (
                            <div className="mt-3 bg-gray-50 p-3 rounded-md border border-gray-200 max-h-80 overflow-y-auto">
                              <p className="text-sm text-gray-500 mb-2">{researchMode === 'summary' ? 'Quick Research Results' : 'Comprehensive Research Report'}</p>
                              <div className="whitespace-pre-line text-sm text-gray-700">{researchResults}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <h3 className="text-md font-medium text-gray-700 mb-3 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                          </svg>
                          Export & Integrations
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                          <button className="flex flex-col items-center justify-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500 mb-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs text-gray-600">PDF</span>
                          </button>
                          <button className="flex flex-col items-center justify-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500 mb-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs text-gray-600">Excel</span>
                          </button>
                          <button className="flex flex-col items-center justify-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-500 mb-1" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                            </svg>
                            <span className="text-xs text-gray-600">Slack</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'contacts' && (
                <div className="bg-white rounded-lg flex flex-col h-[calc(100vh-120px)] overflow-hidden shadow-sm border border-gray-200">
                  <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-700 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                      </svg>
                      Meeting Participants
                    </h2>
                    <button 
                      onClick={() => setActiveTab('meeting')}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    {/* Current participant stats */}
                    <div className="bg-indigo-50 rounded-lg p-4 mb-6 border border-indigo-100 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-indigo-700 font-medium">Meeting Information</h3>
                        <div className="bg-indigo-100 text-indigo-600 py-1 px-3 rounded-full text-sm flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                          </svg>
                          {totalParticipants} {totalParticipants === 1 ? 'Person' : 'People'}
                  </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-white rounded-md p-3 border border-indigo-100">
                          <div className="text-gray-500 mb-1">Room ID</div>
                          <div className="font-medium text-gray-700 flex items-center">
                            {roomId}
                            <button 
                              onClick={copyRoomIdToClipboard}
                              className="ml-2 text-indigo-400 hover:text-indigo-600 transition-colors"
                              title="Copy room ID"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                              </svg>
                            </button>
                      </div>
                    </div>
                    
                        <div className="bg-white rounded-md p-3 border border-indigo-100">
                          <div className="text-gray-500 mb-1">Call Duration</div>
                          <div className="font-medium text-gray-700">{recordingTime > 0 ? `${Math.floor(recordingTime / 60)}:${(recordingTime % 60).toString().padStart(2, '0')}` : 'Not recorded'}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Current Participants */}
                    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Active Participants</span>
                    </h3>
                    
                    <div className="space-y-3 mb-6">
                      {/* Current user (You) */}
                      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 flex justify-between items-center">
                        <div className="flex items-center">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                              {username.charAt(0).toUpperCase()}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                          </div>
                          <div className="ml-3">
                            <div className="text-gray-800 font-medium">{username} <span className="text-gray-400 text-sm">(You)</span></div>
                            <div className="text-gray-500 text-xs flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm2 1h8v2H6V6zm8 4H6v2h8v-2zm0 4H6v2h4v-2z" clipRule="evenodd" />
                              </svg>
                              Host
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button 
                            onClick={toggleMute} 
                            className={`p-2 rounded-md ${isMuted ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-600'}`}
                            title={isMuted ? 'Unmute' : 'Mute'}
                          >
                            {isMuted ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                          <button 
                            onClick={toggleVideo} 
                            className={`p-2 rounded-md ${isVideoOff ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-600'}`}
                            title={isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
                          >
                            {isVideoOff ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {/* Other participants */}
                      {Object.entries(peers).map(([peerId, { username: peerUsername }]) => (
                        <div key={peerId} className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 flex justify-between items-center">
                          <div className="flex items-center">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
                                {(peerUsername || "User").charAt(0).toUpperCase()}
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                            </div>
                            <div className="ml-3">
                              <div className="text-gray-800 font-medium">{peerUsername || "User"}</div>
                              <div className="text-gray-500 text-xs">Participant</div>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button className="p-2 rounded-md bg-gray-100 text-gray-600" title="View Profile">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                            <button className="p-2 rounded-md bg-gray-100 text-gray-600" title="Direct Message">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                              </svg>
                            </button>
                        </div>
                      </div>
                    ))}
                      
                      {totalParticipants < 2 && (
                        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 text-center">
                          <div className="text-gray-400 mb-2 flex justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                            </svg>
                          </div>
                          <p className="text-gray-600 font-medium">No other participants yet</p>
                          <p className="text-sm text-gray-500">Invite others by sharing the room ID</p>
                          <button 
                            onClick={copyRoomIdToClipboard}
                            className="mt-3 px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors text-sm inline-flex items-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                            </svg>
                            Copy Invite Link
                          </button>
                        </div>
                      )}
                  </div>

                    {/* Quick Actions */}
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button 
                        onClick={toggleScreenShare}
                        className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center justify-center hover:bg-gray-50 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500 mb-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-gray-700">Share Screen</span>
                      </button>
                      <button 
                        onClick={isRecording ? stopRecording : startRecording}
                        className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center justify-center hover:bg-gray-50 transition-colors"
                      >
                        {isRecording ? (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500 mb-1" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" />
                            </svg>
                            <span className="text-sm text-gray-700">Stop Recording</span>
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500 mb-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-gray-700">Record Meeting</span>
                          </>
                        )}
                      </button>
                    </div>
                    
                    <button
                      onClick={handleLeaveRoom}
                      className="w-full bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 mt-4 flex items-center justify-center transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h9a1 1 0 001-1v-3a1 1 0 00-2 0v2H4V5h7v2a1 1 0 002 0V4a1 1 0 00-1-1H3z" clipRule="evenodd" />
                        <path d="M16.293 9.293l-3-3a1 1 0 10-1.414 1.414L14.586 10l-2.293 2.293a1 1 0 101.414 1.414l3-3L16 13.414l2.293-2.293a1 1 0 000-1.414z" />
                      </svg>
                      End Meeting
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'gmail' && (
                <div className="bg-white rounded-lg flex flex-col h-[calc(100vh-120px)] overflow-hidden shadow-sm border border-gray-200">
                  <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-700 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                      Gmail
                    </h2>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setIsComposingEmail(true)}
                        className="bg-blue-500 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-600 transition-colors flex items-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
                        </svg>
                        Compose
                      </button>
                      <button onClick={() => setActiveTab('meeting')} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    {!isAuthenticated ? (
                      <div className="text-center py-8">
                        <h3 className="text-lg font-medium text-gray-700 mb-4">Connect your Gmail account</h3>
                        <button
                          onClick={handleGmailAuth}
                          className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors flex items-center mx-auto"
                        >
                          <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z"/>
                          </svg>
                          Connect with Gmail
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {isComposingEmail ? (
                          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="p-4 space-y-4">
                              <input
                                type="email"
                                placeholder="To"
                                value={emailTo}
                                onChange={(e) => setEmailTo(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <input
                                type="text"
                                placeholder="Subject"
                                value={emailSubject}
                                onChange={(e) => setEmailSubject(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <textarea
                                placeholder="Email body"
                                value={emailBody}
                                onChange={(e) => setEmailBody(e.target.value)}
                                rows={8}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-between">
                              <button
                                onClick={sendEmail}
                                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
                                disabled={!emailTo || !emailSubject || !emailBody}
                              >
                                Send
                              </button>
                              <button
                                onClick={() => setIsComposingEmail(false)}
                                className="text-gray-600 hover:text-gray-800 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : selectedEmail ? (
                          <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h3 className="text-xl font-medium text-gray-800">{selectedEmail.subject}</h3>
                                <p className="text-gray-600 text-sm">{selectedEmail.sender}</p>
                                <p className="text-gray-500 text-xs">{selectedEmail.date}</p>
                              </div>
                              <button
                                onClick={() => setSelectedEmail(null)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                            <div className="prose max-w-none">
                              <p>{selectedEmail.snippet}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {isLoadingEmails ? (
                              <div className="text-center py-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                                <p className="text-gray-500 mt-2">Loading emails...</p>
                              </div>
                            ) : gmailMessages.length > 0 ? (
                              gmailMessages.map((email) => (
                                <div
                                  key={email.id}
                                  onClick={() => setSelectedEmail(email)}
                                  className={`cursor-pointer p-3 rounded-lg border ${
                                    email.read ? 'bg-white border-gray-200' : 'bg-blue-50 border-blue-200'
                                  } hover:shadow-md transition-shadow`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center space-x-2">
                                        <span className={`font-medium ${email.read ? 'text-gray-700' : 'text-gray-900'}`}>
                                          {email.sender}
                                        </span>
                                        <span className="text-gray-400 text-sm">{email.date}</span>
                                      </div>
                                      <h4 className={`text-sm ${email.read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                                        {email.subject}
                                      </h4>
                                      <p className="text-gray-500 text-sm truncate">{email.snippet}</p>
                                    </div>
                                    {email.starred && (
                                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                      </svg>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-4 text-gray-500">No emails found</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Control bar - modern floating style */}
      <div 
        className={`${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'
        } fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-white rounded-xl flex items-center space-x-2 shadow-md transition-all duration-300 ease-in-out z-20 border border-gray-200`}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(true)}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className={`relative p-2.5 rounded-full transition-all duration-300 ${
              isMuted 
                ? 'bg-red-100 text-red-500 hover:bg-red-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } shadow-sm hover:scale-105`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-500 shadow border border-white"></div>
            {isMuted ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          <button
            onClick={toggleVideo}
            className={`relative p-2.5 rounded-full transition-all duration-300 ${
              isVideoOff
                ? 'bg-red-100 text-red-500 hover:bg-red-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } shadow-sm hover:scale-105`}
            title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
          >
            {isVideoOff ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
            )}
          </button>

          <button
            onClick={toggleScreenShare}
            className={`relative p-2.5 rounded-full transition-all duration-300 ${
              isScreenSharing
                ? 'bg-indigo-100 text-indigo-500 hover:bg-indigo-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } shadow-sm hover:scale-105`}
            title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
          >
            {isScreenSharing ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          <button
            onClick={() => setIsResearcherOpen(!isResearcherOpen)}
            className={`relative p-2.5 rounded-full transition-all duration-300 ${
              isResearcherOpen
                ? 'bg-purple-100 text-purple-500 hover:bg-purple-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } shadow-sm hover:scale-105`}
            title="Smart Search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </button>

          <div className="h-8 w-px bg-gray-200 mx-1"></div>
          
          {/* Meeting recording button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`relative p-2.5 rounded-full transition-all duration-300 ${
              isRecording
                ? 'bg-red-100 text-red-500 hover:bg-red-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } shadow-sm hover:scale-105`}
            title={isRecording ? "Stop Recording" : "Record Meeting"}
          >
            {isRecording ? (
              <>
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow border border-white"></div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" />
                </svg>
              </>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          <div className="h-8 w-px bg-gray-200 mx-1"></div>

          <button
            onClick={() => setActiveTab('chat')}
            className={`relative p-2.5 rounded-full transition-all duration-300 ${
              activeTab === 'chat'
                ? 'bg-blue-100 text-blue-500 hover:bg-blue-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } shadow-sm hover:scale-105`}
            title="Chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
            </svg>
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium shadow-sm">
                {messages.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('summary')}
            className={`relative p-2.5 rounded-full transition-all duration-300 ${
              activeTab === 'summary'
                ? 'bg-green-100 text-green-500 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } shadow-sm hover:scale-105`}
            title="Meeting Summary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="h-8 w-px bg-gray-200 mx-1"></div>

        <button
          onClick={handleLeaveRoom}
          className="bg-red-50 hover:bg-red-100 text-red-500 px-4 py-2 rounded-full flex items-center space-x-1 shadow-sm transition-all duration-300 hover:scale-105"
          title="Leave Meeting"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h9a1 1 0 001-1v-3a1 1 0 00-2 0v2H4V5h7v2a1 1 0 002 0V4a1 1 0 00-1-1H3z" clipRule="evenodd" />
            <path d="M16.293 9.293l-3-3a1 1 0 10-1.414 1.414L14.586 10l-2.293 2.293a1 1 0 101.414 1.414l3-3L16 13.414l2.293-2.293a1 1 0 000-1.414z" />
          </svg>
          Leave
        </button>
      </div>
    </div>
  );
};