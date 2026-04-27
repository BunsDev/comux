interface ComuxProcessShutdownState {
  claimed: boolean;
  owner?: string;
}

type GlobalWithComuxShutdownState = typeof globalThis & {
  __comuxProcessShutdownState?: ComuxProcessShutdownState;
};

function getShutdownState(): ComuxProcessShutdownState {
  const globalWithState = globalThis as GlobalWithComuxShutdownState;
  if (!globalWithState.__comuxProcessShutdownState) {
    globalWithState.__comuxProcessShutdownState = {
      claimed: false,
    };
  }

  return globalWithState.__comuxProcessShutdownState;
}

export function claimProcessShutdown(owner: string): boolean {
  const state = getShutdownState();
  if (state.claimed) {
    return false;
  }

  state.claimed = true;
  state.owner = owner;
  return true;
}

export function getClaimedProcessShutdownOwner(): string | undefined {
  return getShutdownState().owner;
}

export function resetProcessShutdownForTesting(): void {
  const state = getShutdownState();
  state.claimed = false;
  state.owner = undefined;
}
