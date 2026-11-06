export const CHARACTER_CLASSES = [
  'Knight', 'Crusader', 'Wizard', 'Sage', 'Hunter', 'Bard', 'Dancer',
  'Priest', 'Monk', 'Assassin', 'Rogue', 'Blacksmith', 'Alchemist', 'Rebel', 'คานอส',
] as const;

export function normalizeCharacterName(name: string) {
  return name.trim().normalize('NFC').toLocaleLowerCase('en-US');
}
