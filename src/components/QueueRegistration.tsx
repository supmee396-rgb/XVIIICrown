'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Clock3, ListOrdered, Plus, Swords, Users } from 'lucide-react';
import { LEVELS, STATUS_LABELS, formatTime } from '@/lib/data';
import { useGuildData } from '@/lib/useGuildData';
import { CHARACTER_CLASSES, normalizeCharacterName } from '@/lib/classes';
import type { Level } from '@/lib/types';

export default function QueueRegistration() {
  const { data, error, pending, mutate, refresh } = useGuildData();
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [selected, setSelected] = useState<Level[]>([]);
  const [filter, setFilter] = useState<Level>(1);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  if (!data) return <main className="loading-page"><Swords size={30}/><h1>กำลังโหลดหน้าลงคิว</h1><p role="status">{error || 'กำลังอ่านข้อมูลคิว…'}</p>{error && <button className="btn btn-secondary" onClick={()=>void refresh()}>ลองอีกครั้ง</button>}</main>;
  const round = data.rounds[data.rounds.length - 1];
  const queues = data.queues.filter(q => q.roundId === round.id).sort((a,b) => a.order - b.order);
  const chosenMember = data.members.find(m => normalizeCharacterName(m.name) === normalizeCharacterName(name));
  const memberId = chosenMember?.id;
  const mine = queues.filter(q => q.memberId === memberId);
  const joined = (lv: Level) => mine.some(q => q.level === lv);
  const availableSelection = selected.filter(lv => !joined(lv));
  const waiting = queues.filter(q => q.status === 'waiting');
  const open = round.status === 'open';
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    try {
      const updated = await mutate({ type: 'join', levels: availableSelection, name, className });
      if (!updated) return;
      setSelected([]);
      setFailed(false);
      setMessage(`ลงคิวสำเร็จ ${availableSelection.length} ระดับ บันทึกข้อมูลเรียบร้อยแล้ว`);
    } catch (cause) {
      setFailed(true);
      setMessage(cause instanceof Error ? cause.message : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองอีกครั้ง');
    }
  };

  return <div className="registration-shell">
    <header className="registration-header">
      <Link href="/queue" className="brand"><span className="brand-icon"><Swords size={22}/></span><div><strong>GUILD<span>QUEUE</span></strong><small>DUNGEON REGISTRATION</small></div></Link>
      <span className="edition-tag">2026 EDITION</span>
    </header>
    <main className="registration-content">
      <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> GUILD DUNGEON / SEASON 2026</div><h1>ลงทะเบียนเข้าคิว</h1><p>กรอกข้อมูลตัวละคร เลือกอาชีพ และเลือกระดับดันเจี้ยนที่ต้องการ</p></div></div>
      {error&&<div className="connection-error" role="alert">{error} · กำลังลองเชื่อมต่อใหม่</div>}
      <div className="registration-stats"><div><Clock3 size={18}/><span>กำลังรอคิว</span><strong>{waiting.length}<small> รายการ</small></strong></div><div><Users size={18}/><span>สมาชิกในรอบนี้</span><strong>{new Set(queues.map(q=>q.memberId)).size}<small> คน</small></strong></div><div><ListOrdered size={18}/><span>ลงได้หลายระดับ</span><strong>Lv.1–5</strong></div></div>
      <div className="two-column queue-layout">
        <section className="panel register-panel">
          <div className="panel-title"><div><h2>ลงทะเบียนเข้าคิว</h2><p>หนึ่งตัวละครลงได้ระดับละหนึ่งครั้งต่อรอบ</p></div><span className="card-icon"><Plus size={19}/></span></div>
          <form onSubmit={submit}><fieldset className="workspace-fieldset" disabled={pending || !open}>
            <div className="character-fields">
              <div><label className="field-label" htmlFor="character-name">ชื่อตัวละคร</label><input id="character-name" className="field-select" placeholder="เช่น KnightA" autoComplete="off" maxLength={60} required value={name} onChange={e=>{
                const value = e.target.value;
                setName(value); setSelected([]); setMessage('');
                const existing = data.members.find(m=>normalizeCharacterName(m.name)===normalizeCharacterName(value));
                if (existing) setClassName(CHARACTER_CLASSES.some(c=>c===existing.className)?existing.className:'');
              }}/></div>
              <div><label className="field-label" htmlFor="character-class">อาชีพ</label><select id="character-class" className="field-select" required value={className} onChange={e=>setClassName(e.target.value)}><option value="" disabled>เลือกอาชีพ</option>{CHARACTER_CLASSES.map(job=><option key={job} value={job}>{job}</option>)}</select></div>
            </div>
            <div className="field-label select-label" id="level-label">เลือกระดับดันเจี้ยน</div>
            <div className="level-choices" role="group" aria-labelledby="level-label">{LEVELS.map(lv=><button type="button" key={lv} disabled={joined(lv)} aria-pressed={availableSelection.includes(lv)} aria-label={`ระดับ ${lv}${joined(lv)?' ลงคิวแล้ว':''}`} className={`level-choice ${availableSelection.includes(lv)?'chosen':''} ${joined(lv)?'joined':''}`} onClick={()=>setSelected(prev=>prev.includes(lv)?prev.filter(x=>x!==lv):[...prev,lv])}><span>LV.{lv}</span>{joined(lv)?<Check size={17}/>:<span className="choice-checkbox">{availableSelection.includes(lv)&&<Check size={13}/>}</span>}</button>)}</div>
            <p className="hint">เลือกแล้ว {availableSelection.length} ระดับ · ลงแล้ว {mine.length}/5 ระดับ</p>
            <button type="submit" className="btn btn-primary full-btn" disabled={pending || !availableSelection.length || !name.trim() || !className}>{pending?'กำลังบันทึก…':'ยืนยันลงคิว'}<ArrowRight size={17}/></button>
          </fieldset></form>
          {!open&&<p className="form-message">{round.status==='finished'?'รอบนี้สิ้นสุดแล้ว รอเปิดรอบใหม่':'ปิดรับคิวชั่วคราว สามารถติดตามสถานะคิวได้ตามปกติ'}</p>}
          {message&&<p className={`form-message ${failed?'form-error':'form-success'}`} role={failed?'alert':'status'}>{message}</p>}
          <div className="subtle-divider"/>
          <div className="panel-title compact"><div><h2>{chosenMember?`คิวของ ${chosenMember.name}`:'คิวของคุณ'}</h2><p>รายการในรอบปัจจุบัน</p></div></div>
          <div className="my-queues">{mine.length?mine.map(q=><div className="my-queue-row" key={q.id}><span className="mini-level">Lv.{q.level}</span><span className="queue-small-meta">{q.status==='waiting'?`รออันดับ ${waiting.filter(w=>w.level===q.level).findIndex(w=>w.id===q.id)+1}`:formatTime(q.createdAt)}</span><span className={`status status-${q.status}`}>{STATUS_LABELS[q.status]}</span></div>):<div className="empty-state">{memberId?'ยังไม่ได้ลงคิวในรอบนี้':'กรอกชื่อตัวละครเพื่อลงคิวหรือดูคิวเดิม'}</div>}</div>
        </section>
        <section className="panel queue-list-panel"><div className="panel-title"><div><h2>คิวทั้งหมดในรอบนี้</h2><p>เรียงตามเวลาที่ลงทะเบียน · อัปเดตอัตโนมัติ</p></div><span className="count-label">{queues.filter(q=>q.level===filter).length} รายการ</span></div>
          <div className="tabs-level" role="group" aria-label="กรองคิวตามระดับ">{LEVELS.map(lv=><button key={lv} aria-pressed={filter===lv} className={filter===lv?'active':''} onClick={()=>setFilter(lv)}>LV.{lv}<span>{waiting.filter(q=>q.level===lv).length}</span></button>)}</div>
          <div className="queue-table viewer-table" role="table" aria-label={`รายการคิวระดับ ${filter}`}><div className="table-head" role="row"><span role="columnheader">ลำดับ</span><span role="columnheader">สมาชิก</span><span role="columnheader">ลงเมื่อ</span><span role="columnheader">สถานะ</span></div>{queues.filter(q=>q.level===filter).map((q,i)=>{const member=data.members.find(m=>m.id===q.memberId)!;return <div className={`table-row ${q.memberId===memberId?'own-queue':''}`} role="row" key={q.id}><span role="cell" className="queue-number">#{String(i+1).padStart(2,'0')}</span><span role="cell" className="player-name"><span className="tiny-avatar">{member.name.slice(0,1)}</span><span>{member.name}<small className="player-class">{member.className}</small></span></span><span role="cell" className="time-cell">{formatTime(q.createdAt)}</span><span role="cell" className={`status status-${q.status}`}>{STATUS_LABELS[q.status]}</span></div>})}</div>
          {!queues.some(q=>q.level===filter)&&<div className="empty-state large-empty"><ListOrdered size={28}/><strong>คิวนี้ยังว่างอยู่</strong><span>เลือก Lv.{filter} แล้วลงทะเบียนเป็นคนแรกได้เลย</span></div>}
          <div className="helper-note"><Clock3 size={17}/><span>สมาชิกที่กำลังดันกับตี้อื่นจะถูกข้ามชั่วคราว โดยยังรักษาลำดับคิวเดิม</span></div>
        </section>
      </div>
      <footer className="footer"><span>GUILD QUEUE · LOCAL EDITION</span><span>ข้อมูลบันทึกอัตโนมัติ · อัปเดตคิวทุก 3 วินาที</span></footer>
    </main>
  </div>;
}
