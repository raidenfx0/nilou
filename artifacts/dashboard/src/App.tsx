import { useEffect, useState, useCallback, useRef } from "react";

const BASE = import.meta.env.BASE_URL;
const API  = `${BASE}bot-api`;

/* ─── Types ─────────────────────────────────────────────── */
interface BotStats  { tag:string; status:string; uptime:string; uptimeMs:number; guildCount:number; ping:number; }
interface AfkUser   { key:string; userId:string; guildId:string; reason:string; since:number; }
interface Ticket    { id:string; channelId:string; guildId:string; userId:string; type:string; reason:string; open:boolean; openedAt:number; members:string[]; }
interface Guild     { id:string; name:string; memberCount:number; icon:string|null; }
interface Giveaway  { messageId:string; prize:string; winnerCount:number; endTime:number; hostId:string; guildId:string; channelId:string; ended:boolean; winners:string[]; }
interface Trigger   { phrase:string; response:string; exact:boolean; }
interface Countdown { name:string; unixTs:number; description:string|null; pinned:{channelId:string;messageId:string}|null; }

type TabKey = "overview"|"guilds"|"embed"|"countdown"|"giveaways"|"triggers"|"tickets"|"afk"|"commands";

/* ─── Helpers ────────────────────────────────────────────── */
function timeAgo(ms:number) {
  const d = Date.now()-ms, m=Math.floor(d/60000);
  if (m<1) return "just now"; if (m===1) return "1 min ago";
  if (m<60) return `${m} mins ago`;
  const h=Math.floor(m/60); return h===1?"1 hour ago":`${h} hours ago`;
}
function countdown(unixTs:number) {
  const diff = unixTs - Math.floor(Date.now()/1000);
  if (diff<=0) return "Started!";
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
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}
function Badge({children,color="rose"}:{children:React.ReactNode;color?:string}) {
  return <span className={`text-xs px-2 py-0.5 rounded-full bg-${color}-900/40 text-${color}-300 border border-${color}-800/40`}>{children}</span>;
}

const COMMANDS = [
  {name:"/help",desc:"View all available commands",cat:"General"},
  {name:"/ping",desc:"Check bot latency",cat:"General"},
  {name:"/botinfo",desc:"About Nilou bot",cat:"General"},
  {name:"/serverinfo",desc:"Server statistics",cat:"General"},
  {name:"/nilou",desc:"Random Nilou image",cat:"General"},
  {name:"/timestamp",desc:"Generate a dynamic Discord timestamp",cat:"Utility"},
  {name:"/embed",desc:"Send a styled embed (use \\n for new lines)",cat:"Utility"},
  {name:"/countdown set/show/pin/unpin",desc:"Manage festival countdowns",cat:"Utility"},
  {name:"/afk set",desc:"Mark yourself as AFK",cat:"AFK"},
  {name:"/afk clear",desc:"Remove your AFK status",cat:"AFK"},
  {name:"/ticket open/close/add/remove",desc:"Support ticket system",cat:"Tickets"},
  {name:"/ticket setup",desc:"Configure ticket categories (admin)",cat:"Tickets"},
  {name:"/giveaway start",desc:"Start a giveaway (admin)",cat:"Giveaway"},
  {name:"/giveaway end/reroll/list",desc:"Manage giveaways (admin)",cat:"Giveaway"},
  {name:"/trigger add/remove/list",desc:"Configure auto-response triggers (admin)",cat:"Triggers"},
  {name:"/sticky",desc:"Pin a sticky message (admin)",cat:"Moderation"},
  {name:"/purge",desc:"Bulk delete messages (admin)",cat:"Moderation"},
  {name:"/welcome",desc:"Configure welcome messages (admin)",cat:"Moderation"},
  {name:"/ghostping",desc:"Enable ghost ping detection (admin)",cat:"Moderation"},
  {name:"/reactionrole",desc:"Set up reaction roles (admin)",cat:"Moderation"},
  {name:"/adminrole",desc:"Set the bot admin role (admin)",cat:"Moderation"},
];
const CAT_COLOR:Record<string,string>={
  General:"bg-rose-900/40 text-rose-300 border-rose-800/50",
  Utility:"bg-pink-900/40 text-pink-300 border-pink-800/50",
  AFK:"bg-fuchsia-900/40 text-fuchsia-300 border-fuchsia-800/50",
  Tickets:"bg-red-900/40 text-red-300 border-red-800/50",
  Giveaway:"bg-yellow-900/40 text-yellow-300 border-yellow-800/50",
  Triggers:"bg-violet-900/40 text-violet-300 border-violet-800/50",
  Moderation:"bg-orange-900/40 text-orange-300 border-orange-800/50",
};

/* ─── Main App ───────────────────────────────────────────── */
export default function App() {
  const [tab,setTab]               = useState<TabKey>("overview");
  const [stats,setStats]           = useState<BotStats|null>(null);
  const [afk,setAfk]               = useState<AfkUser[]>([]);
  const [openTickets,setOpenTickets] = useState<Ticket[]>([]);
  const [guilds,setGuilds]         = useState<Guild[]>([]);
  const [giveaways,setGiveaways]   = useState<Giveaway[]>([]);
  const [triggerMap,setTriggerMap] = useState<Record<string,Trigger[]>>({});
  const [cdMap,setCdMap]           = useState<Record<string,Countdown>>({});
  const [loading,setLoading]       = useState(true);
  const [error,setError]           = useState<string|null>(null);
  const [lastRefresh,setLastRefresh] = useState<Date|null>(null);

  const fetchAll = useCallback(async()=>{
    try {
      const [s,a,t,g,gw,tr,cd]=await Promise.all([
        fetch(`${API}/stats`).then(r=>r.json()),
        fetch(`${API}/afk`).then(r=>r.json()),
        fetch(`${API}/tickets`).then(r=>r.json()),
        fetch(`${API}/guilds`).then(r=>r.json()),
        fetch(`${API}/giveaways`).then(r=>r.json()),
        fetch(`${API}/triggers`).then(r=>r.json()),
        fetch(`${API}/countdowns`).then(r=>r.json()),
      ]);
      setStats(s); setAfk(a);
      setOpenTickets((t as Ticket[]).filter(x=>x.open));
      setGuilds(g); setGiveaways(gw);
      setTriggerMap(tr); setCdMap(cd);
      setError(null); setLastRefresh(new Date());
    } catch { setError("Could not reach the bot. Is it running?"); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ fetchAll(); const i=setInterval(fetchAll,8000); return ()=>clearInterval(i); },[fetchAll]);

  const TABS:{ key:TabKey; label:string; emoji:string }[]=[
    {key:"overview",label:"Overview",emoji:"🌸"},
    {key:"embed",label:"Embed Builder",emoji:"✍️"},
    {key:"countdown",label:"Countdown",emoji:"⏳"},
    {key:"giveaways",label:"Giveaways",emoji:"🎊"},
    {key:"triggers",label:"Triggers",emoji:"💬"},
    {key:"guilds",label:"Guilds",emoji:"🏰"},
    {key:"tickets",label:"Tickets",emoji:"🎟️"},
    {key:"afk",label:"AFK",emoji:"💤"},
    {key:"commands",label:"Commands",emoji:"📜"},
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
            {stats&&<><StatusDot online={stats.status==="online"}/><span>{stats.status==="online"?"Online":"Offline"}</span></>}
            {lastRefresh&&<span className="ml-2 opacity-60">{lastRefresh.toLocaleTimeString()}</span>}
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 flex gap-0.5 pb-0 overflow-x-auto">
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              className={`px-3 py-2 text-xs rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${tab===t.key?"border-primary text-primary font-semibold bg-primary/10":"border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/20"}`}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
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
            {tab==="overview"&&<OverviewTab stats={stats} afk={afk} openTickets={openTickets} guilds={guilds} giveaways={giveaways}/>}
            {tab==="embed"&&<EmbedBuilderTab guilds={guilds}/>}
            {tab==="countdown"&&<CountdownTab cdMap={cdMap} guilds={guilds} onRefresh={fetchAll}/>}
            {tab==="giveaways"&&<GiveawaysTab giveaways={giveaways} guilds={guilds}/>}
            {tab==="triggers"&&<TriggersTab triggerMap={triggerMap} guilds={guilds} onRefresh={fetchAll}/>}
            {tab==="guilds"&&<GuildsTab guilds={guilds}/>}
            {tab==="tickets"&&<TicketsTab openTickets={openTickets}/>}
            {tab==="afk"&&<AfkTab afk={afk}/>}
            {tab==="commands"&&<CommandsTab/>}
          </>
        )}
      </main>

      <footer className="border-t border-border mt-8 py-4 text-center text-xs text-muted-foreground">
        🌸 Nilou Bot Dashboard · Dancer of the Zubayr Theater · made by soda
      </footer>
    </div>
  );
}

/* ─── Overview ───────────────────────────────────────────── */
function OverviewTab({stats,afk,openTickets,guilds,giveaways}:{stats:BotStats;afk:AfkUser[];openTickets:Ticket[];guilds:Guild[];giveaways:Giveaway[]}) {
  const activeGiveaways = giveaways.filter(g=>!g.ended);
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
          {label:"💤 AFK Users",count:afk.length,items:afk.slice(0,3).map(u=>({key:u.key,main:u.userId,sub:timeAgo(u.since)}))},
          {label:"🎟️ Open Tickets",count:openTickets.length,items:openTickets.slice(0,3).map(t=>({key:t.id,main:t.type,sub:timeAgo(t.openedAt)}))},
          {label:"🎊 Active Giveaways",count:activeGiveaways.length,items:activeGiveaways.slice(0,3).map(g=>({key:g.messageId,main:g.prize,sub:`${g.winnerCount}W`}))},
          {label:"🏰 Servers",count:guilds.length,items:guilds.slice(0,3).map(g=>({key:g.id,main:g.name,sub:`${g.memberCount} members`}))},
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
        </div>
      </div>
    </div>
  );
}

/* ─── Embed Builder ──────────────────────────────────────── */
function EmbedBuilderTab({guilds}:{guilds:Guild[]}) {
  const [title,setTitle]       = useState("Festival Announcement");
  const [desc,setDesc]         = useState("Welcome to the Zubayr Theater!\\nTonight we dance~");
  const [color,setColor]       = useState("#E84057");
  const [footer,setFooter]     = useState("");
  const [image,setImage]       = useState("");
  const [thumbnail,setThumbnail]=useState("");
  const [channelId,setChannelId]=useState("");
  const [guildId,setGuildId]   = useState(guilds[0]?.id || "");
  const [sending,setSending]   = useState(false);
  const [result,setResult]     = useState<{ok:boolean;msg:string}|null>(null);

  const previewDesc = desc.replace(/\\n/g,"\n");

  const send = async()=>{
    if(!channelId||!title||!desc){setResult({ok:false,msg:"Title, description, and channel ID are required."});return;}
    setSending(true); setResult(null);
    try{
      const r=await fetch(`${API}/send-embed`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({guildId,channelId,title,description:desc,color,footer,image,thumbnail})});
      const d=await r.json();
      if(d.success) setResult({ok:true,msg:"Embed sent successfully! 🌸"});
      else setResult({ok:false,msg:d.error||"Failed to send."});
    }catch(e){setResult({ok:false,msg:"Network error."});}
    finally{setSending(false);}
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-primary">✍️ Embed Builder</h2>
        <p className="text-sm text-muted-foreground">Build and send a Nilou-styled embed to any channel. Use <code className="text-primary bg-rose-950/50 px-1 rounded">{"\\n"}</code> for new lines.</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Title *</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Embed title..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Description * (use {"\\n"} for new line)</label>
            <textarea rows={4} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Embed description..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={color} onChange={e=>setColor(e.target.value)} className="w-10 h-9 rounded border border-border bg-transparent cursor-pointer"/>
                <input value={color} onChange={e=>setColor(e.target.value)} className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"/>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Footer text</label>
              <input value={footer} onChange={e=>setFooter(e.target.value)} placeholder="Optional footer..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"/>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Image URL</label>
            <input value={image} onChange={e=>setImage(e.target.value)} placeholder="https://..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Thumbnail URL</label>
            <input value={thumbnail} onChange={e=>setThumbnail(e.target.value)} placeholder="https://..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Server</label>
              <select value={guildId} onChange={e=>setGuildId(e.target.value)} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                {guilds.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Channel ID *</label>
              <input value={channelId} onChange={e=>setChannelId(e.target.value)} placeholder="123456789..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"/>
            </div>
          </div>
        </div>

        {result&&<div className={`rounded-lg border px-4 py-3 text-sm ${result.ok?"border-green-800/50 bg-green-950/30 text-green-400":"border-red-800/50 bg-red-950/30 text-red-400"}`}>{result.msg}</div>}

        <button onClick={send} disabled={sending} className="w-full py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/80 disabled:opacity-50 transition-colors">
          {sending?"Sending...":"🌸 Send Embed to Discord"}
        </button>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Preview</h3>
        <div className="rounded-xl bg-[#1a0a0d] border border-rose-900/60 overflow-hidden">
          <div className="w-1 h-full absolute" style={{background:color}}/>
          <div style={{borderLeft:`4px solid ${color}`}} className="p-4">
            {title&&<p className="font-bold text-white text-sm mb-1">✦ {title}</p>}
            {previewDesc&&<p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{previewDesc}</p>}
            {image&&<img src={image} alt="embed" className="mt-3 rounded-lg max-w-full max-h-48 object-cover"/>}
            {thumbnail&&<img src={thumbnail} alt="thumb" className="absolute top-4 right-4 w-16 h-16 rounded-lg object-cover"/>}
            <div className="mt-3 pt-2 border-t border-white/10 text-xs text-gray-400 flex items-center gap-1">
              🌸 {footer||"Nilou • Dancer of the Zubayr Theater"}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">This preview is approximate. The actual embed in Discord may look slightly different.</p>
      </div>
    </div>
  );
}

/* ─── Countdown ──────────────────────────────────────────── */
function CountdownTab({cdMap,guilds,onRefresh}:{cdMap:Record<string,Countdown>;guilds:Guild[];onRefresh:()=>void}) {
  const [guildId,setGuildId] = useState(guilds[0]?.id||"");
  const [channelId,setChannelId] = useState("");
  const [posting,setPosting] = useState(false);
  const [result,setResult]   = useState<{ok:boolean;msg:string}|null>(null);
  const [tick,setTick]       = useState(0);

  useEffect(()=>{ const i=setInterval(()=>setTick(t=>t+1),1000); return ()=>clearInterval(i); },[]);

  const entries = Object.entries(cdMap);

  const postCountdown = async()=>{
    if(!guildId||!channelId){setResult({ok:false,msg:"Select a server and enter a channel ID."});return;}
    setPosting(true); setResult(null);
    try{
      const r=await fetch(`${API}/post-countdown`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({guildId,channelId})});
      const d=await r.json();
      if(d.success){setResult({ok:true,msg:"Live countdown posted! Auto-updates every 5 min 🌸"});onRefresh();}
      else setResult({ok:false,msg:d.error||"Failed."});
    }catch{setResult({ok:false,msg:"Network error."});}
    finally{setPosting(false);}
  };

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
            const guild = guilds.find(g=>g.id===gId);
            const timeLeft = countdown(cd.unixTs);
            const started  = cd.unixTs <= Math.floor(Date.now()/1000);
            return (
              <div key={gId} className="rounded-xl border border-rose-900/40 bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-foreground">🎊 {cd.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${started?"border-green-800/50 bg-green-950/30 text-green-400":"border-rose-800/50 bg-rose-950/30 text-rose-300"}`}>
                    {started?"Started":"Active"}
                  </span>
                </div>
                {cd.description&&<p className="text-sm text-muted-foreground mb-3">{cd.description}</p>}
                <div className="text-3xl font-bold text-primary font-mono mb-1">{timeLeft}</div>
                <p className="text-xs text-muted-foreground">Server: {guild?.name||gId}</p>
                {cd.pinned&&<p className="text-xs text-green-400 mt-1">📌 Live embed active in channel {cd.pinned.channelId}</p>}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-rose-900/40 bg-card p-5">
        <h3 className="font-semibold text-primary mb-1">📌 Post Live Countdown Embed</h3>
        <p className="text-xs text-muted-foreground mb-4">Post a countdown embed to a channel. It will auto-update every 5 minutes.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Server</label>
            <select value={guildId} onChange={e=>setGuildId(e.target.value)} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              {guilds.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Channel ID</label>
            <input value={channelId} onChange={e=>setChannelId(e.target.value)} placeholder="123456789..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"/>
          </div>
          <div className="flex items-end">
            <button onClick={postCountdown} disabled={posting} className="w-full py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/80 disabled:opacity-50 transition-colors">
              {posting?"Posting...":"📌 Post Countdown"}
            </button>
          </div>
        </div>
        {result&&<div className={`mt-3 rounded-lg border px-4 py-2 text-sm ${result.ok?"border-green-800/50 bg-green-950/30 text-green-400":"border-red-800/50 bg-red-950/30 text-red-400"}`}>{result.msg}</div>}
      </div>
    </div>
  );
}

/* ─── Giveaways ──────────────────────────────────────────── */
function GiveawaysTab({giveaways,guilds}:{giveaways:Giveaway[];guilds:Guild[]}) {
  const active = giveaways.filter(g=>!g.ended);
  const ended  = giveaways.filter(g=>g.ended);
  const guildName=(id:string)=>guilds.find(g=>g.id===id)?.name||id;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-primary">🎊 Giveaways</h2>
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Active ({active.length})</h3>
        {active.length===0?(
          <div className="rounded-xl border border-rose-900/40 bg-card p-6 text-center text-muted-foreground text-sm">No active giveaways. Start one with <code className="text-primary">/giveaway start</code>.</div>
        ):(
          <div className="space-y-3">{active.map(g=>(
            <div key={g.messageId} className="rounded-xl border border-rose-900/40 bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">🎁 {g.prize}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Server: {guildName(g.guildId)} · {g.winnerCount} winner{g.winnerCount>1?"s":""}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800/40 shrink-0">Active</span>
              </div>
              <p className="text-sm text-primary font-mono mt-2">{countdown(Math.floor(g.endTime/1000))} remaining</p>
            </div>
          ))}</div>
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Ended ({ended.length})</h3>
        {ended.length===0?(
          <div className="rounded-xl border border-rose-900/40 bg-card p-6 text-center text-muted-foreground text-sm">No ended giveaways.</div>
        ):(
          <div className="space-y-3">{ended.map(g=>(
            <div key={g.messageId} className="rounded-xl border border-rose-900/40 bg-card p-4 opacity-70">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">🎁 {g.prize}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Server: {guildName(g.guildId)}</p>
                  {g.winners?.length>0&&<p className="text-xs text-rose-300 mt-0.5">Winners: {g.winners.map(id=>`<@${id}>`).join(", ")}</p>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-900/40 text-gray-400 border border-gray-800/40 shrink-0">Ended</span>
              </div>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}

/* ─── Triggers ───────────────────────────────────────────── */
function TriggersTab({triggerMap,guilds,onRefresh}:{triggerMap:Record<string,Trigger[]>;guilds:Guild[];onRefresh:()=>void}) {
  const [guildId,setGuildId] = useState(guilds[0]?.id||"");
  const [phrase,setPhrase]   = useState("");
  const [response,setResponse]=useState("");
  const [exact,setExact]     = useState(false);
  const [saving,setSaving]   = useState(false);
  const [result,setResult]   = useState<{ok:boolean;msg:string}|null>(null);

  const allTriggers = Object.entries(triggerMap);
  const selectedTriggers = triggerMap[guildId]||[];

  const addTrigger = async()=>{
    if(!guildId||!phrase||!response){setResult({ok:false,msg:"Guild, phrase, and response are all required."});return;}
    setSaving(true); setResult(null);
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
      <p className="text-sm text-muted-foreground">When someone sends a message containing the trigger phrase, Nilou automatically replies with the configured response.</p>

      <div className="rounded-xl border border-rose-900/40 bg-card p-5">
        <h3 className="font-semibold text-primary mb-4">Add Trigger</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Server</label>
            <select value={guildId} onChange={e=>setGuildId(e.target.value)} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              {guilds.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Trigger Phrase</label>
              <input value={phrase} onChange={e=>setPhrase(e.target.value)} placeholder="e.g. good morning" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"/>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Match Type</label>
              <select value={exact?"exact":"contains"} onChange={e=>setExact(e.target.value==="exact")} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="contains">Contains (anywhere in message)</option>
                <option value="exact">Exact match only</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Response (use {"\\n"} for new line)</label>
            <textarea rows={2} value={response} onChange={e=>setResponse(e.target.value)} placeholder="Nilou will reply with this..." className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"/>
          </div>
        </div>
        {result&&<div className={`mt-3 rounded-lg border px-4 py-2 text-sm ${result.ok?"border-green-800/50 bg-green-950/30 text-green-400":"border-red-800/50 bg-red-950/30 text-red-400"}`}>{result.msg}</div>}
        <button onClick={addTrigger} disabled={saving} className="mt-3 w-full py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/80 disabled:opacity-50 transition-colors">
          {saving?"Saving...":"🌸 Add Trigger"}
        </button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Configured Triggers — {guilds.find(g=>g.id===guildId)?.name||guildId}</h3>
        {selectedTriggers.length===0?(
          <div className="rounded-xl border border-rose-900/40 bg-card p-6 text-center text-muted-foreground text-sm">No triggers for this server.</div>
        ):(
          <div className="space-y-2">{selectedTriggers.map((t,i)=>(
            <div key={i} className="rounded-xl border border-rose-900/40 bg-card p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs bg-rose-950/60 border border-rose-900/40 text-primary px-2 py-0.5 rounded">{t.phrase}</code>
                  <span className="text-xs text-muted-foreground">{t.exact?"exact match":"contains"}</span>
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

/* ─── Guilds ─────────────────────────────────────────────── */
function GuildsTab({guilds}:{guilds:Guild[]}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">🏰 Servers ({guilds.length})</h2>
      {guilds.length===0?<p className="text-muted-foreground text-sm">Bot is not in any servers yet.</p>:(
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

/* ─── Tickets ────────────────────────────────────────────── */
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
                <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-foreground">{t.type} Ticket</span><span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800/40">Open</span></div>
                <p className="text-sm text-muted-foreground mt-1 truncate">{t.reason}</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">User: {t.userId} · {timeAgo(t.openedAt)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{t.members.length} member{t.members.length!==1?"s":""} in ticket</p>
          </div>
        ))}</div>
      )}
    </div>
  );
}

/* ─── AFK ────────────────────────────────────────────────── */
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

/* ─── Commands ───────────────────────────────────────────── */
function CommandsTab() {
  const cats = ["General","Utility","AFK","Tickets","Giveaway","Triggers","Moderation"] as const;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-primary">📜 All Commands ({COMMANDS.length})</h2>
      {cats.map(cat=>{
        const cmds=COMMANDS.filter(c=>c.cat===cat);
        return (
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
