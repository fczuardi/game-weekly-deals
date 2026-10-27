import assert from 'node:assert/strict';
import { gameKey, classify } from './rank-crawl-shortlist.mjs';

assert.equal(
  gameKey('Jogo Dishonored - PS3 Mídia Física Original', 'PS3'),
  gameKey('Dishonored Ps3 (usado)', 'PS3')
);
assert.notEqual(gameKey('Dishonored PS3', 'PS3'), gameKey('Dishonored PS4', 'PS4'));
assert.deepEqual(classify('Destiny PS4 só joga online').exclusions, ['online_only']);
assert(classify('Controle joystick PS4').exclusions.includes('accessory_or_hardware'));
assert(classify('Jogo com avaria e sem caixa').warnings.includes('damaged'));
assert(classify('Jogo com avaria e sem caixa').warnings.includes('disc_only_or_incomplete'));

console.log('Crawl shortlist title normalization and classification passed.');
