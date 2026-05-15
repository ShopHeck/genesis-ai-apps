import type { PromptTemplate } from "@/components/generator/types";

export const EXAMPLE_PROMPTS: PromptTemplate[] = [
  {
    category: "Wellness",
    label: "Lunar mood journal",
    tagline: "Nocturnal journaling tied to the moon.",
    signature: "Constellation map of your emotions over months.",
    screens: ["Tonight", "New entry", "Constellation", "Lock widget"],
    accent: "#7C8DFF",
    emoji: "🌙",
    prompt:
      "A nocturnal mood journal that pairs each entry with the current moon phase and a generative ambient color palette. Includes Face ID lock, on-device sentiment trends in Swift Charts, a 'constellation map' visualizing emotional patterns over months, and a Lock Screen widget showing tonight's moon.",
  },
  {
    category: "Wellness",
    label: "Breath-led focus",
    tagline: "Pomodoro timed to your breath.",
    signature: "Live Activity breath cadence + procedural focus stones.",
    screens: ["Session", "Breath rings", "Stones", "History"],
    accent: "#5EE2C7",
    emoji: "🫁",
    prompt:
      "A focus timer that syncs Pomodoro intervals to guided breathing patterns (box, 4-7-8, coherent). Live Activities show breath cadence on the Dynamic Island, ambient soundscapes loop via AVAudioEngine, and finished sessions mint a collectible 'focus stone' with procedural SwiftUI artwork.",
  },
  {
    category: "Productivity",
    label: "Time garden",
    tagline: "Tasks grow plants in a living garden.",
    signature: "Garden seasons shift with real local weather.",
    screens: ["Garden", "Today's tasks", "Plant detail", "Widget"],
    accent: "#7AC74F",
    emoji: "🌱",
    prompt:
      "A task manager where every completed task grows a plant in a personal SwiftUI garden. Plants thrive on consistency, wilt on procrastination, and seasons shift with your actual local weather via WeatherKit. Includes WidgetKit garden snapshot and App Intents for Siri ('plant a seed for…').",
  },
  {
    category: "Productivity",
    label: "Intention compass",
    tagline: "A weekly compass of your intentions.",
    signature: "Needle visualizes alignment with your 4 intentions.",
    screens: ["Compass", "Set intentions", "Daily log", "Sunday review"],
    accent: "#F2B441",
    emoji: "🧭",
    prompt:
      "A weekly review app shaped like a compass. You set 4 cardinal intentions; the needle visualizes alignment based on how you spent your time (manual logs + Screen Time). Sunday review surfaces an AI-style narrative summary built from your own notes.",
  },
  {
    category: "Creative",
    label: "Pocket synth",
    tagline: "Drag-and-wire generative synth playground.",
    signature: "Live Activity shows the playing patch's waveform.",
    screens: ["Patch board", "Library", "Recorder", "Share"],
    accent: "#FF6BB5",
    emoji: "🎛",
    prompt:
      "A tactile generative synth playground using AVAudioEngine and SwiftUI Canvas. Drag glowing nodes to wire oscillators, filters, and delays. Save patches to SwiftData, share as audio via ShareLink, and a Live Activity shows the currently playing patch waveform.",
  },
  {
    category: "Creative",
    label: "Color story",
    tagline: "Daily palette stories from your photos.",
    signature: "On-device Vision palette extraction → typographic collage.",
    screens: ["Today", "Capture", "Palette detail", "Archive"],
    accent: "#E96B4A",
    emoji: "🎨",
    prompt:
      "A camera-first app that extracts 5-color palettes from photos using on-device Vision, then auto-generates a daily 'color story' collage with typography. Save palettes, export as PNG, and a widget shows today's dominant hue.",
  },
  {
    category: "Outdoors",
    label: "Quiet places",
    tagline: "Find the quietest spots near you.",
    signature: "Crowd-sourced noise heatmap on MapKit.",
    screens: ["Map", "Place detail", "Check-in", "Walk me there"],
    accent: "#4FB6E8",
    emoji: "🤫",
    prompt:
      "A discovery app for the quietest spots near you. Uses MapKit, CoreLocation, and crowd-sourced sound-level reports. Shows a noise heatmap, lets users check in with a 1-tap quiet rating, and offers a 'walk me somewhere peaceful' route suggestion.",
  },
  {
    category: "Outdoors",
    label: "Sky watcher",
    tagline: "Tonight's sky in AR over your camera.",
    signature: "RealityKit constellations + Live Activity countdown.",
    screens: ["Tonight", "AR sky", "Events", "Widget"],
    accent: "#8E7BFF",
    emoji: "🌌",
    prompt:
      "An augmented sky companion: tonight's planets, ISS passes, and meteor showers for the user's location. AR view via RealityKit overlays constellations on the live camera. Includes a Live Activity countdown to the next celestial event and Lock Screen widget.",
  },
  {
    category: "Social",
    label: "Two-person notebook",
    tagline: "A private shared notebook for two.",
    signature: "Live 'pulse' when the other person is reading.",
    screens: ["Pages", "New page", "Sketch", "Widget"],
    accent: "#FF8FA3",
    emoji: "📓",
    prompt:
      "A private shared notebook for exactly two people via CloudKit. Pages can hold text, sketches (PencilKit), photos, and audio notes. A 'pulse' indicator shows when the other person is reading. Includes Lock Screen widget with the latest entry preview.",
  },
  {
    category: "Social",
    label: "Slow letters",
    tagline: "Anti-instant messenger with delayed delivery.",
    signature: "Wax-seal stickers + filling weekly mailbox.",
    screens: ["Mailbox", "Compose", "Letter detail", "Friends"],
    accent: "#C9A66B",
    emoji: "✉️",
    prompt:
      "An anti-instant messenger: messages between friends arrive on a delay you choose (1 hour to 7 days), encouraging thoughtful long-form notes. Beautiful envelope animations, wax-seal stickers, and a mailbox view that fills throughout the week.",
  },
  {
    category: "Finance",
    label: "Subscription forest",
    tagline: "Subscriptions visualized as a forest.",
    signature: "Cancel one and watch the canopy thin.",
    screens: ["Forest", "Tree detail", "Add subscription", "Yearly report"],
    accent: "#3FAE7B",
    emoji: "🌲",
    prompt:
      "A subscription tracker visualized as a forest — each subscription is a tree sized by its monthly cost. Cancel one and watch the canopy thin. Includes renewal Live Activities, App Intents to log a new subscription via Siri, and yearly 'forest report'.",
  },
  {
    category: "Learning",
    label: "Vocabulary garden",
    tagline: "Spaced-repetition words bloom as flowers.",
    signature: "On-device AI example sentences, any language pair.",
    screens: ["Garden", "Review", "Word detail", "Widget"],
    accent: "#E27DBB",
    emoji: "🌸",
    prompt:
      "A spaced-repetition vocabulary app where each word becomes a flower in a personal garden. Uses on-device AI for example sentences, supports any language pair, and includes a daily 5-minute review widget plus AppShortcut to log a word from anywhere.",
  },
  {
    category: "Health",
    label: "Sleep weather",
    tagline: "Last night's sleep as today's forecast.",
    signature: "HealthKit → sunny / foggy / stormy day forecast.",
    screens: ["Forecast", "Wind-down", "Ritual builder", "Widget"],
    accent: "#6FB7FF",
    emoji: "⛅",
    prompt:
      "A sleep companion that turns last night's HealthKit sleep data into a 'weather forecast' for your day (sunny, foggy, stormy). Includes a Lock Screen widget with today's forecast, a sleep ritual builder, and gentle haptic wind-down sessions.",
  },
  {
    category: "Utility",
    label: "Pocket museum",
    tagline: "Curate everyday objects as exhibitions.",
    signature: "AI wall labels + 3D gallery via RealityKit.",
    screens: ["Exhibitions", "Capture", "Object detail", "3D gallery"],
    accent: "#B58BFF",
    emoji: "🏛",
    prompt:
      "A personal museum app where users curate everyday objects via the camera (coins, leaves, receipts). Each object gets an AI-generated wall label, organized into themed exhibitions. Browse as a 3D gallery using RealityKit.",
  },
  {
    category: "Utility",
    label: "Deja vu log",
    tagline: "Capture moments that feel familiar.",
    signature: "On-device similarity surfaces 'echoes' over time.",
    screens: ["Timeline", "Capture", "Echoes", "Entry detail"],
    accent: "#FFB45A",
    emoji: "🔁",
    prompt:
      "A capture app for moments that feel familiar — voice memo + location + emotion tag. SwiftData powers a timeline; Vision and on-device similarity surface 'echoes' between entries months apart, revealing personal patterns.",
  },

  // ───── Creative + High Utility (5) ─────
  {
    category: "Utility",
    label: "Receipt whisperer",
    tagline: "Snap receipts, get warranty + return alerts.",
    signature: "On-device OCR auto-files warranties and return windows.",
    screens: ["Inbox", "Capture", "Receipt detail", "Alerts"],
    accent: "#5BB8A6",
    emoji: "🧾",
    prompt:
      "A receipt manager that uses VisionKit DataScanner to OCR paper and email receipts, auto-extracts merchant, items, totals, warranty length, and return window. Sends Live Activity countdowns before return windows close, exports CSV for taxes, and groups purchases by category with Swift Charts.",
  },
  {
    category: "Utility",
    label: "Pantry radar",
    tagline: "Scan your kitchen, get tonight's recipe.",
    signature: "Barcode + photo pantry → AI recipe with what you actually have.",
    screens: ["Pantry", "Scan", "Tonight", "Shopping list"],
    accent: "#F2934A",
    emoji: "🥕",
    prompt:
      "A pantry tracker that combines barcode scanning, photo recognition (Vision), and expiry tracking. Generates 'tonight's recipe' suggestions using only what you have on hand, builds a unified shopping list across recipes, and sends notifications before food expires. SwiftData persistence and a Lock Screen widget showing what's expiring next.",
  },
  {
    category: "Utility",
    label: "Meeting decoder",
    tagline: "Live transcription with action items.",
    signature: "On-device Speech → action items, decisions, and follow-ups.",
    screens: ["Meetings", "Live capture", "Summary", "Action items"],
    accent: "#7C9DFF",
    emoji: "🎙",
    prompt:
      "A meeting assistant using SFSpeechRecognizer for live on-device transcription. Auto-extracts action items, decisions, and questions into structured cards, syncs action items to Reminders via EventKit, and provides a searchable archive with speaker turns. Live Activity shows recording status.",
  },
  {
    category: "Utility",
    label: "Trip choreographer",
    tagline: "Drag-and-drop multi-day travel planner.",
    signature: "Auto-rebalances days when you add or move a stop.",
    screens: ["Trips", "Day planner", "Map", "Packing"],
    accent: "#E86B8E",
    emoji: "🧳",
    prompt:
      "A travel planner with a drag-and-drop day timeline. Auto-rebalances travel time between stops using MapKit directions, surfaces opening hours, and generates a packing checklist from destination weather (WeatherKit). Offline mode caches maps and itineraries; share read-only trip via ShareLink.",
  },
  {
    category: "Utility",
    label: "Inbox zero zen",
    tagline: "Triage email like a card game.",
    signature: "Swipe gestures: archive, snooze, reply-later, delegate.",
    screens: ["Deck", "Card detail", "Snoozed", "Today's wins"],
    accent: "#9B8CFF",
    emoji: "📨",
    prompt:
      "An email triage app that turns your unread inbox into a swipeable card deck (Mail via MailKit-style integration or IMAP). Swipe to archive, snooze, reply-later, or delegate. Daily ritual ends with a 'today's wins' summary and Live Activity counter as you process. Haptic feedback for each clear.",
  },

  // ───── Trending + High Demand (5) ─────
  {
    category: "AI",
    label: "Voice clone diary",
    tagline: "Talk to your past self.",
    signature: "On-device voice journaling with AI-summarized weekly playback.",
    screens: ["Today", "Record", "Playback", "Insights"],
    accent: "#FF7A59",
    emoji: "🎤",
    prompt:
      "A voice-first journal where you speak entries and get on-device transcription + sentiment via Speech and NaturalLanguage. Weekly AI summary stitches together a 60-second 'past self' playback. SwiftData archive, searchable transcripts, and a Lock Screen widget prompting today's question.",
  },
  {
    category: "AI",
    label: "Outfit oracle",
    tagline: "AI stylist that knows your closet.",
    signature: "Photograph clothes once → daily outfit suggestions.",
    screens: ["Closet", "Today", "Outfit detail", "Capsule"],
    accent: "#D77AE8",
    emoji: "👗",
    prompt:
      "A wardrobe app: photograph each garment once, Vision auto-categorizes (top/bottom/shoes, color, season). Generates daily outfit suggestions based on weather (WeatherKit), calendar events, and recent wears. Build capsule wardrobes, track cost-per-wear, and a widget shows today's suggested fit.",
  },
  {
    category: "Health",
    label: "Longevity score",
    tagline: "Daily score from sleep, steps, HRV, nutrition.",
    signature: "Composite score with one focused 'lever of the day'.",
    screens: ["Today", "Trends", "Levers", "Weekly review"],
    accent: "#3FBF8E",
    emoji: "💚",
    prompt:
      "A longevity dashboard pulling HealthKit (sleep, steps, HRV, VO2max, resting HR) plus manual nutrition logging. Computes a daily 0-100 score, surfaces the single highest-impact 'lever of the day', and shows 90-day trends in Swift Charts. Weekly review with narrative insights and a Lock Screen widget.",
  },
  {
    category: "Finance",
    label: "Crypto mood",
    tagline: "Portfolio + sentiment in one calm view.",
    signature: "Glanceable mood ring + Live Activity for big moves.",
    screens: ["Portfolio", "Coin detail", "Alerts", "Widget"],
    accent: "#F5A524",
    emoji: "🪙",
    prompt:
      "A calm crypto tracker. Live prices for user-selected coins, animated 'mood ring' showing portfolio sentiment, customizable alerts (% moves, RSI thresholds). Live Activity surfaces big moves on the Dynamic Island, Lock Screen widget shows today's PnL. SwiftData for holdings; no login required.",
  },
  {
    category: "Productivity",
    label: "Second brain capture",
    tagline: "Universal capture → smart inbox + linking.",
    signature: "Share Sheet captures anything; AI auto-tags and links notes.",
    screens: ["Inbox", "Note", "Graph", "Daily review"],
    accent: "#6E8DFF",
    emoji: "🧠",
    prompt:
      "A second-brain note app with a Share Extension to capture text, links, images, and voice from anywhere on iOS. On-device NaturalLanguage auto-tags entries and suggests links between notes. Visual knowledge graph in SwiftUI Canvas, daily review queue, and Spotlight indexing for instant recall.",
  },

  // ───── Gaming (5) ─────
  {
    category: "Gaming",
    label: "Tide pool tycoon",
    tagline: "Idle game where you grow a living tide pool.",
    signature: "Real tides drive creature behavior in real time.",
    screens: ["Pool", "Creature detail", "Shop", "Almanac"],
    accent: "#3FB6E8",
    emoji: "🐚",
    prompt:
      "An idle tycoon set in a SwiftUI-rendered tide pool. Real lunar tide data drives water level and which creatures appear. Tap to feed, breed hybrids, and unlock the almanac. Live Activity tracks the next high tide; offline progress accrues. SpriteKit for animated denizens, SwiftData for the collection.",
  },
  {
    category: "Gaming",
    label: "Word duel daily",
    tagline: "60-second daily word battles vs friends.",
    signature: "One shared puzzle a day; async duels via GameCenter.",
    screens: ["Today's puzzle", "Duel", "Leaderboard", "Streak"],
    accent: "#FF6B9A",
    emoji: "🔤",
    prompt:
      "A daily word game: one 60-second puzzle drops at midnight; chain letters across a hex grid for points. Async duels with friends via GameCenter, global and friends leaderboards, streak tracking, and a Lock Screen widget showing today's countdown. Haptic-rich, gorgeous SpriteKit animations.",
  },
  {
    category: "Gaming",
    label: "Pocket dungeon",
    tagline: "One-thumb roguelike, run in 5 minutes.",
    signature: "Procedural dungeons; each run feels different.",
    screens: ["Hub", "Run", "Loot", "Codex"],
    accent: "#B05CFF",
    emoji: "⚔️",
    prompt:
      "A one-thumb roguelike where each run is a 5-minute procedurally generated dungeon. Swipe to move, tap to attack, long-press for special. Permanent meta-progression unlocks classes and relics in the hub. SpriteKit + GameplayKit for procgen, SwiftData saves runs, GameCenter leaderboards for daily seeds.",
  },
  {
    category: "Gaming",
    label: "Rhythm garden",
    tagline: "Tap to the beat; flowers bloom on rhythm.",
    signature: "AVAudioEngine beat detection turns any song into a level.",
    screens: ["Garden", "Song picker", "Play", "Bouquet"],
    accent: "#7BE0A6",
    emoji: "🎵",
    prompt:
      "A rhythm game where tapping in time grows flowers in your garden. AVAudioEngine analyzes any Apple Music song you own to generate a level. Combo streaks bloom rare flowers; bouquets share as video via ShareLink. Beautiful particle effects, haptic feedback locked to the beat.",
  },
  {
    category: "Gaming",
    label: "Ghost racer AR",
    tagline: "Race your past run as an AR ghost.",
    signature: "Yesterday's path overlays today's via ARKit.",
    screens: ["Tracks", "Race", "Replay", "Ghosts"],
    accent: "#FF9E3F",
    emoji: "👻",
    prompt:
      "A walking/running game that records your route via CoreLocation, then replays it as an AR 'ghost' you race against next time using ARKit world tracking. Compete with friends' ghosts via CloudKit, unlock cosmetic trails, and a Live Activity shows your gap to the ghost in real time.",
  },
];
