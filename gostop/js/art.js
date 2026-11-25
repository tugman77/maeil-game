/* 매일게임을 위해 좌표로 직접 그린 화투. 상용 게임 이미지·화면을 사용하지 않는다. */
const GostopArt = (() => {
  const stems=[
    '<path d="M12 83 26 44 37 77 51 48 62 84" fill="none" stroke="#273e35" stroke-width="5"/><path d="M10 59h28M32 54h29M17 70h40" stroke="#207b59" stroke-width="9"/>',
    '<path d="M9 83 28 65 49 35M28 65 58 64" fill="none" stroke="#4b3934" stroke-width="4"/>',
    '<path d="M10 78 39 51 62 53M39 51 47 30" fill="none" stroke="#55433f" stroke-width="4"/>',
    '<path d="M8 38Q35 28 65 37" fill="none" stroke="#344c3a" stroke-width="4"/><path d="M16 38v30M31 36v42M48 36v35M60 39v25" stroke="#685297" stroke-width="8" stroke-dasharray="4 2"/>',
    '<path d="M12 85 21 39 28 85 44 45 50 85 61 40" fill="none" stroke="#3b7c52" stroke-width="4"/>',
    '<path d="M13 82Q28 57 45 75M38 84V51M38 72 57 64" fill="none" stroke="#33784c" stroke-width="5"/>',
    '<path d="M13 84 27 49M29 83 46 42M47 83 59 54" stroke="#46774b" stroke-width="3"/>',
    '<path d="M7 85 18 58 25 82 39 47 47 84 59 53 66 85Z" fill="#6e784e"/>',
    '<path d="M14 85 27 51M43 85 51 56" stroke="#368151" stroke-width="4"/>',
    '<path d="M12 85 32 55 57 35M32 55 59 70" fill="none" stroke="#583b32" stroke-width="4"/>',
    '<path d="M15 85 32 52 49 84M32 52 57 45" fill="none" stroke="#3b6d4c" stroke-width="4"/><path d="M13 61q13-18 20 0q-10 12-20 0M36 73q13-18 23 0q-13 12-23 0" fill="#4d8e62"/>',
    '<path d="M7 41q28-17 59 0M20 36q-9 20-4 43M35 32q-8 21-3 49M50 34q-8 23-4 48M62 39q-8 22-4 36" fill="none" stroke="#4c7757" stroke-width="3"/>'
  ];
  const flower=(x,y,color,r=5)=>`<g fill="${color}"><circle cx="${x-r}" cy="${y}" r="${r}"/><circle cx="${x+r}" cy="${y}" r="${r}"/><circle cx="${x}" cy="${y-r}" r="${r}"/><circle cx="${x}" cy="${y+r}" r="${r}"/></g><circle cx="${x}" cy="${y}" r="2.5" fill="#edc963"/>`;
  function body(c) {
    let a=stems[c.month-1];
    if([2,3,6,9].includes(c.month))a+=[{x:26,y:51},{x:49,y:65}].map(p=>flower(p.x,p.y,c.month===9?'#dfa831':c.month===3?'#df8999':'#ba3b55')).join('');
    if(c.month===7)a+=flower(27,57,'#925b91',3)+flower(49,65,'#925b91',3);
    if(c.month===5)a+=flower(22,47,'#6858a0',4)+flower(51,54,'#6858a0',4);
    if(c.month===10)a+='<path d="m26 43 3 8 8-3-3 8 7 4-11 3-4 9-2-10-10-4 10-4Z" fill="#bd5737"/><path d="m54 58 2 7 8-1-6 7-9 1-4-7 7 1Z" fill="#dc8940"/>';
    if(c.month===11)a+=flower(48,43,'#9367a6',4);
    if(c.set)a+=`<path d="M42 32h14v45l-7-5-7 5Z" fill="${c.set==='청단'?'#285599':'#b33845'}"/><path d="M46 40h6m-6 6h6m-6 6h6" stroke="#fff5e7" stroke-width="2"/>`;
    if(c.type==='광') {
      if(c.month===8)a+='<circle cx="31" cy="43" r="15" fill="#e9bd4c"/>';
      else if(c.month===3)a+='<path d="M8 42h57v20H8Z" fill="#b93d4a"/><path d="M8 48h57" stroke="#f2d077" stroke-width="3"/>';
      else if(c.month===12)a+='<path d="M18 50q17-26 34 0Z" fill="#4c6190"/><path d="M35 50v22q0 7 6 5" fill="none" stroke="#363f51" stroke-width="3"/>';
      else a+='<path d="M21 48q17-26 28 2l-16-5 5 19-10-7-7 11 2-20Z" fill="#f4e8cc" stroke="#393f44" stroke-width="2"/><path d="m45 43 11 2-10 3" fill="#ad3a3f"/>';
    }
    if(c.type==='열') {
      if([2,4,8,12].includes(c.month))a+='<path d="M18 49q12-12 19 1 14-20 22-13-8 9-17 20-13 6-24-8Z" fill="#343e52"/><circle cx="41" cy="45" r="2" fill="white"/>';
      else if(c.month===5)a+='<path d="M9 65q27-20 54 0v7q-28-20-54 0Z" fill="#a4613c"/>';
      else if(c.month===6)a+='<path d="M35 51q-24-24-20 2-6 18 19 7 22 20 25-3 5-26-24-6Z" fill="#e7ba53" stroke="#474651" stroke-width="2"/>';
      else if(c.month===9)a+='<path d="M19 46h34l-5 18H24Z" fill="#f8f0dc" stroke="#414e5c" stroke-width="2"/><path d="M29 55h14" stroke="#b23e49" stroke-width="3"/>';
      else a+='<path d="M14 58q0-17 25-13l10 6 7-13 7 5-9 19H23l-3 12m22-13 2 13" fill="#8b5d42" stroke="#483b35" stroke-width="3"/>';
    }
    return a;
  }
  function svg(id) {
    const c=Gostop.cards[id],label=c.pi===2?'쌍피':c.type==='열'?'열끗':c.type;
    return `<svg viewBox="0 0 72 104" aria-hidden="true" focusable="false"><rect x="1.5" y="1.5" width="69" height="101" rx="6" fill="#fffaf0" stroke="#434b48" stroke-width="2"/>${body(c)}<rect x="4" y="4" width="44" height="23" rx="4" fill="#fffaf0"/><text x="7" y="22" font-size="24" font-weight="800" fill="#202d29">${c.month}<tspan font-size="12">월</tspan></text><rect x="3" y="83" width="66" height="18" rx="3" fill="${c.type==='광'?'#9c303a':c.pi===2?'#285599':'#273e35'}"/><text x="36" y="97" text-anchor="middle" font-size="20" font-weight="700" fill="white">${label}</text></svg>`;
  }
  return {svg};
})();
