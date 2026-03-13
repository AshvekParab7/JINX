import { logFallEvent } from "./api";
import { createManualFallSample, startMotionMonitoring } from "./sensors";
import { storage } from "./storage";

const ENABLED_KEY = "fallMonitoringEnabled";
const QUEUE_KEY = "pendingFallEvents";

let stopMonitoring = null;
let state = {
  enabled: false,
  active: false,
  lastSample: null,
  lastIncident: null,
  pendingCount: 0,
  lastSyncStatus: "idle",
};

const listeners = new Set();

const emit = () => {
  listeners.forEach((listener) => listener({ ...state }));
};

const buildIncidentPayload = (sample) => ({
  activity: sample.activity,
  auto_alert_triggered: true,
  confidence: sample.confidence,
  mode: sample.source === "manual-test" ? "manual" : "wearable",
  notes: "Recorded from device motion monitoring.",
  sensor_payload: {
    magnitude: sample.magnitude,
    vector: sample.vector,
    recorded_at: sample.timestamp,
  },
  severity: sample.severity,
  source: sample.source,
});

const readQueue = async () => {
  try {
    const raw = await storage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeQueue = async (queue) => {
  await storage.setItem(QUEUE_KEY, JSON.stringify(queue));
  state = { ...state, pendingCount: queue.length };
  emit();
};

export const hydrateFallMonitor = async () => {
  const [enabledRaw, queue] = await Promise.all([
    storage.getItem(ENABLED_KEY),
    readQueue(),
  ]);

  state = {
    ...state,
    enabled: enabledRaw === "true",
    pendingCount: queue.length,
  };
  emit();
  return { ...state };
};

export const subscribeToFallMonitor = (listener) => {
  listeners.add(listener);
  listener({ ...state });

  return () => {
    listeners.delete(listener);
  };
};

export const getFallMonitoringEnabled = async () => {
  const enabled = await storage.getItem(ENABLED_KEY);
  return enabled === "true";
};

export const setFallMonitoringEnabled = async (enabled) => {
  await storage.setItem(ENABLED_KEY, enabled ? "true" : "false");
  state = { ...state, enabled };
  emit();
};

export const flushPendingFallEvents = async () => {
  const queue = await readQueue();
  if (!queue.length) {
    state = { ...state, lastSyncStatus: "synced", pendingCount: 0 };
    emit();
    return { synced: 0 };
  }

  const remaining = [];
  let synced = 0;

  for (const payload of queue) {
    const result = await logFallEvent(payload);
    if (result?.error || !result?.id) {
      remaining.push(payload);
    } else {
      synced += 1;
    }
  }

  await writeQueue(remaining);
  state = {
    ...state,
    lastSyncStatus: remaining.length ? "queued-offline" : "synced",
  };
  emit();
  return { synced, remaining: remaining.length };
};

const queueIncident = async (payload) => {
  const queue = await readQueue();
  queue.push(payload);
  await writeQueue(queue);
  state = { ...state, lastSyncStatus: "queued-offline" };
  emit();
};

const processIncident = async (sample) => {
  const payload = buildIncidentPayload(sample);
  state = { ...state, lastIncident: sample };
  emit();

  const result = await logFallEvent(payload);
  if (result?.error || !result?.id) {
    await queueIncident(payload);
    return { queued: true };
  }

  state = { ...state, lastSyncStatus: "synced" };
  emit();
  await flushPendingFallEvents();
  return { queued: false };
};

export const ensurePersistentMonitoring = async () => {
  const enabled = await getFallMonitoringEnabled();
  state = { ...state, enabled };

  if (!enabled || stopMonitoring) {
    emit();
    return { ...state };
  }

  stopMonitoring = startMotionMonitoring({
    source: "wearable",
    updateInterval: 900,
    onSample: (sample) => {
      state = { ...state, active: true, lastSample: sample };
      emit();
    },
    onFallDetected: (sample) => {
      void processIncident(sample);
    },
  });

  state = { ...state, active: true };
  emit();
  return { ...state };
};

export const stopPersistentMonitoring = () => {
  if (stopMonitoring) {
    stopMonitoring();
    stopMonitoring = null;
  }

  state = { ...state, active: false };
  emit();
};

export const triggerManualFall = async () => {
  const sample = createManualFallSample("manual-test");
  state = { ...state, lastSample: sample, lastIncident: sample };
  emit();
  return processIncident(sample);
};
