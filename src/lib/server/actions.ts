import { randomUUID } from 'node:crypto';
import { STATUS_LABELS } from '../data';
import { CHARACTER_CLASSES, normalizeCharacterName } from '../classes';
import { levelsForParty, partyName } from '../parties';
import type { Level, QueueStatus } from '../types';
import { transact } from './store';

export class InputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function ensure(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new InputError(message, status);
}
function text(value: unknown, label: string, max = 60): string {
  ensure(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, `${label}ต้องมี 1–${max} ตัวอักษร`);
  return value.trim().normalize('NFC');
}
function level(value: unknown): Level {
  ensure(typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5, 'ระดับต้องอยู่ระหว่าง 1–5');
  return value as Level;
}

export function executeCommand(input: unknown) {
  ensure(input && typeof input === 'object' && !Array.isArray(input), 'ข้อมูลคำสั่งไม่ถูกต้อง');
  const command = input as Record<string, unknown>;
  return transact(data => {
    const round = data.rounds[data.rounds.length - 1];
    ensure(command.roundId === round.id, 'รอบเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุดแล้วลองอีกครั้ง', 409);
    const queues = data.queues.filter(q => q.roundId === round.id);
    const running = data.runs.filter(r => r.status === 'in_progress');
    const now = new Date().toISOString();
    const name = (id: string) => data.members.find(m => m.id === id)!.name;
    const log = (detail: string) => data.activity.unshift({ id: randomUUID(), timestamp: now, detail });

    switch (command.type) {
      case 'join': {
        ensure(round.status === 'open', 'รอบนี้ปิดรับคิวแล้ว', 409);
        ensure(Array.isArray(command.levels) && command.levels.length > 0 && command.levels.length <= 5, 'กรุณาเลือกอย่างน้อย 1 ระดับ');
        const levels = [...new Set(command.levels.map(level))];
        let member = data.members.find(m => m.id === command.memberId);
        if (command.memberId !== undefined) {
          ensure(member, 'ไม่พบสมาชิกที่เลือก', 404);
        } else {
          const memberName = text(command.name, 'ชื่อตัวละคร');
          const className = text(command.className, 'อาชีพ', 40);
          ensure(CHARACTER_CLASSES.some(job => job === className), 'กรุณาเลือกอาชีพจากรายการ');
          member = data.members.find(m => normalizeCharacterName(m.name) === normalizeCharacterName(memberName));
          if (member) {
            member.className = className;
          } else {
            member = { id: randomUUID(), name: memberName, className };
            data.members.push(member);
          }
        }
        ensure(member, 'ไม่พบสมาชิก');
        ensure(!levels.some(lv => queues.some(q => q.memberId === member.id && q.level === lv)), 'มีระดับที่ลงคิวแล้ว กรุณาโหลดข้อมูลล่าสุดแล้วเลือกใหม่', 409);
        for (const lv of levels) data.queues.push({ id: randomUUID(), roundId: round.id, memberId: member.id, level: lv, status: 'waiting', createdAt: now, order: data.queues.length + 1 });
        log(`${member.name} ลงคิว ${levels.map(lv => `Lv.${lv}`).join(', ')}`);
        break;
      }
      case 'queue-status': {
        ensure(round.status !== 'finished', 'รอบนี้สิ้นสุดแล้ว', 409);
        const item = queues.find(q => q.id === command.id);
        ensure(item, 'ไม่พบคิวในรอบปัจจุบัน', 404);
        ensure(item.status !== 'in_progress', 'ต้องบันทึกผลจากหน้าจัดการตี้ก่อน', 409);
        ensure(['waiting', 'paused', 'cancelled', 'failed', 'completed'].includes(String(command.status)), 'สถานะไม่ถูกต้อง');
        const status = command.status as QueueStatus;
        log(`${name(item.memberId)} Lv.${item.level}: ${STATUS_LABELS[item.status]} → ${STATUS_LABELS[status]}`);
        item.status = status;
        // Retried queues must no longer belong to their previous run.
        delete item.partyRunId;
        break;
      }
      case 'start-run': {
        ensure(round.status !== 'finished', 'รอบนี้สิ้นสุดแล้ว', 409);
        const party = data.parties.find(p => p.id === command.partyId);
        ensure(party, 'ไม่พบตี้', 404);
        ensure(!running.some(r => r.partyId === party.id), 'ตี้นี้กำลังดันอยู่', 409);
        const lv = level(command.level);
        ensure(levelsForParty(party.id).includes(lv), `${partyName(party.id)} รองรับเฉพาะ Lv.${levelsForParty(party.id).join(', ')} เท่านั้น`, 409);
        ensure(Array.isArray(command.queueIds) && command.queueIds.length > 0 && command.queueIds.length <= data.capacities[lv], 'จำนวนสมาชิกไม่ตรงกับความจุของระดับนี้');
        const ids = command.queueIds;
        ensure(new Set(ids).size === ids.length, 'มีคิวซ้ำ');
        const selected = ids.map(id => queues.find(q => q.id === id));
        const busy = new Set(running.flatMap(r => r.memberIds));
        ensure(selected.every(q => q && q.level === lv && q.status === 'waiting' && !busy.has(q.memberId)), 'คิวเปลี่ยนหรือสมาชิกกำลังดันกับตี้อื่น กรุณาเลือกใหม่', 409);
        const members = selected.map(q => q!.memberId);
        ensure(new Set(members).size === members.length, 'มีสมาชิกซ้ำ');
        const id = randomUUID();
        data.runs.push({ id, roundId: round.id, partyId: party.id, level: lv, memberIds: members, status: 'in_progress', startedAt: now });
        selected.forEach(q => { q!.status = 'in_progress'; q!.partyRunId = id; });
        log(`${partyName(party.id)} เริ่ม Lv.${lv} กับ ${members.map(name).join(', ')}`);
        break;
      }
      case 'finish-run': {
        ensure(typeof command.success === 'boolean', 'ผลการดันไม่ถูกต้อง');
        const run = running.find(r => r.id === command.runId && r.roundId === round.id);
        ensure(run, 'รันนี้จบแล้วหรือไม่พบข้อมูล กรุณาโหลดข้อมูลล่าสุด', 409);
        run.status = command.success ? 'completed' : 'failed';
        run.endedAt = now;
        data.queues.filter(q => q.partyRunId === run.id).forEach(q => { q.status = run.status; });
        log(`${data.parties.find(p => p.id === run.partyId)!.name} Lv.${run.level}: ${command.success ? 'สำเร็จ' : 'ไม่สำเร็จ'}`);
        break;
      }
      case 'round-status': {
        ensure(round.status !== 'finished', 'รอบนี้สิ้นสุดแล้ว ให้เปิดรอบใหม่', 409);
        ensure(['open', 'closed', 'finished'].includes(String(command.status)), 'สถานะรอบไม่ถูกต้อง');
        ensure(command.status !== 'finished' || !running.length, 'ต้องปิดผลตี้ที่กำลังดันก่อนสิ้นสุดรอบ', 409);
        round.status = command.status as typeof round.status;
        log(`ปรับสถานะรอบ ${round.number}: ${round.status}`);
        break;
      }
      case 'new-round': {
        ensure(!running.length, 'ต้องปิดผลตี้ที่กำลังดันก่อนเปิดรอบใหม่', 409);
        round.status = 'finished';
        const number = round.number + 1;
        data.rounds.push({ id: randomUUID(), number, label: 'รอบใหม่', status: 'open', createdAt: now });
        log(`เปิดรับคิวรอบที่ ${number}`);
        break;
      }
      case 'capacity': {
        const lv = level(command.level);
        ensure(command.capacity === 1 || command.capacity === 2, 'จำนวนสมาชิกต้องเป็น 1 หรือ 2 คน');
        data.capacities[lv] = command.capacity;
        log(`ปรับความจุ Lv.${lv} เป็น ${command.capacity} คน`);
        break;
      }
      default: throw new InputError('ไม่รู้จักคำสั่งนี้');
    }
  });
}
