import type { Level, QueueStatus } from './types';

export const LEVELS: Level[] = [1,2,3,4,5];
export const STATUS_LABELS: Record<QueueStatus,string> = {
  waiting:'รอคิว', called:'เรียกแล้ว', in_progress:'กำลังดัน', completed:'สำเร็จ',
  failed:'ไม่สำเร็จ', paused:'พักคิว', cancelled:'ยกเลิก'
};
export function formatTime(iso:string) { return new Date(iso).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}); }
export function formatDate(iso:string) { return new Date(iso).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}); }
