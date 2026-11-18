export type SupportedLanguage = 'en' | 'hi';

export type ObjectCategory =
  | 'person'
  | 'car'
  | 'truck'
  | 'motorcycle'
  | 'bicycle'
  | 'animal'
  | 'door'
  | 'stairs'
  | 'chair'
  | 'table'
  | 'bag'
  | 'backpack'
  | 'bottle'
  | 'phone'
  | 'keyboard'
  | 'wall'
  | 'pole'
  | 'road_obstacle'
  | 'overhead_obstacle'
  | 'pathway';

export type ObjectPosition = 'left' | 'center' | 'right';
export type ObjectDistance = 'near' | 'medium' | 'far';

export type PathwayStatus =
  | 'clear'
  | 'blocked'
  | 'turns_left'
  | 'turns_right'
  | 'narrow'
  | 'uncertain';

export type DetectionSensitivity = 'low' | 'medium' | 'high';

export enum PriorityLevel {
  IMMEDIATE_DANGER = 1,
  NEARBY_OBSTACLE = 2,
  NAVIGATION_INSTRUCTION = 3,
  PEOPLE_OR_ANIMALS = 4,
  ORDINARY_OBJECT = 5,
}

export interface DetectedObject {
  id: string;
  category: ObjectCategory;
  label: string;
  position: ObjectPosition;
  distance: ObjectDistance;
  approaching: boolean;
  confidence: number;
}

export interface VisionAnalysisResult {
  timestamp: number;
  pathwayStatus: PathwayStatus;
  objects: DetectedObject[];
  sceneSummary: string;
  spokenGuidance?: string;
  urgencyHint?: 'danger' | 'caution' | 'clear' | 'info';
  uncertain: boolean;
  source: 'live' | 'demo' | 'local-reflex';
}

export interface NavigationDecision {
  id: string;
  priority: PriorityLevel;
  dedupKey: string;
  phraseKey: string;
  spokenText: string;
  actionHint: string;
  urgency: 'danger' | 'caution' | 'clear' | 'info';
  hapticPattern: number[];
  bypassCooldown: boolean;
  timestamp: number;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export type CameraStatus =
  | 'inactive'
  | 'requesting'
  | 'active'
  | 'paused'
  | 'error';

export type DemoScenarioId =
  | 'clear_path'
  | 'person_approaching'
  | 'bag_ahead'
  | 'car_approaching_right'
  | 'truck_approaching'
  | 'obstacle_left'
  | 'door_ahead'
  | 'path_turns_left'
  | 'overhead_obstacle'
  | 'path_blocked'
  | 'animal_ahead'
  | 'stairs_ahead';

export interface AppSettings {
  speechSpeed: number;
  voiceURI: string;
  volume: number;
  muted: boolean;
  sensitivity: DetectionSensitivity;
  language: SupportedLanguage;
  spokenLanguageName: string;
  spokenLanguageTag: string;
  vibrationEnabled: boolean;
  analysisIntervalMs: 200 | 800 | 2000;
  demoMode: boolean;
}

export interface FramePayload {
  imageBase64: string;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
  capturedAt: number;
}
