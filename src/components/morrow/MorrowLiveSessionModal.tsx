import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  Send,
  Volume2,
  X,
} from 'lucide-react';
import type { AssistantToolCall } from '../../types/assistant';
import type { MaskedCloudContext } from '../../utils/assistantPrivacy';
import {
  buildPermissionRecoveryGuide,
  requestCameraStreamSafe,
  requestMicrophonePermission,
  type MediaPermissionGuide,
} from '../../utils/mediaPermissions';
import { PermissionGuardModal } from '../permissions/PermissionGuardModal';

interface MorrowLiveSessionModalProps {
  open: boolean;
  onClose: () => void;
  onSessionTranscriptSaved?: (summaryText: string) => void;
  liveContext?: MaskedCloudContext;
  onLiveToolAction?: (toolCall: AssistantToolCall) => string | void;
}

type LiveStatus = 'connecting' | 'live' | 'error' | 'closed';

interface TranscriptTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

function float32ToPcm16Base64(float32: Float32Array): string {
  const buf = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const out = new Float32Array(Math.floor(bytes.byteLength / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }
  return out;
}

export const MorrowLiveSessionModal: React.FC<MorrowLiveSessionModalProps> = ({
  open,
  onClose,
  onSessionTranscriptSaved,
  liveContext,
  onLiveToolAction,
}) => {
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [quickTextInput, setQuickTextInput] = useState('');
  const [permissionGuide, setPermissionGuide] = useState<MediaPermissionGuide | null>(null);
  const [boundToWorkspace, setBoundToWorkspace] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const mutedRef = useRef<boolean>(false);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const videoIntervalRef = useRef<number | null>(null);
  const turnsRef = useRef<TranscriptTurn[]>([]);
  const liveContextRef = useRef<MaskedCloudContext | undefined>(liveContext);
  const onLiveToolActionRef = useRef<((tc: AssistantToolCall) => string | void) | undefined>(
    onLiveToolAction
  );

  useEffect(() => {
    liveContextRef.current = liveContext;
  }, [liveContext]);

  useEffect(() => {
    onLiveToolActionRef.current = onLiveToolAction;
  }, [onLiveToolAction]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  const stopQueuedOutputAudio = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // ignore
      }
    }
    activeSourcesRef.current.clear();
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
    setIsModelSpeaking(false);
  }, []);

  const stopCameraStream = useCallback(() => {
    if (videoIntervalRef.current !== null) {
      window.clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    if (camStreamRef.current) {
      for (const track of camStreamRef.current.getTracks()) {
        track.stop();
      }
      camStreamRef.current = null;
    }
    if (videoElRef.current) {
      videoElRef.current.srcObject = null;
    }
    setCameraOn(false);
  }, []);

  const cleanupAll = useCallback(() => {
    stopQueuedOutputAudio();
    stopCameraStream();

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (micStreamRef.current) {
      for (const track of micStreamRef.current.getTracks()) {
        track.stop();
      }
      micStreamRef.current = null;
    }
    if (inputCtxRef.current) {
      void inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }
    if (outputCtxRef.current) {
      void outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
  }, [stopCameraStream, stopQueuedOutputAudio]);

  const appendTurnChunk = useCallback((role: 'user' | 'assistant', chunk: string) => {
    const clean = chunk.trim();
    if (!clean) return;
    setTurns((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role) {
        const merged = `${last.text} ${clean}`.replace(/\s+/g, ' ').trim();
        return [...prev.slice(0, -1), { ...last, text: merged }];
      }
      return [
        ...prev.slice(-20),
        { id: `turn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, role, text: clean },
      ];
    });
  }, []);

  const play24kPcmChunk = useCallback((base64Data: string) => {
    const ctx = outputCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    const samples = base64Pcm16ToFloat32(base64Data);
    if (samples.length === 0) return;

    const buffer = ctx.createBuffer(1, samples.length, 24000);
    buffer.getChannelData(0).set(samples);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, nextStartTimeRef.current);
    nextStartTimeRef.current = startAt + buffer.duration;

    activeSourcesRef.current.add(source);
    setIsModelSpeaking(true);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0) {
        setIsModelSpeaking(false);
      }
    };
    source.start(startAt);
  }, []);

  useEffect(() => {
    if (!open) {
      cleanupAll();
      return;
    }

    let cancelled = false;
    setStatus('connecting');
    setErrorText(null);
    setTurns([]);
    setElapsedSec(0);
    setMicLevel(0);

    const timer = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);

    const bootLiveSession = async () => {
      const perm = await requestMicrophonePermission();
      if (cancelled) return;
      if (!perm.ok) {
        const guide = perm.guide || buildPermissionRecoveryGuide('microphone');
        setPermissionGuide(guide);
        setErrorText(guide.reason);
        setStatus('error');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;

        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const inputCtx = new AudioCtx({ sampleRate: 16000 });
        const outputCtx = new AudioCtx({ sampleRate: 24000 });
        inputCtxRef.current = inputCtx;
        outputCtxRef.current = outputCtx;
        nextStartTimeRef.current = outputCtx.currentTime;

        const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${wsProto}//${window.location.host}/api/morrow/live`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) return;
          if (liveContextRef.current && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'init', cloudContext: liveContextRef.current }));
          }
        };

        ws.onmessage = (event) => {
          if (cancelled) return;
          try {
            const msg = JSON.parse(String(event.data || '{}')) as {
              type?: string;
              data?: string;
              text?: string;
              message?: string;
              boundToWorkspace?: boolean;
              toolCall?: AssistantToolCall;
            };
            if (msg.type === 'ready') {
              setStatus('live');
              setBoundToWorkspace(Boolean(msg.boundToWorkspace || liveContextRef.current?.liveWorkspace));
            } else if (msg.type === 'audio' && msg.data) {
              play24kPcmChunk(msg.data);
            } else if (msg.type === 'input_transcript' && msg.text) {
              appendTurnChunk('user', msg.text);
            } else if (msg.type === 'output_transcript' && msg.text) {
              appendTurnChunk('assistant', msg.text);
            } else if (msg.type === 'tool_call' && msg.toolCall) {
              const actionResult = onLiveToolActionRef.current?.(msg.toolCall);
              if (typeof actionResult === 'string' && actionResult.trim()) {
                appendTurnChunk('assistant', `[إجراء مباشر]: ${actionResult}`);
              }
            } else if (msg.type === 'interrupted') {
              stopQueuedOutputAudio();
            } else if (msg.type === 'error') {
              setErrorText(msg.message || 'تعذر إكمال المحادثة المباشرة.');
              setStatus('error');
            } else if (msg.type === 'closed') {
              setStatus('closed');
            }
          } catch {
            // ignore
          }
        };

        ws.onerror = () => {
          if (!cancelled) {
            setErrorText('تعذر إنشاء اتصال مباشر بالخادم.');
            setStatus('error');
          }
        };

        ws.onclose = () => {
          if (!cancelled) {
            setStatus((prev) => (prev === 'error' ? 'error' : 'closed'));
          }
        };

        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (ev) => {
          if (cancelled || mutedRef.current) {
            setMicLevel(0);
            return;
          }
          const ch = ev.inputBuffer.getChannelData(0);
          let sum = 0;
          for (let i = 0; i < ch.length; i += 8) {
            sum += Math.abs(ch[i]);
          }
          const level = Math.min(1, (sum / (ch.length / 8)) * 5);
          setMicLevel(level);

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const base64 = float32ToPcm16Base64(ch);
            wsRef.current.send(JSON.stringify({ type: 'audio', data: base64 }));
          }
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
      } catch (err) {
        if (!cancelled) {
          setErrorText(
            err instanceof Error
              ? `تعذر تشغيل الصوت المباشر: ${err.message}`
              : 'تعذر الوصول للميكروفون أو الصوت.'
          );
          setStatus('error');
        }
      }
    };

    void bootLiveSession();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      cleanupAll();
    };
  }, [open, appendTurnChunk, cleanupAll, play24kPcmChunk, stopQueuedOutputAudio]);

  const toggleCamera = async () => {
    if (cameraOn) {
      stopCameraStream();
      return;
    }
    const camRes = await requestCameraStreamSafe();
    if (!camRes.ok || !camRes.stream) {
      setPermissionGuide(camRes.guide || buildPermissionRecoveryGuide('camera'));
      return;
    }
    camStreamRef.current = camRes.stream;
    setCameraOn(true);
    requestAnimationFrame(() => {
      if (videoElRef.current) {
        videoElRef.current.srcObject = camRes.stream!;
        void videoElRef.current.play().catch(() => {});
      }
    });

    const canvas = document.createElement('canvas');
    videoIntervalRef.current = window.setInterval(() => {
      const video = videoElRef.current;
      const ws = wsRef.current;
      if (!video || !ws || ws.readyState !== WebSocket.OPEN || video.readyState < 2) return;
      canvas.width = 640;
      canvas.height = Math.max(360, Math.round((video.videoHeight / Math.max(1, video.videoWidth)) * 640));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const jpeg = canvas.toDataURL('image/jpeg', 0.72).replace(/^data:image\/jpeg;base64,/, '');
      ws.send(JSON.stringify({ type: 'video', data: jpeg, mimeType: 'image/jpeg' }));
    }, 1000);
  };

  const handleEndSession = () => {
    if (turnsRef.current.length > 0 && onSessionTranscriptSaved) {
      const summary = turnsRef.current
        .map((t) => `${t.role === 'user' ? 'أنت' : 'Morrow لايف'}: ${t.text}`)
        .join('\n');
      onSessionTranscriptSaved(summary);
    }
    cleanupAll();
    onClose();
  };

  const sendLiveTextNudge = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = quickTextInput.trim();
    if (!clean || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'text', text: clean }));
    appendTurnChunk('user', clean);
    setQuickTextInput('');
  };

  if (!open) return null;

  const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const secs = String(elapsedSec % 60).padStart(2, '0');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="المحادثة المباشرة لايف مع Morrow"
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-3 sm:p-6"
      style={{
        backgroundColor: 'rgba(6, 10, 20, 0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div
        className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'color-mix(in srgb, var(--accent) 42%, var(--border-color))',
          color: 'var(--text-primary)',
          maxHeight: '90dvh',
        }}
      >
        {/* Top Bar */}
        <div
          className="flex items-center justify-between border-b px-5 py-3.5"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                backgroundColor: status === 'live' ? 'var(--accent)' : 'var(--bg-main)',
                color: status === 'live' ? 'var(--accent-fg)' : 'var(--text-muted)',
              }}
            >
              <Radio className="h-4.5 w-4.5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm font-extrabold">
                <span>المحادثة المباشرة لايف</span>
                <span
                  dir="ltr"
                  className="rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--accent)',
                  }}
                >
                  gemini-3.8-live
                </span>
                <span className="font-mono text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {mins}:{secs}
                </span>
              </div>
              <div className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {status === 'connecting'
                  ? 'جاري فتح القناة الصوتية المباشرة وربط بيانات التطبيق...'
                  : status === 'live'
                    ? isModelSpeaking
                      ? 'Morrow يتحدث الآن...'
                      : muted
                        ? 'الميكروفون مكتوم'
                        : 'متصل لايف · تفضل بالحديث الآن'
                    : status === 'error'
                      ? 'تعذر الاتصال المباشر'
                      : 'انتهت الجلسة'}
                {(boundToWorkspace || liveContext?.liveWorkspace) && liveContext?.liveWorkspace && (
                  <span>
                    {' '}· {liveContext.liveWorkspace.agenciesBreakdown.length} وكالات ·{' '}
                    {liveContext.liveWorkspace.totalActiveIndividuals.toLocaleString('ar-IQ')} فرد نشط ·{' '}
                    {liveContext.liveWorkspace.totalFullBags.toLocaleString('ar-IQ')} كيس
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEndSession}
            aria-label="إغلاق نافذة المحادثة المباشرة"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border hover:opacity-80"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Center Interactive Voice / Optional Video Stage */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
          {cameraOn && (
            <div className="relative mx-auto overflow-hidden rounded-2xl border max-w-md aspect-video bg-black" style={{ borderColor: 'var(--border-color)' }}>
              <video
                ref={videoElRef}
                muted
                playsInline
                className="h-full w-full object-cover"
              />
              <span
                className="absolute bottom-2 right-2 rounded-lg px-2 py-0.5 text-[11px] font-bold"
                style={{ backgroundColor: 'rgba(15,23,42,0.78)', color: '#fff' }}
              >
                بث الكاميرا لـ Morrow (١ إطار/ث)
              </span>
            </div>
          )}

          {/* Voice Pulse Ring */}
          <div className="flex flex-col items-center justify-center py-3">
            <div
              className="relative flex h-28 w-28 items-center justify-center rounded-full border-2 transition-transform duration-150"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent) 12%, var(--bg-main))',
                borderColor: status === 'live' ? 'var(--accent)' : 'var(--border-color)',
                transform: `scale(${1 + (isModelSpeaking ? 0.08 : micLevel * 0.14)})`,
                boxShadow:
                  status === 'live'
                    ? '0 0 0 8px color-mix(in srgb, var(--accent) 12%, transparent)'
                    : 'none',
              }}
            >
              <Volume2
                className="h-10 w-10"
                style={{ color: status === 'live' ? 'var(--accent)' : 'var(--text-muted)' }}
              />
            </div>
          </div>

          {errorText && (
            <div
              className="flex items-start gap-2.5 rounded-2xl border p-3.5 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--danger-bg)',
                borderColor: 'var(--danger)',
                color: 'var(--danger)',
              }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorText}</span>
            </div>
          )}

          {/* Live Transcript Feed */}
          <div
            className="space-y-2.5 rounded-2xl border p-4 min-h-[130px]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            {turns.length === 0 ? (
              <div className="py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                {status === 'live'
                  ? 'ابدأ بالكلام مباشرة — سيظهر الحوار النصي هنا لحظياً.'
                  : 'في انتظار بدء الجلسة الصوتية المباشرة.'}
              </div>
            ) : (
              turns.map((turn) => (
                <div
                  key={turn.id}
                  className={`flex flex-col ${turn.role === 'user' ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className="max-w-[88%] rounded-2xl border px-3.5 py-2 text-xs leading-relaxed"
                    style={{
                      backgroundColor:
                        turn.role === 'user' ? 'var(--bg-nav-active)' : 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div
                      className="mb-0.5 text-[10px] font-extrabold"
                      style={{ color: turn.role === 'user' ? 'var(--accent)' : 'var(--text-muted)' }}
                    >
                      {turn.role === 'user' ? 'أنت' : 'Morrow لايف'}
                    </div>
                    <div>{turn.text}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bottom Controls */}
        <div
          className="border-t px-5 py-3.5 space-y-3"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          <form onSubmit={sendLiveTextNudge} className="flex items-center gap-2">
            <input
              type="text"
              value={quickTextInput}
              onChange={(e) => setQuickTextInput(e.target.value)}
              disabled={status !== 'live'}
              placeholder="أو اكتب رسالة نصية سريعة داخل الجلسة المباشرة..."
              className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            />
            <button
              type="submit"
              disabled={!quickTextInput.trim() || status !== 'live'}
              aria-label="إرسال رسالة نصية داخل البث المباشر"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl disabled:opacity-40"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="cosmos-touch-target inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-extrabold"
              style={{
                backgroundColor: muted ? 'var(--warning-bg)' : 'var(--bg-surface)',
                borderColor: muted ? 'var(--warning)' : 'var(--border-color)',
                color: muted ? 'var(--warning)' : 'var(--text-primary)',
              }}
            >
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              <span>{muted ? 'إلغاء كتم المايك' : 'كتم المايك'}</span>
            </button>

            <button
              type="button"
              onClick={toggleCamera}
              className="cosmos-touch-target inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-extrabold"
              style={{
                backgroundColor: cameraOn ? 'var(--bg-nav-active)' : 'var(--bg-surface)',
                borderColor: cameraOn ? 'var(--accent)' : 'var(--border-color)',
                color: cameraOn ? 'var(--accent)' : 'var(--text-primary)',
              }}
            >
              {cameraOn ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              <span>{cameraOn ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'}</span>
            </button>

            <button
              type="button"
              onClick={handleEndSession}
              className="cosmos-touch-target inline-flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-extrabold"
              style={{
                backgroundColor: 'var(--danger)',
                color: '#ffffff',
              }}
            >
              <PhoneOff className="h-4 w-4" />
              <span>إنهاء المحادثة</span>
            </button>
          </div>
        </div>
      </div>

      <PermissionGuardModal
        open={Boolean(permissionGuide)}
        guide={permissionGuide}
        onClose={() => setPermissionGuide(null)}
        onRetryPermission={() => {
          setPermissionGuide(null);
        }}
      />
    </div>
  );
};
