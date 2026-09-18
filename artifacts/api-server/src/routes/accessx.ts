import { Router, type IRouter } from "express";
import {
  CreateObservationBody,
  ExtractTextBody,
  GetEnvironmentResponse,
  SendAssistantCommandBody,
  SendAssistantCommandResponse,
  UpdatePreferencesBody,
} from "@workspace/api-zod";
import {
  analyzeLiveImage,
  evaluateCurrentAccessibility,
  getChangeLog,
  getDashboard,
  getHealthDetails,
  getNavigationPlan,
  getObservationHistory,
  getPreferenceState,
  handleAssistantCommand,
  readImageText,
  runDemoScenario,
  runDemoStep,
  saveObservationAsync,
  searchCampusPlaces,
  transcribeUserAudio,
  updatePreferenceState,
} from "../lib/accessx";

const router: IRouter = Router();

const sendDashboard = (res: { json: (body: unknown) => void; status: (code: number) => { json: (body: unknown) => void } }, dashboard: ReturnType<typeof getDashboard>, status = 200) => {
  const parsed = GetEnvironmentResponse.parse(dashboard);
  const payload = {
    ...parsed,
    spokenSummary: dashboard.spokenSummary,
    announce: dashboard.announce,
    aiConfigured: dashboard.aiConfigured,
    aiModel: dashboard.aiModel,
    reasoning: dashboard.reasoning,
    pipeline: dashboard.pipeline,
    change: {
      ...parsed.change,
      type: dashboard.change.type,
      object: dashboard.change.object,
      accessibilityImpact: dashboard.change.accessibilityImpact,
    },
    current: {
      ...parsed.current,
      scene: dashboard.current.scene,
      crowdLevel: dashboard.current.crowdLevel,
      lighting: dashboard.current.lighting,
      pathDetail: dashboard.current.pathDetail,
      vision: dashboard.current.vision,
    },
    previous: parsed.previous && dashboard.previous
      ? {
          ...parsed.previous,
          scene: dashboard.previous.scene,
          crowdLevel: dashboard.previous.crowdLevel,
          lighting: dashboard.previous.lighting,
          pathDetail: dashboard.previous.pathDetail,
          vision: dashboard.previous.vision,
        }
      : parsed.previous,
    preferences: dashboard.preferences,
  };
  if (status === 201) {
    res.status(201).json(payload);
    return;
  }
  res.json(payload);
};

const aiConfigError = (error: unknown) => {
  const err = error as { code?: string; message?: string };
  if (err.code === "AI_NOT_CONFIGURED") {
    return {
      status: 503,
      body: {
        error: err.message,
        code: "AI_NOT_CONFIGURED",
        required: "GEMINI_API_KEY",
        obtain: "https://aistudio.google.com/apikey",
        hint: "Add GEMINI_API_KEY to the backend environment. Live AI will not be replaced with fake detections.",
      },
    };
  }
  return {
    status: 502,
    body: { error: err.message || "AI request failed" },
  };
};

router.get("/healthz", (_req, res): void => {
  res.json(getHealthDetails());
});

router.get("/health", (_req, res): void => {
  res.json(getHealthDetails());
});

router.get("/environment", (_req, res): void => {
  sendDashboard(res, getDashboard());
});

router.get("/environment/current", (_req, res): void => {
  sendDashboard(res, getDashboard());
});

router.get("/environment/history", (_req, res): void => {
  res.json({ history: getObservationHistory() });
});

router.get("/environment/changes", (_req, res): void => {
  res.json({ changes: getChangeLog() });
});

router.post("/environment/compare", (_req, res): void => {
  const dashboard = getDashboard();
  res.json(dashboard.change);
});

router.post("/environment/observations", async (req, res): Promise<void> => {
  const bodyData = req.body as Record<string, unknown>;
  const imageData = typeof bodyData?.imageData === "string" ? bodyData.imageData : null;
  const mimeType = typeof bodyData?.mimeType === "string" ? bodyData.mimeType : "image/jpeg";

  if (imageData) {
    try {
      const dashboard = await analyzeLiveImage(imageData, mimeType);
      sendDashboard(res, dashboard, 201);
    } catch (error) {
      const mapped = aiConfigError(error);
      res.status(mapped.status).json(mapped.body);
    }
    return;
  }

  const parsed = CreateObservationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updatedDashboard = await saveObservationAsync(parsed.data, false);
  sendDashboard(res, updatedDashboard, 201);
});

router.post("/environment/observe", async (req, res): Promise<void> => {
  const bodyData = req.body as Record<string, unknown>;
  const imageData = typeof bodyData?.imageData === "string" ? bodyData.imageData : null;
  const mimeType = typeof bodyData?.mimeType === "string" ? bodyData.mimeType : "image/jpeg";
  if (!imageData) {
    res.status(400).json({ error: "imageData is required" });
    return;
  }
  try {
    sendDashboard(res, await analyzeLiveImage(imageData, mimeType));
  } catch (error) {
    const mapped = aiConfigError(error);
    res.status(mapped.status).json(mapped.body);
  }
});

router.post("/environment/analyze", async (req, res): Promise<void> => {
  const parsed = ExtractTextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    sendDashboard(res, await analyzeLiveImage(parsed.data.imageData, parsed.data.mimeType));
  } catch (error) {
    const mapped = aiConfigError(error);
    res.status(mapped.status).json(mapped.body);
  }
});

router.post("/ai/analyze-image", async (req, res): Promise<void> => {
  const parsed = ExtractTextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    sendDashboard(res, await analyzeLiveImage(parsed.data.imageData, parsed.data.mimeType));
  } catch (error) {
    const mapped = aiConfigError(error);
    res.status(mapped.status).json(mapped.body);
  }
});

router.post("/environment/ocr", async (req, res): Promise<void> => {
  const parsed = ExtractTextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    res.json(await readImageText(parsed.data.imageData, parsed.data.mimeType));
  } catch (error) {
    const mapped = aiConfigError(error);
    res.status(mapped.status).json(mapped.body);
  }
});

router.post("/demo/run", (_req, res): void => {
  sendDashboard(res, runDemoScenario());
});

router.post("/demo/step", (req, res): void => {
  const step = (req.body as { step?: string })?.step;
  if (step !== "clear" && step !== "obstacle" && step !== "elevator") {
    res.status(400).json({ error: "step must be clear, obstacle, or elevator" });
    return;
  }
  sendDashboard(res, runDemoStep(step));
});

router.get("/preferences", (_req, res): void => {
  res.json(getPreferenceState());
});

router.patch("/preferences", (req, res): void => {
  const parsed = UpdatePreferencesBody.safeParse(req.body);
  const known = parsed.success ? parsed.data : {};
  const extra = req.body && typeof req.body === "object" ? req.body : {};
  res.json(updatePreferenceState({ ...extra, ...known }));
});

router.get("/profile", (_req, res): void => {
  res.json(getPreferenceState());
});

router.put("/profile", (req, res): void => {
  res.json(updatePreferenceState(req.body ?? {}));
});

router.patch("/profile", (req, res): void => {
  res.json(updatePreferenceState(req.body ?? {}));
});

router.post("/assistant/command", async (req, res): Promise<void> => {
  const body = req.body && typeof req.body === "object" ? { source: "text", ...req.body } : req.body;
  const parsed = SendAssistantCommandBody.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const answer = await handleAssistantCommand(parsed.data.command);
    const dashboard = getDashboard();
    res.json(
      SendAssistantCommandResponse.parse({
        transcript: parsed.data.command,
        response: answer.response,
        intent: ["navigate", "describe", "changes", "elevator", "unknown"].includes(answer.intent)
          ? answer.intent
          : "describe",
        confidence: dashboard.current.confidence,
        safetyMessage: answer.safetyMessage,
      }),
    );
  } catch (error) {
    const mapped = aiConfigError(error);
    res.status(mapped.status).json(mapped.body);
  }
});

router.post("/ai/chat", async (req, res): Promise<void> => {
  const command = typeof (req.body as { command?: string; message?: string })?.command === "string"
    ? (req.body as { command: string }).command
    : (req.body as { message?: string })?.message;
  if (!command?.trim()) {
    res.status(400).json({ error: "command is required" });
    return;
  }
  try {
    const answer = await handleAssistantCommand(command.trim());
    res.json({ ...answer, transcript: command.trim() });
  } catch (error) {
    const mapped = aiConfigError(error);
    res.status(mapped.status).json(mapped.body);
  }
});

router.post("/ai/transcribe", async (req, res): Promise<void> => {
  const body = req.body as { audioData?: string; mimeType?: string };
  if (!body.audioData) {
    res.status(400).json({ error: "audioData is required" });
    return;
  }
  try {
    const transcript = await transcribeUserAudio(body.audioData, body.mimeType || "audio/m4a");
    res.json({ transcript });
  } catch (error) {
    const mapped = aiConfigError(error);
    res.status(mapped.status).json(mapped.body);
  }
});

router.post("/accessibility/evaluate", (_req, res): void => {
  res.json(evaluateCurrentAccessibility());
});

router.post("/navigation/route", (_req, res): void => {
  res.json(getNavigationPlan());
});

router.get("/campus/search", (req, res): void => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  res.json({ places: searchCampusPlaces(q) });
});

export default router;
