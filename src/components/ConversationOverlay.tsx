import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ConversationOverlayProps {
  userTranscript: string;
  userTranscriptIsFinal: boolean;
  modelTranscript: string;
  modelTranscriptIsFinal: boolean;
  isRecording: boolean;
}

export const ConversationOverlay: React.FC<ConversationOverlayProps> = ({
  userTranscript,
  userTranscriptIsFinal,
  modelTranscript,
  modelTranscriptIsFinal,
  isRecording
}) => {
  // Create unique keys for each message to ensure proper animation
  const [userMessageKey, setUserMessageKey] = useState<string>('user-0');
  const [aiMessageKey, setAiMessageKey] = useState<string>('ai-0');
  
  // Track previous transcript to detect changes
  const [prevUserTranscript, setPrevUserTranscript] = useState<string>('');
  const [prevModelTranscript, setPrevModelTranscript] = useState<string>('');
  
  // Update keys when transcripts change to trigger animations
  useEffect(() => {
    if (userTranscript && userTranscript !== prevUserTranscript) {
      setUserMessageKey(`user-${Date.now()}`);
      setPrevUserTranscript(userTranscript);
    }
  }, [userTranscript, prevUserTranscript]);
  
  useEffect(() => {
    if (modelTranscript && modelTranscript !== prevModelTranscript) {
      setAiMessageKey(`ai-${Date.now()}`);
      setPrevModelTranscript(modelTranscript);
    }
  }, [modelTranscript, prevModelTranscript]);

  const showUserMessage = userTranscript && (isRecording || !userTranscriptIsFinal);
  const showAiMessage = modelTranscript;

  return (
    <div className="absolute inset-x-4 top-4 bottom-32 overflow-hidden pointer-events-none flex flex-col justify-end">
      <div className="flex flex-col gap-4">
        <AnimatePresence mode="popLayout">
          {showUserMessage && (
            <motion.div 
              key={userMessageKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-lg self-start max-w-[80%]"
            >
              <div className={cn("text-white text-base", !userTranscriptIsFinal && "opacity-75 italic")}>
                <p>{userTranscript}</p>
                {!userTranscriptIsFinal && (
                  <span className="text-xs text-white/60 mt-1 block">Listening...</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <AnimatePresence mode="popLayout">
          {showAiMessage && (
            <motion.div 
              key={aiMessageKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-gradient-to-r from-orange-400/30 to-amber-400/30 backdrop-blur-md rounded-2xl p-4 border border-orange-300/30 shadow-lg self-end max-w-[80%]"
            >
              <div className={cn("text-white text-base", !modelTranscriptIsFinal && "opacity-75 italic")}>
                <p>{modelTranscript}</p>
                {!modelTranscriptIsFinal && (
                  <span className="text-xs text-white/50 mt-1 block">AI is speaking...</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ConversationOverlay; 