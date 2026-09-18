import React, { useState } from 'react';
import type { EnvironmentDashboard } from '@workspace/api-client-react';
import { Compass, Info, MapPin, TriangleAlert, Waypoints } from 'lucide-react';

interface RouteMapVisualizerProps {
  dashboard: EnvironmentDashboard;
  onCenter?: () => void;
}

export function RouteMapVisualizer({ dashboard, onCenter }: RouteMapVisualizerProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const spatial = dashboard.current.spatialContext ?? {
    waypoints: [
      { id: 'wp-origin', label: 'Current Position', type: 'origin', x: 50, y: 85, status: 'clear' },
      { id: 'wp-barrier', label: dashboard.current.obstacles[0] || 'Barrier', type: 'barrier', x: 50, y: 45, status: dashboard.current.pathStatus === 'blocked' ? 'blocked' : 'clear' },
      { id: 'wp-fountain', label: 'Fountain Turn', type: 'turn', x: 75, y: 55, status: 'clear' },
      { id: 'wp-elevator', label: 'Elevator Lobby', type: 'elevator', x: 75, y: 25, status: 'clear' },
      { id: 'wp-destination', label: dashboard.preferences.goal || 'Library', type: 'destination', x: 75, y: 10, status: 'clear' },
    ],
    currentPoint: { x: 50, y: 85 },
    headingDegrees: 34,
    clockDirections: {
      ahead: dashboard.current.obstacles.length ? `${dashboard.current.obstacles.join(', ')} at 12 o'clock` : 'Path clear ahead',
      right: "Fountain turn point at 3 o'clock",
      left: "West quad lawn at 9 o'clock",
      behind: "North corridor entrance at 6 o'clock",
    },
  };

  const waypoints = spatial.waypoints;
  const selectedNode = waypoints.find((w) => w.id === selectedNodeId) ?? waypoints[0];

  // Construct SVG path string through clear nodes
  const clearNodes = waypoints.filter((w) => w.status !== 'blocked');
  const pathD = clearNodes.reduce((acc, wp, index) => {
    return `${acc} ${index === 0 ? 'M' : 'L'} ${(wp.x / 100) * 600} ${(wp.y / 100) * 450}`;
  }, '');

  // Construct blocked path segment if blocked node exists
  const blockedNode = waypoints.find((w) => w.status === 'blocked');
  const originNode = waypoints.find((w) => w.type === 'origin') ?? waypoints[0];
  const blockedPathD = blockedNode
    ? `M ${(originNode.x / 100) * 600} ${(originNode.y / 100) * 450} L ${(blockedNode.x / 100) * 600} ${(blockedNode.y / 100) * 450}`
    : '';

  return (
    <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
      <section
        className="relative min-h-[500px] overflow-hidden rounded-[1.3rem] border border-border bg-[#0b2029] p-5 sm:p-8"
        aria-label="Interactive Route Context Map"
        role="region"
      >
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(hsl(168 65% 68% / .08) 1px, transparent 1px), linear-gradient(90deg, hsl(168 65% 68% / .08) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative flex h-full min-h-[450px] flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <div className="eyebrow text-primary">{dashboard.current.locationLabel}</div>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-primary pulse-signal" /> Dynamic Spatial Overlay
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl border border-primary/25 bg-primary/10 p-2 text-primary">
                <Compass size={20} style={{ transform: `rotate(${spatial.headingDegrees}deg)` }} />
              </div>
            </div>
          </div>

          <div className="relative mx-auto my-4 flex h-[400px] w-full max-w-[600px] items-center justify-center">
            <svg
              className="h-full w-full overflow-visible"
              viewBox="0 0 600 450"
              aria-label="Route map diagram showing waypoints and hazards"
            >
              <defs>
                <linearGradient id="routeGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(168, 65%, 68%)" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="hsl(201, 80%, 60%)" stopOpacity="0.8" />
                </linearGradient>
              </defs>

              {/* Path lines */}
              {blockedPathD && (
                <path
                  d={blockedPathD}
                  fill="none"
                  stroke="hsl(var(--destructive))"
                  strokeWidth="3"
                  strokeDasharray="6 6"
                  className="opacity-75"
                />
              )}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="url(#routeGrad)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Waypoint Nodes */}
              {waypoints.map((wp) => {
                const cx = (wp.x / 100) * 600;
                const cy = (wp.y / 100) * 450;
                const isSelected = selectedNodeId === wp.id || (!selectedNodeId && wp.type === 'origin');
                const isBlocked = wp.status === 'blocked';
                const isCaution = wp.status === 'caution';

                const fillColor = isBlocked
                  ? 'hsl(var(--destructive))'
                  : isCaution
                  ? 'hsl(var(--accent))'
                  : 'hsl(168, 65%, 68%)';

                return (
                  <g
                    key={wp.id}
                    className="cursor-pointer transition-transform hover:scale-110"
                    onClick={() => setSelectedNodeId(wp.id)}
                  >
                    {/* Pulsing ring for current location */}
                    {wp.type === 'origin' && (
                      <circle cx={cx} cy={cy} r="18" fill={fillColor} fillOpacity="0.2" className="animate-ping" />
                    )}

                    {/* Selection highlight */}
                    {isSelected && (
                      <circle cx={cx} cy={cy} r="16" fill="none" stroke={fillColor} strokeWidth="2" strokeDasharray="3 3" />
                    )}

                    <circle cx={cx} cy={cy} r="10" fill="#0b2029" stroke={fillColor} strokeWidth="3" />

                    {/* Label badge */}
                    <foreignObject x={cx - 65} y={cy + 14} width="130" height="40">
                      <div
                        className={`mx-auto w-max max-w-[120px] rounded-md border px-2 py-1 text-center text-[10px] font-semibold leading-tight shadow-md transition ${
                          isBlocked
                            ? 'border-destructive/40 bg-destructive/20 text-destructive'
                            : isCaution
                            ? 'border-accent/40 bg-accent/20 text-accent'
                            : 'border-primary/40 bg-card/90 text-foreground'
                        }`}
                      >
                        {wp.label}
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border/50 pt-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground">Current Position</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{dashboard.current.locationLabel}</div>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Clear Route
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Blocked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" /> Caution
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Spatial Details Panel */}
      <section className="space-y-5">
        <div className="rounded-[1.2rem] border border-border bg-card p-5 sm:p-7">
          <div className="eyebrow mb-4">Clock-Face Spatial Orientation</div>
          <div className="space-y-3" role="list" aria-label="Clock-face relative directions">
            <DirectionRow label="Ahead (12 o'clock)" value={spatial.clockDirections.ahead} danger={dashboard.current.pathStatus === 'blocked'} />
            <DirectionRow label="Right (3 o'clock)" value={spatial.clockDirections.right} />
            <DirectionRow label="Left (9 o'clock)" value={spatial.clockDirections.left} />
            <DirectionRow label="Behind (6 o'clock)" value={spatial.clockDirections.behind} />
          </div>
        </div>

        <div className="rounded-[1.2rem] border border-border bg-card p-5 sm:p-7">
          <div className="eyebrow mb-3">Selected Node Context</div>
          {selectedNode ? (
            <div>
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-primary" />
                <h3 className="text-base font-semibold">{selectedNode.label}</h3>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Node Type:{' '}
                <span className="font-mono uppercase tracking-wider text-foreground">{selectedNode.type}</span> | Status:{' '}
                <span className={`font-semibold ${selectedNode.status === 'blocked' ? 'text-destructive' : 'text-primary'}`}>
                  {selectedNode.status}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Select a node on the map to inspect spatial context.</p>
          )}
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent/5 p-4 text-xs leading-5 text-muted-foreground">
          <Info size={15} className="mt-0.5 shrink-0 text-accent" /> Spatial map reflects live environment sensors.
          Verify ground surfaces before stepping forward.
        </div>
      </section>
    </div>
  );
}

function DirectionRow({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/40 p-3">
      <span className="font-mono text-[10px] uppercase tracking-[.08em] text-muted-foreground">{label}</span>
      <span className={`text-xs font-medium ${danger ? 'text-destructive font-semibold' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}
