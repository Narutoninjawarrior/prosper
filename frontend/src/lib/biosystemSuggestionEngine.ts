export interface BiosystemSuggestion {
  id: string;
  type: 'ADD_COMPONENT' | 'ADJUST_PARAMETER' | 'REMOVE_COMPONENT';
  componentType?: 'RETURN_LINE' | 'BUFFER_RESERVOIR' | 'SENSOR' | 'RESERVOIR_CAPACITY';
  confidence: 'high' | 'medium' | 'low';
  title: string;
  reasoning: string;
}

export interface SuggestionState {
  targetPh: number;
  reservoirCapacityGallons: number;
  pumpFlowRateGpm: number;
  returnPathEnabled: boolean;
  sensorEnabled: boolean;
}

export function generateSuggestions(state: SuggestionState, dismissedIds: string[] = []): BiosystemSuggestion[] {
  const suggestions: BiosystemSuggestion[] = [];

  // Rule 1: Missing Return Path
  if (!state.returnPathEnabled) {
    suggestions.push({
      id: 'sugg_return_path',
      type: 'ADD_COMPONENT',
      componentType: 'RETURN_LINE',
      confidence: 'high',
      title: 'AI SUGGESTION: Return Line',
      reasoning: 'Consider adding a return line. Without it, water will not recirculate.',
    });
  }

  // Rule 2: pH Trending Toward Fail-Closed
  if (state.targetPh < 6.0 || state.targetPh > 8.5) {
    suggestions.push({
      id: 'sugg_buffer_reservoir',
      type: 'ADD_COMPONENT',
      componentType: 'BUFFER_RESERVOIR',
      confidence: 'high',
      title: 'AI SUGGESTION: Buffer Reservoir',
      reasoning: 'pH is approaching fail-closed bounds. Consider a buffer reservoir or pH adjustment system.',
    });
  }

  // Rule 3: Pump/Reservoir Mismatch
  if (state.pumpFlowRateGpm > state.reservoirCapacityGallons / 20) {
    suggestions.push({
      id: 'sugg_pump_mismatch',
      type: 'ADJUST_PARAMETER',
      componentType: 'RESERVOIR_CAPACITY',
      confidence: 'medium',
      title: 'AI SUGGESTION: Capacity Review',
      reasoning: 'Your pump flow rate is high relative to reservoir size. This may cause overflow.',
    });
  }

  // Rule 4: Missing Sensor When pH Is Unstable
  if (!state.sensorEnabled && (state.targetPh < 6.5 || state.targetPh > 7.5)) {
    suggestions.push({
      id: 'sugg_sensor',
      type: 'ADD_COMPONENT',
      componentType: 'SENSOR',
      confidence: 'medium',
      title: 'AI SUGGESTION: pH Sensor',
      reasoning: 'A sensor would help monitor pH changes. Would you like to add one?',
    });
  }

  return suggestions.filter(s => !dismissedIds.includes(s.id));
}
