import { Router, type IRouter } from "express";
import {
  CreateObservationBody,
  CreateObservationResponse,
  GetEnvironmentResponse,
  GetPreferencesResponse,
  SendAssistantCommandBody,
  SendAssistantCommandResponse,
  RunDemoResponse,
  UpdatePreferencesBody,
  UpdatePreferencesResponse,
} from "@workspace/api-zod";
import {
  answerCommand,
  getDashboard,
  getPreferenceState,
  runDemoScenario,
  saveObservation,
  updatePreferenceState,
} from "../lib/accessx";

const router: IRouter = Router();

router.get("/environment", (_req, res): void => {
  res.json(GetEnvironmentResponse.parse(getDashboard()));
});

router.post("/environment/observations", (req, res): void => {
  const parsed = CreateObservationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.status(201).json(CreateObservationResponse.parse(saveObservation(parsed.data)));
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

router.post("/assistant/command", (req, res): void => {
  const parsed = SendAssistantCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const answer = answerCommand(parsed.data.command);
  res.json(
    SendAssistantCommandResponse.parse({
      transcript: parsed.data.command,
      response: answer.response,
      intent: answer.intent,
      confidence: currentConfidence(),
      safetyMessage:
        "This response is an assistive estimate. Verify before acting.",
    }),
  );
});

const currentConfidence = (): number => getDashboard().current.confidence;

export default router;