import {
  GoogleGenAI,
  Type,
  type FunctionDeclaration,
} from '@google/genai';
import {
  AI_FREE_MODELS,
  AI_MODEL_REGISTRY,
  AI_ROUTING_PIPELINES,
  AI_TASK_PROFILES,
  ALL_MODELS_STRONGEST_TO_WEAKEST,
  ALL_REGISTERED_CLOUD_MODELS,
  DEFAULT_TASK_ROUTING,
  getAiModelSpec,
  getServerProviderApiKeys,
  MORROW_LOCAL_MODEL_ID,
  resolveOrderedTaskChain,
  SIX_FREE_CLOUD_MODELS,
  type AiPipelineKind,
  type AiProviderId,
  type AiTaskKey,
  type AnyAiModelId,
  type ApprovedCloudModelId,
} from '../aiConfig.ts';
import type { AssistantToolCall } from '../types/assistant.ts';
import { enforceSafeArabicTerminology } from '../utils/assistantPrivacy.ts';
import { validateToolCall } from '../utils/assistantTools.ts';

export interface OrchestratorAttachmentPart {
  kind: 'image' | 'pdf' | 'audio' | 'text';
  mimeType?: string;
  data?: string;
  text?: string;
  filename?: string;
}

export interface ModelAttemptTrace {
  modelId: ApprovedCloudModelId;
  provider: AiProviderId;
  attempt: number;
  status: 'ok' | 'rate_limited_429' | 'timeout_503' | 'missing_key' | 'error';
  latencyMs: number;
  detail?: string;
}

export interface ExecuteWithFallbackOptions {
  pipeline: AiPipelineKind;
  preferredChain?: ApprovedCloudModelId[];
  systemInstruction?: string;
  promptText?: string;
  attachments?: OrchestratorAttachmentPart[];
  responseMimeType?: 'application/json' | 'text/plain';
  responseSchema?: Record<string, unknown>;
  tools?: FunctionDeclaration[];
  temperature?: number;
  timeoutMs?: number;
  maxRetriesPerModel?: number;
}

export interface ExecuteWithFallbackResult {
  ok: boolean;
  text: string;
  toolCalls: AssistantToolCall[];
  modelId: ApprovedCloudModelId;
  provider: AiProviderId;
  modelLabel: string;
  shortLabel: string;
  fallbackUsed: boolean;
  hadRateLimitOrTimeout: boolean;
  attempts: ModelAttemptTrace[];
  latencyMs: number;
  errorSummary?: string;
}

export interface ExecuteAudioTranscriptionOptions {
  audioBase64: string;
  mimeType: string;
  promptHint?: string;
  language?: string;
  timeoutMs?: number;
  preferredChain?: ApprovedCloudModelId[];
}

export interface ExecuteAudioTranscriptionResult {
  ok: boolean;
  transcript: string;
  modelId: ApprovedCloudModelId;
  provider: AiProviderId;
  modelLabel: string;
  shortLabel: string;
  fallbackUsed: boolean;
  attempts: ModelAttemptTrace[];
  latencyMs: number;
  errorSummary?: string;
}

export function createGoogleAiClient(): GoogleGenAI | null {
  const { geminiApiKey } = getServerProviderApiKeys();
  if (!geminiApiKey) return null;
  return new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function classifyProviderError(err: unknown): {
  kind: 'rate_limited_429' | 'timeout_503' | 'error';
  retryable: boolean;
  message: string;
} {
  const msg =
    err instanceof Error ? err.message : String(err || 'Unknown provider error');
  const lower = msg.toLowerCase();
  const status =
    typeof (err as { status?: unknown })?.status === 'number'
      ? Number((err as { status: number }).status)
      : 0;

  if (
    status === 429 ||
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('resource_exhausted') ||
    lower.includes('too many requests')
  ) {
    return { kind: 'rate_limited_429', retryable: true, message: msg };
  }

  if (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    status === 500 ||
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('504') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('econnreset') ||
    lower.includes('fetch failed') ||
    lower.includes('abort')
  ) {
    return { kind: 'timeout_503', retryable: true, message: msg };
  }

  return { kind: 'error', retryable: false, message: msg };
}

function sleepWithJitter(attempt: number, baseMs = 380): Promise<void> {
  const jitter = Math.floor(Math.random() * 160);
  const delay = baseMs * Math.pow(2, attempt) + jitter;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function mapGeminiTypeToJsonSchema(typeVal: unknown): string {
  switch (typeVal) {
    case Type.STRING:
      return 'string';
    case Type.INTEGER:
      return 'integer';
    case Type.NUMBER:
      return 'number';
    case Type.BOOLEAN:
      return 'boolean';
    case Type.ARRAY:
      return 'array';
    case Type.OBJECT:
    default:
      return 'object';
  }
}

function convertGeminiSchemaToJsonSchema(
  schema: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object', properties: {} };
  }
  const out: Record<string, unknown> = {};
  if (schema.type !== undefined) {
    out.type = mapGeminiTypeToJsonSchema(schema.type);
  }
  if (schema.description) out.description = schema.description;
  if (Array.isArray(schema.enum)) out.enum = schema.enum;
  if (Array.isArray(schema.required)) out.required = schema.required;
  if (schema.properties && typeof schema.properties === 'object') {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(
      schema.properties as Record<string, unknown>
    )) {
      if (v && typeof v === 'object') {
        props[k] = convertGeminiSchemaToJsonSchema(
          v as Record<string, unknown>
        );
      }
    }
    out.properties = props;
  }
  if (schema.items && typeof schema.items === 'object') {
    out.items = convertGeminiSchemaToJsonSchema(
      schema.items as Record<string, unknown>
    );
  }
  return out;
}

function convertToolsForOpenRouter(tools?: FunctionDeclaration[]) {
  if (!Array.isArray(tools) || tools.length === 0) return undefined;
  return tools.map((fn) => ({
    type: 'function',
    function: {
      name: fn.name,
      description: fn.description || '',
      parameters: convertGeminiSchemaToJsonSchema(
        fn.parameters as unknown as Record<string, unknown>
      ),
    },
  }));
}

function stripJsonCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

async function callGoogleModel(params: {
  ai: GoogleGenAI;
  modelId: ApprovedCloudModelId;
  options: ExecuteWithFallbackOptions;
  timeoutMs: number;
}): Promise<{ text: string; toolCalls: AssistantToolCall[] }> {
  const { ai, modelId, options, timeoutMs } = params;

  const parts: Array<
    { inlineData: { mimeType: string; data: string } } | { text: string }
  > = [];

  for (const att of options.attachments || []) {
    if (att.kind === 'text' && att.text) {
      parts.push({ text: att.text });
    } else if (
      (att.kind === 'image' || att.kind === 'pdf' || att.kind === 'audio') &&
      att.data &&
      att.mimeType
    ) {
      parts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.data,
        },
      });
    }
  }

  if (options.promptText?.trim()) {
    parts.push({ text: options.promptText.trim() });
  }

  if (parts.length === 0) {
    parts.push({ text: 'مرحبًا' });
  }

  const config: Record<string, unknown> = {};
  if (options.systemInstruction) {
    config.systemInstruction = options.systemInstruction;
  }
  if (options.responseMimeType) {
    config.responseMimeType = options.responseMimeType;
  }
  if (options.responseSchema) {
    config.responseSchema = options.responseSchema;
  }
  if (Array.isArray(options.tools) && options.tools.length > 0) {
    config.tools = [{ functionDeclarations: options.tools }];
  }
  if (typeof options.temperature === 'number') {
    config.temperature = options.temperature;
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('503 google_model_timeout')), timeoutMs);
  });

  const callPromise = ai.models.generateContent({
    model: modelId,
    contents: [{ role: 'user', parts }],
    config: config as Parameters<typeof ai.models.generateContent>[0]['config'],
  });

  const response = await Promise.race([callPromise, timeoutPromise]);

  const validCalls: AssistantToolCall[] = [];
  for (const fc of response.functionCalls || []) {
    const checked = validateToolCall({ name: fc.name, args: fc.args });
    if (checked.valid && checked.sanitized) {
      validCalls.push(checked.sanitized);
    }
  }

  const rawText = String(response.text || '').trim();
  const finalText =
    options.responseMimeType === 'application/json'
      ? stripJsonCodeFences(rawText)
      : enforceSafeArabicTerminology(rawText);

  return {
    text: finalText,
    toolCalls: validCalls,
  };
}

async function callOpenRouterModel(params: {
  apiKey: string;
  modelId: ApprovedCloudModelId;
  options: ExecuteWithFallbackOptions;
  timeoutMs: number;
}): Promise<{ text: string; toolCalls: AssistantToolCall[] }> {
  const { apiKey, modelId, options, timeoutMs } = params;
  const spec = getAiModelSpec(modelId);
  const endpoint =
    spec.endpointUrl || 'https://openrouter.ai/api/v1/chat/completions';

  const userContentParts: Array<Record<string, unknown>> = [];
  const textFragments: string[] = [];

  for (const att of options.attachments || []) {
    if (att.kind === 'text' && att.text) {
      textFragments.push(att.text);
    } else if (att.kind === 'image' && att.data && att.mimeType) {
      userContentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:${att.mimeType};base64,${att.data}`,
        },
      });
    } else if (att.kind === 'pdf' && att.data) {
      userContentParts.push({
        type: 'file',
        file: {
          filename: att.filename || 'document.pdf',
          file_data: `data:application/pdf;base64,${att.data}`,
        },
      });
    }
  }

  if (options.promptText?.trim()) {
    textFragments.push(options.promptText.trim());
  }

  const combinedText = textFragments.join('\n\n').trim() || 'مرحبًا';
  if (userContentParts.length > 0) {
    userContentParts.push({ type: 'text', text: combinedText });
  }

  let systemContent = options.systemInstruction || '';
  if (options.responseMimeType === 'application/json') {
    const jsonSchemaHint = options.responseSchema
      ? `\n\nيجب أن يكون الرد بصيغة JSON صالحة فقط بدون أي نص خارجي أو علامات Markdown، ومطابقاً للمخطط التالي:\n${JSON.stringify(
          convertGeminiSchemaToJsonSchema(options.responseSchema)
        )}`
      : '\n\nيجب أن يكون الرد بصيغة JSON صالحة فقط بدون أي نص خارجي.';
    systemContent = `${systemContent}${jsonSchemaHint}`.trim();
  }

  const messages: Array<Record<string, unknown>> = [];
  if (systemContent) {
    messages.push({ role: 'system', content: systemContent });
  }
  messages.push({
    role: 'user',
    content: userContentParts.length > 0 ? userContentParts : combinedText,
  });

  const payload: Record<string, unknown> = {
    model: modelId,
    messages,
    temperature:
      typeof options.temperature === 'number' ? options.temperature : 0.15,
  };

  if (options.responseMimeType === 'application/json') {
    payload.response_format = { type: 'json_object' };
  }

  const openAiTools = convertToolsForOpenRouter(options.tools);
  if (openAiTools && openAiTools.length > 0) {
    payload.tools = openAiTools;
    payload.tool_choice = 'auto';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://morrow-agencies.local',
        'X-Title': 'Morrow Agency Management',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      const error = new Error(
        `OpenRouter HTTP ${response.status}: ${errBody.slice(0, 260)}`
      ) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    const json = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | Array<{ type?: string; text?: string }>;
          tool_calls?: Array<{
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
    };

    const msg = json.choices?.[0]?.message;
    const rawContent = Array.isArray(msg?.content)
      ? msg.content
          .map((c) => (typeof c?.text === 'string' ? c.text : ''))
          .join('\n')
      : String(msg?.content || '');

    const validCalls: AssistantToolCall[] = [];
    for (const tc of msg?.tool_calls || []) {
      const fnName = tc.function?.name;
      if (!fnName) continue;
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(tc.function?.arguments || '{}');
      } catch {
        parsedArgs = {};
      }
      const checked = validateToolCall({ name: fnName, args: parsedArgs });
      if (checked.valid && checked.sanitized) {
        validCalls.push(checked.sanitized);
      }
    }

    const finalText =
      options.responseMimeType === 'application/json'
        ? stripJsonCodeFences(rawContent)
        : enforceSafeArabicTerminology(rawContent.trim());

    if (!finalText && validCalls.length === 0) {
      throw new Error('503 OpenRouter empty response');
    }

    return {
      text: finalText,
      toolCalls: validCalls,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Unified AI execution function across the 6 free models with priority ordering,
 * Exponential Backoff retry on 429/503, and seamless multi-provider fallback.
 */
export async function executeWithFallback(
  options: ExecuteWithFallbackOptions
): Promise<ExecuteWithFallbackResult> {
  const startedAt = Date.now();
  const baseChain =
    options.preferredChain && options.preferredChain.length > 0
      ? options.preferredChain
      : AI_ROUTING_PIPELINES[options.pipeline];
  const uniqueChain = Array.from(new Set(baseChain));
  const maxRetries = Math.max(1, Math.min(3, options.maxRetriesPerModel ?? 2));
  const timeoutMs = Math.max(4000, options.timeoutMs ?? 24000);

  const keys = getServerProviderApiKeys();
  const googleClient = createGoogleAiClient();

  const attempts: ModelAttemptTrace[] = [];
  let hadRateLimitOrTimeout = false;

  for (let idx = 0; idx < uniqueChain.length; idx++) {
    const modelId = uniqueChain[idx];
    const spec = getAiModelSpec(modelId);

    if (spec.provider === 'google' && !googleClient) {
      attempts.push({
        modelId,
        provider: spec.provider,
        attempt: 0,
        status: 'missing_key',
        latencyMs: 0,
        detail: 'GEMINI_API_KEY is not configured',
      });
      continue;
    }

    if (spec.provider === 'openrouter' && !keys.openRouterApiKey) {
      attempts.push({
        modelId,
        provider: spec.provider,
        attempt: 0,
        status: 'missing_key',
        latencyMs: 0,
        detail: 'OPENROUTER_API_KEY is not configured',
      });
      continue;
    }

    if (spec.provider === 'groq') {
      attempts.push({
        modelId,
        provider: spec.provider,
        attempt: 0,
        status: 'error',
        latencyMs: 0,
        detail: 'Groq model is dedicated to audio transcription',
      });
      continue;
    }

    const hasPdfAttachment = (options.attachments || []).some(
      (a) => a.kind === 'pdf'
    );
    const hasImageAttachment = (options.attachments || []).some(
      (a) => a.kind === 'image'
    );
    if (hasPdfAttachment && !spec.supportsPdf) {
      attempts.push({
        modelId,
        provider: spec.provider,
        attempt: 0,
        status: 'error',
        latencyMs: 0,
        detail: `Model ${modelId} does not support raw PDF attachments`,
      });
      continue;
    }
    if (hasImageAttachment && !spec.supportsVision) {
      attempts.push({
        modelId,
        provider: spec.provider,
        attempt: 0,
        status: 'error',
        latencyMs: 0,
        detail: `Model ${modelId} does not support vision attachments`,
      });
      continue;
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const attemptStart = Date.now();
      try {
        const result =
          spec.provider === 'google'
            ? await callGoogleModel({
                ai: googleClient!,
                modelId,
                options,
                timeoutMs,
              })
            : await callOpenRouterModel({
                apiKey: keys.openRouterApiKey,
                modelId,
                options,
                timeoutMs,
              });

        attempts.push({
          modelId,
          provider: spec.provider,
          attempt: attempt + 1,
          status: 'ok',
          latencyMs: Date.now() - attemptStart,
        });

        return {
          ok: true,
          text: result.text,
          toolCalls: result.toolCalls,
          modelId,
          provider: spec.provider,
          modelLabel: spec.badgeLabel,
          shortLabel: spec.shortLabel,
          fallbackUsed: idx > 0 || attempt > 0,
          hadRateLimitOrTimeout,
          attempts,
          latencyMs: Date.now() - startedAt,
        };
      } catch (err) {
        const classified = classifyProviderError(err);
        if (
          classified.kind === 'rate_limited_429' ||
          classified.kind === 'timeout_503'
        ) {
          hadRateLimitOrTimeout = true;
        }
        attempts.push({
          modelId,
          provider: spec.provider,
          attempt: attempt + 1,
          status: classified.kind,
          latencyMs: Date.now() - attemptStart,
          detail: classified.message.slice(0, 220),
        });

        if (classified.retryable && attempt < maxRetries - 1) {
          await sleepWithJitter(attempt);
          continue;
        }
        break;
      }
    }
  }

  const fallbackSpec = getAiModelSpec(uniqueChain[0]);
  const lastErr = attempts.filter((a) => a.detail).slice(-1)[0]?.detail;

  return {
    ok: false,
    text: '',
    toolCalls: [],
    modelId: fallbackSpec.id as ApprovedCloudModelId,
    provider: fallbackSpec.provider,
    modelLabel: fallbackSpec.badgeLabel,
    shortLabel: fallbackSpec.shortLabel,
    fallbackUsed: true,
    hadRateLimitOrTimeout,
    attempts,
    latencyMs: Date.now() - startedAt,
    errorSummary:
      lastErr ||
      'لم يتوفر أي نموذج سحابي مفعّل (يرجى التحقق من مفاتيح GEMINI_API_KEY / OPENROUTER_API_KEY).',
  };
}

function extensionForAudioMime(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('mp4') || lower.includes('m4a')) return 'm4a';
  if (lower.includes('wav')) return 'wav';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('mp3') || lower.includes('mpeg')) return 'mp3';
  return 'webm';
}

/**
 * Audio Pipeline:
 * 1. whisper-large-v3-turbo (Groq API)
 * 2. Fallback to gemini-3.8-flash -> gemini-3.5-flash (Google AI Studio)
 */
export async function executeAudioTranscriptionWithFallback(
  options: ExecuteAudioTranscriptionOptions
): Promise<ExecuteAudioTranscriptionResult> {
  const startedAt = Date.now();
  const keys = getServerProviderApiKeys();
  const googleClient = createGoogleAiClient();
  const chain =
    options.preferredChain && options.preferredChain.length > 0
      ? Array.from(new Set(options.preferredChain))
      : AI_ROUTING_PIPELINES.audio;
  const attempts: ModelAttemptTrace[] = [];
  const timeoutMs = Math.max(5000, options.timeoutMs ?? 20000);

  for (let idx = 0; idx < chain.length; idx++) {
    const modelId = chain[idx];
    const spec = getAiModelSpec(modelId);

    if (spec.provider === 'groq') {
      if (!keys.groqApiKey) {
        attempts.push({
          modelId,
          provider: 'groq',
          attempt: 0,
          status: 'missing_key',
          latencyMs: 0,
          detail: 'GROQ_API_KEY is not configured',
        });
        continue;
      }

      for (let attempt = 0; attempt < 2; attempt++) {
        const attemptStart = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const audioBytes = Buffer.from(options.audioBase64, 'base64');
          const ext = extensionForAudioMime(options.mimeType);
          const form = new FormData();
          form.append(
            'file',
            new Blob([audioBytes], { type: options.mimeType || 'audio/webm' }),
            `voice.${ext}`
          );
          form.append('model', AI_FREE_MODELS.GROQ_WHISPER_TURBO);
          form.append('language', options.language || 'ar');
          if (options.promptHint) {
            form.append('prompt', options.promptHint.slice(0, 400));
          }
          form.append('response_format', 'json');

          const res = await fetch(
            spec.endpointUrl ||
              'https://api.groq.com/openai/v1/audio/transcriptions',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${keys.groqApiKey}`,
              },
              body: form,
              signal: controller.signal,
            }
          );

          if (!res.ok) {
            const errTxt = await res.text().catch(() => '');
            const error = new Error(
              `Groq HTTP ${res.status}: ${errTxt.slice(0, 220)}`
            ) as Error & { status?: number };
            error.status = res.status;
            throw error;
          }

          const json = (await res.json()) as { text?: string };
          const transcript = enforceSafeArabicTerminology(
            String(json.text || '').trim()
          );
          if (!transcript) {
            throw new Error('لم يلتقط whisper-large-v3-turbo كلاماً واضحاً.');
          }

          attempts.push({
            modelId,
            provider: 'groq',
            attempt: attempt + 1,
            status: 'ok',
            latencyMs: Date.now() - attemptStart,
          });

          return {
            ok: true,
            transcript,
            modelId,
            provider: 'groq',
            modelLabel: spec.badgeLabel,
            shortLabel: spec.shortLabel,
            fallbackUsed: attempt > 0,
            attempts,
            latencyMs: Date.now() - startedAt,
          };
        } catch (err) {
          const classified = classifyProviderError(err);
          attempts.push({
            modelId,
            provider: 'groq',
            attempt: attempt + 1,
            status: classified.kind,
            latencyMs: Date.now() - attemptStart,
            detail: classified.message.slice(0, 220),
          });
          if (classified.retryable && attempt === 0) {
            await sleepWithJitter(attempt);
            continue;
          }
          break;
        } finally {
          clearTimeout(timer);
        }
      }
      continue;
    }

    if (spec.provider === 'google') {
      if (!googleClient) {
        attempts.push({
          modelId,
          provider: 'google',
          attempt: 0,
          status: 'missing_key',
          latencyMs: 0,
          detail: 'GEMINI_API_KEY is not configured',
        });
        continue;
      }

      for (let attempt = 0; attempt < 2; attempt++) {
        const attemptStart = Date.now();
        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('503 google_audio_timeout')), timeoutMs);
          });
          const callPromise = googleClient.models.generateContent({
            model: modelId,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: options.mimeType || 'audio/webm',
                      data: options.audioBase64,
                    },
                  },
                  {
                    text:
                      options.promptHint ||
                      'فرّغ هذا التسجيل الصوتي باللغة العربية أو اللهجة العراقية بدقة وأعد النص فقط.',
                  },
                ],
              },
            ],
          });

          const response = await Promise.race([callPromise, timeoutPromise]);
          const transcript = enforceSafeArabicTerminology(
            String(response.text || '').trim()
          );
          if (!transcript) {
            throw new Error('لم يرجع النموذج نصاً مفرغاً.');
          }

          attempts.push({
            modelId,
            provider: 'google',
            attempt: attempt + 1,
            status: 'ok',
            latencyMs: Date.now() - attemptStart,
          });

          return {
            ok: true,
            transcript,
            modelId,
            provider: 'google',
            modelLabel: spec.badgeLabel,
            shortLabel: spec.shortLabel,
            fallbackUsed: idx > 0 || attempt > 0,
            attempts,
            latencyMs: Date.now() - startedAt,
          };
        } catch (err) {
          const classified = classifyProviderError(err);
          attempts.push({
            modelId,
            provider: 'google',
            attempt: attempt + 1,
            status: classified.kind,
            latencyMs: Date.now() - attemptStart,
            detail: classified.message.slice(0, 220),
          });
          if (classified.retryable && attempt === 0) {
            await sleepWithJitter(attempt);
            continue;
          }
          break;
        }
      }
    }
  }

  return {
    ok: false,
    transcript: '',
    modelId: AI_FREE_MODELS.GROQ_WHISPER_TURBO,
    provider: 'groq',
    modelLabel: getAiModelSpec(AI_FREE_MODELS.GROQ_WHISPER_TURBO).badgeLabel,
    shortLabel: getAiModelSpec(AI_FREE_MODELS.GROQ_WHISPER_TURBO).shortLabel,
    fallbackUsed: true,
    attempts,
    latencyMs: Date.now() - startedAt,
    errorSummary:
      attempts.filter((a) => a.detail).slice(-1)[0]?.detail ||
      'تعذر تفريغ الصوت لعدم توفر GROQ_API_KEY أو GEMINI_API_KEY.',
  };
}

export interface LiveProbeResult {
  ok: boolean;
  targetKind: 'model' | 'task';
  targetId: string;
  modelId: AnyAiModelId;
  provider: AiProviderId;
  modelLabel: string;
  shortLabel: string;
  fallbackUsed: boolean;
  finalFallback: typeof MORROW_LOCAL_MODEL_ID;
  latencyMs: number;
  replySnippet: string;
  attempts: ModelAttemptTrace[];
  errorSummary?: string;
}

export async function liveTestAiModelOrTask(params: {
  modelId?: string | null;
  backupModelId?: string | null;
  taskKey?: AiTaskKey | null;
  prompt?: string | null;
}): Promise<LiveProbeResult> {
  const startedAt = Date.now();
  const keys = getServerProviderApiKeys();
  const cleanModel = String(params.modelId || '').trim();
  const taskKey =
    params.taskKey && params.taskKey in AI_TASK_PROFILES ? params.taskKey : null;

  if (cleanModel === MORROW_LOCAL_MODEL_ID) {
    const localSpec = getAiModelSpec(MORROW_LOCAL_MODEL_ID);
    return {
      ok: true,
      targetKind: 'model',
      targetId: MORROW_LOCAL_MODEL_ID,
      modelId: MORROW_LOCAL_MODEL_ID,
      provider: 'local',
      modelLabel: localSpec.badgeLabel,
      shortLabel: localSpec.shortLabel,
      fallbackUsed: false,
      finalFallback: MORROW_LOCAL_MODEL_ID,
      latencyMs: Date.now() - startedAt,
      replySnippet: 'محرك Morrow المحلي جاهز (100% داخل الجهاز كمرجع أخير صامد دون إنترنت).',
      attempts: [],
    };
  }

  const resolvedTask = taskKey
    ? resolveOrderedTaskChain(taskKey, undefined, {
        primaryModelId: params.modelId || undefined,
        backupModelId: params.backupModelId || undefined,
      })
    : null;

  const targetModelId: ApprovedCloudModelId = resolvedTask
    ? resolvedTask.primaryModelId
    : (getAiModelSpec(cleanModel || AI_FREE_MODELS.GEMINI_3_8_FLASH)
        .id as ApprovedCloudModelId);

  const probeChain: ApprovedCloudModelId[] = resolvedTask
    ? resolvedTask.cloudChain
    : [
        targetModelId,
        ...(params.backupModelId
          ? [getAiModelSpec(params.backupModelId).id as ApprovedCloudModelId]
          : []),
        ...AI_ROUTING_PIPELINES.deep_assistant,
      ].filter((id, idx, arr) => arr.indexOf(id) === idx);

  // Special live check for Groq Whisper Turbo (audio STT model cannot take text generateContent)
  if (
    targetModelId === AI_FREE_MODELS.GROQ_WHISPER_TURBO ||
    taskKey === 'audio_transcription'
  ) {
    const attempts: ModelAttemptTrace[] = [];
    if (probeChain[0] === AI_FREE_MODELS.GROQ_WHISPER_TURBO) {
      const t0 = Date.now();
      if (!keys.groqApiKey) {
        attempts.push({
          modelId: AI_FREE_MODELS.GROQ_WHISPER_TURBO,
          provider: 'groq',
          attempt: 1,
          status: 'missing_key',
          latencyMs: 0,
          detail: 'GROQ_API_KEY is not configured',
        });
      } else {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          try {
            const resp = await fetch('https://api.groq.com/openai/v1/models', {
              headers: { Authorization: `Bearer ${keys.groqApiKey}` },
              signal: controller.signal,
            });
            if (!resp.ok) {
              throw new Error(`Groq HTTP ${resp.status}`);
            }
            const json = (await resp.json()) as { data?: Array<{ id?: string }> };
            const hasWhisper = Array.isArray(json.data)
              ? json.data.some((m) => m.id === AI_FREE_MODELS.GROQ_WHISPER_TURBO)
              : true;
            if (!hasWhisper) {
              throw new Error('whisper-large-v3-turbo not listed in Groq models');
            }
            const spec = getAiModelSpec(AI_FREE_MODELS.GROQ_WHISPER_TURBO);
            attempts.push({
              modelId: AI_FREE_MODELS.GROQ_WHISPER_TURBO,
              provider: 'groq',
              attempt: 1,
              status: 'ok',
              latencyMs: Date.now() - t0,
            });
            return {
              ok: true,
              targetKind: taskKey ? 'task' : 'model',
              targetId: taskKey || AI_FREE_MODELS.GROQ_WHISPER_TURBO,
              modelId: AI_FREE_MODELS.GROQ_WHISPER_TURBO,
              provider: 'groq',
              modelLabel: spec.badgeLabel,
              shortLabel: spec.shortLabel,
              fallbackUsed: false,
              finalFallback: MORROW_LOCAL_MODEL_ID,
              latencyMs: Date.now() - startedAt,
              replySnippet: 'اتصال Groq API موثّق والنموذج whisper-large-v3-turbo متاح للتفريغ الصوتي.',
              attempts,
            };
          } finally {
            clearTimeout(timer);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          attempts.push({
            modelId: AI_FREE_MODELS.GROQ_WHISPER_TURBO,
            provider: 'groq',
            attempt: 1,
            status: 'error',
            latencyMs: Date.now() - t0,
            detail: msg.slice(0, 180),
          });
        }
      }
    }

    const googleBackupChain = probeChain.filter(
      (id) => id !== AI_FREE_MODELS.GROQ_WHISPER_TURBO
    );
    const fallbackPing = await executeWithFallback({
      pipeline: 'audio',
      preferredChain:
        googleBackupChain.length > 0
          ? googleBackupChain
          : [AI_FREE_MODELS.GEMINI_3_8_FLASH, AI_FREE_MODELS.GEMINI_3_5_FLASH],
      promptText: 'أجب بكلمتين فقط: جاهز للصوت.',
      maxRetriesPerModel: 1,
      timeoutMs: 10000,
    });
    const combinedAttempts = [...attempts, ...fallbackPing.attempts];
    if (fallbackPing.ok) {
      return {
        ok: true,
        targetKind: taskKey ? 'task' : 'model',
        targetId: taskKey || targetModelId,
        modelId: fallbackPing.modelId,
        provider: fallbackPing.provider,
        modelLabel: fallbackPing.modelLabel,
        shortLabel: fallbackPing.shortLabel,
        fallbackUsed: true,
        finalFallback: MORROW_LOCAL_MODEL_ID,
        latencyMs: Date.now() - startedAt,
        replySnippet: `تم التحويل للاحتياطي السحابي (${fallbackPing.shortLabel}): ${fallbackPing.text.slice(0, 90)}`,
        attempts: combinedAttempts,
      };
    }
    const spec = getAiModelSpec(MORROW_LOCAL_MODEL_ID);
    return {
      ok: false,
      targetKind: taskKey ? 'task' : 'model',
      targetId: taskKey || targetModelId,
      modelId: MORROW_LOCAL_MODEL_ID,
      provider: 'local',
      modelLabel: spec.badgeLabel,
      shortLabel: spec.shortLabel,
      fallbackUsed: true,
      finalFallback: MORROW_LOCAL_MODEL_ID,
      latencyMs: Date.now() - startedAt,
      replySnippet: 'تعذر المسار السحابي للصوت — المرجع المحلي جاهز كخيار أخير.',
      attempts: combinedAttempts,
      errorSummary: fallbackPing.errorSummary,
    };
  }

  // Special live check for Gemini 3.8 Live (realtime WebSocket model verified via Google client + backup)
  if (
    targetModelId === AI_FREE_MODELS.GEMINI_3_8_LIVE ||
    taskKey === 'live_realtime_session'
  ) {
    const liveSpec = getAiModelSpec(AI_FREE_MODELS.GEMINI_3_8_LIVE);
    const googleOk = Boolean(keys.geminiApiKey);
    const backupPing = await executeWithFallback({
      pipeline: 'deep_assistant',
      preferredChain: [
        AI_FREE_MODELS.GEMINI_3_8_FLASH,
        AI_FREE_MODELS.GEMINI_3_5_FLASH,
        AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
      ],
      promptText: 'أجب بعبارة قصيرة: قناة الاحتياط للجلسة المباشرة جاهزة.',
      maxRetriesPerModel: 1,
      timeoutMs: 10000,
    });

    if (googleOk && backupPing.ok) {
      return {
        ok: true,
        targetKind: taskKey ? 'task' : 'model',
        targetId: taskKey || AI_FREE_MODELS.GEMINI_3_8_LIVE,
        modelId: AI_FREE_MODELS.GEMINI_3_8_LIVE,
        provider: 'google',
        modelLabel: liveSpec.badgeLabel,
        shortLabel: liveSpec.shortLabel,
        fallbackUsed: false,
        finalFallback: MORROW_LOCAL_MODEL_ID,
        latencyMs: Date.now() - startedAt,
        replySnippet: `مفتاح Google AI مفعّل للجلسات المباشرة (gemini-3.8-live) ومسار الاحتياط السحابي (${backupPing.shortLabel}) استجاب بنجاح.`,
        attempts: backupPing.attempts,
      };
    }

    return {
      ok: backupPing.ok,
      targetKind: taskKey ? 'task' : 'model',
      targetId: taskKey || targetModelId,
      modelId: backupPing.ok ? backupPing.modelId : MORROW_LOCAL_MODEL_ID,
      provider: backupPing.ok ? backupPing.provider : 'local',
      modelLabel: backupPing.ok
        ? backupPing.modelLabel
        : getAiModelSpec(MORROW_LOCAL_MODEL_ID).badgeLabel,
      shortLabel: backupPing.ok
        ? backupPing.shortLabel
        : getAiModelSpec(MORROW_LOCAL_MODEL_ID).shortLabel,
      fallbackUsed: true,
      finalFallback: MORROW_LOCAL_MODEL_ID,
      latencyMs: Date.now() - startedAt,
      replySnippet: backupPing.ok
        ? `تم التبديل الاحتياطي إلى (${backupPing.shortLabel}).`
        : 'تعذرت السحابة — يعمل المرجع المحلي كخط أخير.',
      attempts: backupPing.attempts,
      errorSummary: backupPing.errorSummary,
    };
  }

  const orch = await executeWithFallback({
    pipeline: taskKey ? AI_TASK_PROFILES[taskKey].pipelineKind : 'deep_assistant',
    preferredChain: probeChain,
    promptText:
      params.prompt?.trim() ||
      'أجب بجملة عربية موجزة من 5 كلمات تؤكد أن هذا النموذج يعمل بنجاح.',
    maxRetriesPerModel: 1,
    timeoutMs: 12000,
  });

  if (orch.ok) {
    return {
      ok: true,
      targetKind: taskKey ? 'task' : 'model',
      targetId: taskKey || targetModelId,
      modelId: orch.modelId,
      provider: orch.provider,
      modelLabel: orch.modelLabel,
      shortLabel: orch.shortLabel,
      fallbackUsed: orch.fallbackUsed || orch.modelId !== targetModelId,
      finalFallback: MORROW_LOCAL_MODEL_ID,
      latencyMs: orch.latencyMs,
      replySnippet: orch.text.slice(0, 140),
      attempts: orch.attempts,
    };
  }

  const localSpec = getAiModelSpec(MORROW_LOCAL_MODEL_ID);
  return {
    ok: false,
    targetKind: taskKey ? 'task' : 'model',
    targetId: taskKey || targetModelId,
    modelId: MORROW_LOCAL_MODEL_ID,
    provider: 'local',
    modelLabel: localSpec.badgeLabel,
    shortLabel: localSpec.shortLabel,
    fallbackUsed: true,
    finalFallback: MORROW_LOCAL_MODEL_ID,
    latencyMs: orch.latencyMs,
    replySnippet: 'تعذرت السحابة — تم التحويل التلقائي إلى Morrow المحلي كمرجع نهائي.',
    attempts: orch.attempts,
    errorSummary: orch.errorSummary,
  };
}

export function getOrchestrationStatusSnapshot() {
  const keys = getServerProviderApiKeys();
  const providerStatus = {
    google: Boolean(keys.geminiApiKey),
    groq: Boolean(keys.groqApiKey),
    openrouter: Boolean(keys.openRouterApiKey),
    local: true,
  };

  const isConfiguredForProvider = (provider: AiProviderId) =>
    provider === 'google'
      ? providerStatus.google
      : provider === 'groq'
        ? providerStatus.groq
        : provider === 'openrouter'
          ? providerStatus.openrouter
          : true;

  const models = ALL_REGISTERED_CLOUD_MODELS.map((m) => ({
    id: m.id,
    provider: m.provider,
    priority: m.priority,
    powerRank: m.powerRank,
    tier: m.tier,
    tierLabel: m.tierLabel,
    shortLabel: m.shortLabel,
    badgeLabel: m.badgeLabel,
    specialty: m.specialty,
    envKeyName: m.envKeyName,
    supportsVision: m.supportsVision,
    supportsPdf: m.supportsPdf,
    supportsAudio: m.supportsAudio,
    supportsStructuredJson: m.supportsStructuredJson,
    supportsToolCalling: m.supportsToolCalling,
    supportsRealtimeWs: Boolean(m.supportsRealtimeWs),
    recommendedTasks: m.recommendedTasks,
    configured: isConfiguredForProvider(m.provider),
  }));

  const modelsSortedStrongestFirst = ALL_MODELS_STRONGEST_TO_WEAKEST.map((m) => ({
    id: m.id,
    provider: m.provider,
    priority: m.priority,
    powerRank: m.powerRank,
    tier: m.tier,
    tierLabel: m.tierLabel,
    shortLabel: m.shortLabel,
    badgeLabel: m.badgeLabel,
    specialty: m.specialty,
    envKeyName: m.envKeyName,
    supportsVision: m.supportsVision,
    supportsPdf: m.supportsPdf,
    supportsAudio: m.supportsAudio,
    supportsStructuredJson: m.supportsStructuredJson,
    supportsToolCalling: m.supportsToolCalling,
    supportsRealtimeWs: Boolean(m.supportsRealtimeWs),
    recommendedTasks: m.recommendedTasks,
    configured: isConfiguredForProvider(m.provider),
  }));

  const anyCloudConfigured =
    providerStatus.google || providerStatus.groq || providerStatus.openrouter;

  return {
    cloudConfigured: anyCloudConfigured,
    providers: providerStatus,
    localModel: {
      id: MORROW_LOCAL_MODEL_ID,
      shortLabel: 'Morrow المحلي',
      powerRank: AI_MODEL_REGISTRY[MORROW_LOCAL_MODEL_ID].powerRank,
      configured: true,
    },
    defaultModel: AI_FREE_MODELS.GEMINI_3_8_FLASH,
    balancedModel: AI_FREE_MODELS.GEMINI_3_5_FLASH,
    fastModel: AI_FREE_MODELS.GEMINI_3_5_FLASH_LITE,
    audioModel: AI_FREE_MODELS.GROQ_WHISPER_TURBO,
    reasoningFallbackModel: AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    autoRouterFallbackModel: AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
    fallbackModel: AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
    liveModel: AI_FREE_MODELS.GEMINI_3_8_LIVE,
    multimodalModel: AI_FREE_MODELS.GEMINI_3_8_FLASH,
    modelsCount: models.length,
    totalModelsWithLocalCount: modelsSortedStrongestFirst.length,
    orchestrationCoreCount: SIX_FREE_CLOUD_MODELS.length,
    models,
    modelsSortedStrongestFirst,
    taskProfiles: AI_TASK_PROFILES,
    defaultTaskRouting: DEFAULT_TASK_ROUTING,
    pipelines: AI_ROUTING_PIPELINES,
  };
}
