import { WebSocket } from 'ws';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const list=await (await fetch('http://localhost:9222/json/list')).json();
const page=list.find(t=>t.type==='page'&&t.url.includes('editor/index.html'));
const ws=new WebSocket(page.webSocketDebuggerUrl,{maxPayload:256*1024*1024});
await new Promise(r=>ws.once('open',r));
let id=0;const pending=new Map();
ws.on('message',d=>{const m=JSON.parse(d);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
const send=(m,p)=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}));});
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});return r.result?.result?.value;};
await send('Runtime.enable');
const already=await ev(`document.querySelectorAll('[data-test$="-panel"]').length`);
if(already<5){
  const pos=await ev(`(()=>{const cs=Array.from(document.querySelectorAll('[data-test=launcher-project-card]'));const c=cs.find(x=>x.innerText.startsWith('Shine Phase 2'))||cs[0];const r=c.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
  console.log('opening card at',pos);
  for(const cc of [1,2]){await send('Input.dispatchMouseEvent',{type:'mousePressed',x:pos.x,y:pos.y,button:'left',clickCount:cc});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:pos.x,y:pos.y,button:'left',clickCount:cc});}
  await sleep(14000);
}
console.log(await ev(`JSON.stringify({rail:document.querySelectorAll('[data-test$="-panel"]').length,title:document.body.innerText.slice(0,40)})`));
ws.close();
