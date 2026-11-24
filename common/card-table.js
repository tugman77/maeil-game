// 카드 직접 선택이 기본이며, 큰 목록은 선택 가능한 보조 기능이다.
const MaeilCardTable = (() => {
  // 카드마다 드러나는 높이도 44px 이상 확보한다. 작은 화면은 판을 스크롤한다.
  function layout(width, height, columns, longest, large = false) {
    const gap=6, padding=12;
    const cardWidth=Math.max(large?64:56,Math.min(96,Math.floor((width-padding-(columns-1)*gap)/columns)));
    return {landscape:width>height,cardWidth,cardHeight:cardWidth*7/5,step:large?56:48,columns,gap,
      tableWidth:cardWidth*columns+(columns-1)*gap+padding};
  }
  function fit(board, count, longest) {
    const surface=document.getElementById('card-layout'),viewport=document.getElementById('tableau-viewport');
    const width=viewport?.clientWidth || Math.max(320,(window.innerWidth||390)-16);
    const l=layout(width,window.innerHeight||800,count,longest,document.documentElement.classList.contains('large-text'));
    const target=surface||board;
    target.style.setProperty('--table-columns',count);
    target.style.setProperty('--card-width',`${l.cardWidth}px`);
    target.style.setProperty('--card-height',`${l.cardHeight}px`);
    target.style.setProperty('--card-step',`${l.step}px`);
    target.style.setProperty('--table-width',`${l.tableWidth}px`);
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
