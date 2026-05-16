import { useState } from "react";
import { Apple, Download, Loader2, Package, FolderOpen } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Project } from "./types";

function generateInfoPlist(project: Project): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>${project.appName}</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>${project.bundleId}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${project.appName}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSRequiresIPhoneOS</key>
  <true/>
  <key>UIApplicationSceneManifest</key>
  <dict>
    <key>UIApplicationSupportsMultipleScenes</key>
    <true/>
  </dict>
  <key>UILaunchScreen</key>
  <dict/>
  <key>UISupportedInterfaceOrientations</key>
  <array>
    <string>UIInterfaceOrientationPortrait</string>
    <string>UIInterfaceOrientationLandscapeLeft</string>
    <string>UIInterfaceOrientationLandscapeRight</string>
  </array>
  <key>UISupportedInterfaceOrientations~ipad</key>
  <array>
    <string>UIInterfaceOrientationPortrait</string>
    <string>UIInterfaceOrientationPortraitUpsideDown</string>
    <string>UIInterfaceOrientationLandscapeLeft</string>
    <string>UIInterfaceOrientationLandscapeRight</string>
  </array>
</dict>
</plist>`;
}

function detectDependencies(project: Project): { url: string; name: string; from: string }[] {
  const deps: { url: string; name: string; from: string }[] = [];
  const allContent = project.files.map((f) => f.content).join("\n");

  if (/\bimport Kingfisher\b/.test(allContent)) {
    deps.push({ url: "https://github.com/onevcat/Kingfisher.git", name: "Kingfisher", from: "8.0.0" });
  }
  if (/\bimport Alamofire\b/.test(allContent)) {
    deps.push({ url: "https://github.com/Alamofire/Alamofire.git", name: "Alamofire", from: "5.9.0" });
  }
  if (/\bimport Lottie\b/.test(allContent)) {
    deps.push({ url: "https://github.com/airbnb/lottie-ios.git", name: "Lottie", from: "4.4.0" });
  }
  if (/\bimport SDWebImage\b/.test(allContent)) {
    deps.push({ url: "https://github.com/SDWebImage/SDWebImage.git", name: "SDWebImage", from: "5.19.0" });
  }
  if (/\bimport SwiftLint\b/.test(allContent)) {
    deps.push({ url: "https://github.com/realm/SwiftLint.git", name: "SwiftLint", from: "0.55.0" });
  }

  return deps;
}

function generatePackageSwift(project: Project): string {
  const deps = detectDependencies(project);
  const depsBlock = deps
    .map((d) => `    .package(url: "${d.url}", from: "${d.from}"),`)
    .join("\n");
  const targetDeps = deps
    .map((d) => `        .product(name: "${d.name}", package: "${d.name}"),`)
    .join("\n");

  return `// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "${project.appName}",
  platforms: [
    .iOS(.v18),
  ],
  dependencies: [
${depsBlock}
  ],
  targets: [
    .executableTarget(
      name: "${project.appName}",
      dependencies: [
${targetDeps}
      ],
      path: "Sources"
    ),
  ]
)
`;
}

function generateProjectYml(project: Project): string {
  const deps = detectDependencies(project);
  const spmPackages = deps
    .map(
      (d) => `  ${d.name}:
    url: ${d.url}
    from: ${d.from}`,
    )
    .join("\n");

  const spmDeps = deps.map((d) => `        - package: ${d.name}`).join("\n");

  return `name: ${project.appName}
options:
  bundleIdPrefix: ${project.bundleId.split(".").slice(0, -1).join(".")}
  deploymentTarget:
    iOS: "18.0"
  xcodeVersion: "16.0"
  createIntermediateGroups: true
  generateEmptyDirectories: true
settings:
  base:
    SWIFT_VERSION: "6.0"
    ENABLE_USER_SCRIPT_SANDBOXING: "YES"
    SWIFT_STRICT_CONCURRENCY: "complete"
    IPHONEOS_DEPLOYMENT_TARGET: "18.0"
${spmPackages ? `packages:\n${spmPackages}` : ""}
targets:
  ${project.appName}:
    type: application
    platform: iOS
    sources:
      - path: Sources
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: ${project.bundleId}
        INFOPLIST_FILE: Sources/Info.plist
        GENERATE_INFOPLIST_FILE: false
        MARKETING_VERSION: "1.0"
        CURRENT_PROJECT_VERSION: "1"
${spmDeps ? `    dependencies:\n${spmDeps}` : ""}
`;
}

function generateGitignore(): string {
  return `# Xcode
*.xcodeproj/
!*.xcodeproj/project.pbxproj
*.xcworkspace/
!*.xcworkspace/contents.xcworkspacedata
DerivedData/
*.hmap
*.ipa
*.dSYM.zip
*.dSYM
*.moved-aside
*.pbxuser
!default.pbxuser
*.mode1v3
!default.mode1v3
*.mode2v3
!default.mode2v3
*.perspectivev3
!default.perspectivev3
xcuserdata/

# Swift Package Manager
.build/
.swiftpm/
Package.resolved

# OS
.DS_Store
*.swp
*~
`;
}

function generateReadme(project: Project): string {
  return `# ${project.appName}

${project.summary}

## Requirements

- Xcode 16+
- iOS 18.0+
- Swift 6.0

## Getting Started

### Option 1: Swift Package Manager (recommended)

1. Open the project folder in Xcode: **File → Open...**
2. Xcode will resolve SPM dependencies automatically
3. Select your target device and press **⌘R** to build and run

### Option 2: XcodeGen

1. Install XcodeGen: \`brew install xcodegen\`
2. Run \`xcodegen generate\` in the project root
3. Open \`${project.appName}.xcodeproj\`
4. Select your team in **Signing & Capabilities**
5. Press **⌘R** to build and run

## Project Structure

\`\`\`
Sources/
├── ${project.appName}App.swift    # App entry point
├── ContentView.swift              # Root view
├── Core/                          # Theme, utilities
├── Models/                        # Data models
├── Views/                         # SwiftUI views
└── Stores/                        # State management
\`\`\`

## Architecture

- **Swift 6** strict concurrency
- **@Observable** (Observation framework)
- **SwiftData** for persistence
- **NavigationStack** for routing

---

*Generated by [ApexBuild](https://apexbuild.ai)*
`;
}

export function XcodeExportButton({
  project,
  editedFiles,
  validation,
}: {
  project: Project;
  editedFiles: Map<string, string>;
  validation: { errors: { message: string }[] } | null;
}) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (validation && validation.errors.length > 0) {
      toast.error("Cannot export: project has validation errors");
      return;
    }

    setExporting(true);
    try {
      const zip = new JSZip();
      const root = zip.folder(project.appName)!;
      const sources = root.folder("Sources")!;

      for (const f of project.files) {
        const content = editedFiles.get(f.path) ?? f.content;
        sources.file(f.path, content);
      }

      sources.file("Info.plist", generateInfoPlist(project));

      root.file("Package.swift", generatePackageSwift(project));
      root.file("project.yml", generateProjectYml(project));
      root.file(".gitignore", generateGitignore());
      root.file("README.md", generateReadme(project));

      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `${project.appName}-xcode.zip`);
      toast.success("Xcode project exported — open in Xcode or run xcodegen");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="glass-panel p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-medium mb-1">
            <Apple size={12} /> Xcode Project Export
          </div>
          <h3 className="font-display text-lg font-semibold">
            Ready-to-open Xcode project
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Downloads a complete project with <code className="text-primary text-xs bg-card/60 px-1 py-0.5 rounded">Package.swift</code>,{" "}
            <code className="text-primary text-xs bg-card/60 px-1 py-0.5 rounded">project.yml</code>,{" "}
            <code className="text-primary text-xs bg-card/60 px-1 py-0.5 rounded">Info.plist</code>,
            and auto-detected SPM dependencies. Open in Xcode and hit Run.
          </p>
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting || (!!validation && validation.errors.length > 0)}
          size="lg"
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow-md)]"
        >
          {exporting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Exporting…
            </>
          ) : (
            <>
              <Download size={16} />
              Export for Xcode
            </>
          )}
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card/30 rounded-lg px-3 py-2 border border-border/40">
          <Package size={12} className="text-primary shrink-0" />
          <span>Package.swift with SPM deps</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card/30 rounded-lg px-3 py-2 border border-border/40">
          <FolderOpen size={12} className="text-primary shrink-0" />
          <span>Sources/ directory structure</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card/30 rounded-lg px-3 py-2 border border-border/40">
          <Apple size={12} className="text-primary shrink-0" />
          <span>Info.plist + project.yml</span>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border/40 bg-[hsl(228_20%_4%)] p-4">
        <p className="text-xs font-mono text-muted-foreground mb-2">Quick start after export:</p>
        <ol className="text-xs font-mono text-foreground/80 space-y-1 list-decimal list-inside">
          <li>Unzip <span className="text-primary">{project.appName}-xcode.zip</span></li>
          <li>Open folder in Xcode 16+ (File → Open)</li>
          <li>Set your Development Team in Signing & Capabilities</li>
          <li>Press <span className="text-primary">⌘R</span> to build and run</li>
        </ol>
      </div>
    </div>
  );
}
