export type Level = 1 | 2 | 3 | 4 | 5;
export type QueueStatus = 'waiting' | 'called' | 'in_progress' | 'completed' | 'failed' | 'paused' | 'cancelled';
export type RoundStatus = 'open' | 'closed' | 'finished';
export interface Member { id: string; name: string; className: string; }
export interface Round { id: string; number: number; label: string; status: RoundStatus; createdAt: string; }
export interface QueueEntry { id: string; roundId: string; memberId: string; level: Level; status: QueueStatus; createdAt: string; order: number; partyRunId?: string; }
export interface Party { id: string; name: string; leader: string; color: string; }
export interface PartyRun { id: string; roundId: string; partyId: string; level: Level; memberIds: string[]; status: 'in_progress' | 'completed' | 'failed'; startedAt: string; endedAt?: string; }
export interface Activity { id: string; timestamp: string; detail: string; }
export interface AppData { members: Member[]; rounds: Round[]; queues: QueueEntry[]; parties: Party[]; runs: PartyRun[]; capacities: Record<Level, number>; activity: Activity[]; }
