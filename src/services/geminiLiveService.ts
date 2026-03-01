/**
 * Gemini Live Service for Real-time AI Communication
 * 
 * This service manages the connection and real-time communication with the Gemini Live API
 * for audio and video streaming. It handles device access, audio/video capture,
 * data encoding, API interaction, and playback of AI responses.
 */

import { GoogleGenAI, LiveServerMessage, Modality, Session, LiveServerContent } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';

// Types for the service
export interface GeminiLiveAICallbacks {
  onStatusUpdate: (status: string) => void;
  onErrorUpdate: (error: string) => void;
  onRecordingStateChange: (isRecording: boolean) => void;
  onUserTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
  onModelTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
  onMediaStreamAvailable: (stream: MediaStream | null) => void;
}

export interface VoiceSettings {
  voiceId: string;
  languageCode?: string;
}

// Constants for reconnection logic
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_BASE_MS = 2000;

/**
 * Manages the connection and real-time communication with the Gemini Live API
 * for audio and video streaming. It handles device access, audio/video capture,
 * data encoding, API interaction, and playback of AI responses.
 */
export class GeminiLiveAI {
  private client: GoogleGenAI;
  private session: Session | null = null;
  public readonly inputAudioContext: AudioContext;
  public readonly outputAudioContext: AudioContext;
  private readonly _inputNode: GainNode; // For controlling microphone input volume
  private readonly _outputNode: GainNode; // For controlling AI voice output volume
  private nextStartTime = 0; // For scheduling AI audio output playback sequentially

  // Media stream and audio processing
  private mediaStream: MediaStream | null = null;
  private mediaStreamSourceNode: MediaStreamAudioSourceNode | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private audioWorkletLoaded = false;

  // AI audio output management
  private sources = new Set<AudioBufferSourceNode>(); // Active AI audio output sources

  // Callbacks and state
  private callbacks: GeminiLiveAICallbacks;
  private reconnectAttempts = 0;
  private isDisposed = false; // Flag to prevent operations on a disposed instance
  private isVideoTrackGloballyEnabled = true; // User preference for video state

  // Video frame capture
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private videoFrameCaptureIntervalId: number | null = null;

  // Constants for video processing
  private static readonly VIDEO_FRAME_RATE = 1; // 1 FPS for video frame capture
  private static readonly VIDEO_QUALITY = 0.8; // JPEG quality for video frames

  /**
   * Initializes the GeminiLiveAI service.
   * @param callbacks - Callback functions for status updates, errors, transcripts, and media stream availability.
   * @param systemInstruction - Optional system instruction to guide the AI's persona and behavior.
   * @param voiceSettings - Optional voice configuration settings.
   * @throws Error if API_KEY is not set or AudioContext cannot be created.
   */
  constructor(
    callbacks: GeminiLiveAICallbacks, 
    private systemInstruction?: string, 
    private voiceSettings?: VoiceSettings
  ) {
    this.callbacks = callbacks;

    // Get API key from environment variables
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
    if (!apiKey) {
      const apiKeyError = "VITE_GEMINI_API_KEY environment variable not set. Please configure it.";
      this.callbacks.onErrorUpdate(apiKeyError);
      this.callbacks.onStatusUpdate(`Error: ${apiKeyError}`);
      throw new Error(apiKeyError);
    }

    this.client = new GoogleGenAI({
      apiKey: apiKey,
    });

    try {
      // Input context for microphone processing
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      // Output context for AI voice playback
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    } catch (e: unknown) {
      const audioContextError = `Failed to create AudioContext: ${(e as Error).message}. This browser may not be supported.`;
      this.callbacks.onErrorUpdate(audioContextError);
      this.callbacks.onStatusUpdate(`Error: ${audioContextError}`);
      throw new Error(audioContextError);
    }

    this._inputNode = this.inputAudioContext.createGain();
    this._outputNode = this.outputAudioContext.createGain();

    this.initOutputAudio();
    this.loadAudioWorklet(); // Load audio worklet for modern audio processing
    this.connect(); // Attempt initial connection
  }

  /**
   * Loads the audio worklet processor for modern audio processing
   */
  private async loadAudioWorklet(): Promise<void> {
    try {
      await this.inputAudioContext.audioWorklet.addModule('/audio-processor.js');
      this.audioWorkletLoaded = true;
      console.log('Audio worklet loaded successfully');
    } catch (error) {
      console.error('Failed to load audio worklet:', error);
      this.callbacks.onErrorUpdate('Audio processing setup failed');
    }
  }

  /**
   * Creates and configures the audio worklet node for processing audio
   */
  private createAudioWorkletNode(): AudioWorkletNode | null {
    if (!this.audioWorkletLoaded) {
      console.warn('Audio worklet not loaded, cannot create audio worklet node');
      return null;
    }

    try {
      const audioWorkletNode = new AudioWorkletNode(this.inputAudioContext, 'audio-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 0, // No outputs to avoid audio feedback
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'discrete'
      });

      // Handle messages from the audio worklet processor
      audioWorkletNode.port.onmessage = (event) => {
        if (this.isDisposed || !this.session) {
          return;
        }

        const { pcmData } = event.data;
        if (pcmData) {
          try {
            // Send the PCM data to the Gemini session
            if (this.session) {
              this.session.sendRealtimeInput({ media: createBlob(pcmData) });
            }
          } catch (e: unknown) {
            if (this.isDisposed) {
              return;
            }
            const errorMessage = (e instanceof Error) ? e.message : 'Unknown error sending audio data';
            console.error("Error sending audio data to Gemini:", e);
            this.callbacks.onErrorUpdate(`Error sending audio: ${errorMessage}`);
            this.stopRecording(); // Stop recording on critical send error
          }
        }
      };

      return audioWorkletNode;
    } catch (error) {
      console.error('Failed to create audio worklet node:', error);
      return null;
    }
  }

  /**
   * Initializes the output audio pipeline by connecting the output gain node
   * to the audio context's destination (speakers).
   */
  private initOutputAudio(): void {
    this.nextStartTime = this.outputAudioContext.currentTime;
    this._outputNode.connect(this.outputAudioContext.destination);
  }

  /**
   * Establishes or re-establishes a connection to the Gemini Live API.
   * Handles session setup and callbacks for API events.
   */
  private async connect(): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    // Model supporting native audio input and output for more natural interaction
    const model = 'gemini-2.0-flash-live-001';
    this.callbacks.onStatusUpdate('Connecting to Gemini...');

    // Configuration for the Live API session
    const liveConnectConfig = {
      responseModalities: [Modality.AUDIO], // Expect audio responses from AI
      speechConfig: { 
        voiceConfig: { 
          prebuiltVoiceConfig: { 
            voiceName: this.voiceSettings?.voiceId || 'Orus' 
          } 
        },
        // Add language code if specified
        ...(this.voiceSettings?.languageCode && {
          languageCode: this.voiceSettings.languageCode
        })
      },
      inputAudioTranscription: {}, // Enable transcription of user's audio
      outputAudioTranscription: {}, // Enable transcription of AI's audio output
      inputModalities: [Modality.AUDIO, Modality.IMAGE], // Support both audio and image input
      // Conditionally add system instruction if provided
      ...(this.systemInstruction && this.systemInstruction.trim() !== '' && {
        systemInstruction: { parts: [{ text: this.systemInstruction }] }
      }),
    };
    
    console.log('GeminiLiveAI: Connecting with system instruction:', this.systemInstruction ? this.systemInstruction.substring(0, 100) + '...' : 'None');

    try {
      this.session = await this.client.live.connect({
        model: model,
        callbacks: {
          onopen: () => {
            if (this.isDisposed) {
              return;
            }
            this.callbacks.onStatusUpdate('Connection opened. Ready.');
            this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
          },
          onmessage: this.handleLiveServerMessage.bind(this),
          onerror: (e: Event) => {
            if (this.isDisposed) {
              return;
            }
            const errorMessage = (e instanceof ErrorEvent) ? e.message : (e instanceof Error) ? e.message : 'Unknown session error';
            console.error('Gemini Live Session Error:', e);
            this.callbacks.onErrorUpdate(`Session error: ${errorMessage}`);
            this.callbacks.onStatusUpdate(`Session error: ${errorMessage}`);
            this.callbacks.onRecordingStateChange(false); // Ensure recording state is updated
            this.disconnectAndReconnect(); // Attempt to reconnect on error
          },
          onclose: (e: CloseEvent) => {
            if (this.isDisposed && e.code !== 1000) {
              return;
            }
            this.callbacks.onStatusUpdate(`Session closed: ${e.reason || 'No reason provided'}. Code: ${e.code}`);
            this.callbacks.onRecordingStateChange(false);
            // Reconnect only on abnormal closures and if not intentionally disposed
            if (!e.wasClean && e.code !== 1000 && !this.isDisposed) {
              this.callbacks.onStatusUpdate('Attempting to reconnect...');
              this.disconnectAndReconnect(RECONNECT_DELAY_BASE_MS * Math.pow(2, this.reconnectAttempts));
            }
          },
        },
        config: liveConnectConfig,
      });
    } catch (e: unknown) {
      if (this.isDisposed) {
        return;
      }
      const errorMessage = (e instanceof Error) ? e.message : 'Unknown connection error';
      console.error('Failed to connect to Gemini Live API:', e);
      this.callbacks.onErrorUpdate(`Connection failed: ${errorMessage}`);
      this.callbacks.onStatusUpdate(`Error: Connection failed. ${errorMessage}`);
      this.callbacks.onRecordingStateChange(false);
      
      // Attempt reconnect for generic errors, not for auth/permission issues
      if (!errorMessage.toLowerCase().includes("api key") &&
        !errorMessage.toLowerCase().includes("permission denied") &&
        !this.isDisposed) {
        this.disconnectAndReconnect(RECONNECT_DELAY_BASE_MS * Math.pow(2, this.reconnectAttempts));
      }
    }
  }

  /**
   * Handles incoming messages from the Gemini Live server, processing audio,
   * transcripts, and control signals.
   * @param message - The `LiveServerMessage` received from the API.
   */
  private async handleLiveServerMessage(message: LiveServerMessage): Promise<void> {
    if (this.isDisposed) {
      return;
    }
    
    console.log('GeminiLiveAI: Received message from server:', {
      hasServerContent: !!message.serverContent,
      hasModelTurn: !!message.serverContent?.modelTurn,
      hasAudioPart: !!message.serverContent?.modelTurn?.parts?.find(part => part.inlineData?.data),
      hasInputTranscription: !!message.serverContent?.inputTranscription,
      hasOutputTranscription: !!message.serverContent?.outputTranscription,
      isTurnComplete: !!message.serverContent?.turnComplete
    });
    
    const serverContent: LiveServerContent | undefined = message.serverContent;
    const isTurnComplete = !!serverContent?.turnComplete;

    // Handle AI audio output
    const audioPart = serverContent?.modelTurn?.parts?.find(part => part.inlineData?.data);
    if (audioPart?.inlineData?.data) {
      await this.playReceivedAudio(audioPart.inlineData.data);
    }

    // Handle interruption signal from server
    if (serverContent?.interrupted) {
      this.stopAllPlayingAudio();
      if (!this.isDisposed) {
        this.callbacks.onStatusUpdate('Input interrupted by server.');
      }
    }

    // Handle user transcript updates
    const inputTranscription = serverContent?.inputTranscription;
    if (inputTranscription?.text && this.callbacks.onUserTranscriptUpdate && !this.isDisposed) {
      const modelIsActiveInThisMessage = !!(serverContent?.modelTurn || serverContent?.outputTranscription);
      // User transcript is final if the turn is complete AND the model isn't also active in this same message
      const userIsFinalState = isTurnComplete ? !modelIsActiveInThisMessage : false;
      this.callbacks.onUserTranscriptUpdate(inputTranscription.text, userIsFinalState);
    }

    // Handle model transcript updates
    const modelTurn = serverContent?.modelTurn;
    const modelAudioTranscription = serverContent?.outputTranscription;
    if (this.callbacks.onModelTranscriptUpdate && !this.isDisposed) {
      if (modelAudioTranscription?.text) {
        this.callbacks.onModelTranscriptUpdate(modelAudioTranscription.text, isTurnComplete);
      } else if (modelTurn) {
        // Fallback to text part in modelTurn if direct outputTranscription is not available
        const textPart = modelTurn.parts?.find(p => typeof p.text === 'string');
        if (textPart?.text) {
          this.callbacks.onModelTranscriptUpdate(textPart.text, isTurnComplete);
        }
      }
    }
  }

  /**
   * Decodes and plays audio data received from the AI.
   * Schedules audio playback to ensure sequential output.
   * @param base64AudioData - Base64 encoded audio data string.
   */
  private async playReceivedAudio(base64AudioData: string): Promise<void> {
    // Ensure playback starts no earlier than the current time or the scheduled end of previous audio
    this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
    
    try {
      const audioBuffer = await decodeAudioData(
        decode(base64AudioData),
        this.outputAudioContext,
        24000, // Gemini speech output is typically 24kHz
        1      // Mono channel
      );

      if (this.isDisposed || audioBuffer.length === 0) {
        return; // Don't play if disposed or buffer is empty
      }

      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this._outputNode); // Connect to the main output gain node
      
      // Remove source from active set when playback ends
      source.addEventListener('ended', () => this.sources.delete(source));

      source.start(this.nextStartTime); // Start playback at the scheduled time
      this.nextStartTime += audioBuffer.duration; // Schedule next audio after this one finishes
      this.sources.add(source); // Add to active sources set
    } catch (e: unknown) {
      if (this.isDisposed) {
        return;
      }
      console.error('Error processing received AI audio:', e);
      this.callbacks.onErrorUpdate(`Failed to play AI audio: ${(e as Error).message}`);
    }
  }

  /**
   * Stops all currently playing AI audio output.
   */
  private stopAllPlayingAudio(): void {
    this.sources.forEach(source => {
      try {
        source.stop(); // Stop playback
      } catch (e) {
        // This can throw if already stopped or context is closing, usually safe to ignore
        console.warn("Error stopping an audio source (might be already stopped):", e);
      }
    });
    this.sources.clear(); // Clear the set of active sources
    
    if (!this.isDisposed) {
      // Reset next start time to current time for future playback
      this.nextStartTime = this.outputAudioContext.currentTime;
    }
  }

  /**
   * Enables or disables the video track in the `mediaStream`.
   * Also starts or stops video frame capture based on the new state and recording status.
   * @param enable - True to enable the video track, false to disable.
   */
  public setVideoTrackEnabled(enable: boolean): void {
    this.isVideoTrackGloballyEnabled = enable;
    this.mediaStream?.getVideoTracks().forEach(track => track.enabled = enable);

    // If enabling video and recording is active, start frame capture
    // If disabling video, stop frame capture
    if (enable && this.isRecordingActive()) {
      this.startVideoFrameCapture();
    } else {
      this.stopVideoFrameCapture();
    }
  }

  /**
   * Checks if audio or video recording/capture is currently active.
   * @returns True if recording (audio AudioWorkletNode active) or video capture (interval active) is ongoing.
   */
  private isRecordingActive(): boolean {
    return !!(this.audioWorkletNode || this.videoFrameCaptureIntervalId);
  }

  /**
   * Starts recording audio and, if enabled, video.
   * Requests device access, sets up audio processing pipeline, and initiates video frame capture.
   * @param initialVideoEnabled - Optional flag to set the initial state of video track (enabled/disabled).
   */
  public async startRecording(initialVideoEnabled?: boolean): Promise<void> {
    if (this.isDisposed || this.isRecordingActive()) {
      if (!this.isDisposed) {
        this.callbacks.onStatusUpdate(this.isRecordingActive() ? 'Already recording.' : 'Instance disposed, cannot start recording.');
      }
      return;
    }

    if (typeof initialVideoEnabled === 'boolean') {
      this.isVideoTrackGloballyEnabled = initialVideoEnabled;
    }

    // Ensure session is active before starting recording
    if (!this.session) {
      this.callbacks.onStatusUpdate('Session not active. Attempting to connect...');
      this.callbacks.onErrorUpdate('Attempting to record without an active session. Trying to connect...');
      await this.connect();
      if (this.isDisposed || !this.session) {
        if (!this.isDisposed) {
          this.callbacks.onErrorUpdate('Failed to establish session. Please reset.');
          this.callbacks.onStatusUpdate('Failed to connect. Please reset session.');
        }
        return;
      }
      this.callbacks.onStatusUpdate('Session re-established. Proceeding with recording.');
      if (!this.isDisposed) {
        this.callbacks.onErrorUpdate(''); // Clear previous error messages
      }
    }

    // Resume audio contexts if they were suspended (e.g., by browser policies)
    await Promise.all([
      this.inputAudioContext.state === 'suspended' ? this.inputAudioContext.resume() : Promise.resolve(),
      this.outputAudioContext.state === 'suspended' ? this.outputAudioContext.resume() : Promise.resolve(),
    ]);
    
    if (this.isDisposed) {
      return; // Check again after async operations
    }

    this.callbacks.onStatusUpdate('Requesting device access (microphone/camera)...');
    
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: GeminiLiveAI.VIDEO_FRAME_RATE } },
      });

      if (this.isDisposed) { 
        // If disposed while waiting for media, cleanup and exit
        this.cleanupRecordingResources(); 
        return;
      }
      
      this.callbacks.onMediaStreamAvailable(this.mediaStream);
      
      // Set video track state based on global flag
      this.mediaStream.getVideoTracks().forEach(track => track.enabled = this.isVideoTrackGloballyEnabled);
      this.callbacks.onStatusUpdate('Device access granted. Starting audio/video capture...');

      // Setup audio processing pipeline
      this.mediaStreamSourceNode = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
      this.mediaStreamSourceNode.connect(this._inputNode); // Connect stream to input gain node

      // Create and setup audio worklet node for modern audio processing
      this.audioWorkletNode = this.createAudioWorkletNode();
      if (this.audioWorkletNode) {
        this._inputNode.connect(this.audioWorkletNode); // Connect gain node to audio worklet
        // Don't connect to destination to avoid audio feedback loop
      } else {
        console.warn('Audio worklet node creation failed, audio processing may not work properly');
      }

      // Start video frame capture if video is globally enabled and a track is active
      if (this.isVideoTrackGloballyEnabled && this.mediaStream.getVideoTracks().some(t => t.enabled)) {
        this.startVideoFrameCapture();
      }

      this.callbacks.onRecordingStateChange(true);
      this.callbacks.onStatusUpdate('🔴 Recording...');
    } catch (err: unknown) {
      if (this.isDisposed) {
        return;
      }
      const errorMessage = (err instanceof Error) ? err.message : 'Unknown microphone/camera access error';
      console.error('Error starting recording (device access):', err);
      this.callbacks.onErrorUpdate(`Device error: ${errorMessage}`);
      this.callbacks.onStatusUpdate(`Error: ${errorMessage}`);
      this.callbacks.onRecordingStateChange(false);
      this.callbacks.onMediaStreamAvailable(null); // Clear stream on error
      this.cleanupRecordingResources(); // Ensure resources are freed
    }
  }

  /**
   * Initiates video frame capture from the `mediaStream`.
   * Sets up a hidden video element and a canvas to draw frames, then captures
   * frames at a specified rate.
   */
  private startVideoFrameCapture(): void {
    if (!this.mediaStream || !this.session || this.videoFrameCaptureIntervalId || !this.isVideoTrackGloballyEnabled) {
      return;
    }

    const videoTrack = this.mediaStream.getVideoTracks().find(t => t.enabled);
    if (!videoTrack) { 
      // No enabled video track found
      this.stopVideoFrameCapture(); // Ensure capture is stopped if conditions aren't met
      return;
    }

    // Create a hidden video element to render the stream
    this.videoElement = document.createElement('video');
    this.videoElement.srcObject = this.mediaStream;
    this.videoElement.muted = true;
    this.videoElement.playsInline = true; // Important for iOS
    this.videoElement.play().catch(e => console.warn("Hidden video element play() error (often benign):", e));

    // Create a canvas to capture frames from the video element
    this.canvasElement = document.createElement('canvas');
    const settings = videoTrack.getSettings();
    this.canvasElement.width = settings.width || 640; // Use actual track settings or fallback
    this.canvasElement.height = settings.height || 480;
    const ctx = this.canvasElement.getContext('2d');

    if (!ctx) {
      console.error("Could not get 2D context from canvas for video frame capture.");
      this.cleanupVideoFrameCaptureResources(); // Clean up if context fails
      return;
    }

    // Start interval to capture frames
    this.videoFrameCaptureIntervalId = window.setInterval(() => {
      // Pre-condition check within interval to ensure resources are still valid
      if (this.isDisposed || !this.session || !this.mediaStream || !this.videoElement || !this.canvasElement || !ctx || !this.isVideoTrackGloballyEnabled || !videoTrack.enabled) {
        this.stopVideoFrameCapture(); // Stop if conditions are no longer met
        return;
      }
      
      try {
        // Draw current video frame to canvas
        ctx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
        // Convert canvas content to Blob (JPEG)
        this.canvasElement.toBlob(this.handleVideoBlob.bind(this), 'image/jpeg', GeminiLiveAI.VIDEO_QUALITY);
      } catch (e: unknown) {
        if (this.isDisposed) {
          return;
        }
        this.handleVideoProcessingError("Error capturing or drawing video frame to canvas", e);
      }
    }, 1000 / GeminiLiveAI.VIDEO_FRAME_RATE); // Interval based on desired frame rate
  }

  /**
   * Handles the video frame Blob from `canvas.toBlob()`.
   * Reads the Blob as a Base64 data URL and sends it to the Gemini session.
   * @param blob - The video frame Blob (image/jpeg), or null if conversion failed.
   */
  private async handleVideoBlob(blob: globalThis.Blob | null): Promise<void> {
    if (this.isDisposed || !this.session || !blob) {
      return;
    }
    
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (this.isDisposed || !this.session) {
          return;
        }
        
        try {
          const resultString = reader.result as string;
          // Basic validation for Data URL format
          if (!resultString || !resultString.startsWith('data:image/jpeg;base64,')) {
            throw new Error("Invalid video frame data URL format.");
          }
          
          const base64Data = resultString.split(',')[1];
          // Send video frame data to the session
          if (this.session) {
            this.session.sendRealtimeInput({ 
              media: { 
                mimeType: 'image/jpeg', 
                data: base64Data 
              } 
            });
          }
        } catch (e) { 
          this.handleVideoProcessingError("Error processing video frame from FileReader", e); 
        }
      };
      
      reader.onerror = (errorEvent) => { 
        // Handle FileReader specific errors
        if (this.isDisposed) {
          return;
        }
        this.handleVideoProcessingError("FileReader error for video blob", errorEvent.target?.error);
      };
      
      reader.readAsDataURL(blob);
    } catch (e) { 
      this.handleVideoProcessingError("Error creating FileReader for video blob", e); 
    }
  }

  /**
   * Centralized error handler for video processing steps.
   * @param message - A descriptive message for the error context.
   * @param error - The actual error object or details.
   */
  private handleVideoProcessingError(message: string, error?: unknown): void {
    if (this.isDisposed) {
      return;
    }
    const errorDetails = (error instanceof Error) ? error.message : String(error || "Unknown error");
    console.error(`${message}:`, errorDetails);
    // Provide a concise error message to the UI callback
    this.callbacks.onErrorUpdate(`${message.substring(0, 30)}: ${errorDetails.substring(0, 70)}`);
  }

  /**
   * Stops video frame capture and cleans up associated resources.
   */
  private stopVideoFrameCapture(): void {
    if (this.videoFrameCaptureIntervalId) {
      window.clearInterval(this.videoFrameCaptureIntervalId);
      this.videoFrameCaptureIntervalId = null;
    }
    this.cleanupVideoFrameCaptureResources();
  }

  /**
   * Cleans up resources specifically used for video frame capture (video element, canvas).
   */
  private cleanupVideoFrameCaptureResources(): void {
    if (this.videoElement) {
      if (!this.videoElement.paused) {
        this.videoElement.pause();
      }
      this.videoElement.srcObject = null; // Release media stream from element
      this.videoElement = null; // Allow GC
    }
    this.canvasElement = null; // Allow GC
  }

  /**
   * Stops audio and video recording and cleans up all associated resources.
   * Notifies UI about the recording state change.
   */
  public stopRecording(): void {
    if (!this.isRecordingActive()) { 
      // If not recording, no action needed
      if (!this.isDisposed) {
        this.callbacks.onStatusUpdate('Not currently recording.');
      }
      return;
    }
    
    if (!this.isDisposed) {
      this.callbacks.onStatusUpdate('Stopping recording...');
    }

    this.stopVideoFrameCapture(); // Stop video capture first
    this.cleanupAudioRecordingResources(); // Then audio resources
    this.cleanupMediaStream(); // Finally, the media stream itself

    if (!this.isDisposed) {
      this.callbacks.onRecordingStateChange(false);
      this.callbacks.onStatusUpdate('Recording stopped. Click Start to talk.');
      this.callbacks.onMediaStreamAvailable(null); // Clear media stream state in UI
    }
  }

  /**
   * Cleans up resources specifically related to audio recording (AudioWorkletNode, MediaStreamAudioSourceNode).
   */
  private cleanupAudioRecordingResources(): void {
    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect(); // Disconnect from audio graph
      this.audioWorkletNode = null;
    }
    if (this.mediaStreamSourceNode) {
      this.mediaStreamSourceNode.disconnect(); // Disconnect from audio graph
      this.mediaStreamSourceNode = null;
    }
    // _inputNode is persistent and part of the main audio graph, not cleaned here unless disposing
  }

  /**
   * Stops all tracks in the current `mediaStream` and nullifies the stream reference.
   */
  private cleanupMediaStream(): void {
    this.mediaStream?.getTracks().forEach(track => track.stop()); // Stop all tracks (mic, camera)
    this.mediaStream = null;
  }

  /**
   * General cleanup utility called during recording stop or error states.
   * Ensures all recording-related resources are released.
   */
  private cleanupRecordingResources(): void {
    this.cleanupAudioRecordingResources();
    this.cleanupVideoFrameCaptureResources();
    this.cleanupMediaStream();
  }

  /**
   * Resets the current Gemini Live session: stops recording, closes the current session,
   * and attempts to establish a new one.
   */
  public async reset(): Promise<void> {
    if (this.isDisposed) {
      return;
    }
    
    this.callbacks.onStatusUpdate('Resetting session...');
    this.stopRecording(); // Stop any active recording and clean up resources
    this.stopAllPlayingAudio(); // Stop any AI voice output

    if (this.session) {
      try { 
        this.session.close(); 
      } catch (e) { 
        console.warn("Error closing session during reset:", e); 
      }
      this.session = null;
    }
    
    this.reconnectAttempts = 0; // Reset reconnect counter for the new session

    await this.connect(); // Attempt to establish a new session
    if (this.isDisposed) {
      return;
    }

    // Update UI based on whether the new session was established
    this.callbacks.onStatusUpdate(this.session ? 'Session reset. Ready.' : 'Session reset. Failed to reconnect.');
    if (!this.session && !this.isDisposed) {
      this.callbacks.onErrorUpdate('Failed to re-establish session after reset.');
    }
  }

  /**
   * Handles disconnection and attempts reconnection with exponential backoff.
   * @param delayMs - The delay in milliseconds before attempting to reconnect.
   */
  private disconnectAndReconnect(delayMs = 0): void {
    if (this.isDisposed) {
      return;
    }
    
    this.stopRecording(); // Ensure recording is stopped before attempting to close/reopen session

    if (this.session) {
      try { 
        this.session.close(); 
      } catch (e) { 
        console.warn("Error closing session for reconnect:", e); 
      }
      this.session = null;
    }
    
    this.stopAllPlayingAudio(); // Also stop any AI speech

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      if (!this.isDisposed) {
        this.callbacks.onErrorUpdate("Max reconnection attempts reached. Please check connection/API key and reset manually.");
        this.callbacks.onStatusUpdate("Failed to reconnect after multiple attempts.");
      }
      return;
    }

    this.reconnectAttempts++;
    // Calculate delay with exponential backoff, ensuring a base delay if delayMs is 0
    const actualDelay = delayMs > 0 ? delayMs : RECONNECT_DELAY_BASE_MS * Math.pow(2, this.reconnectAttempts - 1);
    
    if (!this.isDisposed) {
      this.callbacks.onStatusUpdate(`Attempting to reconnect in ${Math.round(actualDelay / 1000)}s (attempt ${this.reconnectAttempts})...`);
    }

    setTimeout(() => {
      if (!this.isDisposed) {
        this.connect(); // Attempt connection after delay
      }
    }, actualDelay);
  }

  /** Gets the input gain node for microphone volume control. */
  public getInputNode(): GainNode { return this._inputNode; }
  
  /** Gets the output gain node for AI voice volume control. */
  public getOutputNode(): GainNode { return this._outputNode; }

  /**
   * Cleans up all resources, closes connections, stops all audio/video processing,
   * and marks the instance as disposed to prevent further operations.
   * This should be called when the service is no longer needed (e.g., component unmount).
   */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    
    this.isDisposed = true;
    console.log("Disposing GeminiLiveAI instance...");
    this.callbacks.onStatusUpdate('Disposing GeminiLiveAI instance...');

    this.stopRecording(); // This handles recording-specific resources
    this.stopAllPlayingAudio(); // Stop AI voice output

    if (this.session) {
      try { 
        this.session.close(); 
      } catch (e) { 
        console.warn("Error closing session during disposal:", e); 
      }
      this.session = null;
    }

    // Close audio contexts safely
    if (this.inputAudioContext?.state !== 'closed') {
      this.inputAudioContext.close().catch(e => console.warn("Error closing input audio context:", e));
    }
    if (this.outputAudioContext?.state !== 'closed') {
      this.outputAudioContext.close().catch(e => console.warn("Error closing output audio context:", e));
    }

    this.callbacks.onStatusUpdate('Disconnected.');
    this.callbacks.onMediaStreamAvailable(null); // Clear media stream in UI
    console.log("GeminiLiveAI instance disposed successfully.");
  }

  /**
   * Sends a text message to the Gemini session.
   * @param text - The text message to send.
   */
  public sendTextMessage(text: string): void {
    if (this.isDisposed || !this.session) {
      console.warn("Cannot send text message, session not active or instance disposed.");
      return;
    }
    (this.session as any).sendText?.(text);
  }
} 