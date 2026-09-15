import { Router, type IRouter } from "express";
import {
  CreateObservationBody,
  CreateObservationResponse,
  ExtractTextBody,
  GetEnvironmentResponse,
  GetPreferencesResponse,
  OcrInput,
  SendAssistantCommandBody,
  SendAssistantCommandResponse,
  RunDemoResponse,
  UpdatePreferencesBody,
  UpdatePreferencesResponse,
} from "@workspace/api-zod";
import {
  analyzeSceneWithGemini,
  answerCommandWithGemini,
  getDashboard,
  getObservationHistory,
  getPreferenceState,
  runDemoScenario,
  saveObservationAsync,
  updatePreferenceState,
} from "../lib/accessx";
import { extractTextFromImage } from "../lib/ocr";

const router: IRouter = Router();

router.get("/environment", (_req, res): void => {
  res.json(GetEnvironmentResponse.parse(getDashboard()));
});

router.get("/environment/history", (_req, res): void => {
  res.json({
    history: getObservationHistory(),
  });
});

router.post("/environment/observations", async (req, res): Promise<void> => {
  const bodyData = req.body as Record<string, unknown>;
  const imageData = typeof bodyData?.imageData === "string" ? bodyData.imageData : null;
  const mimeType = typeof bodyData?.mimeType === "string" ? bodyData.mimeType : "image/jpeg";

  let isLive = false;
  let inputData: any;

  if (imageData) {
    try {
      const geminiObservation = await analyzeSceneWithGemini(imageData, mimeType);
      inputData = {
        ...geminiObservation,
        ...(typeof bodyData === "object" && bodyData !== null ? bodyData : {}),
      };
      isLive = true;
    } catch (err) {
      console.warn("Gemini multimodal scene analysis error, using fallback observation data:", err);
      const parsed = CreateObservationBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }
      inputData = parsed.data;
    }
  } else {
    const parsed = CreateObservationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    inputData = parsed.data;
  }

  const updatedDashboard = await saveObservationAsync(inputData, isLive);
  res.status(201).json(CreateObservationResponse.parse(updatedDashboard));
});

router.post("/environment/analyze", async (req, res): Promise<void> => {
  const parsed = ExtractTextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const observation = await analyzeSceneWithGemini(parsed.data.imageData, parsed.data.mimeType);
    let ocrResult = null;
    try {
      ocrResult = await extractTextFromImage(parsed.data);
    } catch (ocrErr) {
      console.warn("OCR extraction skipped during scene analysis:", ocrErr);
    }
    observation.ocr = ocrResult;
    const dashboard = await saveObservationAsync(observation, true);
    res.json(CreateObservationResponse.parse(dashboard));
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Multimodal scene analysis failed",
    });
  }
});

router.post("/environment/ocr", async (req, res): Promise<void> => {
  const parsed = ExtractTextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    res.json(await extractTextFromImage(parsed.data));
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "OCR service unavailable",
    });
  }
});

router.post("/demo/run", (_req, res): void => {
  res.json(RunDemoResponse.parse(runDemoScenario()));
});

router.get("/preferences", (_req, res): void => {
  res.json(GetPreferencesResponse.parse(getPreferenceState()));
});

router.patch("/preferences", (req, res): void => {
  const parsed = UpdatePreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(UpdatePreferencesResponse.parse(updatePreferenceState(parsed.data)));
});

router.post("/assistant/command", async (req, res): Promise<void> => {
  const parsed = SendAssistantCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const answer = await answerCommandWithGemini(parsed.data.command);
  res.json(
    SendAssistantCommandResponse.parse({
      transcript: parsed.data.command,
      response: answer.response,
      intent: answer.intent,
      confidence: currentConfidence(),
      safetyMessage:
        answer.safetyMessage || "This response is an assistive estimate. Verify before acting.",
    }),
  );
});

const currentConfidence = (): number => getDashboard().current.confidence;

export default router;