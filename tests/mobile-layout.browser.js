/* tools/check_mobile_layout.py로 생성한 검수 HTML에서 실행하는 실제 브라우저 검사.
   프레임의 CSS viewport를 사용하므로 데스크톱 창 크기와 독립적으로 재현한다. */
const frame=document.getElementById('frame'),output=document.getElementById('output'),status=document.getElementById('status'),pick=document.getElementById('pick');
let results=[];
for(const id of Object.keys(pages))pick.add(new Option(id,id));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function load(id,w=390,h=664,large=false,dark=false,mode=''){
 frame.width=w;frame.height=h;
 await new Promise(r=>{frame.onload=r;frame.srcdoc=pages[id]});
 const d=frame.contentDocument;d.documentElement.classList.toggle('large-text',large);d.documentElement.dataset.theme=dark?'dark':'light';
 if(mode==='continue')d.querySelector('#start-screen')?.classList.add('has-continue');
 if(mode==='done')d.querySelector('#hero')?.classList.add('no-daily');
 await wait(260);return d;
}
function check(ok,message){if(!ok)throw Error(message)}
const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};
function measure(d){const win=d.defaultView;return {width:win.innerWidth,height:win.innerHeight,documentHeight:d.documentElement.scrollHeight,documentWidth:d.documentElement.scrollWidth};}
function art(svg){const b=svg.getBBox(),m=svg.getScreenCTM();return {width:+(b.width*m.a).toFixed(1),height:+(b.height*m.d).toFixed(1)};}
async function run(){
 results=[];output.textContent='';document.getElementById('run').disabled=true;
 const ids=Object.keys(pages).filter(id=>!id.startsWith('match-')&&!id.startsWith('timing-'));
 const cases=[];
 for(const [w,h,large,dark] of [[390,664,false,false],[360,600,false,false],[390,664,true,true],[360,600,true,true]]){
 for(const id of ids)cases.push({id,w,h,large,dark});
 for(const id of Object.keys(pages).filter(id=>id.startsWith('match-')))cases.push({id,w,h,large,dark});
 }
 for(const id of ids.filter(x=>x!=='hub'))for(const mode of ['continue','done'])cases.push({id,w:390,h:664,large:true,dark:true,mode});
 for(const id of Object.keys(pages).filter(id=>id.startsWith('timing-')))cases.push({id,w:390,h:664,large:false,dark:false});
 for(const c of cases.filter(c=>(!location.search.includes('matches')||c.id.startsWith('match-'))&&(!location.search.includes('timing')||c.id.startsWith('timing-')))){
 const {id,w,h,large,dark,mode}=c,label=`${id} ${w}×${h}${large?' 큰글씨':''}${dark?' 다크':''}${mode?' '+mode:''}`;let row={...c};
 try{
 const d=await load(id,w,h,large,dark,mode);Object.assign(row,measure(d));
 if(row.documentWidth>w)row.overflow=[...d.querySelectorAll('main:not([hidden]) *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>w}).slice(0,8).map(e=>({tag:e.tagName,id:e.id,cls:typeof e.className==='string'?e.className:'svg',...rect(e)}));
 check(row.documentWidth<=w,`가로 넘침 ${row.documentWidth}`);
 if(id.startsWith('timing-')){
 await wait(5100);row.timeline=d.defaultView.auditTimeline;
 const line=row.timeline,first=line.find(f=>f.thinking.includes('생각 중'));check(first,'생각 중 누락');
 if(id==='timing-cpu'){for(const [kind,min] of [['play',600],['reveal',1000],['place',600],['capture',600]]){const i=line.findIndex(f=>f.kind===kind);check(i>=0&&line[i].visible,kind+' 표시 누락');check(line[i+1]&&line[i+1].time-line[i].time>=min-20,kind+' 표시 시간 부족');}}
 else{const i=line.findIndex(f=>f.kind==='speech');check(i>=0&&line[i].visible,'말풍선 안 보임');check(line[i].text===(id==='timing-go'?'고!':'스톱!'),'말풍선 문구');check(line[i+1]&&line[i+1].time-line[i].time>=980,'말풍선 1초 미만');}
 }else if(id.startsWith('match-')){
 check(row.documentHeight<=h,`문서 높이 ${row.documentHeight} > ${h}`);
 for(const selector of ['#cpu-seat','#cpu-captured','#table','#my-captured','#hand','#play-btn','.bottom-controls']){
 const r=rect(d.querySelector(selector));check(r.y>=0&&r.bottom<=h+0.5,`${selector} 화면 밖 ${JSON.stringify(r)}`);}
 const cards=[...d.querySelectorAll('#hand .hwatu')];row.handCount=cards.length;
 for(const card of cards){const r=rect(card);check(r.right<=w&&r.bottom<=h,'손패 화면 밖');}
 for(const selector of ['#choice-panel','#decision-panel']){const e=d.querySelector(selector);if(!e.hidden){const r=rect(e),ground=rect(d.querySelector('.ground'));row.dialog={selector,...r};check(r.y>=0&&r.y<ground.bottom&&r.bottom>ground.y&&r.bottom<=h,'선택 창이 화면 밖이거나 바닥패와 떨어짐');check(d.elementFromPoint(r.x+r.width/2,r.y+12)?.closest(selector),'선택 창이 가려짐');}}
 if(id==='match-initial')check(cards.length===10,'첫 손패 10장');
 }else if(id==='hub'){
 row.art=[...d.querySelectorAll('.thumb svg')].map(svg=>({id:svg.parentElement.className,...art(svg)}));
 for(const svg of d.querySelectorAll('.thumb svg')){const r=rect(svg),a=art(svg);check(a.width>=r.width*.75||a.height>=r.height*.85,'홈 그림이 칸을 채우지 않음');}
 }else{
 const svg=d.querySelector('.st-preview svg');row.art=art(svg);row.area=rect(svg.parentElement);
 check(row.art.width>=w*.71,'시작 그림 폭 부족 '+row.art.width);
 if(['sudoku','2048','go','reversi'].includes(id)&&w===390)check(row.art.width>=280&&row.art.height>=280,'정사각 그림 280px 미만');
 const v=svg.viewBox.baseVal,b=svg.getBBox();check(b.x>=v.x-.1&&b.y>=v.y-.1&&b.x+b.width<=v.x+v.width+.1&&b.y+b.height<=v.y+v.height+.1,'그림 잘림');
 const daily=d.querySelector('#daily-btn'),start=d.querySelector('#start-btn');if(daily&&!daily.hidden)check(rect(daily).bottom<=rect(start).y,'도전→시작 순서');
 }
 row.pass=true;
 }catch(e){row.pass=false;row.error=e.message;}
 results.push(row);status.textContent=`${results.length}/${cases.length} · 실패 ${results.filter(r=>!r.pass).length}`;
 output.textContent+=(row.pass?'PASS ':'FAIL ')+label+' '+(row.error||JSON.stringify(row.art||{height:row.documentHeight,hand:row.handCount,dialog:row.dialog}))+'\n';output.scrollTop=output.scrollHeight;
 }
 status.textContent=`완료 ${results.length}건 · 통과 ${results.filter(r=>r.pass).length} · 실패 ${results.filter(r=>!r.pass).length}`;
 output.textContent=results.filter(r=>!r.pass).map(r=>JSON.stringify(r)).join('\n')+'\n'+results.filter(r=>r.w===390&&!r.large&&!r.mode).map(r=>`${r.id}: ${JSON.stringify(r.art||{height:r.documentHeight,hand:r.handCount,dialog:r.dialog})}`).join('\n');
 document.getElementById('run').disabled=false;await load('match-initial');
 output.replaceChildren(...results.filter(r=>!r.pass).map(r=>{const p=document.createElement('p');p.textContent=JSON.stringify(r);return p}));
 for(const r of results.filter(r=>r.w===390&&!r.large&&!r.mode)){const p=document.createElement('p');p.textContent=r.id+': '+JSON.stringify(r.art||{height:r.documentHeight,hand:r.handCount,dialog:r.dialog});output.append(p);}
}
document.getElementById('run').onclick=run;pick.onchange=()=>load(pick.value);
document.getElementById('save').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(results,null,2)],{type:'application/json'}));a.download='mobile-layout-results.json';a.click()};
const view=new URLSearchParams(location.search).get('view');if(view&&pages[view]){pick.value=view;load(view);}else run();
