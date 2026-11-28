const HanjaGame = (() => {
  const M=typeof MaeilGame!=='undefined'?MaeilGame:require('../../common/core.js');
  const B=typeof HanjaBank!=='undefined'?HanjaBank:require('./bank.js');
  const ID='hanja',COUNT=B.items.length;
  const itemById=id=>B.items.find(x=>x.id===id),itemByChar=c=>B.items.find(x=>x.char===c);
  const shuffle=(a,r)=>M.shuffle([...a],r);
  const normalize=s=>String(s??'').normalize('NFC').replace(/[\s·ㆍ]/g,'').replace(/[，,。.!?]/g,'').trim();
  function options(answer,pool,rng,limit=3){const unique=[...new Set(pool.filter(x=>x!==answer))];return shuffle([answer,...shuffle(unique,rng).slice(0,limit)],rng);}
  function question(type,item,rng,extra={}){
    const all=B.items;
    const pool=extra.poolItems||all;
    if(type==='char-hunum')return {type,itemId:item.id,prompt:'이 한자의 대표 훈음은 무엇인가요?',display:item.char,answer:item.hunum,options:options(item.hunum,pool.map(x=>x.hunum),rng),input:false};
    if(type==='hunum-char')return {type,itemId:item.id,prompt:'이 훈음에 맞는 한자를 고르세요.',display:item.hunum,answer:item.char,options:options(item.char,pool.map(x=>x.char),rng),input:false};
    if(type==='char-hun-input')return {type,itemId:item.id,prompt:'한자의 대표 훈(뜻)을 입력하세요.',display:item.char,answer:item.hun,accepted:[item.hun,...item.alternatives.map(x=>x.hun)],input:true,placeholder:'예: 한'};
    if(type==='char-hunum-input')return {type,itemId:item.id,prompt:'한자의 대표 훈음 전체를 입력하세요.',display:item.char,answer:item.hunum,accepted:[item.hunum,...item.alternatives.map(x=>`${x.hun} ${x.sound}`)],input:true,placeholder:'예: 한 일'};
    if(type==='sound-choice')return {type,itemId:item.id,prompt:'이 한자의 음(소리)은 무엇인가요?',display:item.char,answer:item.sound,options:options(item.sound,all.map(x=>x.sound),rng),input:false};
    if(type==='listen-char')return {type,itemId:item.id,prompt:'소리를 듣고 알맞은 한자를 고르세요.',display:'🔊 소리 듣기 버튼을 눌러 보세요.',answer:item.char,options:options(item.char,pool.map(x=>x.char),rng),input:false,listenText:item.sound};
    if(type==='word-read')return {type,itemId:item.id,prompt:`한자어의 읽는 소리를 입력하세요.${extra.context?` ${extra.context}`:''}`,display:extra.word.word,answer:extra.word.reading,accepted:[extra.word.reading],input:true,placeholder:'한글로 입력'};
    if(type==='word-to-hanja')return {type,itemId:item.id,prompt:`‘${extra.meaning}’에 해당하는 한자어를 고르세요.`,display:extra.context||'보기에서 알맞은 한자어를 선택하세요.',answer:extra.word.word,options:options(extra.word.word,B.examples.map(x=>x.word),rng),input:false};
    if(type==='stroke-order')return {type,itemId:item.id,prompt:'색으로 표시한 획은 몇 번째로 쓰나요?',display:item.char,answer:String(extra.stroke),options:shuffle(Array.from({length:extra.count},(_,i)=>String(i+1)),rng),input:false,stroke:extra.stroke,count:extra.count};
    return null;
  }
  const qTypes=['char-hunum','hunum-char','char-hunum-input','char-hun-input','sound-choice'];
  function makeLesson(lessonId,random=Math.random,reviewIds=[]){
    const lesson=B.lessons.find(x=>x.id===lessonId);if(!lesson)throw Error('차시 정보가 없습니다.');
    const groups=lesson.groups.map((chars,groupIndex)=>{
      const items=chars.map(itemByChar),pool=B.items.filter(it=>it.lesson<lessonId||chars.includes(it.char)),qs=[];
      items.forEach(it=>qs.push({...question('char-hunum',it,random,{poolItems:pool}),stage:'읽기'}));
      const eligible=B.examples.filter(w=>w.characters.every(c=>pool.some(it=>it.char===c))&&w.characters.some(c=>chars.includes(c)));
      shuffle(eligible,random).slice(0,Math.min(2,eligible.length)).forEach(word=>{const it=itemByChar(word.characters.find(c=>chars.includes(c)));qs.push({...question('word-read',it,random,{word}),stage:'읽기'});});
      items.forEach(it=>qs.push({...question('char-hunum-input',it,random),stage:'쓰기·떠올리기',prompt:'한자를 보고 훈음 전체를 한글로 적어 보세요.'}));
      items.forEach(it=>qs.push({...question('listen-char',it,random,{poolItems:pool}),stage:'듣기 연습 · 학습용'}));
      if(groupIndex>0){const earlier=lesson.groups.slice(0,groupIndex).flat().map(itemByChar),due=earlier.filter(it=>reviewIds.includes(it.id)),reviewPool=due.length?due:earlier;shuffle(reviewPool,random).slice(0,2).forEach(it=>qs.push({...question('char-hunum',it,random,{poolItems:pool}),stage:'중간 복습'}));}
      if(groupIndex===lesson.groups.length-1){const guideChar=['三','父','大','人'][lessonId-1],guide=B.strokeGuides[guideChar];if(guide?.length)qs.push({...question('stroke-order',itemByChar(guideChar),random,{stroke:Math.min(2,guide.length),count:guide.length}),stage:'필순 확인'});}
      return {chars,questions:qs};
    });
    return {version:2,bankVersion:B.version,mode:'lesson',lesson:lessonId,phase:'cards',groupIndex:0,groups,cards:groups[0].chars,cardIndex:0,remembered:[],questions:groups[0].questions,totalQuestions:groups.reduce((n,g)=>n+g.questions.filter(q=>q.stage!=='듣기 연습 · 학습용').length,0),index:0,correct:0,answers:[],daily:null,startedAt:Date.now()};
  }
  function makePractice({mode='review',ids=null,random=Math.random}={}){
    let pool=ids?.length?ids.map(itemById).filter(Boolean):B.items;
    if(mode==='review')pool=pool.filter(q=>ids?.includes(q.id));
    const picked=shuffle(pool.length?pool:B.items,random).slice(0,mode==='all'?COUNT:10);
    const qs=picked.map((it,i)=>question(qTypes[i%qTypes.length],it,random));
    if(picked.length>1){const words=B.examples.filter(w=>w.characters.every(c=>picked.some(p=>p.char===c)));if(words.length)qs.push(question('word-read',itemByChar(words[0].characters[0]),random,{word:words[0]}));}
    return {version:1,bankVersion:B.version,mode,lesson:null,phase:'quiz',cards:[],cardIndex:0,remembered:[],questions:qs,index:0,correct:0,answers:[],daily:null,startedAt:Date.now()};
  }
  function mockExam(random=Math.random){
    const chars=shuffle(B.items,random), words=shuffle(B.examples,random);
    const qs=[];
    for(let i=0;i<10;i++){const w=words[i%words.length],it=itemByChar(w.characters[0]);qs.push(question('word-read',it,random,{word:w,context:'한자어의 독음을 쓰세요.'}));}
    for(let i=0;i<10;i++)qs.push(question('hunum-char',chars[i],random));
    const contextWords=shuffle(B.examples.filter(w=>w.characters.length===2),random);
    for(let i=0;i<10;i++){const w=contextWords[i%contextWords.length],it=itemByChar(w.characters[0]);qs.push(question('word-to-hanja',it,random,{word:w,meaning:w.reading,context:`‘${w.reading}’을 한자로 쓰면?`}));}
    for(let i=0;i<10;i++)qs.push(question('char-hunum-input',chars[i+10],random));
    for(let i=0;i<4;i++)qs.push(question('char-hun-input',chars[i+20],random));
    for(let i=0;i<4;i++)qs.push(question('sound-choice',chars[i+24],random));
    const strokeData=[{char:'三',stroke:1,count:3},{char:'十',stroke:2,count:2}];
    strokeData.forEach(s=>qs.push(question('stroke-order',itemByChar(s.char),random,s)));
    return {version:1,bankVersion:B.version,mode:'mock',lesson:null,phase:'quiz',cards:[],cardIndex:0,remembered:[],questions:qs,index:0,correct:0,answers:[],daily:null,startedAt:Date.now(),deadline:Date.now()+50*60*1000};
  }
  function daily(date,random){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('날짜가 올바르지 않습니다.');const rng=random||M.dailyRandom(ID,date);const pool=shuffle(B.items,rng).slice(0,5);const qs=pool.map((it,i)=>question(qTypes[i%qTypes.length],it,rng));return {version:1,bankVersion:B.version,mode:'daily',lesson:null,phase:'quiz',cards:[],cardIndex:0,remembered:[],questions:qs,index:0,correct:0,answers:[],daily:date,startedAt:Date.now()};}
  const current=s=>s?.questions?.[s.index]||null,done=s=>s?.index>=s?.questions?.length;
  function markCard(s){if(!s||s.mode!=='lesson'||s.phase!=='cards')return false;const id=B.items.find(x=>x.char===s.cards[s.cardIndex])?.id;if(!id)return false;(s.remembered||(s.remembered=[])).push({id});s.cardIndex++;if(s.cardIndex>=s.cards.length)s.phase='quiz';return true;}
  function check(s,answer){const q=current(s);if(!q)return false;const value=normalize(answer);const accepted=q.accepted||[q.answer];return accepted.some(x=>normalize(x)===value);}
  function submit(s,answer){const q=current(s);if(!q||s.answered)return'inactive';const ok=check(s,answer);if(ok&&q.stage!=='듣기 연습 · 학습용')s.correct++;s.answers.push({itemId:q.itemId,type:q.type,stage:q.stage||null,answer:String(answer??''),correct:ok});s.answered=true;s.lastResult=ok;return ok?'correct':'wrong';}
  function advance(s){if(!s||!s.answered)return false;s.index++;s.answered=false;s.lastResult=null;if(s.mode==='lesson'&&s.index>=s.questions.length&&s.groupIndex<s.groups.length-1){s.groupIndex++;s.cards=s.groups[s.groupIndex].chars;s.cardIndex=0;s.remembered=[];s.questions=s.groups[s.groupIndex].questions;s.index=0;s.phase='cards';}return true;}
  function score(s){return {correct:s.correct,total:s.totalQuestions||s.questions.length,missed:s.answers.filter(x=>!x.correct)};}
  function isValid(s){return Boolean(s&&(s.version===1||s.version===2)&&s.bankVersion===B.version&&['lesson','review','all','daily','mock'].includes(s.mode)&&Array.isArray(s.questions)&&Number.isInteger(s.index)&&s.index>=0&&s.index<=s.questions.length&&Number.isInteger(s.correct)&&s.correct>=0&&s.correct<=(s.totalQuestions||s.questions.length)&&Array.isArray(s.answers));}
  function shareText(s){const result=score(s);return `[매일게임 오늘의 한자] 한국어문회 8급 ${s.mode==='mock'?'모의시험':'학습'}\n${result.correct}/${result.total}문제 정답\n훈음·독음·필순을 차근히 익혀 보세요.`;}
  return {ID,BANK:B,COUNT,makeLesson,makePractice,mockExam,daily,current,done,markCard,check,submit,advance,score,isValid,shareText,itemById,itemByChar,normalize};
})();
if(typeof module!=='undefined')module.exports=HanjaGame;
