'use strict';

const money = cents => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const el = (tag,className,text) => { const node=document.createElement(tag); if(className)node.className=className;if(text!==undefined)node.textContent=text;return node; };
const state={candidates:[]};

function pill(text,className=''){return el('span',`pill ${className}`,text)}
function fact(label,value){const root=el('div');root.append(el('span','',label),el('strong','',value));return root}
function offerRow(offer,index){
  const row=el('li','offer-row'),copy=el('div'),name=el('strong','',offer.title),note=el('span','');
  note.textContent=offer.shippingStatus==='free_shown'?`${money(offer.priceCents)} · free shipping shown`:`${money(offer.priceCents)} · fits if shipping ≤ ${money(offer.maximumAffordableShippingCents)}`;
  copy.append(name,note);const link=el('a','','Open ↗');link.href=offer.url;link.target='_blank';link.rel='noopener noreferrer';
  row.append(el('b','offer-number',String(index+1)),copy,link);return row;
}
function card(candidate){
  const root=el('article','candidate');
  root.append(el('div','rank',`#${candidate.rank}`));
  const body=el('div','candidate-body'),meta=el('div','meta');
  meta.append(pill(candidate.platform||'Unknown','platform'),pill(`${candidate.comparableOfferCount} comparables`));
  if(candidate.titleMatching?.methods.some(method=>method!=='normalized_exact'))meta.append(pill('Fuzzy title group','conditional'));
  if(candidate.selectionMethod==='manual_override')meta.append(pill('Manual pick','manual'));
  if(candidate.shippingStatus!=='free_shown')meta.append(pill('Shipping unknown','conditional'));
  candidate.warnings.forEach(warning=>meta.append(pill(warning.replaceAll('_',' '),'conditional')));
  body.append(meta,el('h3','',candidate.title));
  if(candidate.manualSelection)body.append(el('p','manual-reason',candidate.manualSelection.reason));
  const numbers=el('div','numbers');
  numbers.append(fact('Listing',money(candidate.priceCents)),fact('Group median',money(candidate.medianComparablePriceCents)),fact('Below median',`${money(candidate.savingsVsMedianCents)} · ${candidate.discountVsMedianPercent}%`));
  body.append(numbers);
  const shipping=candidate.shippingStatus==='free_shown'?'Free shipping shown; item is within the R$70 ceiling.':`Potential fit if shipping is ${money(candidate.maximumAffordableShippingCents)} or less.`;
  body.append(el('p','shipping-note',shipping));
  if(candidate.freeShippingAlternative&&candidate.freeShippingAlternative.url!==candidate.url){
    body.append(el('p','shipping-note alternative',`Free-shipping alternative observed at ${money(candidate.freeShippingAlternative.priceCents)}.`));
  }
  const link=el('a','primary-link',candidate.selectionMethod==='manual_override'?'Inspect manually selected listing ↗':'Inspect cheapest listing ↗');link.href=candidate.url;link.target='_blank';link.rel='noopener noreferrer';body.append(link);
  const details=el('details','offers'),summary=el('summary','',`Compare all ${candidate.comparableOffers.length} observed offers`),list=el('ol');
  candidate.comparableOffers.forEach((offer,index)=>list.append(offerRow(offer,index)));details.append(summary,list);body.append(details);root.append(body);return root;
}

function render(){
  const query=document.querySelector('#search').value.trim().toLocaleLowerCase('pt-BR');
  const platform=document.querySelector('#platform').value,shipping=document.querySelector('#shipping').value;
  const clean=document.querySelector('#clean-only').checked,sort=document.querySelector('#sort').value;
  const rows=state.candidates.filter(item=>(!query||`${item.title} ${item.platform}`.toLocaleLowerCase('pt-BR').includes(query))&&(!platform||item.platform===platform)&&(!shipping||item.shippingStatus===shipping)&&(!clean||item.warnings.length===0));
  const sorts={rank:(a,b)=>a.rank-b.rank,price:(a,b)=>a.priceCents-b.priceCents,discount:(a,b)=>b.discountVsMedianPercent-a.discountVsMedianPercent,comparables:(a,b)=>b.comparableOfferCount-a.comparableOfferCount,headroom:(a,b)=>b.maximumAffordableShippingCents-a.maximumAffordableShippingCents};
  rows.sort(sorts[sort]);document.querySelector('#visible-count').textContent=rows.length.toLocaleString('en-US');
  const list=document.querySelector('#candidate-list');list.replaceChildren(...rows.map(card));document.querySelector('#empty').hidden=rows.length!==0;
}

async function start(){
  const response=await fetch('mercadolivre-shortlist.json');if(!response.ok)throw new Error('Shortlist unavailable');const data=await response.json();state.candidates=data.candidates;
  document.querySelector('#stat-indexed').textContent=data.stats.indexedListings.toLocaleString('en-US');
  document.querySelector('#stat-eligible').textContent=data.stats.eligibleListings.toLocaleString('en-US');
  document.querySelector('#stat-groups').textContent=data.stats.comparableGameGroups.toLocaleString('en-US');
  document.querySelector('#stat-shipping').textContent=data.stats.eligibleWithShippingToVerify.toLocaleString('en-US');
  document.querySelector('#capture-date').textContent=`Captured through ${new Date(data.builtFromCaptureThrough).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}`;
  const select=document.querySelector('#platform');[...new Set(data.candidates.map(x=>x.platform).filter(Boolean))].sort().forEach(value=>{const option=el('option','',value);option.value=value;select.append(option)});
  document.querySelectorAll('input,select').forEach(control=>control.addEventListener('input',render));render();
}
start().catch(error=>{console.error(error);document.querySelector('#error').hidden=false});
