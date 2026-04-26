import { useState, useEffect, useCallback } from 'react';
import { sbGet, sbPost, sbPatch } from '../lib/supabase';
import styles from '../styles/Dashboard.module.css';

// ─── AI proxy call (server-side, no CORS) ───────────────────
async function callAI(system, prompt) {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, prompt, max_tokens: 1000 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'AI error');
  return data.text;
}

// ─── Helpers ────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
const moodStars = (n) => n ? '⭐'.repeat(n) : '—';
const projectName = (id, projects) => projects.find(p => p.id === id)?.name || '—';

const AI_PROMPTS = {
  digest: 'Phân tích toàn bộ NEXUS ecosystem hôm nay: tình trạng các project, blockers đáng lo, KPI đáng chú ý, và top 3 việc cần làm ngay.',
  risks:  'Liệt kê tất cả rủi ro đang hiện diện trong NEXUS ecosystem. Ưu tiên theo mức độ nguy hiểm. Mỗi risk kèm giải pháp cụ thể.',
  kpi:    'Phân tích số liệu KPI hiện tại. Trend nào tốt? Trend nào xấu? Revenue đang đi đâu? Cần tập trung vào metric nào?',
  next:   'Dựa vào logs và blockers gần nhất, đưa ra kế hoạch hành động cho 48h tới. Cụ thể, có thứ tự ưu tiên.',
  kdp:    'Phân tích progress của NEXUS KDP business. Book đầu tiên đang ở đâu? Next steps? Suggest niche hoặc title tiếp theo nếu phù hợp.',
};

// ─── Badge component ─────────────────────────────────────────
function Badge({ type, children }) {
  const colors = {
    active:'#63d3b2,rgba(99,211,178,0.12)', paused:'#f0c674,rgba(240,198,116,0.12)',
    archived:'#5a6478,rgba(90,100,120,0.2)', dev:'#61afef,rgba(97,175,239,0.12)',
    growth:'#63d3b2,rgba(99,211,178,0.08)', launch:'#e06c75,rgba(224,108,117,0.12)',
    live:'#63d3b2,rgba(99,211,178,0.15)', critical:'#e06c75,rgba(224,108,117,0.15)',
    warning:'#f0c674,rgba(240,198,116,0.12)', info:'#61afef,rgba(97,175,239,0.1)',
    success:'#63d3b2,rgba(99,211,178,0.1)', open:'#e06c75,rgba(224,108,117,0.1)',
    resolved:'#63d3b2,rgba(99,211,178,0.1)', dismissed:'#5a6478,rgba(90,100,120,0.2)',
    in_progress:'#f0c674,rgba(240,198,116,0.1)',
    dev2:'#61afef,rgba(97,175,239,0.12)', marketing:'#f0c674,rgba(240,198,116,0.1)',
    content:'#63d3b2,rgba(99,211,178,0.1)', ops:'#61afef,rgba(97,175,239,0.1)',
    research:'#e06c75,rgba(224,108,117,0.1)', finance:'#f0c674,rgba(240,198,116,0.12)',
    other:'#5a6478,rgba(90,100,120,0.2)',
    n8n:'#63d3b2,rgba(99,211,178,0.1)', claude:'#61afef,rgba(97,175,239,0.1)',
    manual:'#5a6478,rgba(90,100,120,0.2)', system:'#f0c674,rgba(240,198,116,0.1)',
    daily:'#61afef,rgba(97,175,239,0.1)', weekly:'#63d3b2,rgba(99,211,178,0.1)',
    monthly:'#f0c674,rgba(240,198,116,0.1)',
  };
  const key = type === 'dev' ? 'dev2' : type;
  const [color, bg] = (colors[key] || '##5a6478,rgba(90,100,120,0.2)').split(',');
  return (
    <span style={{
      display:'inline-block', fontSize:'10px', padding:'3px 9px', borderRadius:'3px',
      letterSpacing:'0.08em', textTransform:'uppercase',
      color, background: bg,
    }}>{children || type}</span>
  );
}

// ─── Modal ───────────────────────────────────────────────────
function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div onClick={e => e.target===e.currentTarget && onClose()} style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
      backdropFilter:'blur(4px)', zIndex:200,
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <div style={{
        background:'var(--bg2)', border:'1px solid var(--border-active)',
        borderRadius:'12px', padding:'28px', width:'560px', maxWidth:'95vw',
        maxHeight:'90vh', overflowY:'auto',
        animation:'slideUp 0.25s ease',
      }}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
          <span style={{fontFamily:'Syne,sans-serif',fontSize:'16px',fontWeight:800,color:'var(--text-bright)'}}>{title}</span>
          <button onClick={onClose} style={{
            width:28,height:28,borderRadius:4,background:'transparent',
            border:'1px solid var(--border)',color:'var(--text-dim)',cursor:'pointer',fontSize:14,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Form helpers ────────────────────────────────────────────
const FG = ({ label, children, span }) => (
  <div style={{display:'flex',flexDirection:'column',gap:6,gridColumn:span?'1 / -1':undefined}}>
    <label style={{fontSize:'10px',color:'var(--text-dim)',letterSpacing:'0.12em',textTransform:'uppercase'}}>{label}</label>
    {children}
  </div>
);
const inputStyle = {
  background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:4,
  padding:'10px 12px', color:'var(--text)', fontFamily:'JetBrains Mono,monospace',
  fontSize:12, outline:'none', width:'100%',
};
const Inp = (props) => <input style={inputStyle} {...props} />;
const Sel = ({ children, ...props }) => <select style={inputStyle} {...props}>{children}</select>;
const Tex = (props) => <textarea style={{...inputStyle, resize:'vertical', minHeight:72}} {...props} />;

// ─── Toast ───────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, type='info') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  const ToastContainer = () => (
    <div style={{position:'fixed',bottom:24,right:24,zIndex:999,display:'flex',flexDirection:'column',gap:8}}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background:'var(--bg2)', border:`1px solid ${t.type==='success'?'rgba(99,211,178,0.3)':t.type==='error'?'rgba(224,108,117,0.3)':'var(--border)'}`,
          borderRadius:6, padding:'12px 16px', fontSize:12, color:'var(--text)',
          display:'flex', alignItems:'center', gap:8, maxWidth:300,
        }}>
          <span>{t.type==='success'?'✓':t.type==='error'?'✕':'ℹ'}</span>{t.msg}
        </div>
      ))}
    </div>
  );
  return { toast, ToastContainer };
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function Home() {
  const [view, setView] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [logs, setLogs] = useState([]);
  const [kpiData, setKpiData] = useState([]);
  const [alertsData, setAlertsData] = useState([]);
  const [stats, setStats] = useState({ active:0, total:0, weekLogs:0, openAlerts:0, kpiCount:0 });
  const [clock, setClock] = useState('');
  const [sbOk, setSbOk] = useState(false);
  const [modal, setModal] = useState(null); // 'log'|'kpi'|'alert'|'project'
  const [aiOutput, setAiOutput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLabel, setAiLabel] = useState('Ready');
  const [digestOutput, setDigestOutput] = useState('Click "Generate" để T.Nexus phân tích NEXUS ecosystem...');
  const [digestLoading, setDigestLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [logFilter, setLogFilter] = useState({ project:'', cat:'' });
  const { toast, ToastContainer } = useToast();

  // Form state
  const [logForm, setLogForm] = useState({ project_id:'', log_date:'', category:'dev', summary:'', blockers:'', next_actions:'', hours_spent:'', mood:'3' });
  const [kpiForm, setKpiForm] = useState({ project_id:'', snapshot_date:'', period:'daily', page_views:'', unique_visitors:'', revenue_vnd:'', revenue_usd:'', free_users:'', paid_users:'', kdp_units_sold:'', kdp_royalties:'', notes:'' });
  const [alertForm, setAlertForm] = useState({ title:'', description:'', project_id:'', severity:'warning', source:'manual' });
  const [projForm, setProjForm] = useState({ name:'', slug:'', status:'active', phase:'', url:'', stack:'', notes:'' });

  // Clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('vi-VN'));
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, []);

  // Load all data
  const loadAll = useCallback(async () => {
    try {
      const [projs, recentLogs, openAlerts] = await Promise.all([
        sbGet('projects', '?order=name.asc'),
        sbGet('daily_logs', '?order=log_date.desc&limit=5'),
        sbGet('alerts', '?status=eq.open&order=created_at.desc'),
      ]);
      setProjects(projs || []);
      setLogs(recentLogs || []);
      setAlertsData(openAlerts || []);

      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
      const [weekLogs, kpiCount] = await Promise.all([
        sbGet('daily_logs', `?log_date=gte.${weekAgo.toISOString().slice(0,10)}&select=id`),
        sbGet('kpi_snapshots', '?select=id'),
      ]);
      setStats({
        active: (projs||[]).filter(p=>p.status==='active').length,
        total: (projs||[]).length,
        weekLogs: (weekLogs||[]).length,
        openAlerts: (openAlerts||[]).length,
        kpiCount: (kpiCount||[]).length,
      });
      setSbOk(true);
    } catch(e) {
      setSbOk(false);
      toast('Supabase error: '+e.message, 'error');
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      let q = '?order=log_date.desc&limit=50';
      if (logFilter.project) q += `&project_id=eq.${logFilter.project}`;
      if (logFilter.cat) q += `&category=eq.${logFilter.cat}`;
      const data = await sbGet('daily_logs', q);
      setLogs(data || []);
    } catch(e) { toast('Error: '+e.message,'error'); }
  }, [logFilter]);

  const loadKPI = useCallback(async () => {
    try {
      const data = await sbGet('kpi_snapshots', '?order=snapshot_date.desc&limit=50');
      setKpiData(data || []);
    } catch(e) { toast('Error: '+e.message,'error'); }
  }, []);

  const loadAlertsFull = useCallback(async () => {
    try {
      const data = await sbGet('alerts', '?order=created_at.desc&limit=50');
      setAlertsData(data || []);
    } catch(e) { toast('Error: '+e.message,'error'); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { if (view==='logs') loadLogs(); }, [view, logFilter]);
  useEffect(() => { if (view==='kpi') loadKPI(); }, [view]);
  useEffect(() => { if (view==='alerts') loadAlertsFull(); }, [view]);
  useEffect(() => { if (view==='projects') loadAll(); }, [view]);

  // Build AI context
  const buildContext = async () => {
    const projs = projects.length ? projects : await sbGet('projects','?order=name.asc') || [];
    const recentLogs = await sbGet('daily_logs','?order=log_date.desc&limit=10') || [];
    const openAlerts = await sbGet('alerts','?status=eq.open') || [];
    const recentKpi = await sbGet('kpi_snapshots','?order=snapshot_date.desc&limit=10') || [];

    return `Bạn là T.Nexus — AI partner kỹ thuật của NEXUS AI Product Studio, do Thanh Kevin điều hành.
Ngày hôm nay: ${new Date().toLocaleDateString('vi-VN')}
Founder: Thanh Kevin (solopreneur, ex-geological engineer, 2 tháng vào tech)

## Projects (${projs.length}):
${projs.map(p=>`- ${p.name} [${p.status}/${p.phase||'?'}] ${p.url||''}`).join('\n')}

## Recent Logs:
${recentLogs.map(l=>`- [${l.log_date}] ${projectName(l.project_id,projs)} | ${l.category} | ${l.summary}${l.blockers?' | BLOCKER: '+l.blockers:''}`).join('\n')||'No logs yet'}

## Open Alerts (${openAlerts.length}):
${openAlerts.map(a=>`- [${a.severity.toUpperCase()}] ${a.title}`).join('\n')||'No open alerts'}

## Recent KPI:
${recentKpi.map(k=>`- [${k.snapshot_date}] ${projectName(k.project_id,projs)}: VND=${k.revenue_vnd||0}, USD=${k.revenue_usd||0}, paid=${k.paid_users||0}, kdp_units=${k.kdp_units_sold||0}`).join('\n')||'No KPI data yet'}

Phân tích ngắn gọn, thực tế, focus vào action. Trả lời bằng tiếng Việt.`;
  };

  const runAI = async (type) => {
    const labels = { digest:'Daily Digest', risks:'Risk Analysis', kpi:'KPI Insights', next:'Next Actions', kdp:'KDP Strategy', custom:'Custom' };
    setAiLabel(labels[type]||type); setAiLoading(true); setAiOutput('');
    const prompt = type==='custom' ? customPrompt : AI_PROMPTS[type];
    if (!prompt) { setAiLoading(false); toast('Nhập prompt trước','error'); return; }
    try {
      const ctx = await buildContext();
      const text = await callAI(ctx, prompt);
      setAiOutput(text);
    } catch(e) { setAiOutput('Error: '+e.message); toast('AI error','error'); }
    setAiLoading(false);
  };

  const generateDigest = async () => {
    setDigestLoading(true); setDigestOutput('');
    try {
      const ctx = await buildContext();
      const text = await callAI(ctx, AI_PROMPTS.digest);
      setDigestOutput(text);
    } catch(e) { setDigestOutput('Error: '+e.message); }
    setDigestLoading(false);
  };

  // Submit handlers
  const submitLog = async () => {
    const b = { ...logForm,
      hours_spent: parseFloat(logForm.hours_spent)||null,
      mood: parseInt(logForm.mood),
      blockers: logForm.blockers||null,
      next_actions: logForm.next_actions||null,
    };
    if (!b.project_id||!b.log_date||!b.summary) { toast('Điền đủ Project, Date, Summary','error'); return; }
    try { await sbPost('daily_logs',b); toast('Log saved ✓','success'); setModal(null); loadAll(); }
    catch(e) { toast('Error: '+e.message,'error'); }
  };

  const submitKPI = async () => {
    const b = { ...kpiForm,
      page_views: parseInt(kpiForm.page_views)||null,
      unique_visitors: parseInt(kpiForm.unique_visitors)||null,
      revenue_vnd: parseInt(kpiForm.revenue_vnd)||null,
      revenue_usd: parseFloat(kpiForm.revenue_usd)||null,
      free_users: parseInt(kpiForm.free_users)||null,
      paid_users: parseInt(kpiForm.paid_users)||null,
      kdp_units_sold: parseInt(kpiForm.kdp_units_sold)||null,
      kdp_royalties: parseFloat(kpiForm.kdp_royalties)||null,
      notes: kpiForm.notes||null,
    };
    if (!b.project_id||!b.snapshot_date) { toast('Điền Project và Date','error'); return; }
    try { await sbPost('kpi_snapshots',b); toast('KPI saved ✓','success'); setModal(null); loadAll(); }
    catch(e) { toast('Error: '+e.message,'error'); }
  };

  const submitAlert = async () => {
    const b = { ...alertForm, project_id: alertForm.project_id||null, description: alertForm.description||null };
    if (!b.title) { toast('Nhập Alert title','error'); return; }
    try { await sbPost('alerts',b); toast('Alert created ✓','success'); setModal(null); loadAll(); }
    catch(e) { toast('Error: '+e.message,'error'); }
  };

  const submitProject = async () => {
    const b = { ...projForm,
      stack: projForm.stack ? projForm.stack.split(',').map(s=>s.trim()).filter(Boolean) : null,
      phase: projForm.phase||null, url: projForm.url||null, notes: projForm.notes||null,
    };
    if (!b.name||!b.slug) { toast('Nhập Name và Slug','error'); return; }
    try { await sbPost('projects',b); toast('Project created ✓','success'); setModal(null); loadAll(); }
    catch(e) { toast('Error: '+e.message,'error'); }
  };

  const resolveAlert = async (id) => {
    try {
      await sbPatch('alerts', { status:'resolved', resolved_at: new Date().toISOString() }, `?id=eq.${id}`);
      toast('Alert resolved ✓','success'); loadAll(); loadAlertsFull();
    } catch(e) { toast('Error: '+e.message,'error'); }
  };

  // Open modal with defaults
  const openModal = (type) => {
    const today = new Date().toISOString().slice(0,10);
    if (type==='log') setLogForm(f=>({...f, log_date:today, project_id: projects[0]?.id||''}));
    if (type==='kpi') setKpiForm(f=>({...f, snapshot_date:today, project_id: projects[0]?.id||''}));
    if (type==='alert') setAlertForm({ title:'', description:'', project_id:'', severity:'warning', source:'manual' });
    if (type==='project') setProjForm({ name:'', slug:'', status:'active', phase:'', url:'', stack:'', notes:'' });
    setModal(type);
  };

  // ─── NAV ──────────────────────────────────────────────────
  const navItems = [
    { group:'Overview', items:[{ id:'dashboard', icon:'⬡', label:'Dashboard' }] },
    { group:'Operations', items:[
      { id:'projects', icon:'◈', label:'Projects' },
      { id:'logs', icon:'◎', label:'Daily Logs' },
      { id:'kpi', icon:'◇', label:'KPI Snapshots' },
      { id:'alerts', icon:'△', label:'Alerts', badge: stats.openAlerts > 0 ? stats.openAlerts : null },
    ]},
    { group:'Intelligence', items:[{ id:'ai', icon:'✦', label:'T.Nexus AI' }] },
  ];

  const S = {
    layout: { display:'flex', minHeight:'calc(100vh - 56px)', position:'relative', zIndex:1 },
    sidebar: { width:220, flexShrink:0, background:'var(--bg2)', borderRight:'1px solid var(--border)', padding:'24px 0', display:'flex', flexDirection:'column', gap:4 },
    navSection: { fontSize:9, color:'var(--text-dim)', letterSpacing:'0.2em', textTransform:'uppercase', padding:'16px 20px 8px' },
    navItem: (active) => ({
      display:'flex', alignItems:'center', gap:10, padding:'10px 20px', cursor:'pointer',
      fontSize:12, color: active?'var(--accent)':'var(--text-dim)',
      borderLeft: `2px solid ${active?'var(--accent)':'transparent'}`,
      background: active?'rgba(99,211,178,0.06)':'transparent',
      transition:'all 0.2s', userSelect:'none',
    }),
    main: { flex:1, padding:32, overflowY:'auto' },
    topbar: { position:'sticky', top:0, zIndex:100, background:'rgba(8,11,16,0.92)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px', height:56 },
    card: { background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:20 },
    tableHead: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)' },
    tableTitle: { fontFamily:'Syne,sans-serif', fontSize:13, fontWeight:700, color:'var(--text-bright)' },
    th: { fontSize:10, color:'var(--text-dim)', letterSpacing:'0.15em', textTransform:'uppercase', textAlign:'left', padding:'12px 20px', borderBottom:'1px solid var(--border)', fontWeight:400 },
    td: { padding:'13px 20px', fontSize:12, color:'var(--text)', borderBottom:'1px solid rgba(255,255,255,0.03)', verticalAlign:'middle' },
    pageHeader: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28 },
    pageTitle: { fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:800, color:'var(--text-bright)', letterSpacing:'0.02em' },
    pageSub: { fontSize:11, color:'var(--text-dim)', marginTop:4 },
    btn: (variant) => ({
      fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:500,
      padding:'8px 16px', borderRadius:4, cursor:'pointer', border:'none',
      transition:'all 0.2s', letterSpacing:'0.05em',
      ...(variant==='primary' ? { background:'var(--accent)', color:'#080b10' } :
          variant==='danger'  ? { background:'transparent', color:'var(--red)', border:'1px solid rgba(224,108,117,0.3)' } :
          { background:'transparent', color:'var(--text-dim)', border:'1px solid var(--border)' }),
    }),
    statGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16, marginBottom:28 },
    statCard: (color) => ({
      background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:20,
      position:'relative', overflow:'hidden', transition:'all 0.2s',
    }),
    aiPanel: { background:'linear-gradient(135deg,rgba(99,211,178,0.04),rgba(97,175,239,0.04))', border:'1px solid rgba(99,211,178,0.15)', borderRadius:8, padding:20, marginBottom:24 },
    formGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 },
    tag: { display:'inline-block', fontSize:10, padding:'2px 7px', borderRadius:3, background:'rgba(255,255,255,0.05)', color:'var(--text-dim)', margin:2 },
  };

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse-hex { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(0.95)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes cursor-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        table { width:100%; border-collapse:collapse; }
        tr:hover td { background:rgba(255,255,255,0.02); }
        tr:last-child td { border-bottom:none!important; }
      `}</style>

      {/* TOPBAR */}
      <div style={S.topbar}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:28,height:28,background:'var(--accent)',clipPath:'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',animation:'pulse-hex 3s ease-in-out infinite'}}/>
          <span style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:15,color:'var(--text-bright)',letterSpacing:'0.08em'}}>NEXUS</span>
          <span style={{fontSize:10,color:'var(--accent)',border:'1px solid var(--accent)',padding:'2px 6px',borderRadius:3,letterSpacing:'0.2em'}}>CTL v4.0</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:20,fontSize:11,color:'var(--text-dim)'}}>
          <span style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:sbOk?'var(--green)':'var(--red)',boxShadow:`0 0 8px ${sbOk?'var(--green)':'var(--red)'}`,animation:'blink 2s ease-in-out infinite',display:'inline-block'}}/>
            Supabase
          </span>
          <span style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'var(--blue)',boxShadow:'0 0 8px var(--blue)',animation:'blink 2s ease-in-out infinite',display:'inline-block'}}/>
            T.Nexus AI
          </span>
          <span style={{color:'var(--accent)',fontSize:12}}>{clock}</span>
        </div>
      </div>

      <div style={S.layout}>
        {/* SIDEBAR */}
        <nav style={S.sidebar}>
          {navItems.map(g => (
            <div key={g.group}>
              <div style={S.navSection}>{g.group}</div>
              {g.items.map(item => (
                <div key={item.id} style={S.navItem(view===item.id)} onClick={() => setView(item.id)}>
                  <span style={{fontSize:14,width:18,textAlign:'center'}}>{item.icon}</span>
                  {item.label}
                  {item.badge && (
                    <span style={{marginLeft:'auto',background:'var(--red)',color:'#fff',fontSize:9,padding:'1px 6px',borderRadius:10}}>{item.badge}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* MAIN */}
        <main style={S.main}>

          {/* ─── DASHBOARD ─── */}
          {view==='dashboard' && (
            <div>
              <div style={S.pageHeader}>
                <div>
                  <div style={S.pageTitle}>Control Tower</div>
                  <div style={S.pageSub}>NEXUS AI Product Studio — Real-time overview</div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button style={S.btn('ghost')} onClick={loadAll}>↺ Refresh</button>
                  <button style={S.btn('primary')} onClick={() => openModal('log')}>+ Log Today</button>
                </div>
              </div>

              {/* Stats */}
              <div style={S.statGrid}>
                {[
                  { label:'Active Projects', value:stats.active, sub:`of ${stats.total} total`, color:'var(--green)' },
                  { label:'Logs This Week', value:stats.weekLogs, sub:'work journal entries', color:'var(--blue)' },
                  { label:'Open Alerts', value:stats.openAlerts, sub:'require attention', color:'var(--yellow)' },
                  { label:'KPI Records', value:stats.kpiCount, sub:'snapshots tracked', color:'var(--green)' },
                ].map(s => (
                  <div key={s.label} style={{...S.statCard(), cursor:'default'}}>
                    <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:s.color}}/>
                    <div style={{fontSize:10,color:'var(--text-dim)',letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:10}}>{s.label}</div>
                    <div style={{fontFamily:'Syne,sans-serif',fontSize:28,fontWeight:800,color:'var(--text-bright)',lineHeight:1}}>{s.value}</div>
                    <div style={{fontSize:10,color:'var(--text-dim)',marginTop:6}}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Tables */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:24}}>
                <div style={S.card}>
                  <div style={S.tableHead}>
                    <span style={S.tableTitle}>Recent Logs</span>
                    <button style={S.btn('ghost')} onClick={()=>setView('logs')}>View all →</button>
                  </div>
                  <table>
                    <thead><tr>
                      <th style={S.th}>Date</th><th style={S.th}>Project</th>
                      <th style={S.th}>Cat</th><th style={S.th}>Summary</th>
                    </tr></thead>
                    <tbody>
                      {!logs.length ? (
                        <tr><td style={{...S.td,color:'var(--text-dim)'}} colSpan={4}>No logs yet</td></tr>
                      ) : logs.slice(0,5).map(l => (
                        <tr key={l.id}>
                          <td style={S.td}>{fmtDate(l.log_date)}</td>
                          <td style={S.td}>{projectName(l.project_id,projects)}</td>
                          <td style={S.td}><Badge type={l.category}>{l.category}</Badge></td>
                          <td style={{...S.td,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.summary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={S.card}>
                  <div style={S.tableHead}>
                    <span style={S.tableTitle}>Open Alerts</span>
                    <button style={S.btn('ghost')} onClick={()=>setView('alerts')}>View all →</button>
                  </div>
                  <table>
                    <thead><tr>
                      <th style={S.th}>Severity</th><th style={S.th}>Title</th><th style={S.th}>Source</th>
                    </tr></thead>
                    <tbody>
                      {!alertsData.filter(a=>a.status==='open').length ? (
                        <tr><td style={{...S.td,color:'var(--text-dim)'}} colSpan={3}>No open alerts 🟢</td></tr>
                      ) : alertsData.filter(a=>a.status==='open').slice(0,5).map(a => (
                        <tr key={a.id}>
                          <td style={S.td}><Badge type={a.severity}/></td>
                          <td style={{...S.td,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.title}</td>
                          <td style={S.td}><Badge type={a.source}/></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Daily Digest */}
              <div style={S.aiPanel}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                  <div style={{width:28,height:28,background:'linear-gradient(135deg,var(--accent),var(--blue))',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>✦</div>
                  <div>
                    <div style={{fontFamily:'Syne,sans-serif',fontSize:13,fontWeight:700,color:'var(--text-bright)'}}>T.Nexus Daily Digest</div>
                    <div style={{fontSize:10,color:'var(--text-dim)'}}>AI analysis of your NEXUS ecosystem today</div>
                  </div>
                  <button style={{...S.btn('ghost'),marginLeft:'auto'}} onClick={generateDigest}>
                    {digestLoading ? 'Generating...' : 'Generate ↗'}
                  </button>
                </div>
                <div style={{fontSize:12,lineHeight:1.7,color:digestLoading?'var(--text-dim)':'var(--text)',whiteSpace:'pre-wrap'}}>
                  {digestOutput}
                  {digestLoading && <span style={{display:'inline-block',width:6,height:12,background:'var(--accent)',animation:'cursor-blink 0.8s step-end infinite',marginLeft:2,verticalAlign:'middle'}}/>}
                </div>
              </div>
            </div>
          )}

          {/* ─── PROJECTS ─── */}
          {view==='projects' && (
            <div>
              <div style={S.pageHeader}>
                <div><div style={S.pageTitle}>Projects</div><div style={S.pageSub}>NEXUS product portfolio</div></div>
                <button style={S.btn('primary')} onClick={()=>openModal('project')}>+ New Project</button>
              </div>
              <div style={S.card}>
                <table>
                  <thead><tr>
                    <th style={S.th}>Name</th><th style={S.th}>Status</th><th style={S.th}>Phase</th>
                    <th style={S.th}>Stack</th><th style={S.th}>URL</th><th style={S.th}>Updated</th>
                  </tr></thead>
                  <tbody>
                    {!projects.length ? (
                      <tr><td colSpan={6} style={{...S.td,color:'var(--text-dim)',textAlign:'center',padding:40}}>No projects</td></tr>
                    ) : projects.map(p => (
                      <tr key={p.id}>
                        <td style={S.td}>
                          <strong style={{color:'var(--text-bright)'}}>{p.name}</strong>
                          <br/><span style={{color:'var(--text-dim)',fontSize:10}}>{p.slug}</span>
                        </td>
                        <td style={S.td}><Badge type={p.status}/></td>
                        <td style={S.td}>{p.phase ? <Badge type={p.phase}>{p.phase}</Badge> : '—'}</td>
                        <td style={S.td}>{(p.stack||[]).map(s=><span key={s} style={S.tag}>{s}</span>)}</td>
                        <td style={S.td}>{p.url ? <a href={p.url} target="_blank" rel="noreferrer" style={{color:'var(--accent)',fontSize:11}}>{p.url.replace('https://','')}</a> : '—'}</td>
                        <td style={S.td}>{fmtDate(p.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── LOGS ─── */}
          {view==='logs' && (
            <div>
              <div style={S.pageHeader}>
                <div><div style={S.pageTitle}>Daily Logs</div><div style={S.pageSub}>Work journal — ngày nào cũng log</div></div>
                <button style={S.btn('primary')} onClick={()=>openModal('log')}>+ New Log</button>
              </div>
              <div style={{display:'flex',gap:10,marginBottom:16}}>
                {[
                  { key:'project', el: <select value={logFilter.project} onChange={e=>setLogFilter(f=>({...f,project:e.target.value}))} style={{...inputStyle,width:'auto'}}>
                    <option value="">All Projects</option>
                    {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>},
                  { key:'cat', el: <select value={logFilter.cat} onChange={e=>setLogFilter(f=>({...f,cat:e.target.value}))} style={{...inputStyle,width:'auto'}}>
                    <option value="">All Categories</option>
                    {['dev','marketing','content','ops','research','finance','other'].map(c=><option key={c} value={c}>{c}</option>)}
                  </select>},
                ].map(x=><div key={x.key}>{x.el}</div>)}
              </div>
              <div style={S.card}>
                <table>
                  <thead><tr>
                    <th style={S.th}>Date</th><th style={S.th}>Project</th><th style={S.th}>Cat</th>
                    <th style={S.th}>Summary</th><th style={S.th}>Hours</th><th style={S.th}>Mood</th><th style={S.th}>Blockers</th>
                  </tr></thead>
                  <tbody>
                    {!logs.length ? (
                      <tr><td colSpan={7} style={{...S.td,color:'var(--text-dim)',textAlign:'center',padding:40}}>No logs yet</td></tr>
                    ) : logs.map(l => (
                      <tr key={l.id}>
                        <td style={S.td}>{fmtDate(l.log_date)}</td>
                        <td style={S.td}>{projectName(l.project_id,projects)}</td>
                        <td style={S.td}><Badge type={l.category}>{l.category}</Badge></td>
                        <td style={{...S.td,maxWidth:200}}>{l.summary}</td>
                        <td style={S.td}>{l.hours_spent||'—'}h</td>
                        <td style={S.td}>{moodStars(l.mood)}</td>
                        <td style={{...S.td,color:'var(--red)',fontSize:11,maxWidth:160}}>{l.blockers||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── KPI ─── */}
          {view==='kpi' && (
            <div>
              <div style={S.pageHeader}>
                <div><div style={S.pageTitle}>KPI Snapshots</div><div style={S.pageSub}>Revenue, traffic, user metrics</div></div>
                <button style={S.btn('primary')} onClick={()=>openModal('kpi')}>+ Add Snapshot</button>
              </div>
              <div style={S.card}>
                <table>
                  <thead><tr>
                    <th style={S.th}>Date</th><th style={S.th}>Project</th><th style={S.th}>Period</th>
                    <th style={S.th}>Revenue VND</th><th style={S.th}>Revenue USD</th>
                    <th style={S.th}>Free</th><th style={S.th}>Paid</th><th style={S.th}>KDP Units</th>
                  </tr></thead>
                  <tbody>
                    {!kpiData.length ? (
                      <tr><td colSpan={8} style={{...S.td,color:'var(--text-dim)',textAlign:'center',padding:40}}>No KPI snapshots yet</td></tr>
                    ) : kpiData.map(k => (
                      <tr key={k.id}>
                        <td style={S.td}>{fmtDate(k.snapshot_date)}</td>
                        <td style={S.td}>{projectName(k.project_id,projects)}</td>
                        <td style={S.td}><Badge type={k.period}/></td>
                        <td style={{...S.td,color:'var(--green)'}}>{k.revenue_vnd ? Number(k.revenue_vnd).toLocaleString('vi-VN') : '—'}</td>
                        <td style={{...S.td,color:'var(--yellow)'}}>{k.revenue_usd ? '$'+k.revenue_usd : '—'}</td>
                        <td style={S.td}>{k.free_users??'—'}</td>
                        <td style={{...S.td,color:'var(--accent)'}}>{k.paid_users??'—'}</td>
                        <td style={S.td}>{k.kdp_units_sold??'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── ALERTS ─── */}
          {view==='alerts' && (
            <div>
              <div style={S.pageHeader}>
                <div><div style={S.pageTitle}>Alerts</div><div style={S.pageSub}>Issues, risks, action items</div></div>
                <button style={S.btn('primary')} onClick={()=>openModal('alert')}>+ New Alert</button>
              </div>
              <div style={S.card}>
                <table>
                  <thead><tr>
                    <th style={S.th}>Severity</th><th style={S.th}>Title</th><th style={S.th}>Project</th>
                    <th style={S.th}>Source</th><th style={S.th}>Status</th><th style={S.th}>Created</th><th style={S.th}>Action</th>
                  </tr></thead>
                  <tbody>
                    {!alertsData.length ? (
                      <tr><td colSpan={7} style={{...S.td,color:'var(--text-dim)',textAlign:'center',padding:40}}>No alerts — all clear! ✅</td></tr>
                    ) : alertsData.map(a => (
                      <tr key={a.id}>
                        <td style={S.td}><Badge type={a.severity}/></td>
                        <td style={S.td}><strong style={{color:'var(--text-bright)'}}>{a.title}</strong>
                          {a.description && <><br/><span style={{color:'var(--text-dim)',fontSize:11}}>{a.description.slice(0,60)}{a.description.length>60?'...':''}</span></>}
                        </td>
                        <td style={S.td}>{projectName(a.project_id,projects)}</td>
                        <td style={S.td}><Badge type={a.source}/></td>
                        <td style={S.td}><Badge type={a.status}/></td>
                        <td style={S.td}>{fmtDate(a.created_at)}</td>
                        <td style={S.td}>
                          {a.status==='open' && <button style={{...S.btn('ghost'),fontSize:10,padding:'4px 8px'}} onClick={()=>resolveAlert(a.id)}>Resolve</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── AI ─── */}
          {view==='ai' && (
            <div>
              <div style={S.pageHeader}>
                <div><div style={S.pageTitle}>T.Nexus AI</div><div style={S.pageSub}>Claude-powered intelligence for NEXUS ecosystem</div></div>
              </div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
                {[
                  { id:'digest', icon:'📊', label:'Daily Digest' },
                  { id:'risks',  icon:'⚠',  label:'Risk Analysis' },
                  { id:'kpi',    icon:'📈', label:'KPI Insights' },
                  { id:'next',   icon:'🎯', label:'Next Actions' },
                  { id:'kdp',    icon:'📚', label:'KDP Strategy' },
                ].map(a => (
                  <button key={a.id} style={S.btn('ghost')} onClick={()=>runAI(a.id)}>
                    {a.icon} {a.label}
                  </button>
                ))}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
                <label style={{fontSize:10,color:'var(--text-dim)',letterSpacing:'0.12em',textTransform:'uppercase'}}>Custom prompt cho T.Nexus</label>
                <textarea value={customPrompt} onChange={e=>setCustomPrompt(e.target.value)}
                  placeholder="Hỏi T.Nexus bất cứ điều gì về NEXUS ecosystem..."
                  style={{...inputStyle,minHeight:80,resize:'vertical'}}/>
              </div>
              <button style={{...S.btn('primary'),marginBottom:20}} onClick={()=>runAI('custom')}>Send to T.Nexus ↗</button>
              <div style={S.aiPanel}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                  <div style={{width:28,height:28,background:'linear-gradient(135deg,var(--accent),var(--blue))',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>✦</div>
                  <div>
                    <div style={{fontFamily:'Syne,sans-serif',fontSize:13,fontWeight:700,color:'var(--text-bright)'}}>T.Nexus Response</div>
                    <div style={{fontSize:10,color:'var(--text-dim)'}}>{aiLabel}</div>
                  </div>
                </div>
                <div style={{fontSize:12,lineHeight:1.7,color:aiLoading?'var(--text-dim)':'var(--text)',whiteSpace:'pre-wrap',minHeight:60}}>
                  {aiOutput || 'Chọn một analysis hoặc nhập prompt tùy chỉnh...'}
                  {aiLoading && <span style={{display:'inline-block',width:6,height:12,background:'var(--accent)',animation:'cursor-blink 0.8s step-end infinite',marginLeft:2,verticalAlign:'middle'}}/>}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ─── MODALS ─── */}

      {/* LOG */}
      <Modal open={modal==='log'} title="+ New Daily Log" onClose={()=>setModal(null)}>
        <div style={S.formGrid}>
          <FG label="Project *"><Sel value={logForm.project_id} onChange={e=>setLogForm(f=>({...f,project_id:e.target.value}))}>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </Sel></FG>
          <FG label="Date *"><Inp type="date" value={logForm.log_date} onChange={e=>setLogForm(f=>({...f,log_date:e.target.value}))}/></FG>
          <FG label="Category *"><Sel value={logForm.category} onChange={e=>setLogForm(f=>({...f,category:e.target.value}))}>
            {['dev','marketing','content','ops','research','finance','other'].map(c=><option key={c} value={c}>{c}</option>)}
          </Sel></FG>
          <FG label="Hours Spent"><Inp type="number" placeholder="3.5" min="0" max="24" step="0.5" value={logForm.hours_spent} onChange={e=>setLogForm(f=>({...f,hours_spent:e.target.value}))}/></FG>
          <FG label="Summary * — what was done" span><Tex placeholder="Đã làm gì hôm nay..." value={logForm.summary} onChange={e=>setLogForm(f=>({...f,summary:e.target.value}))}/></FG>
          <FG label="Blockers" span><Tex placeholder="Có gì đang block không..." value={logForm.blockers} onChange={e=>setLogForm(f=>({...f,blockers:e.target.value}))} style={{minHeight:56}}/></FG>
          <FG label="Next Actions" span><Tex placeholder="Bước tiếp theo..." value={logForm.next_actions} onChange={e=>setLogForm(f=>({...f,next_actions:e.target.value}))} style={{minHeight:56}}/></FG>
          <FG label="Mood (1–5)"><Sel value={logForm.mood} onChange={e=>setLogForm(f=>({...f,mood:e.target.value}))}>
            {[5,4,3,2,1].map(n=><option key={n} value={n}>{n} ⭐ {['','Bad','Rough','OK','Good','Great'][n]}</option>)}
          </Sel></FG>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button style={S.btn('primary')} onClick={submitLog}>Save Log</button>
          <button style={S.btn('ghost')} onClick={()=>setModal(null)}>Cancel</button>
        </div>
      </Modal>

      {/* KPI */}
      <Modal open={modal==='kpi'} title="+ KPI Snapshot" onClose={()=>setModal(null)}>
        <div style={S.formGrid}>
          <FG label="Project *"><Sel value={kpiForm.project_id} onChange={e=>setKpiForm(f=>({...f,project_id:e.target.value}))}>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </Sel></FG>
          <FG label="Date *"><Inp type="date" value={kpiForm.snapshot_date} onChange={e=>setKpiForm(f=>({...f,snapshot_date:e.target.value}))}/></FG>
          <FG label="Period"><Sel value={kpiForm.period} onChange={e=>setKpiForm(f=>({...f,period:e.target.value}))}>
            <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
          </Sel></FG>
          <FG label="Page Views"><Inp type="number" placeholder="0" value={kpiForm.page_views} onChange={e=>setKpiForm(f=>({...f,page_views:e.target.value}))}/></FG>
          <FG label="Revenue VND"><Inp type="number" placeholder="0" value={kpiForm.revenue_vnd} onChange={e=>setKpiForm(f=>({...f,revenue_vnd:e.target.value}))}/></FG>
          <FG label="Revenue USD"><Inp type="number" placeholder="0.00" step="0.01" value={kpiForm.revenue_usd} onChange={e=>setKpiForm(f=>({...f,revenue_usd:e.target.value}))}/></FG>
          <FG label="Free Users"><Inp type="number" placeholder="0" value={kpiForm.free_users} onChange={e=>setKpiForm(f=>({...f,free_users:e.target.value}))}/></FG>
          <FG label="Paid Users"><Inp type="number" placeholder="0" value={kpiForm.paid_users} onChange={e=>setKpiForm(f=>({...f,paid_users:e.target.value}))}/></FG>
          <FG label="KDP Units Sold"><Inp type="number" placeholder="0" value={kpiForm.kdp_units_sold} onChange={e=>setKpiForm(f=>({...f,kdp_units_sold:e.target.value}))}/></FG>
          <FG label="KDP Royalties USD"><Inp type="number" placeholder="0.00" step="0.01" value={kpiForm.kdp_royalties} onChange={e=>setKpiForm(f=>({...f,kdp_royalties:e.target.value}))}/></FG>
          <FG label="Notes" span><Tex placeholder="Ghi chú..." value={kpiForm.notes} onChange={e=>setKpiForm(f=>({...f,notes:e.target.value}))} style={{minHeight:56}}/></FG>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button style={S.btn('primary')} onClick={submitKPI}>Save Snapshot</button>
          <button style={S.btn('ghost')} onClick={()=>setModal(null)}>Cancel</button>
        </div>
      </Modal>

      {/* ALERT */}
      <Modal open={modal==='alert'} title="+ New Alert" onClose={()=>setModal(null)}>
        <div style={S.formGrid}>
          <FG label="Title *" span><Inp placeholder="Alert title..." value={alertForm.title} onChange={e=>setAlertForm(f=>({...f,title:e.target.value}))}/></FG>
          <FG label="Project"><Sel value={alertForm.project_id} onChange={e=>setAlertForm(f=>({...f,project_id:e.target.value}))}>
            <option value="">— General —</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </Sel></FG>
          <FG label="Severity"><Sel value={alertForm.severity} onChange={e=>setAlertForm(f=>({...f,severity:e.target.value}))}>
            <option value="critical">Critical 🔴</option><option value="warning">Warning 🟡</option>
            <option value="info">Info 🔵</option><option value="success">Success 🟢</option>
          </Sel></FG>
          <FG label="Source"><Sel value={alertForm.source} onChange={e=>setAlertForm(f=>({...f,source:e.target.value}))}>
            <option value="manual">Manual</option><option value="n8n">n8n</option>
            <option value="claude">Claude</option><option value="system">System</option>
          </Sel></FG>
          <FG label="Description" span><Tex placeholder="Chi tiết..." value={alertForm.description} onChange={e=>setAlertForm(f=>({...f,description:e.target.value}))}/></FG>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button style={S.btn('primary')} onClick={submitAlert}>Save Alert</button>
          <button style={S.btn('ghost')} onClick={()=>setModal(null)}>Cancel</button>
        </div>
      </Modal>

      {/* PROJECT */}
      <Modal open={modal==='project'} title="+ New Project" onClose={()=>setModal(null)}>
        <div style={S.formGrid}>
          <FG label="Name *"><Inp placeholder="TomTat AI" value={projForm.name} onChange={e=>setProjForm(f=>({...f,name:e.target.value}))}/></FG>
          <FG label="Slug *"><Inp placeholder="tomtatai" value={projForm.slug} onChange={e=>setProjForm(f=>({...f,slug:e.target.value}))}/></FG>
          <FG label="Status"><Sel value={projForm.status} onChange={e=>setProjForm(f=>({...f,status:e.target.value}))}>
            <option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option>
          </Sel></FG>
          <FG label="Phase"><Inp placeholder="growth / dev / launch" value={projForm.phase} onChange={e=>setProjForm(f=>({...f,phase:e.target.value}))}/></FG>
          <FG label="URL" span><Inp placeholder="https://..." value={projForm.url} onChange={e=>setProjForm(f=>({...f,url:e.target.value}))}/></FG>
          <FG label="Stack (comma separated)" span><Inp placeholder="Next.js, Supabase, Vercel" value={projForm.stack} onChange={e=>setProjForm(f=>({...f,stack:e.target.value}))}/></FG>
          <FG label="Notes" span><Tex value={projForm.notes} onChange={e=>setProjForm(f=>({...f,notes:e.target.value}))} style={{minHeight:56}}/></FG>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button style={S.btn('primary')} onClick={submitProject}>Save Project</button>
          <button style={S.btn('ghost')} onClick={()=>setModal(null)}>Cancel</button>
        </div>
      </Modal>

      <ToastContainer/>
    </>
  );
}
