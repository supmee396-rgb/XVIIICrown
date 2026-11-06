import type { Level } from './types';

export const PARTY_LEVELS: Record<string, Level[]> = {
  'party-a': [1, 2],
  'party-b': [3, 4, 5],
  'party-c': [1, 2, 3, 4, 5],
};

export const PARTY_NAMES: Record<string, string> = {
  'party-a': 'Dun 1-2',
  'party-b': 'Dun 3-5',
  'party-c': 'Dun 1-5',
};

export function levelsForParty(partyId: string): Level[] {
  return PARTY_LEVELS[partyId] ?? [1, 2, 3, 4, 5];
}

export function partyName(partyId: string): string {
  return PARTY_NAMES[partyId] ?? 'Dun 1-5';
}
