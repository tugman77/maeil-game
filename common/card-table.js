// 카드 직접 선택이 기본이며, 큰 목록은 선택 가능한 보조 기능이다.
const MaeilCardTable = (() => {
  // 작은 화면에서는 모든 줄을 폭 안에 맞춘다. 큰 선택은 보조 확대 창에서 제공한다.
  function layout(width, height, columns, longest, large = false) {
    const gap=width<520?2:6,padding=4;
    const available=Math.max(0,width-padding-(columns-1)*gap);
    const cardWidth=Math.min(height<300?56:height<360?64:96,Math.floor(available/columns));
    const cardHeight=cardWidth*7/5,compact=cardWidth<52;
    const preferred=compact?(large?36:32):(large?48:44);
    const step=Math.max(22,Math.min(preferred,Math.floor((height-2*cardHeight-150)/Math.max(1,longest-1))));
    return {landscape:width>height,cardWidth,cardHeight,step,columns,gap,compact,
      tableWidth:cardWidth*columns+(columns-1)*gap+padding};
  }
  function fit(board, count, longest) {
    const surface=document.getElementById('card-layout'),viewport=document.getElementById('tableau-viewport');
    const width=viewport?.clientWidth || Math.max(240,(window.innerWidth||390)-16);
    const height=viewport?.clientHeight || Math.max(140,(window.innerHeight||800)-280);
    const l=layout(width,height,count,longest,document.documentElement.classList.contains('large-text'));
    const target=surface||board;
    target.style.setProperty('--table-columns',count);
    target.style.setProperty('--card-width',`${l.cardWidth}px`);
    target.style.setProperty('--card-height',`${l.cardHeight}px`);
    target.style.setProperty('--card-step',`${l.step}px`);
    target.style.setProperty('--table-width',`${l.tableWidth}px`);
    target.style.setProperty('--table-gap',`${l.gap}px`);
    target.classList.toggle('compact-cards',l.compact);
  }
  // Unicode suits explicitly use text presentation, keeping red/black consistent on phones.
  function face(element, {rank,suit}) {
    const textSuit=suit+'\uFE0E';
    const corner=(reversed=false)=>{
      const c=document.createElement('span');c.className='card-corner'+(reversed?' card-corner-bottom':'');c.setAttribute('aria-hidden','true');
      const r=document.createElement('b');r.className='card-rank';r.textContent=rank;
      const s=document.createElement('span');s.className='card-suit';s.textContent=textSuit;c.append(r,s);return c;
    };
    const mark=document.createElement('span');mark.className='card-mark';mark.textContent=textSuit;mark.setAttribute('aria-hidden','true');
    element.replaceChildren(corner(),mark,corner(true));
  }
  function slot(element,caption,suit='') {
    const mark=document.createElement('span');mark.className='slot-mark';mark.textContent=suit?suit+'\uFE0E':caption==='K'?'K':'＋';mark.setAttribute('aria-hidden','true');
    const note=document.createElement('span');note.className='slot-caption';note.textContent=caption==='K'?'K부터':caption;
    element.replaceChildren(mark,note);
  }
  function createPicker({ onPick, onOpen = () => {}, onClose = () => {} }) {
    const overlay = document.createElement('div'); overlay.id='card-picker'; overlay.className='card-picker'; overlay.hidden=true;
    overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true'); overlay.setAttribute('aria-labelledby','card-picker-title');
    const panel=document.createElement('section');panel.className='card-picker-panel';
    const header=document.createElement('header');header.className='card-picker-header';
    const title=document.createElement('h2');title.id='card-picker-title';
    const closeButton=document.createElement('button');closeButton.type='button';closeButton.className='header-btn';closeButton.textContent='닫기';closeButton.id='card-picker-close';
    const note=document.createElement('p');note.className='card-picker-note';note.textContent='옮길 묶음의 첫 카드를 고르세요.';
    const list=document.createElement('div');list.id='card-picker-list';list.className='card-picker-list';
    header.append(title,closeButton);panel.append(header,note,list);overlay.append(panel);document.body.append(overlay);
    let items=[], restore=null, opened=false;
    function close() { if(!opened)return;opened=false;overlay.hidden=true;onClose();restore?.focus?.({preventScroll:true}); }
    closeButton.addEventListener('click',close);
    overlay.addEventListener('keydown',(e)=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation?.();close();}
      if(e.key==='Tab'){
        const focusable=[closeButton,...items.filter(b=>!b.disabled)],i=focusable.indexOf(document.activeElement);
        e.preventDefault();focusable[(i+(e.shiftKey?-1:1)+focusable.length)%focusable.length].focus();
      }
    });
    return { close,get opened(){return opened;},open(label,choices){
      restore=document.activeElement;title.textContent=label;opened=true;
      items=choices.map((choice)=>{
        const b=document.createElement('button');b.type='button';b.className='card-pick-item';b.disabled=!choice.enabled;
        const face=document.createElement('b');face.textContent=choice.label.replace(/[♠♥♣♦]/g,s=>s+'\uFE0E');face.className=choice.red?'red-card':'';
        const detail=document.createElement('span');detail.textContent=choice.detail;
        b.append(face,detail);b.addEventListener('click',()=>{close();onPick(choice.location);});return b;
      });list.replaceChildren(...items);overlay.hidden=false;onOpen();(items.find(b=>!b.disabled)||closeButton).focus();
    }};
  }
  return { layout,fit,face,slot,createPicker };
})();
if(typeof module!=='undefined')module.exports=MaeilCardTable;
