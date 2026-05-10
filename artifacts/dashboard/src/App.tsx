import { useEffect, useState, useCallback } from "react";

const BASE = import.meta.env.BASE_URL;
const API  = `${BASE}bot-api`;

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface BotStats  { tag:string; status:string; uptime:string; uptimeMs:number; guildCount:number; ping:number; }
interface AfkUser   { key:string; userId:string; guildId:string; reason:string; since:number; }
interface Ticket    { id:string; channelId:string; guildId:string; userId:string; type:string; reason:string; open:boolean; openedAt:number; members:string[]; }
interface Guild     { id:string; name:string; memberCount:number; icon:string|null; }
interface Giveaway  { messageId:string; prize:string; winnerCount:number; endTime:number; hostId:string; guildId:string; channelId:string; ended:boolean; winners:string[]; }
interface Trigger   { phrase:string; response:string; exact:boolean; }
interface Countdown { name:string; unixTs:number; description:string|null; pinned:{channelId:string;messageId:string}|null; }
interface Sticky    { guildId:string; channelId:string; title:string|null; content:string; color:number; lastMessageId:string|null; }
interface Warning   { id:number; guild_id:string; user_id:string; moderator_id:string; reason:string; points:number; active:boolean; created_at:string; }
interface LoggingCfg { enabled:boolean; channelId:string|null; events:string[]; }
interface EcoRow    { user_id:string; guild_id:string; coins:number; theater_credits:number; fame:number; exp:number; level:number; rank:string; }

type TabKey = "overview"|"embed"|"countdown"|"giveaways"|"triggers"|"guilds"|"tickets"|"afk"|"sticky"|"logging"|"warns"|"economy"|"commands";

/* ─── Helpers ──────────────────────────────────────────────────────────── */
function timeAgo(ms:number) {
  const d=Date.now()-ms, m=Math.floor(d/60000);
  if(m<1) return "just now"; if(m===1) return "1 min ago";
  if(m<60) return `${m} mins ago`;
  const h=Math.floor(m/60); return h===1?"1 hour ago":`${h} hours ago`;
}
function countdown(unixTs:number) {
  const diff=unixTs-Math.floor(Date.now()/1000);
  if(diff<=0) return "Started!";
  const d=Math.floor(diff/86400), h=Math.floor((diff%86400)/3600), m=Math.floor((diff%3600)/60), s=diff%60;
  return `${d}d ${h}h ${m}m ${s}s`;
}
function StatusDot({online}:{online:boolean}) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${online?"bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.5)]":"bg-gray-500"}`}/>;
}
function StatCard({label,value,sub}:{label:string;value:string|number;sub?:string}) {
  return (
    <div className="rounded-xl border border-rose-900/40 bg-card p-4 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-widest">{label}</span>
      <span className="text-2xl font-bold text-primary">{value}</span>
      {sub&&<span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

const COMMANDS = [
  {name:"/help",desc:"View all available commands",cat:"General"},
  {name:"/ping",desc:"Check bot latency",cat:"General"},
  {name:"/botinfo",desc:"About Nilou bot",cat:"General"},
  {name:"/serverinfo",desc:"Server statistics",cat:"General"},
  {name:"/nilou",desc:"Random Nilou image",cat:"General"},
  {name:"/timestamp",desc:"Generate a dynamic Discord timestamp",cat:"Utility"},
  {name:"/embed",desc:"Send a styled embed",cat:"Utility"},
  {name:"/countdown set/show/pin/unpin",desc:"Manage festival countdowns",cat:"Utility"},
  {name:"/afk set/clear",desc:"AFK status system",cat:"AFK"},
  {name:"/ticket open/close/panel/setup",desc:"Full ticket system",cat:"Tickets"},
  {name:"/giveaway start/end/reroll/list",desc:"Giveaway management",cat:"Giveaway"},
  {name:"/trigger add/remove/list",desc:"Auto-response triggers",cat:"Triggers"},
  {name:"/sticky set/remove/view",desc:"Sticky message in channel",cat:"Moderation"},
  {name:"/purge",desc:"Bulk delete messages",cat:"Moderation"},
  {name:"/warn add/list/remove/clear/server",desc:"Warning points system",cat:"Moderation"},
  {name:"/logging setup/enable/disable/events",desc:"Configure server logging",cat:"Moderation"},
  {name:"/ban /kick /timeout /role",desc:"Standard moderation",cat:"Moderation"},
  {name:"/economy perform",desc:"Perform on stage to earn coins",cat:"Economy"},
  {name:"/economy balance/profile/shop/buy",desc:"Economy management",cat:"Economy"},
  {name:"/economy inventory/leaderboard",desc:"Items and rankings",cat:"Economy"},
  {name:"/gamble bet/slots/roulette/credits",desc:"Theater Gambling Hall",cat:"Economy"},
  {name:"/emojihunt start/stop/stats",desc:"Emoji scavenger hunt (earns Theater Credits!)",cat:"Economy"},
  {name:"/register /about /profile /build",desc:"Genshin Impact UID system",cat:"Genshin"},
  {name:"/cv_calc /top_artifacts /list",desc:"Artifact analysis",cat:"Genshin"},
];
const CAT_COLOR:Record<string,string>={
  General:"bg-rose-900/40 text-rose-300 border-rose-800/50",
  Utility:"bg-pink-900/40 text-pink-300 border-pink-800/50",
  AFK:"bg-fuchsia-900/40 text-fuchsia-300 border-fuchsia-800/50",
  Tickets:"bg-red-900/40 text-red-300 border-red-800/50",
  Giveaway:"bg-yellow-900/40 text-yellow-300 border-yellow-800/50",
  Triggers:"bg-violet-900/40 text-violet-300 border-violet-800/50",
  Moderation:"bg-orange-900/40 text-orange-300 border-orange-800/50",
  Economy:"bg-emerald-900/40 text-emerald-300 border-emerald-800/50",
  Genshin:"bg-blue-900/40 text-blue-300 border-blue-800/50",
};

const ALL_LOG_EVENTS = ["messageDelete","messageUpdate","memberJoin","memberLeave","banAdd","banRemove","warn","ticket","kick","roleAdd","roleRemove"];

/* ─── Main App ─────────────────────────────────────────────────────────── */
export default function App() {
  const [tab,setTab]                 = useState<TabKey>("overview");
  const [stats,setStats]             = useState<BotStats|null>(null);
  const [afk,setAfk]                 = useState<AfkUser[]>([]);
  const [openTickets,setOpenTickets] = useState<Ticket[]>([]);
  const [guilds,setGuilds]           = useState<Guild[]>([]);
  const [giveaways,setGiveaways]     = useState<Giveaway[]>([]);
  const [triggerMap,setTriggerMap]   = useState<Record<string,Trigger[]>>({});
  const [cdMap,setCdMap]             = useState<Record<string,Countdown>>({});
  const [stickies,setStickies]       = useState<Sticky[]>([]);
  const [loggingMap,setLoggingMap]   = useState<Record<string,LoggingCfg>>({});
  const [loading,setLoading]         = useState(true);
  const [error,setError]             = useState<string|null>(null);
  const [lastRefresh,setLastRefresh] = useState<Date|null>(null);

  const fetchAll = useCallback(async()=>{
    try{
      const [s,a,t,g,gw,tr,cd,st,lg]=await Promise.all([
        fetch(`${API}/stats`).then(r=>r.json()),
        fetch(`${API}/afk`).then(r=>r.json()),
        fetch(`${API}/tickets`).then(r=>r.json()),
        fetch(`${API}/guilds`).then(r=>r.json()),
        fetch(`${API}/giveaways`).then(r=>r.json()),
        fetch(`${API}/triggers`).then(r=>r.json()),
        fetch(`${API}/countdowns`).then(r=>r.json()),
        fetch(`${API}/stickies`).then(r=>r.json()),
        fetch(`${API}/logging`).then(r=>r.json()),
      ]);
      setStats(s); setAfk(a);
      setOpenTickets((t as Ticket[]).filter(x=>x.open));
      setGuilds(g); setGiveaways(gw);
      setTriggerMap(tr); setCdMap(cd);
      setStickies(Array.isArray(st)?st:[]);
      setLoggingMap(lg||{});
      setError(null); setLastRefresh(new Date());
    }catch{ setError("Could not reach the bot. Is it running?"); }
    finally{ setLoading(false); }
  },[]);

  useEffect(()=>{ fetchAll(); const i=setInterval(fetchAll,10000); return ()=>clearInterval(i); },[fetchAll]);

  const TABS:{key:TabKey;label:string;emoji:string}[]=[
    {key:"overview",  label:"Overview",    emoji:"🌸"},
    {key:"embed",     label:"Embed",       emoji:"✍️"},
    {key:"countdown", label:"Countdown",   emoji:"⏳"},
    {key:"giveaways", label:"Giveaways",   emoji:"🎊"},
    {key:"triggers",  label:"Triggers",    emoji:"💬"},
    {key:"sticky",    label:"Sticky",      emoji:"📌"},
    {key:"logging",   label:"Logging",     emoji:"📋"},
    {key:"warns",     label:"Warns",       emoji:"⚠️"},
    {key:"economy",   label:"Economy",     emoji:"💠"},
    {key:"guilds",    label:"Guilds",      emoji:"🏰"},
    {key:"tickets",   label:"Tickets",     emoji:"🎟️"},
    {key:"afk",       label:"AFK",         emoji:"💤"},
    {key:"commands",  label:"Commands",    emoji:"📜"},
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-lg">🌺</div>
            <div>
              <h1 className="text-base font-bold text-primary leading-tight">Nilou Bot Dashboard</h1>
              <p className="text-xs text-muted-foreground">Dancer of the Zubayr Theater · by soda</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {stats&&<><StatusDot online={stats.status==="online"}/><span>{stats.status==="online"?"Online":"Offline"}</span></>}
            {lastRefresh&&<span className="ml-2 opacity-60">{lastRefresh.toLocaleTimeString()}</span>}
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex gap-0.5 pb-0 overflow-x-auto">
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              className={`px-3 py-2 text-xs rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${tab===t.key?"border-primary text-primary font-semibold bg-primary/10":"border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/20"}`}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading&&<div className="flex items-center justify-center h-48 text-muted-foreground"><span className="animate-pulse text-primary text-2xl mr-3">🌸</span><span>Connecting to Nilou...</span></div>}
        {error&&!loading&&(
          <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-6 text-center">
            <div className="text-4xl mb-3">💧</div>
            <p className="text-red-400 font-semibold">{error}</p>
            <p className="text-muted-foreground text-sm mt-1">Make sure the Discord Bot workflow is running.</p>
            <button onClick={fetchAll} className="mt-4 px-4 py-2 bg-primary/20 border border-primary/40 rounded-lg text-primary text-sm hover:bg-primary/30 transition-colors">Try again</button>
          </div>
        )}
        {!loading&&!error&&stats&&(
          <>
            {tab==="overview"  &&<OverviewTab stats={stats} afk={afk} openTickets={openTickets} guilds={guilds} giveaways={giveaways} stickies={stickies}/>}
            {tab==="embed"     &&<EmbedBuilderTab guilds={guilds}/>}
            {tab==="countdown" &&<CountdownTab cdMap={cdMap} guilds={guilds} onRefresh={fetchAll}/>}
            {tab==="giveaways" &&<GiveawaysTab giveaways={giveaways} guilds={guilds}/>}
            {tab==="triggers"  &&<TriggersTab triggerMap={triggerMap} guilds={guilds} onRefresh={fetchAll}/>}
            {tab==="sticky"    &&<StickyTab stickies={stickies} guilds={guilds}/>}
            {tab==="logging"   &&<LoggingTab guilds={guilds} loggingMap={loggingMap} onRefresh={fetchAll}/>}
            {tab==="warns"     &&<WarnsTab guilds={guilds}/>}
            {tab==="economy"   &&<EconomyTab guilds={guilds}/>}
            {tab==="guilds"    &&<GuildsTab guilds={guilds}/>}
            {tab==="tickets"   &&<TicketsTab openTickets={openTickets}/>}
            {tab==="afk"       &&<AfkTab afk={afk}/>}
            {tab==="commands"  &&<CommandsTab/>}
          </>
        )}
      </main>

      <footer className="border-t border-border mt-8 py-4 text-center text-xs text-muted-foreground">
        🌸 Nilou Bot Dashboard · Dancer of the Zubayr Theater · made by soda
      </footer>
    </div>
  );
}

/* ─── Overview ─────────────────────────────────────────────────────────── */
function OverviewTab({stats,afk,openTickets,guilds,giveaways,stickies}:{stats:BotStats;afk:AfkUser[];openTickets:Ticket[];guilds:Guild[];giveaways:Giveaway[];stickies:Sticky[]}) {
  const activeGiveaways=giveaways.filter(g=>!g.ended);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Status" value={stats.status==="online"?"Online":"Offline"} sub={stats.tag}/>
        <StatCard label="Uptime" value={stats.uptime}/>
        <StatCard label="Servers" value={stats.guildCount} sub="guilds"/>
        <StatCard label="Ping" value={`${stats.ping}ms`} sub={stats.ping<100?"Excellent":stats.ping<250?"Good":"Poor"}/>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {label:"💤 AFK",count:afk.length,items:afk.slice(0,3).map(u=>({key:u.key,main:u.userId,sub:timeAgo(u.since)}))},
          {label:"🎟️ Tickets",count:openTickets.length,items:openTickets.slice(0,3).map(t=>({key:t.id,main:t.type,sub:timeAgo(t.openedAt)}))},
          {label:"🎊 Giveaways",count:activeGiveaways.length,items:activeGiveaways.slice(0,3).map(g=>({key:g.messageId,main:g.prize,sub:`${g.winnerCount}W`}))},
          {label:"📌 Stickies",count:stickies.length,items:stickies.slice(0,3).map(s=>({key:`${s.guildId}:${s.channelId}`,main:s.title||"Pinned",sub:`#${s.channelId.slice(-4)}`}))},
        ].map(card=>(
          <div key={card.label} className="rounded-xl border border-rose-900/40 bg-card p-4">
            <h3 className="text-sm font-semibold text-primary mb-3">{card.label} <span className="text-xs text-muted-foreground font-normal">({card.count})</span></h3>
            {card.items.length===0?<p className="text-xs text-muted-foreground">None right now.</p>:(
              <ul className="space-y-1.5">{card.items.map(i=>(
                <li key={i.key} className="text-xs flex justify-between gap-2"><span className="text-foreground truncate">{i.main}</span><span className="text-muted-foreground shrink-0">{i.sub}</span></li>
              ))}</ul>
            )}
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-rose-900/40 bg-card p-4">
        <h3 className="text-sm font-semibold text-primary mb-2">🌸 Bot Health</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2"><StatusDot online={stats.status==="online"}/><span>{stats.tag}</span></div>
          <div className="text-muted-foreground">Latency: <span className={stats.ping<100?"text-green-400":stats.ping<250?"text-yellow-400":"text-red-400"}>{stats.ping}ms</span></div>
          <div className="text-muted-foreground">Uptime: <span className="text-foreground">{stats.uptime}</span></div>
          <div className="text-muted-foreground">Commands: <span className="text-foreground">{COMMANDS.length}</span></div>
          <div className="text-muted-foreground">Servers: <span className="text-foreground">{guilds.length}</span></div>
        </div>
      </div>
    </div>
  );
}

/* ─── Embed Builder ────────────────────────────────────────────────────── */
function EmbedBuilderTab({guilds}:{guilds:Guild[]}) {
  const [title,setTitle]        = useState("Festival Announcement");
  const [desc,setDesc]          = useState("Welcome to the Zubayr Theater!\\nTonight we dance~");
  const [color,setColor]        = useState("#E84057");
  const [footer,setFooter]      = useState("");
  const [image,setImage]        = useState("");
  const [thumbnail,setThumbnail]= useState("");
  const [channelId,setChannelId]= useState("");
  const [guildId,setGuildId]    = useState(guilds[0]?.id||"");
  const [sending,setSending]    = useState(false);
  const [result,setResult]      = useState<{ok:boolean;msg:string}|null>(null);
  const previewDesc=desc.replace(/\\n/g,"\n");

  const send=async()=>{
    if(!channelId||!title||!desc){setResult({ok:false,msg:"Title, description, and channel ID are required."});return;}
    setSending(true);setResult(null);
    try{
      const r=await fetch(`${API}/send-embed`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({guildId,channelId,title,description:desc,color,footer,image,thumbnail})});
      const d=await r.json();
      if(d.success)setResult({ok:true,msg:"Embed sent! 🌸"});
      else setResult({ok:false,msg:d.error||"Failed."});
    }catch{setResult({ok:false,msg:"Network error."});}
    finally{setSending(false);}
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-primary">✍️ Embed Builder</h2>
        <p className="text-sm text-muted-foreground">Build and send a Nilou-styled embed. Use <code className="text-primary bg-rose-950/50 px-1 rounded">{"\\n"}</code> for new lines.</p>
        <div className="space-y-3">
          <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Title *</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Embed title..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"/></div>
          <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Description *</label>
            <textarea rows={4} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Embed description..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={color} onChange={e=>setColor(e.target.value)} className="w-10 h-9 rounded border border-border bg-transparent cursor-pointer"/>
                <input value={color} onChange={e=>setColor(e.target.value)} className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"/>
              </div></div>
            <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Footer</label>
              <input value={footer} onChange={e=>setFooter(e.target.value)} placeholder="Optional..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"/></div>
          </div>
          <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Image URL</label>
            <input value={image} onChange={e=>setImage(e.target.value)} placeholder="https://..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"/></div>
          <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Thumbnail URL</label>
            <input value={thumbnail} onChange={e=>setThumbnail(e.target.value)} placeholder="https://..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Server</label>
              <select value={guildId} onChange={e=>setGuildId(e.target.value)} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                {guilds.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
            <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Channel ID *</label>
              <input value={channelId} onChange={e=>setChannelId(e.target.value)} placeholder="123456789..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"/></div>
          </div>
        </div>
        {result&&<div className={`rounded-lg border px-4 py-3 text-sm ${result.ok?"border-green-800/50 bg-green-950/30 text-green-400":"border-red-800/50 bg-red-950/30 text-red-400"}`}>{result.msg}</div>}
        <button onClick={send} disabled={sending} className="w-full py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/80 disabled:opacity-50 transition-colors">
          {sending?"Sending...":"🌸 Send Embed to Discord"}</button>
      </div>
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Preview</h3>
        <div className="rounded-xl bg-[#1a0a0d] border border-rose-900/60 overflow-hidden">
          <div style={{borderLeft:`4px solid ${color}`}} className="p-4">
            {title&&<p className="font-bold text-white text-sm mb-1">✦ {title}</p>}
            {previewDesc&&<p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{previewDesc}</p>}
            {image&&<img src={image} alt="embed" className="mt-3 rounded-lg max-w-full max-h-48 object-cover"/>}
            <div className="mt-3 pt-2 border-t border-white/10 text-xs text-gray-400">🌸 {footer||"Nilou • Dancer of the Zubayr Theater"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Countdown ────────────────────────────────────────────────────────── */
function CountdownTab({cdMap,guilds,onRefresh}:{cdMap:Record<string,Countdown>;guilds:Guild[];onRefresh:()=>void}) {
  const [guildId,setGuildId]   = useState(guilds[0]?.id||"");
  const [channelId,setChannelId]=useState("");
  const [posting,setPosting]   = useState(false);
  const [result,setResult]     = useState<{ok:boolean;msg:string}|null>(null);
  const [,setTick]             = useState(0);
  useEffect(()=>{const i=setInterval(()=>setTick(t=>t+1),1000);return()=>clearInterval(i);},[]);

  const postCountdown=async()=>{
    if(!guildId||!channelId){setResult({ok:false,msg:"Select a server and enter a channel ID."});return;}
    setPosting(true);setResult(null);
    try{
      const r=await fetch(`${API}/post-countdown`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({guildId,channelId})});
      const d=await r.json();
      if(d.success){setResult({ok:true,msg:"Live countdown posted! 🌸"});onRefresh();}
      else setResult({ok:false,msg:d.error||"Failed."});
    }catch{setResult({ok:false,msg:"Network error."});}
    finally{setPosting(false);}
  };

  const entries=Object.entries(cdMap);
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-primary">⏳ Countdown Manager</h2>
      {entries.length===0?(
        <div className="rounded-xl border border-rose-900/40 bg-card p-8 text-center text-muted-foreground">
          <div className="text-4xl mb-3">⏳</div>
          <p>No countdowns set. Use <code className="text-primary">/countdown set</code> in Discord first.</p>
        </div>
      ):(
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entries.map(([gId,cd])=>{
            const guild=guilds.find(g=>g.id===gId);
            const started=cd.unixTs<=Math.floor(Date.now()/1000);
            return(
              <div key={gId} className="rounded-xl border border-rose-900/40 bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-foreground">🎊 {cd.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${started?"border-green-800/50 bg-green-950/30 text-green-400":"border-rose-800/50 bg-rose-950/30 text-rose-300"}`}>{started?"Started":"Active"}</span>
                </div>
                {cd.description&&<p className="text-sm text-muted-foreground mb-3">{cd.description}</p>}
                <div className="text-3xl font-bold text-primary font-mono mb-1">{countdown(cd.unixTs)}</div>
                <p className="text-xs text-muted-foreground">Server: {guild?.name||gId}</p>
                {cd.pinned&&<p className="text-xs text-green-400 mt-1">📌 Live in channel {cd.pinned.channelId}</p>}
              </div>
            );
          })}
        </div>
      )}
      <div className="rounded-xl border border-rose-900/40 bg-card p-5">
        <h3 className="font-semibold text-primary mb-1">📌 Post Live Countdown Embed</h3>
        <p className="text-xs text-muted-foreground mb-4">Post a countdown embed to a channel. It auto-updates every 5 minutes.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Server</label>
            <select value={guildId} onChange={e=>setGuildId(e.target.value)} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              {guilds.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
          <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Channel ID</label>
            <input value={channelId} onChange={e=>setChannelId(e.target.value)} placeholder="123456789..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"/></div>
          <div className="flex items-end">
            <button onClick={postCountdown} disabled={posting} className="w-full py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/80 disabled:opacity-50 transition-colors">{posting?"Posting...":"📌 Post Countdown"}</button>
          </div>
        </div>
        {result&&<div className={`mt-3 rounded-lg border px-4 py-2 text-sm ${result.ok?"border-green-800/50 bg-green-950/30 text-green-400":"border-red-800/50 bg-red-950/30 text-red-400"}`}>{result.msg}</div>}
      </div>
    </div>
  );
}

/* ─── Giveaways ────────────────────────────────────────────────────────── */
function GiveawaysTab({giveaways,guilds}:{giveaways:Giveaway[];guilds:Guild[]}) {
  const active=giveaways.filter(g=>!g.ended), ended=giveaways.filter(g=>g.ended);
  const guildName=(id:string)=>guilds.find(g=>g.id===id)?.name||id;
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-primary">🎊 Giveaways</h2>
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Active ({active.length})</h3>
        {active.length===0?<div className="rounded-xl border border-rose-900/40 bg-card p-6 text-center text-muted-foreground text-sm">No active giveaways.</div>:(
          <div className="space-y-3">{active.map(g=>(
            <div key={g.messageId} className="rounded-xl border border-rose-900/40 bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-semibold text-foreground">🎁 {g.prize}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Server: {guildName(g.guildId)} · {g.winnerCount} winner{g.winnerCount>1?"s":""}</p></div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800/40 shrink-0">Active</span>
              </div>
              <p className="text-sm text-primary font-mono mt-2">{countdown(Math.floor(g.endTime/1000))} remaining</p>
            </div>
          ))}</div>
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Ended ({ended.length})</h3>
        {ended.length===0?<div className="rounded-xl border border-rose-900/40 bg-card p-6 text-center text-muted-foreground text-sm">No ended giveaways.</div>:(
          <div className="space-y-3">{ended.map(g=>(
            <div key={g.messageId} className="rounded-xl border border-rose-900/40 bg-card p-4 opacity-70">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-semibold text-foreground">🎁 {g.prize}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Server: {guildName(g.guildId)}</p>
                  {g.winners?.length>0&&<p className="text-xs text-rose-300 mt-0.5">Winners: {g.winners.map(id=>`<@${id}>`).join(", ")}</p>}</div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-900/40 text-gray-400 border border-gray-800/40 shrink-0">Ended</span>
              </div>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}

/* ─── Triggers ─────────────────────────────────────────────────────────── */
function TriggersTab({triggerMap,guilds,onRefresh}:{triggerMap:Record<string,Trigger[]>;guilds:Guild[];onRefresh:()=>void}) {
  const [guildId,setGuildId]   = useState(guilds[0]?.id||"");
  const [phrase,setPhrase]     = useState("");
  const [response,setResponse] = useState("");
  const [exact,setExact]       = useState(false);
  const [saving,setSaving]     = useState(false);
  const [result,setResult]     = useState<{ok:boolean;msg:string}|null>(null);
  const selectedTriggers=triggerMap[guildId]||[];

  const addTrigger=async()=>{
    if(!guildId||!phrase||!response){setResult({ok:false,msg:"All fields required."});return;}
    setSaving(true);setResult(null);
    try{
      const r=await fetch(`${API}/trigger/add`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({guildId,phrase,response,exact})});
      const d=await r.json();
      if(d.success){setResult({ok:true,msg:"Trigger added! 🌸"});setPhrase("");setResponse("");onRefresh();}
      else setResult({ok:false,msg:d.error||"Failed."});
    }catch{setResult({ok:false,msg:"Network error."});}
    finally{setSaving(false);}
  };

  const removeTrigger=async(p:string)=>{
    await fetch(`${API}/trigger/remove`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({guildId,phrase:p})});
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-primary">💬 Auto-Response Triggers</h2>
      <div className="rounded-xl border border-rose-900/40 bg-card p-5">
        <h3 className="font-semibold text-primary mb-4">Add Trigger</h3>
        <div className="space-y-3">
          <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Server</label>
            <select value={guildId} onChange={e=>setGuildId(e.target.value)} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              {guilds.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Trigger Phrase</label>
              <input value={phrase} onChange={e=>setPhrase(e.target.value)} placeholder="e.g. good morning" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"/></div>
            <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Match Type</label>
              <select value={exact?"exact":"contains"} onChange={e=>setExact(e.target.value==="exact")} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="contains">Contains</option>
                <option value="exact">Exact match</option></select></div>
          </div>
          <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Response (use {"\\n"} for new line)</label>
            <textarea rows={2} value={response} onChange={e=>setResponse(e.target.value)} placeholder="Nilou will reply with this..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"/></div>
        </div>
        {result&&<div className={`mt-3 rounded-lg border px-4 py-2 text-sm ${result.ok?"border-green-800/50 bg-green-950/30 text-green-400":"border-red-800/50 bg-red-950/30 text-red-400"}`}>{result.msg}</div>}
        <button onClick={addTrigger} disabled={saving} className="mt-3 w-full py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/80 disabled:opacity-50 transition-colors">{saving?"Saving...":"🌸 Add Trigger"}</button>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Triggers — {guilds.find(g=>g.id===guildId)?.name||guildId}</h3>
        {selectedTriggers.length===0?<div className="rounded-xl border border-rose-900/40 bg-card p-6 text-center text-muted-foreground text-sm">No triggers for this server.</div>:(
          <div className="space-y-2">{selectedTriggers.map((t,i)=>(
            <div key={i} className="rounded-xl border border-rose-900/40 bg-card p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs bg-rose-950/60 border border-rose-900/40 text-primary px-2 py-0.5 rounded">{t.phrase}</code>
                  <span className="text-xs text-muted-foreground">{t.exact?"exact":"contains"}</span>
                </div>
                <p className="text-sm text-foreground mt-1 truncate">{t.response}</p>
              </div>
              <button onClick={()=>removeTrigger(t.phrase)} className="shrink-0 text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-900/40 hover:bg-red-950/30 transition-colors">Remove</button>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}

/* ─── Sticky ───────────────────────────────────────────────────────────── */
function StickyTab({stickies,guilds}:{stickies:Sticky[];guilds:Guild[]}) {
  const guildName=(id:string)=>guilds.find(g=>g.id===id)?.name||id;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">📌 Sticky Messages ({stickies.length})</h2>
      <p className="text-sm text-muted-foreground">Stickies are managed in Discord via <code className="text-primary">/sticky set</code> and <code className="text-primary">/sticky remove</code>. They persist across bot restarts.</p>
      {stickies.length===0?(
        <div className="rounded-xl border border-rose-900/40 bg-card p-8 text-center text-muted-foreground">
          <div className="text-4xl mb-3">📌</div>
          <p>No sticky messages active. Use <code className="text-primary">/sticky set</code> in Discord to create one.</p>
        </div>
      ):(
        <div className="space-y-3">{stickies.map(s=>(
          <div key={`${s.guildId}:${s.channelId}`} className="rounded-xl border border-rose-900/40 bg-card p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <span className="font-semibold text-foreground">{s.title||"Pinned"}</span>
                <span className="ml-2 text-xs text-muted-foreground">#{s.channelId}</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-900/40 text-rose-300 border border-rose-800/40 shrink-0">{guildName(s.guildId)}</span>
            </div>
            <div className="rounded-lg border-l-4 p-3 bg-black/20 text-sm text-muted-foreground whitespace-pre-wrap" style={{borderColor:`#${s.color?.toString(16).padStart(6,"0")||"E84057"}`}}>
              {s.content?.slice(0,300)}{s.content?.length>300?"...":""}
            </div>
          </div>
        ))}</div>
      )}
    </div>
  );
}

/* ─── Logging ──────────────────────────────────────────────────────────── */
function LoggingTab({guilds,loggingMap,onRefresh}:{guilds:Guild[];loggingMap:Record<string,LoggingCfg>;onRefresh:()=>void}) {
  const [guildId,setGuildId]     = useState(guilds[0]?.id||"");
  const [channelId,setChannelId] = useState("");
  const [saving,setSaving]       = useState(false);
  const [result,setResult]       = useState<{ok:boolean;msg:string}|null>(null);

  const current=loggingMap[guildId]||{enabled:false,channelId:null,events:ALL_LOG_EVENTS};

  const save=async(overrides:Partial<{enabled:boolean;channelId:string;events:string[]}>)=>{
    setSaving(true);setResult(null);
    try{
      const r=await fetch(`${API}/logging/update`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({guildId,...overrides})});
      const d=await r.json();
      if(d.success){setResult({ok:true,msg:"Saved! 🌸"});onRefresh();}
      else setResult({ok:false,msg:d.error||"Failed."});
    }catch{setResult({ok:false,msg:"Network error."});}
    finally{setSaving(false);}
  };

  const toggleEvent=async(event:string)=>{
    const events=current.events||[...ALL_LOG_EVENTS];
    const idx=events.indexOf(event);
    const next=idx===-1?[...events,event]:events.filter(e=>e!==event);
    await save({events:next});
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-primary">📋 Logging Configuration</h2>
      <p className="text-sm text-muted-foreground">Configure which events Nilou logs and where. You can also use <code className="text-primary">/logging setup</code> in Discord.</p>

      <div className="rounded-xl border border-rose-900/40 bg-card p-5 space-y-4">
        <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Server</label>
          <select value={guildId} onChange={e=>setGuildId(e.target.value)} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            {guilds.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">Logging {current.enabled?"Enabled":"Disabled"}</p>
            <p className="text-xs text-muted-foreground">Current log channel: {current.channelId?`#${current.channelId}`:"Not set"}</p>
          </div>
          <button onClick={()=>save({enabled:!current.enabled})} disabled={saving}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${current.enabled?"bg-red-900/40 text-red-300 border border-red-800/40 hover:bg-red-900/60":"bg-green-900/40 text-green-300 border border-green-800/40 hover:bg-green-900/60"}`}>
            {current.enabled?"Disable":"Enable"}</button>
        </div>

        <div className="flex gap-3">
          <input value={channelId} onChange={e=>setChannelId(e.target.value)} placeholder="Log channel ID..." className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"/>
          <button onClick={()=>save({channelId,enabled:true})} disabled={saving||!channelId} className="px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/80 disabled:opacity-50 transition-colors">Set Channel</button>
        </div>

        {result&&<div className={`rounded-lg border px-4 py-2 text-sm ${result.ok?"border-green-800/50 bg-green-950/30 text-green-400":"border-red-800/50 bg-red-950/30 text-red-400"}`}>{result.msg}</div>}
      </div>

      <div className="rounded-xl border border-rose-900/40 bg-card p-5">
        <h3 className="font-semibold text-primary mb-4">Event Toggles</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {ALL_LOG_EVENTS.map(event=>{
            const active=(current.events||ALL_LOG_EVENTS).includes(event);
            return(
              <button key={event} onClick={()=>toggleEvent(event)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-colors ${active?"border-rose-800/50 bg-rose-950/30 text-rose-300":"border-border bg-card text-muted-foreground hover:border-rose-800/30"}`}>
                <span className={`w-2 h-2 rounded-full ${active?"bg-rose-400":"bg-gray-600"}`}/>
                {event}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Warns ────────────────────────────────────────────────────────────── */
function WarnsTab({guilds}:{guilds:Guild[]}) {
  const [guildId,setGuildId] = useState(guilds[0]?.id||"");
  const [warns,setWarns]     = useState<Warning[]>([]);
  const [loading,setLoading] = useState(false);

  const fetchWarns=async(gId:string)=>{
    if(!gId) return;
    setLoading(true);
    try{
      const r=await fetch(`${API}/warns/${gId}`);
      const d=await r.json();
      setWarns(Array.isArray(d)?d:[]);
    }catch{ setWarns([]); }
    finally{ setLoading(false); }
  };

  useEffect(()=>{fetchWarns(guildId);},[guildId]);

  const grouped=warns.reduce<Record<string,Warning[]>>((acc,w)=>{
    if(!acc[w.user_id]) acc[w.user_id]=[];
    acc[w.user_id].push(w);
    return acc;
  },{});

  const sorted=Object.entries(grouped).sort(([,a],[,b])=>{
    const apts=a.reduce((s,w)=>s+w.points,0);
    const bpts=b.reduce((s,w)=>s+w.points,0);
    return bpts-apts;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-primary">⚠️ Warning System</h2>
      <p className="text-sm text-muted-foreground">Thresholds: 3pts = 10min mute · 5pts = kick · 10pts = ban. Use <code className="text-primary">/warn add</code> in Discord.</p>
      <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Server</label>
        <select value={guildId} onChange={e=>{setGuildId(e.target.value);fetchWarns(e.target.value);}} className="w-full md:w-64 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
          {guilds.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div>

      {loading?<div className="text-center py-8 text-muted-foreground animate-pulse">Loading warns...</div>:
        sorted.length===0?(
          <div className="rounded-xl border border-rose-900/40 bg-card p-8 text-center text-muted-foreground">
            <div className="text-4xl mb-3">🌸</div>
            <p>No active warnings for this server.</p>
          </div>
        ):(
          <div className="space-y-3">
            {sorted.map(([userId,userWarns])=>{
              const total=userWarns.reduce((s,w)=>s+w.points,0);
              const danger=total>=10?"border-red-800/50 bg-red-950/10":total>=5?"border-orange-800/50 bg-orange-950/10":total>=3?"border-yellow-800/50 bg-yellow-950/10":"border-rose-900/40 bg-card";
              return(
                <div key={userId} className={`rounded-xl border p-4 ${danger}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <span className="font-mono text-sm text-foreground">{`<@${userId}>`}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{userWarns.length} warning{userWarns.length!==1?"s":""}</span>
                    </div>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full border ${total>=10?"bg-red-950/50 text-red-300 border-red-800/50":total>=5?"bg-orange-950/50 text-orange-300 border-orange-800/50":total>=3?"bg-yellow-950/50 text-yellow-300 border-yellow-800/50":"bg-rose-950/50 text-rose-300 border-rose-800/50"}`}>
                      {total} pts
                    </span>
                  </div>
                  <div className="space-y-1">
                    {userWarns.slice(0,5).map(w=>(
                      <div key={w.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="text-primary font-mono">#{w.id}</span>
                        <span>{w.reason}</span>
                        <span className="ml-auto shrink-0">{new Date(w.created_at).toLocaleDateString()}</span>
                        <span className="text-orange-300">+{w.points}pt</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
}

/* ─── Economy ──────────────────────────────────────────────────────────── */
function EconomyTab({guilds}:{guilds:Guild[]}) {
  const [guildId,setGuildId] = useState(guilds[0]?.id||"");
  const [rows,setRows]       = useState<EcoRow[]>([]);
  const [loading,setLoading] = useState(false);
  const [sortBy,setSortBy]   = useState<"coins"|"theater_credits"|"fame"|"exp">("coins");

  const fetchLeaderboard=async(gId:string,sort:string)=>{
    if(!gId) return;
    setLoading(true);
    try{
      const r=await fetch(`${API}/economy/leaderboard/${gId}`);
      const d=await r.json();
      setRows(Array.isArray(d)?d:[]);
    }catch{ setRows([]); }
    finally{ setLoading(false); }
  };

  useEffect(()=>{fetchLeaderboard(guildId,sortBy);},[guildId]);

  const sorted=[...rows].sort((a,b)=>Number(b[sortBy])-Number(a[sortBy]));
  const medals=["🥇","🥈","🥉"];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-primary">💠 Zubayr Theater Economy</h2>
      <p className="text-sm text-muted-foreground">Players earn coins and Theater Credits through <code className="text-primary">/economy perform</code>, <code className="text-primary">/gamble</code>, and <code className="text-primary">/emojihunt</code>.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {[{label:"💠 Coins",info:"Earned via /perform and gambling"},{label:"🎟️ Theater Credits",info:"Via emoji hunt wins"},{label:"🎭 Fame",info:"Grows with performances"},{label:"⭐ EXP",info:"Levels up your rank"}].map(({label,info})=>(
          <div key={label} className="rounded-xl border border-rose-900/40 bg-card p-3">
            <p className="font-semibold text-foreground text-xs">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{info}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Server</label>
          <select value={guildId} onChange={e=>{setGuildId(e.target.value);fetchLeaderboard(e.target.value,sortBy);}} className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            {guilds.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
        <div><label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Sort by</label>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value as typeof sortBy)} className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="coins">💠 Coins</option>
            <option value="theater_credits">🎟️ Theater Credits</option>
            <option value="fame">🎭 Fame</option>
            <option value="exp">⭐ EXP</option>
          </select></div>
      </div>

      {loading?<div className="text-center py-8 text-muted-foreground animate-pulse">Loading leaderboard...</div>:
        sorted.length===0?(
          <div className="rounded-xl border border-rose-900/40 bg-card p-8 text-center text-muted-foreground">
            <div className="text-4xl mb-3">🎭</div>
            <p>No economy data yet. Use <code className="text-primary">/economy perform</code> to start!</p>
          </div>
        ):(
          <div className="rounded-xl border border-rose-900/40 bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-accent/20">
              <h3 className="text-sm font-semibold text-primary">🏆 Top Performers</h3>
            </div>
            <div className="divide-y divide-border">
              {sorted.map((row,i)=>(
                <div key={row.user_id} className="px-4 py-3 flex items-center gap-3">
                  <span className="text-lg w-8 text-center">{medals[i]||`${i+1}.`}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-foreground truncate">{row.user_id}</p>
                    <p className="text-xs text-muted-foreground">{row.rank} · Lv.{row.level}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{Number(row[sortBy]).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{sortBy==="coins"?"💠":sortBy==="theater_credits"?"🎟️":sortBy==="fame"?"🎭":"⭐"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      }
    </div>
  );
}

/* ─── Guilds ───────────────────────────────────────────────────────────── */
function GuildsTab({guilds}:{guilds:Guild[]}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">🏰 Servers ({guilds.length})</h2>
      {guilds.length===0?<p className="text-muted-foreground text-sm">Not in any servers yet.</p>:(
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{guilds.map(g=>(
          <div key={g.id} className="rounded-xl border border-rose-900/40 bg-card p-4 flex items-center gap-3">
            {g.icon?<img src={g.icon} alt={g.name} className="w-12 h-12 rounded-full border border-border"/>:<div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xl shrink-0">🏰</div>}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{g.name}</p>
              <p className="text-xs text-muted-foreground">{g.memberCount.toLocaleString()} members</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{g.id}</p>
            </div>
          </div>
        ))}</div>
      )}
    </div>
  );
}

/* ─── Tickets ──────────────────────────────────────────────────────────── */
function TicketsTab({openTickets}:{openTickets:Ticket[]}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">🎟️ Open Tickets ({openTickets.length})</h2>
      {openTickets.length===0?(
        <div className="rounded-xl border border-rose-900/40 bg-card p-8 text-center text-muted-foreground"><div className="text-4xl mb-3">🎟️</div><p>No open tickets.</p></div>
      ):(
        <div className="space-y-3">{openTickets.map(t=>(
          <div key={t.id} className="rounded-xl border border-rose-900/40 bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">{t.type} Ticket</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800/40">Open</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 truncate">{t.reason}</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">User: {t.userId} · {timeAgo(t.openedAt)}</p>
              </div>
            </div>
          </div>
        ))}</div>
      )}
    </div>
  );
}

/* ─── AFK ──────────────────────────────────────────────────────────────── */
function AfkTab({afk}:{afk:AfkUser[]}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">💤 AFK Users ({afk.length})</h2>
      {afk.length===0?(
        <div className="rounded-xl border border-rose-900/40 bg-card p-8 text-center text-muted-foreground"><div className="text-4xl mb-3">😴</div><p>No one is AFK right now.</p></div>
      ):(
        <div className="space-y-3">{afk.map(u=>(
          <div key={u.key} className="rounded-xl border border-rose-900/40 bg-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-fuchsia-900/30 border border-fuchsia-800/40 flex items-center justify-center text-lg shrink-0">💤</div>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-sm text-foreground">{u.userId}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Reason: {u.reason}</p>
              <p className="text-xs text-muted-foreground">AFK since {timeAgo(u.since)}</p>
            </div>
          </div>
        ))}</div>
      )}
    </div>
  );
}

/* ─── Commands ─────────────────────────────────────────────────────────── */
function CommandsTab() {
  const cats=["General","Utility","AFK","Tickets","Giveaway","Triggers","Moderation","Economy","Genshin"] as const;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">📜 All Commands ({COMMANDS.length})</h2>
      {cats.map(cat=>{
        const cmds=COMMANDS.filter(c=>c.cat===cat);
        if(!cmds.length) return null;
        return(
          <div key={cat} className="rounded-xl border border-rose-900/40 bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-accent/20"><h3 className="text-sm font-semibold text-primary">{cat}</h3></div>
            <div className="divide-y divide-border">{cmds.map(c=>(
              <div key={c.name} className="px-4 py-3 flex items-center gap-3">
                <code className="text-xs bg-rose-950/60 border border-rose-900/40 text-primary px-2 py-1 rounded font-mono shrink-0">{c.name}</code>
                <span className="text-sm text-muted-foreground">{c.desc}</span>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full shrink-0 border ${CAT_COLOR[c.cat]}`}>{c.cat}</span>
              </div>
            ))}</div>
          </div>
        );
      })}
    </div>
  );
}
