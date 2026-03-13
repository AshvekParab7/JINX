import { Accelerometer } from "expo-sensors";

const FALL_THRESHOLD = 2.45;
const HIGH_ACTIVITY_THRESHOLD = 1.55;
const WALKING_THRESHOLD = 1.12;

const SIMULATION_PROFILES = [
  { activity: "Resting", min: 0.96, max: 1.04, fallChance: 0.002 },
  { activity: "Walking", min: 1.12, max: 1.42, fallChance: 0.004 },
  { activity: "Active", min: 1.45, max: 1.9, fallChance: 0.006 },
];

const randomBetween = (min, max) => Math.random() * (max - min) + min;

export const classifyActivityFromMagnitude = (magnitude) => {
  if (magnitude >= HIGH_ACTIVITY_THRESHOLD) {
    return "Active";
  }

  if (magnitude >= WALKING_THRESHOLD) {
    return "Walking";
  }

  return "Resting";
};

const buildMotionSample = ({
  x,
  y,
  z,
  source,
  previousMagnitude = 1,
  fallThreshold = FALL_THRESHOLD,
}) => {
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  const jerk = Math.abs(magnitude - previousMagnitude);
  const suspectedFall = magnitude >= fallThreshold && jerk >= 0.75;
  const confidence = Math.min(
    99,
    Math.max(58, Math.round((magnitude / fallThreshold) * 72 + jerk * 10)),
  );

  return {
    activity: suspectedFall
      ? "Impact detected"
      : classifyActivityFromMagnitude(magnitude),
    confidence,
    magnitude: Number(magnitude.toFixed(2)),
    severity: suspectedFall ? (magnitude >= 3 ? "High" : "Medium") : "Normal",
    source,
    suspectedFall,
    timestamp: new Date().toISOString(),
    vector: {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      z: Number(z.toFixed(2)),
    },
  };
};

export const createManualFallSample = (source = "simulated") => {
  return buildMotionSample({
    x: 2.74,
    y: 1.82,
    z: 2.21,
    source,
    previousMagnitude: 0.38,
  });
};

const startWearableMonitoring = ({
  onSample,
  onFallDetected,
  updateInterval,
  fallThreshold,
}) => {
  Accelerometer.setUpdateInterval(updateInterval);
  let previousMagnitude = 1;

  const subscription = Accelerometer.addListener(({ x, y, z }) => {
    const sample = buildMotionSample({
      x,
      y,
      z,
      source: "wearable",
      previousMagnitude,
      fallThreshold,
    });

    previousMagnitude = sample.magnitude;
    onSample(sample);

    if (sample.suspectedFall) {
      onFallDetected(sample);
    }
  });

  return () => {
    subscription.remove();
  };
};

const startSimulatedMonitoring = ({
  onSample,
  onFallDetected,
  updateInterval,
  fallThreshold,
}) => {
  let profileIndex = 0;
  let previousMagnitude = 1;
  let ticks = 0;

  const intervalId = setInterval(() => {
    ticks += 1;

    if (ticks % 5 === 0) {
      profileIndex = (profileIndex + 1) % SIMULATION_PROFILES.length;
    }

    const profile = SIMULATION_PROFILES[profileIndex];

    if (Math.random() < profile.fallChance) {
      const fallSample = createManualFallSample("simulated");
      previousMagnitude = fallSample.magnitude;
      onSample(fallSample);
      onFallDetected(fallSample);
      return;
    }

    const z = randomBetween(profile.min, profile.max);
    const x = randomBetween(-0.28, 0.28);
    const y = randomBetween(-0.24, 0.24);
    const sample = buildMotionSample({
      x,
      y,
      z,
      source: "simulated",
      previousMagnitude,
      fallThreshold,
    });

    previousMagnitude = sample.magnitude;
    onSample(sample);
  }, updateInterval);

  return () => clearInterval(intervalId);
};

export const startMotionMonitoring = ({
  source = "wearable",
  onSample,
  onFallDetected,
  updateInterval = 900,
  fallThreshold = FALL_THRESHOLD,
}) => {
  if (source === "simulated") {
    return startSimulatedMonitoring({
      onSample,
      onFallDetected,
      updateInterval,
      fallThreshold,
    });
  }

  return startWearableMonitoring({
    onSample,
    onFallDetected,
    updateInterval,
    fallThreshold,
  });
};

export const startFallDetection = (onFallDetected) => {
  return startMotionMonitoring({
    source: "wearable",
    onSample: () => {},
    onFallDetected,
    updateInterval: 500,
  });
};
