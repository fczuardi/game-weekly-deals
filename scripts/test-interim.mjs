import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html'),log=JSON.parse(read('data/research-log.json'));
assert(html.includes('Captured item price'));
assert(html.includes('not current availability or verified delivered totals'));
assert(html.includes('30 October'));
for(const id of ['MLBU5159547758','MLBU5342543821','1547795286','1547794916','MLBU3155338607'])assert(html.includes(id));
for(const label of ['2,806','2,506','297','119','R$54.99','R$39.00'])assert(html.includes(label));
assert.equal((html.match(/Free-shipping badge in capture only/g)||[]).length,3);
assert(html.indexOf('id="interim"')<html.indexOf('id="current"'));
assert.equal(log.schemaVersion,1);
const ids=new Set();for(const run of log.runs){assert(!ids.has(run.id));ids.add(run.id);assert(!Number.isNaN(Date.parse(run.reviewedAt)));for(const field of ['checked','decisions','limitations','next'])assert(Array.isArray(run[field])&&run[field].length);}
const obs=JSON.parse(read('data/observations.json')).observations;
assert.equal(obs[0].quotedTotalCents,5814);assert.equal(obs[0].observedOn,'2026-10-27');
assert.equal(JSON.parse(read('data/weeks.json')).weeks[0].winnerObservationId,null);
assert(!/\b\d{5}-\d{3}\b|jailbreak/i.test(html+JSON.stringify(log)));
console.log('Passed interim queue, source links, capture labels, run log, preserved quote, pending winner and privacy checks.');
