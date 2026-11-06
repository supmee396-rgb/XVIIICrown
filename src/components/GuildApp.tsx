'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useGuildData } from '@/lib/useGuildData';
import { Activity as ActivityIcon, ArrowRight, Check, CheckCheck, ChevronDown, CircleHelp, Clock3, Crown, FileText, History, LayoutDashboard, ListOrdered, LockKeyhole, Menu, Pause, Play, Plus, Search, Settings2, Shield, Swords, Users, X } from 'lucide-react';
import { formatDate, formatTime, LEVELS, STATUS_LABELS } from '@/lib/data';
import { levelsForParty, partyName } from '@/lib/parties';
import type { AppData, Level, QueueEntry, QueueStatus, Party } from '@/lib/types';

type Tab = 'overview'|'queue'|'parties'|'report'|'history'|'settings';
function Button({children,onClick,kind='primary',disabled=false,className=''}:{children:React.ReactNode,onClick?:()=>void,kind?:'primary'|'secondary'|'ghost'|'danger'|'success',disabled?:boolean,className?:string}){
  return <button type="button" disabled={disabled} onClick={onClick} className={`btn btn-${kind} ${className}`}>{children}</button>;
}
function Pill({status}:{status:QueueStatus}){return <span className={`status status-${status}`}>{STATUS_LABELS[status]}</span>}

export default function GuildApp(){
  const store = useGuildData();
  if (!store.data) return <main className="loading-page"><Swords size={30}/><h1>กำลังโหลดหน้าจัดการ</h1><p role="status">{store.error || 'กำลังอ่านข้อมูลคิว…'}</p>{store.error && <button className="btn btn-secondary" onClick={()=>void store.refresh()}>ลองอีกครั้ง</button>}</main>;
  return <GuildDashboard store={store} data={store.data}/>;
}
function GuildDashboard({store,data}:{store:ReturnType<typeof useGuildData>;data:AppData}){
  const [tab,setTab] = useState<Tab>('overview');
  const admin = true;
  const [levelFilter,setLevelFilter] = useState<Level>(3);
  const [historyFilter,setHistoryFilter] = useState<'all'|Level>('all');
  const [reportLevel,setReportLevel] = useState<'all'|Level>('all');
  const [reportQuery,setReportQuery] = useState('');
  const [partyLevel,setPartyLevel] = useState<Record<string,Level>>({'party-a':1,'party-b':3,'party-c':1});
  const [partySelections,setPartySelections] = useState<Record<string,string[]>>({});
  const [toast,setToast] = useState('');
  const [mobileNav,setMobileNav] = useState(false);

  const round = data.rounds[data.rounds.length-1];
  const queues = useMemo(()=>data.queues.filter(q=>q.roundId===round.id),[data.queues,round.id]);
  const sorted = (rows:QueueEntry[])=>[...rows].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.order-b.order||a.id.localeCompare(b.id));
  const getMember=(id:string)=>data.members.find(m=>m.id===id)?.name||'Unknown';
  const currentRuns=data.runs.filter(r=>r.roundId===round.id&&r.status==='in_progress');
  const currentlyBusy = new Set(currentRuns.flatMap(r=>r.memberIds));
  const notice=(message:string)=>setToast(message);
  const counts={waiting:queues.filter(q=>q.status==='waiting').length,running:queues.filter(q=>q.status==='in_progress').length,done:queues.filter(q=>q.status==='completed').length,total:queues.length};
  const successfulHistory = data.runs.filter(r=>r.status==='completed').filter(r=>historyFilter==='all'||r.level===historyFilter).reverse().flatMap(run=>run.memberIds.map(memberId=>({run,memberId})));

  const command=async(payload:Record<string,unknown>,message:string)=>{
    try { const result=await store.mutate(payload); if(!result)return false; notice(message); return true; }
    catch(error){notice(error instanceof Error?error.message:'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง');return false;}
  };
  const updateQueue=(id:string,status:QueueStatus)=>void command({type:'queue-status',id,status},'อัปเดตสถานะคิวแล้ว');
  const eligible=(level:Level)=>sorted(queues.filter(q=>q.level===level&&q.status==='waiting'&&!currentlyBusy.has(q.memberId)));
  const toggleSelection=(partyId:string,queueId:string,level:Level)=>{
    const run=currentRuns.find(r=>r.partyId===partyId);if(run){notice('ตี้นี้กำลังดันอยู่');return;}
    setPartySelections(prev=>{
      const list=prev[partyId]||[];
      if(list.includes(queueId))return {...prev,[partyId]:list.filter(id=>id!==queueId)};
      if(list.length>=data.capacities[level]){notice(`Lv.${level} รับได้สูงสุด ${data.capacities[level]} คน`);return prev;}
      return {...prev,[partyId]:[...list,queueId]};
    });
  };
  const startRun=async(party:Party)=>{
    const level=partyLevel[party.id]||1;
    if(await command({type:'start-run',partyId:party.id,level,queueIds:partySelections[party.id]||[]},`${partyName(party.id)} เริ่มดัน Lv.${level} แล้ว`))setPartySelections(p=>({...p,[party.id]:[]}));
  };
  const finishRun=(runId:string,success:boolean)=>void command({type:'finish-run',runId,success},'บันทึกผลการดันแล้ว');
  const setRoundStatus=(status:'open'|'closed'|'finished')=>void command({type:'round-status',status},'อัปเดตสถานะรอบแล้ว');
  const newRound=async()=>{
    if(window.confirm('เปิดรอบใหม่และสิ้นสุดรอบปัจจุบัน? คิวและประวัติเดิมจะยังถูกเก็บไว้')){
      if(await command({type:'new-round'},'เปิดรอบใหม่แล้ว'))setPartySelections({});
    }
  };
  const navItems:{id:Tab;label:string;icon:React.ReactNode}[]=[
    {id:'overview',label:'ภาพรวม',icon:<LayoutDashboard size={18}/>},
    {id:'queue',label:'คิวดันเจี้ยน',icon:<ListOrdered size={18}/>},
    {id:'parties',label:'จัดการตี้แบก',icon:<Swords size={18}/>},
    {id:'report',label:'รายงานลงคิว',icon:<FileText size={18}/>},
    {id:'history',label:'ประวัติการดัน',icon:<History size={18}/>},
    {id:'settings',label:'ตั้งค่าระบบ',icon:<Settings2 size={18}/>}
  ];
  const navTo=(id:Tab)=>{setTab(id);setMobileNav(false);setToast('')};
  const levelCounts=LEVELS.map(level=>queues.filter(q=>q.level===level&&q.status==='waiting').length);
  const badge=(isOpen:boolean)=> <span className={`round-badge ${isOpen?'is-open':''}`}><span className="dot"/>{round.status==='open'?'เปิดรับคิว':round.status==='closed'?'ปิดรับคิว':'จบรอบแล้ว'}</span>;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?'sidebar-open':''}`}>
      <div className="brand"><span className="brand-icon"><Swords size={22}/></span><div><strong>GUILD<span>QUEUE</span></strong><small>DUNGEON MANAGER</small></div></div>
      <div className="guild-card"><span className="guild-emblem"><Crown size={23}/></span><div><strong>Nightfall Guild</strong><small>Guild Management</small></div><ChevronDown size={16}/></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="sidebar-nav">{navItems.filter(x=>admin||!['parties','settings'].includes(x.id)).map(item=><button key={item.id} className={`nav-button ${tab===item.id?'active':''}`} onClick={()=>navTo(item.id)}>{item.icon}<span>{item.label}</span>{item.id==='queue'&&<span className="nav-count">{counts.waiting}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-round"><span className="live-dot"/> รอบที่ {round.number}<small>{round.status==='open'?'กำลังเปิดรับคิว':round.status==='closed'?'ปิดรับคิว':'จบรอบแล้ว'}</small></div><div className="sidebar-foot">GUILD QUEUE <span>LOCAL EDITION</span></div></div>
    </aside>
    {mobileNav&&<button className="backdrop" aria-label="ปิดเมนู" onClick={()=>setMobileNav(false)}/>}
    <div className="main-panel">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={()=>setMobileNav(true)} aria-label="เปิดเมนู"><Menu size={21}/></button><span className="crumb">GUILD /</span><strong>{navItems.find(x=>x.id===tab)?.label}</strong></div><div className="top-actions"><Link className="btn btn-secondary" href="/queue"><Plus size={15}/> หน้าลงคิว</Link><span className="avatar">AD</span></div></header>
      <main className="content">{store.error&&<div role="alert" className="connection-error">{store.error} · กำลังลองเชื่อมต่อใหม่</div>}<fieldset className="workspace-fieldset" disabled={store.pending}>
        <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> DUNGEON OPERATIONS / SEASON 01</div><h1>{tab==='overview'?'ภาพรวมระบบคิว':tab==='queue'?'คิวดันเจี้ยน':tab==='parties'?'จัดการตี้แบก':tab==='report'?'รายงานลงคิว':tab==='history'?'ประวัติการลงดัน':'ตั้งค่าระบบ'}</h1><p>{tab==='overview'?'จัดการทุกคิว ทุกตี้ ในที่เดียว':tab==='queue'?'เลือกดันเจี้ยน ตรวจสอบคิว และติดตามสถานะ':tab==='parties'?'จัดสมาชิกเข้าตี้ได้พร้อมกันหลายตี้ โดยรักษาลำดับคิว':tab==='report'?'เช็คได้ทันทีว่าใครลงคิวระดับไหนแล้วบ้าง':tab==='history'?'ตรวจสอบผลการดันและกิจกรรมย้อนหลัง':'กำหนดจำนวนคนแบกและจัดการรอบ'}</p></div><div className="heading-right">{badge(round.status==='open')}<span className="round-number">ROUND #{String(round.number).padStart(2,'0')}</span></div></div>
        {tab==='overview'&&<>
          <section className="stats-grid"><Stat icon={<Users size={19}/>} label="รายการลงคิวทั้งหมด" value={counts.total} sub="รอบปัจจุบัน" variant="purple"/><Stat icon={<Clock3 size={19}/>} label="กำลังรอคิว" value={counts.waiting} sub="รอเรียกเข้าตี้" variant="blue"/><Stat icon={<Swords size={19}/>} label="กำลังดัน" value={counts.running} sub={`${currentRuns.length} ตี้กำลังทำงาน`} variant="yellow"/><Stat icon={<CheckCheck size={19}/>} label="สำเร็จแล้ว" value={counts.done} sub="รายการที่ผ่านดัน" variant="green"/></section>
          <div className="two-column"><section className="panel"><div className="panel-title"><div><h2>คิวแยกตามระดับ</h2><p>จำนวนสมาชิกที่รอในแต่ละดันเจี้ยน</p></div><button className="text-link" onClick={()=>navTo('queue')}>ดูคิวทั้งหมด <ArrowRight size={15}/></button></div><div className="levels-list">{LEVELS.map((lv,i)=><button className="level-overview" key={lv} onClick={()=>{setLevelFilter(lv);navTo('queue')}}><span className={`level-icon lv-${lv}`}>0{lv}</span><span className="level-name">Dungeon Level {lv}<small>LEVEL {lv} RAID</small></span><span className="level-track"><span style={{width:`${levelCounts[i]?Math.max(8,levelCounts[i]/Math.max(...levelCounts,1)*100):0}%`}}/></span><strong>{levelCounts[i]} <small>คน</small></strong><ArrowRight size={17}/></button>)}</div></section>
          <section className="panel"><div className="panel-title"><div><h2>สถานะตี้แบก</h2><p>ภาพรวมการทำงานของตี้ทั้งหมด</p></div>{admin&&<button className="text-link" onClick={()=>navTo('parties')}>จัดการตี้ <ArrowRight size={15}/></button>}</div><div className="party-overview">{data.parties.map(p=>{const run=currentRuns.find(r=>r.partyId===p.id);return <div key={p.id} className="party-summary"><span className="party-avatar" style={{background:`${p.color}20`,color:p.color}}><Shield size={20}/></span><div><strong>{partyName(p.id)}</strong><small>{run?`Lv.${run.level} · ${run.memberIds.length} คน`:p.leader}</small></div><span className={`party-state ${run?'busy':''}`}>{run?'กำลังดัน':'พร้อมรับคิว'}</span></div>})}</div><div className="helper-note"><ActivityIcon size={17}/> สามารถเปิดหลายตี้ดันพร้อมกันได้ โดยสมาชิกไม่ซ้ำกัน</div></section></div>
          <section className="panel"><div className="panel-title"><div><h2>กิจกรรมล่าสุด</h2><p>ความเคลื่อนไหวที่เกิดขึ้นในระบบ</p></div></div><div className="activity-list">{data.activity.slice(0,5).map(a=><div className="activity-row" key={a.id}><span className="activity-icon"><ActivityIcon size={15}/></span><span>{a.detail}</span><time>{formatTime(a.timestamp)}</time></div>)}</div></section>
        </>}
        {tab==='queue'&&<>
          <div className="admin-queue-layout"><div className="info-strip"><ListOrdered size={18}/><span>สมาชิกลงทะเบียนผ่านหน้าลงคิวแยก ข้อมูลอัปเดตอัตโนมัติทุก 3 วินาที</span><Link className="text-link" href="/queue">เปิดหน้าลงคิว <ArrowRight size={15}/></Link></div>
          <section className="panel queue-list-panel all-level-queue"><div className="panel-title"><div><h2>รายการคิวทุกระดับ</h2><p>ดูทุก Lv. ในหน้าเดียว และจัดการสถานะใต้ระดับนั้นได้ทันที</p></div><span className="count-label">ทั้งหมด {queues.length} รายการ</span></div><div className="level-queue-grid">{LEVELS.map(lv=>{const levelRows=sorted(queues.filter(q=>q.level===lv));return <section className="level-queue-card" key={lv}><div className="level-queue-card-head"><span className={`level-icon lv-${lv}`}>0{lv}</span><div><h3>Dungeon Level {lv}</h3><small>{levelRows.length} รายการ · รอคิว {levelRows.filter(q=>q.status==='waiting').length}</small></div></div><div className="level-queue-items">{levelRows.length?levelRows.map((q,i)=><div className="level-queue-item" key={q.id}><div className="level-queue-player"><span className="queue-number">#{String(i+1).padStart(2,'0')}</span><span className="tiny-avatar">{getMember(q.memberId).slice(0,1)}</span><span><strong>{getMember(q.memberId)}</strong><small>{formatTime(q.createdAt)}</small></span></div><div className="level-queue-action"><Pill status={q.status}/>{admin&&<select aria-label={`แก้สถานะ ${getMember(q.memberId)} Lv.${lv}`} value={q.status} onChange={e=>updateQueue(q.id,e.target.value as QueueStatus)} disabled={q.status==='in_progress'||round.status==='finished'} className="status-select">{(['waiting','paused','cancelled','failed','completed'] as QueueStatus[]).concat(q.status==='in_progress'?['in_progress']:[]).map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select>}</div></div>):<div className="level-queue-empty">ยังไม่มีคนลงคิว</div>}</div></section>})}</div></section></div>
        </>}
        {tab==='parties'&&admin&&<><section className="info-strip"><LockKeyhole size={18}/><span>เลือกตี้ตามช่วงระดับ: <strong>Dun 1-2</strong> · <strong>Dun 3-5</strong> · <strong>Dun 1-5</strong> และเลือกเฉพาะผู้ที่รอคิวและไม่อยู่ระหว่างดัน</span></section><div className="party-grid">{data.parties.map(p=>{const allowedLevels=levelsForParty(p.id);const active=currentRuns.find(r=>r.partyId===p.id);const lv=allowedLevels.includes(partyLevel[p.id])?partyLevel[p.id]:allowedLevels[0];const avail=eligible(lv);const picks=partySelections[p.id]||[];return <section className="panel party-card" key={p.id}><div className="party-card-head"><span className="party-avatar large" style={{background:`${p.color}20`,color:p.color}}><Shield size={25}/></span><div><h2>{partyName(p.id)}</h2><p>หัวหน้า: {p.leader}</p></div><span className={`party-state ${active?'busy':''}`}>{active?'กำลังดัน':'พร้อมรับคิว'}</span></div>{active?<><div className="active-run"><span className="active-icon"><Swords size={21}/></span><div><small>กำลังแบกดันเจี้ยน</small><strong>LEVEL {active.level}</strong><span>เริ่มเมื่อ {formatTime(active.startedAt)}</span></div></div><div className="field-label">สมาชิกที่กำลังแบก ({active.memberIds.length} คน)</div><div className="selected-players">{active.memberIds.map(id=><div key={id} className="selected-player"><span className="tiny-avatar">{getMember(id).slice(0,1)}</span>{getMember(id)}<span className="in-progress-dot"/></div>)}</div><div className="run-actions"><Button kind="success" onClick={()=>finishRun(active.id,true)}><CheckCheck size={17}/> สำเร็จ</Button><Button kind="secondary" onClick={()=>finishRun(active.id,false)}><X size={17}/> ไม่สำเร็จ</Button></div></>:<><label className="field-label">เลือกระดับที่จะดัน</label><select className="field-select" value={lv} onChange={e=>{setPartyLevel(prev=>({...prev,[p.id]:Number(e.target.value) as Level}));setPartySelections(prev=>({...prev,[p.id]:[]}))}}>{allowedLevels.map(l=><option value={l} key={l}>Dungeon Level {l} · สูงสุด {data.capacities[l]} คน</option>)}</select><div className="pick-header"><span>เลือกสมาชิก ({picks.length}/{data.capacities[lv]})</span><span>{avail.length} คนที่พร้อม</span></div><div className="pick-list">{avail.length?avail.map((q,i)=><button className={`pick-row ${picks.includes(q.id)?'picked':''}`} key={q.id} onClick={()=>toggleSelection(p.id,q.id,lv)}><span className="pick-index">{String(i+1).padStart(2,'0')}</span><span className="tiny-avatar">{getMember(q.memberId).slice(0,1)}</span><strong>{getMember(q.memberId)}</strong><span className="pick-check">{picks.includes(q.id)&&<Check size={13}/>}</span></button>):<div className="empty-state">ไม่มีสมาชิกที่พร้อมในระดับนี้</div>}</div><Button className="full-btn" disabled={!picks.length} onClick={()=>startRun(p)}><Play size={16}/> เริ่มดัน {picks.length} คน</Button></>}</section>})}</div></>}
        {tab==='report'&&admin&&<ReportPanel data={data} roundId={round.id} level={reportLevel} query={reportQuery} setLevel={setReportLevel} setQuery={setReportQuery} getMember={getMember}/>} 
        {tab==='history'&&<><section className="panel"><div className="panel-title"><div><h2>ประวัติการลงสำเร็จ</h2><p>แสดงทีละตัวละคร พร้อม Dun ในแถวเดียว</p></div><select className="field-select compact-select" value={historyFilter} onChange={e=>setHistoryFilter(e.target.value==='all'?'all':Number(e.target.value) as Level)}><option value="all">ทุกระดับ</option>{LEVELS.map(l=><option key={l} value={l}>Level {l}</option>)}</select></div><div className="history-list"><div className="history-head history-head-success"><span>วันที่ / เวลา</span><span>ตัวละคร</span><span>ดันเจี้ยน</span><span>ตี้แบก</span><span>ผลลัพธ์</span></div>{successfulHistory.map(({run,memberId})=><div className="history-row history-row-success" key={`${run.id}-${memberId}`}><span>{formatDate(run.startedAt)}<small>{formatTime(run.startedAt)}</small></span><strong>{getMember(memberId)}</strong><span className="history-dungeon">Dun Lv.{run.level}</span><span>{partyName(run.partyId)}</span><span className="status status-completed">สำเร็จ</span></div>)}{!successfulHistory.length&&<div className="empty-state large-empty"><History size={28}/><strong>ยังไม่มีประวัติการลงสำเร็จ</strong><span>เมื่อบันทึกผลสำเร็จ รายการจะแสดงที่นี่</span></div>}</div></section><section className="panel activity-panel"><div className="panel-title"><div><h2>บันทึกกิจกรรม</h2><p>ประวัติการเปลี่ยนแปลงที่บันทึกไว้</p></div></div><div className="activity-list">{data.activity.slice(0,30).map(a=><div className="activity-row" key={a.id}><span className="activity-icon"><ActivityIcon size={15}/></span><span>{a.detail}</span><time>{formatDate(a.timestamp)} · {formatTime(a.timestamp)}</time></div>)}</div></section></>}
        {tab==='settings'&&admin&&<div className="settings-layout"><section className="panel"><div className="panel-title"><div><h2>กำหนดจำนวนคนแบก</h2><p>จำนวนสมาชิกสูงสุดที่ตี้หนึ่งรับได้ต่อหนึ่งรันในแต่ละระดับ</p></div><Settings2 size={20} className="muted-icon"/></div><div className="capacity-list">{LEVELS.map(lv=><div className="capacity-row" key={lv}><span className={`level-icon lv-${lv}`}>0{lv}</span><span className="capacity-name"><strong>Dungeon Level {lv}</strong><small>จำนวนสูงสุดต่อหนึ่งตี้</small></span><div className="number-stepper"><button disabled={data.capacities[lv]<=1} onClick={()=>void command({type:'capacity',level:lv,capacity:data.capacities[lv]-1},'บันทึกความจุแล้ว')}>−</button><strong>{data.capacities[lv]}</strong><button disabled={data.capacities[lv]>=2} onClick={()=>void command({type:'capacity',level:lv,capacity:data.capacities[lv]+1},'บันทึกความจุแล้ว')}>+</button></div><span className="stepper-unit">คน</span></div>)}</div><div className="helper-note"><CircleHelp size={16}/> การตั้งค่านี้มีผลกับการเริ่มดันครั้งใหม่ ไม่เปลี่ยนตี้ที่กำลังดันอยู่</div></section><section className="panel"><div className="panel-title"><div><h2>จัดการรอบปัจจุบัน</h2><p>เปิด-ปิดรับคิว หรือเริ่มรอบถัดไป</p></div></div><div className="round-detail"><span>รอบที่</span><strong>#{round.number}</strong><small>เริ่ม {formatDate(round.createdAt)}</small>{badge(round.status==='open')}</div><div className="settings-buttons"><Button kind="secondary" onClick={()=>setRoundStatus(round.status==='open'?'closed':'open')} disabled={round.status==='finished'}>{round.status==='open'?<Pause size={17}/>:<Play size={17}/>} {round.status==='open'?'ปิดรับคิว':'เปิดรับคิว'}</Button><Button kind="secondary" disabled={round.status==='finished'} onClick={()=>setRoundStatus('finished')}>สิ้นสุดรอบ</Button><Button onClick={newRound}><Plus size={16}/> เปิดรอบใหม่</Button></div><div className="warning-text">เมื่อเปิดรอบใหม่ ระบบเก็บประวัติรอบเก่าไว้ และสมาชิกสามารถลงแต่ละ Lv. ใหม่ได้อีกครั้ง</div></section></div>}
        </fieldset><footer className="footer"><span>GUILD QUEUE · LOCAL EDITION</span><span>{store.pending?'กำลังบันทึก…':'บันทึกลงฐานข้อมูล · อัปเดตทุก 3 วินาที'}</span></footer>
      </main>
    </div>
    {toast&&<div role="status" className="toast"><Check size={17}/>{toast}<button aria-label="ปิดข้อความ" onClick={()=>setToast('')}><X size={16}/></button></div>}
  </div>;
}
function Stat({icon,label,value,sub,variant}:{icon:React.ReactNode,label:string,value:number,sub:string,variant:string}){return <div className="stat-card"><span className={`stat-icon ${variant}`}>{icon}</span><span className="stat-label">{label}</span><strong className="stat-value">{value.toLocaleString('th-TH')}</strong><span className="stat-sub">{sub}</span></div>}

function ReportPanel({data,roundId,level,query,setLevel,setQuery,getMember}:{
  data:AppData; roundId:string; level:'all'|Level; query:string;
  setLevel:(value:'all'|Level)=>void; setQuery:(value:string)=>void;
  getMember:(id:string)=>string;
}) {
  const rows = data.queues.filter(q => q.roundId === roundId).filter(q => q.status === 'completed').filter(q => level === 'all' || q.level === level).filter(q => {
    if (!query.trim()) return true;
    const member = data.members.find(m => m.id === q.memberId);
    return `${member?.name || ''} ${member?.className || ''}`.toLocaleLowerCase('th-TH').includes(query.trim().toLocaleLowerCase('th-TH'));
  }).sort((a,b)=>a.level-b.level||a.createdAt.localeCompare(b.createdAt)||a.order-b.order);
  const roundRows = data.queues.filter(q=>q.roundId===roundId);
  const completed = roundRows.filter(q=>q.status==='completed').length;
  const summaryRows = data.members.flatMap(member => {
    const memberRows = roundRows.filter(q=>q.memberId===member.id);
    if (!memberRows.length) return [];
    if (query.trim() && !`${member.name} ${member.className}`.toLocaleLowerCase('th-TH').includes(query.trim().toLocaleLowerCase('th-TH'))) return [];
    const done = LEVELS.filter(lv=>memberRows.some(q=>q.level===lv&&q.status==='completed'));
    return [{member, done, missing:LEVELS.filter(lv=>!done.includes(lv))}];
  });
  return <section className="report-shell">
    <div className="report-summary"><div><span>ลงสำเร็จทั้งหมด</span><strong>{completed}</strong><small>รายการ</small></div><div><span>ระดับที่ลงสำเร็จ</span><strong>{new Set(roundRows.filter(q=>q.status==='completed').map(q=>q.level)).size}</strong><small>ระดับ</small></div><div><span>ตัวละครที่ลงสำเร็จ</span><strong>{new Set(roundRows.filter(q=>q.status==='completed').map(q=>q.memberId)).size}</strong><small>คน</small></div><div><span>รอบปัจจุบัน</span><strong>#{String(data.rounds.find(r=>r.id===roundId)?.number||0).padStart(2,'0')}</strong><small>รอบ</small></div></div>
    <section className="panel report-panel report-progress-panel"><div className="panel-title"><div><h2>สรุปการลงรายตัวละคร</h2><p>เช็คได้ทันทีว่าแต่ละคนลง Dun 1–5 ครบหรือขาดระดับไหน</p></div><span className="count-label">{summaryRows.length} คน</span></div>{summaryRows.length?<div className="progress-list"><div className="progress-head"><span>ตัวละคร</span><span>สำเร็จแล้ว</span><span>ขาด</span><span>ความคืบหน้า</span></div>{summaryRows.map(({member,done,missing})=><div className="progress-row" key={member.id}><span className="report-member"><span className="tiny-avatar">{member.name.slice(0,1)}</span><span><strong>{member.name}</strong><small>{member.className}</small></span></span><span className="level-chips success-chips">{done.length?done.map(lv=><span key={lv}>Lv.{lv}</span>):<em>ยังไม่มี</em>}</span><span className="level-chips missing-chips">{missing.length?missing.map(lv=><span key={lv}>Lv.{lv}</span>):<em>ครบ 1–5</em>}</span><span className="progress-count"><strong>{done.length}/5</strong><span className="progress-bar"><i style={{width:`${done.length*20}%`}}/></span></span></div>)}</div>:<div className="empty-state">ยังไม่มีข้อมูลตัวละครในรอบนี้</div>}</section>
    <section className="panel report-panel"><div className="panel-title"><div><h2>รายชื่อผู้ลงสำเร็จ</h2><p>แสดงเฉพาะตัวละครที่จบการดันสำเร็จ พร้อม Dun ในแถวเดียว</p></div><span className="count-label">แสดง {rows.length} รายการ</span></div>
      <div className="report-filters"><label className="report-search"><Search size={16}/><input aria-label="ค้นหาชื่อตัวละครหรืออาชีพ" value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาชื่อตัวละครหรืออาชีพ…"/></label><select className="field-select" aria-label="กรองระดับ" value={level} onChange={e=>setLevel(e.target.value==='all'?'all':Number(e.target.value) as Level)}><option value="all">ทุกระดับ</option>{LEVELS.map(l=><option value={l} key={l}>Lv.{l}</option>)}</select></div>
      {rows.length?<div className="report-list"><div className="report-head report-head-success"><span>ตัวละคร</span><span>ดันเจี้ยน</span><span>อาชีพ</span><span>ลงเมื่อ</span><span>ผลลัพธ์</span></div>{rows.map((q,index)=>{const member=data.members.find(m=>m.id===q.memberId);return <div className="report-row report-row-success" key={q.id}><span className="report-member"><span className="tiny-avatar">{getMember(q.memberId).slice(0,1)}</span><strong>{getMember(q.memberId)}</strong></span><span className={`report-level lv-${q.level}`}>Dun Lv.{q.level}<small>#{String(index+1).padStart(2,'0')}</small></span><span className="report-class">{member?.className||'—'}</span><span className="report-time">{formatDate(q.createdAt)}<small>{formatTime(q.createdAt)}</small></span><Pill status={q.status}/></div>})}</div>:<div className="empty-state large-empty"><FileText size={28}/><strong>ยังไม่มีรายการลงสำเร็จ</strong><span>เมื่อบันทึกผลสำเร็จ รายการจะแสดงที่นี่</span></div>}
    </section>
  </section>;
}
