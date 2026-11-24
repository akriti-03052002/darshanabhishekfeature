import type { RitualGestureId } from '../logic/gestureEngine';

export type Language = 'hi' | 'en';
export type ViewMode = 'normal' | 'vr';
export type TraditionGroup = 'all' | 'sanatan' | 'dharmic' | 'abrahamic';

export type ExperienceId =
  | 'shiva'
  | 'krishna'
  | 'balaji'
  | 'durga'
  | 'buddha'
  | 'sikh'
  | 'christian'
  | 'islamic'
  | 'mahavir';

export type InteractionKind =
  | 'pour-water'
  | 'pour-milk'
  | 'place-item'
  | 'light-flame'
  | 'aarti-wave'
  | 'singing-bowl'
  | 'chaur-seva'
  | 'tasbih-count'
  | 'guided-reflection';

export interface RitualGestureMeta {
  gestureId: RitualGestureId;
  hint: Record<Language, string>;
  repeatable?: boolean;
}

export interface RitualObjectSpec {
  id: string;
  stepIndex: number;
  kind: InteractionKind;
  gripStyle: 'kalash' | 'pinch' | 'cradle' | 'handle' | 'tasbih' | 'wick';
  gesture?: RitualGestureMeta;
  label: Record<Language, string>;
  instructionHold: Record<Language, string>;
  instructionAction: Record<Language, string>;
  completedText: Record<Language, string>;
  trayPosition: [number, number, number];
  targetPosition: [number, number, number];
  accentHex: string;
}

export interface ExperienceSpec {
  id: ExperienceId;
  traditionGroup: Exclude<TraditionGroup, 'all'>;
  traditionLabel: Record<Language, string>;
  title: Record<Language, string>;
  subtitle: Record<Language, string>;
  description: Record<Language, string>;
  imageUrl: string;
  focalNote: Record<Language, string>;
  audioProfile: 'sanatan-shiva' | 'sanatan-flute' | 'sanatan-temple' | 'buddhist' | 'sikh' | 'christian' | 'islamic' | 'jain';
  ambientBgHex: string;
  keyLightHex: string;
  rimLightHex: string;
  hasSacredThread: boolean;
  steps: RitualObjectSpec[];
}

export const EXPERIENCES: ExperienceSpec[] = [
  {
    id: 'shiva',
    traditionGroup: 'sanatan',
    traditionLabel: { hi: 'सनातन धर्म', en: 'Sanatan Dharma' },
    title: { hi: 'भगवान शिव — शिव अभिषेक', en: 'Bhagwan Shiva — Shiv Abhishek' },
    subtitle: { hi: 'साक्षात प्रथम-पुरुष जलाभिषेक एवं आरती', en: 'First-Person Jalabhishek, Milk & Aarti' },
    description: {
      hi: 'अपने हाथों से पीतल का कलश उठाकर शिवलिंग पर निरंतर जल और दुग्ध धारा अर्पित करें, बिल्व पत्र चढ़ाएं और आरती करें।',
      en: 'Lift the brass Kalash with your own hands to pour continuous holy water and milk onto the Shiva Lingam, offer Bilva leaves, flowers, and perform Aarti.'
    },
    imageUrl: '/src/assets/images/shiva_abhishek_card_1794915122107.jpg',
    focalNote: {
      hi: 'गर्भगृह वेदी पर प्रतिष्ठित कृष्ण पाषाण शिवलिंग व जलहरी',
      en: 'Black basalt Shiva Lingam seated on carved Jalahari drainage pedestal'
    },
    audioProfile: 'sanatan-shiva',
    ambientBgHex: '#15100c',
    keyLightHex: '#ffcf86',
    rimLightHex: '#8da4c8',
    hasSacredThread: true,
    steps: [
      {
        id: 'kalash-water',
        stepIndex: 0,
        kind: 'pour-water',
        gripStyle: 'kalash',
        label: { hi: 'जल कलश', en: 'Water Kalash' },
        instructionHold: { hi: 'जल कलश उठाइए', en: 'Pick up the Water Kalash' },
        instructionAction: {
          hi: 'शिवलिंग के ऊपर लाकर जल अर्पित करने के लिए धीरे से झुकाएं',
          en: 'Move above the Shiva Lingam and tilt gently to pour continuous water'
        },
        completedText: { hi: 'जलाभिषेक पूर्ण हुआ', en: 'Jalabhishek completed' },
        trayPosition: [-0.62, 0.14, 0.56],
        targetPosition: [0.0, 0.78, -0.05],
        accentHex: '#d4a348'
      },
      {
        id: 'kalash-milk',
        stepIndex: 1,
        kind: 'pour-milk',
        gripStyle: 'kalash',
        label: { hi: 'दुग्ध पात्र', en: 'Milk Vessel' },
        instructionHold: { hi: 'दुग्ध पात्र उठाइए', en: 'Pick up the Milk Vessel' },
        instructionAction: {
          hi: 'शिवलिंग पर दुग्धाभिषेक के लिए पात्र को धीरे से झुकाएं',
          en: 'Hold above the Lingam crown and tilt to pour sacred milk'
        },
        completedText: { hi: 'दुग्धाभिषेक पूर्ण हुआ', en: 'Dugdhabhishek completed' },
        trayPosition: [-0.32, 0.13, 0.62],
        targetPosition: [0.0, 0.78, -0.05],
        accentHex: '#e8e2d5'
      },
      {
        id: 'bilva-patra',
        stepIndex: 2,
        kind: 'place-item',
        gripStyle: 'pinch',
        label: { hi: 'बिल्व पत्र', en: 'Bilva Patra' },
        instructionHold: { hi: 'बिल्व पत्र चुनें', en: 'Pick up Bilva leaves' },
        instructionAction: {
          hi: 'त्रिदल बिल्व पत्र शिवलिंग के शिखर पर अर्पित करें',
          en: 'Move forward and place the sacred Bilva leaves atop the Lingam'
        },
        completedText: { hi: 'बिल्व पत्र अर्पित', en: 'Bilva Patra offered' },
        trayPosition: [0.36, 0.08, 0.58],
        targetPosition: [0.0, 0.585, -0.05],
        accentHex: '#4e8a45'
      },
      {
        id: 'pushpa-shiva',
        stepIndex: 3,
        kind: 'place-item',
        gripStyle: 'pinch',
        label: { hi: 'पुष्प', en: 'Flowers' },
        instructionHold: { hi: 'ताजे पुष्प लें', en: 'Hold the fresh flowers' },
        instructionAction: {
          hi: 'पुष्प अर्पित करें — वेदी पर कोमलता से रखें',
          en: 'Place the blossoms gently onto the Lingam base'
        },
        completedText: { hi: 'पुष्प अर्पित हुए', en: 'Flowers offered' },
        trayPosition: [0.58, 0.08, 0.54],
        targetPosition: [0.0, 0.25, 0.14],
        accentHex: '#f59e0b'
      },
      {
        id: 'bhog-shiva',
        stepIndex: 4,
        kind: 'place-item',
        gripStyle: 'cradle',
        label: { hi: 'फल भोग', en: 'Fruit Bhog' },
        instructionHold: { hi: 'फल नैवेद्य थाल लें', en: 'Lift the fruit Bhog platter' },
        instructionAction: {
          hi: 'वेदी के सम्मुख भोग अर्पित करें',
          en: 'Place the fruit offering respectfully before the Lingam'
        },
        completedText: { hi: 'भोग अर्पित हुआ', en: 'Bhog offered' },
        trayPosition: [-0.56, 0.09, 0.34],
        targetPosition: [-0.24, 0.11, 0.28],
        accentHex: '#dc5b3a'
      },
      {
        id: 'diya-shiva',
        stepIndex: 5,
        kind: 'light-flame',
        gripStyle: 'wick',
        label: { hi: 'दीपक प्रज्वलन', en: 'Light Diya' },
        instructionHold: { hi: 'घी का दीपक प्रज्वलित करें', en: 'Touch the wick to light the Diya' },
        instructionAction: {
          hi: 'दीप ज्योति प्रज्वलित हो रही है',
          en: 'Igniting the sacred ghee Diya flame'
        },
        completedText: { hi: 'दीपक प्रज्वलित हुआ', en: 'Diya illuminated' },
        trayPosition: [0.24, 0.08, 0.38],
        targetPosition: [0.24, 0.14, 0.38],
        accentHex: '#ffb347'
      },
      {
        id: 'aarti-shiva',
        stepIndex: 6,
        kind: 'aarti-wave',
        gripStyle: 'cradle',
        label: { hi: 'आरती थाल', en: 'Aarti Thali' },
        instructionHold: { hi: 'आरती थाल उठाइए', en: 'Hold the Aarti plate' },
        instructionAction: {
          hi: 'अब शिवलिंग के समक्ष गोलाकार आरती करें',
          en: 'Move the glowing Aarti plate in circles before Bhagwan Shiva'
        },
        completedText: { hi: 'शिव आरती संपन्न', en: 'Shiva Aarti complete' },
        trayPosition: [0.56, 0.09, 0.34],
        targetPosition: [0.0, 0.45, 0.28],
        accentHex: '#fbbf24'
      }
    ]
  },
  {
    id: 'krishna',
    traditionGroup: 'sanatan',
    traditionLabel: { hi: 'सनातन धर्म', en: 'Sanatan Dharma' },
    title: { hi: 'श्री कृष्ण — माखन मिश्री सेवा', en: 'Shri Krishna — Makhan Mishri Seva' },
    subtitle: { hi: 'माखन मिश्री, तुलसी दल एवं बाल गोपाल आरती', en: 'Makhan Mishri Bowl, Tulsi & Evening Aarti' },
    description: {
      hi: 'चांदी के पात्र में ताजा माखन-मिश्री उठाएं, पवित्र तुलसी दल व मोगरा पुष्प अर्पित करें और श्री कृष्ण की आरती उतारें।',
      en: 'Offer fresh Makhan Mishri in a hammered silver bowl, place sacred Tulsi leaves, jasmine blossoms, light the diya, and perform Aarti.'
    },
    imageUrl: '/src/assets/images/krishna_makhan_card_1794915123507.jpg',
    focalNote: {
      hi: 'मोरपंख, बांसुरी और सुसज्जित श्री कृष्ण आराधना वेदी',
      en: 'Sacred Shri Krishna altar with bamboo flute & peacock crown'
    },
    audioProfile: 'sanatan-flute',
    ambientBgHex: '#171117',
    keyLightHex: '#ffd79a',
    rimLightHex: '#8db2d9',
    hasSacredThread: true,
    steps: [
      {
        id: 'makhan-bowl',
        stepIndex: 0,
        kind: 'place-item',
        gripStyle: 'cradle',
        label: { hi: 'माखन मिश्री', en: 'Makhan Mishri' },
        instructionHold: { hi: 'माखन मिश्री कटोरा उठाएं', en: 'Pick up the Makhan Mishri bowl' },
        instructionAction: {
          hi: 'ठाकुरजी के सम्मुख प्रेमपूर्वक माखन भोग रखें',
          en: 'Move forward and place the Makhan Mishri bowl before Shri Krishna'
        },
        completedText: { hi: 'माखन मिश्री भोग अर्पित', en: 'Makhan Mishri offered' },
        trayPosition: [-0.46, 0.1, 0.56],
        targetPosition: [0.0, 0.12, 0.18],
        accentHex: '#faf4e8'
      },
      {
        id: 'tulsi-leaves',
        stepIndex: 1,
        kind: 'place-item',
        gripStyle: 'pinch',
        label: { hi: 'तुलसी दल', en: 'Tulsi Leaves' },
        instructionHold: { hi: 'तुलसी दल चुनें', en: 'Pick up sacred Tulsi leaves' },
        instructionAction: {
          hi: 'माखन मिश्री व वेदी पर तुलसी दल अर्पित करें',
          en: 'Place Tulsi leaves gently upon the Makhan offering'
        },
        completedText: { hi: 'तुलसी दल अर्पित', en: 'Tulsi leaves placed' },
        trayPosition: [-0.15, 0.08, 0.58],
        targetPosition: [0.0, 0.21, 0.18],
        accentHex: '#3f8a4c'
      },
      {
        id: 'krishna-pushpa',
        stepIndex: 2,
        kind: 'place-item',
        gripStyle: 'pinch',
        label: { hi: 'पुष्प अर्पण', en: 'Jasmine Flowers' },
        instructionHold: { hi: 'मोगरा व गेंदा पुष्प लें', en: 'Hold the jasmine blossoms' },
        instructionAction: {
          hi: 'श्री कृष्ण के चरणों में पुष्प अर्पित करें',
          en: 'Place the fragrant blossoms before the altar'
        },
        completedText: { hi: 'पुष्प अर्पित हुए', en: 'Flowers offered' },
        trayPosition: [0.22, 0.08, 0.58],
        targetPosition: [-0.18, 0.12, 0.14],
        accentHex: '#f5f0dc'
      },
      {
        id: 'krishna-diya',
        stepIndex: 3,
        kind: 'light-flame',
        gripStyle: 'wick',
        label: { hi: 'दीपक जलाएं', en: 'Light Diya' },
        instructionHold: { hi: 'घी दीपक प्रज्वलित करें', en: 'Tap to light the brass Diya' },
        instructionAction: {
          hi: 'दीप ज्योति प्रज्वलित हो रही है',
          en: 'Lighting the golden ghee Diya'
        },
        completedText: { hi: 'दीपक प्रज्वलित', en: 'Diya lit' },
        trayPosition: [0.35, 0.08, 0.38],
        targetPosition: [0.35, 0.14, 0.38],
        accentHex: '#ffb347'
      },
      {
        id: 'krishna-aarti',
        stepIndex: 4,
        kind: 'aarti-wave',
        gripStyle: 'cradle',
        label: { hi: 'आरती थाल', en: 'Aarti Thali' },
        instructionHold: { hi: 'आरती थाल उठाएं', en: 'Hold the Aarti plate' },
        instructionAction: {
          hi: 'गोलाकार घुमाते हुए श्री कृष्ण आरती करें',
          en: 'Move the Aarti plate smoothly in circles'
        },
        completedText: { hi: 'श्री कृष्ण आरती संपन्न', en: 'Krishna Aarti complete' },
        trayPosition: [0.56, 0.09, 0.45],
        targetPosition: [0.0, 0.46, 0.24],
        accentHex: '#fbbf24'
      }
    ]
  },
  {
    id: 'balaji',
    traditionGroup: 'sanatan',
    traditionLabel: { hi: 'सनातन धर्म', en: 'Sanatan Dharma' },
    title: { hi: 'श्री सालासर बालाजी', en: 'Shri Salasar Balaji' },
    subtitle: { hi: 'सिंदूर-चोला, मोतीचूर लड्डू एवं हनुमान आरती', en: 'Sindoor, Chola Offering & Motichoor Laddoo' },
    description: {
      hi: 'परंपरागत विधि से पवित्र सिंदूर व सिंदूरी चोला अर्पण करें, मोतीचूर लड्डू भोग लगाएं और बालाजी की आरती करें।',
      en: 'Offer sacred Sindoor & traditional Chola drape respectfully at the altar, present Motichoor Laddoo bhog, flowers, and perform Aarti.'
    },
    imageUrl: '/src/assets/images/salasar_balaji_card_1794915123986.jpg',
    focalNote: {
      hi: 'भक्तिमय सिंदूरी श्री सालासर बालाजी वेदी',
      en: 'Reverent Salasar Balaji sanctum altar'
    },
    audioProfile: 'sanatan-temple',
    ambientBgHex: '#1c100a',
    keyLightHex: '#ffbe70',
    rimLightHex: '#e67e3c',
    hasSacredThread: true,
    steps: [
      {
        id: 'balaji-sindoor',
        stepIndex: 0,
        kind: 'place-item',
        gripStyle: 'cradle',
        label: { hi: 'सिंदूर व चोला', en: 'Sindoor & Chola' },
        instructionHold: { hi: 'सिंदूर-चोला थाल उठाएं', en: 'Lift the Sindoor & Chola offering' },
        instructionAction: {
          hi: 'वेदी पर सम्मानपूर्वक सिंदूर व चोला अर्पित करें',
          en: 'Place the sacred Sindoor & Chola respectfully at the altar'
        },
        completedText: { hi: 'सिंदूर व चोला अर्पित', en: 'Sindoor & Chola offered' },
        trayPosition: [-0.48, 0.09, 0.56],
        targetPosition: [-0.14, 0.13, 0.18],
        accentHex: '#ea580c'
      },
      {
        id: 'balaji-laddoo',
        stepIndex: 1,
        kind: 'place-item',
        gripStyle: 'cradle',
        label: { hi: 'मोतीचूर लड्डू', en: 'Motichoor Laddoo' },
        instructionHold: { hi: 'मोतीचूर लड्डू थाल उठाएं', en: 'Lift the Motichoor Laddoo plate' },
        instructionAction: {
          hi: 'बालाजी के सम्मुख लड्डू भोग अर्पित करें',
          en: 'Place the Motichoor Laddoo bhog before Shri Balaji'
        },
        completedText: { hi: 'लड्डू भोग अर्पित', en: 'Laddoo Bhog offered' },
        trayPosition: [-0.1, 0.09, 0.6],
        targetPosition: [0.16, 0.13, 0.18],
        accentHex: '#f59e0b'
      },
      {
        id: 'balaji-flowers',
        stepIndex: 2,
        kind: 'place-item',
        gripStyle: 'pinch',
        label: { hi: 'गेंदा पुष्प', en: 'Marigold Flowers' },
        instructionHold: { hi: 'गेंदा पुष्प लें', en: 'Pick up marigold flowers' },
        instructionAction: {
          hi: 'वेदी पर ताजे गेंदा पुष्प अर्पित करें',
          en: 'Place the fresh marigold blossoms before the shrine'
        },
        completedText: { hi: 'पुष्प अर्पित हुए', en: 'Marigolds offered' },
        trayPosition: [0.28, 0.08, 0.58],
        targetPosition: [0.0, 0.14, 0.24],
        accentHex: '#f97316'
      },
      {
        id: 'balaji-diya',
        stepIndex: 3,
        kind: 'light-flame',
        gripStyle: 'wick',
        label: { hi: 'दीपक प्रज्वलन', en: 'Light Diya' },
        instructionHold: { hi: 'दीपक प्रज्वलित करें', en: 'Tap to light the ghee Diya' },
        instructionAction: {
          hi: 'दीपक प्रज्वलित हो रहा है',
          en: 'Igniting the sacred lamp'
        },
        completedText: { hi: 'दीपक प्रज्वलित', en: 'Diya lit' },
        trayPosition: [0.32, 0.08, 0.36],
        targetPosition: [0.32, 0.14, 0.36],
        accentHex: '#ffb347'
      },
      {
        id: 'balaji-aarti',
        stepIndex: 4,
        kind: 'aarti-wave',
        gripStyle: 'cradle',
        label: { hi: 'आरती थाल', en: 'Aarti Thali' },
        instructionHold: { hi: 'आरती थाल उठाएं', en: 'Hold the Aarti plate' },
        instructionAction: {
          hi: 'हनुमान जी की आरती उतारें',
          en: 'Move the Aarti plate in circles before Shri Balaji'
        },
        completedText: { hi: 'बालाजी आरती संपन्न', en: 'Balaji Aarti complete' },
        trayPosition: [0.56, 0.09, 0.48],
        targetPosition: [0.0, 0.45, 0.25],
        accentHex: '#fbbf24'
      }
    ]
  },
  {
    id: 'durga',
    traditionGroup: 'sanatan',
    traditionLabel: { hi: 'सनातन धर्म', en: 'Sanatan Dharma' },
    title: { hi: 'माँ दुर्गा', en: 'Maa Durga' },
    subtitle: { hi: 'चुनरी, गुड़हल पुष्प, चंदन एवं शक्ति आरती', en: 'Red Chunari, Hibiscus, Chandan & Aarti' },
    description: {
      hi: 'माँ के चरणों में लाल चुनरी, चंदन-कुमकुम, रक्त गुड़हल पुष्प और अनार-फल अर्पित करें तथा पंच-आरती करें।',
      en: 'Offer the crimson embroidered Chunari, sandalwood Chandan, red hibiscus blossoms, fresh fruits, and perform Aarti before Maa Durga.'
    },
    imageUrl: '/src/assets/images/maa_durga_card_1794915124368.jpg',
    focalNote: {
      hi: 'रक्त वस्त्र एवं ज्योतिमय माँ दुर्गा वेदी',
      en: 'Crimson & gold Maa Durga devotional shrine'
    },
    audioProfile: 'sanatan-temple',
    ambientBgHex: '#1b0b0e',
    keyLightHex: '#ffc788',
    rimLightHex: '#e14d57',
    hasSacredThread: true,
    steps: [
      {
        id: 'durga-chunari',
        stepIndex: 0,
        kind: 'place-item',
        gripStyle: 'cradle',
        label: { hi: 'लाल चुनरी', en: 'Red Chunari' },
        instructionHold: { hi: 'लाल चुनरी उठाएं', en: 'Lift the red Chunari' },
        instructionAction: {
          hi: 'माँ के आसन पर आदरपूर्वक चुनरी अर्पित करें',
          en: 'Drape the red Chunari respectfully onto the altar'
        },
        completedText: { hi: 'चुनरी अर्पित हुई', en: 'Chunari offered' },
        trayPosition: [-0.52, 0.09, 0.54],
        targetPosition: [0.0, 0.14, 0.12],
        accentHex: '#dc2626'
      },
      {
        id: 'durga-chandan',
        stepIndex: 1,
        kind: 'place-item',
        gripStyle: 'pinch',
        label: { hi: 'चंदन पात्र', en: 'Chandan & Kumkum' },
        instructionHold: { hi: 'चंदन पात्र लें', en: 'Hold the Chandan bowl' },
        instructionAction: {
          hi: 'परंपरागत रूप से वेदी पर चंदन अर्पित करें',
          en: 'Place the Chandan bowl respectfully before Maa Durga'
        },
        completedText: { hi: 'चंदन अर्पित हुआ', en: 'Chandan offered' },
        trayPosition: [-0.2, 0.08, 0.58],
        targetPosition: [-0.2, 0.12, 0.22],
        accentHex: '#eab308'
      },
      {
        id: 'durga-hibiscus',
        stepIndex: 2,
        kind: 'place-item',
        gripStyle: 'pinch',
        label: { hi: 'गुड़हल पुष्प', en: 'Red Hibiscus' },
        instructionHold: { hi: 'लाल गुड़हल पुष्प लें', en: 'Pick up red hibiscus flowers' },
        instructionAction: {
          hi: 'माँ के चरणों में लाल पुष्प अर्पित करें',
          en: 'Place the red hibiscus flowers at the altar'
        },
        completedText: { hi: 'पुष्प अर्पित हुए', en: 'Hibiscus flowers offered' },
        trayPosition: [0.16, 0.08, 0.58],
        targetPosition: [0.0, 0.13, 0.24],
        accentHex: '#ef4444'
      },
      {
        id: 'durga-fruits',
        stepIndex: 3,
        kind: 'place-item',
        gripStyle: 'cradle',
        label: { hi: 'फल भोग', en: 'Fruit Bhog' },
        instructionHold: { hi: 'फल भोग थाल उठाएं', en: 'Lift the fruit offering platter' },
        instructionAction: {
          hi: 'माँ दुर्गा को फल नैवेद्य अर्पित करें',
          en: 'Place the pomegranate & fruit platter before Maa Durga'
        },
        completedText: { hi: 'फल भोग अर्पित', en: 'Fruits offered' },
        trayPosition: [0.46, 0.09, 0.56],
        targetPosition: [0.22, 0.12, 0.22],
        accentHex: '#e11d48'
      },
      {
        id: 'durga-aarti',
        stepIndex: 4,
        kind: 'aarti-wave',
        gripStyle: 'cradle',
        label: { hi: 'पंच आरती', en: 'Aarti Thali' },
        instructionHold: { hi: 'आरती थाल उठाएं', en: 'Hold the Aarti plate' },
        instructionAction: {
          hi: 'माँ दुर्गा की मंगल आरती करें',
          en: 'Circle the glowing Aarti lamp before Maa Durga'
        },
        completedText: { hi: 'माँ दुर्गा आरती संपन्न', en: 'Maa Durga Aarti complete' },
        trayPosition: [0.58, 0.09, 0.36],
        targetPosition: [0.0, 0.45, 0.25],
        accentHex: '#fbbf24'
      }
    ]
  },
  {
    id: 'buddha',
    traditionGroup: 'dharmic',
    traditionLabel: { hi: 'बौद्ध परंपरा', en: 'Buddhism' },
    title: { hi: 'भगवान बुद्ध — शांति वंदना', en: 'Bhagwan Buddha — Mindful Offering' },
    subtitle: { hi: 'कमल पुष्प, जल अर्पण, धूप एवं सिंगिंग बाउल नाद', en: 'Lotus, Pure Water, Incense & Singing Bowl' },
    description: {
      hi: 'कांस्य बुद्ध प्रतिमा के समक्ष पद्म कमल व निर्मल जल अर्पित करें, धूप प्रज्वलित करें और सिंगिंग बाउल का नाद सुनें।',
      en: 'Offer pink lotus blossoms and pure water, light sandalwood incense, resonate the bronze Tibetan singing bowl, and rest in guided Metta reflection.'
    },
    imageUrl: '/src/assets/images/buddha_seva_card_1794915125152.jpg',
    focalNote: {
      hi: 'ध्यानमग्न बुद्ध एवं पारंपरिक कांस्य पात्र वेदी',
      en: 'Serene meditation Buddha & monastery offering table'
    },
    audioProfile: 'buddhist',
    ambientBgHex: '#121311',
    keyLightHex: '#ffdca8',
    rimLightHex: '#84b09c',
    hasSacredThread: false,
    steps: [
      {
        id: 'buddha-water',
        stepIndex: 0,
        kind: 'place-item',
        gripStyle: 'cradle',
        label: { hi: 'निर्मल जल पात्र', en: 'Water Bowl' },
        instructionHold: { hi: 'निर्मल जल पात्र उठाएं', en: 'Lift the pure water offering bowl' },
        instructionAction: {
          hi: 'शांति एवं निर्मलता के प्रतीक रूप में जल वेदी पर रखें',
          en: 'Place the clear water bowl gently onto the shrine table'
        },
        completedText: { hi: 'निर्मल जल अर्पित', en: 'Pure water offered' },
        trayPosition: [-0.48, 0.09, 0.56],
        targetPosition: [-0.22, 0.11, 0.18],
        accentHex: '#93c5fd'
      },
      {
        id: 'buddha-lotus',
        stepIndex: 1,
        kind: 'place-item',
        gripStyle: 'pinch',
        label: { hi: 'पद्म कमल', en: 'Lotus Flower' },
        instructionHold: { hi: 'कमल पुष्प उठाएं', en: 'Pick up the pink lotus blossom' },
        instructionAction: {
          hi: 'बुद्ध प्रतिमा के सम्मुख कमल अर्पित करें',
          en: 'Place the lotus blossom gently before the Buddha'
        },
        completedText: { hi: 'कमल पुष्प अर्पित', en: 'Lotus offered' },
        trayPosition: [-0.12, 0.08, 0.58],
        targetPosition: [0.0, 0.12, 0.22],
        accentHex: '#f472b6'
      },
      {
        id: 'buddha-incense',
        stepIndex: 2,
        kind: 'light-flame',
        gripStyle: 'wick',
        label: { hi: 'चंदन धूप', en: 'Incense' },
        instructionHold: { hi: 'धूपबत्ती प्रज्वलित करें', en: 'Tap to light the sandalwood incense' },
        instructionAction: {
          hi: 'सुगंधित धूप प्रज्वलित हो रही है',
          en: 'Gentle incense smoke rises in stillness'
        },
        completedText: { hi: 'धूप अर्पित हुई', en: 'Incense lit' },
        trayPosition: [0.24, 0.08, 0.42],
        targetPosition: [0.24, 0.14, 0.42],
        accentHex: '#d6a468'
      },
      {
        id: 'buddha-bowl',
        stepIndex: 3,
        kind: 'singing-bowl',
        gripStyle: 'handle',
        label: { hi: 'सिंगिंग बाउल', en: 'Singing Bowl' },
        instructionHold: { hi: 'सिंगिंग बाउल पर नाद करें', en: 'Hold or drag across the Singing Bowl' },
        instructionAction: {
          hi: 'कांस्य पात्र से गूंजती हुई शांति ध्वनि सुनें',
          en: 'Resonate the bronze singing bowl and breathe mindfully'
        },
        completedText: { hi: 'दिव्य नाद पूर्ण', en: 'Bowl resonance complete' },
        trayPosition: [0.46, 0.1, 0.5],
        targetPosition: [0.46, 0.12, 0.5],
        accentHex: '#d97706'
      },
      {
        id: 'buddha-reflect',
        stepIndex: 4,
        kind: 'guided-reflection',
        gripStyle: 'cradle',
        label: { hi: 'मैत्री ध्यान', en: 'Metta Reflection' },
        instructionHold: { hi: 'शांति चिंतन आरंभ करें', en: 'Begin guided mindful reflection' },
        instructionAction: {
          hi: 'सब्बे सत्ता सुखि अत्तु — सभी प्राणी सुखी व शांत हों',
          en: 'May all beings live in peace, clarity, and compassion'
        },
        completedText: { hi: 'ध्यान वंदना संपन्न', en: 'Mindful reflection complete' },
        trayPosition: [0.0, 0.1, 0.56],
        targetPosition: [0.0, 0.25, 0.2],
        accentHex: '#a7f3d0'
      }
    ]
  },
  {
    id: 'sikh',
    traditionGroup: 'dharmic',
    traditionLabel: { hi: 'सिख परंपरा', en: 'Sikhism' },
    title: { hi: 'गुरु नानक देव जी — गुरबाणी एवं चौर साहिब सेवा', en: 'Guru Nanak Dev Ji — Gurbani & Seva' },
    subtitle: { hi: 'आदर सहित चौर साहिब सेवा एवं कड़ाह प्रसाद दर्शन', en: 'Respectful Chaur Sahib Seva & Karah Prasad' },
    description: {
      hi: 'पालकी साहिब के समक्ष सत्कारपूर्वक चौर साहिब सेवा करें, कड़ाह प्रसाद परंपरा का परिचय पाएं और गुरबाणी श्रवण करें।',
      en: 'Perform respectful Chaur Sahib waving seva before the Manji Sahib palki canopy, learn the tradition of Karah Prasad, and listen in serene devotion.'
    },
    imageUrl: '/src/assets/images/sikh_seva_card_1794915125441.jpg',
    focalNote: {
      hi: 'सुशोभित रुमाला साहिब व चँदोआ साहिब (गुरु ग्रंथ साहिब जी के सत्कार सहित)',
      en: 'Manji Sahib Palki with Rumala Sahib canopy & Ik Onkar — Waheguru is formless'
    },
    audioProfile: 'sikh',
    ambientBgHex: '#141219',
    keyLightHex: '#ffe4a8',
    rimLightHex: '#95b2e0',
    hasSacredThread: false,
    steps: [
      {
        id: 'chaur-sahib',
        stepIndex: 0,
        kind: 'chaur-seva',
        gripStyle: 'handle',
        label: { hi: 'चौर साहिब सेवा', en: 'Chaur Sahib Seva' },
        instructionHold: { hi: 'चौर साहिब सत्कार से थामें', en: 'Hold the Chaur Sahib handle respectfully' },
        instructionAction: {
          hi: 'पालकी साहिब के ऊपर धीमे-धीमे चौर साहिब सेवा करें',
          en: 'Wave the Chaur Sahib gently and rhythmically in Seva'
        },
        completedText: { hi: 'चौर साहिब सेवा संपन्न', en: 'Chaur Sahib Seva completed' },
        trayPosition: [0.46, 0.14, 0.56],
        targetPosition: [0.0, 0.58, 0.16],
        accentHex: '#f8fafc'
      },
      {
        id: 'karah-prasad',
        stepIndex: 1,
        kind: 'place-item',
        gripStyle: 'cradle',
        label: { hi: 'कड़ाह प्रसाद', en: 'Karah Prasad' },
        instructionHold: { hi: 'कड़ाह प्रसाद थाल सत्कार से रखें', en: 'Present the Karah Prasad bowl' },
        instructionAction: {
          hi: 'समस्त संगत के लिए समानता व निष्काम सेवा का प्रतीक कड़ाह प्रसाद',
          en: 'Karah Prasad represents equality, humility, and shared grace'
        },
        completedText: { hi: 'कड़ाह प्रसाद दर्शन पूर्ण', en: 'Karah Prasad presented' },
        trayPosition: [-0.46, 0.09, 0.56],
        targetPosition: [0.0, 0.11, 0.24],
        accentHex: '#d97706'
      },
      {
        id: 'gurbani-shabad',
        stepIndex: 2,
        kind: 'guided-reflection',
        gripStyle: 'cradle',
        label: { hi: 'गुरबाणी सिमरन', en: 'Gurbani Simran' },
        instructionHold: { hi: 'एक ओंकार सिमरन आरंभ करें', en: 'Enter peaceful Gurbani Simran' },
        instructionAction: {
          hi: 'इक ओंकार सतिनामु — निर्मल तानपुरा व हरिमंदिर भावना में लीन हों',
          en: 'Ik Onkar Satnam — rest in serene Shabad resonance & gratitude'
        },
        completedText: { hi: 'अरदास एवं सेवा पूर्ण', en: 'Gurbani Simran complete' },
        trayPosition: [0.0, 0.1, 0.56],
        targetPosition: [0.0, 0.35, 0.15],
        accentHex: '#fbbf24'
      }
    ]
  },
  {
    id: 'christian',
    traditionGroup: 'abrahamic',
    traditionLabel: { hi: 'ईसाई परंपरा', en: 'Christianity' },
    title: { hi: 'प्रभु यीशु — प्रार्थना एवं कैंडल सेवा', en: 'Prabhu Yeshu — Prayer Sanctuary' },
    subtitle: { hi: 'प्रार्थना मोमबत्ती, श्वेत लिली पुष्प एवं मौन प्रार्थना', en: 'Beeswax Candle, White Lilies & Guided Prayer' },
    description: {
      hi: 'वेदी पर मोमबत्ती स्थापित कर प्रज्वलित करें, पवित्र श्वेत लिली पुष्प अर्पित करें और शांति प्रार्थना में सम्मिलित हों।',
      en: 'Place and light a beeswax prayer candle beside the walnut & brass cross, offer fresh white lilies, and begin a guided prayer.'
    },
    imageUrl: '/src/assets/images/christian_prayer_card_1794915125810.jpg',
    focalNote: {
      hi: 'काष्ठ एवं पीतल का क्रूस तथा शांति प्रार्थना वेदी',
      en: 'Walnut & brass cross sanctuary altar'
    },
    audioProfile: 'christian',
    ambientBgHex: '#101218',
    keyLightHex: '#ffe3b3',
    rimLightHex: '#7fa4d4',
    hasSacredThread: false,
    steps: [
      {
        id: 'prayer-candle-place',
        stepIndex: 0,
        kind: 'place-item',
        gripStyle: 'pinch',
        label: { hi: 'मोमबत्ती रखें', en: 'Place Candle' },
        instructionHold: { hi: 'प्रार्थना मोमबत्ती उठाएं', en: 'Pick up the beeswax prayer candle' },
        instructionAction: {
          hi: 'मोमबत्ती को पीतल के स्टैंड में स्थापित करें',
          en: 'Place the candle upright into the brass sanctuary holder'
        },
        completedText: { hi: 'मोमबत्ती स्थापित हुई', en: 'Candle placed' },
        trayPosition: [-0.46, 0.12, 0.54],
        targetPosition: [-0.22, 0.14, 0.22],
        accentHex: '#fef3c7'
      },
      {
        id: 'prayer-candle-light',
        stepIndex: 1,
        kind: 'light-flame',
        gripStyle: 'wick',
        label: { hi: 'मोमबत्ती जलाएं', en: 'Light Candle' },
        instructionHold: { hi: 'मोमबत्ती की बाती प्रज्वलित करें', en: 'Tap to light the prayer candle' },
        instructionAction: {
          hi: 'प्रकाश और आशा की लौ प्रज्वलित हो रही है',
          en: 'The steady warm flame illuminates the sanctuary'
        },
        completedText: { hi: 'मोमबत्ती प्रज्वलित', en: 'Candle illuminated' },
        trayPosition: [-0.22, 0.24, 0.22],
        targetPosition: [-0.22, 0.3, 0.22],
        accentHex: '#fbbf24'
      },
      {
        id: 'white-lilies',
        stepIndex: 2,
        kind: 'place-item',
        gripStyle: 'pinch',
        label: { hi: 'श्वेत लिली', en: 'White Lilies' },
        instructionHold: { hi: 'श्वेत लिली पुष्प उठाएं', en: 'Pick up the white Easter lilies' },
        instructionAction: {
          hi: 'वेदी पर शांति के प्रतीक श्वेत लिली पुष्प रखें',
          en: 'Place the white lilies respectfully beside the cross'
        },
        completedText: { hi: 'श्वेत लिली अर्पित', en: 'White lilies offered' },
        trayPosition: [0.46, 0.1, 0.54],
        targetPosition: [0.24, 0.13, 0.22],
        accentHex: '#f8fafc'
      },
      {
        id: 'christian-prayer',
        stepIndex: 3,
        kind: 'guided-reflection',
        gripStyle: 'cradle',
        label: { hi: 'शांति प्रार्थना', en: 'Guided Prayer' },
        instructionHold: { hi: 'प्रार्थना आरंभ करें', en: 'Begin silent guided prayer' },
        instructionAction: {
          hi: 'हे प्रभु, हमारे हृदय में शांति, करुणा और क्षमा का प्रकाश भरें',
          en: 'Grant peace, grace, and quiet light to all hearts'
        },
        completedText: { hi: 'प्रार्थना पूर्ण', en: 'Prayer completed' },
        trayPosition: [0.0, 0.1, 0.56],
        targetPosition: [0.0, 0.3, 0.2],
        accentHex: '#fde68a'
      }
    ]
  },
  {
    id: 'islamic',
    traditionGroup: 'abrahamic',
    traditionLabel: { hi: 'इस्लामी / सूफ़ी परंपरा', en: 'Islamic Spiritual Tradition' },
    title: { hi: 'रूहानी ज़ियारत — सूफ़ी दरगाह अदब', en: 'Roohani Ziyarat — Sufi Sanctuary' },
    subtitle: { hi: 'गुलाब पुष्प, इत्र, तस्बीह एवं रूहानी ज़िक्र', en: 'Rose Petals, Ittar, Tasbih & Guided Zikr' },
    description: {
      hi: 'जालीदार संगमरमर के पवित्र वातावरण में आदर सहित गुलाब व इत्र अर्पित करें, तस्बीह के दाने फेरें और ज़िक्र करें।',
      en: 'In a serene Sufi Dargah sanctuary (with no human depictions), offer red rose petals at the perimeter, present crystal Ittar, count wooden Tasbih beads, and reflect in Zikr.'
    },
    imageUrl: '/src/assets/images/islamic_ziyarat_card_1794915126893.jpg',
    focalNote: {
      hi: 'संगमरमर जाली व हरित चादर परिसर (निराकार ईश्वर व अदब के साथ — सभी मुस्लिम धाराओं में दरगाह परंपरा समान नहीं होती)',
      en: 'Marble Jaali & Emerald Chadar setting (no depictions; respectful of diverse Islamic traditions)'
    },
    audioProfile: 'islamic',
    ambientBgHex: '#0d1512',
    keyLightHex: '#ffd89b',
    rimLightHex: '#34d399',
    hasSacredThread: false,
    steps: [
      {
        id: 'gulab-petals',
        stepIndex: 0,
        kind: 'place-item',
        gripStyle: 'pinch',
        label: { hi: 'गुलाब पुष्प', en: 'Red Roses' },
        instructionHold: { hi: 'लाल गुलाब पुष्प उठाएं', en: 'Pick up crimson rose petals' },
        instructionAction: {
          hi: 'अदब के साथ निर्धारित स्थान पर गुलाब अर्पित करें',
          en: 'Offer the crimson roses respectfully at the designated perimeter'
        },
        completedText: { hi: 'गुलाब अदब से अर्पित', en: 'Roses offered respectfully' },
        trayPosition: [-0.48, 0.09, 0.56],
        targetPosition: [0.0, 0.14, 0.18],
        accentHex: '#e11d48'
      },
      {
        id: 'ittar-bottle',
        stepIndex: 1,
        kind: 'place-item',
        gripStyle: 'pinch',
        label: { hi: 'इत्र', en: 'Crystal Ittar' },
        instructionHold: { hi: 'इत्र की शीशी उठाएं', en: 'Lift the crystal Ittar vessel' },
        instructionAction: {
          hi: 'पाक खुशबू के रूप में निर्धारित चौकी पर इत्र रखें',
          en: 'Place the Ittar bottle respectfully on the wooden stand'
        },
        completedText: { hi: 'इत्र पेश किया गया', en: 'Ittar presented' },
        trayPosition: [-0.14, 0.1, 0.58],
        targetPosition: [-0.26, 0.13, 0.24],
        accentHex: '#f59e0b'
      },
      {
        id: 'tasbih-beads',
        stepIndex: 2,
        kind: 'tasbih-count',
        gripStyle: 'tasbih',
        label: { hi: 'तस्बीह ज़िक्र', en: 'Tasbih Beads' },
        instructionHold: { hi: 'तस्बीह के दाने फेरें (टैप/ड्रैग)', en: 'Tap or swipe the wooden Tasbih beads' },
        instructionAction: {
          hi: 'सुब्हानअल्लाह · अलहम्दुलिल्लाह · अल्लाहु अकबर — दाने गिनें',
          en: 'SubhanAllah · Alhamdulillah · Allahu Akbar — advance the beads'
        },
        completedText: { hi: 'तस्बीह ज़िक्र पूर्ण', en: 'Tasbih Zikr completed' },
        trayPosition: [0.36, 0.1, 0.52],
        targetPosition: [0.36, 0.12, 0.52],
        accentHex: '#a16207'
      },
      {
        id: 'guided-zikr',
        stepIndex: 3,
        kind: 'guided-reflection',
        gripStyle: 'cradle',
        label: { hi: 'रूहानी ज़िक्र', en: 'Guided Zikr' },
        instructionHold: { hi: 'रूहानी दुआ व ज़िक्र सुनें', en: 'Begin peaceful Zikr contemplation' },
        instructionAction: {
          hi: 'हृदय की शांति और सभी के लिए रहमत व अमन की दुआ',
          en: 'Rest in serene remembrance, gratitude, and prayer for peace'
        },
        completedText: { hi: 'ज़ियारत व दुआ पूर्ण', en: 'Ziyarat reflection complete' },
        trayPosition: [0.0, 0.1, 0.56],
        targetPosition: [0.0, 0.25, 0.2],
        accentHex: '#10b981'
      }
    ]
  },
  {
    id: 'mahavir',
    traditionGroup: 'dharmic',
    traditionLabel: { hi: 'जैन धर्म', en: 'Jainism' },
    title: { hi: 'भगवान महावीर — जिनेंद्र पूजन', en: 'Bhagwan Mahavir — Jinendra Seva' },
    subtitle: { hi: 'अक्षत स्वस्तिक, केसर चंदन एवं कपूर दीप', en: 'Akshat Swastik, Kesar Tilak & Kapoor Deep' },
    description: {
      hi: 'श्वेत संगमरमर वेदी पर पीतल के थाल में अक्षत से स्वस्तिक सजाएं, केसर अर्पण करें और निर्मल कपूर दीप प्रज्वलित करें।',
      en: 'Arrange pure white Akshat rice grains in the sacred Jain Swastik on the brass thali, offer saffron Kesar, and illuminate the pure Kapoor Deep.'
    },
    imageUrl: '/src/assets/images/mahavir_swami_card_1794915127191.jpg',
    focalNote: {
      hi: 'श्वेत संगमरमर तीर्थंकर वेदी व मंगल स्वस्तिक थाल',
      en: 'White marble Tirthankara altar & sacred Swastik thali'
    },
    audioProfile: 'jain',
    ambientBgHex: '#161411',
    keyLightHex: '#fff0d1',
    rimLightHex: '#f5b041',
    hasSacredThread: false,
    steps: [
      {
        id: 'akshat-swastik',
        stepIndex: 0,
        kind: 'place-item',
        gripStyle: 'pinch',
        label: { hi: 'अक्षत स्वस्तिक', en: 'Akshat Swastik' },
        instructionHold: { hi: 'निर्मल अक्षत चावल उठाएं', en: 'Pick up pure white Akshat rice' },
        instructionAction: {
          hi: 'पाटले पर पीतल थाल में मंगल स्वस्तिक अर्पित करें',
          en: 'Place Akshat grains in the auspicious Jain Swastik arrangement'
        },
        completedText: { hi: 'अक्षत स्वस्तिक पूर्ण', en: 'Akshat Swastik arranged' },
        trayPosition: [-0.46, 0.09, 0.56],
        targetPosition: [0.0, 0.12, 0.22],
        accentHex: '#f8fafc'
      },
      {
        id: 'kesar-chandan',
        stepIndex: 1,
        kind: 'place-item',
        gripStyle: 'pinch',
        label: { hi: 'केसर चंदन', en: 'Kesar Bowl' },
        instructionHold: { hi: 'केसर कटोरी उठाएं', en: 'Hold the saffron Kesar bowl' },
        instructionAction: {
          hi: 'अष्टप्रकारी पूजा विधि से केसर अर्पण करें',
          en: 'Offer the fragrant Kesar bowl respectfully at the Vedika'
        },
        completedText: { hi: 'केसर अर्पित हुआ', en: 'Kesar offered' },
        trayPosition: [0.36, 0.09, 0.56],
        targetPosition: [0.24, 0.12, 0.22],
        accentHex: '#f59e0b'
      },
      {
        id: 'kapoor-deep',
        stepIndex: 2,
        kind: 'light-flame',
        gripStyle: 'wick',
        label: { hi: 'कपूर दीप', en: 'Kapoor Deep' },
        instructionHold: { hi: 'कपूर दीप प्रज्वलित करें', en: 'Tap to light the pure Kapoor Deep' },
        instructionAction: {
          hi: 'निर्मल कपूर की ज्योति प्रज्वलित हो रही है',
          en: 'Pure camphor flame shines clearly before Bhagwan Mahavir'
        },
        completedText: { hi: 'कपूर दीप प्रज्वलित', en: 'Kapoor Deep illuminated' },
        trayPosition: [-0.26, 0.08, 0.36],
        targetPosition: [-0.26, 0.14, 0.36],
        accentHex: '#93c5fd'
      },
      {
        id: 'mahavir-arati',
        stepIndex: 3,
        kind: 'aarti-wave',
        gripStyle: 'cradle',
        label: { hi: 'जिनेंद्र आरती', en: 'Kapoor Aarti' },
        instructionHold: { hi: 'कपूर आरती थाल उठाएं', en: 'Hold the Kapoor Aarti plate' },
        instructionAction: {
          hi: 'भगवान महावीर के सम्मुख मंगल आरती करें',
          en: 'Move the Kapoor Deep gently in circles before Bhagwan Mahavir'
        },
        completedText: { hi: 'जिनेंद्र पूजन संपन्न', en: 'Jinendra Seva complete' },
        trayPosition: [0.54, 0.09, 0.44],
        targetPosition: [0.0, 0.44, 0.24],
        accentHex: '#fbbf24'
      }
    ]
  }
];

export function getExperienceById(id: string | null | undefined): ExperienceSpec {
  return EXPERIENCES.find((e) => e.id === id) ?? EXPERIENCES[0];
}

const STEP_GESTURE_OVERRIDES: Record<string, RitualGestureMeta> = {
  'gulab-petals': {
    gestureId: 'pinch-release-leaf',
    repeatable: true,
    hint: {
      hi: 'चुटकी से गुलाब पकड़ें, आगे बढ़ाएं व हथेली खोलें',
      en: 'Pinch rose petals, move forward & open palm to scatter respectfully'
    }
  },
  'ittar-bottle': {
    gestureId: 'pinch-release-leaf',
    hint: {
      hi: 'चुटकी से इत्र शीशी थामें व हथेली खोलकर रखें',
      en: 'Pinch to lift Ittar vessel, then open palm to place respectfully'
    }
  },
  'bilva-patra': {
    gestureId: 'pinch-release-leaf',
    repeatable: true,
    hint: {
      hi: 'अंगूठे-तर्जनी चुटकी से पत्ता लें, ऊपर लाकर हथेली खोलें',
      en: 'Pinch Bilva leaf, bring above Lingam & open fingers to place'
    }
  },
  'tulsi-leaves': {
    gestureId: 'pinch-release-leaf',
    repeatable: true,
    hint: {
      hi: 'चुटकी से तुलसी दल लें, आगे बढ़ाकर हथेली खोलें',
      en: 'Pinch Tulsi leaf, move over Makhan & open fingers to offer'
    }
  },
  'makhan-bowl': {
    gestureId: 'cupped-bhog',
    hint: {
      hi: 'दोनों हाथ कटोरी की तरह जोड़ें, ऊपर उठाकर आगे बढ़ाएं',
      en: 'Cup both hands together, lift slightly & extend forward to offer'
    }
  },
  'bhog-shiva': {
    gestureId: 'cupped-bhog',
    hint: {
      hi: 'दोनों हाथों से अंजलि बनाएं, थोड़ा ऊपर उठाकर आगे बढ़ाएं',
      en: 'Cup both hands together, lift slightly & extend forward to offer Bhog'
    }
  },
  'balaji-sindoor': {
    gestureId: 'cupped-bhog',
    hint: {
      hi: 'दोनों हाथ अंजलि में जोड़ें व आगे बढ़ाकर अर्पित करें',
      en: 'Cup both hands together & extend forward to present Sindoor & Chola'
    }
  },
  'balaji-laddoo': {
    gestureId: 'cupped-bhog',
    hint: {
      hi: 'दोनों हाथ कटोरी की तरह जोड़ें व आगे बढ़ाकर भोग लगाएं',
      en: 'Cup both hands, lift slightly & extend to offer Laddoo Bhog'
    }
  },
  'durga-chunari': {
    gestureId: 'cupped-bhog',
    hint: {
      hi: 'दोनों हाथों में चुनरी थामें व आगे बढ़ाकर अर्पित करें',
      en: 'Cup both hands together & extend forward to drape Chunari'
    }
  },
  'durga-fruits': {
    gestureId: 'cupped-bhog',
    hint: {
      hi: 'दोनों हाथ जोड़कर थोड़ा ऊपर उठाएं व आगे बढ़ाएं',
      en: 'Cup both hands, lift gently & extend forward to offer fruits'
    }
  },
  'buddha-water': {
    gestureId: 'cupped-bhog',
    hint: {
      hi: 'दोनों हाथों में जल पात्र की मुद्रा बनाएं व आगे रखें',
      en: 'Cup both hands steadily & extend forward to place water bowl'
    }
  },
  'karah-prasad': {
    gestureId: 'cupped-bhog',
    hint: {
      hi: 'दोनों हाथ अंजलि में जोड़ें व सत्कार से आगे प्रस्तुत करें',
      en: 'Cup both hands respectfully & extend forward to present Karah Prasad'
    }
  },
  'kesar-chandan': {
    gestureId: 'cupped-bhog',
    hint: {
      hi: 'दोनों हाथ कटोरी मुद्रा में जोड़ें व आगे बढ़ाएं',
      en: 'Cup both hands & extend forward to offer Kesar bowl'
    }
  },
  'durga-chandan': {
    gestureId: 'pinch-release-leaf',
    hint: {
      hi: 'चुटकी मुद्रा से चंदन लें व हथेली खोलकर अर्पित करें',
      en: 'Pinch gently, move forward & open fingers to place Chandan'
    }
  },
  'prayer-candle-place': {
    gestureId: 'pinch-release-leaf',
    hint: {
      hi: 'चुटकी से मोमबत्ती थामें व वेदी पर हथेली खोलें',
      en: 'Pinch to lift candle, move to holder & open palm to place'
    }
  },
  'akshat-swastik': {
    gestureId: 'pinch-release-leaf',
    hint: {
      hi: 'चुटकी से अक्षत लें व थाल के ऊपर हथेली खोलें',
      en: 'Pinch Akshat rice, move over thali & open fingers to form Swastik'
    }
  }
};

/**
 * Returns the culturally accurate low-compute gesture specification for any step across all 9 traditions.
 */
export function getStepGestureSpec(step: RitualObjectSpec): RitualGestureMeta {
  if (step.gesture) return step.gesture;
  const override = STEP_GESTURE_OVERRIDES[step.id];
  if (override) return override;

  if (step.kind === 'pour-water' || step.kind === 'pour-milk') {
    return {
      gestureId: 'vessel-pour',
      hint: {
        hi: 'मुट्ठी से कलश थामें, फिर कलाई आगे झुकाएं (सीधा करने पर धारा रुकेगी)',
        en: 'Grip vessel pose to raise Kalash, then tilt wrist to pour (upright stops)'
      }
    };
  }
  if (step.kind === 'light-flame') {
    return {
      gestureId: 'pinch-hold-flame',
      hint: {
        hi: 'अंगूठे-तर्जनी से चुटकी बनाकर थोड़ी देर स्थिर रखें',
        en: 'Form thumb-index pinch and hold briefly to ignite flame'
      }
    };
  }
  if (step.kind === 'aarti-wave') {
    return {
      gestureId: 'circular-aarti',
      hint: {
        hi: 'दोनों हाथों से थाल थामें और हाथ को गोलाकार घुमाएं',
        en: 'Hold pose & move hands in steady circles — plate follows your motion'
      }
    };
  }
  if (step.kind === 'chaur-seva') {
    return {
      gestureId: 'sweep-chaur',
      hint: {
        hi: 'चौर साहिब मुद्रा में मुट्ठी थामें व दाएं-बाएं धीमे लहराएं',
        en: 'Hold Chaur handle grip & sweep gently side-to-side over Palki'
      }
    };
  }
  if (step.kind === 'tasbih-count') {
    return {
      gestureId: 'pinch-tasbih',
      repeatable: true,
      hint: {
        hi: 'तस्बीह मनका गिनने के लिए चुटकी दबाकर छोड़ें',
        en: 'Pinch & release gently to advance each Tasbih bead'
      }
    };
  }
  if (step.kind === 'singing-bowl') {
    return {
      gestureId: 'bowl-resonate',
      repeatable: true,
      hint: {
        hi: 'मुट्ठी या कटोरी मुद्रा में हाथ को धीरे से घुमाएं',
        en: 'Hold mallet grip & glide gently to resonate the Singing Bowl'
      }
    };
  }
  if (step.kind === 'guided-reflection') {
    return {
      gestureId: 'still-reflection',
      hint: {
        hi: 'दोनों हथेलियाँ शांतिपूर्वक जोड़कर थोड़ी देर स्थिर रखें',
        en: 'Join both palms calmly and hold steady for quiet reflection'
      }
    };
  }
  // Default floral offerings across Hindu / Buddhist / Christian altars
  return {
    gestureId: 'namaste-flowers',
    repeatable: true,
    hint: {
      hi: 'दोनों हथेलियाँ नमस्ते में जोड़ें, नीचे व आगे झुकाकर पुष्प अर्पित करें',
      en: 'Join palms (Namaste), dip gently forward to release blossoms onto altar'
    }
  };
}
