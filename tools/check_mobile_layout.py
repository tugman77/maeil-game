"""실제 HTML/CSS/JS를 넣은 독립 브라우저 회귀 검사 생성. 실행 뒤 출력 HTML을 연다.
파일 URL에서도 실행되도록 앱 저장소·네트워크만 메모리/인라인으로 대체한다.
검사 본문: tests/mobile-layout.browser.js
"""
from pathlib import Path
import base64,json,re,subprocess
ROOT=Path(__file__).resolve().parent.parent
GAMES=json.loads((ROOT/'games.json').read_text())
states=json.loads(subprocess.check_output(['node','-e',r"""
const G=require('./gostop/js/logic'),AI=require('./gostop/js/ai'),M=require('./common/core');const out={};
for(let k=0;k<300;k++){let s=G.create(M.createSeededRandom('mobile'+k));if(s.phase==='ended')continue;
if(!out.initial)out.initial=G.initial(s.initial.deck,0);
for(let n=0;n<120&&s.phase!=='ended';n++){
 if(s.turn===1&&s.phase==='decision'&&!out.cpuDecision)out.cpuDecision=s;
 if(s.turn===1&&s.phase==='play'&&!out.cpu){const a=AI.choose(G.view(s)),next=G.apply(s,a);if(a.type==='play'&&next.turn===0&&next.events.length===2&&next.captured[1].length>s.captured[1].length)out.cpu=s;}
 if(s.turn===0){if(s.phase==='choose'&&!out[s.pending.kind])out[s.pending.kind]=s;
 if(s.phase==='decision'&&!out.decision)out.decision=s;
 if(s.captured[0].length>8&&s.captured[1].length>8&&!out.captured)out.captured=s;
 if(!out.crowded||s.table.length>out.crowded.table.length)out.crowded=s;
 if(G.legal(s).some(a=>a.type==='bomb')&&!out.bomb)out.bomb=s;}
 s=G.apply(s,AI.choose(G.view(s)));
}if(Object.keys(out).length===9)break;}
console.log(JSON.stringify(out));
"""],cwd=ROOT,text=True))
def inline(path,state=None,forced=None):
 s=path.read_text();s=s.replace('<head>','<head><base href="'+path.parent.as_uri()+'/">',1)
 s=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(path.parent/m[1]).read_text()+'</style>',s)
 def js(m):
  p=(path.parent/m[1]).resolve();code=p.read_text().replace('document.currentScript.src',json.dumps(p.as_uri()))
  if p.name=='hub.js':code=code.replace("fetch('games.json', { cache: 'no-cache' })",'Promise.resolve({ok:true,json:async()=>'+json.dumps(GAMES,ensure_ascii=False)+'})')
  if p.name=='core.js':code+='\nconst auditStore=new Map();MaeilGame.read=k=>auditStore.get(k)||null;MaeilGame.write=(k,v)=>{auditStore.set(k,v);return true};MaeilGame.registerOffline=()=>{};MaeilGame.markPlayed=()=>{};'
  if state and p==ROOT/'gostop/js/ui.js':
   code=(('GostopAI.choose=()=>({type:'+json.dumps(forced)+'});\n') if forced else '')+'auditStore.set("maeil-game.gostop.game.v1",'+json.dumps(dict(v=1,id='layout',difficulty='medium',daily=None,undo=0,hints=0,state=state))+');\n'+code+'''
window.auditTimeline=[];const stage=document.getElementById('turn-stage');new MutationObserver(()=>{const key=(document.getElementById('game-screen').hidden||stage.hidden)?'idle':stage.dataset.kind,prev=window.auditTimeline.at(-1);if(prev?.kind===key)return;const speech=document.getElementById('cpu-speech'),shown=key==='speech'?speech:stage;window.auditTimeline.push({kind:key,time:performance.now(),text:shown.textContent,visible:!shown.hidden&&getComputedStyle(shown).display!=='none'&&shown.getBoundingClientRect().height>0,thinking:document.getElementById('cpu-thinking').textContent});}).observe(document.getElementById('game-screen'),{subtree:true,attributes:true,childList:true,characterData:true});document.getElementById('continue-btn').click();'''
  return '<script>'+code+'</script>'
 s=re.sub(r'<script src="([^"]+)"></script>',js,s)
 # Inline card assets too, including SVGs dynamically emitted by art.js/thumbs.js.
 for p in (ROOT/'gostop/cards').glob('*.svg'):
  data='data:image/svg+xml;base64,'+base64.b64encode(p.read_bytes()).decode()
  s=s.replace('cards/'+p.name,data)
 s=s.replace('${hwatuRoot}${file}', '${auditImages[file]}')
 images={p.name:'data:image/svg+xml;base64,'+base64.b64encode(p.read_bytes()).decode() for p in (ROOT/'gostop/cards').glob('*.svg') if p.name in s}
 s=s.replace('<head>','<head><script>const auditImages='+json.dumps(images)+';</script>',1)
 # art.js produces dynamic card paths; replace only its path expression.
 s=s.replace("'cards/' + files[id]", 'auditImages[files[id]]')
 return s
pages={'hub':inline(ROOT/'index.html')}
for g in GAMES:pages[g['id']]=inline(ROOT/g['path']/'index.html')
for name,state in states.items():
 if name not in ['cpu','cpuDecision']:pages['match-'+name]=inline(ROOT/'gostop/index.html',state)
pages['timing-cpu']=inline(ROOT/'gostop/index.html',states['cpu'])
for forced in ['go','stop']:pages['timing-'+forced]=inline(ROOT/'gostop/index.html',states['cpuDecision'],forced)
data=json.dumps(pages,ensure_ascii=False).replace('</script','<\\/script')
runner=(ROOT/'tests/mobile-layout.browser.js').read_text()
html='''<!doctype html><meta charset="utf-8"><title>모바일 회귀 검사</title><style>body{font:14px system-ui;background:#ddd}iframe{border:0;background:white}pre{white-space:pre-wrap}#output{max-height:270px;overflow:auto}</style><h1>모바일 회귀 검사</h1><button id="run">전체 검사</button> <select id="pick"></select> <button id="save">측정 저장</button><p id="status">준비</p><pre id="output"></pre><iframe id="frame" width="390" height="664"></iframe><script>const pages='''+data+';</script><script>'+runner+'</script>'
out=ROOT/'.preview/mobile-layout.html';out.write_text(html);print(out)
