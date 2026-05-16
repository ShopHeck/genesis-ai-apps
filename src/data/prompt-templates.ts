import type { PromptTemplate } from "@/components/generator/types";

export const EXAMPLE_PROMPTS: PromptTemplate[] = [
  // ───── For Creators (5) ─────
  {
    category: "Creator",
    label: "Sponsorship rate card",
    tagline: "Know your worth. Price your content.",
    signature: "Auto-calculated CPM from real engagement data.",
    screens: ["Dashboard", "Rate card", "Deal tracker", "Media kit"],
    accent: "#FF6B35",
    emoji: "💰",
    prompt:
      "A creator monetization app. Manually log follower counts and engagement rates per platform (YouTube, TikTok, Instagram, X). Auto-calculates CPM and cost-per-engagement. Generates a shareable media kit as a branded PDF via ShareLink. Tracks inbound brand deal inquiries with status pipeline (pitched → negotiating → contracted → delivered → paid). Swift Charts show earnings over time. Lock Screen widget shows this month's deal revenue.",
  },
  {
    category: "Creator",
    label: "Content pipeline",
    tagline: "Idea to published, across every platform.",
    signature: "Visual Kanban board with voice-captured ideas.",
    screens: ["Pipeline", "Idea capture", "Batch planner", "Calendar"],
    accent: "#8B5CF6",
    emoji: "🎬",
    prompt:
      "A content production tracker with a drag-and-drop Kanban board: columns for Idea → Scripted → Shot → Edited → Scheduled → Published. Quick-capture ideas via voice (SFSpeechRecognizer) or text from anywhere using a Share Extension. Batch planning calendar shows shoot days vs editing days. Each card tracks platform-specific versions (vertical, horizontal, square). Deadline alerts via UserNotifications. Lock Screen widget shows today's content task.",
  },
  {
    category: "Creator",
    label: "B-roll vault",
    tagline: "Tag, search, and reuse your footage library.",
    signature: "Vision auto-tags clips by scene, mood, and color.",
    screens: ["Library", "Quick tag", "Search", "Collections"],
    accent: "#06B6D4",
    emoji: "🎞",
    prompt:
      "A footage library manager for video creators. Import clips from the camera roll, auto-categorize using on-device Vision (indoor/outdoor, people, food, nature, urban). Manual tags for mood, project, and season. Full-text search across tags. Tracks which clips have been used in which projects to avoid repeats. Bulk-tag multiple clips at once. Export selected clips as a collection via ShareLink. SwiftData persistence, filterable grid view.",
  },
  {
    category: "Creator",
    label: "Collab tracker",
    tagline: "Never lose a collab in your DMs again.",
    signature: "Pipeline from pitch to publish with revenue splits.",
    screens: ["Active collabs", "New collab", "Timeline", "Payouts"],
    accent: "#EC4899",
    emoji: "🤝",
    prompt:
      "A collaboration management app for creators. Track every collab from first contact through delivery: stages are Pitched → Agreed → Briefed → Filming → Editing → Published. Store collaborator contact info, deadlines, content specs, and revenue splits. Auto-generates a collaboration brief from your inputs. Notification reminders for follow-ups and deadlines. Calendar view shows collab timeline. Swift Charts tracks total collab revenue by month.",
  },
  {
    category: "Creator",
    label: "Launch countdown",
    tagline: "Build hype for drops, releases, and premieres.",
    signature: "Live Activity countdown shared with your audience.",
    screens: ["Launches", "New launch", "Countdown", "Post scheduler"],
    accent: "#F59E0B",
    emoji: "🚀",
    prompt:
      "A launch coordination app for musicians, podcasters, and video creators. Create countdown pages for upcoming releases with cover art, description, and links. Live Activity shows real-time countdown on the Dynamic Island. Plan cross-platform posting schedules (auto-reminds you when to post on each platform). Tracks multiple upcoming launches on a timeline. Share countdown links via ShareLink. Lock Screen widget shows days until next drop.",
  },

  // ───── For Business Owners (5) ─────
  {
    category: "Business",
    label: "Cash pulse",
    tagline: "Daily cash flow in one calm glance.",
    signature: "Runway forecast with 'danger zone' alerts.",
    screens: ["Pulse", "Log entry", "Forecast", "Weekly report"],
    accent: "#10B981",
    emoji: "💵",
    prompt:
      "A daily cash flow tracker for small business owners. Log income and expenses with one tap — snap receipts with VisionKit DataScanner for auto-extraction. Categorize by type (payroll, materials, subscriptions, revenue, one-time). 30/60/90-day runway forecast using Swift Charts. 'Danger zone' alerts when projected outflows exceed inflows. Weekly cash health report exportable as PDF. Lock Screen widget shows today's net position. SwiftData persistence, Face ID lock.",
  },
  {
    category: "Business",
    label: "Client voice",
    tagline: "Hear what your customers actually want.",
    signature: "Auto-clusters feedback into patterns and themes.",
    screens: ["Inbox", "Feedback detail", "Patterns", "Decision log"],
    accent: "#6366F1",
    emoji: "📣",
    prompt:
      "A customer feedback aggregator for product-driven businesses. Capture feedback from any source: paste text, screenshot (VisionKit OCR), voice memo (SFSpeechRecognizer), or photo of a whiteboard. NaturalLanguage framework auto-tags sentiment (positive, neutral, negative) and clusters similar requests. Dashboard shows 'top 5 asks' with request counts. Decision log tracks what you shipped in response. Export monthly insights report via ShareLink. SwiftData with full-text search.",
  },
  {
    category: "Business",
    label: "Quote builder",
    tagline: "Professional proposals in under a minute.",
    signature: "Branded PDF quotes with e-signature capture.",
    screens: ["Quotes", "New quote", "Preview", "Templates"],
    accent: "#0EA5E9",
    emoji: "📝",
    prompt:
      "A mobile quoting and proposal tool for freelancers and service businesses. Choose from service templates (consulting, design, development, photography), add line items with quantities and rates, apply tax and discount. Preview as a branded PDF with your logo and colors. Client signature capture via PencilKit. Auto-follow-up reminders for unsigned quotes. Track quote status (draft → sent → viewed → signed → invoiced). Export via ShareLink or email. SwiftData stores client history.",
  },
  {
    category: "Business",
    label: "Contractor command",
    tagline: "Manage your freelancers without the spreadsheet.",
    signature: "Budget guardrails alert before you overspend.",
    screens: ["Team", "Timesheets", "Budgets", "Pay runs"],
    accent: "#F97316",
    emoji: "👷",
    prompt:
      "A contractor management app for business owners who hire freelancers. Add contractors with rates (hourly/project), track submitted hours and deliverables, approve timesheets with one swipe. Set per-contractor and per-project budget ceilings with alert notifications when 80% spent. Monthly spending breakdown by contractor and project in Swift Charts. Export pay run summaries as CSV. SwiftData persistence, grouped views by project or contractor.",
  },
  {
    category: "Business",
    label: "Storefront pulse",
    tagline: "Your shop's daily vitals, no POS needed.",
    signature: "Correlates sales with weather and day-of-week patterns.",
    screens: ["Today", "Log sale", "Trends", "Inventory alerts"],
    accent: "#84CC16",
    emoji: "🏪",
    prompt:
      "A lightweight daily tracker for physical retail, market vendors, and pop-up shop owners. Tap to log each sale (amount + category). Manual inventory counter with low-stock alerts. Foot traffic counter (manual tap or photo-based). Correlates daily revenue with weather (WeatherKit) and day-of-week patterns using Swift Charts. Shows best/worst selling days, peak hours, and seasonal trends. Weekly summary exportable as PDF. Lock Screen widget shows today's sales total.",
  },

  // ───── For Designers (5) ─────
  {
    category: "Design",
    label: "Type specimen book",
    tagline: "Your personal typography library on the go.",
    signature: "Camera mode identifies fonts from real-world signage.",
    screens: ["Library", "Specimen", "Pairings", "Type walk"],
    accent: "#1E293B",
    emoji: "🔤",
    prompt:
      "A personal font reference app for typographers and designers. Import system fonts and catalog them with tags (serif, sans, mono, display, weight, mood). Generate specimen sheets with pangrams, paragraphs, and size scales. Create and save font pairings with live preview at different sizes. 'Type Walk' camera mode captures text from real-world signage (VisionKit) and identifies similar system fonts. Export specimen cards as PNG via ShareLink. SwiftData library with search and filter.",
  },
  {
    category: "Design",
    label: "Contrast checker",
    tagline: "Never ship inaccessible colors again.",
    signature: "Camera-sampled colors with instant WCAG verdicts.",
    screens: ["Palette", "Check", "Suggestions", "Export"],
    accent: "#7C3AED",
    emoji: "🔍",
    prompt:
      "A color accessibility tool for designers. Build palettes manually or sample colors from the camera. Instantly checks every color combination against WCAG 2.1 AA and AAA contrast ratios for normal and large text. Flags failures with suggested accessible alternatives (shifts hue/lightness minimally to pass). Preview color pairs on realistic UI mockups (buttons, cards, text blocks). Generate tint and shade scales. Export palettes as JSON design tokens, CSS custom properties, or SwiftUI Color extensions via ShareLink.",
  },
  {
    category: "Design",
    label: "Client review board",
    tagline: "Structured design feedback, not messy email threads.",
    signature: "Tap-to-comment on specific areas of your designs.",
    screens: ["Projects", "Upload", "Review board", "Revisions"],
    accent: "#E11D48",
    emoji: "💬",
    prompt:
      "A design review app for client feedback. Upload screenshots or mockups of your work. Clients (or you, simulating a review) tap specific areas to drop pin comments — like spatial annotations on an image. Each comment has a status (open, resolved, deferred). Track revision rounds: v1, v2, v3 with side-by-side comparison. Project-level approval status (in review → changes requested → approved). Timeline shows review history. Export feedback summary as PDF. SwiftData persistence with image caching.",
  },
  {
    category: "Design",
    label: "Moodboard studio",
    tagline: "Capture inspiration, present it beautifully.",
    signature: "Auto-extracts dominant colors and clusters by mood.",
    screens: ["Boards", "Capture", "Board editor", "Present"],
    accent: "#D946EF",
    emoji: "🖼",
    prompt:
      "A visual inspiration tool for designers. Capture images from camera, screenshots, or photo library into themed moodboards. On-device Vision extracts dominant colors from each image. Free-form canvas layout — pinch to resize, drag to arrange, add text labels. Auto-clusters images by color mood. Fullscreen presentation mode for client pitches with swipe navigation. Export boards as high-res PNG or PDF via ShareLink. SwiftData stores boards with image thumbnails.",
  },
  {
    category: "Design",
    label: "Component cutter",
    tagline: "Screenshot any UI. Extract its building blocks.",
    signature: "Vision-powered extraction of spacing, colors, and radii.",
    screens: ["Captures", "Analyze", "Tokens", "Reference library"],
    accent: "#0D9488",
    emoji: "🔬",
    prompt:
      "A UI reverse-engineering tool for designers and developers. Screenshot any app or website, then the app uses Vision to identify UI elements (buttons, cards, nav bars, text blocks). Extracts approximate spacing values, border radii, font sizes, and color swatches. Save analyzed screens to a reference library organized by app or style. Compare extracted tokens side-by-side across different designs. Export token sheets as JSON or PNG cheat sheets via ShareLink. SwiftData persistence.",
  },

  // ───── Kept Originals ─────
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

  // ───── Gaming (3) ─────
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
];
