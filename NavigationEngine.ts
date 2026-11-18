import { getPhrases } from '../i18n/phrases';
import {
  PriorityLevel,
  type DetectionSensitivity,
  type NavigationDecision,
  type SupportedLanguage,
  type VisionAnalysisResult,
} from '../types/vision';
import { safetyEngine, type SafetyEvaluationCandidate } from './SafetyEngine';

export class NavigationEngine {
  public generateDecision(
    analysis: VisionAnalysisResult,
    language: SupportedLanguage,
    sensitivity: DetectionSensitivity
  ): NavigationDecision {
    const candidate = safetyEngine.evaluate(analysis, sensitivity);
    const phrases = getPhrases(language);

    // Prefer natural, scene-specific companion guidance from Gemini live analysis when present
    const spokenText =
      analysis.source === 'live' && analysis.spokenGuidance
        ? analysis.spokenGuidance
        : this.formatSpokenText(candidate, language);

    const urgency =
      analysis.source === 'live' && analysis.urgencyHint
        ? analysis.urgencyHint
        : candidate.urgency;

    const effectivePriority =
      urgency === 'danger' ? PriorityLevel.IMMEDIATE_DANGER : candidate.priority;

    return {
      id: `${analysis.timestamp}-${candidate.dedupKey}`,
      priority: effectivePriority,
      dedupKey: candidate.dedupKey,
      phraseKey: candidate.phraseKey,
      spokenText,
      actionHint: phrases.ui.priorityLabels[effectivePriority],
      urgency,
      hapticPattern:
        urgency === 'danger' && candidate.hapticPattern.length === 0
          ? [160, 70, 160]
          : candidate.hapticPattern,
      bypassCooldown: effectivePriority === PriorityLevel.IMMEDIATE_DANGER,
      timestamp: analysis.timestamp,
    };
  }

  public shouldSpeakDecision(decision: NavigationDecision, forceSpeak = false): boolean {
    if (forceSpeak) {
      safetyEngine.recordSpoken(decision);
      return true;
    }
    return safetyEngine.shouldSpeak(decision);
  }

  public resetHistory(): void {
    safetyEngine.reset();
  }

  private formatSpokenText(
    candidate: SafetyEvaluationCandidate,
    language: SupportedLanguage
  ): string {
    const phrases = getPhrases(language);
    const obj = candidate.primaryObject;
    const pos = obj?.position ?? 'center';
    const localizedLabel = obj ? phrases.objectLabels[obj.category] ?? obj.label : '';

    switch (candidate.phraseKey) {
      case 'overheadWarning':
        return phrases.spoken.overheadWarning;
      case 'largeVehicleApproaching':
        return phrases.spoken.largeVehicleApproaching;
      case 'vehicleApproachingRight':
        return phrases.spoken.vehicleApproachingRight;
      case 'vehicleApproachingLeft':
        return phrases.spoken.vehicleApproachingLeft;
      case 'vehicleApproachingCenter':
        return phrases.spoken.vehicleApproachingCenter;
      case 'cyclistApproaching':
        return phrases.spoken.cyclistApproaching(pos);
      case 'stairsAhead':
        return phrases.spoken.stairsAhead;
      case 'pathBlockedMoveRight':
        return phrases.spoken.pathBlockedMoveRight;
      case 'pathBlockedMoveLeft':
        return phrases.spoken.pathBlockedMoveLeft;
      case 'bagDirectlyAhead':
        return phrases.spoken.bagDirectlyAhead;
      case 'obstacleMoveLeft':
        return phrases.spoken.obstacleMoveLeft;
      case 'obstacleMoveRight':
        return phrases.spoken.obstacleMoveRight;
      case 'obstacleOnSide':
        return phrases.spoken.obstacleOnSide(localizedLabel, pos);
      case 'doorwayTwoSteps':
        return phrases.spoken.doorwayTwoSteps(pos);
      case 'pathTurnsLeft':
        return phrases.spoken.pathTurnsLeft;
      case 'pathTurnsRight':
        return phrases.spoken.pathTurnsRight;
      case 'pathNarrow':
        return phrases.spoken.pathNarrow;
      case 'animalAhead':
        return phrases.spoken.animalAhead;
      case 'personApproaching':
        return phrases.spoken.personApproaching(pos);
      case 'personAhead':
        return phrases.spoken.personAhead(pos);
      case 'ordinaryObject':
        return phrases.spoken.ordinaryObject(localizedLabel, pos);
      case 'uncertainCaution':
        return phrases.spoken.uncertainCaution;
      case 'clearPath':
      default:
        return phrases.spoken.clearPath;
    }
  }
}

export const navigationEngine = new NavigationEngine();
