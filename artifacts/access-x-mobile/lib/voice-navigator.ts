import { speakText, repeatLastSpeech, stopSpeech } from './speech';
import { queryCampusKnowledge, CAMPUS_LOCATIONS } from './offline/campus-knowledge';

export type VoiceIntentType =
  | 'scan'
  | 'offline_scan'
  | 'navigate'
  | 'changes'
  | 'profile'
  | 'communicator'
  | 'captions'
  | 'mode_offline'
  | 'mode_online'
  | 'campus_query'
  | 'help'
  | 'wake'
  | 'repeat'
  | 'stop'
  | 'unknown';

export interface VoiceIntentResult {
  type: VoiceIntentType;
  confidence: number;
  extractedQuery?: string;
  targetRoute?: string;
  suggestedSpeech: string;
}

/**
 * Normalizes input speech string by stripping common filler words and punctuation.
 */
function cleanSpeech(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses conversational spoken user requests into structured accessibility actions.
 */
export function parseVoiceIntent(spokenText: string, isOffline = false): VoiceIntentResult {
  const text = cleanSpeech(spokenText);

  if (!text) {
    return {
      type: 'unknown',
      confidence: 0,
      suggestedSpeech: "I didn't catch that. You can say: scan the area, navigate campus, or ask where the elevator is.",
    };
  }

  // 1. Wake word / Greeting
  if (
    text === 'hey g sense' ||
    text === 'g sense' ||
    text === 'hello g sense' ||
    text === 'hi g sense' ||
    text === 'hello' ||
    text === 'hi' ||
    text === 'hey'
  ) {
    return {
      type: 'wake',
      confidence: 1.0,
      suggestedSpeech:
        'Hello! I am G Sense, your accessibility assistant. How can I help you? You can say: scan the area, navigate campus, or check environment changes.',
    };
  }

  // 2. Stop / Cancel
  if (
    text.includes('stop') ||
    text.includes('cancel') ||
    text.includes('close') ||
    text.includes('quiet') ||
    text === 'exit'
  ) {
    return {
      type: 'stop',
      confidence: 0.95,
      suggestedSpeech: 'Voice assistant closed.',
    };
  }

  // 3. Repeat
  if (
    text.includes('repeat') ||
    text.includes('say again') ||
    text.includes('what did you say') ||
    text.includes('speak again')
  ) {
    return {
      type: 'repeat',
      confidence: 0.95,
      suggestedSpeech: 'Repeating last announcement.',
    };
  }

  // 4. Help
  if (
    text.includes('help') ||
    text.includes('what can you do') ||
    text.includes('commands') ||
    text.includes('how does this work') ||
    text.includes('instructions')
  ) {
    return {
      type: 'help',
      confidence: 0.9,
      suggestedSpeech:
        'You can say: scan the area to analyze obstacles, navigate me through the area for step-by-step route directions, offline scan for zero network vision, or ask for the elevator, library, or restroom.',
    };
  }

  // 5. Offline Scan specifically
  if (
    text.includes('offline scan') ||
    text.includes('scan offline') ||
    text.includes('local scan') ||
    text.includes('offline camera') ||
    text.includes('llama scan')
  ) {
    return {
      type: 'offline_scan',
      confidence: 0.95,
      targetRoute: '/offline-scan',
      suggestedSpeech: 'Opening offline scan with local Llama 3.2 spatial perception.',
    };
  }

  // 6. Scan the area / Camera scanning
  if (
    text.includes('scan the area') ||
    text.includes('scan area') ||
    text.includes('scan environment') ||
    text.includes('start scanning') ||
    text.includes('start scan') ||
    text.includes('scan') ||
    text.includes('open camera') ||
    text.includes('camera') ||
    text.includes('look around') ||
    text.includes('what is in front of me') ||
    text.includes('whats in front of me') ||
    text.includes('look ahead') ||
    text.includes('check my path') ||
    text.includes('check path') ||
    text.includes('take a photo') ||
    text.includes('take a picture') ||
    text.includes('see ahead')
  ) {
    const target = isOffline ? '/offline-scan' : '/scan';
    const speech = isOffline
      ? 'Opening offline scan mode.'
      : 'Opening live environment scan.';
    return {
      type: 'scan',
      confidence: 0.95,
      targetRoute: target,
      suggestedSpeech: speech,
    };
  }

  // 7. Navigation / Navigate me through the area
  if (
    text.includes('navigate me through the area') ||
    text.includes('navigate through the area') ||
    text.includes('navigate me') ||
    text.includes('take me through the area') ||
    text.includes('start navigation') ||
    text.includes('navigate') ||
    text.includes('navigation') ||
    text.includes('open map') ||
    text.includes('show map') ||
    text.includes('map') ||
    text.includes('directions') ||
    text.includes('guide me') ||
    text.includes('guide') ||
    text.includes('find route') ||
    text.includes('campus route') ||
    text.includes('show path')
  ) {
    return {
      type: 'navigate',
      confidence: 0.95,
      targetRoute: '/map',
      suggestedSpeech: 'Opening campus navigation. Routing through your path.',
    };
  }

  // 8. What changed / Environment difference
  if (
    text.includes('what changed') ||
    text.includes('whats changed') ||
    text.includes('check changes') ||
    text.includes('changes') ||
    text.includes('compare') ||
    text.includes('difference') ||
    text.includes('history')
  ) {
    return {
      type: 'changes',
      confidence: 0.9,
      targetRoute: '/changes',
      suggestedSpeech: 'Opening change comparison. Reviewing environment differences.',
    };
  }

  // 9. Profile / Accessibility Settings
  if (
    text.includes('profile') ||
    text.includes('settings') ||
    text.includes('preferences') ||
    text.includes('accessibility settings') ||
    text.includes('model status')
  ) {
    return {
      type: 'profile',
      confidence: 0.9,
      targetRoute: '/profile',
      suggestedSpeech: 'Opening accessibility settings and model status.',
    };
  }

  // 10. Communicator (Speak For Me / Text/Draw to Speech for Mute Users)
  if (
    text.includes('speak for me') ||
    text.includes('text to speech') ||
    text.includes('draw to speech') ||
    text.includes('communicator') ||
    text.includes('i cannot speak') ||
    text.includes('mute') ||
    text.includes('dumb') ||
    text.includes('speak out loud') ||
    text.includes('say this out loud')
  ) {
    return {
      type: 'communicator',
      confidence: 0.95,
      targetRoute: '/communicator',
      suggestedSpeech: 'Opening G Sense Communicator to speak out loud for you.',
    };
  }

  // 11. Live Captions (Speech to Text for Deaf Users - SILENT)
  if (
    text.includes('live captions') ||
    text.includes('captions') ||
    text.includes('speech to text') ||
    text.includes('deaf') ||
    text.includes('transcribe') ||
    text.includes('subtitle') ||
    text.includes('subtitles') ||
    text.includes('listen for me') ||
    text.includes('hear for me')
  ) {
    return {
      type: 'captions',
      confidence: 0.95,
      targetRoute: '/communicator',
      suggestedSpeech: 'Opening Live Captions for deaf accessibility. Voice output is muted.',
    };
  }

  // 12. Switch Mode (Online / Offline)
  if (
    text.includes('go offline') ||
    text.includes('switch to offline') ||
    text.includes('turn on offline') ||
    text.includes('offline mode')
  ) {
    return {
      type: 'mode_offline',
      confidence: 0.95,
      suggestedSpeech: 'Switching to offline mode with local Llama 3.2.',
    };
  }
  if (
    text.includes('go online') ||
    text.includes('switch to online') ||
    text.includes('turn on online') ||
    text.includes('online mode')
  ) {
    return {
      type: 'mode_online',
      confidence: 0.95,
      suggestedSpeech: 'Switching to connected online mode.',
    };
  }

  // 11. Campus Spatial Queries (Elevator, Library, Restrooms, Ramps)
  if (
    text.includes('elevator') ||
    text.includes('lift') ||
    text.includes('library') ||
    text.includes('restroom') ||
    text.includes('toilet') ||
    text.includes('washroom') ||
    text.includes('block a') ||
    text.includes('block b') ||
    text.includes('ramp') ||
    text.includes('entrance') ||
    text.includes('where is') ||
    text.includes('take me to') ||
    text.includes('how do i get to')
  ) {
    const loc = queryCampusKnowledge(text);
    if (loc) {
      const answer = `${loc.name} is located at ${loc.block}, floor ${loc.floor}. ${loc.stairFreeRoute}`;
      return {
        type: 'campus_query',
        confidence: 0.9,
        extractedQuery: loc.name,
        targetRoute: '/map',
        suggestedSpeech: `${answer} Navigating to route map.`,
      };
    }

    // Default fallback elevator guidance
    if (text.includes('elevator') || text.includes('lift')) {
      return {
        type: 'campus_query',
        confidence: 0.9,
        targetRoute: '/map',
        suggestedSpeech:
          'The central elevator is located 15 meters down the main corridor on your left, equipped with Braille controls. Opening navigation map.',
      };
    }

    // Default fallback library guidance
    if (text.includes('library')) {
      return {
        type: 'campus_query',
        confidence: 0.9,
        targetRoute: '/map',
        suggestedSpeech:
          'The Main Library is located in Block A Concourse on the ground floor with step-free automatic sliding doors. Opening navigation map.',
      };
    }
  }

  // 12. Fallback to general query
  return {
    type: 'unknown',
    confidence: 0.4,
    extractedQuery: text,
    suggestedSpeech: `I heard: ${spokenText}. Try saying: scan the area, navigate campus, or ask where the elevator is.`,
  };
}

/**
 * Executes a parsed voice intent, playing vocal TTS feedback and navigating to the appropriate screen.
 */
export async function executeVoiceCommand({
  command,
  router,
  isOffline = false,
  setMode,
}: {
  command: string;
  router: { push: (route: any) => void; back?: () => void };
  isOffline?: boolean;
  setMode?: (mode: 'online' | 'offline') => Promise<void>;
}): Promise<{
  intent: VoiceIntentResult;
  executed: boolean;
}> {
  const intent = parseVoiceIntent(command, isOffline);

  // Stop current speech before announcing new action
  stopSpeech();

  if (intent.type === 'stop') {
    return { intent, executed: true };
  }

  if (intent.type === 'repeat') {
    repeatLastSpeech();
    return { intent, executed: true };
  }

  if (intent.type === 'mode_offline' && setMode) {
    await setMode('offline');
    await speakText(intent.suggestedSpeech, { force: true });
    return { intent, executed: true };
  }

  if (intent.type === 'mode_online' && setMode) {
    await setMode('online');
    await speakText(intent.suggestedSpeech, { force: true });
    return { intent, executed: true };
  }

  // Vocalize confirmation
  void speakText(intent.suggestedSpeech, { force: true });

  // Route if a targetRoute is defined
  if (intent.targetRoute) {
    // Slight pause to let audio announcement kick off smoothly
    setTimeout(() => {
      router.push(intent.targetRoute as any);
    }, 450);
  }

  return { intent, executed: true };
}
