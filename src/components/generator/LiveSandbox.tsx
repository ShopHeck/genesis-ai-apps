import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Maximize2,
  Minimize2,
  CheckCircle2,
  XCircle,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project } from "./types";

type SandboxStatus = "idle" | "loading" | "ready" | "error";

interface SandboxMessage {
  type: "sandbox-ready" | "sandbox-error" | "sandbox-log";
  message?: string;
  level?: string;
}

/**
 * Bundles generated web app files into a self-contained HTML document that
 * actually renders React components using Babel standalone + a lightweight
 * CommonJS module system with shims for react-router-dom, lucide-react, and
 * framer-motion.
 */
function bundleWebAppToHtml(project: Project): string {
  const files = project.files;

  // Collect source files (skip build configs)
  const sourceFiles = files.filter(
    (f) =>
      (f.path.endsWith(".tsx") || f.path.endsWith(".ts") ||
       f.path.endsWith(".jsx") || f.path.endsWith(".js")) &&
      !f.path.includes("vite.config") && !f.path.includes("tailwind.config") &&
      !f.path.includes("postcss.config") && !f.path.includes("tsconfig") &&
      !f.path.endsWith(".d.ts"),
  );

  // Extract CSS (strip @tailwind / @import directives)
  const cssContent = files
    .filter((f) => f.path.endsWith(".css"))
    .map((f) =>
      f.content.split("\n")
        .filter((l) => !l.trim().startsWith("@tailwind") && !l.trim().startsWith("@import"))
        .join("\n"),
    )
    .join("\n");

  // Design tokens
  const plan = project.plan ?? {};
  const ds = (plan.designSystem ?? {}) as Record<string, string>;
  const accentColor = ds.accentColorHex ?? (plan.accentColorHex as string) ?? "#6366f1";
  const bgPrimary = ds.backgroundPrimary ?? "#0a0a0a";
  const bgSecondary = ds.backgroundSecondary ?? "#111111";
  const surfaceColor = ds.surfaceColor ?? "#1a1a1a";
  const textPrimary = ds.textPrimary ?? "#f5f5f5";
  const textSecondary = ds.textSecondary ?? "#a3a3a3";
  const borderRadius = ds.borderRadius ?? "12px";
  const fontFamily = ds.fontFamily ?? "'Inter', system-ui, sans-serif";

  // Serialize source files — escape </ to prevent closing script tag in HTML
  const safeJson = JSON.stringify(
    sourceFiles.map((f) => ({ path: f.path, content: f.content })),
  ).replace(/<\//g, "<\\/");

  const fontList = fontFamily.split(",").map((f) => `'${f.trim().replace(/'/g, "")}'`).join(", ");
  const CS = "<" + "/script>";

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${project.appName} — Live Preview</title>
  <style>
    :root {
      --accent: ${accentColor}; --bg-primary: ${bgPrimary}; --bg-secondary: ${bgSecondary};
      --surface: ${surfaceColor}; --text-primary: ${textPrimary}; --text-secondary: ${textSecondary};
      --radius: ${borderRadius};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: ${bgPrimary}; color: ${textPrimary}; font-family: ${fontFamily};
      overflow-x: hidden; -webkit-font-smoothing: antialiased; }
    ${cssContent}
    .sb-skel { animation: sbShim 1.5s infinite;
      background: linear-gradient(90deg, ${surfaceColor} 25%, ${bgSecondary} 50%, ${surfaceColor} 75%);
      background-size: 200% 100%; border-radius: 8px; }
    @keyframes sbShim { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    #sandbox-loading { display:flex; flex-direction:column; min-height:100vh; padding:20px; gap:12px; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
  </style>
</head>
<body>
  <div id="sandbox-loading">
    <div><div class="sb-skel" style="width:35%;height:22px;margin-bottom:6px"></div>
    <div class="sb-skel" style="width:55%;height:14px"></div></div>
    <div class="sb-skel" style="height:100px;border:1px solid rgba(255,255,255,0.06);border-radius:${borderRadius}"></div>
    <div class="sb-skel" style="height:70px;border-radius:${borderRadius}"></div>
    <div class="sb-skel" style="height:70px;border-radius:${borderRadius}"></div>
    <div class="sb-skel" style="height:50px;border-radius:${borderRadius}"></div>
    <div style="margin-top:auto;display:flex;gap:8px">
      <div class="sb-skel" style="flex:1;height:36px"></div>
      <div class="sb-skel" style="flex:1;height:36px"></div>
      <div class="sb-skel" style="flex:1;height:36px"></div>
    </div>
    <p style="text-align:center;font-size:11px;color:${textSecondary};margin-top:8px">Loading preview…</p>
  </div>
  <div id="root" style="display:none"></div>

  <script src="https://cdn.tailwindcss.com">${CS}
  <script>tailwind.config={darkMode:'class',theme:{extend:{colors:{accent:'${accentColor}',
    primary:{DEFAULT:'${accentColor}',foreground:'#ffffff'},surface:'${surfaceColor}',
    'bg-primary':'${bgPrimary}','bg-secondary':'${bgSecondary}'},
    borderRadius:{card:'${borderRadius}'},fontFamily:{sans:[${fontList}]}}}};${CS}
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js">${CS}
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js">${CS}
  <script src="https://unpkg.com/@babel/standalone@7/babel.min.js">${CS}

  <script>
  (function(){
    'use strict';
    var h = React.createElement;
    var __files = ${safeJson};
    var __compiled = {}, __cache = {};

    function norm(p){var s=p.split('/'),r=[];for(var i=0;i<s.length;i++){if(s[i]==='..')r.pop();else if(s[i]!=='.'&&s[i]!=='')r.push(s[i]);}return r.join('/');}
    function rel(d,p){return p.startsWith('./')||p.startsWith('../')?norm(d+'/'+p):p;}
    function find(n){if(__compiled[n])return n;var e=['.tsx','.ts','.jsx','.js'];for(var i=0;i<e.length;i++)if(__compiled[n+e[i]])return n+e[i];var x=['/index.tsx','/index.ts','/index.jsx','/index.js'];for(var j=0;j<x.length;j++)if(__compiled[n+x[j]])return n+x[j];return null;}

    /* ── React Router DOM shim (hash-based) ── */
    var __path='/',__rl=[];
    function nr(){__path=location.hash.slice(1)||'/';__rl.forEach(function(f){f(__path);});}
    window.addEventListener('hashchange',nr);

    function useLocation(){var s=React.useState(__path);React.useEffect(function(){var f=function(p){s[1](p);};__rl.push(f);return function(){__rl=__rl.filter(function(l){return l!==f;});};},[]); return{pathname:s[0],search:'',hash:'',state:null,key:'default'};}
    function useNavigate(){return function(to){if(typeof to==='number'){window.history.go(to);return;}location.hash=typeof to==='string'?to:(to&&to.pathname)||'/';};}
    function useParams(){var loc=useLocation();return new Proxy({},{get:function(_,k){var s=loc.pathname.split('/').filter(Boolean);return s[s.length-1]||'';}});}
    function useSearchParams(){return[new URLSearchParams(location.search),function(){}];}

    var Link=React.forwardRef(function(p,r){var to=p.to,ch=p.children;return h('a',{ref:r,className:p.className,style:p.style,href:'#'+(typeof to==='string'?to:(to&&to.pathname)||'/'),onClick:function(e){e.preventDefault();location.hash=typeof to==='string'?to:(to&&to.pathname)||'/';if(p.onClick)p.onClick(e);}},ch);});

    function mr(pat,pn){if(pat==='*'||pat==='/*')return true;var a=pat.replace(/^\\//,'').split('/'),b=pn.replace(/^\\//,'').split('/');if(a.length!==b.length)return false;for(var i=0;i<a.length;i++){if(a[i].startsWith(':'))continue;if(a[i]!==b[i])return false;}return true;}
    function Routes(p){var loc=useLocation(),ch=React.Children.toArray(p.children);for(var i=0;i<ch.length;i++){var c=ch[i];if(c&&c.props&&mr(c.props.path||'/',loc.pathname))return c.props.element||null;}return ch.length>0&&ch[0].props?ch[0].props.element||null:null;}
    function Route(){return null;}
    function BR(p){return p.children;}
    function Nav(p){React.useEffect(function(){location.hash=p.to||'/';},[]); return null;}

    var routerShim={BrowserRouter:BR,HashRouter:BR,Routes:Routes,Route:Route,Link:Link,NavLink:Link,Navigate:Nav,Outlet:function(){return null;},useNavigate:useNavigate,useLocation:useLocation,useParams:useParams,useSearchParams:useSearchParams,createBrowserRouter:function(){return{};},RouterProvider:function(p){return p.children||null;}};

    /* ── Lucide React shim ── */
    var lucideShim=new Proxy({},{get:function(_,prop){if(typeof prop!=='string')return undefined;var IC=React.forwardRef(function(p,r){var sz=(p&&p.size)||24;return h('svg',{ref:r,width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round',className:(p&&p.className)||'',style:p&&p.style,onClick:p&&p.onClick},h('circle',{cx:12,cy:12,r:10}),h('line',{x1:12,y1:8,x2:12,y2:16}),h('line',{x1:8,y1:12,x2:16,y2:12}));});IC.displayName=prop;return IC;}});

    /* ── Framer Motion shim ── */
    var motionProxy=new Proxy({},{get:function(_,tag){if(typeof tag!=='string')return undefined;return React.forwardRef(function(p,r){var c={};var sk=['initial','animate','exit','transition','whileHover','whileTap','whileInView','variants','layout','layoutId','drag','dragConstraints','onDragEnd','whileFocus'];Object.keys(p||{}).forEach(function(k){if(sk.indexOf(k)===-1)c[k]=p[k];});return h(tag,Object.assign({},c,{ref:r}));});}});
    var motionShim={motion:motionProxy,AnimatePresence:function(p){return p.children||null;},useAnimation:function(){return{start:function(){},stop:function(){}};},useInView:function(){return[React.useRef(null),true];},useScroll:function(){return{scrollY:{get:function(){return 0;}},scrollYProgress:{get:function(){return 0;}}};},useTransform:function(v){return v;},useMotionValue:function(v){return{get:function(){return v;},set:function(){}};},useSpring:function(v){return v;}};

    /* ── Toast / Sonner shim ── */
    var tf=function(m){console.log('[toast]',m);};tf.success=tf;tf.error=tf;tf.info=tf;tf.warning=tf;
    var sonnerShim={toast:tf,Toaster:function(){return null;}};

    /* ── Utility shims ── */
    function cn(){return Array.prototype.slice.call(arguments).filter(function(a){return typeof a==='string'&&a;}).join(' ');}

    var externals={
      'react':function(){return React;},'react-dom':function(){return ReactDOM;},
      'react-dom/client':function(){return{createRoot:ReactDOM.createRoot};},
      'react-router-dom':function(){return routerShim;},
      'lucide-react':function(){return lucideShim;},
      'framer-motion':function(){return motionShim;},
      'sonner':function(){return sonnerShim;},
      '@radix-ui/react-slot':function(){return{Slot:React.forwardRef(function(p,r){return h('span',{ref:r},p.children);})};},
      'class-variance-authority':function(){return{cva:function(b){return function(){return b;};}};},
      'clsx':function(){return{clsx:cn,default:cn};},
      'tailwind-merge':function(){return{twMerge:cn};},
      '@/lib/utils':function(){return{cn:cn};}
    };

    /* ── Module require ── */
    function req(name,fromDir){
      for(var key in externals){if(name===key)return externals[key]();if(name.startsWith(key+'/') && key!=='@/lib')return externals[key]();}
      if(/\\.(css|scss|less|svg|png|jpg|gif|webp)$/.test(name))return{};
      if(name.startsWith('@/'))name='src/'+name.slice(2);
      var resolved=name;
      if(name.startsWith('./')||name.startsWith('../')){resolved=rel(fromDir||'src',name);}
      else if(!name.startsWith('src/')&&!name.startsWith('server/')){
        var tries=['src/lib/'+name,'src/'+name,name];
        for(var t=0;t<tries.length;t++){var f=find(tries[t]);if(f){resolved=f;break;}}
      }
      var mp=find(resolved);
      if(!mp){console.warn('[sandbox] Module not found:',name,'(from:',fromDir,')');
        return new Proxy({},{get:function(_,p){if(p==='default')return function(){return null;};if(p==='__esModule')return true;return function(){return null;};}});}
      if(__cache[mp])return __cache[mp];
      var mod={exports:{}};__cache[mp]=mod.exports;
      try{var dir=mp.split('/').slice(0,-1).join('/');
        var fn=new Function('module','exports','require','React','console',__compiled[mp]);
        fn(mod,mod.exports,function(d){return req(d,dir);},React,console);
        if(mod.exports!==__cache[mp])__cache[mp]=mod.exports;
      }catch(e){console.error('[sandbox] Runtime error in '+mp+':',e.message);}
      return __cache[mp];
    }

    /* ── Transpile & mount ── */
    try{
      for(var i=0;i<__files.length;i++){
        var file=__files[i],path=file.path;
        if(!path.match(/\\.(tsx?|jsx?|js)$/))continue;
        try{
          var code=file.content;
          code=code.replace(/^import\\s+['"][^'"]*\\.css['"];?\\s*$/gm,'');
          code=code.replace(/^import\\s+['"][^'"]*\\.scss['"];?\\s*$/gm,'');
          code=code.replace(/^import\\s+\\w+\\s+from\\s+['"][^'"]*\\.(svg|png|jpg|gif|webp)['"];?\\s*$/gm,'');
          var r=Babel.transform(code,{
            presets:[['react',{runtime:'classic'}],['typescript',{isTSX:path.endsWith('.tsx')||path.endsWith('.jsx'),allExtensions:true}]],
            plugins:['transform-modules-commonjs'],filename:path});
          __compiled[path]=r.code;
        }catch(e){console.error('[sandbox] Transpile:',path,e.message);}
      }

      document.getElementById('sandbox-loading').style.display='none';
      document.getElementById('root').style.display='';

      var ae=req('src/App.tsx','src')||req('src/App','src');
      var App=ae&&(ae.default||ae.App);
      if(typeof App!=='function'){
        req('src/main.tsx','src');
        if(document.getElementById('root').children.length>0){
          window.parent.postMessage({type:'sandbox-ready'},'*');
          window.parent.postMessage({type:'preview-ready'},'*');return;
        }
        throw new Error('App component not found. Files: '+Object.keys(__compiled).join(', '));
      }
      ReactDOM.createRoot(document.getElementById('root')).render(h(App));
      window.parent.postMessage({type:'sandbox-ready'},'*');
      window.parent.postMessage({type:'preview-ready'},'*');
    }catch(e){
      console.error('[sandbox] Boot:',e);
      var el=document.getElementById('sandbox-loading');
      if(el){el.innerHTML='<div style="padding:32px;text-align:center"><p style="font-size:14px;font-weight:600;color:${textPrimary};margin-bottom:8px">Preview Error</p><p style="font-size:12px;font-family:monospace;color:${textSecondary};opacity:0.8;word-break:break-all">'+(e.message||'Unknown error').replace(/</g,'&lt;')+'</p></div>';el.style.display='flex';el.style.alignItems='center';el.style.justifyContent='center';}
      window.parent.postMessage({type:'sandbox-error',message:e.message||'Boot error'},'*');
      window.parent.postMessage({type:'preview-runtime-error',message:e.message||'Boot error'},'*');
    }
    window.onerror=function(msg){window.parent.postMessage({type:'sandbox-error',message:String(msg)},'*');window.parent.postMessage({type:'preview-runtime-error',message:String(msg)},'*');};
  })();
  ${CS}
</body>
</html>`;
}

export function LiveSandbox({
  project,
  target,
  onPreviewHtml,
}: {
  project: Project;
  target: "ios" | "web";
  onPreviewHtml?: (html: string) => void;
}) {
  const [status, setStatus] = useState<SandboxStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [sandboxHtml, setSandboxHtml] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const buildSandbox = useCallback(() => {
    if (target !== "web") return;

    setStatus("loading");
    setError(null);
    setLogs([]);

    try {
      const html = bundleWebAppToHtml(project);
      setSandboxHtml(html);
      onPreviewHtml?.(html);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build sandbox");
      setStatus("error");
    }
  }, [project, target, onPreviewHtml]);

  // Listen for sandbox messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data as SandboxMessage;
      if (data?.type === "sandbox-ready") {
        setStatus("ready");
      } else if (data?.type === "sandbox-error") {
        setError(data.message ?? "Sandbox error");
        setStatus("error");
      } else if (data?.type === "sandbox-log") {
        setLogs((prev) => [...prev.slice(-50), `[${data.level ?? "log"}] ${data.message}`]);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Auto-build on mount for web projects
  useEffect(() => {
    if (target === "web" && !sandboxHtml) {
      buildSandbox();
    }
  }, [target, sandboxHtml, buildSandbox]);

  // Escape to exit fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreen) setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  // Only show for web target
  if (target !== "web") return null;

  const statusIcon = status === "ready" ? (
    <CheckCircle2 size={12} className="text-emerald-400" />
  ) : status === "error" ? (
    <XCircle size={12} className="text-destructive" />
  ) : status === "loading" ? (
    <Loader2 size={12} className="animate-spin text-primary" />
  ) : null;

  return (
    <div className={fullscreen ? "fixed inset-0 z-50 bg-background flex flex-col" : "glass-panel overflow-hidden"}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-card/40">
        <div className="flex items-center gap-2">
          <Play size={14} className="text-primary" />
          <span className="text-xs font-medium text-foreground">Live Sandbox</span>
          <div className="flex items-center gap-1.5">
            {statusIcon}
            <span className="text-[10px] text-muted-foreground">
              {status === "ready" ? "Running" : status === "loading" ? "Building…" : status === "error" ? "Error" : "Idle"}
            </span>
          </div>
          <span className="text-[9px] text-emerald-400/80 bg-emerald-400/10 px-1.5 py-0.5 rounded">
            live code
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setShowLogs(!showLogs)}
            title="Toggle console"
          >
            <Terminal size={13} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={buildSandbox}
            title="Rebuild sandbox"
          >
            <RefreshCw size={13} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </Button>
        </div>
      </div>

      {/* Sandbox iframe */}
      <div className="flex-1" style={{ height: fullscreen ? "calc(100vh - 44px)" : 480 }}>
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Loader2 className="animate-spin text-primary" size={28} />
            <p className="text-sm">Building live sandbox…</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
            <AlertTriangle className="text-destructive" size={28} />
            <p className="text-sm text-foreground font-medium">Sandbox build failed</p>
            <p className="text-xs text-muted-foreground max-w-md">{error}</p>
            <Button onClick={buildSandbox} size="sm" variant="outline" className="mt-2">
              <RefreshCw size={12} /> Retry
            </Button>
          </div>
        )}

        {(status === "ready" || status === "idle") && sandboxHtml && (
          <iframe
            ref={iframeRef}
            title={`${project.appName} live sandbox`}
            srcDoc={sandboxHtml}
            sandbox="allow-scripts allow-forms allow-same-origin"
            className="w-full h-full border-0"
            style={{ colorScheme: "dark" }}
          />
        )}
      </div>

      {/* Console logs */}
      {showLogs && logs.length > 0 && (
        <div className="border-t border-border/40 bg-[hsl(228_20%_4%)] max-h-32 overflow-auto">
          <div className="px-3 py-1 border-b border-border/40 flex items-center gap-1.5">
            <Terminal size={10} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Console ({logs.length})</span>
          </div>
          <div className="p-2 font-mono text-[11px] space-y-0.5">
            {logs.map((log, i) => (
              <div key={i} className="text-muted-foreground/80">{log}</div>
            ))}
          </div>
        </div>
      )}

      {fullscreen && (
        <p className="text-[10px] text-muted-foreground/60 text-center py-1.5 shrink-0">
          Press Esc to exit fullscreen · Live sandbox running generated code
        </p>
      )}
    </div>
  );
}
