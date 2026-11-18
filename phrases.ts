import type { ObjectCategory, ObjectPosition, SupportedLanguage } from '../types/vision';

export interface PhraseCatalog {
  appName: string;
  tagline: string;
  safetyNotice: string;
  status: {
    cameraInactive: string;
    requestingPermission: string;
    monitoring: string;
    paused: string;
    connectionUnavailable: string;
    demoActive: string;
    cameraDenied: string;
    cameraUnavailable: string;
    aiError: string;
    handsFreeVoiceOn: string;
    hearingYou: string;
  };
  controls: {
    startCamera: string;
    pauseAi: string;
    resumeAi: string;
    repeatLast: string;
    stopCamera: string;
    mute: string;
    unmute: string;
    settings: string;
    monitor: string;
    demoMode: string;
    exitDemo: string;
    testVoice: string;
    resetDefaults: string;
    askTapToSpeak: string;
    listeningNow: string;
    sendQuestion: string;
    downloadCodeFolder: string;
  };
  ui: {
    lastInstructionLabel: string;
    noInstructionYet: string;
    detectedSurroundings: string;
    noObjectsDetected: string;
    demoBannerTitle: string;
    demoBannerSubtitle: string;
    demoScenariosTitle: string;
    settingsTitle: string;
    speechSpeed: string;
    voiceSelection: string;
    defaultVoice: string;
    volume: string;
    detectionSensitivity: string;
    sensitivityLow: string;
    sensitivityMedium: string;
    sensitivityHigh: string;
    language: string;
    spokenLanguageLabel: string;
    spokenLanguageHint: string;
    vibration: string;
    vibrationOn: string;
    vibrationOff: string;
    analysisFrequency: string;
    freqFast: string;
    freqBalanced: string;
    freqBattery: string;
    shortcutsHint: string;
    askSectionTitle: string;
    askPlaceholder: string;
    askThinking: string;
    voiceNotSupported: string;
    downloadSectionTitle: string;
    downloadSectionHint: string;
    priorityLabels: Record<1 | 2 | 3 | 4 | 5, string>;
    positions: Record<ObjectPosition, string>;
  };
  spoken: {
    cameraStarted: string;
    cameraStopped: string;
    aiPaused: string;
    aiResumed: string;
    connectionUnavailable: string;
    noPreviousInstruction: string;
    closeWallAlert: string;
    downloadReady: string;
    clearPath: string;
    pathBlockedMoveRight: string;
    pathBlockedMoveLeft: string;
    pathTurnsLeft: string;
    pathTurnsRight: string;
    pathNarrow: string;
    overheadWarning: string;
    stairsAhead: string;
    vehicleApproachingRight: string;
    vehicleApproachingLeft: string;
    vehicleApproachingCenter: string;
    largeVehicleApproaching: string;
    cyclistApproaching: (pos: ObjectPosition) => string;
    obstacleMoveLeft: string;
    obstacleMoveRight: string;
    obstacleOnSide: (label: string, pos: ObjectPosition) => string;
    bagDirectlyAhead: string;
    doorwayTwoSteps: (pos: ObjectPosition) => string;
    personApproaching: (pos: ObjectPosition) => string;
    personAhead: (pos: ObjectPosition) => string;
    animalAhead: string;
    ordinaryObject: (label: string, pos: ObjectPosition) => string;
    uncertainCaution: string;
  };
  objectLabels: Record<ObjectCategory, string>;
}

export const PHRASES: Record<SupportedLanguage, PhraseCatalog> = {
  en: {
    appName: 'VisionGuide AI',
    tagline: 'Spoken safety, real-time visual guidance, and voice Q&A',
    safetyNotice:
      'VisionGuide AI is an assistive tool. It may miss objects or incorrectly estimate distance. Do not rely on it as your only method of navigation.',
    status: {
      cameraInactive: 'Assistant inactive',
      requestingPermission: 'Requesting camera & mic permission',
      monitoring: 'Assistant active',
      paused: 'Assistant paused',
      connectionUnavailable: 'AI connection unavailable.',
      demoActive: 'Demo Mode active — Simulated surroundings',
      cameraDenied: 'Camera permission denied. Allow camera access in browser settings.',
      cameraUnavailable: 'No rear or built-in camera found on this device.',
      aiError: 'AI analysis temporarily unavailable.',
      handsFreeVoiceOn: 'Voice listening on',
      hearingYou: 'Hearing you...',
    },
    controls: {
      startCamera: 'Start Assistant',
      pauseAi: 'Pause',
      resumeAi: 'Resume',
      repeatLast: 'Repeat Last',
      stopCamera: 'Stop Assistant',
      mute: 'Mute',
      unmute: 'Unmute',
      settings: 'Settings',
      monitor: 'Assistant',
      demoMode: 'Demo Mode',
      exitDemo: 'Exit Demo Mode',
      testVoice: 'Test Voice',
      resetDefaults: 'Reset Settings',
      askTapToSpeak: 'Talk to Assistant',
      listeningNow: 'Listening... tap to send',
      sendQuestion: 'Ask',
      downloadCodeFolder: 'Download Code Folder (.zip)',
    },
    ui: {
      lastInstructionLabel: 'Current Spoken Instruction',
      noInstructionYet: 'Tap Start Assistant to start the camera, AI guidance, and hands-free voice.',
      detectedSurroundings: 'Detected Surroundings',
      noObjectsDetected: 'No specific obstacles flagged in current view.',
      demoBannerTitle: 'Demo Mode — Simulated Surroundings',
      demoBannerSubtitle: 'Simulated camera detections for testing spoken guidance without a live camera feed.',
      demoScenariosTitle: 'Test Scenarios',
      settingsTitle: 'Voice & Detection Settings',
      speechSpeed: 'Speech Speed',
      voiceSelection: 'Voice Selection',
      defaultVoice: 'System Default Voice',
      volume: 'Speech Volume',
      detectionSensitivity: 'Detection Sensitivity',
      sensitivityLow: 'Low (Critical dangers only)',
      sensitivityMedium: 'Medium (Balanced navigation)',
      sensitivityHigh: 'High (Include nearby objects)',
      language: 'Interface Language',
      spokenLanguageLabel: 'AI Spoken Language (Any World Language)',
      spokenLanguageHint: 'Or just say "Speak in Spanish", "Talk in French", "Hindi", etc. in the Assistant.',
      vibration: 'Vibration Feedback',
      vibrationOn: 'On',
      vibrationOff: 'Off',
      analysisFrequency: 'AI Analysis Frequency',
      freqFast: 'Rapid (Continuous)',
      freqBalanced: 'Fast (0.8s)',
      freqBattery: 'Battery Saver (2.0s)',
      shortcutsHint: 'Keyboard: Space Start or Pause, R Repeat, S Stop, M Mute',
      askSectionTitle: 'Ask VisionGuide Anything',
      askPlaceholder: 'Ask anything, or say "Speak in Spanish"...',
      askThinking: 'Looking and replying...',
      voiceNotSupported: 'Voice recognition is unavailable in this browser. Type your question below.',
      downloadSectionTitle: 'Project Source Folder',
      downloadSectionHint: 'Download all web application files packaged in a single folder (.zip).',
      priorityLabels: {
        1: 'Immediate Danger',
        2: 'Nearby Obstacle',
        3: 'Navigation',
        4: 'Person or Animal',
        5: 'Object Detail',
      },
      positions: {
        left: 'Left',
        center: 'Center',
        right: 'Right',
      },
    },
    spoken: {
      cameraStarted: 'Assistant active. Camera and voice listening are on.',
      cameraStopped: 'Assistant stopped.',
      aiPaused: 'AI monitoring paused.',
      aiResumed: 'AI monitoring resumed.',
      connectionUnavailable: 'AI connection unavailable.',
      noPreviousInstruction: 'No instruction has been spoken yet.',
      closeWallAlert: 'Stop! Wall or solid obstacle right in front of you.',
      downloadReady: 'Download button ready. Starting download of the project code folder.',
      clearPath: 'The path ahead is clear. Walk straight.',
      pathBlockedMoveRight: 'The path ahead is blocked. Move two steps to your right.',
      pathBlockedMoveLeft: 'The path ahead is blocked. Move two steps to your left.',
      pathTurnsLeft: 'The path turns left. Turn left and continue.',
      pathTurnsRight: 'The path turns right. Turn right and continue.',
      pathNarrow: 'The path ahead is narrow. Walk slowly.',
      overheadWarning: 'Warning. Low obstacle above you. Duck.',
      stairsAhead: 'Caution. Stairs ahead. Slow down and check your footing.',
      vehicleApproachingRight: 'Warning. Vehicle approaching from your right. Stop and move left.',
      vehicleApproachingLeft: 'Warning. Vehicle approaching from your left. Stop and move right.',
      vehicleApproachingCenter: 'Warning. Vehicle ahead. Stop and move away from the road.',
      largeVehicleApproaching: 'Warning. Large vehicle approaching. Stop and move away from the road.',
      cyclistApproaching: (pos) =>
        pos === 'center'
          ? 'Warning. Cyclist approaching ahead. Stop.'
          : `Warning. Cyclist approaching from your ${pos}. Stay clear.`,
      obstacleMoveLeft: 'Obstacle ahead. Move slightly to your left.',
      obstacleMoveRight: 'Obstacle ahead. Move slightly to your right.',
      obstacleOnSide: (label, pos) =>
        pos === 'center'
          ? `${label} directly ahead. Slow down.`
          : `${label} on your ${pos}.`,
      bagDirectlyAhead: 'A bag is directly in front of you.',
      doorwayTwoSteps: (pos) =>
        pos === 'center'
          ? 'Doorway approximately two steps ahead.'
          : `Doorway on your ${pos}.`,
      personApproaching: (pos) =>
        pos === 'center'
          ? 'A person is approaching directly ahead.'
          : `A person is approaching from your ${pos}.`,
      personAhead: (pos) =>
        pos === 'center' ? 'Person ahead.' : `Person on your ${pos}.`,
      animalAhead: 'Animal ahead. Stop and wait.',
      ordinaryObject: (label, pos) =>
        pos === 'center' ? `${label} in front of you.` : `${label} to your ${pos}.`,
      uncertainCaution: 'View unclear. Proceed carefully.',
    },
    objectLabels: {
      person: 'Person',
      car: 'Car',
      truck: 'Truck',
      motorcycle: 'Motorcycle',
      bicycle: 'Bicycle',
      animal: 'Animal',
      door: 'Doorway',
      stairs: 'Stairs',
      chair: 'Chair',
      table: 'Table',
      bag: 'Bag',
      backpack: 'Backpack',
      bottle: 'Bottle',
      phone: 'Phone',
      keyboard: 'Keyboard',
      wall: 'Wall',
      pole: 'Pole',
      road_obstacle: 'Obstacle',
      overhead_obstacle: 'Low overhead obstacle',
      pathway: 'Pathway',
    },
  },
  hi: {
    appName: 'VisionGuide AI',
    tagline: 'सुरक्षित चलने और हर सवाल के जवाब के लिए आपका बोलता हुआ साथी',
    safetyNotice:
      'VisionGuide AI एक सहायक उपकरण है। यह कुछ वस्तुओं को न देख पाए या दूरी का गलत अनुमान लगा सकता है। केवल इसी पर निर्भर न रहें।',
    status: {
      cameraInactive: 'सहायक बंद है',
      requestingPermission: 'कैमरा और माइक अनुमति मांगी जा रही है',
      monitoring: 'सहायक सक्रिय है',
      paused: 'सहायक रुका हुआ है',
      connectionUnavailable: 'AI connection unavailable.',
      demoActive: 'डेमो मोड सक्रिय — नकली दृश्य',
      cameraDenied: 'कैमरा अनुमति अस्वीकार की गई। कृपया ब्राउज़र सेटिंग्स में अनुमति दें।',
      cameraUnavailable: 'इस डिवाइस पर कैमरा उपलब्ध नहीं है।',
      aiError: 'एआई विश्लेषण अस्थायी रूप से अनुपलब्ध है।',
      handsFreeVoiceOn: 'वॉइस सुनना चालू है',
      hearingYou: 'आपकी आवाज़ सुन रहा हूं...',
    },
    controls: {
      startCamera: 'सहायक शुरू करें',
      pauseAi: 'रोकें',
      resumeAi: 'फिर शुरू करें',
      repeatLast: 'आखिरी बात दोहराएं',
      stopCamera: 'सहायक बंद करें',
      mute: 'म्यूट',
      unmute: 'आवाज़ चालू करें',
      settings: 'सेटिंग्स',
      monitor: 'सहायक',
      demoMode: 'डेमो मोड',
      exitDemo: 'डेमो मोड बंद करें',
      testVoice: 'आवाज़ जांचें',
      resetDefaults: 'सेटिंग्स रीसेट करें',
      askTapToSpeak: 'सहायक से बात करें',
      listeningNow: 'सुन रहा हूं... अभी बोलें',
      sendQuestion: 'पूछें',
      downloadCodeFolder: 'कोड फ़ोल्डर डाउनलोड करें (.zip)',
    },
    ui: {
      lastInstructionLabel: 'वर्तमान बोला गया निर्देश',
      noInstructionYet: 'कैमरा, एआई मार्गदर्शन और आवाज़ शुरू करने के लिए सहायक शुरू करें दबाएं।',
      detectedSurroundings: 'पहचानी गई वस्तुएं',
      noObjectsDetected: 'वर्तमान दृश्य में कोई विशेष बाधा नहीं दिखी।',
      demoBannerTitle: 'डेमो मोड — नकली दृश्य',
      demoBannerSubtitle: 'लाइव कैमरा के बिना बोलकर मार्गदर्शन जांचने के लिए नकली दृश्य।',
      demoScenariosTitle: 'डेमो परिदृश्य',
      settingsTitle: 'आवाज़ और पहचान सेटिंग्स',
      speechSpeed: 'बोलने की गति',
      voiceSelection: 'आवाज़ चुनें',
      defaultVoice: 'सिस्टम डिफ़ॉल्ट आवाज़',
      volume: 'आवाज़ का स्तर',
      detectionSensitivity: 'पहचान संवेदनशीलता',
      sensitivityLow: 'कम (केवल गंभीर खतरे)',
      sensitivityMedium: 'मध्यम (संतुलित मार्गदर्शन)',
      sensitivityHigh: 'अधिक (आसपास की वस्तुएं भी)',
      language: 'इंटरफ़ेस भाषा',
      spokenLanguageLabel: 'एआई बोलने की भाषा (दुनिया की कोई भी भाषा)',
      spokenLanguageHint: 'आप माइक से किसी भी भाषा का नाम बोल सकते हैं जैसे "Speak in French" या "Spanish"।',
      vibration: 'वाइब्रेशन फीडबैक',
      vibrationOn: 'चालू',
      vibrationOff: 'बंद',
      analysisFrequency: 'एआई जांच अंतराल',
      freqFast: 'तेज़ (लगातार)',
      freqBalanced: 'संतुलित (0.8s)',
      freqBattery: 'बैटरी सेवर (2.0s)',
      shortcutsHint: 'कीबोर्ड: Space शुरू/रोकें, R दोहराएं, S बंद करें, M म्यूट',
      askSectionTitle: 'अपने सहायक दोस्त से पूछें',
      askPlaceholder: 'कुछ भी पूछें, या भाषा बदलें जैसे "Speak in Spanish"...',
      askThinking: 'देख रहा हूं और जवाब दे रहा हूं...',
      voiceNotSupported: 'इस ब्राउज़र में वॉइस इनपुट उपलब्ध नहीं है। नीचे टाइप करें।',
      downloadSectionTitle: 'प्रोजेक्ट सोर्स फ़ोल्डर',
      downloadSectionHint: 'इस वेब ऐप की सभी फाइलें एक ज़िप फ़ोल्डर में डाउनलोड करें।',
      priorityLabels: {
        1: 'तत्काल खतरा',
        2: 'नज़दीकी बाधा',
        3: 'रास्ता निर्देश',
        4: 'व्यक्ति या जानवर',
        5: 'अन्य वस्तु',
      },
      positions: {
        left: 'बाएं',
        center: 'सामने',
        right: 'दाएं',
      },
    },
    spoken: {
      cameraStarted: 'सहायक चालू है। कैमरा और आपकी आवाज़ सुनना सक्रिय हैं।',
      cameraStopped: 'सहायक बंद हो गया है।',
      aiPaused: 'एआई निगरानी रोकी गई है।',
      aiResumed: 'एआई निगरानी फिर से शुरू हो गई है।',
      connectionUnavailable: 'इंटरनेट या एआई कनेक्शन उपलब्ध नहीं है।',
      noPreviousInstruction: 'अभी तक कोई निर्देश नहीं बोला गया है।',
      closeWallAlert: 'रुकें! आपके बिल्कुल सामने दीवार या कोई ठोस बाधा है।',
      downloadReady: 'डाउनलोड बटन तैयार है। प्रोजेक्ट कोड फ़ोल्डर डाउनलोड हो रहा है।',
      clearPath: 'आगे का रास्ता साफ है। सीधे चलें।',
      pathBlockedMoveRight: 'आगे का रास्ता बंद है। दो कदम अपने दाएं हटें।',
      pathBlockedMoveLeft: 'आगे का रास्ता बंद है। दो कदम अपने बाएं हटें।',
      pathTurnsLeft: 'रास्ता बाएं मुड़ता है। बाएं मुड़ें और आगे बढ़ें।',
      pathTurnsRight: 'रास्ता दाएं मुड़ता है। दाएं मुड़ें और आगे बढ़ें।',
      pathNarrow: 'आगे का रास्ता संकरा है। धीरे चलें।',
      overheadWarning: 'सावधान। आपके ऊपर नीचे कोई बाधा है। झुकें।',
      stairsAhead: 'सावधान। आगे सीढ़ियां हैं। धीरे चलें और संभलकर कदम रखें।',
      vehicleApproachingRight: 'सावधान। आपके दाएं से वाहन आ रहा है। रुकें और बाएं हटें।',
      vehicleApproachingLeft: 'सावधान। आपके बाएं से वाहन आ रहा है। रुकें और दाएं हटें।',
      vehicleApproachingCenter: 'सावधान। सामने वाहन आ रहा है। रुकें और सड़क से दूर हटें।',
      largeVehicleApproaching: 'सावधान। बड़ा वाहन आ रहा है। रुकें और सड़क से दूर हटें।',
      cyclistApproaching: (pos) =>
        pos === 'center'
          ? 'सावधान। सामने से साइकिल आ रही है। रुकें।'
          : `सावधान। आपके ${pos === 'left' ? 'बाएं' : 'दाएं'} से साइकिल आ रही है। दूर रहें।`,
      obstacleMoveLeft: 'आगे बाधा है। थोड़ा बाएं हटें।',
      obstacleMoveRight: 'आगे बाधा है। थोड़ा दाएं हटें।',
      obstacleOnSide: (label, pos) =>
        pos === 'center'
          ? `बिल्कुल सामने ${label} है। धीरे चलें।`
          : `आपके ${pos === 'left' ? 'बाएं' : 'दाएं'} तरफ ${label} है।`,
      bagDirectlyAhead: 'आपके बिल्कुल सामने एक बैग रखा है।',
      doorwayTwoSteps: (pos) =>
        pos === 'center'
          ? 'लगभग दो कदम आगे दरवाज़ा है।'
          : `आपके ${pos === 'left' ? 'बाएं' : 'दाएं'} तरफ दरवाज़ा है।`,
      personApproaching: (pos) =>
        pos === 'center'
          ? 'एक व्यक्ति सामने से आ रहा है।'
          : `एक व्यक्ति आपके ${pos === 'left' ? 'बाएं' : 'दाएं'} से आ रहा है।`,
      personAhead: (pos) =>
        pos === 'center' ? 'सामने कोई व्यक्ति है।' : `आपके ${pos === 'left' ? 'बाएं' : 'दाएं'} कोई व्यक्ति है।`,
      animalAhead: 'आगे जानवर है। रुकें और प्रतीक्षा करें।',
      ordinaryObject: (label, pos) =>
        pos === 'center' ? `आपके सामने ${label} है।` : `आपके ${pos === 'left' ? 'बाएं' : 'दाएं'} ${label} है।`,
      uncertainCaution: 'दृश्य स्पष्ट नहीं है। सावधानी से आगे बढ़ें।',
    },
    objectLabels: {
      person: 'व्यक्ति',
      car: 'कार',
      truck: 'ट्रक',
      motorcycle: 'मोटरसाइकिल',
      bicycle: 'साइकिल',
      animal: 'जानवर',
      door: 'दरवाज़ा',
      stairs: 'सीढ़ियां',
      chair: 'कुर्सी',
      table: 'मेज़',
      bag: 'बैग',
      backpack: 'बैकपैक',
      bottle: 'बोतल',
      phone: 'फ़ोन',
      keyboard: 'कीबोर्ड',
      wall: 'दीवार',
      pole: 'खंभा',
      road_obstacle: 'बाधा',
      overhead_obstacle: 'ऊपरी बाधा',
      pathway: 'रास्ता',
    },
  },
};

export function getPhrases(lang: SupportedLanguage): PhraseCatalog {
  return PHRASES[lang] ?? PHRASES.en;
}
