// 좁은 화면에서는 전체 배치를 살피고, 카드 선택은 큰 목록에서 한다.
const MaeilCardTable = (() => {
  function layout(width, height, columns, longest) {
    const landscape = width > height;
    const cardHeight = landscape ? 32 : 42;
    const reserved = landscape ? 204 : 320;
    const available = Math.max(90, height - reserved);
    const step = Math.max(14, Math.min(26, (available-cardHeight) / Math.max(1,longest-1)));
    return { landscape, cardHeight, step, columns };
  }
  function fit(board, count, longest) {
    const width = window.innerWidth || 390, height = window.innerHeight || 800;
    const l = layout(width,height,count,longest);
    const actual = board.clientHeight || Math.max(90,height-(l.landscape?204:320));
    const step = Math.max(14,Math.min(26,(actual-l.cardHeight-22)/Math.max(1,longest-1)));
    board.style.setProperty('--card-height',`${l.cardHeight}px`);
    board.style.setProperty('--card-step',`${step}px`);
    board.style.setProperty('--table-columns',count);
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
        const face=document.createElement('b');face.textContent=choice.label;face.className=choice.red?'red-card':'';
        const detail=document.createElement('span');detail.textContent=choice.detail;
        b.append(face,detail);b.addEventListener('click',()=>{close();onPick(choice.location);});return b;
      });list.replaceChildren(...items);overlay.hidden=false;onOpen();(items.find(b=>!b.disabled)||closeButton).focus();
    }};
  }
  return { layout,fit,createPicker };
})();
if(typeof module!=='undefined')module.exports=MaeilCardTable;
