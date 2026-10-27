import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gameKey, classify, normalizedGameTitle, titleMatch } from './rank-crawl-shortlist.mjs';

assert.equal(
  gameKey('Jogo Dishonored - PS3 Mídia Física Original', 'PS3'),
  gameKey('Dishonored Ps3 (usado)', 'PS3')
);
assert.notEqual(gameKey('Dishonored PS3', 'PS3'), gameKey('Dishonored PS4', 'PS4'));
assert.equal(normalizedGameTitle('Jogo Returnal Standard Edition Mídia Física PS5 Sony'), 'returnal');
assert.equal(normalizedGameTitle("Uncharted 3 Drake's Deception PS3"), 'uncharted 3 drakes deception');
assert.equal(gameKey('Play 3 Ps3 Fifa Soccer 12 Midia Física', 'PS3'), gameKey('Fifa 12 Mídia Física Original Playstation 3', 'PS3'));
assert.equal(gameKey('Fifa 12 Ps3 Mídia Física Sony Jogo Esportes Ea Sports 2011', 'PS3'), gameKey('Fifa 12 Mídia Física Original Playstation 3', 'PS3'));
assert.equal(gameKey('Fifa Soccer 12 2012 PS3', 'PS3'), gameKey('Fifa 12 PS3', 'PS3'));
assert.equal(gameKey('Fifa Soccer 2011 Fifa 11 PS3', 'PS3'), gameKey('Fifa 11 PS3', 'PS3'));
assert.notEqual(gameKey('Fifa Soccer 12 PS3', 'PS3'), gameKey('Fifa Soccer 13 PS3', 'PS3'));
assert.equal(gameKey('Jogo Ps3 Pes 2012 Mídia Física', 'PS3'), gameKey('Pro Evolution Soccer 2012 (mídia Física) - Ps3', 'PS3'));
assert.equal(gameKey('Pro Evolution Soccer 2012 PES 12 PS3', 'PS3'), gameKey('PES 2012 PS3', 'PS3'));
assert.notEqual(gameKey('PES 2012 PS3', 'PS3'), gameKey('PES 2013 PS3', 'PS3'));
assert(titleMatch('Uncharted 3', "Uncharted 3 Drake's Deception").matches);
assert(titleMatch('Uncharted 3', "Uncharted 3 Drake's Deception").method === 'title_containment');
assert(!titleMatch('Call of Duty Black Ops', 'Call of Duty Black Ops 3').matches);
assert(!titleMatch('Fifa 13', 'Fifa 16').matches);
assert(!titleMatch('Fifa 2014', 'Copa Do Mundo Fifa 2014').matches);
assert(!titleMatch('Need for Speed', 'Need for Speed Shift').matches);
assert(!titleMatch('God of War', 'God of War Ascension').matches);
assert(titleMatch('Uncharted 3 Drakes Deception', 'Uncharted 3 Drake Deception').matches);
assert.deepEqual(classify('Destiny PS4 só joga online').exclusions, ['online_only']);
assert(classify('Controle joystick PS4').exclusions.includes('accessory_or_hardware'));
assert(classify('Pes 2010 sem o jogo, só a caixa').exclusions.includes('empty_case'));
assert(classify('Jogo com avaria e sem caixa').warnings.includes('damaged'));
assert(classify('Jogo com avaria e sem caixa').warnings.includes('disc_only_or_incomplete'));
const shortlist = JSON.parse(readFileSync(new URL('../crawl/processed/mercadolivre-shortlist.json', import.meta.url)));
const returnal = shortlist.candidates.find(candidate => candidate.gameKey === 'PS5:returnal');
assert.equal(returnal.selectionMethod, 'manual_override');
assert.equal(returnal.identityLevel, 'catalog_product');
assert.equal(returnal.url, 'https://www.mercadolivre.com.br/returnal-ps5-original-usado/up/MLBU5342543821');
assert.equal(returnal.automaticCheapestOffer.priceCents, 4990);
assert.equal(returnal.comparableOffers.length, 6);
assert(returnal.titleMatching.methods.includes('normalized_exact'));
const sportsChampions = shortlist.candidates.find(candidate => candidate.gameKey === 'PS3:sports-champions');
assert.equal(sportsChampions.comparableOffers.length, 41);
assert(sportsChampions.titleMatching.methods.includes('manual_alias'));
assert(!shortlist.candidates.some(candidate => candidate.gameKey.startsWith('PS3:sports-champions-') && candidate.gameKey !== 'PS3:sports-champions-2'));
const medievalMoves = shortlist.candidates.find(candidate => candidate.gameKey === 'PS3:medieval-moves-deadmunds-quest');
assert.equal(medievalMoves.comparableOffers.length, 13);
assert(!shortlist.candidates.some(candidate => candidate.gameKey.startsWith('PS3:medieval-moves-') && candidate.gameKey !== 'PS3:medieval-moves-deadmunds-quest'));

console.log('Crawl shortlist title normalization and classification passed.');
