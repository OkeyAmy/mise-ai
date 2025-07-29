import React, { useState, useRef, useEffect } from 'react';
import { X, Play, Sparkles, RefreshCw, Video, Volume2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useABTesting } from '@/hooks/useABTesting';
import { ConversationOverlay } from './ConversationOverlay';
import { motion } from 'framer-motion';
import { VideoControls } from './VideoControls';
import useGeminiLive from '@/hooks/useGeminiLive'; // Import the hook

interface VideoRecordingFlowProps {
  onClose: () => void;
  isMobile?: boolean;
}

// System instruction and voice settings from GeminiLivePage.tsx
const SYSTEM_INSTRUCTION = `You are a helpful AI assistant with vision and hearing capabilities. You can see what the user is showing through their camera and hear what they're saying through their microphone. 

Be conversational, friendly, and helpful. Respond naturally to what you see and hear. If the user shows you something, describe what you see. If they ask questions, answer them clearly and concisely. 

Keep responses relatively brief unless the user asks for detailed explanations. Feel free to ask follow-up questions to better help the user.`;

const VOICE_SETTINGS = {
  voiceId: 'Orus',
  languageCode: 'en-US',
};

export const VideoRecordingFlow: React.FC<VideoRecordingFlowProps> = ({
  onClose,
  isMobile = false,
}) => {
  const [stage, setStage] = useState<'confirmation' | 'recording'>('confirmation');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('user');
  
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isAiMuted, setIsAiMuted] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const { currentVideoConfirmation } = useABTesting();

  // State for typed input
  const [inputValue, setInputValue] = useState('');

  // Integrate the useGeminiLive hook
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
    outputGainNode,
    startRecording: startGeminiStreaming,
    stopRecording: stopGeminiStreaming,
    resetSession,
    setVideoTrackEnabled,
    sendText, // Assuming useGeminiLive will expose this
  } = useGeminiLive(SYSTEM_INSTRUCTION, VOICE_SETTINGS);

  const isConnected = isInitialized && !apiKeyMissing;

  // Effect to attach the stream to the video element
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

  const handleStartStreaming = async () => {
        setStage('recording');
    await startGeminiStreaming(isCameraOn);
  };

  const handleStopSession = () => {
    stopGeminiStreaming();
      onClose();
  };

  const handleToggleCamera = () => {
        setIsCameraOn(prev => !prev);
  };

  const handleToggleMic = () => {
    setIsMicOn(prev => {
      if (mediaStream) {
        mediaStream.getAudioTracks().forEach(track => {
          track.enabled = !prev;
        });
      }
      return !prev;
    });
  };

  const handleSwitchCamera = async () => {
    // Basic facing mode toggle. A full implementation would require re-acquiring the stream.
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    toast({
      title: "Camera Switch",
      description: "Full camera switching requires restarting the stream. This feature is for UI demonstration.",
    });
  };

  const handleToggleAiMuted = () => {
    setIsAiMuted(prev => {
      if (outputGainNode) {
        outputGainNode.gain.value = !prev ? 0 : 0.7;
      }
      return !prev;
    });
  };

  const handleSendMessage = () => {
    if (inputValue.trim() && sendText) {
      sendText(inputValue);
    setInputValue('');
    }
  };


  // Confirmation Modal
  if (stage === 'confirmation') {
    return (
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xl flex items-end lg:items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: isMobile ? '100%' : 20, scale: isMobile ? 1 : 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: isMobile ? '100%' : 20, scale: isMobile ? 1 : 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-full max-w-md lg:max-w-lg bg-white/15 backdrop-blur-lg rounded-2xl lg:rounded-3xl shadow-2xl border border-white/20 p-6 lg:p-8 transform transition-all duration-500 ease-out animate-slide-in-right lg:animate-scale-in"
        >
          <div className="absolute inset-0 rounded-2xl lg:rounded-3xl bg-gradient-to-r from-orange-400/20 via-red-400/20 to-amber-400/20 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          
          <button 
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-200 hover:scale-105"
          >
            <X className="w-4 h-4 text-white/80" />
          </button>

          <div className="text-center space-y-6">
            <div className="space-y-2">
              <motion.h2 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="text-xl lg:text-2xl font-inter font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-300 to-amber-300"
              >
                {currentVideoConfirmation.title}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="text-sm lg:text-base text-white/70 font-inter tracking-tight"
              >
                {apiKeyMissing ? "API Key is missing. Please configure it." : (errorMessage || currentVideoConfirmation.description)}
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="flex flex-col lg:flex-row gap-3 lg:gap-4"
            >
              <Button
                onClick={handleStartStreaming}
                disabled={!isConnected || apiKeyMissing}
                className="w-full lg:flex-1 bg-white/20 hover:bg-white/30 text-white border border-white/30 hover:border-white/50 rounded-full py-3 lg:py-4 font-inter tracking-tight transition-all duration-200 hover:scale-105 hover:shadow-lg relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-red-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Play className="w-4 h-4 mr-2" />
                Start Streaming
              </Button>
              
              <Button
                onClick={onClose}
                variant="ghost"
                className="w-full lg:flex-1 text-white/80 hover:text-white border border-white/20 hover:border-white/40 rounded-full py-3 lg:py-4 font-inter tracking-tight transition-all duration-200 hover:bg-white/10"
              >
                Cancel
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Recording State (now Streaming State)
  if (stage === 'recording') {
    return (
      <div className="fixed inset-0 z-[100] bg-black">
        {/* Video Preview */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover brightness-75"
        />

        <ConversationOverlay 
          userTranscript={userTranscript}
          userTranscriptIsFinal={userTranscriptIsFinal}
          modelTranscript={modelTranscript}
          modelTranscriptIsFinal={modelTranscriptIsFinal}
          isRecording={isRecording}
        />

        {/* --- Bottom Controls --- */}
        <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-4 pointer-events-auto">
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
            onStartRecording={handleStartStreaming}
            onStopRecording={handleStopSession}
            onResetSession={resetSession}
          />
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="flex items-center gap-2 p-2 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 shadow-lg w-[92%] max-w-lg"
          >
            <input
              type="text"
              placeholder="Ask Anything..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1 bg-transparent text-white placeholder:text-white/50 text-base px-3 py-2 border-none focus:outline-none focus:ring-0"
            />
            <motion.button
              onClick={handleStopSession}
              whileTap={{ scale: 0.95 }}
              className="px-5 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold flex items-center gap-2"
            >
              <div className="w-2.5 h-2.5 bg-white rounded-sm" />
              Stop
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  return null;
};

export default VideoRecordingFlow;