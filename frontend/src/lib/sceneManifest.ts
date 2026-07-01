export interface SceneManifest {
  generated_at: string;
  route: string;
  selected_object: unknown | null;
  visible_artifacts: number;
  truth_boundary: string;
  observed_capabilities: string[];
  note: string;
}

export function generateSceneManifest(
  route: string,
  selectedObject: unknown | null,
  visibleCount: number,
  boundary: string,
  actions: string[],
  note: string
): SceneManifest {
  return {
    generated_at: new Date().toISOString(),
    route,
    selected_object: selectedObject,
    visible_artifacts: visibleCount,
    truth_boundary: boundary,
    observed_capabilities: actions,
    note
  };
}
