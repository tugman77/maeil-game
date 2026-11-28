// 한국어문회 8급 초안. 글자·대표 훈음·부수·획수는 사용자 검수본과
// 한국어문회 급수 배정 자료를 기준으로 관리하며, 배포 전 공식 원문 대조를 거친다.
const HanjaBank = (() => {
  const raw = [
    ['一','한','일','一','1','一','일월'],['二','두','이','二','2','二','이월'],['三','석','삼','一','3','三','삼월'],['四','넉','사','囗','5','四','사월'],['五','다섯','오','二','4','五','오월'],['六','여섯','륙','八','4','六','유월'],
    ['七','일곱','칠','一','2','七','칠월'],['八','여덟','팔','八','2','八','팔월'],['九','아홉','구','乙','2','九','구월'],['十','열','십','十','2','十','시월'],['日','날','일','日','4','一日','일일'],['月','달','월','月','4','十月','시월'],
    ['火','불','화','火','4','火山','화산'],['水','물','수','水','4','水火','수화'],['木','나무','목','木','4','土木','토목'],['金','쇠','금','金','8','金土','금토','성','김'],['土','흙','토','土','3','土木','토목'],['山','메','산','山','3','火山','화산'],
    ['父','아비','부','父','4','父母','부모'],['母','어미','모','母','5','父母','부모'],['兄','형','형','儿','5','兄弟','형제'],['弟','아우','제','弓','7','兄弟','형제'],['寸','마디','촌','寸','3','三寸','삼촌'],['女','계집','녀','女','3','男女','남녀'],
    ['東','동녘','동','木','8','東西','동서'],['西','서녘','서','襾','6','東西','동서'],['南','남녘','남','十','9','南北','남북'],['北','북녘','북','匕','5','南北','남북','달아날','배'],['中','가운데','중','丨','4','中外','중외'],['大','큰','대','大','3','大小','대소'],
    ['學','배울','학','子','16','學校','학교'],['校','학교','교','木','10','學校','학교'],['敎','가르칠','교','攵','11','敎室','교실'],['室','집','실','宀','9','敎室','교실'],['先','먼저','선','儿','6','先生','선생'],['生','날','생','生','5','學生','학생'],
    ['韓','한국','한','韋','17','韓國','한국','나라','한'],['國','나라','국','囗','11','韓國','한국'],['民','백성','민','氏','5','國民','국민'],['王','임금','왕','玉','4','國王','국왕'],['軍','군사','군','車','9','軍人','군인'],['萬','일만','만','艸','13','萬人','만인'],['人','사람','인','人','2','軍人','군인'],
    ['小','작을','소','小','3','大小','대소'],['長','긴','장','長','8','長女','장녀'],['白','흰','백','白','5','白人','백인'],['靑','푸를','청','靑','8','靑年','청년'],['年','해','년','干','6','靑年','청년'],['門','문','문','門','8','大門','대문'],['外','바깥','외','夕','5','外國','외국'],
  ];
  const lessonChars = [
    '一二三四五六七八九十日月',
    '火水木金土山父母兄弟寸女',
    '東西南北中大學校敎室先生小',
    '韓國民王軍萬人長白靑年門外',
  ];
  const grades = [{id:'8',label:'8급',read:50,write:0,questions:50,pass:35,minutes:50,status:'available'},
    {id:'7ii',label:'7급Ⅱ',read:100,write:0,questions:60,pass:42,minutes:50,status:'planned'},
    {id:'7',label:'7급',read:150,write:0,questions:70,pass:49,minutes:50,status:'planned'},
    {id:'6ii',label:'6급Ⅱ',read:225,write:50,questions:80,pass:56,minutes:50,status:'planned'},
    {id:'6',label:'6급',read:300,write:150,questions:90,pass:63,minutes:50,status:'planned'},
    {id:'5ii',label:'5급Ⅱ',read:400,write:225,questions:100,pass:70,minutes:50,status:'planned'},
    {id:'5',label:'5급',read:500,write:300,questions:100,pass:70,minutes:50,status:'planned'},
    {id:'4ii',label:'4급Ⅱ',read:750,write:400,questions:100,pass:70,minutes:50,status:'planned'},
    {id:'4',label:'4급',read:1000,write:500,questions:100,pass:70,minutes:50,status:'planned'},
    {id:'3ii',label:'3급Ⅱ',read:1500,write:750,questions:150,pass:105,minutes:60,status:'planned'},
    {id:'3',label:'3급',read:1817,write:1000,questions:150,pass:105,minutes:60,status:'planned'}];
  const lessons = lessonChars.map((chars,i)=>({id:i+1,title:['숫자와 날짜','자연과 가족','방향과 배움','나라와 생활'][i],description:['숫자·해·달을 함께 익혀요','자연과 가족 한자를 배워요','방향·크기·학교 한자를 익혀요','나라와 주변에서 만나는 글자예요'][i],chars:[...chars],groups:Array.from({length:Math.ceil(chars.length/5)},(_,n)=>[...chars].slice(n*5,n*5+5))}));
  const items = raw.map(([char,hun,sound,radical,strokes,word,wordReading,altHun='',altSound=''],i)=>({id:`k8-${String(i+1).padStart(2,'0')}`,char,hun,sound,hunum:`${hun} ${sound}`,meaning:hun,reading:sound,alternatives:altSound?[{hun:altHun,sound:altSound}]:[],radical,strokes:Number(strokes),word,wordReading,lesson:lessons.find(l=>l.chars.includes(char))?.id||0,readGrade:'8급',writeGrade:null,sources:{character:{url:'https://www.hanja.re.kr/',checkedOn:null},hunum:{url:'https://www.hanja.re.kr/',checkedOn:null},alternativeHunum:{url:'https://www.hanja.re.kr/',checkedOn:null},radical:{url:'https://www.hanja.re.kr/',checkedOn:null},strokeCount:{url:'https://www.hanja.re.kr/',checkedOn:null},strokeOrder:{source:'수작업 제작',checkedOn:null},examples:{url:'https://hanja.studyit.kr/hanja/guide/8/',checkedOn:'2026-11-28'}},officialStatus:'primary-crosscheck-pending'}));
  lessons.forEach(lesson=>{lesson.items=lesson.chars.map(char=>items.find(q=>q.char===char));});
  const examples = [
    ['一月','일월'],['二月','이월'],['三月','삼월'],['四月','사월'],['五月','오월'],['六月','유월'],['七月','칠월'],['八月','팔월'],['九月','구월'],['十月','시월'],
    ['一日','일일'],['十日','십일'],['二年','이년'],['三年','삼년'],['四年','사년'],['五年','오년'],['六年','육년'],['七年','칠년'],['八年','팔년'],['九年','구년'],['十年','십년'],
    ['父母','부모'],['兄弟','형제'],['三寸','삼촌'],['男女','남녀'],['東西','동서'],['南北','남북'],['東南','동남'],['中外','중외'],['大小','대소'],
    ['學校','학교'],['學生','학생'],['先生','선생'],['敎室','교실'],['韓國','한국'],['國民','국민'],['國王','국왕'],['軍人','군인'],['萬人','만인'],['火山','화산'],['土木','토목'],['水火','수화'],['大門','대문'],['外國','외국'],['長女','장녀'],['靑年','청년'],['白人','백인'],
  ].map(([word,reading])=>({word,reading,characters:[...word]}));
  const strokeQuestions=[{char:'三',positions:[{stroke:1,count:3},{stroke:3,count:3}]},{char:'十',positions:[{stroke:1,count:2},{stroke:2,count:2}]}];
  const strokeGuides={
    一:[[[16,64],[104,64]]],二:[[[27,45],[94,45]],[[16,83],[104,83]]],三:[[[29,37],[91,37]],[[26,61],[94,61]],[[16,85],[104,85]]],十:[[[18,64],[102,64]],[[60,22],[60,108]]],
    木:[[[21,48],[99,48]],[[60,18],[60,109]],[[60,48],[27,88]],[[60,48],[94,88]]],寸:[[[21,38],[99,38]],[[60,20],[60,92],[52,101]],[[79,67],[90,82]]],
    父:[[[63,24],[42,37],[23,49]],[[76,39],[82,52]],[[59,55],[44,76],[24,98]],[[63,57],[77,74],[95,91],[108,100]]],
    大:[[[22,49],[98,49]],[[59,49],[44,70],[25,95]],[[61,50],[74,69],[97,94]]],
    人:[[[70,24],[60,41],[47,61],[32,82],[19,103]],[[52,59],[68,68],[83,82],[98,102]]],
    小:[[[59,21],[59,77],[55,91]],[[35,52],[26,66]],[[82,50],[95,65]]],
  };
  return {version:4,source:{name:'한국어문회 전국한자능력검정시험',url:'https://www.hanja.re.kr/',officialCheckedOn:null,secondaryCrosscheck:{url:'https://hanja.studyit.kr/hanja/guide/8/',checkedOn:'2026-11-28'},verification:'공식 원문 대조를 완료한 뒤 각 필드 checkedOn을 기입'},grades,items,lessons,examples,strokeQuestions,strokeGuides};
})();
if(typeof module!=='undefined')module.exports=HanjaBank;
