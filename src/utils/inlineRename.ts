export const MAX_INLINE_NAME_LENGTH = 80;

export type InlineRenameTarget =
  | {
      kind: 'pane';
      paneId: string;
    }
  | {
      kind: 'project';
      projectRoot: string;
    };

export interface InlineRenameState {
  target: InlineRenameTarget;
  value: string;
  cursor: number;
}

export function isEditingPaneName(
  state: InlineRenameState | null | undefined,
  paneId: string
): boolean {
  return state?.target.kind === 'pane' && state.target.paneId === paneId;
}

export function isEditingProjectName(
  state: InlineRenameState | null | undefined,
  projectRoot: string
): boolean {
  return state?.target.kind === 'project' && state.target.projectRoot === projectRoot;
}
