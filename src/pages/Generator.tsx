import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Download,
  FileCode2,
  Folder,
  ChevronRight,
  Apple,
  Wand2,
  AlertTriangle,
  Check,
  Brain,
  Code2,
  Package,
  FileText,
  Eye,
  ShieldCheck,
  ShieldAlert,
  XCircle,
  TerminalSquare,
  Smartphone,
  RefreshCw,
  PlayCircle,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type GeneratedFile = { path: string; content: string };
type Project = {
  appName: string;
  bundleId: string;
  summary: string;
  files: GeneratedFile[];
};

type PromptTemplate = {
  label: string;
  category: string;
  tagline: string;
  signature: string;
  screens: string[];
  accent: string; // tailwind hex or hsl-friendly color
  emoji: string;
  prompt: string;
};

const EXAMPLE_PROMPTS: PromptTemplate[] = [
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
  {
    category: "Finance",
    label: "Receipt vault",
    tagline: "Snap receipts, auto-categorized & tax-ready.",
    signature: "On-device OCR + warranty expiry alerts.",
    screens: ["Inbox", "Capture", "Receipt detail", "Tax export"],
    accent: "#34C759",
    emoji: "🧾",
    prompt:
      "A receipt manager that uses VisionKit DataScannerViewController to capture receipts, extracts merchant/total/date with on-device OCR, auto-categorizes via on-device ML, tracks warranty expiry with local notifications, and exports a tax-ready CSV/PDF for any date range.",
  },
  {
    category: "Finance",
    label: "Split smart",
    tagline: "Group expenses settled in one tap.",
    signature: "Live Activity for active trips + iMessage app.",
    screens: ["Groups", "Add expense", "Balances", "Settle up"],
    accent: "#0A84FF",
    emoji: "💸",
    prompt:
      "A bill-splitting app for trips and roommates with multi-currency support, receipt-photo attachments, smart settle-up suggestions that minimize transactions, a Live Activity for active trips, and an iMessage extension to add expenses without leaving chat.",
  },
  {
    category: "Productivity",
    label: "Meeting clarity",
    tagline: "Record, transcribe, and summarize meetings.",
    signature: "On-device Whisper + action-item extraction.",
    screens: ["Library", "Recording", "Transcript", "Summary"],
    accent: "#FF9500",
    emoji: "🎙",
    prompt:
      "A meeting recorder with on-device transcription via WhisperKit, AI-style summary and action-item extraction, speaker diarization, searchable transcript timeline, calendar integration via EventKit, and a Live Activity that shows active recording duration.",
  },
  {
    category: "Productivity",
    label: "Inbox zero",
    tagline: "Snooze, batch, and reply with templates.",
    signature: "Swipeable triage + Focus filter integration.",
    screens: ["Triage", "Snoozed", "Templates", "Today"],
    accent: "#5856D6",
    emoji: "📥",
    prompt:
      "A focused email triage app on top of MailKit. Tinder-style swipe to archive/snooze/reply, smart template library with variables, scheduled send, Focus mode integration, and a daily 'inbox zero' streak widget.",
  },
  {
    category: "Health",
    label: "Hydration habit",
    tagline: "Smart water tracking that learns you.",
    signature: "Adaptive reminders from weather + activity.",
    screens: ["Today", "Quick log", "Trends", "Widget"],
    accent: "#32ADE6",
    emoji: "💧",
    prompt:
      "A hydration tracker that adapts reminder timing based on WeatherKit temperature, HealthKit workouts, and your logging patterns. Quick-log via App Intents and Apple Watch complication, beautiful Swift Charts trends, and an interactive Lock Screen widget.",
  },
  {
    category: "Health",
    label: "Med minder",
    tagline: "Medication tracking the family can trust.",
    signature: "Shared caregiver view + refill predictions.",
    screens: ["Schedule", "Take dose", "History", "Caregiver"],
    accent: "#FF3B30",
    emoji: "💊",
    prompt:
      "A medication reminder app with complex schedules (every other day, taper, PRN), shared caregiver visibility via CloudKit, refill predictions, drug-interaction warnings from a bundled dataset, Lock Screen widget showing next dose, and Apple Watch quick-take.",
  },
  {
    category: "Health",
    label: "Symptom diary",
    tagline: "Track symptoms and spot triggers.",
    signature: "Correlation engine ties symptoms to food/sleep.",
    screens: ["Today", "Log symptom", "Insights", "Doctor export"],
    accent: "#FF6482",
    emoji: "🩺",
    prompt:
      "A symptom and trigger tracker for chronic conditions. Quick-log symptoms with severity and tags, correlate against HealthKit sleep/workouts and meal logs, surface likely triggers via on-device statistics, and export a clean PDF report for doctor visits.",
  },
  {
    category: "Travel",
    label: "Trip atlas",
    tagline: "All your bookings, one beautiful itinerary.",
    signature: "Auto-parse confirmation emails + offline maps.",
    screens: ["Trips", "Day view", "Place detail", "Boarding"],
    accent: "#5AC8FA",
    emoji: "🧳",
    prompt:
      "An itinerary app that parses forwarded confirmation emails (flights, hotels, rentals) into a unified day-by-day timeline, caches offline MapKit tiles for the destination, shows Live Activities for upcoming flights with gate updates, and adds boarding passes to Wallet.",
  },
  {
    category: "Travel",
    label: "Phrase coach",
    tagline: "Language phrases for your exact trip.",
    signature: "Context-aware phrases + offline pronunciation.",
    screens: ["Trip phrases", "Practice", "Camera translate", "Favorites"],
    accent: "#AF52DE",
    emoji: "🗣",
    prompt:
      "A travel phrasebook that generates phrases tailored to your trip context (restaurants, transit, emergencies), with offline TTS pronunciation, Vision-powered camera translation of menus and signs, and SharePlay for practicing with a friend.",
  },
  {
    category: "Food",
    label: "Pantry chef",
    tagline: "Recipes from what's in your kitchen.",
    signature: "Barcode scan pantry + expiry-first recipes.",
    screens: ["Pantry", "Recipes", "Cook mode", "Shopping list"],
    accent: "#FF9F0A",
    emoji: "🍳",
    prompt:
      "A pantry-first cooking app: scan barcodes with VisionKit to add items, track expiry dates, and surface recipes that prioritize ingredients about to expire. Hands-free cook mode with Apple Watch step advance, auto-generated shopping list, and Siri shortcuts.",
  },
  {
    category: "Food",
    label: "Macro mate",
    tagline: "Nutrition tracking without the friction.",
    signature: "Photo-based portion estimation + barcode scan.",
    screens: ["Today", "Log meal", "Trends", "Goals"],
    accent: "#30D158",
    emoji: "🥗",
    prompt:
      "A nutrition tracker with photo-based portion estimation via Vision, barcode scanning, recurring meal templates, HealthKit two-way sync, Swift Charts macro trends, and an interactive widget for one-tap logging of frequent meals.",
  },
  {
    category: "Fitness",
    label: "Run companion",
    tagline: "Adaptive coaching for your next race.",
    signature: "Live Activity pace coach + audio cues.",
    screens: ["Plan", "Active run", "Post-run", "Calendar"],
    accent: "#FF2D55",
    emoji: "🏃",
    prompt:
      "An adaptive run-training app: generates a plan toward a race goal, adjusts based on actual HealthKit performance, runs a Live Activity with pace/HR/coach cues during workouts, plays audio coaching via AVAudioEngine, and syncs to Apple Watch.",
  },
  {
    category: "Smart Home",
    label: "Home pulse",
    tagline: "A calm dashboard for your smart home.",
    signature: "Custom scenes + room-aware Lock Screen widgets.",
    screens: ["Dashboard", "Room", "Scenes", "Automations"],
    accent: "#64D2FF",
    emoji: "🏠",
    prompt:
      "A HomeKit dashboard reimagined: at-a-glance room cards, custom scene builder with conditions, energy usage charts, room-aware Lock Screen widgets that change with your location, and Live Activities for active automations like 'arriving home'.",
  },
  {
    category: "Learning",
    label: "Read deeper",
    tagline: "Save articles, surface what matters.",
    signature: "AI highlights + spaced-repetition resurfacing.",
    screens: ["Library", "Reader", "Highlights", "Resurface"],
    accent: "#BF5AF2",
    emoji: "📖",
    prompt:
      "A read-it-later app with a beautiful reader, on-device AI summary and key-quote extraction, highlight capture, spaced-repetition resurfacing of past highlights, Safari share extension, and a Lock Screen widget with today's resurfaced quote.",
  },
  {
    category: "Career",
    label: "Job radar",
    tagline: "Track applications from apply to offer.",
    signature: "Stage pipeline + interview prep timeline.",
    screens: ["Pipeline", "Job detail", "Prep", "Insights"],
    accent: "#A2845E",
    emoji: "🎯",
    prompt:
      "A job-search CRM: kanban pipeline of applications, contact tracking per company, interview prep checklist with countdown Live Activity, salary negotiation notes, weekly insight report on funnel conversion, and a widget for next interview.",
  },
];

type Stage = "idle" | "analyzing" | "generating" | "bundling" | "done" | "error";

const STAGES: { id: Exclude<Stage, "idle" | "error">; label: string; hint: string; icon: typeof Brain }[] = [
  { id: "analyzing", label: "Analyzing your prompt", hint: "Designing app architecture & feature set", icon: Brain },
  { id: "generating", label: "Generating Swift source files", hint: "Writing SwiftUI views, models & SwiftData schema", icon: Code2 },
  { id: "bundling", label: "Bundling Xcode project", hint: "Packaging files into a downloadable .zip", icon: Package },
  { id: "done", label: "Ready for Xcode", hint: "Open in Xcode 16+, sign, and ship", icon: Check },
];

type LogKind = "system" | "thought" | "action" | "success" | "error";
type LogLine = { id: number; ts: number; kind: LogKind; text: string };

const STAGE_SCRIPT: Record<Exclude<Stage, "idle" | "error" | "done">, { kind: LogKind; text: string }[]> = {
  analyzing: [
    { kind: "system", text: "$ apex build --target ios --xcode 16 --swift 6" },
    { kind: "action", text: "[agent] booting planner · model=gemini-2.5-pro" },
    { kind: "thought", text: "› parsing intent and extracting feature set…" },
    { kind: "thought", text: "› choosing architecture: MV + @Observable + SwiftData" },
    { kind: "thought", text: "› mapping screens → NavigationStack routes" },
    { kind: "thought", text: "› selecting Apple frameworks (Charts, HealthKit?, WidgetKit?)" },
    { kind: "action", text: "[plan] feature graph stabilized · entities resolved" },
  ],
  generating: [
    { kind: "action", text: "[codegen] scaffolding Xcode project (XcodeGen)" },
    { kind: "thought", text: "› writing App.swift entry point with @main" },
    { kind: "thought", text: "› generating SwiftUI views and view models" },
    { kind: "thought", text: "› defining @Model SwiftData schema" },
    { kind: "thought", text: "› wiring NavigationStack + deep link routes" },
    { kind: "thought", text: "› adding accessibility labels & Dynamic Type" },
    { kind: "thought", text: "› adopting Swift 6 strict concurrency (Sendable, actors)" },
    { kind: "thought", text: "› generating Assets.xcassets + AppIcon" },
    { kind: "action", text: "[lint] passing SwiftLint · 0 warnings" },
  ],
  bundling: [
    { kind: "action", text: "[bundler] compressing project tree…" },
    { kind: "thought", text: "› verifying project.yml + Info.plist keys" },
    { kind: "action", text: "[bundler] writing apex-build.zip" },
  ],
};

export default function Generator() {
  const [prompt, setPrompt] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [project, setProject] = useState<Project | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [lastPromptUsed, setLastPromptUsed] = useState<string>("");
  const startedAt = useRef<number | null>(null);
  const logIdRef = useRef(0);
  const terminalRef = useRef<HTMLDivElement | null>(null);

  const loading = stage === "analyzing" || stage === "generating" || stage === "bundling";

  const pushLog = (kind: LogKind, text: string) => {
    setLogs((prev) => [...prev, { id: ++logIdRef.current, ts: Date.now(), kind, text }]);
  };

  // Tick elapsed seconds while loading
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      if (startedAt.current) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [loading]);

  // Stream scripted "agent thoughts" while loading. Each stage has a queue
  // that drips out one line at a time so the terminal feels alive.
  useEffect(() => {
    if (stage !== "analyzing" && stage !== "generating" && stage !== "bundling") return;
    const queue = [...STAGE_SCRIPT[stage]];
    let cancelled = false;
    const drip = () => {
      if (cancelled || queue.length === 0) return;
      const next = queue.shift()!;
      pushLog(next.kind, next.text);
      const delay = 350 + Math.random() * 650;
      setTimeout(drip, delay);
    };
    const t = setTimeout(drip, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [stage]);

  // Auto-scroll terminal to bottom on new log
  useEffect(() => {
    const el = terminalRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);


  const handleGenerate = async () => {
    if (prompt.trim().length < 10) {
      toast.error("Describe your app in a bit more detail.");
      return;
    }
    setError(null);
    setProject(null);
    setSelectedFile(null);
    setElapsed(0);
    setLogs([]);
    setPreviewHtml(null);
    setPreviewError(null);
    logIdRef.current = 0;
    startedAt.current = Date.now();
    setLastPromptUsed(prompt);
    setStage("analyzing");
    pushLog("system", `> prompt received (${prompt.trim().length} chars)`);

    const analyzeTimer = setTimeout(() => {
      setStage((s) => (s === "analyzing" ? "generating" : s));
    }, 4200);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-ios-app", {
        body: { prompt },
      });
      clearTimeout(analyzeTimer);
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.files?.length) throw new Error("Empty project returned.");

      setStage("bundling");
      pushLog("success", `[codegen] generated ${data.files.length} files for "${data.appName}"`);
      await new Promise((r) => setTimeout(r, 900));

      setProject(data as Project);
      setSelectedFile(data.files[0].path);
      setStage("done");
      pushLog("success", "[done] project ready · awaiting download");
      toast.success(`${data.appName} generated — ${data.files.length} files`);
    } catch (e) {
      clearTimeout(analyzeTimer);
      const msg = e instanceof Error ? e.message : "Generation failed";
      setError(msg);
      setStage("error");
      pushLog("error", `[error] ${msg}`);
      toast.error(msg);
    }
  };

  const validation = project ? validateProject(project) : null;

  const handleDownload = async () => {
    if (!project) return;
    if (validation && validation.errors.length > 0) {
      toast.error("Cannot download: project has validation errors");
      return;
    }
    const zip = new JSZip();
    const root = zip.folder(project.appName)!;
    project.files.forEach((f) => root.file(f.path, f.content));
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${project.appName}.zip`);
    toast.success("Project downloaded");
  };

  const generatePreview = async () => {
    if (!project) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-app-preview", {
        body: {
          prompt: lastPromptUsed || prompt,
          appName: project.appName,
          summary: project.summary,
        },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.html) throw new Error("Empty preview returned");
      setPreviewHtml(data.html);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Preview failed";
      setPreviewError(msg);
      toast.error(msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Auto-generate preview once project is ready
  useEffect(() => {
    if (project && !previewHtml && !previewLoading && !previewError) {
      generatePreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);


  const tree = project ? buildTree(project.files) : null;
  const currentFile = project?.files.find((f) => f.path === selectedFile);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </Link>
          <div className="font-display text-lg font-bold">
            <span className="gradient-text">Apex</span>Build{" "}
            <span className="text-muted-foreground font-normal">/ Generator</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Apple size={14} />
            <span className="hidden sm:inline">Xcode 16+ · iOS 18 · Swift 6</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Prompt panel */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-panel p-6 sm:p-8 mb-8 relative overflow-hidden"
        >
          <div
            className="absolute -top-32 -right-32 w-72 h-72 rounded-full blur-[100px] opacity-30 pointer-events-none"
            style={{ background: "var(--gradient-glow)" }}
          />

          <div className="flex items-center gap-2 text-primary text-sm font-medium mb-3">
            <Sparkles size={14} />
            Describe your iOS app
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-2 text-balance">
            From idea to <span className="gradient-text">Xcode project</span> in seconds
          </h1>
          <p className="text-muted-foreground mb-6 max-w-2xl">
            Generates a production-grade SwiftUI app following Apple's 2026 best practices —
            Swift 6 concurrency, @Observable, SwiftData, NavigationStack, and accessibility built in.
          </p>

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A meditation app with guided breathing sessions, daily streaks, and HealthKit integration..."
            rows={4}
            className="bg-background/60 border-border/60 resize-none text-base focus-visible:ring-primary"
            disabled={loading}
          />

          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                Out-of-the-box idea templates
              </p>
              <p className="text-[11px] text-muted-foreground/60">
                {EXAMPLE_PROMPTS.length} curated · click to load
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1 -mr-1">
              {EXAMPLE_PROMPTS.map((ex) => {
                const selected = prompt === ex.prompt;
                return (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => setPrompt(ex.prompt)}
                    disabled={loading}
                    title={ex.prompt}
                    className={`group relative text-left rounded-xl border p-3.5 bg-card/40 hover:bg-card/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden ${
                      selected
                        ? "border-primary/60 shadow-[var(--shadow-glow-sm)]"
                        : "border-border/60 hover:border-primary/40"
                    }`}
                    style={{
                      // subtle accent glow per template
                      backgroundImage: `radial-gradient(120% 80% at 100% 0%, ${ex.accent}22, transparent 60%)`,
                    }}
                  >
                    <div className="flex items-start gap-2.5 mb-2">
                      <div
                        className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg ring-1 ring-inset ring-white/10"
                        style={{
                          background: `linear-gradient(135deg, ${ex.accent}55, ${ex.accent}1a)`,
                        }}
                        aria-hidden
                      >
                        {ex.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-[10px] uppercase tracking-wider font-medium"
                          style={{ color: ex.accent }}
                        >
                          {ex.category}
                        </p>
                        <p className="text-sm font-semibold text-foreground leading-tight truncate">
                          {ex.label}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground leading-snug line-clamp-2 mb-2.5">
                      {ex.tagline}
                    </p>

                    <div className="flex items-start gap-1.5 text-[11px] text-foreground/80 mb-2.5">
                      <Sparkles
                        size={11}
                        className="mt-0.5 shrink-0"
                        style={{ color: ex.accent }}
                      />
                      <span className="line-clamp-2 leading-snug">{ex.signature}</span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {ex.screens.map((s) => (
                        <span
                          key={s}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-background/60 border border-border/50 text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>

                    {selected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 gap-4 flex-wrap">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Wand2 size={12} /> Powered by Lovable AI · Gemini 2.5 Pro
            </p>
            <Button
              onClick={handleGenerate}
              disabled={loading}
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow-md)] min-w-[180px]"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate App
                </>
              )}
            </Button>
          </div>
        </motion.section>

        {/* Multi-step progress */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="glass-panel p-6 sm:p-8 mb-8"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs uppercase tracking-wider text-primary font-medium">
                    Building your app
                  </p>
                  <h2 className="font-display text-xl font-semibold mt-1">
                    {STAGES.find((s) => s.id === stage)?.label ?? "Working…"}
                  </h2>
                </div>
                <div className="text-right">
                  <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                    {elapsed}s
                  </p>
                  <p className="text-xs text-muted-foreground">~20–60s typical</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-card/60 overflow-hidden mb-6">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "var(--gradient-glow)" }}
                  initial={{ width: "5%" }}
                  animate={{
                    width:
                      stage === "analyzing"
                        ? "25%"
                        : stage === "generating"
                          ? "70%"
                          : stage === "bundling"
                            ? "95%"
                            : "100%",
                  }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>

              {/* Steps */}
              <ol className="space-y-3">
                {STAGES.filter((s) => s.id !== "done").map((step, i) => {
                  const order = ["analyzing", "generating", "bundling"];
                  const currentIdx = order.indexOf(stage);
                  const stepIdx = order.indexOf(step.id);
                  const status: "pending" | "active" | "complete" =
                    stepIdx < currentIdx
                      ? "complete"
                      : stepIdx === currentIdx
                        ? "active"
                        : "pending";
                  const Icon = step.icon;
                  return (
                    <li
                      key={step.id}
                      className={`flex items-start gap-3 rounded-lg p-3 transition-colors ${
                        status === "active"
                          ? "bg-primary/5 border border-primary/30"
                          : "border border-transparent"
                      }`}
                    >
                      <div
                        className={`shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center ${
                          status === "complete"
                            ? "bg-primary/15 text-primary"
                            : status === "active"
                              ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow-sm)]"
                              : "bg-card/60 text-muted-foreground"
                        }`}
                      >
                        {status === "complete" ? (
                          <Check size={14} strokeWidth={3} />
                        ) : status === "active" ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Icon size={14} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-medium ${
                            status === "pending" ? "text-muted-foreground" : "text-foreground"
                          }`}
                        >
                          {step.label}
                        </p>
                        <p className="text-xs text-muted-foreground/80 mt-0.5">{step.hint}</p>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground/60 mt-1">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </li>
                  );
                })}
              </ol>

              {/* Live agent terminal */}
              <div className="mt-6 rounded-xl border border-border/60 bg-[hsl(228_20%_4%)] overflow-hidden shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-card/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-destructive/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                    <span className="ml-3 text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                      <TerminalSquare size={12} /> apex-agent — building
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/60">
                    {logs.length} lines
                  </span>
                </div>
                <div
                  ref={terminalRef}
                  className="font-mono text-[12px] leading-relaxed p-4 h-64 overflow-auto"
                >
                  {logs.map((l) => {
                    const color =
                      l.kind === "system"
                        ? "text-foreground"
                        : l.kind === "thought"
                          ? "text-muted-foreground"
                          : l.kind === "action"
                            ? "text-primary"
                            : l.kind === "success"
                              ? "text-emerald-400"
                              : "text-destructive";
                    const time = new Date(l.ts).toLocaleTimeString([], {
                      hour12: false,
                      minute: "2-digit",
                      second: "2-digit",
                    });
                    return (
                      <div key={l.id} className="flex gap-3">
                        <span className="text-muted-foreground/40 shrink-0">{time}</span>
                        <span className={`${color} whitespace-pre-wrap break-words`}>
                          {l.text}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex gap-2 items-center mt-1 text-primary">
                    <span>›</span>
                    <span className="inline-block w-2 h-4 bg-primary/80 animate-pulse" />
                  </div>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>


        {/* Error */}
        {error && !loading && (
          <div className="glass-panel border-destructive/40 p-6 flex items-start gap-3">
            <AlertTriangle className="text-destructive shrink-0" size={20} />
            <div>
              <p className="font-medium text-foreground">Generation failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {/* Result */}
        <AnimatePresence>
          {project && !loading && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Summary header */}
              <div className="glass-panel p-6 flex items-start justify-between gap-6 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-primary font-medium mb-1">
                    <Apple size={12} /> READY FOR XCODE
                  </div>
                  <h2 className="font-display text-2xl font-bold">{project.appName}</h2>
                  <p className="text-xs text-muted-foreground font-mono mt-1">{project.bundleId}</p>
                  <p className="text-sm text-muted-foreground mt-3 max-w-2xl">{project.summary}</p>
                  <p className="text-xs text-muted-foreground/70 mt-2">
                    {project.files.length} files generated
                  </p>
                </div>
                <Button
                  onClick={handleDownload}
                  size="lg"
                  disabled={!!validation && validation.errors.length > 0}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow-md)] disabled:opacity-50"
                >
                  <Download size={16} />
                  Download .zip
                </Button>
              </div>

              {/* Interactive app preview */}
              <AppPreview
                html={previewHtml}
                loading={previewLoading}
                error={previewError}
                onRegenerate={generatePreview}
                appName={project.appName}
              />

              {/* Pre-download validation */}
              {validation && <ValidationPanel result={validation} onSelect={setSelectedFile} />}

              {/* ZIP Preview summary */}
              <ZipPreviewCard project={project} onSelect={setSelectedFile} />

              {/* Code viewer */}
              <div className="grid lg:grid-cols-[280px_1fr] gap-4 min-h-[500px]">
                {/* File tree */}
                <div className="glass-panel p-3 overflow-auto max-h-[600px]">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground px-2 py-2 flex items-center gap-1.5">
                    <Folder size={12} /> {project.appName}
                  </div>
                  <FileTreeView
                    node={tree!}
                    selected={selectedFile}
                    onSelect={setSelectedFile}
                  />
                </div>

                {/* File content */}
                <div className="glass-panel overflow-hidden flex flex-col min-h-[500px]">
                  <div className="border-b border-border/40 px-4 py-2.5 flex items-center gap-2 text-xs font-mono text-muted-foreground bg-card/40">
                    <FileCode2 size={12} />
                    {selectedFile}
                  </div>
                  <pre className="overflow-auto flex-1 p-4 text-xs font-mono text-foreground/90 leading-relaxed">
                    <code>{currentFile?.content ?? ""}</code>
                  </pre>
                </div>
              </div>

              {/* Build instructions */}
              <div className="glass-panel p-6">
                <h3 className="font-display text-lg font-semibold mb-3">Open in Xcode</h3>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Download and unzip the project.</li>
                  <li>
                    Install{" "}
                    <code className="text-primary text-xs bg-card/60 px-1.5 py-0.5 rounded">
                      brew install xcodegen
                    </code>{" "}
                    (one-time).
                  </li>
                  <li>
                    Run{" "}
                    <code className="text-primary text-xs bg-card/60 px-1.5 py-0.5 rounded">
                      xcodegen generate
                    </code>{" "}
                    inside the project folder to create the{" "}
                    <code className="text-xs">.xcodeproj</code>.
                  </li>
                  <li>
                    Open in Xcode 16+, set your Apple Developer Team in Signing &amp; Capabilities,
                    and Run.
                  </li>
                  <li>Archive → Distribute App → App Store Connect when ready to ship.</li>
                </ol>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ─── File tree helpers ────────────────────────────────────────────────────
type TreeNode = {
  name: string;
  path: string;
  isFile: boolean;
  children: TreeNode[];
};

function buildTree(files: GeneratedFile[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isFile: false, children: [] };
  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          isFile,
          children: [],
        };
        node.children.push(child);
      }
      node = child;
    });
  }
  // sort: folders first, then alpha
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sort);
  };
  sort(root);
  return root;
}

function FileTreeView({
  node,
  selected,
  onSelect,
  depth = 0,
}: {
  node: TreeNode;
  selected: string | null;
  onSelect: (p: string) => void;
  depth?: number;
}) {
  return (
    <ul className={depth === 0 ? "space-y-0.5" : "space-y-0.5"}>
      {node.children.map((child) =>
        child.isFile ? (
          <li key={child.path}>
            <button
              onClick={() => onSelect(child.path)}
              className={`w-full text-left flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono transition-colors ${
                selected === child.path
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              }`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <FileCode2 size={11} className="shrink-0 opacity-60" />
              <span className="truncate">{child.name}</span>
            </button>
          </li>
        ) : (
          <li key={child.path}>
            <FolderRow name={child.name} depth={depth} />
            <FileTreeView
              node={child}
              selected={selected}
              onSelect={onSelect}
              depth={depth + 1}
            />
          </li>
        ),
      )}
    </ul>
  );
}

function FolderRow({ name, depth }: { name: string; depth: number }) {
  return (
    <div
      className="flex items-center gap-1 px-2 py-1 text-xs text-foreground/80 font-medium"
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <ChevronRight size={11} className="opacity-50" />
      <Folder size={11} className="opacity-60" />
      <span className="truncate">{name}</span>
    </div>
  );
}

// ─── ZIP Preview Card ─────────────────────────────────────────────────────
function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function ZipPreviewCard({
  project,
  onSelect,
}: {
  project: Project;
  onSelect: (p: string) => void;
}) {
  const sizes = project.files.map((f) => new Blob([f.content]).size);
  const totalBytes = sizes.reduce((a, b) => a + b, 0);
  const folders = new Set(
    project.files
      .map((f) => f.path.split("/").slice(0, -1).join("/"))
      .filter(Boolean),
  ).size;

  const ranked = [...project.files]
    .map((f, i) => ({ f, size: sizes[i] }))
    .sort((a, b) => {
      const score = (x: { f: GeneratedFile; size: number }) => {
        const n = x.f.path.toLowerCase();
        let s = 0;
        if (/app\.swift$/.test(n)) s += 100;
        if (/contentview\.swift$/.test(n)) s += 80;
        if (/project\.yml$/.test(n)) s += 60;
        if (/readme/i.test(n)) s += 40;
        if (n.endsWith(".swift")) s += 10;
        return s + Math.min(x.size / 200, 20);
      };
      return score(b) - score(a);
    });
  const mainFiles = ranked.slice(0, 4);
  const ext = (p: string) => p.split(".").pop() ?? "";
  const breakdown = project.files.reduce<Record<string, number>>((acc, f) => {
    const e = ext(f.path) || "other";
    acc[e] = (acc[e] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-medium">
            <Eye size={12} /> ZIP Preview
          </div>
          <h3 className="font-display text-lg font-semibold mt-1">
            What's inside{" "}
            <span className="font-mono text-foreground/80">{project.appName}.zip</span>
          </h3>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div>
            <span className="text-foreground font-semibold">{project.files.length}</span> files
          </div>
          <div>
            <span className="text-foreground font-semibold">{folders}</span> folders
          </div>
          <div>
            <span className="text-foreground font-semibold">{formatBytes(totalBytes)}</span>{" "}
            uncompressed
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-5">
        {Object.entries(breakdown)
          .sort((a, b) => b[1] - a[1])
          .map(([e, c]) => (
            <span
              key={e}
              className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full bg-card/60 border border-border/40 text-muted-foreground"
            >
              .{e} <span className="text-foreground/80 ml-1">{c}</span>
            </span>
          ))}
      </div>

      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
        <FileText size={12} /> Main files
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {mainFiles.map(({ f, size }) => {
          const preview = f.content.split("\n").slice(0, 6).join("\n");
          return (
            <button
              key={f.path}
              onClick={() => onSelect(f.path)}
              className="text-left group rounded-lg border border-border/40 bg-card/40 hover:border-primary/50 hover:bg-card/60 transition-colors p-3 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileCode2 size={12} className="text-primary shrink-0" />
                  <span className="text-xs font-mono truncate text-foreground group-hover:text-primary">
                    {f.path}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  {formatBytes(size)}
                </span>
              </div>
              <pre className="text-[10px] font-mono text-muted-foreground/80 leading-snug overflow-hidden whitespace-pre-wrap line-clamp-4">
                {preview}
              </pre>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Pre-download validation ──────────────────────────────────────────────
type ValidationIssue = {
  level: "error" | "warning" | "info";
  message: string;
  hint?: string;
  file?: string;
};
type ValidationResult = {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
  passed: string[];
};

function validateProject(project: Project): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const infos: ValidationIssue[] = [];
  const passed: string[] = [];

  const byPath = new Map(project.files.map((f) => [f.path, f]));
  const has = (re: RegExp) => project.files.find((f) => re.test(f.path));
  const hasContent = (re: RegExp, contentRe: RegExp) =>
    project.files.some((f) => re.test(f.path) && contentRe.test(f.content));

  // 1. project.yml — required for XcodeGen
  const projectYml = has(/(^|\/)project\.yml$/i);
  if (!projectYml) {
    errors.push({
      level: "error",
      message: "Missing project.yml",
      hint: "XcodeGen requires a project.yml at the project root to generate the .xcodeproj.",
    });
  } else {
    passed.push("project.yml present");
    const yml = projectYml.content;
    const checks: { key: RegExp; label: string; level: "error" | "warning" }[] = [
      { key: /^name:\s*\S+/m, label: "name", level: "error" },
      { key: /^options:/m, label: "options block", level: "warning" },
      { key: /bundleIdPrefix|PRODUCT_BUNDLE_IDENTIFIER/, label: "bundle identifier", level: "warning" },
      { key: /^targets:/m, label: "targets block", level: "error" },
      { key: /deploymentTarget|IPHONEOS_DEPLOYMENT_TARGET/, label: "deploymentTarget", level: "warning" },
    ];
    for (const c of checks) {
      if (!c.key.test(yml)) {
        (c.level === "error" ? errors : warnings).push({
          level: c.level,
          message: `project.yml missing \`${c.label}\``,
          file: projectYml.path,
          hint: "XcodeGen will fail or produce an invalid project without it.",
        });
      } else {
        passed.push(`project.yml: ${c.label}`);
      }
    }
  }

  // 2. App entry point — @main App
  const appEntry = project.files.find(
    (f) => f.path.endsWith(".swift") && /@main\s+struct\s+\w+\s*:\s*App\b/.test(f.content),
  );
  if (!appEntry) {
    errors.push({
      level: "error",
      message: "No SwiftUI App entry point found",
      hint: "Expected a `@main struct XxxApp: App` declaration in a .swift file.",
    });
  } else {
    passed.push(`App entry: ${appEntry.path}`);
  }

  // 3. ContentView (or any root view)
  const rootView = project.files.some(
    (f) => f.path.endsWith(".swift") && /struct\s+\w+\s*:\s*View\b/.test(f.content),
  );
  if (!rootView) {
    warnings.push({
      level: "warning",
      message: "No SwiftUI View found",
      hint: "App should contain at least one `struct X: View` for the UI.",
    });
  } else {
    passed.push("SwiftUI View(s) present");
  }

  // 4. Assets / Info / Sources folder structure expected by typical XcodeGen setup
  const hasAssets = has(/Assets\.xcassets\//i) || has(/Assets\.xcassets$/i);
  if (!hasAssets) {
    warnings.push({
      level: "warning",
      message: "No Assets.xcassets catalog",
      hint: "App icon and accent color won't be configurable without an asset catalog.",
    });
  } else {
    passed.push("Assets.xcassets catalog");
  }

  const hasAppIcon = project.files.some((f) => /AppIcon\.appiconset/i.test(f.path));
  if (!hasAppIcon) {
    warnings.push({
      level: "warning",
      message: "No AppIcon.appiconset",
      hint: "App Store submission requires an app icon set.",
    });
  } else {
    passed.push("AppIcon.appiconset");
  }

  // 5. Info.plist or generated automatically via project.yml `info` key
  const hasInfoPlist = has(/Info\.plist$/);
  const ymlGenerates = projectYml && /(^|\s)info:/m.test(projectYml.content);
  if (!hasInfoPlist && !ymlGenerates) {
    infos.push({
      level: "info",
      message: "No Info.plist file",
      hint: "OK if XcodeGen generates one via the `info:` key, otherwise add one.",
    });
  } else {
    passed.push("Info.plist (file or generated)");
  }

  // 6. Bundle ID consistency
  if (project.bundleId && !/^[a-zA-Z0-9.-]+$/.test(project.bundleId)) {
    errors.push({
      level: "error",
      message: `Invalid bundle identifier: ${project.bundleId}`,
      hint: "Use reverse-DNS format, e.g. com.acme.AppName.",
    });
  } else if (project.bundleId) {
    passed.push("Bundle ID format");
  }

  // 7. Empty files
  for (const f of project.files) {
    if (f.content.trim().length === 0) {
      warnings.push({
        level: "warning",
        message: `Empty file: ${f.path}`,
        file: f.path,
      });
    }
  }

  // 8. README is nice-to-have
  if (!has(/^README(\.md)?$/i)) {
    infos.push({ level: "info", message: "No README — build instructions are provided in the UI." });
  } else {
    passed.push("README present");
  }

  return { errors, warnings, infos, passed };
}

function ValidationPanel({
  result,
  onSelect,
}: {
  result: ValidationResult;
  onSelect: (p: string) => void;
}) {
  const ok = result.errors.length === 0 && result.warnings.length === 0;
  const Icon = result.errors.length > 0 ? XCircle : ok ? ShieldCheck : ShieldAlert;
  const tone =
    result.errors.length > 0
      ? "border-destructive/50 bg-destructive/5"
      : ok
        ? "border-primary/40 bg-primary/5"
        : "border-amber-500/40 bg-amber-500/5";
  const iconTone =
    result.errors.length > 0
      ? "text-destructive"
      : ok
        ? "text-primary"
        : "text-amber-400";

  return (
    <div className={`glass-panel border ${tone} p-6`}>
      <div className="flex items-start gap-3 mb-4">
        <Icon className={`shrink-0 ${iconTone}`} size={22} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            Pre-download validation
          </div>
          <h3 className="font-display text-lg font-semibold mt-0.5">
            {result.errors.length > 0
              ? `${result.errors.length} blocking issue${result.errors.length > 1 ? "s" : ""} — fix before download`
              : ok
                ? "All XcodeGen checks passed"
                : `${result.warnings.length} warning${result.warnings.length > 1 ? "s" : ""} — safe to download`}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {result.passed.length} checks passed · {result.warnings.length} warnings ·{" "}
            {result.errors.length} errors
          </p>
        </div>
      </div>

      {[
        { key: "errors" as const, items: result.errors, label: "Errors", color: "text-destructive", dot: "bg-destructive" },
        { key: "warnings" as const, items: result.warnings, label: "Warnings", color: "text-amber-400", dot: "bg-amber-400" },
        { key: "infos" as const, items: result.infos, label: "Notes", color: "text-muted-foreground", dot: "bg-muted-foreground" },
      ]
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <div key={g.key} className="mt-3">
            <p className={`text-[11px] uppercase tracking-wider font-medium mb-1.5 ${g.color}`}>
              {g.label} ({g.items.length})
            </p>
            <ul className="space-y-1.5">
              {g.items.map((it, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm rounded-md p-2 bg-card/40 border border-border/30"
                >
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${g.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground">{it.message}</p>
                    {it.hint && (
                      <p className="text-xs text-muted-foreground mt-0.5">{it.hint}</p>
                    )}
                    {it.file && (
                      <button
                        onClick={() => onSelect(it.file!)}
                        className="text-xs font-mono text-primary hover:underline mt-0.5"
                      >
                        {it.file}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}

      {result.passed.length > 0 && (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <Check size={12} /> {result.passed.length} checks passed
          </summary>
          <ul className="mt-2 grid sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
            {result.passed.map((p, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <Check size={11} className="text-primary/70 shrink-0" />
                <span className="truncate">{p}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ─── Interactive app preview ──────────────────────────────────────────────
function AppPreview({
  html,
  loading,
  error,
  onRegenerate,
  appName,
}: {
  html: string | null;
  loading: boolean;
  error: string | null;
  onRegenerate: () => void;
  appName: string;
}) {
  return (
    <div className="glass-panel p-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-medium">
            <Smartphone size={12} /> Interactive Preview
          </div>
          <h3 className="font-display text-lg font-semibold mt-1">
            Try {appName} in your browser
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            A web-based interactive mockup of your iOS app — tap around to feel the flows
            before opening Xcode. Not the real Swift app, but a faithful UI preview.
          </p>
        </div>
        <Button
          onClick={onRegenerate}
          disabled={loading}
          variant="outline"
          size="sm"
          className="border-border/60"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={14} />
              Generating…
            </>
          ) : (
            <>
              <RefreshCw size={14} />
              {html ? "Regenerate" : "Generate preview"}
            </>
          )}
        </Button>
      </div>

      <div className="flex justify-center">
        <div className="relative" style={{ width: 320, height: 692 }}>
          <div
            className="absolute inset-0 rounded-[44px] p-[10px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
            style={{
              background:
                "linear-gradient(145deg, hsl(var(--border)) 0%, hsl(var(--card)) 100%)",
            }}
          >
            <div className="relative w-full h-full rounded-[36px] overflow-hidden bg-black">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-10 pointer-events-none" />

              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-[hsl(228_20%_4%)]">
                  <Loader2 className="animate-spin text-primary" size={28} />
                  <p className="text-xs font-mono">building interactive preview…</p>
                  <p className="text-[10px] text-muted-foreground/60 max-w-[200px] text-center">
                    Rendering your app's screens, navigation, and sample data
                  </p>
                </div>
              )}

              {!loading && error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center bg-[hsl(228_20%_4%)]">
                  <AlertTriangle className="text-destructive" size={24} />
                  <p className="text-xs text-foreground font-medium">Preview failed</p>
                  <p className="text-[10px] text-muted-foreground">{error}</p>
                  <Button onClick={onRegenerate} size="sm" variant="outline" className="mt-2">
                    <RefreshCw size={12} /> Retry
                  </Button>
                </div>
              )}

              {!loading && !error && !html && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center bg-[hsl(228_20%_4%)]">
                  <PlayCircle className="text-primary" size={32} />
                  <p className="text-xs text-foreground font-medium">Tap to preview</p>
                  <Button onClick={onRegenerate} size="sm" className="mt-2">
                    <Smartphone size={12} /> Generate preview
                  </Button>
                </div>
              )}

              {!loading && html && (
                <iframe
                  title={`${appName} preview`}
                  srcDoc={html}
                  sandbox="allow-scripts allow-forms"
                  className="w-full h-full border-0 bg-black"
                  style={{ colorScheme: "dark" }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/60 text-center mt-4">
        Preview runs in a sandboxed iframe · iPhone 15 viewport, scaled to fit
      </p>
    </div>
  );
}

