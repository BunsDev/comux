interface VmuxProcessShutdownState {
  claimed: boolean;
  owner?: string;
}

type GlobalWithVmuxShutdownState = typeof globalThis & {
  __vmuxProcessShutdownState?: VmuxProcessShutdownState;
};

function getShutdownState(): VmuxProcessShutdownState {
  const globalWithState = globalThis as GlobalWithVmuxShutdownState;
  if (!globalWithState.__vmuxProcessShutdownState) {
    globalWithState.__vmuxProcessShutdownState = {
      claimed: false,
    };
  }

  return globalWithState.__vmuxProcessShutdownState;
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
