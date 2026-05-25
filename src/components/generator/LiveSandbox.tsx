import { useState, useRef, useEffect, useCallback } from "react";
import {
  Smartphone,
  Tablet,
  Monitor,
  Globe,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Maximize2,
  Minimize2,
  Terminal,
  Filter,
  RotateCcw,
  RotateCw,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project } from "./types";

type SandboxStatus = "idle" | "loading" | "ready" | "error";
type LogLevel = "info" | "warn" | "error" | "log";
type DeviceMode = "mobile" | "tablet" | "desktop";
type Orientation = "portrait" | "landscape";

interface SandboxLog {
  level: LogLevel;
  message: string;
  timestamp: number;
}

interface SandboxMessage {
  type: "sandbox-ready" | "sandbox-error" | "sandbox-log";
  message?: string;
  level?: string;
}

const DEVICE_CONFIG: Record<DeviceMode, {
  label: string;
  icon: typeof Smartphone;
  iframeW: number;
  iframeH: number;
  frameClass: string;
  frameRadius: string;
  notch: boolean;
  hint: string;
  supportsRotation: boolean;
}> = {
  mobile: {
    label: "Mobile",
    icon: Smartphone,
    iframeW: 390,
    iframeH: 844,
    frameClass: "rounded-[44px] p-[10px]",
    frameRadius: "36px",
    notch: true,
    hint: "iPhone 15 · 390×844",
    supportsRotation: true,
  },
  tablet: {
    label: "Tablet",
    icon: Tablet,
    iframeW: 820,
    iframeH: 1180,
    frameClass: "rounded-[24px] p-[12px]",
    frameRadius: "16px",
    notch: false,
    hint: "iPad · 820×1180",
    supportsRotation: true,
  },
  desktop: {
    label: "Desktop",
    icon: Monitor,
    iframeW: 1280,
    iframeH: 800,
    frameClass: "rounded-[12px] p-[8px]",
    frameRadius: "4px",
    notch: false,
    hint: "Desktop · 1280×800",
    supportsRotation: false,
  },
};

const PREVIEW_PANEL_MAX_W = 820;
const PREVIEW_PANEL_MAX_H = 640;
const FULLSCREEN_PADDING = 48;

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
    var __origUC=React.useContext;React.useContext=function(c){var v=__origUC.call(React,c);return v==null?{}:v;};
    var __origCC=React.createContext;React.createContext=function(d){return __origCC.call(React,d==null?{}:d);};
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

    /* ── date-fns shim ── */
    var dateFnsShim={format:function(d,f){try{return new Date(d).toLocaleDateString();}catch(e){return String(d);}},formatDistance:function(a,b){return'recently';},formatRelative:function(a,b){return new Date(a).toLocaleDateString();},subDays:function(d,n){var r=new Date(d);r.setDate(r.getDate()-n);return r;},addDays:function(d,n){var r=new Date(d);r.setDate(r.getDate()+n);return r;},startOfWeek:function(d){var r=new Date(d);r.setDate(r.getDate()-r.getDay());return r;},endOfWeek:function(d){var r=new Date(d);r.setDate(r.getDate()+(6-r.getDay()));return r;},isAfter:function(a,b){return new Date(a)>new Date(b);},isBefore:function(a,b){return new Date(a)<new Date(b);},parseISO:function(s){return new Date(s);},differenceInDays:function(a,b){return Math.round((new Date(a).getTime()-new Date(b).getTime())/86400000);}};

    /* ── Recharts shim ── */
    var rcNoop=function(p){return h('div',{className:p&&p.className,style:Object.assign({width:p&&p.width||'100%',height:p&&p.height||200},p&&p.style||{})},p&&p.children);};
    var rechartsShim={ResponsiveContainer:rcNoop,LineChart:rcNoop,BarChart:rcNoop,AreaChart:rcNoop,PieChart:rcNoop,RadarChart:rcNoop,ComposedChart:rcNoop,Line:function(){return null;},Bar:function(){return null;},Area:function(){return null;},Pie:function(){return null;},XAxis:function(){return null;},YAxis:function(){return null;},CartesianGrid:function(){return null;},Tooltip:function(){return null;},Legend:function(){return null;},Cell:function(){return null;},RadialBar:function(){return null;},Radar:function(){return null;},PolarGrid:function(){return null;},PolarAngleAxis:function(){return null;},PolarRadiusAxis:function(){return null;}};

    /* ── Zod shim ── */
    var zChain={string:function(){return zChain;},number:function(){return zChain;},boolean:function(){return zChain;},array:function(){return zChain;},object:function(){return zChain;},optional:function(){return zChain;},nullable:function(){return zChain;},min:function(){return zChain;},max:function(){return zChain;},email:function(){return zChain;},url:function(){return zChain;},uuid:function(){return zChain;},regex:function(){return zChain;},default:function(){return zChain;},transform:function(){return zChain;},refine:function(){return zChain;},parse:function(v){return v;},safeParse:function(v){return{success:true,data:v};},enum:function(){return zChain;}};
    var zodShim={z:Object.assign(function(){return zChain;},zChain,{infer:undefined,enum:function(){return zChain;},union:function(){return zChain;},intersection:function(){return zChain;},literal:function(){return zChain;},tuple:function(){return zChain;},record:function(){return zChain;},map:function(){return zChain;},any:function(){return zChain;},unknown:function(){return zChain;},void:function(){return zChain;},never:function(){return zChain;},coerce:{string:function(){return zChain;},number:function(){return zChain;},boolean:function(){return zChain;},date:function(){return zChain;}}}),ZodError:function(issues){this.issues=issues||[];}};

    /* ── Headless UI shim ── */
    var hTab=function(p){return h('div',{className:p&&p.className},p&&p.children);};
    hTab.Group=function(p){return h('div',{className:p&&p.className},p&&p.children);};
    hTab.List=function(p){return h('div',{className:p&&p.className,role:'tablist'},p&&p.children);};
    hTab.Panels=function(p){return h('div',{className:p&&p.className},p&&p.children);};
    hTab.Panel=function(p){return h('div',{className:p&&p.className,role:'tabpanel'},p&&p.children);};
    var headlessShim={Dialog:function(p){return p.open?h('div',{className:p&&p.className,role:'dialog'},p&&p.children):null;},Transition:Object.assign(function(p){return p.show!==false?h('div',{className:p&&p.className},p&&p.children):null;},{Child:function(p){return h('div',{className:p&&p.className},p&&p.children);},Root:function(p){return p.show!==false?h('div',{className:p&&p.className},p&&p.children):null;}}),Menu:Object.assign(function(p){return h('div',{className:p&&p.className},p&&p.children);},{Button:function(p){return h('button',{className:p&&p.className,onClick:p&&p.onClick},p&&p.children);},Items:function(p){return h('div',{className:p&&p.className,role:'menu'},p&&p.children);},Item:function(p){return h('div',{className:p&&p.className,role:'menuitem'},typeof p.children==='function'?p.children({active:false}):p&&p.children);}}),Listbox:Object.assign(function(p){return h('div',{className:p&&p.className},p&&p.children);},{Button:function(p){return h('button',{className:p&&p.className},p&&p.children);},Options:function(p){return h('div',{className:p&&p.className},p&&p.children);},Option:function(p){return h('div',{className:p&&p.className},typeof p.children==='function'?p.children({active:false,selected:false}):p&&p.children);}}),Switch:function(p){return h('button',{className:p&&p.className,role:'switch','aria-checked':!!p.checked,onClick:function(){if(p.onChange)p.onChange(!p.checked);}},p&&p.children);},Disclosure:Object.assign(function(p){return h('div',{className:p&&p.className},typeof p.children==='function'?p.children({open:true}):p&&p.children);},{Button:function(p){return h('button',{className:p&&p.className,onClick:p&&p.onClick},p&&p.children);},Panel:function(p){return h('div',{className:p&&p.className},p&&p.children);}}),Tab:hTab,Popover:Object.assign(function(p){return h('div',{className:p&&p.className},p&&p.children);},{Button:function(p){return h('button',{className:p&&p.className},p&&p.children);},Panel:function(p){return h('div',{className:p&&p.className},p&&p.children);}})};

    /* ── @tanstack/react-query shim ── */
    var queryShim={QueryClient:function(){return{};},QueryClientProvider:function(p){return p.children||null;},useQuery:function(opts){return{data:undefined,isLoading:false,error:null,refetch:function(){}};},useMutation:function(){return{mutate:function(){},mutateAsync:function(){return Promise.resolve();},isLoading:false,error:null};},useQueryClient:function(){return{invalidateQueries:function(){},setQueryData:function(){}};}};

    /* ── react-hook-form shim ── */
    var rhfShim={useForm:function(){return{register:function(n){return{name:n,onChange:function(){},onBlur:function(){},ref:function(){}};},handleSubmit:function(fn){return function(e){if(e&&e.preventDefault)e.preventDefault();fn({});};},watch:function(){return '';},setValue:function(){},getValues:function(){return{};},formState:{errors:{},isSubmitting:false,isValid:true},control:{},reset:function(){}};},Controller:function(p){return typeof p.render==='function'?p.render({field:{value:'',onChange:function(){},onBlur:function(){},name:p.name||'',ref:function(){}},fieldState:{error:undefined}}):null;},FormProvider:function(p){return p.children;},useFormContext:function(){return{register:function(n){return{name:n};},watch:function(){return '';},formState:{errors:{}}};}};

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
      '@/lib/utils':function(){return{cn:cn};},
      'date-fns':function(){return dateFnsShim;},
      'recharts':function(){return rechartsShim;},
      'zod':function(){return zodShim;},
      '@headlessui/react':function(){return headlessShim;},
      '@tanstack/react-query':function(){return queryShim;},
      'react-hook-form':function(){return rhfShim;},
      'axios':function(){return{default:Object.assign(function(cfg){return Promise.resolve({data:{},status:200});},{get:function(u){return Promise.resolve({data:{},status:200});},post:function(u,d){return Promise.resolve({data:{},status:200});},put:function(u,d){return Promise.resolve({data:{},status:200});},delete:function(u){return Promise.resolve({data:{},status:200});},create:function(){return this;}})};}
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
        return new Proxy({},{get:function(_,p){if(p==='default')return function(){return null;};if(p==='__esModule')return true;return function(){return {};};}});}
      if(__cache[mp])return __cache[mp];
      var mod={exports:{}};__cache[mp]=mod.exports;
      try{var dir=mp.split('/').slice(0,-1).join('/');
        var fn=new Function('module','exports','require','React','console',__compiled[mp]);
        fn(mod,mod.exports,function(d){return req(d,dir);},React,console);
        if(mod.exports!==__cache[mp])__cache[mp]=mod.exports;
      }catch(e){console.error('[sandbox] Runtime error in '+mp+':',e.message);}
      return __cache[mp];
    }

    /* ── Error boundary component ── */
    var ErrorBoundary=(function(){
      function EB(props){this.props=props;this.state={hasError:false,error:null};}
      EB.prototype=Object.create(React.Component.prototype);
      EB.prototype.constructor=EB;
      EB.getDerivedStateFromError=function(e){return{hasError:true,error:e};};
      EB.prototype.componentDidCatch=function(e,info){console.error('[sandbox] Component error:',e.message);window.parent.postMessage({type:'sandbox-log',level:'error',message:'Component crash: '+e.message},'*');};
      EB.prototype.render=function(){if(this.state.hasError){return h('div',{style:{padding:'16px',margin:'8px',borderRadius:'8px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)'}},h('p',{style:{fontSize:'12px',fontWeight:600,color:'#ef4444',marginBottom:'4px'}},'Component Error'),h('p',{style:{fontSize:'11px',fontFamily:'monospace',color:'${textSecondary}',wordBreak:'break-all'}},(this.state.error&&this.state.error.message)||'Unknown error'),h('button',{onClick:function(){this.setState({hasError:false,error:null});}.bind(this),style:{marginTop:'8px',fontSize:'11px',padding:'4px 10px',borderRadius:'6px',background:'rgba(255,255,255,0.1)',color:'${textPrimary}',border:'1px solid rgba(255,255,255,0.2)',cursor:'pointer'}},'Retry'));}return this.props.children;};
      return EB;
    })();

    /* ── Console interceptor with levels ── */
    var origLog=console.log,origWarn=console.warn,origErr=console.error,origInfo=console.info;
    function sendLog(level,args){var msg=Array.prototype.slice.call(args).map(function(a){return typeof a==='object'?JSON.stringify(a):String(a);}).join(' ');window.parent.postMessage({type:'sandbox-log',level:level,message:msg},'*');}
    console.log=function(){sendLog('log',arguments);origLog.apply(console,arguments);};
    console.warn=function(){sendLog('warn',arguments);origWarn.apply(console,arguments);};
    console.error=function(){sendLog('error',arguments);origErr.apply(console,arguments);};
    console.info=function(){sendLog('info',arguments);origInfo.apply(console,arguments);};

    /* ── Transpile & mount ── */
    var __root=null;
    function compileAll(){
      __compiled={};__cache={};
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
    }

    function renderApp(){
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
      if(!__root) __root=ReactDOM.createRoot(document.getElementById('root'));
      __root.render(h(ErrorBoundary,null,h(App)));
      window.parent.postMessage({type:'sandbox-ready'},'*');
      window.parent.postMessage({type:'preview-ready'},'*');
    }

    try{
      compileAll();
      renderApp();
    }catch(e){
      console.error('[sandbox] Boot:',e);
      var el=document.getElementById('sandbox-loading');
      if(el){el.innerHTML='<div style="padding:32px;text-align:center"><p style="font-size:14px;font-weight:600;color:${textPrimary};margin-bottom:8px">Preview Error</p><p style="font-size:12px;font-family:monospace;color:${textSecondary};opacity:0.8;word-break:break-all">'+(e.message||'Unknown error').replace(/</g,'&lt;')+'</p></div>';el.style.display='flex';el.style.alignItems='center';el.style.justifyContent='center';}
      window.parent.postMessage({type:'sandbox-error',message:e.message||'Boot error'},'*');
      window.parent.postMessage({type:'preview-runtime-error',message:e.message||'Boot error'},'*');
    }
    window.onerror=function(msg){window.parent.postMessage({type:'sandbox-error',message:String(msg)},'*');window.parent.postMessage({type:'preview-runtime-error',message:String(msg)},'*');};

    /* ── HMR: hot-swap patched files from parent ── */
    window.addEventListener('message',function(ev){
      if(ev.data&&ev.data.type==='hmr-update'&&ev.data.files){
        var patchedFiles=ev.data.files;
        for(var i=0;i<patchedFiles.length;i++){
          var pf=patchedFiles[i];
          var idx=__files.findIndex(function(f){return f.path===pf.path;});
          if(idx>=0)__files[idx]=pf;else __files.push(pf);
        }
        try{compileAll();renderApp();window.parent.postMessage({type:'sandbox-log',level:'info',message:'[HMR] '+patchedFiles.length+' file(s) hot-swapped'},'*');}catch(e){console.error('[HMR] Re-render failed:',e.message);}
      }
    });
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
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [logs, setLogs] = useState<SandboxLog[]>([]);
  const [sandboxHtml, setSandboxHtml] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [fullscreen, setFullscreen] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<LogLevel | "all">("all");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const cfg = DEVICE_CONFIG[device];
  const effectiveW = orientation === "landscape" && cfg.supportsRotation ? cfg.iframeH : cfg.iframeW;
  const effectiveH = orientation === "landscape" && cfg.supportsRotation ? cfg.iframeW : cfg.iframeH;

  const maxW = fullscreen ? window.innerWidth - FULLSCREEN_PADDING * 2 : PREVIEW_PANEL_MAX_W;
  const maxH = fullscreen ? window.innerHeight - FULLSCREEN_PADDING * 2 - 80 : PREVIEW_PANEL_MAX_H;
  const scaleW = maxW / effectiveW;
  const scaleH = maxH / effectiveH;
  const scale = Math.min(scaleW, scaleH, 1);
  const visW = Math.round(effectiveW * scale);
  const visH = Math.round(effectiveH * scale);

  const buildSandbox = useCallback(() => {
    if (target !== "web") return;

    setStatus("loading");
    setError(null);
    setRuntimeError(null);
    setLogs([] as SandboxLog[]);

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
        setRuntimeError(null);
      } else if (data?.type === "sandbox-error") {
        setRuntimeError(data.message ?? "Sandbox error");
      } else if (data?.type === "sandbox-log") {
        const level = (data.level ?? "log") as LogLevel;
        setLogs((prev) => [...prev.slice(-100), { level, message: data.message ?? "", timestamp: Date.now() }]);
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

  // Reset orientation when switching to non-rotatable device
  useEffect(() => {
    if (orientation === "landscape" && !cfg.supportsRotation) {
      setOrientation("portrait");
    }
  }, [device, cfg.supportsRotation, orientation]);

  const handleDownloadPreview = useCallback(() => {
    if (!sandboxHtml) return;
    const blob = new Blob([sandboxHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.appName}-preview.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [sandboxHtml, project.appName]);

  // Only show for web target
  if (target !== "web") return null;

  const notchElement = cfg.notch ? (
    orientation === "portrait" ? (
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-10 pointer-events-none" />
    ) : (
      <div className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-28 bg-black rounded-full z-10 pointer-events-none" />
    )
  ) : null;

  const hintText = orientation === "landscape" && cfg.supportsRotation
    ? `${cfg.hint.split("·")[0]}· ${effectiveW}×${effectiveH} (landscape)`
    : cfg.hint;

  const errorCount = logs.filter(l => l.level === "error").length;
  const warnCount = logs.filter(l => l.level === "warn").length;
  const filtered = logFilter === "all" ? logs : logs.filter(l => l.level === logFilter);

  return (
    <div className={fullscreen ? "fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col overflow-auto p-12" : "glass-panel p-6"}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-medium">
            <Globe size={12} /> Live Preview
            {status === "ready" && (
              <span className="text-[9px] normal-case tracking-normal text-emerald-400/80 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                running
              </span>
            )}
            {status === "loading" && (
              <Loader2 size={10} className="animate-spin" />
            )}
          </div>
          <h3 className="font-display text-lg font-semibold mt-1">
            {project.appName}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Your generated web app running live — click through screens,
            fill forms, and test navigation in a sandboxed environment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sandboxHtml && (
            <Button
              onClick={handleDownloadPreview}
              variant="outline"
              size="sm"
              className="border-border/60"
              title="Download preview as HTML"
            >
              <Camera size={14} />
              <span className="hidden sm:inline ml-1">Save</span>
            </Button>
          )}
          <Button
            onClick={() => setFullscreen(!fullscreen)}
            variant="outline"
            size="sm"
            className="border-border/60"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen preview"}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </Button>
          <Button
            onClick={buildSandbox}
            variant="outline"
            size="sm"
            className="border-border/60"
          >
            <RefreshCw size={14} />
            Rebuild
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`border-border/60 ${showLogs ? "bg-primary/10 text-primary border-primary/30" : ""}`}
            onClick={() => setShowLogs(!showLogs)}
            title="Toggle console"
          >
            <Terminal size={14} />
            {errorCount > 0 && (
              <span className="text-[10px] text-red-400 ml-1">{errorCount}</span>
            )}
          </Button>
        </div>
      </div>

      {/* Device switcher */}
      <div className="flex items-center gap-3 mb-5 justify-center flex-wrap">
        <div className="flex items-center gap-1 bg-card/40 rounded-lg p-1 border border-border/40">
          {(Object.keys(DEVICE_CONFIG) as DeviceMode[]).map((d) => {
            const dc = DEVICE_CONFIG[d];
            const Icon = dc.icon;
            return (
              <button
                key={d}
                onClick={() => setDevice(d)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  device === d
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{dc.label}</span>
              </button>
            );
          })}
        </div>

        {cfg.supportsRotation && (
          <button
            onClick={() => setOrientation((prev) => (prev === "portrait" ? "landscape" : "portrait"))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all border border-border/40 ${
              orientation === "landscape"
                ? "bg-primary/10 text-primary border-primary/30"
                : "text-muted-foreground hover:text-foreground bg-card/40"
            }`}
            title={`Switch to ${orientation === "portrait" ? "landscape" : "portrait"}`}
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">
              {orientation === "portrait" ? "Landscape" : "Portrait"}
            </span>
          </button>
        )}
      </div>

      {/* Device frame with preview */}
      <div className="flex justify-center">
        <div style={{ width: visW, height: visH }} className="relative">
          <div
            className={`absolute inset-0 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.7)] ${cfg.frameClass}`}
            style={{
              background: "linear-gradient(145deg, hsl(var(--border)) 0%, hsl(var(--card)) 100%)",
            }}
          >
            <div
              className="relative w-full h-full overflow-hidden bg-black"
              style={{ borderRadius: cfg.frameRadius }}
            >
              {notchElement}

              <div
                style={{
                  width: effectiveW,
                  height: effectiveH,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  pointerEvents: "auto",
                }}
              >
                {status === "loading" && (
                  <div
                    className="flex flex-col items-center justify-center gap-3 text-muted-foreground bg-[hsl(228_20%_4%)]"
                    style={{ width: effectiveW, height: effectiveH }}
                  >
                    <Loader2 className="animate-spin text-primary" size={32} />
                    <p className="text-sm font-mono">building live preview…</p>
                    <p className="text-xs text-muted-foreground/60 max-w-[260px] text-center">
                      Transpiling React components and mounting your app
                    </p>
                  </div>
                )}

                {status === "error" && !sandboxHtml && (
                  <div
                    className="flex flex-col items-center justify-center gap-3 p-8 text-center bg-[hsl(228_20%_4%)]"
                    style={{ width: effectiveW, height: effectiveH }}
                  >
                    <AlertTriangle className="text-destructive" size={28} />
                    <p className="text-sm text-foreground font-medium">Preview failed</p>
                    <p className="text-xs text-muted-foreground max-w-xs">{error}</p>
                    <Button onClick={buildSandbox} size="sm" variant="outline" className="mt-2">
                      <RefreshCw size={12} /> Retry
                    </Button>
                  </div>
                )}

                {(status === "ready" || status === "idle" || (status === "error" && sandboxHtml)) && sandboxHtml && (
                  <iframe
                    ref={iframeRef}
                    title={`${project.appName} live sandbox`}
                    srcDoc={sandboxHtml}
                    sandbox="allow-scripts allow-forms allow-same-origin"
                    className="border-0 bg-black"
                    style={{ width: effectiveW, height: effectiveH, colorScheme: "dark", display: "block" }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Runtime error banner */}
      {runtimeError && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <AlertTriangle className="text-destructive shrink-0 mt-0.5" size={14} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground">Preview runtime error</p>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{runtimeError}</p>
          </div>
          <button
            onClick={buildSandbox}
            className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1 shrink-0"
          >
            <RotateCw size={11} /> Rebuild
          </button>
        </div>
      )}

      {/* Console logs */}
      {showLogs && (
        <div className="mt-4 rounded-lg border border-border/40 bg-[hsl(228_20%_4%)] max-h-48 overflow-hidden flex flex-col">
          <div className="px-3 py-1.5 border-b border-border/40 flex items-center gap-1.5 shrink-0">
            <Terminal size={10} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Console ({filtered.length})</span>
            <div className="flex items-center gap-1 ml-auto">
              <Filter size={9} className="text-muted-foreground" />
              {(["all", "error", "warn", "info", "log"] as const).map(level => (
                <button
                  key={level}
                  onClick={() => setLogFilter(level)}
                  className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                    logFilter === level
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  } ${level === "error" && errorCount > 0 ? "text-red-400" : ""} ${level === "warn" && warnCount > 0 ? "text-yellow-400" : ""}`}
                >
                  {level}{level === "error" && errorCount > 0 ? ` (${errorCount})` : ""}{level === "warn" && warnCount > 0 ? ` (${warnCount})` : ""}
                </button>
              ))}
            </div>
          </div>
          <div className="p-2 font-mono text-[11px] space-y-0.5 overflow-auto">
            {filtered.length === 0 && (
              <p className="text-muted-foreground/50 text-center py-2">No logs yet</p>
            )}
            {filtered.map((log, i) => (
              <div key={i} className={`${
                log.level === "error" ? "text-red-400" :
                log.level === "warn" ? "text-yellow-400" :
                log.level === "info" ? "text-blue-400" :
                "text-muted-foreground/80"
              }`}>
                <span className="text-muted-foreground/50 mr-1.5">[{log.level}]</span>
                {log.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer hint */}
      <p className="text-[10px] text-muted-foreground/60 text-center mt-3">
        {hintText} · sandboxed iframe · responsive layout · {scale < 1 ? `scaled ${Math.round(scale * 100)}% to fit` : "1:1"}
        {fullscreen && " · press Esc to exit"}
      </p>
    </div>
  );
}
