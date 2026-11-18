import type {
  ConversationMessage,
  DemoScenarioId,
  DetectedObject,
  DetectionSensitivity,
  FramePayload,
  ObjectCategory,
  ObjectDistance,
  ObjectPosition,
  PathwayStatus,
  VisionAnalysisResult,
} from '../types/vision';

/* ============================================================================
 * VISION API CONFIGURATION
 * ----------------------------------------------------------------------------
 * All AI vision and companion Q&A calls route through secure backend proxy
 * endpoints (`/api/vision/analyze` and `/api/vision/ask`). Never place private
 * API keys in frontend code; the Express server reads `GEMINI_API_KEY` from
 * server environment secrets and executes `@google/genai` server-side.
 * ========================================================================== */
export const VISION_API_CONFIG = {
  endpoint: '/api/vision/analyze',
  askEndpoint: '/api/vision/ask',
  downloadEndpoint: '/api/project/download',
  healthEndpoint: '/api/health',
  requestTimeoutMs: 10000,
} as const;

export interface AnalyzeFrameOptions {
  sensitivity: DetectionSensitivity;
  spokenLanguageName: string;
  signal?: AbortSignal;
}

export interface AskAssistantOptions {
  question?: string;
  audioBase64?: string;
  audioMimeType?: string;
  imageFrame: FramePayload | null;
  spokenLanguageName: string;
  history: ConversationMessage[];
  demoSceneSummary?: string;
}

export interface AskAssistantResponse {
  transcript?: string;
  reply: string;
  detectedLanguageTag?: string;
  switchLanguageName?: string;
  switchLanguageTag?: string;
}

export class VisionAnalyzerError extends Error {
  public readonly code: 'OFFLINE' | 'CONCURRENT' | 'TIMEOUT' | 'API_ERROR' | 'INVALID_RESPONSE';

  constructor(code: VisionAnalyzerError['code'], message: string) {
    super(message);
    this.name = 'VisionAnalyzerError';
    this.code = code;
  }
}

const VALID_CATEGORIES = new Set<ObjectCategory>([
  'person',
  'car',
  'truck',
  'motorcycle',
  'bicycle',
  'animal',
  'door',
  'stairs',
  'chair',
  'table',
  'bag',
  'backpack',
  'bottle',
  'phone',
  'keyboard',
  'wall',
  'pole',
  'road_obstacle',
  'overhead_obstacle',
  'pathway',
]);

const VALID_POSITIONS = new Set<ObjectPosition>(['left', 'center', 'right']);
const VALID_DISTANCES = new Set<ObjectDistance>(['near', 'medium', 'far']);
const VALID_PATHWAYS = new Set<PathwayStatus>([
  'clear',
  'blocked',
  'turns_left',
  'turns_right',
  'narrow',
  'uncertain',
]);

let requestInFlight = false;

export function isAnalysisInFlight(): boolean {
  return requestInFlight;
}

/**
 * Clearly separated AI vision integration function.
 * Sends a single captured JPEG frame to `/api/vision/analyze` and returns
 * normalized scene detections + spoken guidance in any requested world language.
 */
export async function analyzeFrame(
  imageFrame: FramePayload,
  options: AnalyzeFrameOptions
): Promise<VisionAnalysisResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new VisionAnalyzerError('OFFLINE', 'AI connection unavailable.');
  }

  if (requestInFlight) {
    throw new VisionAnalyzerError('CONCURRENT', 'Previous frame analysis is still in progress.');
  }

  requestInFlight = true;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), VISION_API_CONFIG.requestTimeoutMs);

  const forwardAbort = () => controller.abort();
  options.signal?.addEventListener('abort', forwardAbort);

  try {
    const response = await fetch(VISION_API_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        imageBase64: imageFrame.imageBase64,
        mimeType: imageFrame.mimeType,
        sensitivity: options.sensitivity,
        spokenLanguageName: options.spokenLanguageName,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const serverMsg =
        data && typeof data.error === 'string'
          ? data.error
          : `Vision API request failed (${response.status})`;
      throw new VisionAnalyzerError('API_ERROR', serverMsg);
    }

    if (!data || typeof data !== 'object') {
      throw new VisionAnalyzerError('INVALID_RESPONSE', 'Malformed response from vision service.');
    }

    return normalizeVisionPayload(data, 'live');
  } catch (err) {
    if (err instanceof VisionAnalyzerError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new VisionAnalyzerError('TIMEOUT', 'Vision request timed out.');
    }
    if (err instanceof TypeError) {
      throw new VisionAnalyzerError('OFFLINE', 'AI connection unavailable.');
    }
    throw new VisionAnalyzerError(
      'API_ERROR',
      err instanceof Error ? err.message : 'Unable to analyze camera frame.'
    );
  } finally {
    window.clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', forwardAbort);
    requestInFlight = false;
  }
}

export async function askAssistant(
  options: AskAssistantOptions
): Promise<AskAssistantResponse> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new VisionAnalyzerError('OFFLINE', 'AI connection unavailable.');
  }

  const response = await fetch(VISION_API_CONFIG.askEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: options.question ?? null,
      audioBase64: options.audioBase64 ?? null,
      audioMimeType: options.audioMimeType ?? null,
      imageBase64: options.imageFrame?.imageBase64 ?? null,
      mimeType: options.imageFrame?.mimeType ?? 'image/jpeg',
      spokenLanguageName: options.spokenLanguageName,
      demoSceneSummary: options.demoSceneSummary ?? null,
      history: options.history.slice(-6).map((m) => ({
        role: m.role,
        text: m.text,
      })),
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const serverMsg =
      data && typeof data.error === 'string'
        ? data.error
        : `Assistant request failed (${response.status})`;
    throw new VisionAnalyzerError('API_ERROR', serverMsg);
  }

  if (!data || typeof data.reply !== 'string') {
    throw new VisionAnalyzerError('INVALID_RESPONSE', 'Malformed response from assistant.');
  }

  return {
    transcript:
      typeof data.transcript === 'string' && data.transcript.trim()
        ? data.transcript.trim()
        : undefined,
    reply: data.reply.trim(),
    detectedLanguageTag:
      typeof data.detectedLanguageTag === 'string' && data.detectedLanguageTag.trim()
        ? data.detectedLanguageTag.trim()
        : undefined,
    switchLanguageName:
      typeof data.switchLanguageName === 'string' && data.switchLanguageName.trim()
        ? data.switchLanguageName.trim()
        : undefined,
    switchLanguageTag:
      typeof data.switchLanguageTag === 'string' && data.switchLanguageTag.trim()
        ? data.switchLanguageTag.trim()
        : undefined,
  };
}

function normalizeVisionPayload(
  raw: Record<string, unknown>,
  source: 'live' | 'demo'
): VisionAnalysisResult {
  const pathwayStatus: PathwayStatus = VALID_PATHWAYS.has(raw.pathwayStatus as PathwayStatus)
    ? (raw.pathwayStatus as PathwayStatus)
    : 'uncertain';

  const rawObjects = Array.isArray(raw.objects) ? raw.objects : [];
  const objects: DetectedObject[] = [];

  for (let i = 0; i < rawObjects.length; i += 1) {
    const item = rawObjects[i];
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const category = VALID_CATEGORIES.has(obj.category as ObjectCategory)
      ? (obj.category as ObjectCategory)
      : 'road_obstacle';
    const position = VALID_POSITIONS.has(obj.position as ObjectPosition)
      ? (obj.position as ObjectPosition)
      : 'center';
    const distance = VALID_DISTANCES.has(obj.distance as ObjectDistance)
      ? (obj.distance as ObjectDistance)
      : 'medium';
    const confidence =
      typeof obj.confidence === 'number' && Number.isFinite(obj.confidence)
        ? Math.min(1, Math.max(0, obj.confidence))
        : 0.75;

    objects.push({
      id: `${category}-${position}-${i}`,
      category,
      label: typeof obj.label === 'string' && obj.label.trim() ? obj.label.trim() : category,
      position,
      distance,
      approaching: Boolean(obj.approaching),
      confidence,
    });
  }

  const urgencyHint =
    raw.urgencyHint === 'danger' ||
    raw.urgencyHint === 'caution' ||
    raw.urgencyHint === 'clear' ||
    raw.urgencyHint === 'info'
      ? raw.urgencyHint
      : undefined;

  const spokenGuidance =
    typeof raw.spokenGuidance === 'string' && raw.spokenGuidance.trim()
      ? raw.spokenGuidance.trim()
      : undefined;

  return {
    timestamp: Date.now(),
    pathwayStatus,
    objects,
    sceneSummary:
      typeof raw.sceneSummary === 'string' && raw.sceneSummary.trim()
        ? raw.sceneSummary.trim()
        : spokenGuidance ?? 'Surroundings analyzed.',
    spokenGuidance,
    urgencyHint,
    uncertain: Boolean(raw.uncertain),
    source,
  };
}

export interface DemoScenarioDefinition {
  id: DemoScenarioId;
  title: string;
  titleHi: string;
  description: string;
  descriptionHi: string;
  result: Omit<VisionAnalysisResult, 'timestamp' | 'source'>;
}

export const DEMO_SCENARIOS: DemoScenarioDefinition[] = [
  {
    id: 'clear_path',
    title: 'Clear Path',
    titleHi: 'साफ रास्ता',
    description: 'Open walkway straight ahead with no immediate hazards.',
    descriptionHi: 'आगे खुला और सुरक्षित रास्ता।',
    result: {
      pathwayStatus: 'clear',
      uncertain: false,
      sceneSummary: 'Open walkway straight ahead.',
      objects: [
        {
          id: 'demo-pathway',
          category: 'pathway',
          label: 'Open sidewalk',
          position: 'center',
          distance: 'near',
          approaching: false,
          confidence: 0.94,
        },
      ],
    },
  },
  {
    id: 'car_approaching_right',
    title: 'Car Approaching Right',
    titleHi: 'दाएं से कार आ रही है',
    description: 'Moving passenger vehicle detected entering from the right.',
    descriptionHi: 'दाईं ओर से आता हुआ वाहन।',
    result: {
      pathwayStatus: 'narrow',
      uncertain: false,
      sceneSummary: 'Car approaching from the right side.',
      objects: [
        {
          id: 'demo-car',
          category: 'car',
          label: 'Car',
          position: 'right',
          distance: 'near',
          approaching: true,
          confidence: 0.96,
        },
      ],
    },
  },
  {
    id: 'truck_approaching',
    title: 'Large Truck Approaching',
    titleHi: 'बड़ा ट्रक आ रहा है',
    description: 'Heavy vehicle approaching near the roadway.',
    descriptionHi: 'सड़क के पास आता हुआ बड़ा ट्रक।',
    result: {
      pathwayStatus: 'blocked',
      uncertain: false,
      sceneSummary: 'Large truck approaching ahead.',
      objects: [
        {
          id: 'demo-truck',
          category: 'truck',
          label: 'Truck',
          position: 'center',
          distance: 'near',
          approaching: true,
          confidence: 0.95,
        },
      ],
    },
  },
  {
    id: 'person_approaching',
    title: 'Person Approaching',
    titleHi: 'व्यक्ति आ रहा है',
    description: 'Pedestrian walking toward you from the left.',
    descriptionHi: 'बाईं ओर से पैदल व्यक्ति आ रहा है।',
    result: {
      pathwayStatus: 'clear',
      uncertain: false,
      sceneSummary: 'Person walking toward user from left.',
      objects: [
        {
          id: 'demo-person',
          category: 'person',
          label: 'Person',
          position: 'left',
          distance: 'medium',
          approaching: true,
          confidence: 0.92,
        },
      ],
    },
  },
  {
    id: 'bag_ahead',
    title: 'Bag Directly Ahead',
    titleHi: 'सामने बैग रखा है',
    description: 'Floor-level bag directly in front of your path.',
    descriptionHi: 'रास्ते में बिल्कुल सामने रखा बैग।',
    result: {
      pathwayStatus: 'narrow',
      uncertain: false,
      sceneSummary: 'Bag resting on floor directly ahead.',
      objects: [
        {
          id: 'demo-bag',
          category: 'bag',
          label: 'Bag',
          position: 'center',
          distance: 'near',
          approaching: false,
          confidence: 0.91,
        },
      ],
    },
  },
  {
    id: 'obstacle_left',
    title: 'Obstacle on Left',
    titleHi: 'बाएं तरफ बाधा',
    description: 'Chair or street pole obstructing the left side.',
    descriptionHi: 'बाईं ओर खंभा या कुर्सी।',
    result: {
      pathwayStatus: 'narrow',
      uncertain: false,
      sceneSummary: 'Obstacle on left side of path.',
      objects: [
        {
          id: 'demo-pole',
          category: 'pole',
          label: 'Pole',
          position: 'left',
          distance: 'near',
          approaching: false,
          confidence: 0.9,
        },
      ],
    },
  },
  {
    id: 'door_ahead',
    title: 'Door Ahead',
    titleHi: 'आगे दरवाज़ा',
    description: 'Open doorway roughly two steps ahead.',
    descriptionHi: 'लगभग दो कदम आगे दरवाज़ा।',
    result: {
      pathwayStatus: 'clear',
      uncertain: false,
      sceneSummary: 'Doorway centered two steps ahead.',
      objects: [
        {
          id: 'demo-door',
          category: 'door',
          label: 'Doorway',
          position: 'center',
          distance: 'near',
          approaching: false,
          confidence: 0.92,
        },
      ],
    },
  },
  {
    id: 'path_blocked',
    title: 'Path Blocked',
    titleHi: 'रास्ता बंद है',
    description: 'Wall or barrier blocking center lane with room on the right.',
    descriptionHi: 'सामने रास्ता बंद है, दाएं हटने की जगह है।',
    result: {
      pathwayStatus: 'blocked',
      uncertain: false,
      sceneSummary: 'Pathway blocked directly ahead by a wall.',
      objects: [
        {
          id: 'demo-wall',
          category: 'wall',
          label: 'Wall',
          position: 'center',
          distance: 'near',
          approaching: false,
          confidence: 0.93,
        },
      ],
    },
  },
  {
    id: 'overhead_obstacle',
    title: 'Overhead Obstacle',
    titleHi: 'ऊपर नीची बाधा',
    description: 'Low hanging branch or sign above head height.',
    descriptionHi: 'सिर के ऊपर नीची लटकती बाधा।',
    result: {
      pathwayStatus: 'narrow',
      uncertain: false,
      sceneSummary: 'Low overhead obstacle detected.',
      objects: [
        {
          id: 'demo-overhead',
          category: 'overhead_obstacle',
          label: 'Low branch',
          position: 'center',
          distance: 'near',
          approaching: false,
          confidence: 0.91,
        },
      ],
    },
  },
  {
    id: 'path_turns_left',
    title: 'Path Turns Left',
    titleHi: 'रास्ता बाएं मुड़ता है',
    description: 'Corridor or sidewalk turning left ahead.',
    descriptionHi: 'आगे रास्ता बाईं ओर मुड़ता है।',
    result: {
      pathwayStatus: 'turns_left',
      uncertain: false,
      sceneSummary: 'Walkway turns left ahead.',
      objects: [
        {
          id: 'demo-wall-turn',
          category: 'wall',
          label: 'Wall',
          position: 'right',
          distance: 'medium',
          approaching: false,
          confidence: 0.89,
        },
      ],
    },
  },
  {
    id: 'animal_ahead',
    title: 'Animal Ahead',
    titleHi: 'आगे जानवर है',
    description: 'Dog or animal standing in the path ahead.',
    descriptionHi: 'रास्ते में आगे जानवर खड़ा है।',
    result: {
      pathwayStatus: 'narrow',
      uncertain: false,
      sceneSummary: 'Animal standing on walkway ahead.',
      objects: [
        {
          id: 'demo-animal',
          category: 'animal',
          label: 'Dog',
          position: 'center',
          distance: 'near',
          approaching: false,
          confidence: 0.92,
        },
      ],
    },
  },
  {
    id: 'stairs_ahead',
    title: 'Stairs Ahead',
    titleHi: 'आगे सीढ़ियां हैं',
    description: 'Step-down or staircase directly ahead.',
    descriptionHi: 'बिल्कुल सामने सीढ़ियां हैं।',
    result: {
      pathwayStatus: 'narrow',
      uncertain: false,
      sceneSummary: 'Staircase detected directly ahead.',
      objects: [
        {
          id: 'demo-stairs',
          category: 'stairs',
          label: 'Stairs',
          position: 'center',
          distance: 'near',
          approaching: false,
          confidence: 0.94,
        },
      ],
    },
  },
];

export function simulateDemoScenario(scenarioId: DemoScenarioId): VisionAnalysisResult {
  const found = DEMO_SCENARIOS.find((s) => s.id === scenarioId) ?? DEMO_SCENARIOS[0];
  return {
    timestamp: Date.now(),
    pathwayStatus: found.result.pathwayStatus,
    objects: found.result.objects.map((o) => ({ ...o })),
    sceneSummary: found.result.sceneSummary,
    uncertain: found.result.uncertain,
    source: 'demo',
  };
}
