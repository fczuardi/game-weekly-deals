// Dependency-free rendering smoke test. This is not a visual browser test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
class Element {
 constructor(tag,text=''){this.tagName=tag;this.textContent=text;this.children=[];this.listeners={}}
 append(...nodes){this.children.push(...nodes)}
 replaceChildren(...nodes){this.children=nodes}
 addEventListener(event,callback){this.listeners[event]=callback}
 remove(){this.removed=true}
}
const elements=new Map(['#current-content','#current-date','#archive-content','#game-filter','#history-content','#loading','#research-log-content'].map(id=>[id,new Element('div')]));
const document={createElement:tag=>new Element(tag),createTextNode:text=>new Element('#text',text),querySelector:id=>elements.get(id)};
const data=JSON.parse(readFileSync(new URL('../data/observations.json',import.meta.url),'utf8'));
const weekly=JSON.parse(readFileSync(new URL('../data/weeks.json',import.meta.url),'utf8'));
// Same observation referenced in three weeks: IDs must remain unique.
weekly.weeks.push({...weekly.weeks[0],id:'2026-10-23',milestoneOn:'2026-10-23'}, {...weekly.weeks[0],id:'2026-10-16',milestoneOn:'2026-10-16'});
const errors=[];runInNewContext(readFileSync(new URL('../app.js',import.meta.url),'utf8'),{document,location:{href:'https://example.test/game-weekly-deals/'},URL,Intl,Date,Map,console:{error:e=>errors.push(e)},fetch:async url=>({ok:true,json:async()=>url.includes('observations')?data:url.includes('weeks')?weekly:JSON.parse(readFileSync(new URL('../data/research-log.json',import.meta.url),'utf8'))})});
await new Promise(resolve=>setTimeout(resolve,0));
assert.deepEqual(errors,[]);assert(elements.get('#loading').removed);
const all=[];function walk(n){all.push(n);n.children.forEach(walk)}elements.forEach(walk);
const ids=all.filter(n=>n.id).map(n=>n.id);assert.equal(ids.length,3);assert.equal(ids.length,new Set(ids).size,'Repeated observation IDs collide');
const anchorLinks=all.filter(n=>n.tagName==='a'&&n.href.includes('#observation-'));assert.equal(anchorLinks.length,3);anchorLinks.forEach(n=>assert(ids.includes(new URL(n.href).hash.slice(1)),'Broken observation anchor'));
assert.equal(all.filter(n=>n.tagName==='h3'&&n.textContent==='Everybody’s Golf').length,3);
assert(all.some(n=>n.textContent==='NOT CHECKOUT-VERIFIED'));
assert(!all.some(n=>n.innerHTML),'Rendering should use textContent, not HTML interpolation');
console.log('Passed dependency-free render smoke test, including repeated observation across three weeks and archive links. Not a visual/browser test.');
