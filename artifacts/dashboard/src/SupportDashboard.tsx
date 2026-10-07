import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AlertCircle, Check, ChevronDown, CircleHelp, Loader2, Plus, RefreshCw, Save, Send, Settings2, Shield, Ticket, Trash2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL;
const SUPPORT_URL = `${BASE}bot-api/support`;
const CONFIG_URL = `${BASE}bot-api/support/config`;
const PANEL_URL = `${BASE}bot-api/support/panel`;

type EmbedTemplate = {
  title: string;
  description: string;
  color: string;
  footer: string;
  imageUrl: string;
  thumbnailUrl: string;
};
type EventMessageConfig = { enabled: boolean; channelId: string; roleId?: string; content: string; embed: EmbedTemplate };
type PanelOption = { key: string; label: string; description: string; emoji: string; categoryId: string; style: string };
type ModmailCategory = { key: string; label: string; description: string; emoji: string };
type TicketConfig = { panelMode: "buttons" | "select"; panelOptions: PanelOption[]; panelEmbed: EmbedTemplate; openedEmbed: EmbedTemplate; openedLogEmbed: EmbedTemplate; closedEmbed: EmbedTemplate };
type ModmailConfig = {
  enabled: boolean;
  categoryId: string;
  logChannelId: string;
  staffRoleId: string;
  responseTimeoutMinutes: number;
  categories: ModmailCategory[];
  embeds: { serverPicker: EmbedTemplate; topicPicker: EmbedTemplate; opened: EmbedTemplate; userMessage: EmbedTemplate; staffReply: EmbedTemplate; closed: EmbedTemplate };
};
type TicketRow = { id: string; channelId: string; guildId: string; userId: string; type: string; reason: string; open: boolean; openedAt: number };
type ModmailRow = { channelId: string; guildId: string; userId: string; username: string; categoryKey: string; categoryName: string; open: boolean; openedAt: number };
type SupportResponse = { configs: Record<string, { ticket?: TicketConfig; modmail?: ModmailConfig | null; boost?: EventMessageConfig | null; twitchSubscriber?: EventMessageConfig | null }>; tickets: TicketRow[]; modmailTickets: ModmailRow[] };
type Props = { guilds: { id: string; name: string }[]; onRefresh: () => void };

const blankEmbed = (): EmbedTemplate => ({ title: "", description: "", color: "#b95e71", footer: "", imageUrl: "", thumbnailUrl: "" });
const defaultTicket = (): TicketConfig => ({
  panelMode: "buttons",
  panelOptions: [{ key: "general", label: "General support", description: "Ask the team for help", emoji: "", categoryId: "", style: "primary" }],
  panelEmbed: { ...blankEmbed(), title: "How can we help?", description: "Choose a topic below to open a private support ticket." },
  openedEmbed: { ...blankEmbed(), title: "Your ticket is open", description: "A moderator will be with you shortly." },
  openedLogEmbed: { ...blankEmbed(), title: "Ticket opened", description: "{user} opened a {type} ticket in {channel}." },
  closedEmbed: { ...blankEmbed(), title: "Ticket closed", description: "This conversation has been closed." },
});
const defaultBoostMessage = (): EventMessageConfig => ({
  enabled: false,
  channelId: "",
  content: "Thank you {user} for boosting {server}!",
  embed: { ...blankEmbed(), title: "Thank you for the boost!", description: "{user} just boosted **{server}**." },
});
const defaultTwitchSubscriberMessage = (): EventMessageConfig => ({
  enabled: false,
  channelId: "",
  roleId: "",
  content: "Thanks {user} for subscribing on Twitch!",
  embed: { ...blankEmbed(), title: "Thank you for subscribing!", description: "{user} just subscribed to the Twitch integration." },
});
const defaultModmail = (): ModmailConfig => ({
  enabled: false,
  categoryId: "",
  logChannelId: "",
  staffRoleId: "",
  responseTimeoutMinutes: 15,
  categories: [{ key: "general", label: "General enquiry", description: "Talk to the moderation team", emoji: "" }],
  embeds: {
    serverPicker: { ...blankEmbed(), title: "Choose a server", description: "Select the community you want to contact." },
    topicPicker: { ...blankEmbed(), title: "Choose a topic", description: "What would you like to talk about?" },
    opened: { ...blankEmbed(), title: "Conversation opened", description: "A member of the team will reply here." },
    userMessage: { ...blankEmbed(), title: "New message", description: "A new message has arrived." },
    staffReply: { ...blankEmbed(), title: "Team reply", description: "The team has replied to your conversation." },
    closed: { ...blankEmbed(), title: "Conversation closed", description: "This conversation has been closed." },
  },
});

const inputClass = "w-full rounded-lg border border-rose-950/70 bg-[#21191d] px-3 py-2.5 text-sm text-rose-50 placeholder:text-rose-200/30 outline-none transition focus:border-rose-400/70 focus:ring-2 focus:ring-rose-400/10";
const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[.13em] text-rose-100/55";
const cardClass = "rounded-xl border border-rose-950/70 bg-[#21191d] p-4 sm:p-5";

function StatusPill({ open }: { open: boolean }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${open ? "border-emerald-800/70 bg-emerald-950/50 text-emerald-300" : "border-rose-950 bg-[#2b2025] text-rose-200/60"}`}>{open ? "Open" : "Closed"}</span>;
}

function EmbedEditor({ title, value, onChange }: { title: string; value: EmbedTemplate; onChange: (value: EmbedTemplate) => void }) {
  const set = (field: keyof EmbedTemplate, next: string) => onChange({ ...value, [field]: next });
  return (
    <details className="group rounded-xl border border-rose-950/70 bg-[#21191d]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="font-medium text-rose-50">{title}</span>
        <ChevronDown size={16} className="text-rose-100/50 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid gap-3 border-t border-rose-950/70 p-4 sm:grid-cols-2">
        <label><span className={labelClass}>Title</span><input className={inputClass} value={value.title ?? ""} onChange={e => set("title", e.target.value)} placeholder="Embed title" /></label>
        <label><span className={labelClass}>Footer</span><input className={inputClass} value={value.footer ?? ""} onChange={e => set("footer", e.target.value)} placeholder="Optional footer" /></label>
        <label className="sm:col-span-2"><span className={labelClass}>Description</span><textarea className={`${inputClass} min-h-20 resize-y`} value={value.description ?? ""} onChange={e => set("description", e.target.value)} placeholder="Write the message members will see" /></label>
        <label><span className={labelClass}>Embed color</span><div className="flex gap-2"><input aria-label={`${title} color`} type="color" className="h-[42px] w-12 cursor-pointer rounded-lg border border-rose-950/70 bg-[#21191d] p-1" value={/^#[0-9a-f]{6}$/i.test(value.color ?? "") ? value.color : "#b95e71"} onChange={e => set("color", e.target.value)} /><input className={inputClass} value={value.color ?? ""} onChange={e => set("color", e.target.value)} placeholder="#b95e71" /></div></label>
        <label><span className={labelClass}>Footer image URL</span><input className={inputClass} value={value.imageUrl ?? ""} onChange={e => set("imageUrl", e.target.value)} placeholder="https://" /></label>
        <label className="sm:col-span-2"><span className={labelClass}>Thumbnail URL</span><input className={inputClass} value={value.thumbnailUrl ?? ""} onChange={e => set("thumbnailUrl", e.target.value)} placeholder="https://" /></label>
      </div>
    </details>
  );
}

function EventMessageEditor({ title, help, config, onChange, requireRole = false }: {
  title: string;
  help: string;
  config: EventMessageConfig;
  onChange: (value: EventMessageConfig) => void;
  requireRole?: boolean;
}) {
  return (
    <section className={cardClass}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm leading-5 text-rose-100/55">{help}</p></div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-rose-950/70 bg-[#1e171a] px-3 py-2 text-sm">
          <input type="checkbox" checked={config.enabled} onChange={event => onChange({ ...config, enabled: event.target.checked })} className="h-4 w-4 accent-rose-300" />
          <span>Enabled</span>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className={labelClass}>Announcement channel ID</span><input className={inputClass} value={config.channelId} onChange={event => onChange({ ...config, channelId: event.target.value })} placeholder="Discord channel ID" /></label>
        {requireRole && <label><span className={labelClass}>Twitch subscriber role ID</span><input className={inputClass} value={config.roleId ?? ""} onChange={event => onChange({ ...config, roleId: event.target.value })} placeholder="Role granted to Twitch subscribers" /></label>}
        <label className="sm:col-span-2"><span className={labelClass}>Message text</span><textarea className={`${inputClass} min-h-20 resize-y`} value={config.content} onChange={event => onChange({ ...config, content: event.target.value })} placeholder="Write an optional plain-text message" /></label>
      </div>
      <p className="mt-2 text-xs leading-5 text-rose-100/40">Placeholders: {"{user}"}, {"{user.name}"}, {"{user.tag}"}, {"{server}"}. Boost messages also support {"{boosts}"} and {"{tier}"}.</p>
      <div className="mt-4"><EmbedEditor title={`${title} embed`} value={config.embed} onChange={embed => onChange({ ...config, embed })} /></div>
    </section>
  );
}

function TicketOptionEditor({ option, index, onChange, onRemove }: { option: PanelOption; index: number; onChange: (option: PanelOption) => void; onRemove: () => void }) {
  const field = (key: keyof PanelOption, value: string) => onChange({ ...option, [key]: value });
  return (
    <div className="rounded-xl border border-rose-950/70 bg-[#21191d] p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-rose-50">Option {String(index + 1).padStart(2, "0")}</p>
        <button type="button" onClick={onRemove} aria-label={`Remove option ${index + 1}`} className="rounded-md p-2 text-rose-100/45 hover:bg-rose-950/50 hover:text-rose-200"><Trash2 size={15} /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className={labelClass}>Key</span><input className={inputClass} value={option.key} onChange={e => field("key", e.target.value)} placeholder="general_support" /></label>
        <label><span className={labelClass}>Label</span><input className={inputClass} value={option.label} onChange={e => field("label", e.target.value)} placeholder="General support" /></label>
        <label className="sm:col-span-2"><span className={labelClass}>Description</span><input className={inputClass} value={option.description} onChange={e => field("description", e.target.value)} placeholder="What this ticket is for" /></label>
        <label><span className={labelClass}>Emoji value</span><input className={inputClass} value={option.emoji} onChange={e => field("emoji", e.target.value)} placeholder="Optional Discord emoji" /></label>
        <label><span className={labelClass}>Category channel ID</span><input className={inputClass} value={option.categoryId} onChange={e => field("categoryId", e.target.value)} placeholder="Discord channel ID" /></label>
        <label><span className={labelClass}>Button style</span><select className={inputClass} value={option.style} onChange={e => field("style", e.target.value)}><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="success">Success</option><option value="danger">Danger</option></select></label>
      </div>
    </div>
  );
}

function ModmailCategoryEditor({ category, index, onChange, onRemove }: { category: ModmailCategory; index: number; onChange: (category: ModmailCategory) => void; onRemove: () => void }) {
  const field = (key: keyof ModmailCategory, value: string) => onChange({ ...category, [key]: value });
  return (
    <div className="grid gap-3 rounded-xl border border-rose-950/70 bg-[#21191d] p-4 sm:grid-cols-2">
      <div className="sm:col-span-2 flex items-center justify-between"><p className="text-sm font-semibold text-rose-50">Category {String(index + 1).padStart(2, "0")}</p><button type="button" onClick={onRemove} aria-label={`Remove category ${index + 1}`} className="rounded-md p-2 text-rose-100/45 hover:bg-rose-950/50 hover:text-rose-200"><Trash2 size={15} /></button></div>
      <label><span className={labelClass}>Key</span><input className={inputClass} value={category.key} onChange={e => field("key", e.target.value)} placeholder="billing" /></label>
      <label><span className={labelClass}>Label</span><input className={inputClass} value={category.label} onChange={e => field("label", e.target.value)} placeholder="Billing question" /></label>
      <label><span className={labelClass}>Description</span><input className={inputClass} value={category.description} onChange={e => field("description", e.target.value)} placeholder="What this is for" /></label>
      <label><span className={labelClass}>Emoji value</span><input className={inputClass} value={category.emoji} onChange={e => field("emoji", e.target.value)} placeholder="Optional Discord emoji" /></label>
    </div>
  );
}

export default function SupportDashboard({ guilds, onRefresh }: Props) {
  const [guildId, setGuildId] = useState(guilds[0]?.id ?? "");
  const [data, setData] = useState<SupportResponse | null>(null);
  const [ticket, setTicket] = useState<TicketConfig>(defaultTicket);
  const [modmail, setModmail] = useState<ModmailConfig>(defaultModmail);
  const [view, setView] = useState<"tickets" | "modmail" | "activity">("tickets");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState<"" | "ticket" | "modmail">("");
  const [notice, setNotice] = useState("");
  const [publishChannel, setPublishChannel] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const selectedGuild = useMemo(() => guilds.find(guild => guild.id === guildId), [guilds, guildId]);

  const load = useCallback(async () => {
    if (!guildId) { setLoading(false); setData({ configs: {}, tickets: [], modmailTickets: [] }); return; }
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch(SUPPORT_URL, { credentials: "include" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const result = await response.json() as SupportResponse;
      setData(result);
      const config = result.configs?.[guildId];
      setTicket(config?.ticket ? { ...defaultTicket(), ...config.ticket, panelOptions: config.ticket.panelOptions ?? [] } : defaultTicket());
      setModmail(config?.modmail ? { ...defaultModmail(), ...config.modmail, categories: config.modmail.categories ?? [], embeds: { ...defaultModmail().embeds, ...config.modmail.embeds } } : defaultModmail());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load support settings.");
    } finally { setLoading(false); }
  }, [guildId]);

  useEffect(() => { setGuildId(current => guilds.some(guild => guild.id === current) ? current : guilds[0]?.id ?? ""); }, [guilds]);
  useEffect(() => { void load(); }, [load]);

  const save = async (kind: "ticket" | "modmail") => {
    if (!guildId) return;
    setSaving(kind); setNotice("");
    try {
      const response = await fetch(CONFIG_URL, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guildId, [kind]: kind === "ticket" ? ticket : modmail }) });
      if (!response.ok) throw new Error(`Save failed (${response.status})`);
      const result = await response.json();
      if (!result?.success) throw new Error("The settings were not saved.");
      setNotice(kind === "ticket" ? "Ticket settings saved." : "ModMail settings saved.");
      setData(current => current ? { ...current, configs: { ...current.configs, [guildId]: { ...current.configs[guildId], [kind]: kind === "ticket" ? ticket : modmail } } } : current);
      onRefresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save settings."); }
    finally { setSaving(""); }
  };

  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPublishError("");
    if (!guildId || !publishChannel.trim()) { setPublishError("Enter the channel ID where the panel should be published."); return; }
    setPublishing(true);
    try {
      const response = await fetch(PANEL_URL, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guildId, channelId: publishChannel.trim() }) });
      if (!response.ok) throw new Error(`Publish failed (${response.status})`);
      const result = await response.json();
      if (!result?.success) throw new Error("The panel could not be published.");
      setNotice("Ticket panel published."); setPublishChannel(""); onRefresh();
    } catch (error) { setPublishError(error instanceof Error ? error.message : "Could not publish the ticket panel."); }
    finally { setPublishing(false); }
  };

  const tickets = (data?.tickets ?? []).filter(item => item.guildId === guildId);
  const conversations = (data?.modmailTickets ?? []).filter(item => item.guildId === guildId);
  const visibleItems = view === "tickets" ? tickets : view === "modmail" ? conversations : [...tickets, ...conversations];
  const updateOption = (index: number, value: PanelOption) => setTicket(current => ({ ...current, panelOptions: current.panelOptions.map((option, i) => i === index ? value : option) }));
  const updateCategory = (index: number, value: ModmailCategory) => setModmail(current => ({ ...current, categories: current.categories.map((category, i) => i === index ? value : category) }));
  const updateTicketEmbed = (key: "panelEmbed" | "openedEmbed" | "closedEmbed", value: EmbedTemplate) => setTicket(current => ({ ...current, [key]: value }));
  const updateModmailEmbed = (key: keyof ModmailConfig["embeds"], value: EmbedTemplate) => setModmail(current => ({ ...current, embeds: { ...current.embeds, [key]: value } }));

  return (
    <main className="min-h-[100dvh] space-y-6 text-rose-50">
      <header className="relative overflow-hidden rounded-2xl border border-rose-950/70 bg-[#241a1e] px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border border-rose-500/10" />
        <div className="pointer-events-none absolute -right-1 top-4 h-40 w-40 rounded-full border border-rose-500/10" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.2em] text-rose-300"><Shield size={14} /> Community operations</div>
            <h1 className="font-semibold tracking-tight text-3xl sm:text-4xl">Support desk</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-rose-100/60">Set the stage for member support. Configure ticket channels and private ModMail from one dependable control room.</p>
          </div>
          <label className="w-full md:max-w-[270px]"><span className={labelClass}>Active server</span><select className={inputClass} value={guildId} onChange={event => setGuildId(event.target.value)} disabled={!guilds.length}><option value="" disabled>Select a server</option>{guilds.map(guild => <option key={guild.id} value={guild.id}>{guild.name}</option>)}</select></label>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-2 text-xs text-rose-100/55">
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-950 bg-[#1e171a] px-3 py-1.5"><Ticket size={13} /> {tickets.filter(item => item.open).length} active tickets</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-950 bg-[#1e171a] px-3 py-1.5"><CircleHelp size={13} /> {conversations.filter(item => item.open).length} active conversations</span>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-rose-950/70 pb-3" role="tablist" aria-label="Support sections">
        {([{ id: "tickets", label: "Ticket system" }, { id: "modmail", label: "ModMail" }, { id: "activity", label: "Activity" }] as const).map(tab => (
          <button key={tab.id} type="button" role="tab" aria-selected={view === tab.id} onClick={() => setView(tab.id)} className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${view === tab.id ? "bg-rose-300 text-[#271a1e]" : "text-rose-100/60 hover:bg-rose-950/50 hover:text-rose-50"}`}>{tab.label}</button>
        ))}
        <button type="button" onClick={() => void load()} className="ml-auto inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-100/55 hover:bg-rose-950/50 hover:text-rose-50" aria-label="Refresh support data"><RefreshCw size={15} /> <span className="hidden sm:inline">Refresh</span></button>
      </div>

      {notice && <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-900/60 bg-emerald-950/35 px-4 py-3 text-sm text-emerald-200"><Check size={16} />{notice}<button type="button" onClick={() => setNotice("")} className="ml-auto text-emerald-200/60 hover:text-emerald-100">Dismiss</button></div>}
      {loadError && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-800/70 bg-rose-950/30 px-4 py-3 text-sm text-rose-200"><AlertCircle size={16} />Could not load support data: {loadError}<button type="button" onClick={() => void load()} className="ml-auto underline underline-offset-4">Try again</button></div>}

      {loading ? <div className="space-y-4" aria-label="Loading support settings"><div className="h-28 animate-pulse rounded-xl bg-rose-950/35" /><div className="h-64 animate-pulse rounded-xl bg-rose-950/25" /><div className="h-36 animate-pulse rounded-xl bg-rose-950/20" /></div> : !guilds.length ? (
        <div className={`${cardClass} py-14 text-center`}><Shield size={25} className="mx-auto mb-3 text-rose-300/65" /><h2 className="font-semibold">No servers available</h2><p className="mt-2 text-sm text-rose-100/55">Connect a server to configure its support desk.</p></div>
      ) : view === "tickets" ? (
        <div className="space-y-5">
          <section className={cardClass}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-[.17em] text-rose-300">01 / Ticket panel</p><h2 className="mt-1 text-xl font-semibold">Choose how members ask for help</h2><p className="mt-1 text-sm text-rose-100/55">Define the menu and the categories that receive new tickets.</p></div>
              <Settings2 className="mt-1 shrink-0 text-rose-300/70" size={19} />
            </div>
            <div className="mb-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <label><span className={labelClass}>Panel interaction</span><select className={inputClass} value={ticket.panelMode} onChange={e => setTicket(current => ({ ...current, panelMode: e.target.value as TicketConfig["panelMode"] }))}><option value="buttons">Buttons</option><option value="select">Dropdown menu</option></select></label>
              <form onSubmit={publish} className="rounded-lg border border-rose-950/70 bg-[#1e171a] p-3">
                <label><span className={labelClass}>Publish panel to channel ID</span><div className="flex gap-2"><input className={inputClass} value={publishChannel} onChange={e => setPublishChannel(e.target.value)} placeholder="Discord channel ID" /><button type="submit" disabled={publishing} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-rose-300 px-3 text-sm font-semibold text-[#271a1e] hover:bg-rose-200 disabled:opacity-60">{publishing ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}<span className="hidden sm:inline">Publish</span></button></div></label>
                {publishError && <p role="alert" className="mt-2 text-xs text-rose-300">{publishError}</p>}
              </form>
            </div>
            <div className="space-y-3">
              {ticket.panelOptions.map((option, index) => <TicketOptionEditor key={`${index}-${option.key}`} option={option} index={index} onChange={value => updateOption(index, value)} onRemove={() => setTicket(current => ({ ...current, panelOptions: current.panelOptions.filter((_, i) => i !== index) }))} />)}
              {!ticket.panelOptions.length && <div className="rounded-lg border border-dashed border-rose-900/70 px-4 py-8 text-center text-sm text-rose-100/50">No ticket options yet. Add an option to build your panel.</div>}
              <button type="button" onClick={() => setTicket(current => ({ ...current, panelOptions: [...current.panelOptions, { key: "", label: "", description: "", emoji: "", categoryId: "", style: "primary" }] }))} className="inline-flex items-center gap-2 rounded-lg border border-rose-900/70 px-3 py-2 text-sm font-medium text-rose-200 hover:bg-rose-950/45"><Plus size={15} />Add ticket option</button>
            </div>
          </section>
          <section className={cardClass}>
            <p className="text-xs font-semibold uppercase tracking-[.17em] text-rose-300">02 / Messages</p><h2 className="mb-4 mt-1 text-xl font-semibold">Ticket embed templates</h2>
            <div className="space-y-2.5">
              <EmbedEditor title="Ticket panel" value={ticket.panelEmbed} onChange={value => updateTicketEmbed("panelEmbed", value)} />
              <EmbedEditor title="Ticket opened" value={ticket.openedEmbed} onChange={value => updateTicketEmbed("openedEmbed", value)} />
              <EmbedEditor title="Ticket closed" value={ticket.closedEmbed} onChange={value => updateTicketEmbed("closedEmbed", value)} />
            </div>
          </section>
          <div className="sticky bottom-3 z-10 flex justify-end"><button type="button" onClick={() => void save("ticket")} disabled={!!saving || !guildId} className="inline-flex items-center gap-2 rounded-xl bg-rose-300 px-5 py-3 text-sm font-semibold text-[#271a1e] shadow-lg shadow-black/20 hover:bg-rose-200 disabled:opacity-60">{saving === "ticket" ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}Save ticket settings</button></div>
        </div>
      ) : view === "modmail" ? (
        <div className="space-y-5">
          <section className={cardClass}>
            <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.17em] text-rose-300">01 / Private conversations</p><h2 className="mt-1 text-xl font-semibold">ModMail routing</h2><p className="mt-1 text-sm text-rose-100/55">Set where private conversations live and who receives them.</p></div><label className="flex cursor-pointer items-center gap-3 rounded-lg border border-rose-950/70 bg-[#1e171a] px-3 py-2.5 text-sm"><input type="checkbox" checked={modmail.enabled} onChange={e => setModmail(current => ({ ...current, enabled: e.target.checked }))} className="h-4 w-4 accent-rose-300" /><span>Enabled</span></label></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label><span className={labelClass}>Conversation category ID</span><input className={inputClass} value={modmail.categoryId} onChange={e => setModmail(current => ({ ...current, categoryId: e.target.value }))} placeholder="Discord channel ID" /></label>
              <label><span className={labelClass}>Log channel ID</span><input className={inputClass} value={modmail.logChannelId} onChange={e => setModmail(current => ({ ...current, logChannelId: e.target.value }))} placeholder="Discord channel ID" /></label>
              <label><span className={labelClass}>Staff role ID</span><input className={inputClass} value={modmail.staffRoleId} onChange={e => setModmail(current => ({ ...current, staffRoleId: e.target.value }))} placeholder="Discord role ID" /></label>
              <label><span className={labelClass}>No-reply timeout (minutes)</span><input className={inputClass} type="number" min={1} max={1440} step={1} value={modmail.responseTimeoutMinutes} onChange={e => setModmail(current => ({ ...current, responseTimeoutMinutes: Math.max(1, Math.min(1440, Number(e.target.value) || 1)) }))} /></label>
            </div>
          </section>
          <section className={cardClass}>
            <p className="text-xs font-semibold uppercase tracking-[.17em] text-rose-300">02 / Topics</p><h2 className="mb-4 mt-1 text-xl font-semibold">ModMail categories</h2>
            <div className="space-y-3">{modmail.categories.map((category, index) => <ModmailCategoryEditor key={`${index}-${category.key}`} category={category} index={index} onChange={value => updateCategory(index, value)} onRemove={() => setModmail(current => ({ ...current, categories: current.categories.filter((_, i) => i !== index) }))} />)}
              {!modmail.categories.length && <div className="rounded-lg border border-dashed border-rose-900/70 px-4 py-8 text-center text-sm text-rose-100/50">No categories yet. Add a topic for members to choose.</div>}
              <button type="button" onClick={() => setModmail(current => ({ ...current, categories: [...current.categories, { key: "", label: "", description: "", emoji: "" }] }))} className="inline-flex items-center gap-2 rounded-lg border border-rose-900/70 px-3 py-2 text-sm font-medium text-rose-200 hover:bg-rose-950/45"><Plus size={15} />Add category</button>
            </div>
          </section>
          <section className={cardClass}>
            <p className="text-xs font-semibold uppercase tracking-[.17em] text-rose-300">03 / Messages</p><h2 className="mb-4 mt-1 text-xl font-semibold">ModMail embed templates</h2>
            <div className="space-y-2.5">
              <EmbedEditor title="Server picker" value={modmail.embeds.serverPicker} onChange={value => updateModmailEmbed("serverPicker", value)} />
              <EmbedEditor title="Topic picker" value={modmail.embeds.topicPicker} onChange={value => updateModmailEmbed("topicPicker", value)} />
              <EmbedEditor title="Conversation opened" value={modmail.embeds.opened} onChange={value => updateModmailEmbed("opened", value)} />
              <EmbedEditor title="User message" value={modmail.embeds.userMessage} onChange={value => updateModmailEmbed("userMessage", value)} />
              <EmbedEditor title="Staff reply" value={modmail.embeds.staffReply} onChange={value => updateModmailEmbed("staffReply", value)} />
              <EmbedEditor title="Conversation closed" value={modmail.embeds.closed} onChange={value => updateModmailEmbed("closed", value)} />
            </div>
          </section>
          <div className="sticky bottom-3 z-10 flex justify-end"><button type="button" onClick={() => void save("modmail")} disabled={!!saving || !guildId} className="inline-flex items-center gap-2 rounded-xl bg-rose-300 px-5 py-3 text-sm font-semibold text-[#271a1e] shadow-lg shadow-black/20 hover:bg-rose-200 disabled:opacity-60">{saving === "modmail" ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}Save ModMail settings</button></div>
        </div>
      ) : (
        <section className={cardClass}>
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[.17em] text-rose-300">Live register</p><h2 className="mt-1 text-xl font-semibold">Support activity</h2><p className="mt-1 text-sm text-rose-100/55">Review ticket channels and private conversations for {selectedGuild?.name ?? "this server"}.</p></div>
            <div className="flex gap-1 rounded-lg bg-[#1a1417] p-1" aria-label="Activity filter">{(["tickets", "modmail", "activity"] as const).map(filter => <button key={filter} type="button" onClick={() => setView(filter)} className="rounded-md px-3 py-2 text-xs capitalize text-rose-100/55 hover:bg-rose-950/50 aria-[pressed=true]:bg-rose-300 aria-[pressed=true]:text-[#271a1e]" aria-pressed={view === filter}>{filter === "activity" ? "All" : filter === "modmail" ? "ModMail" : "Tickets"}</button>)}</div>
          </div>
          {!visibleItems.length ? <div className="rounded-xl border border-dashed border-rose-900/70 px-5 py-14 text-center"><CircleHelp size={25} className="mx-auto mb-3 text-rose-300/60" /><h3 className="font-semibold">No conversations to review</h3><p className="mt-2 text-sm text-rose-100/50">New tickets and ModMail conversations will appear here.</p></div> :
            <div className="space-y-2">{visibleItems.map((item, index) => {
              const isModmail = "username" in item;
              const channelId = item.channelId;
              const timestamp = item.openedAt;
              const date = new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp);
              return <article key={`${isModmail ? "modmail" : "ticket"}-${channelId}-${index}`} className="flex flex-col gap-3 rounded-xl border border-rose-950/70 bg-[#1e171a] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{isModmail ? item.username : `${item.type} ticket`}</span><StatusPill open={item.open} /><span className="rounded-md border border-rose-950/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-rose-100/45">{isModmail ? "ModMail" : "Ticket"}</span></div>
                  <p className="truncate text-sm text-rose-100/55">{isModmail ? item.categoryName : item.reason || "No reason provided"}</p>
                  <p className="mt-1 font-mono text-[11px] text-rose-100/35">Member {item.userId} · Channel {channelId}</p>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 text-xs text-rose-100/45 sm:flex-col sm:items-end"><time dateTime={Number.isNaN(date.getTime()) ? undefined : date.toISOString()}>{Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString()}</time><span>Opened {Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString()}</span></div>
              </article>;
            })}</div>
          }
        </section>
      )}
    </main>
  );
}
