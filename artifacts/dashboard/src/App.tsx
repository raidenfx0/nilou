import { useEffect, useState, useCallback } from "react";

const BASE = import.meta.env.BASE_URL;
const API = `${BASE}bot-api`;

interface BotStats {
  tag: string;
  status: "online" | "offline";
  uptime: string;
  uptimeMs: number;
  guildCount: number;
  ping: number;
}

interface AfkUser {
  key: string;
  userId: string;
  guildId: string;
  reason: string;
  since: number;
}

interface Ticket {
  id: string;
  channelId: string;
  guildId: string;
  userId: string;
  type: string;
  reason: string;
  open: boolean;
  openedAt: number;
  members: string[];
}

interface Guild {
  id: string;
  name: string;
  memberCount: number;
  icon: string | null;
}

type TabKey = "overview" | "guilds" | "tickets" | "afk" | "commands";

const COMMANDS = [
  { name: "/help", desc: "View all available commands", category: "General" },
  { name: "/ping", desc: "Check bot latency", category: "General" },
  { name: "/botinfo", desc: "About Nilou bot", category: "General" },
  { name: "/serverinfo", desc: "Server statistics", category: "General" },
  { name: "/timestamp", desc: "Generate a dynamic Discord timestamp", category: "Utility" },
  { name: "/embed", desc: "Send a styled embed message (use \\n for new lines)", category: "Utility" },
  { name: "/countdown", desc: "Countdown to the Subzeruz Festival", category: "Utility" },
  { name: "/afk set", desc: "Mark yourself as AFK with optional reason", category: "AFK" },
  { name: "/afk clear", desc: "Remove your AFK status", category: "AFK" },
  { name: "/ticket open", desc: "Open a new support ticket", category: "Tickets" },
  { name: "/ticket close", desc: "Close the current ticket", category: "Tickets" },
  { name: "/ticket add", desc: "Add a user to this ticket", category: "Tickets" },
  { name: "/ticket remove", desc: "Remove a user from this ticket", category: "Tickets" },
  { name: "/ticket setup", desc: "Configure ticket categories (admin)", category: "Tickets" },
  { name: "/sticky", desc: "Pin a sticky message in a channel (admin)", category: "Moderation" },
  { name: "/purge", desc: "Bulk delete messages (admin)", category: "Moderation" },
  { name: "/welcome", desc: "Configure welcome messages (admin)", category: "Moderation" },
  { name: "/ghostping", desc: "Enable ghost ping detection (admin)", category: "Moderation" },
  { name: "/reactionrole", desc: "Set up reaction roles (admin)", category: "Moderation" },
  { name: "/adminrole", desc: "Set the bot admin role (admin)", category: "Moderation" },
];

const CATEGORY_COLORS: Record<string, string> = {
  General: "bg-rose-900/40 text-rose-300 border border-rose-800/50",
  Utility: "bg-pink-900/40 text-pink-300 border border-pink-800/50",
  AFK: "bg-fuchsia-900/40 text-fuchsia-300 border border-fuchsia-800/50",
  Tickets: "bg-red-900/40 text-red-300 border border-red-800/50",
  Moderation: "bg-orange-900/40 text-orange-300 border border-orange-800/50",
};

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${online ? "bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.5)]" : "bg-gray-500"}`}
    />
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-rose-900/40 bg-card p-4 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-widest">{label}</span>
      <span className="text-2xl font-bold text-primary">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m === 1) return "1 min ago";
  if (m < 60) return `${m} mins ago`;
  const h = Math.floor(m / 60);
  if (h === 1) return "1 hour ago";
  return `${h} hours ago`;
}

function PingBadge({ ping }: { ping: number }) {
  const color = ping < 100 ? "text-green-400" : ping < 250 ? "text-yellow-400" : "text-red-400";
  const label = ping < 100 ? "Excellent" : ping < 250 ? "Good" : "Poor";
  return <span className={`text-sm font-mono ${color}`}>{ping}ms · {label}</span>;
}

export default function App() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [stats, setStats] = useState<BotStats | null>(null);
  const [afk, setAfk] = useState<AfkUser[]>([]);
  const [openTickets, setOpenTickets] = useState<Ticket[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [s, a, t, g] = await Promise.all([
        fetch(`${API}/stats`).then((r) => r.json()),
        fetch(`${API}/afk`).then((r) => r.json()),
        fetch(`${API}/tickets`).then((r) => r.json()),
        fetch(`${API}/guilds`).then((r) => r.json()),
      ]);
      setStats(s);
      setAfk(a);
      setOpenTickets((t as Ticket[]).filter((x) => x.open));
      setGuilds(g);
      setError(null);
      setLastRefresh(new Date());
    } catch {
      setError("Could not reach the bot. Is it running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 8000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const TABS: { key: TabKey; label: string; emoji: string }[] = [
    { key: "overview", label: "Overview", emoji: "🌸" },
    { key: "guilds", label: "Guilds", emoji: "🏰" },
    { key: "tickets", label: "Tickets", emoji: "🎟️" },
    { key: "afk", label: "AFK", emoji: "💤" },
    { key: "commands", label: "Commands", emoji: "📜" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/40 glow flex items-center justify-center text-lg">🌺</div>
            <div>
              <h1 className="text-base font-bold text-primary leading-tight">Nilou Bot Dashboard</h1>
              <p className="text-xs text-muted-foreground">Dancer of the Zubayr Theater · by soda</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {stats && (
              <>
                <StatusDot online={stats.status === "online"} />
                <span>{stats.status === "online" ? "Online" : "Offline"}</span>
                <span className="ml-2 text-border">·</span>
                <span>Refreshes every 8s</span>
              </>
            )}
            {lastRefresh && (
              <span className="ml-2 opacity-60">Updated {lastRefresh.toLocaleTimeString()}</span>
            )}
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 flex gap-1 pb-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key
                  ? "border-primary text-primary font-semibold bg-primary/10"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/20"
              }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <span className="animate-pulse text-primary text-2xl mr-3">🌸</span>
            <span>Connecting to Nilou...</span>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-6 text-center">
            <div className="text-4xl mb-3">💧</div>
            <p className="text-red-400 font-semibold">{error}</p>
            <p className="text-muted-foreground text-sm mt-1">Make sure the Discord Bot workflow is running.</p>
            <button
              onClick={fetchAll}
              className="mt-4 px-4 py-2 bg-primary/20 border border-primary/40 rounded-lg text-primary text-sm hover:bg-primary/30 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && stats && (
          <>
            {tab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Status" value={stats.status === "online" ? "Online" : "Offline"} sub={stats.tag} />
                  <StatCard label="Uptime" value={stats.uptime} />
                  <StatCard label="Servers" value={stats.guildCount} sub="guilds" />
                  <StatCard label="Ping" value={`${stats.ping}ms`} sub={stats.ping < 100 ? "Excellent" : stats.ping < 250 ? "Good" : "Poor"} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-rose-900/40 bg-card p-4">
                    <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">💤 AFK Users <span className="text-xs text-muted-foreground font-normal">({afk.length})</span></h3>
                    {afk.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No AFK users right now.</p>
                    ) : (
                      <ul className="space-y-2">
                        {afk.slice(0, 5).map((u) => (
                          <li key={u.key} className="text-xs flex justify-between gap-2">
                            <span className="text-foreground font-mono truncate">{u.userId}</span>
                            <span className="text-muted-foreground shrink-0">{timeAgo(u.since)}</span>
                          </li>
                        ))}
                        {afk.length > 5 && <li className="text-xs text-muted-foreground">+{afk.length - 5} more</li>}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-xl border border-rose-900/40 bg-card p-4">
                    <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">🎟️ Open Tickets <span className="text-xs text-muted-foreground font-normal">({openTickets.length})</span></h3>
                    {openTickets.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No open tickets.</p>
                    ) : (
                      <ul className="space-y-2">
                        {openTickets.slice(0, 5).map((t) => (
                          <li key={t.id} className="text-xs flex justify-between gap-2">
                            <span className="text-foreground truncate">{t.type}</span>
                            <span className="text-muted-foreground shrink-0">{timeAgo(t.openedAt)}</span>
                          </li>
                        ))}
                        {openTickets.length > 5 && <li className="text-xs text-muted-foreground">+{openTickets.length - 5} more</li>}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-xl border border-rose-900/40 bg-card p-4">
                    <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">🏰 Servers</h3>
                    {guilds.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No servers yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {guilds.slice(0, 5).map((g) => (
                          <li key={g.id} className="text-xs flex justify-between gap-2">
                            <span className="text-foreground truncate">{g.name}</span>
                            <span className="text-muted-foreground shrink-0">{g.memberCount.toLocaleString()} members</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-rose-900/40 bg-card p-4">
                  <h3 className="text-sm font-semibold text-primary mb-2">🌸 Bot Health</h3>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <StatusDot online={stats.status === "online"} />
                      <span>{stats.tag}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>Latency:</span>
                      <PingBadge ping={stats.ping} />
                    </div>
                    <div className="text-muted-foreground">Uptime: <span className="text-foreground">{stats.uptime}</span></div>
                    <div className="text-muted-foreground">Total Commands: <span className="text-foreground">{COMMANDS.length}</span></div>
                  </div>
                </div>
              </div>
            )}

            {tab === "guilds" && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-primary">🏰 Servers ({guilds.length})</h2>
                {guilds.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Bot is not in any servers yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {guilds.map((g) => (
                      <div key={g.id} className="rounded-xl border border-rose-900/40 bg-card p-4 flex items-center gap-3">
                        {g.icon ? (
                          <img src={g.icon} alt={g.name} className="w-12 h-12 rounded-full border border-border" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xl">🏰</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{g.name}</p>
                          <p className="text-xs text-muted-foreground">{g.memberCount.toLocaleString()} members</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{g.id}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "tickets" && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-primary">🎟️ Open Tickets ({openTickets.length})</h2>
                {openTickets.length === 0 ? (
                  <div className="rounded-xl border border-rose-900/40 bg-card p-8 text-center text-muted-foreground">
                    <div className="text-4xl mb-3">🎟️</div>
                    <p>No open tickets right now.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {openTickets.map((t) => (
                      <div key={t.id} className="rounded-xl border border-rose-900/40 bg-card p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground">{t.type} Ticket</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800/40">Open</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 truncate">{t.reason}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <span className="font-mono">User: {t.userId}</span> · Opened {timeAgo(t.openedAt)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          <span>{t.members.length} member{t.members.length !== 1 ? "s" : ""} in ticket</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "afk" && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-primary">💤 AFK Users ({afk.length})</h2>
                {afk.length === 0 ? (
                  <div className="rounded-xl border border-rose-900/40 bg-card p-8 text-center text-muted-foreground">
                    <div className="text-4xl mb-3">😴</div>
                    <p>No one is AFK right now.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {afk.map((u) => (
                      <div key={u.key} className="rounded-xl border border-rose-900/40 bg-card p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-fuchsia-900/30 border border-fuchsia-800/40 flex items-center justify-center text-lg shrink-0">💤</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm text-foreground">{u.userId}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Reason: {u.reason}</p>
                          <p className="text-xs text-muted-foreground">AFK since {timeAgo(u.since)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "commands" && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-primary">📜 All Commands ({COMMANDS.length})</h2>
                {(["General", "Utility", "AFK", "Tickets", "Moderation"] as const).map((cat) => {
                  const cmds = COMMANDS.filter((c) => c.category === cat);
                  return (
                    <div key={cat} className="rounded-xl border border-rose-900/40 bg-card overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-border bg-accent/20">
                        <h3 className="text-sm font-semibold text-primary">{cat}</h3>
                      </div>
                      <div className="divide-y divide-border">
                        {cmds.map((c) => (
                          <div key={c.name} className="px-4 py-3 flex items-center gap-3">
                            <code className="text-xs bg-rose-950/60 border border-rose-900/40 text-primary px-2 py-1 rounded font-mono shrink-0">{c.name}</code>
                            <span className="text-sm text-muted-foreground">{c.desc}</span>
                            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[c.category]}`}>{c.category}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-border mt-8 py-4 text-center text-xs text-muted-foreground">
        🌸 Nilou Bot Dashboard · Dancer of the Zubayr Theater · made by soda
      </footer>
    </div>
  );
}
