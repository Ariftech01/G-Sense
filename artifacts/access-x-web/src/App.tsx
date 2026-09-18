import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Activity,
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  AudioLines,
  Award,
  Check,
  ChevronRight,
  CircleAlert,
  Compass,
  Contrast,
  Crosshair,
  Eye,
  Footprints,
  Gauge,
  Headphones,
  Info,
  Layers3,
  LocateFixed,
  Map as MapIcon,
  Menu,
  Mic,
  Navigation,
  RefreshCw,
  Route as RouteIcon,
  ScanLine,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  SquareArrowOutUpRight,
  Sun,
  Timer,
  TriangleAlert,
  Volume2,
  Waypoints,
  X,
} from 'lucide-react';
import {
  useCreateObservation,
  useGetEnvironment,
  useGetPreferences,
  useHealthCheck,
  useRunDemo,
  useSendAssistantCommand,
  useUpdatePreferences,
} from '@workspace/api-client-react';
import type {
  AccessibilityPreferences,
  EnvironmentDashboard,
  EnvironmentState,
  PreferencesUpdate,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Router as WouterRouter, Link, Switch, useLocation } from 'wouter';

const queryClient = new QueryClient();

type IconType = typeof Activity;

const navItems: { href: string; label: string; icon: IconType; hint: string }[] = [
  { href: '/', label: 'Command center', icon: Crosshair, hint: 'Live environment' },
  { href: '/changes', label: 'Change review', icon: Activity, hint: 'Before and after' },
  { href: '/judge', label: 'Judge mode', icon: Award, hint: 'Hackathon demo flow' },
  { href: '/map', label: 'Route context', icon: MapIcon, hint: 'Campus orientation' },
  { href: '/profile', label: 'Preferences', icon: SlidersHorizontal, hint: 'Accessibility controls' },
];

const fallbackEnvironment: EnvironmentDashboard = {
  current: {
    id: 'fallback',
    observedAt: new Date().toISOString(),
    pathStatus: 'blocked',
    obstacles: ['Construction barrier ahead'],
    stairs: true,
    elevator: 'available',
    detectedObjects: ['barrier', 'stairwell', 'elevator sign'],
    signs: ['Elevator →', 'Library west entrance'],
    confidence: 0.91,
    locationLabel: 'North quad · west approach',
    ocr: null,
    spatialContext: null,
  },
  previous: null,
  change: {
    detected: true,
    before: 'Clear approach to the library west entrance.',
    change: 'A temporary barrier now narrows the approach.',
    currentState: 'Passage is blocked at the west approach.',
    impact: 'The direct route is not safe to continue.',
    recommendation: 'Turn right at the fountain and use the elevator lobby entrance.',
  },
  preferences: {
    avoidStairs: true,
    preferElevator: true,
    avoidCrowds: false,
    responseLength: 'standard',
    accessibilityMode: 'high-contrast',
    goal: 'Reach the library west entrance',
  },
  recommendation: 'Turn right at the fountain and use the elevator lobby entrance.',
  demoMode: true,
  safetyMessage: 'Pause before the barrier. The direct path is blocked.',
};

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const health = useHealthCheck();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="noise min-h-[100dvh] bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[256px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <SidebarContent location={location} health={health.data?.status} />
      </aside>
      <div className="lg:pl-[256px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              data-testid="button-open-navigation"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition hover:text-foreground lg:hidden"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2.5 lg:hidden">
              <SignalMark compact />
              <span className="font-mono text-xs font-medium tracking-[.18em] text-foreground">G Sense</span>
            </div>
            <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
              <span className="font-mono text-[11px] uppercase tracking-[.16em] text-primary">Live companion</span>
              <span className="text-border">/</span>
              <span>{navItems.find((item) => item.href === location)?.label ?? 'Command center'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 sm:flex">
              <span className={`h-1.5 w-1.5 rounded-full ${health.data?.status.toLowerCase() === 'ok' ? 'bg-primary pulse-signal' : 'bg-accent'}`} />
              <span className="font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">
                {health.data?.status.toLowerCase() === 'ok' ? 'System ready' : 'Checking system'}
              </span>
            </div>
            <Link href="/profile" data-testid="link-header-preferences" className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition hover:border-primary/50 hover:text-primary">
              <Settings2 size={17} />
            </Link>
          </div>
        </header>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden">
            <div className="absolute inset-y-0 left-0 w-[min(84vw,320px)] border-r border-sidebar-border bg-sidebar p-5 shadow-2xl">
              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3"><SignalMark /><span className="font-mono text-xs tracking-[.18em]">G Sense</span></div>
                <button type="button" aria-label="Close navigation" data-testid="button-close-navigation" onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:text-foreground"><X size={18} /></button>
              </div>
              <SidebarContent location={location} health={health.data?.status} onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </div>
        )}
        <main className="min-h-[calc(100dvh-72px)] page-enter">{children}</main>
      </div>
      <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-4 rounded-2xl border border-border bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location === item.href;
          return (
            <Link key={item.href} href={item.href} data-testid={`link-mobile-${item.label.toLowerCase().replaceAll(' ', '-')}`} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-medium transition ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon size={17} strokeWidth={active ? 2.4 : 1.8} />
              <span>{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SidebarContent({ location, health, onNavigate }: { location: string; health?: string; onNavigate?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-3 px-7 py-7">
        <SignalMark />
        <div>
          <div className="font-mono text-[13px] font-medium tracking-[.2em] text-foreground">G Sense</div>
          <div className="mt-1 text-[10px] text-muted-foreground">situational companion</div>
        </div>
      </div>
      <div className="mx-6 mb-7 h-px bg-border/80" />
      <div className="px-4">
        <div className="eyebrow mb-3 px-3">Workspace</div>
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={onNavigate} data-testid={`link-sidebar-${item.label.toLowerCase().replaceAll(' ', '-')}`} className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition ${active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-card hover:text-foreground'}`}>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${active ? 'border-primary/30 bg-primary/10' : 'border-transparent bg-transparent group-hover:border-border'}`}><Icon size={17} /></span>
                <span className="min-w-0"><span className="block text-[13px] font-semibold">{item.label}</span><span className="block truncate text-[10px] text-muted-foreground">{item.hint}</span></span>
                {active && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="mt-auto p-5">
        <div className="rounded-2xl border border-border bg-card/80 p-4">
          <div className="mb-3 flex items-center gap-2"><ShieldCheck size={15} className="text-primary" /><span className="font-mono text-[10px] uppercase tracking-[.14em] text-primary">Safety layer</span></div>
          <p className="text-[11px] leading-5 text-muted-foreground">G Sense explains what changed before it suggests your next move.</p>
          <div className="mt-4 flex items-center gap-2 border-t border-border pt-3"><span className={`h-1.5 w-1.5 rounded-full ${health?.toLowerCase() === 'ok' ? 'bg-primary' : 'bg-accent'}`} /><span className="font-mono text-[10px] text-muted-foreground">{health?.toLowerCase() === 'ok' ? 'Connection secure' : 'Connecting…'}</span></div>
        </div>
      </div>
    </>
  );
}

function SignalMark({ compact = false }: { compact?: boolean }) {
  return <span aria-hidden="true" className={`relative flex ${compact ? 'h-7 w-7' : 'h-9 w-9'} items-center justify-center rounded-xl border border-primary/50 bg-primary/10 text-primary`}><span className="absolute h-2 w-2 rounded-full bg-primary" /><span className="absolute h-5 w-5 rounded-full border border-primary/70" /><span className="absolute h-7 w-7 rounded-full border border-primary/25" /></span>;
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="eyebrow mb-3 text-primary">{eyebrow}</div><h1 className="max-w-3xl text-3xl font-semibold tracking-[-.04em] text-foreground sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>{action}</div>;
}

function LoadingState() {
  return <div className="mx-auto max-w-[1380px] px-5 py-8 sm:px-8 lg:px-10"><div className="animate-pulse space-y-6"><div className="h-4 w-28 rounded bg-muted" /><div className="h-10 w-3/4 max-w-xl rounded bg-muted" /><div className="h-32 rounded-2xl bg-card" /><div className="grid gap-4 md:grid-cols-2"><div className="h-64 rounded-2xl bg-card" /><div className="h-64 rounded-2xl bg-card" /></div></div></div>;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-28 text-center"><div className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive"><TriangleAlert size={27} /></div><h1 className="text-xl font-semibold">The environment is quiet</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">We could not reach the latest observation. Check the connection and try again.</p><button type="button" data-testid="button-retry-environment" onClick={onRetry} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110"><RefreshCw size={15} /> Try again</button></div>;
}

function StatusPill({ status }: { status: string }) {
  const clear = status === 'clear';
  return <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[.12em] ${clear ? 'border-primary/30 bg-primary/10 text-primary' : 'border-destructive/35 bg-destructive/10 text-destructive'}`}><span className={`h-1.5 w-1.5 rounded-full ${clear ? 'bg-primary' : 'bg-destructive'}`} />{clear ? 'Path clear' : 'Path blocked'}</span>;
}

function Confidence({ value }: { value: number }) {
  const percent = Math.round(value * 100);
  return <div className="flex items-center gap-3" data-testid="status-confidence"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${percent}%` }} /></div><span className="font-mono text-[11px] text-muted-foreground">{percent}% confidence</span></div>;
}

function HomePage() {
  const environment = useGetEnvironment();
  const preferences = useGetPreferences();
  const runDemo = useRunDemo();
  const createObservation = useCreateObservation();
  const sendCommand = useSendAssistantCommand();
  const [command, setCommand] = useState('');
  const [assistantResponse, setAssistantResponse] = useState<{ response: string; safetyMessage: string } | null>(null);
  const dashboard = environment.data ?? fallbackEnvironment;
  const prefs = preferences.data ?? dashboard.preferences;
  const current = dashboard.current;

  const { speak, isSpeaking } = useAccessibilityAudio();

  const refresh = () => { void environment.refetch(); };
  const runGuidedDemo = () => runDemo.mutate(undefined, { onSuccess: (next) => queryClient.setQueryData(['/api/environment'], next) });
  const logObservation = () => createObservation.mutate({ data: { pathStatus: current.pathStatus, obstacles: current.obstacles, stairs: current.stairs, elevator: current.elevator, detectedObjects: current.detectedObjects, signs: current.signs, confidence: current.confidence, locationLabel: current.locationLabel } }, { onSuccess: (next) => queryClient.setQueryData(['/api/environment'], next) });
  const submitCommand = () => {
    const value = command.trim();
    if (!value) return;
    sendCommand.mutate({ data: { command: value, source: 'text' } }, { onSuccess: (response) => { setAssistantResponse(response); setCommand(''); } });
  };

  if (environment.isLoading) return <LoadingState />;
  if (environment.isError) return <ErrorState onRetry={refresh} />;

  return <div className="mx-auto max-w-[1380px] px-5 py-8 pb-28 sm:px-8 sm:py-10 lg:px-10 lg:pb-12">
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-start">
      <div><div className="eyebrow mb-3 text-primary">Command center <span className="text-muted-foreground">/ live read</span></div><h1 className="max-w-3xl text-3xl font-semibold tracking-[-.045em] text-foreground sm:text-[42px] sm:leading-[1.08]">Know what changed.<br /><span className="text-primary">Move with clarity.</span></h1><p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">A focused read of the space around you, translated into one safe next step.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {dashboard.demoMode && <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.1em] text-accent"><Sparkles size={13} /> Guided demo</span>}
        <button type="button" data-testid="button-listen-recommendation" onClick={() => speak(`${dashboard.safetyMessage}. Recommendation: ${dashboard.recommendation}`)} className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition ${isSpeaking ? 'border-primary bg-primary/20 text-primary animate-pulse' : 'border-border bg-card text-foreground hover:border-primary/50'}`}><Volume2 size={14} /> {isSpeaking ? 'Speaking readout…' : 'Listen readout'}</button>
        <button type="button" data-testid="button-refresh-environment" onClick={refresh} disabled={environment.isFetching} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-semibold text-foreground transition hover:border-primary/50 disabled:opacity-50"><RefreshCw size={14} className={environment.isFetching ? 'animate-spin' : ''} /> Refresh read</button>
      </div>
    </div>

    <section className="relative overflow-hidden rounded-[1.4rem] border border-primary/25 bg-[linear-gradient(115deg,hsl(var(--card)),#E3F2FD)] p-5 shadow-[0_18px_50px_rgba(21,101,192,.08)] sm:p-7">
      <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border border-primary/10" /><div className="absolute -right-4 -top-8 h-36 w-36 rounded-full border border-primary/10" />
      <div className="relative grid gap-7 lg:grid-cols-[1.1fr_.9fr] lg:gap-12">
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-3"><StatusPill status={current.pathStatus} /><span className="font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground">Observed {formatObservedAt(current.observedAt)}</span></div>
          <div className="flex items-start gap-3"><LocateFixed className="mt-1 shrink-0 text-primary" size={18} /><div><div className="eyebrow">Current environment</div><h2 className="mt-2 text-2xl font-semibold tracking-[-.03em] sm:text-3xl" data-testid="text-location-label">{current.locationLabel}</h2></div></div>
          <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3"><Confidence value={current.confidence} /><span className="flex items-center gap-2 text-xs text-muted-foreground"><Eye size={14} /> {current.detectedObjects.length} objects detected</span></div>
        </div>
        <div className="border-t border-border/70 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"><div className="eyebrow mb-3">Safety message</div><p className="text-lg font-medium leading-8 text-foreground" data-testid="text-safety-message">{dashboard.safetyMessage}</p><div className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Info size={14} className="mt-0.5 shrink-0 text-accent" /> Do not move based on confidence alone. Use the recommendation with your own awareness of the space.</div></div>
      </div>
    </section>

    <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
      <section className="rounded-[1.2rem] border border-border bg-card p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><div className="eyebrow mb-2 text-accent">Recommended next step</div><h2 className="text-xl font-semibold tracking-[-.025em]">What to do now</h2></div><div className="rounded-xl border border-accent/30 bg-accent/10 p-2 text-accent"><Navigation size={19} /></div></div>
        <div className="signal-line mt-6 pl-5"><p className="text-lg leading-8 text-foreground" data-testid="text-recommendation">{dashboard.recommendation}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">Based on your route goal and {prefs.avoidStairs ? 'stair avoidance' : 'current preferences'}.</p></div>
        <div className="mt-7 flex flex-wrap gap-2"><Link href="/map" data-testid="link-open-route-context" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition hover:brightness-110">Open route context <ArrowRight size={15} /></Link><Link href="/changes" data-testid="link-review-change" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-foreground">Review change <ChevronRight size={15} /></Link></div>
      </section>
      <section className="rounded-[1.2rem] border border-border bg-card p-5 sm:p-7"><div className="eyebrow mb-4">Route signals</div><div className="space-y-4"><SignalRow icon={TriangleAlert} label="Obstacles" value={current.obstacles.length ? current.obstacles.join(', ') : 'None detected'} danger={current.obstacles.length > 0} /><SignalRow icon={Footprints} label="Stairs" value={current.stairs ? 'Present' : 'Not detected'} danger={current.stairs && prefs.avoidStairs} /><SignalRow icon={Waypoints} label="Elevator" value={capitalize(current.elevator)} /><SignalRow icon={AudioLines} label="Nearby signs" value={current.signs.length ? current.signs.join(' · ') : 'No readable signs'} /></div></section>
    </div>

    <section className="mt-5 grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
      <div className="rounded-[1.2rem] border border-border bg-card p-5 sm:p-7"><div className="eyebrow mb-4">Your goal</div><div className="flex items-start gap-3"><RouteIcon size={18} className="mt-1 text-primary" /><p className="text-sm leading-6 text-foreground" data-testid="text-current-goal">{prefs.goal}</p></div><Link href="/profile" data-testid="link-edit-goal" className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline">Adjust preferences <ArrowRight size={14} /></Link></div>
      <div className="rounded-[1.2rem] border border-border bg-card p-5 sm:p-7"><div className="mb-4 flex items-center justify-between"><div><div className="eyebrow mb-2">Ask G Sense</div><h2 className="text-lg font-semibold">Say what you need to know</h2></div><div className="rounded-xl border border-border p-2 text-muted-foreground"><Headphones size={17} /></div></div><div className="flex gap-2"><input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitCommand(); }} data-testid="input-assistant-command" aria-label="Ask G Sense a question" placeholder="What changed near me?" className="min-w-0 flex-1 rounded-xl border border-input bg-background/70 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" /><button type="button" data-testid="button-send-assistant-command" onClick={submitCommand} disabled={sendCommand.isPending || !command.trim()} className="rounded-xl bg-primary px-4 text-primary-foreground transition hover:brightness-110 disabled:opacity-50"><ArrowRight size={17} /></button></div>{assistantResponse && <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-4"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.12em] text-primary"><Check size={13} /> Response ready</div><p className="mt-2 text-sm leading-6">{assistantResponse.response}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{assistantResponse.safetyMessage}</p></div>}<div className="mt-4 flex flex-wrap gap-2">{['What changed?', 'Is the elevator available?', 'Describe my route'].map((prompt) => <button key={prompt} type="button" data-testid={`button-prompt-${prompt.toLowerCase().replaceAll(' ', '-')}`} onClick={() => { setCommand(prompt); }} className="rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground">{prompt}</button>)}</div></div>
    </section>

    <section className="mt-5 flex flex-col items-start justify-between gap-4 rounded-[1.2rem] border border-dashed border-border bg-background/35 p-5 sm:flex-row sm:items-center sm:p-6"><div><div className="flex items-center gap-2"><ScanLine size={17} className="text-primary" /><h2 className="text-sm font-semibold">Keep the read current</h2></div><p className="mt-1 text-xs text-muted-foreground">Refresh after a turn, a door, or any meaningful change in your route.</p></div><div className="flex flex-wrap gap-2"><button type="button" data-testid="button-log-observation" onClick={logObservation} disabled={createObservation.isPending} className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2.5 text-xs font-semibold transition hover:border-primary/50 disabled:opacity-50"><ScanLine size={14} /> {createObservation.isPending ? 'Saving read…' : 'Log current read'}</button><button type="button" data-testid="button-run-demo" onClick={runGuidedDemo} disabled={runDemo.isPending} className="inline-flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2.5 text-xs font-bold text-accent-foreground transition hover:brightness-110 disabled:opacity-50"><Sparkles size={14} /> {runDemo.isPending ? 'Running…' : 'Run guided demo'}</button></div></section>
  </div>;
}

function SignalRow({ icon: Icon, label, value, danger = false }: { icon: IconType; label: string; value: string; danger?: boolean }) {
  return <div className="flex items-start gap-3 border-b border-border/70 pb-4 last:border-0 last:pb-0"><span className={`mt-0.5 ${danger ? 'text-destructive' : 'text-muted-foreground'}`}><Icon size={16} /></span><div className="min-w-0"><div className="font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground">{label}</div><div className={`mt-1 text-xs leading-5 ${danger ? 'text-destructive' : 'text-foreground'}`}>{value}</div></div></div>;
}

function ChangesPage() {
  const environment = useGetEnvironment();
  const dashboard = environment.data ?? fallbackEnvironment;
  if (environment.isLoading) return <LoadingState />;
  if (environment.isError) return <ErrorState onRetry={() => void environment.refetch()} />;
  const change = dashboard.change;

  const flowSteps = [
    {
      stepNumber: 1,
      label: 'BEFORE',
      title: 'Previous Observation (T_n-1)',
      value: change.before,
      icon: Timer,
      badgeBg: 'bg-slate-100 text-slate-700 border-slate-300',
      cardBg: 'bg-card border-border',
    },
    {
      stepNumber: 2,
      label: 'CHANGE DETECTED',
      title: 'Temporal Environmental Delta',
      value: change.change,
      icon: Activity,
      badgeBg: change.detected ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-slate-100 text-slate-700 border-slate-300',
      cardBg: change.detected ? 'bg-blue-50/50 border-blue-200' : 'bg-card border-border',
    },
    {
      stepNumber: 3,
      label: 'CURRENT STATE',
      title: 'Observed Location & Status (T_n)',
      value: change.currentState,
      icon: LocateFixed,
      badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
      cardBg: 'bg-card border-border',
    },
    {
      stepNumber: 4,
      label: 'IMPACT ON ROUTE',
      title: 'Accessibility & Safety Risk Analysis',
      value: change.impact,
      icon: TriangleAlert,
      badgeBg: change.detected ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-100 text-slate-700 border-slate-300',
      cardBg: change.detected ? 'bg-amber-50/40 border-amber-200' : 'bg-card border-border',
    },
    {
      stepNumber: 5,
      label: 'RECOMMENDATION',
      title: 'Goal & Preference-Adapted Safe Action',
      value: change.recommendation,
      icon: Navigation,
      badgeBg: 'bg-primary text-primary-foreground border-primary',
      cardBg: 'bg-primary/5 border-primary/40 shadow-xs',
    },
  ];

  return (
    <div className="mx-auto max-w-[1120px] px-5 py-8 pb-28 sm:px-8 sm:py-10 lg:px-10 lg:pb-12">
      <PageIntro
        eyebrow="Hackathon Demo Flow"
        title="Temporal Change Reasoning Pipeline"
        description="A clear, visually obvious step-by-step breakdown from initial observation to accessibility delta detection and safe route recommendation."
        action={
          <div className="flex items-center gap-2">
            <Link href="/" data-testid="link-back-command-center" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-semibold hover:border-primary/50">
              <Crosshair size={15} /> Live command center
            </Link>
          </div>
        }
      />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl p-3 ${change.detected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
            {change.detected ? <CircleAlert size={22} /> : <Check size={22} />}
          </div>
          <div>
            <div className="text-base font-bold">{change.detected ? 'Temporal Change Detected' : 'No Temporal Change Detected'}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Location: {dashboard.current.locationLabel}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[11px] font-semibold text-primary">
            Target: {dashboard.preferences.goal}
          </span>
          <Confidence value={dashboard.current.confidence} />
        </div>
      </div>

      <div className="relative space-y-4">
        {flowSteps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === flowSteps.length - 1;
          return (
            <div key={step.label} className="relative">
              <div className={`group rounded-2xl border ${step.cardBg} p-5 transition hover:shadow-md sm:p-6`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase font-bold tracking-[.12em] ${step.badgeBg}`}>
                      <Icon size={13} />
                      Step {step.stepNumber}: {step.label}
                    </span>
                    <span className="font-mono text-[11px] font-medium text-muted-foreground">{step.title}</span>
                  </div>
                </div>
                <p data-testid={`text-change-${index}`} className={`mt-3 text-base leading-7 ${step.stepNumber === 5 ? 'font-semibold text-primary' : 'text-foreground'}`}>
                  {step.value}
                </p>
              </div>

              {!isLast && (
                <div className="my-2 flex justify-center">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-card text-primary shadow-xs">
                    <ArrowDown size={14} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-xs leading-6 text-foreground">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary" />
        <span>Safety protocol: G Sense provides real-time situational awareness and change detection. Always verify the immediate walking path before committing to a turn or movement.</span>
      </div>
    </div>
  );
}

function ProfilePage() {
  const preferences = useGetPreferences();
  const update = useUpdatePreferences();
  const dashboard = useGetEnvironment();
  const source = preferences.data ?? dashboard.data?.preferences ?? fallbackEnvironment.preferences;
  const [draft, setDraft] = useState<AccessibilityPreferences>(source);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (preferences.data) setDraft(preferences.data); }, [preferences.data]);
  const updateField = <K extends keyof AccessibilityPreferences>(key: K, value: AccessibilityPreferences[K]) => { setSaved(false); setDraft((current) => ({ ...current, [key]: value })); };
  const save = () => {
    const payload: PreferencesUpdate = { avoidStairs: draft.avoidStairs, preferElevator: draft.preferElevator, avoidCrowds: draft.avoidCrowds, responseLength: draft.responseLength, accessibilityMode: draft.accessibilityMode, goal: draft.goal };
    update.mutate({ data: payload }, { onSuccess: (next) => { setDraft(next); setSaved(true); queryClient.setQueryData(['/api/preferences'], next); } });
  };
  if (preferences.isLoading && dashboard.isLoading) return <LoadingState />;
  return <div className="mx-auto max-w-[1120px] px-5 py-8 pb-28 sm:px-8 sm:py-10 lg:px-10 lg:pb-12"><PageIntro eyebrow="Preferences" title="Make the companion sound like you." description="These settings shape the route guidance, the amount of context, and the way important changes are presented." action={<button type="button" data-testid="button-save-preferences-top" onClick={save} disabled={update.isPending} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"><Check size={15} /> {update.isPending ? 'Saving…' : saved ? 'Saved' : 'Save changes'}</button>} /><div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]"><section className="rounded-[1.2rem] border border-border bg-card p-5 sm:p-7"><div className="eyebrow mb-5">Route priorities</div><div className="space-y-2"><PreferenceToggle label="Avoid stairs" description="Prefer level routes whenever possible." checked={draft.avoidStairs} onChange={(value) => updateField('avoidStairs', value)} testId="toggle-avoid-stairs" /><PreferenceToggle label="Prefer elevator" description="Use elevators when a vertical change is required." checked={draft.preferElevator} onChange={(value) => updateField('preferElevator', value)} testId="toggle-prefer-elevator" /><PreferenceToggle label="Avoid crowded paths" description="Favor quieter alternatives when G Sense can identify one." checked={draft.avoidCrowds} onChange={(value) => updateField('avoidCrowds', value)} testId="toggle-avoid-crowds" /></div><div className="mt-7 border-t border-border pt-6"><label htmlFor="goal" className="eyebrow">Current goal</label><div className="relative mt-3"><RouteIcon size={16} className="absolute left-3 top-3.5 text-muted-foreground" /><input id="goal" data-testid="input-current-goal" value={draft.goal} onChange={(event) => updateField('goal', event.target.value)} className="w-full rounded-xl border border-input bg-background/70 py-3 pl-10 pr-4 text-sm focus:border-primary focus:outline-none" /></div><p className="mt-2 text-xs leading-5 text-muted-foreground">A short destination gives every recommendation a reason.</p></div></section><section className="rounded-[1.2rem] border border-border bg-card p-5 sm:p-7"><div className="eyebrow mb-5">Response & display</div><PreferenceSelect label="Response length" value={draft.responseLength} options={[['brief', 'Brief'], ['standard', 'Standard'], ['detailed', 'Detailed']]} onChange={(value) => updateField('responseLength', value as AccessibilityPreferences['responseLength'])} testId="select-response-length" /><PreferenceSelect label="Accessibility mode" value={draft.accessibilityMode} options={[['high-contrast', 'High contrast'], ['screen-reader', 'Screen reader optimized'], ['standard', 'Standard']]} onChange={(value) => updateField('accessibilityMode', value as AccessibilityPreferences['accessibilityMode'])} testId="select-accessibility-mode" /><div className="mt-7 rounded-2xl border border-primary/20 bg-primary/5 p-4"><div className="flex items-center gap-2 text-primary"><Contrast size={16} /><span className="text-xs font-semibold">Your interface is set for clear signal</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">High contrast mode keeps critical route status and warnings visually distinct in busy environments.</p></div><button type="button" data-testid="button-save-preferences" onClick={save} disabled={update.isPending} className="mt-7 w-full rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-50">{update.isPending ? 'Saving preferences…' : saved ? 'Preferences saved' : 'Save preferences'}</button></section></div></div>;
}

function PreferenceToggle({ label, description, checked, onChange, testId }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void; testId: string }) {
  return <button type="button" role="switch" aria-checked={checked} data-testid={testId} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-xl border border-transparent p-3 text-left transition hover:border-border hover:bg-background/50"><div><div className="text-sm font-semibold">{label}</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div></div><span className={`relative h-6 w-11 shrink-0 rounded-full border transition ${checked ? 'border-primary/60 bg-primary/25' : 'border-border bg-muted'}`}><span className={`absolute top-1 h-4 w-4 rounded-full transition-all ${checked ? 'left-6 bg-primary' : 'left-1 bg-muted-foreground/60'}`} /></span></button>;
}

function PreferenceSelect({ label, value, options, onChange, testId }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void; testId: string }) {
  return <label className="mb-5 block last:mb-0"><span className="eyebrow">{label}</span><select data-testid={testId} value={value} onChange={(event) => onChange(event.target.value)} className="mt-3 w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm text-foreground focus:border-primary focus:outline-none">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

import { RouteMapVisualizer } from '@/components/RouteMapVisualizer';
import { useAccessibilityAudio } from '@/hooks/useAccessibilityAudio';

function MapPage() {
  const environment = useGetEnvironment();
  const dashboard = environment.data ?? fallbackEnvironment;
  const current = dashboard.current;
  return <div className="mx-auto max-w-[1280px] px-5 py-8 pb-28 sm:px-8 sm:py-10 lg:px-10 lg:pb-12"><PageIntro eyebrow="Route context" title="Orient before you move." description="A simple campus view for the route you are considering. Use it as context alongside the live read, not as a substitute for awareness." action={<button type="button" data-testid="button-center-on-location" onClick={() => void environment.refetch()} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-semibold hover:border-primary/50"><LocateFixed size={15} /> Center on current read</button>} /><div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><section className="relative min-h-[500px] overflow-hidden rounded-[1.3rem] border border-border bg-[#0b2029] p-5 sm:p-8"><div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(hsl(168 65% 68% / .08) 1px, transparent 1px), linear-gradient(90deg, hsl(168 65% 68% / .08) 1px, transparent 1px)', backgroundSize: '48px 48px' }} /><div className="relative flex h-full min-h-[450px] flex-col justify-between"><div className="flex items-start justify-between"><div><div className="eyebrow text-primary">North quad · live context</div><div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary pulse-signal" /> Orientation approximate</div></div><div className="rounded-xl border border-primary/25 bg-primary/10 p-2 text-primary"><Compass size={20} /></div></div><div className="relative mx-auto flex w-full max-w-[680px] flex-1 items-center justify-center"><div className="absolute h-[270px] w-[270px] rounded-full border border-primary/15" /><div className="absolute h-[180px] w-[180px] rounded-full border border-primary/20" /><div className="absolute h-[90px] w-[90px] rounded-full border border-primary/30" /><div className="absolute h-3 w-3 rounded-full bg-primary shadow-[0_0_0_8px_hsl(168_65%_68%_/_0.16)]" /><div className="absolute h-[190px] w-[2px] origin-top rotate-[34deg] bg-gradient-to-b from-primary/90 to-transparent" /><div className="absolute left-[18%] top-[25%] rounded-lg border border-border bg-card/90 px-3 py-2 text-[10px] text-muted-foreground"><span className="block font-semibold text-foreground">Library</span>west entrance</div><div className="absolute right-[12%] top-[33%] rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[10px] text-destructive"><span className="block font-semibold">Barrier</span>temporary</div><div className="absolute bottom-[18%] left-[30%] rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-[10px] text-accent"><span className="block font-semibold">Fountain</span>turn point</div></div><div className="flex flex-wrap items-end justify-between gap-4"><div><div className="font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground">Current position</div><div className="mt-1 text-sm font-semibold">{current.locationLabel}</div></div><div className="flex items-center gap-2 text-[10px] text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary" /> position <span className="ml-2 h-2 w-2 rounded-full bg-destructive" /> change</div></div></div></section><section className="space-y-5"><div className="rounded-[1.2rem] border border-border bg-card p-5 sm:p-7"><div className="eyebrow mb-4">Suggested line</div><div className="flex items-start gap-3"><Navigation size={18} className="mt-1 text-primary" /><p className="text-lg font-semibold leading-8" data-testid="text-map-recommendation">{dashboard.recommendation}</p></div><div className="mt-6 border-t border-border pt-5"><div className="eyebrow mb-3">Route goal</div><p className="text-sm leading-6">{dashboard.preferences.goal}</p></div></div><div className="rounded-[1.2rem] border border-border bg-card p-5 sm:p-7"><div className="eyebrow mb-4">Nearby context</div><div className="space-y-3"><ContextItem icon={TriangleAlert} label="Direct west approach" value="Blocked" tone="danger" /><ContextItem icon={Waypoints} label="Elevator lobby" value={capitalize(current.elevator)} tone="primary" /><ContextItem icon={Sun} label="Fountain turn" value="Reference point" tone="muted" /></div></div><div className="flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent/5 p-4 text-xs leading-5 text-muted-foreground"><Info size={15} className="mt-0.5 shrink-0 text-accent" /> The map is a route aid. Confirm surfaces, doors, and people in your immediate space.</div></section></div></div>;
}

function ContextItem({ icon: Icon, label, value, tone }: { icon: IconType; label: string; value: string; tone: 'danger' | 'primary' | 'muted' }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/40 p-3"><div className="flex items-center gap-3"><Icon size={15} className={tone === 'danger' ? 'text-destructive' : tone === 'primary' ? 'text-primary' : 'text-muted-foreground'} /><span className="text-xs text-muted-foreground">{label}</span></div><span className={`font-mono text-[10px] uppercase tracking-[.08em] ${tone === 'danger' ? 'text-destructive' : tone === 'primary' ? 'text-primary' : 'text-muted-foreground'}`}>{value}</span></div>;
}

function formatObservedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function NotFound() {
  return <div className="mx-auto max-w-xl px-6 py-32 text-center"><div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary"><Crosshair size={25} /></div><h1 className="text-2xl font-semibold">That route is not in the read.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Return to the G Sense command center to continue.</p><Link href="/" data-testid="link-return-home" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground">Return to command center <ArrowRight size={15} /></Link></div>;
}

function JudgePage() {
  const environment = useGetEnvironment();
  const updatePreferences = useUpdatePreferences();

  const dashboard = (environment.data ?? fallbackEnvironment) as EnvironmentDashboard & {
    spokenSummary?: string;
    pipeline?: string[];
    aiConfigured?: boolean;
    aiModel?: string | null;
    reasoning?: { impact: string; reason: string; recommendedAction: string; spokenSummary: string } | null;
  };

  const triggerStep1 = () => {
    fetch('/api/demo/step', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step: 'clear' }) })
      .then((response) => response.json())
      .then((next) => queryClient.setQueryData(['/api/environment'], next));
  };

  const triggerStep2 = () => {
    fetch('/api/demo/step', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step: 'obstacle' }) })
      .then((response) => response.json())
      .then((next) => queryClient.setQueryData(['/api/environment'], next));
  };

  const triggerStep3 = () => {
    fetch('/api/demo/step', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step: 'elevator' }) })
      .then((response) => response.json())
      .then((next) => {
        queryClient.setQueryData(['/api/environment'], next);
        updatePreferences.mutate({ data: { avoidStairs: true, preferElevator: true, goal: 'Library' } });
      });
  };

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-8 pb-28 sm:px-8 sm:py-10 lg:px-10 lg:pb-12">
      <PageIntro
        eyebrow="Hackathon Judge Portal"
        title="Judge Mode & Live Scenario Testing"
        description="Interactive control center for hackathon judges to step through the sequential G Sense environmental memory, temporal change detection, and accessibility routing flow."
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 font-mono text-xs font-bold text-primary">
            <Award size={16} /> JUDGE MODE ACTIVE
          </span>
        }
      />

      <div className="mb-8 overflow-x-auto rounded-[1.3rem] border border-primary/30 bg-card p-5">
        <div className="eyebrow mb-3 text-primary">Technical pipeline</div>
        <div className="flex min-w-[720px] items-center gap-2">
          {(dashboard.pipeline ?? ['CAMERA','GEMINI VISION','STRUCTURED STATE','ENVIRONMENT MEMORY','CHANGE DETECTION','USER PROFILE','ACCESSIBILITY ENGINE','RECOMMENDATION','TTS']).map((step, index, all) => (
            <div key={step} className="flex items-center gap-2">
              <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-center">
                <div className="font-mono text-[10px] font-bold tracking-wide text-primary">{step}</div>
              </div>
              {index < all.length - 1 && <ArrowRight size={14} className="text-muted-foreground" />}
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4 text-xs">
          <div className="rounded-xl border border-border p-3"><div className="text-muted-foreground">Before</div><div className="mt-1 font-medium">{dashboard.change.before}</div></div>
          <div className="rounded-xl border border-border p-3"><div className="text-muted-foreground">Change</div><div className="mt-1 font-medium">{dashboard.change.change}</div></div>
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-3"><div className="text-muted-foreground">Impact</div><div className="mt-1 font-medium">{dashboard.reasoning?.reason || dashboard.change.impact}</div></div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3"><div className="text-muted-foreground">Recommendation</div><div className="mt-1 font-medium">{dashboard.recommendation}</div></div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-[1.3rem] border border-primary/30 bg-card p-6 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles size={18} className="text-primary" /> Interactive Scenario Stepper
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Demo Controls</span>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border p-4 bg-background/60">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold">1. Baseline clear path</div>
                  <div className="text-xs text-muted-foreground mt-0.5">DEMO: path clear, elevator available.</div>
                </div>
                <button type="button" onClick={triggerStep1} className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:brightness-110">
                  Run Step 1
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border p-4 bg-background/60">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold">2. Simulate obstacle (chair)</div>
                  <div className="text-xs text-muted-foreground mt-0.5">DEMO: chair blocks the corridor. Change detection fires.</div>
                </div>
                <button type="button" onClick={triggerStep2} className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:brightness-110">
                  Run Step 2
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border p-4 bg-background/60">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold">3. Simulate elevator unavailable</div>
                  <div className="text-xs text-muted-foreground mt-0.5">DEMO: high accessibility impact and alternate route.</div>
                </div>
                <button type="button" onClick={triggerStep3} disabled={updatePreferences.isPending} className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:brightness-110">
                  Run Step 3
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Link href="/changes" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:brightness-110">
              View 5-Step Flow Pipeline <ArrowRight size={15} />
            </Link>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[1.3rem] border border-border bg-card p-6 shadow-xs">
            <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">Live System Metrics</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-xs py-2 border-b border-border">
                <span className="text-muted-foreground">Temporal Delta Detected:</span>
                <span className={`font-bold ${dashboard.change.detected ? 'text-primary' : 'text-muted-foreground'}`}>{dashboard.change.detected ? 'YES (Active)' : 'NO'}</span>
              </div>
              <div className="flex justify-between text-xs py-2 border-b border-border">
                <span className="text-muted-foreground">Active Model Engine:</span>
                <span className="font-bold text-foreground">{dashboard.aiModel || (dashboard.demoMode ? 'Demo engine' : 'Gemini multimodal')}</span>
              </div>
              <div className="flex justify-between text-xs py-2 border-b border-border">
                <span className="text-muted-foreground">Confidence Score:</span>
                <span className="font-bold text-foreground">{Math.round(dashboard.current.confidence * 100)}%</span>
              </div>
              <div className="flex justify-between text-xs py-2">
                <span className="text-muted-foreground">Active Goal Target:</span>
                <span className="font-bold text-primary">{dashboard.preferences.goal}</span>
              </div>
            </div>
          </div>

          <div className="rounded-[1.3rem] border border-border bg-card p-6 shadow-xs">
            <h3 className="text-sm font-semibold mb-2">Current Route Recommendation</h3>
            <p className="text-sm leading-6 text-foreground font-medium">{dashboard.recommendation}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Router() {
  return <RoutedErrorBoundary><AppShell><Switch><Route path="/" component={HomePage} /><Route path="/changes" component={ChangesPage} /><Route path="/judge" component={JudgePage} /><Route path="/profile" component={ProfilePage} /><Route path="/map" component={MapPage} /><Route component={NotFound} /></Switch></AppShell></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  useEffect(() => { document.documentElement.classList.add('dark'); }, []);
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;