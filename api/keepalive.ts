export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const targetUrl = "https://bot-7bnf.onrender.com/health/";

  const nowMinute = floorToUtcMinute(Date.now());
  const schedule = getCurrentSchedule(nowMinute);

  if (nowMinute !== schedule.nextPingAt) {
    const waitMin = Math.max(0, Math.round((schedule.nextPingAt - nowMinute) / 60000));
    return res.status(200).json({
      ok: true,
      action: "skipped",
      reason: "waiting_for_random_window",
      nextDelayMin: schedule.nextIntervalMin,
      waitMin,
      nextPingAt: new Date(schedule.nextPingAt).toISOString(),
      targetUrl,
    });
  }

  const startedAt = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const pingRes = await fetch(targetUrl, {
      method: "GET",
      headers: { "User-Agent": "MindTrack-KeepAlive/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    return res.status(200).json({
      ok: true,
      action: "pinged",
      pingOk: pingRes.ok,
      pingStatus: pingRes.status,
      latencyMs: Date.now() - startedAt,
      nextDelayMin: schedule.nextIntervalMin,
      nextPingAt: new Date(schedule.nextPingAt + schedule.nextIntervalMin * 60000).toISOString(),
      targetUrl,
    });
  } catch (e: any) {
    return res.status(200).json({
      ok: true,
      action: "pinged",
      pingOk: false,
      pingStatus: 0,
      pingError: e?.message || "Ping failed",
      latencyMs: Date.now() - startedAt,
      nextDelayMin: schedule.nextIntervalMin,
      nextPingAt: new Date(schedule.nextPingAt + schedule.nextIntervalMin * 60000).toISOString(),
      targetUrl,
    });
  }
}

type ScheduleState = {
  nextPingAt: number;
  nextIntervalMin: number;
};

const SEED_START = 0x9e3779b9;
const START_UTC_MS = Date.UTC(2026, 0, 1, 0, 0, 0, 0);

function floorToUtcMinute(ms: number) {
  return Math.floor(ms / 60000) * 60000;
}

function lcg(seed: number) {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function intervalFromSeed(seed: number) {
  return 10 + (seed % 6);
}

function getCurrentSchedule(nowMinuteMs: number): ScheduleState {
  let current = START_UTC_MS;
  let seed = SEED_START;
  let nextInterval = intervalFromSeed(seed);

  while (current < nowMinuteMs) {
    seed = lcg(seed);
    nextInterval = intervalFromSeed(seed);
    current += nextInterval * 60000;
  }

  return {
    nextPingAt: current,
    nextIntervalMin: nextInterval,
  };
}
