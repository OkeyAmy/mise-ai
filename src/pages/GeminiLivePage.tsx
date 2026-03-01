/**
 * Gemini Live Page - Real-time AI Video Chat
 * 
 * This page demonstrates the complete Gemini Live integration with:
 * - Real-time video and audio streaming to Gemini AI
 * - Live transcription of user speech and AI responses
 * - Video controls for camera, microphone, and recording
 * - Conversation overlay showing real-time transcripts
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import useGeminiLive from '../hooks/useGeminiLive';
import { ConversationOverlay } from '../components/ConversationOverlay';
import { VideoControls } from '../components/VideoControls';
import { useIsMobile } from '../hooks/use-mobile';

// System instruction for the AI
const SYSTEM_INSTRUCTION = `You are a helpful AI assistant with vision and hearing capabilities. You can see what the user is showing through their camera and hear what they're saying through their microphone. 

Be conversational, friendly, and helpful. Respond naturally to what you see and hear. If the user shows you something, describe what you see. If they ask questions, answer them clearly and concisely. 

Keep responses relatively brief unless the user asks for detailed explanations. Feel free to ask follow-up questions to better help the user.`;

// Voice settings for the AI
const VOICE_SETTINGS = {
  voiceId: 'Orus', // Gemini's default voice
  languageCode: 'en-US',
};

export default function GeminiLivePage() {
  const isMobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Local state for controls
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isAiMuted, setIsAiMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('user');

  // Gemini Live hook
  const {
    isInitialized,
    isRecording,
    statusMessage,
    errorMessage,
    mediaStream,
    apiKeyMissing,
    userTranscript,
    userTranscriptIsFinal,
    modelTranscript,
    modelTranscriptIsFinal,
    inputGainNode,
    outputGainNode,
    startRecording,
    stopRecording,
    resetSession,
    setVideoTrackEnabled,
  } = useGeminiLive(SYSTEM_INSTRUCTION, VOICE_SETTINGS);

  // Update video element when media stream changes
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  // Update video track when camera state changes
  useEffect(() => {
    if (setVideoTrackEnabled) {
      setVideoTrackEnabled(isCameraOn);
    }
  }, [isCameraOn, setVideoTrackEnabled]);

  // Control handlers
  const handleToggleCamera = () => {
    setIsCameraOn(!isCameraOn);
  };

  const handleToggleMic = () => {
    setIsMicOn(!isMicOn);
    // You could also mute/unmute the audio track here if needed
    if (mediaStream) {
      mediaStream.getAudioTracks().forEach(track => {
        track.enabled = !isMicOn;
      });
    }
  };

  const handleSwitchCamera = async () => {
    // This would require additional implementation to switch between front/back cameras
    setFacingMode(facingMode === 'user' ? 'environment' : 'user');
  };

  const handleToggleAiMuted = () => {
    setIsAiMuted(!isAiMuted);
    // Mute/unmute AI output
    if (outputGainNode) {
      outputGainNode.gain.value = isAiMuted ? 0.7 : 0;
    }
  };

  const handleStartRecording = async () => {
    try {
      await startRecording(isCameraOn);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  const handleResetSession = () => {
    resetSession();
  };

  // Check if we're connected (initialized and no API key missing)
  const isConnected = isInitialized && !apiKeyMissing;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 flex flex-col">
      {/* Header */}
      <header className="p-4 text-center">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-white mb-2"
        >
          Gemini Live Assistant
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-white/70"
        >
          Real-time AI conversation with vision and voice
        </motion.p>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 relative">
        {/* Status Display */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 text-center"
        >
          <div className={`px-4 py-2 rounded-full text-sm font-medium ${
            errorMessage 
              ? 'bg-red-500/20 text-red-200 border border-red-500/30'
              : isRecording
                ? 'bg-green-500/20 text-green-200 border border-green-500/30'
                : isConnected
                  ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30'
                  : 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/30'
          }`}>
            {errorMessage || statusMessage || 'Initializing...'}
          </div>
        </motion.div>

        {/* Video Container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative w-full max-w-2xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Video Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isCameraOn ? 'opacity-100' : 'opacity-0'
            }`}
          />
          
          {/* Camera Off Overlay */}
          {!isCameraOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center text-white/60">
                <div className="text-4xl mb-2">📷</div>
                <p>Camera is off</p>
              </div>
            </div>
          )}

          {/* Conversation Overlay */}
          <ConversationOverlay
            userTranscript={userTranscript}
            userTranscriptIsFinal={userTranscriptIsFinal}
            modelTranscript={modelTranscript}
            modelTranscriptIsFinal={modelTranscriptIsFinal}
            isRecording={isRecording}
          />

          {/* Recording Indicator */}
          {isRecording && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute top-4 left-4 flex items-center gap-2 bg-red-500/90 text-white px-3 py-1 rounded-full text-sm font-medium"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-2 h-2 bg-white rounded-full"
              />
              LIVE
            </motion.div>
          )}
        </motion.div>

        {/* Controls */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <VideoControls
            isMobile={isMobile}
            isCameraOn={isCameraOn}
            isMicOn={isMicOn}
            isAiMuted={isAiMuted}
            isRecording={isRecording}
            isConnected={isConnected}
            facingMode={facingMode}
            onToggleCamera={handleToggleCamera}
            onToggleMic={handleToggleMic}
            onSwitchCamera={handleSwitchCamera}
            onToggleAiMuted={handleToggleAiMuted}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onResetSession={handleResetSession}
          />
        </motion.div>

        {/* API Key Warning */}
        {apiKeyMissing && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-center max-w-md"
          >
            <h3 className="font-semibold mb-2">API Key Required</h3>
            <p className="text-sm">
              Please set your <code>VITE_GEMINI_API_KEY</code> environment variable to use Gemini Live.
            </p>
          </motion.div>
        )}

        {/* Instructions */}
        {!isRecording && isConnected && !apiKeyMissing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-center text-white/60 max-w-md"
          >
            <p className="text-sm">
              Click the green play button to start your conversation with the AI. 
              It can see your camera and hear your microphone in real-time.
            </p>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-white/40 text-xs">
        Powered by Google Gemini Live API
      </footer>
    </div>
  );
} 