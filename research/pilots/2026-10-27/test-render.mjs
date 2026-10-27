import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
class Element {
  constructor(tag) { this.tagName=tag; this.children=[]; this.listeners={}; this.value=''; this.checked=false; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children=nodes; }
  addEventListener(type, fn) { this.listeners[type]=fn; }
  querySelectorAll() { return []; }
}
const ids=['#query','#source','#sort','#unique','#reset','#filters','#results','#status','#unique-count','#observation-count'];
const nodes=new Map(ids.map(id=>[id,new Element('div')]));
nodes.get('#sort').value='price-asc'; nodes.get('#unique').checked=true;
globalThis.document={querySelector:id=>nodes.get(id),createElement:tag=>new Element(tag)};
globalThis.fetch=async file=>({ok:true,json:async()=>JSON.parse(await readFile(new URL(file,import.meta.url),'utf8'))});
await import('./view.mjs');
const count=()=>nodes.get('#results').children.length;
assert.equal(count(),119);
assert.equal(nodes.get('#unique-count').textContent,119);
nodes.get('#source').value='olx'; nodes.get('#source').listeners.change(); assert.equal(count(),50);
nodes.get('#source').value='enjoei'; nodes.get('#source').listeners.change(); assert.equal(count(),69);
nodes.get('#unique').checked=false; nodes.get('#unique').listeners.change(); assert.equal(count(),70);
nodes.get('#query').value='no-such-game-991'; nodes.get('#query').listeners.input();
assert.equal(count(),1); assert.equal(nodes.get('#results').children[0].className,'empty');
nodes.get('#reset').listeners.click(); assert.equal(count(),119);
nodes.get('#reset').listeners.click(); assert.equal(count(),119);
function all(node){return [node,...node.children.flatMap(all)];}
const rendered=all(nodes.get('#results'));
assert(rendered.filter(n=>n.tagName==='a').every(n=>n.target==='_blank'&&n.rel==='noopener noreferrer'));
assert(rendered.some(n=>String(n.textContent).includes('2 captured occurrences')));
assert(rendered.some(n=>String(n.textContent).includes('unverified')));
assert(rendered.every(n=>n.innerHTML===undefined));
console.log('PASS: render count, source controls, duplicate toggle, empty search, repeated reset, safe links and text-only rendering. Not a browser/visual test.');
