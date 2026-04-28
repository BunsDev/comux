<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';

type PaneSummary = { id: string; slug?: string; agent?: string; agentStatus?: string; cwd?: string };
type CovenSessionSummary = { id: string; title?: string; harness: string; status: string; cwd: string; projectRoot: string; createdAt: string; updatedAt?: string };
type BridgeConfig = { port: number; token?: string | null; tokenPath: string; projectRoot: string };
type PendingRequest = { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

const projectName = ref('Comux');
const projectRoot = ref('');
const connected = ref(false);
const bridgeMode = ref<'tauri' | 'web' | 'preview'>('preview');
const bridgeStatus = ref('Finding local cockpit…');
const panes = ref<PaneSummary[]>([]);
const covenSessions = ref<CovenSessionSummary[]>([]);
const selectedSessionId = ref<string | null>(null);
const selectedPaneId = ref<string | null>(null);
const lastUpdate = ref<Date | null>(null);
const launchPrompt = ref('');
const launchHarness = ref<'codex' | 'claude'>('codex');
const launchTitle = ref('');
const launching = ref(false);
const launchError = ref('');
const showCommandPalette = ref(false);
const ws = ref<WebSocket | null>(null);
const pending = new Map<string, PendingRequest>();
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let requestSeq = 0;

const previewSessions: CovenSessionSummary[] = [
  { id: 'preview-codex', title: 'Polish desktop shell', harness: 'codex', status: 'running', cwd: '~/Documents/GitHub/BunsDev/comux', projectRoot: '~/Documents/GitHub/BunsDev/comux', createdAt: new Date().toISOString() },
  { id: 'preview-claude', title: 'Review launch flow', harness: 'claude', status: 'completed', cwd: '~/Documents/GitHub/OpenCoven/coven', projectRoot: '~/Documents/GitHub/OpenCoven/coven', createdAt: new Date(Date.now() - 1000 * 60 * 34).toISOString() },
];

const displaySessions = computed(() => covenSessions.value.length ? covenSessions.value : previewSessions);
const selectedSession = computed(() => displaySessions.value.find((session) => session.id === selectedSessionId.value) ?? displaySessions.value[0] ?? null);
const selectedPane = computed(() => panes.value.find((pane) => pane.id === selectedPaneId.value) ?? panes.value[0] ?? null);
const runningCount = computed(() => covenSessions.value.filter((session) => session.status === 'running').length);
const completedCount = computed(() => covenSessions.value.filter((session) => session.status === 'completed').length);
const waitingCount = computed(() => panes.value.filter((pane) => pane.agentStatus === 'waiting').length);
const lastUpdateLabel = computed(() => lastUpdate.value ? lastUpdate.value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'never');
const sessionOutputPreview = computed(() => {
  const session = selectedSession.value;
  if (!session) return ['No session selected.'];
  if (session.id.startsWith('preview-')) return ['$ coven attach ' + session.id, `${session.harness} · ${session.status}`, '', 'Planning the next clean slice…', '• preserve VMUX multi-pane energy', '• soften the chrome into an Apple-style glass cockpit', '• keep Coven as the runtime substrate', '', '[preview] connect the comux daemon to see live output here.'];
  return ['$ coven attach ' + session.id, `${session.harness} · ${session.status}`, '', 'Live transcript embedding is the next slice.', 'For now, open this session into a Comux pane or attach from terminal.'];
});

function isTauriRuntime() { return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window; }
function request<T>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
  const socket = ws.value;
  if (!socket || socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Comux bridge is not connected'));
  const requestId = `desktop-${Date.now()}-${++requestSeq}`;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`${type} timed out`)); }, 8000);
    pending.set(requestId, { resolve, reject, timer });
    socket.send(JSON.stringify({ type, requestId, ...payload }));
  });
}
function handleBridgeMessage(message: MessageEvent) {
  if (typeof message.data !== 'string') return;
  let data: any;
  try { data = JSON.parse(message.data); } catch { return; }
  if (data.type === 'welcome') { connected.value = true; bridgeStatus.value = 'Connected to local Comux bridge'; return; }
  if (data.requestId && pending.has(data.requestId)) {
    const entry = pending.get(data.requestId)!;
    pending.delete(data.requestId);
    clearTimeout(entry.timer);
    data.type === 'error' ? entry.reject(new Error(data.message || data.code || 'Bridge request failed')) : entry.resolve(data);
  }
}
async function connectTauriBridge() {
  bridgeMode.value = 'tauri';
  const config = await invoke<BridgeConfig>('bridge_config');
  projectRoot.value = config.projectRoot;
  projectName.value = config.projectRoot.split('/').filter(Boolean).pop() || 'Comux';
  if (!config.token) { bridgeStatus.value = `No Comux token yet. Start the daemon once to create ${config.tokenPath}.`; connected.value = false; return; }
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${config.port}`);
    const timer = setTimeout(() => reject(new Error('Bridge connection timed out')), 5000);
    socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'hello', token: config.token })));
    socket.addEventListener('message', (event) => {
      handleBridgeMessage(event);
      try {
        const parsed = JSON.parse(String(event.data));
        if (parsed.type === 'welcome') {
          clearTimeout(timer); ws.value = socket;
          socket.addEventListener('message', handleBridgeMessage);
          socket.addEventListener('close', () => { connected.value = false; bridgeStatus.value = 'Comux bridge disconnected'; });
          resolve();
        }
        if (parsed.type === 'error') { clearTimeout(timer); reject(new Error(parsed.message || 'Unauthorized bridge connection')); }
      } catch {}
    });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error(`No Comux daemon on 127.0.0.1:${config.port}`)); }, { once: true });
  });
  await refreshBridgeData();
}
async function refreshBridgeData() {
  if (bridgeMode.value === 'tauri' && ws.value?.readyState === WebSocket.OPEN) {
    const [paneResult, covenResult] = await Promise.allSettled([request<{ panes: PaneSummary[] }>('panes.list'), request<{ sessions: CovenSessionSummary[] }>('coven.sessions.list')]);
    if (paneResult.status === 'fulfilled') panes.value = paneResult.value.panes || [];
    if (covenResult.status === 'fulfilled') covenSessions.value = covenResult.value.sessions || [];
    if (covenResult.status === 'rejected') bridgeStatus.value = covenResult.reason.message;
    connected.value = true; lastUpdate.value = new Date();
    if (!selectedSessionId.value && displaySessions.value[0]) selectedSessionId.value = displaySessions.value[0].id;
    if (!selectedPaneId.value && panes.value[0]) selectedPaneId.value = panes.value[0].id;
    return;
  }
  try {
    bridgeMode.value = 'web';
    const response = await fetch('/api/panes');
    const data = await response.json();
    projectName.value = data.projectName || 'Comux';
    panes.value = data.panes || [];
    connected.value = true; bridgeStatus.value = 'Connected to Comux web bridge'; lastUpdate.value = new Date();
  } catch { bridgeMode.value = 'preview'; connected.value = false; bridgeStatus.value = 'Preview mode — start comux daemon for live sessions'; }
}
async function launchSession() {
  if (!launchPrompt.value.trim() || launching.value) return;
  launchError.value = ''; launching.value = true;
  try {
    if (bridgeMode.value === 'tauri') {
      const result = await request<{ session: CovenSessionSummary }>('coven.sessions.launch', { launch: { harness: launchHarness.value, prompt: launchPrompt.value.trim(), title: launchTitle.value.trim() || undefined, cwd: projectRoot.value || undefined } });
      covenSessions.value = [result.session, ...covenSessions.value.filter((session) => session.id !== result.session.id)];
      selectedSessionId.value = result.session.id; launchPrompt.value = ''; launchTitle.value = ''; await refreshBridgeData();
    } else {
      const response = await fetch('/api/panes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: launchPrompt.value.trim(), agent: launchHarness.value }) });
      if (!response.ok) throw new Error('Failed to create pane');
      launchPrompt.value = ''; await refreshBridgeData();
    }
  } catch (error) { launchError.value = error instanceof Error ? error.message : String(error); }
  finally { launching.value = false; }
}
async function openSession(session: CovenSessionSummary) {
  selectedSessionId.value = session.id;
  if (bridgeMode.value !== 'tauri' || session.id.startsWith('preview-')) return;
  try { const result = await request<{ pane: PaneSummary }>('coven.sessions.open', { id: session.id }); selectedPaneId.value = result.pane.id; await refreshBridgeData(); }
  catch (error) { launchError.value = error instanceof Error ? error.message : String(error); }
}
function statusClass(status?: string) { return `status-${(status || 'unknown').toLowerCase()}`; }
function formatPath(path: string) { return path.replace(/^\/Users\/[^/]+/, '~'); }
function formatAge(value?: string) { if (!value) return 'unknown'; const delta = Math.max(0, Date.now() - new Date(value).getTime()); const minutes = Math.floor(delta / 60000); if (minutes < 1) return 'now'; if (minutes < 60) return `${minutes}m ago`; const hours = Math.floor(minutes / 60); return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`; }
function handleGlobalKeydown(event: KeyboardEvent) { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); showCommandPalette.value = !showCommandPalette.value; nextTick(() => document.getElementById('launch-prompt')?.focus()); } }
onMounted(async () => {
  document.addEventListener('keydown', handleGlobalKeydown);
  if (isTauriRuntime()) { try { await connectTauriBridge(); } catch (error) { bridgeMode.value = 'tauri'; connected.value = false; bridgeStatus.value = error instanceof Error ? error.message : String(error); } }
  else { await refreshBridgeData(); }
  refreshTimer = setInterval(() => refreshBridgeData().catch(() => undefined), 3000);
});
onBeforeUnmount(() => { document.removeEventListener('keydown', handleGlobalKeydown); if (refreshTimer) clearInterval(refreshTimer); for (const entry of pending.values()) clearTimeout(entry.timer); pending.clear(); ws.value?.close(); });
</script>

<template>
  <main class="desktop-shell">
    <div class="orb orb-violet" /><div class="orb orb-moon" />
    <aside class="sidebar glass-panel">
      <div class="brand-row"><div class="brand-mark">⌘</div><div><div class="eyebrow">Comux</div><h1>{{ projectName }}</h1></div></div>
      <button class="new-session" @click="showCommandPalette = true"><span>New session</span><kbd>⌘K</kbd></button>
      <section class="sidebar-section"><div class="section-label">Coven sessions</div>
        <button v-for="session in displaySessions" :key="session.id" class="session-row" :class="{ active: selectedSession?.id === session.id }" @click="openSession(session)">
          <span class="session-glyph" :class="session.harness">{{ session.harness === 'claude' ? 'C' : '⌁' }}</span>
          <span class="session-copy"><strong>{{ session.title || session.harness }}</strong><small>{{ session.harness }} · {{ formatAge(session.updatedAt || session.createdAt) }}</small></span>
          <span class="status-dot" :class="statusClass(session.status)" />
        </button>
      </section>
      <section class="sidebar-section panes-section"><div class="section-label">VMUX-style panes</div>
        <button v-for="pane in panes" :key="pane.id" class="pane-row" :class="{ active: selectedPane?.id === pane.id }" @click="selectedPaneId = pane.id"><span>{{ pane.slug || pane.id }}</span><small>{{ pane.agent || pane.agentStatus || 'shell' }}</small></button>
        <p v-if="panes.length === 0" class="muted-note">No panes yet. Launch through Coven or start a Comux TUI session.</p>
      </section>
    </aside>
    <section class="workspace">
      <header class="topbar glass-panel"><div><div class="eyebrow">Local agent cockpit</div><h2>Quiet control for Codex, Claude, and Coven</h2></div><div class="connection-pill" :class="{ connected }"><span />{{ connected ? 'Live' : 'Preview' }} · {{ lastUpdateLabel }}</div></header>
      <section class="hero-grid">
        <article class="hero-card glass-panel"><div class="hero-copy"><div class="eyebrow">Design direction</div><h3>VMUX energy, Apple restraint.</h3><p>Multi-agent panes, now softened into a minimalist desktop surface with Codex/ChatGPT-style clarity and subtle glass depth.</p></div><div class="metric-row"><div><strong>{{ runningCount }}</strong><span>running</span></div><div><strong>{{ completedCount }}</strong><span>done</span></div><div><strong>{{ waitingCount }}</strong><span>waiting</span></div></div></article>
        <form class="launch-card glass-panel" @submit.prevent="launchSession"><div class="launch-header"><div><div class="eyebrow">Launch</div><h3>Send work to Coven</h3></div><select v-model="launchHarness" aria-label="Harness"><option value="codex">Codex</option><option value="claude">Claude</option></select></div><input v-model="launchTitle" class="title-input" placeholder="Optional title" /><textarea id="launch-prompt" v-model="launchPrompt" placeholder="Ask an agent to build, inspect, refactor, or research…" /><div class="launch-footer"><span>{{ bridgeStatus }}</span><button type="submit" :disabled="launching || !launchPrompt.trim()">{{ launching ? 'Launching…' : 'Launch' }}</button></div><p v-if="launchError" class="error-text">{{ launchError }}</p></form>
      </section>
      <section class="main-grid">
        <article class="transcript glass-panel"><div class="panel-header"><div><div class="eyebrow">Selected session</div><h3>{{ selectedSession?.title || selectedSession?.id || 'No session' }}</h3></div><span v-if="selectedSession" class="status-badge" :class="statusClass(selectedSession.status)">{{ selectedSession.status }}</span></div><pre>{{ sessionOutputPreview.join('\n') }}</pre></article>
        <aside class="detail-stack"><article class="glass-panel detail-card"><div class="eyebrow">Project</div><h3>{{ formatPath(projectRoot || selectedSession?.projectRoot || '~') }}</h3><p>{{ selectedSession ? `${selectedSession.harness} · ${selectedSession.status}` : 'Connect the daemon to bind live project state.' }}</p></article><article class="glass-panel detail-card"><div class="eyebrow">Next slice</div><h3>Embed live output</h3><p>Stream Coven events here, then add input, kill, reopen, and export controls.</p></article><article class="glass-panel detail-card command-card"><div class="eyebrow">Daemon</div><code>comux daemon</code><code>coven daemon start</code></article></aside>
      </section>
    </section>
    <div v-if="showCommandPalette" class="palette-backdrop" @click.self="showCommandPalette = false"><form class="palette glass-panel" @submit.prevent="launchSession(); showCommandPalette = false"><div class="palette-header"><span>New Coven session</span><button type="button" @click="showCommandPalette = false">esc</button></div><textarea v-model="launchPrompt" placeholder="What should Codex or Claude do?" autofocus /><div class="palette-actions"><select v-model="launchHarness"><option value="codex">Codex</option><option value="claude">Claude</option></select><button type="submit" :disabled="!launchPrompt.trim()">Launch</button></div></form></div>
  </main>
</template>
