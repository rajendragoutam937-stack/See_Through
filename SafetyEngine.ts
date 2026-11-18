import {
  PriorityLevel,
  type DetectedObject,
  type DetectionSensitivity,
  type NavigationDecision,
  type ObjectCategory,
  type VisionAnalysisResult,
} from '../types/vision';

const COOLDOWNS_BY_PRIORITY: Record<PriorityLevel, number> = {
  [PriorityLevel.IMMEDIATE_DANGER]: 3200,
  [PriorityLevel.NEARBY_OBSTACLE]: 6000,
  [PriorityLevel.NAVIGATION_INSTRUCTION]: 9000,
  [PriorityLevel.PEOPLE_OR_ANIMALS]: 6000,
  [PriorityLevel.ORDINARY_OBJECT]: 10000,
};

const CLEAR_PATH_COOLDOWN_MS = 18000;
const MIN_GLOBAL_SPEECH_GAP_MS = 900;

const VEHICLE_CATEGORIES = new Set<ObjectCategory>(['car', 'truck', 'motorcycle', 'bicycle']);
const OBSTACLE_CATEGORIES = new Set<ObjectCategory>([
  'wall',
  'pole',
  'road_obstacle',
  'chair',
  'table',
  'bag',
  'backpack',
]);
const ORDINARY_CATEGORIES = new Set<ObjectCategory>([
  'bottle',
  'phone',
  'keyboard',
  'chair',
  'table',
]);

export interface SafetyEvaluationCandidate {
  priority: PriorityLevel;
  dedupKey: string;
  phraseKey: string;
  primaryObject?: DetectedObject;
  urgency: NavigationDecision['urgency'];
  hapticPattern: number[];
}

export class SafetyEngine {
  private lastSpokenKey = '';
  private lastSpokenAt = 0;
  private lastPriority: PriorityLevel | null = null;

  public reset(): void {
    this.lastSpokenKey = '';
    this.lastSpokenAt = 0;
    this.lastPriority = null;
  }

  public evaluate(
    analysis: VisionAnalysisResult,
    sensitivity: DetectionSensitivity
  ): SafetyEvaluationCandidate {
    const minConfidence = sensitivity === 'high' ? 0.45 : sensitivity === 'medium' ? 0.6 : 0.72;
    const objects = analysis.objects.filter((o) => o.confidence >= minConfidence);

    // 1. IMMEDIATE DANGER
    const overhead = objects.find(
      (o) => o.category === 'overhead_obstacle' && (o.distance === 'near' || o.distance === 'medium')
    );
    if (overhead) {
      return {
        priority: PriorityLevel.IMMEDIATE_DANGER,
        dedupKey: 'danger:overhead',
        phraseKey: 'overheadWarning',
        primaryObject: overhead,
        urgency: 'danger',
        hapticPattern: [160, 80, 160, 80, 220],
      };
    }

    const truck = objects.find(
      (o) => o.category === 'truck' && (o.approaching || o.distance === 'near')
    );
    if (truck) {
      return {
        priority: PriorityLevel.IMMEDIATE_DANGER,
        dedupKey: `danger:truck:${truck.position}`,
        phraseKey: 'largeVehicleApproaching',
        primaryObject: truck,
        urgency: 'danger',
        hapticPattern: [200, 70, 200, 70, 240],
      };
    }

    const vehicle = objects.find(
      (o) => VEHICLE_CATEGORIES.has(o.category) && (o.approaching || o.distance === 'near')
    );
    if (vehicle) {
      const phraseKey =
        vehicle.category === 'bicycle'
          ? 'cyclistApproaching'
          : vehicle.position === 'right'
            ? 'vehicleApproachingRight'
            : vehicle.position === 'left'
              ? 'vehicleApproachingLeft'
              : 'vehicleApproachingCenter';
      return {
        priority: PriorityLevel.IMMEDIATE_DANGER,
        dedupKey: `danger:${vehicle.category}:${vehicle.position}`,
        phraseKey,
        primaryObject: vehicle,
        urgency: 'danger',
        hapticPattern: [180, 80, 180],
      };
    }

    const nearStairs = objects.find((o) => o.category === 'stairs' && o.distance === 'near');
    if (nearStairs) {
      return {
        priority: PriorityLevel.IMMEDIATE_DANGER,
        dedupKey: `danger:stairs:${nearStairs.position}`,
        phraseKey: 'stairsAhead',
        primaryObject: nearStairs,
        urgency: 'danger',
        hapticPattern: [140, 80, 140],
      };
    }

    const nearWall = objects.find(
      (o) => o.category === 'wall' && o.distance === 'near' && o.position === 'center'
    );
    if (nearWall) {
      return {
        priority: PriorityLevel.IMMEDIATE_DANGER,
        dedupKey: 'danger:wall:center',
        phraseKey: 'pathBlockedMoveRight',
        primaryObject: nearWall,
        urgency: 'danger',
        hapticPattern: [180, 70, 180],
      };
    }

    if (analysis.pathwayStatus === 'blocked') {
      const blockingObj = objects.find(
        (o) => o.position === 'center' && o.distance === 'near'
      );
      const rightClear = !objects.some((o) => o.position === 'right' && o.distance === 'near');
      return {
        priority: PriorityLevel.IMMEDIATE_DANGER,
        dedupKey: `danger:blocked:${rightClear ? 'right' : 'left'}`,
        phraseKey: rightClear ? 'pathBlockedMoveRight' : 'pathBlockedMoveLeft',
        primaryObject: blockingObj,
        urgency: 'danger',
        hapticPattern: [150, 70, 150],
      };
    }

    // 2. NEARBY OBSTACLE
    const nearBag = objects.find(
      (o) =>
        (o.category === 'bag' || o.category === 'backpack') &&
        o.position === 'center' &&
        o.distance === 'near'
    );
    if (nearBag) {
      return {
        priority: PriorityLevel.NEARBY_OBSTACLE,
        dedupKey: `obstacle:bag:${nearBag.position}`,
        phraseKey: 'bagDirectlyAhead',
        primaryObject: nearBag,
        urgency: 'caution',
        hapticPattern: [110, 60, 110],
      };
    }

    const nearObstacle = objects.find(
      (o) =>
        OBSTACLE_CATEGORIES.has(o.category) &&
        (o.distance === 'near' || (o.position === 'center' && o.distance === 'medium'))
    );
    if (nearObstacle) {
      if (nearObstacle.position === 'center') {
        const leftBlocked = objects.some((o) => o.position === 'left' && o.distance === 'near');
        return {
          priority: PriorityLevel.NEARBY_OBSTACLE,
          dedupKey: `obstacle:center:${nearObstacle.category}`,
          phraseKey: leftBlocked ? 'obstacleMoveRight' : 'obstacleMoveLeft',
          primaryObject: nearObstacle,
          urgency: 'caution',
          hapticPattern: [110, 60, 110],
        };
      }
      return {
        priority: PriorityLevel.NEARBY_OBSTACLE,
        dedupKey: `obstacle:${nearObstacle.category}:${nearObstacle.position}`,
        phraseKey: 'obstacleOnSide',
        primaryObject: nearObstacle,
        urgency: 'caution',
        hapticPattern: [100],
      };
    }

    // Low sensitivity suppresses non-critical announcements unless path changes
    const door = objects.find(
      (o) => o.category === 'door' && (o.distance === 'near' || o.distance === 'medium')
    );

    // 3. NAVIGATION INSTRUCTION (doorway, turns, clear path)
    if (door) {
      return {
        priority: PriorityLevel.NAVIGATION_INSTRUCTION,
        dedupKey: `nav:door:${door.position}`,
        phraseKey: 'doorwayTwoSteps',
        primaryObject: door,
        urgency: 'info',
        hapticPattern: [60],
      };
    }

    if (analysis.pathwayStatus === 'turns_left') {
      return {
        priority: PriorityLevel.NAVIGATION_INSTRUCTION,
        dedupKey: 'nav:turns_left',
        phraseKey: 'pathTurnsLeft',
        urgency: 'info',
        hapticPattern: [60, 40, 60],
      };
    }

    if (analysis.pathwayStatus === 'turns_right') {
      return {
        priority: PriorityLevel.NAVIGATION_INSTRUCTION,
        dedupKey: 'nav:turns_right',
        phraseKey: 'pathTurnsRight',
        urgency: 'info',
        hapticPattern: [60, 40, 60],
      };
    }

    // 4. PEOPLE / ANIMALS (check before generic clear path so approaching people/animals are announced)
    const animal = objects.find(
      (o) => o.category === 'animal' && (o.distance === 'near' || o.distance === 'medium')
    );
    if (animal) {
      return {
        priority: PriorityLevel.PEOPLE_OR_ANIMALS,
        dedupKey: `animal:${animal.position}`,
        phraseKey: 'animalAhead',
        primaryObject: animal,
        urgency: 'caution',
        hapticPattern: [100, 60, 100],
      };
    }

    const person = objects.find(
      (o) =>
        o.category === 'person' &&
        (o.approaching || o.distance === 'near' || (sensitivity !== 'low' && o.distance === 'medium'))
    );
    if (person) {
      return {
        priority: PriorityLevel.PEOPLE_OR_ANIMALS,
        dedupKey: `person:${person.approaching ? 'approaching' : 'static'}:${person.position}`,
        phraseKey: person.approaching ? 'personApproaching' : 'personAhead',
        primaryObject: person,
        urgency: person.approaching ? 'caution' : 'info',
        hapticPattern: person.approaching ? [90] : [],
      };
    }

    if (analysis.pathwayStatus === 'narrow') {
      return {
        priority: PriorityLevel.NAVIGATION_INSTRUCTION,
        dedupKey: 'nav:narrow',
        phraseKey: 'pathNarrow',
        urgency: 'caution',
        hapticPattern: [60],
      };
    }

    // 5. ORDINARY OBJECTS (only when sensitivity is high and no navigation change occurred)
    if (sensitivity === 'high') {
      const ordinary = objects.find(
        (o) => ORDINARY_CATEGORIES.has(o.category) && o.distance === 'near'
      );
      if (ordinary) {
        return {
          priority: PriorityLevel.ORDINARY_OBJECT,
          dedupKey: `ordinary:${ordinary.category}:${ordinary.position}`,
          phraseKey: 'ordinaryObject',
          primaryObject: ordinary,
          urgency: 'info',
          hapticPattern: [],
        };
      }
    }

    if (analysis.uncertain && objects.length === 0) {
      return {
        priority: PriorityLevel.NAVIGATION_INSTRUCTION,
        dedupKey: 'nav:uncertain',
        phraseKey: 'uncertainCaution',
        urgency: 'caution',
        hapticPattern: [],
      };
    }

    return {
      priority: PriorityLevel.NAVIGATION_INSTRUCTION,
      dedupKey: 'nav:clear',
      phraseKey: 'clearPath',
      urgency: 'clear',
      hapticPattern: [],
    };
  }

  /**
   * Anti-repetition & priority-override filter.
   * Returns true if the instruction should be spoken aloud now.
   */
  public shouldSpeak(decision: NavigationDecision, now = Date.now()): boolean {
    const elapsed = now - this.lastSpokenAt;
    const isSameSituation = decision.dedupKey === this.lastSpokenKey;
    const isHigherPriorityThanLast =
      this.lastPriority !== null && decision.priority < this.lastPriority;

    // Any newly arrived danger or newly changed hazard/object speaks immediately
    if (!isSameSituation && (decision.priority <= PriorityLevel.PEOPLE_OR_ANIMALS || isHigherPriorityThanLast)) {
      if (elapsed >= MIN_GLOBAL_SPEECH_GAP_MS || decision.priority === PriorityLevel.IMMEDIATE_DANGER) {
        this.recordSpoken(decision, now);
        return true;
      }
    }

    if (elapsed < MIN_GLOBAL_SPEECH_GAP_MS) {
      return false;
    }

    if (isSameSituation) {
      const cooldown =
        decision.dedupKey === 'nav:clear'
          ? CLEAR_PATH_COOLDOWN_MS
          : COOLDOWNS_BY_PRIORITY[decision.priority];
      if (elapsed < cooldown) {
        return false;
      }
    }

    this.recordSpoken(decision, now);
    return true;
  }

  public recordSpoken(decision: NavigationDecision, now = Date.now()): void {
    this.lastSpokenKey = decision.dedupKey;
    this.lastSpokenAt = now;
    this.lastPriority = decision.priority;
  }
}

export const safetyEngine = new SafetyEngine();
