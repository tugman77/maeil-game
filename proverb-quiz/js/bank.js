// 표준 표기와 뜻을 직접 확인한 한국어 속담 문제.
const ProverbQuizBank = (() => {
  const questions = [
    // 쉬움: 매우 익숙한 속담
    { id:'e01', level:'easy', category:'말과 행동', before:'가는 말이 고와야 오는 말이', after:'.', answer:'곱다', choices:['곱다','빠르다','멀다'], hint:'내가 먼저 상대에게 건네는 말씨를 돌아보세요.', note:'내가 남에게 좋게 말해야 남도 나에게 좋게 말한다는 뜻이에요.' },
    { id:'e02', level:'easy', category:'시작과 노력', before:'시작이', after:'이다.', spaceAfter:false, answer:'반', choices:['반','끝','전부'], hint:'무언가를 시작했다면 이미 절반을 이룬 셈이라는 말이에요.', note:'일을 시작하는 것이 그만큼 중요하고, 시작하면 절반은 이룬 것과 같다는 뜻이에요.' },
    { id:'e03', level:'easy', category:'노력', before:'티끌 모아', after:'이다.', spaceAfter:false, answer:'태산', choices:['태산','바다','강물'], hint:'아주 작은 것이 모여 큰 산이 돼요.', note:'작은 것도 모이고 쌓이면 큰 것이 된다는 뜻이에요.' },
    { id:'e04', level:'easy', category:'함께하기', before:'백지장도 맞들면', after:'.', answer:'낫다', choices:['낫다','무겁다','젖는다'], hint:'둘이 함께하면 혼자 할 때보다 수월해져요.', note:'아무리 쉬운 일도 여럿이 힘을 모으면 더 쉽다는 뜻이에요.' },
    { id:'e05', level:'easy', category:'배움', before:'원숭이도 나무에서', after:'.', answer:'떨어진다', choices:['떨어진다','노래한다','숨는다'], hint:'잘하는 사람도 가끔은 실수할 수 있어요.', note:'아무리 익숙하고 능숙한 사람도 실수할 때가 있다는 뜻이에요.' },
    { id:'e06', level:'easy', category:'주의', before:'등잔 밑이', after:'.', answer:'어둡다', choices:['어둡다','밝다','따뜻하다'], hint:'가까운 곳이라 오히려 놓치기 쉬워요.', note:'가까이에 있는 것을 오히려 알아보지 못한다는 뜻이에요.' },
    { id:'e07', level:'easy', category:'습관', before:'세 살 버릇 여든까지', after:'.', answer:'간다', choices:['간다','온다','잊힌다'], hint:'어릴 때 든 습관은 오래 이어질 수 있어요.', note:'어릴 때 몸에 밴 버릇은 나이가 들어서도 고치기 어렵다는 뜻이에요.' },
    { id:'e08', level:'easy', category:'인내', before:'참을 인 자 셋이면', after:'면한다.', answer:'살인도', choices:['살인도','실수도','가난도'], hint:'화를 참으면 큰 다툼을 피할 수 있다는 말이에요.', note:'참고 견디면 큰 화를 면할 수 있다는 뜻이에요.' },
    { id:'e09', level:'easy', category:'경험', before:'백문이', after:'이다.', spaceAfter:false, answer:'불여일견', choices:['불여일견','불여일언','불여일행'], hint:'백 번 듣는 것보다 한 번 보는 편이 낫다는 뜻이에요.', note:'직접 한 번 보는 것이 여러 번 듣는 것보다 확실하다는 뜻이에요.' },
    { id:'e10', level:'easy', category:'말과 행동', before:'말 한마디에 천 냥 빚도', after:'.', answer:'갚는다', choices:['갚는다','늘어난다','잊는다'], hint:'말을 잘하면 어려운 일도 풀릴 수 있어요.', note:'말을 잘하면 큰 빚도 갚을 만큼 어려운 일도 해결할 수 있다는 뜻이에요.' },
    { id:'e11', level:'easy', category:'배움', before:'하늘이 무너져도 솟아날', after:'이 있다.', spaceAfter:false, answer:'구멍', choices:['구멍','별','길'], hint:'어려운 상황에서도 빠져나갈 방법은 있어요.', note:'아무리 큰 어려움이 닥쳐도 살아날 방법은 있다는 뜻이에요.' },
    { id:'e12', level:'easy', category:'신중함', before:'돌다리도 두들겨 보고', after:'.', answer:'건너라', choices:['건너라','놓아라','만들어라'], hint:'안전해 보여도 확인한 뒤 행동하라는 말이에요.', note:'잘 아는 일도 다시 확인하고 조심하라는 뜻이에요.' },

    // 보통: 자주 쓰지만 문장 전체를 떠올려야 하는 속담
    { id:'m01', level:'medium', category:'말과 행동', before:'낮말은 새가 듣고 밤말은 쥐가', after:'.', answer:'듣는다', choices:['듣는다','전한다','잊는다'], hint:'아무도 없는 곳에서 한 말도 새어 나갈 수 있어요.', note:'아무리 비밀스럽게 한 말도 남의 귀에 들어갈 수 있으니 말을 조심하라는 뜻이에요.' },
    { id:'m02', level:'medium', category:'원인과 결과', before:'콩 심은 데 콩 나고 팥 심은 데', after:'난다.', answer:'팥', choices:['팥','쌀','보리'], hint:'심은 씨앗과 같은 열매가 맺혀요.', note:'모든 일은 원인에 따라 그에 맞는 결과가 생긴다는 뜻이에요.' },
    { id:'m03', level:'medium', category:'주의', before:'호미로 막을 것을 가래로', after:'.', answer:'막는다', choices:['막는다','캔다','덮는다'], hint:'작은 일을 제때 처리하지 않으면 더 큰 수고가 들어요.', note:'작은 문제를 초기에 해결하지 않으면 나중에 큰 힘이 든다는 뜻이에요.' },
    { id:'m04', level:'medium', category:'기회', before:'쇠뿔도 단김에', after:'.', answer:'빼랬다', choices:['빼랬다','미뤘다','살폈다'], hint:'일을 하기로 했다면 기운이 있을 때 바로 하라는 말이에요.', note:'어떤 일을 하기로 마음먹었으면 망설이지 말고 곧바로 실행하라는 뜻이에요.' },
    { id:'m05', level:'medium', category:'주의', before:'믿는 도끼에 발등', after:'.', answer:'찍힌다', choices:['찍힌다','긁힌다','걸린다'], hint:'믿었던 사람이나 일이 도리어 해가 될 수 있어요.', note:'믿고 있던 사람에게 배신당하거나 믿었던 일로 손해를 본다는 뜻이에요.' },
    { id:'m06', level:'medium', category:'관계', before:'가는 날이', after:'이다.', spaceAfter:false, answer:'장날', choices:['장날','명절','휴일'], hint:'어떤 일을 하러 간 날에 마침 뜻밖의 일이 겹쳤어요.', note:'어떤 일을 하려고 한 때에 마침 좋은 일이나 나쁜 일이 겹친다는 뜻이에요.' },
    { id:'m07', level:'medium', category:'처지', before:'닭 쫓던 개 지붕', after:'.', answer:'쳐다본다', choices:['쳐다본다','올라간다','고친다'], hint:'목표를 놓친 뒤 어쩔 줄 모르는 모습을 떠올려 보세요.', note:'애써 하던 일이 실패해 어찌할 도리가 없는 상황을 이르는 말이에요.' },
    { id:'m08', level:'medium', category:'인과응보', before:'뿌린 대로', after:'.', answer:'거둔다', choices:['거둔다','자란다','돌아선다'], hint:'자신이 한 행동에 맞는 결과를 얻어요.', note:'행한 대로 결과를 얻는다는 뜻이에요.' },
    { id:'m09', level:'medium', category:'협력', before:'구슬이 서 말이라도 꿰어야', after:'.', answer:'보배', choices:['보배','구슬','실'], hint:'좋은 재료도 잘 다듬고 엮어야 가치가 생겨요.', note:'아무리 좋은 것이라도 쓸모 있게 만들어야 가치가 있다는 뜻이에요.' },
    { id:'m10', level:'medium', category:'관계', before:'웃는 얼굴에 침', after:'뱉는다.', answer:'못', choices:['못','더','꼭'], hint:'친절한 사람에게는 모질게 대하기 어려워요.', note:'웃는 낯으로 대하는 사람에게 함부로 대하기 어렵다는 뜻이에요.' },
    { id:'m11', level:'medium', category:'인내', before:'천 리 길도', after:'부터.', spaceAfter:false, answer:'한 걸음', choices:['한 걸음','첫날','먼 곳'], hint:'아주 긴 여정도 첫 발을 내디뎌야 시작돼요.', note:'큰일도 작은 시작부터 차근차근 해야 한다는 뜻이에요.' },
    { id:'m12', level:'medium', category:'주의', before:'급할수록', after:'.', answer:'돌아가라', choices:['돌아가라','뛰어라','서둘러라'], hint:'서두르면 실수하기 쉬우니 차분히 살펴보세요.', note:'급한 때일수록 서두르지 말고 침착하게 처리하라는 뜻이에요.' },

    // 어려움: 뜻을 생각하며 완성해야 하는 익숙한 속담
    { id:'h01', level:'hard', category:'경험', before:'구르는 돌에는 이끼가', after:'않는다.', answer:'끼지', choices:['끼지','피지','나지'], hint:'한곳에 머물지 않고 움직이면 낡거나 정체되지 않아요.', note:'활동을 계속하는 사람은 침체되지 않는다는 뜻으로 쓰여요.' },
    { id:'h02', level:'hard', category:'겉모습과 실속', before:'빛 좋은', after:'.', answer:'개살구', choices:['개살구','호박','수박'], hint:'겉은 그럴듯하지만 속은 좋지 않은 것을 말해요.', note:'겉만 번지르르하고 실속이 없는 경우를 이르는 말이에요.' },
    { id:'h03', level:'hard', category:'처지', before:'고래 싸움에', after:'등 터진다.', answer:'새우', choices:['새우','물고기','조개'], hint:'강한 사람들끼리 다투면 약한 쪽이 피해를 봐요.', note:'강자들의 싸움에 아무 관계 없는 약자가 피해를 본다는 뜻이에요.' },
    { id:'h04', level:'hard', category:'욕심', before:'말 타면', after:'잡히고 싶다.', answer:'경마', choices:['경마','장기','산책'], hint:'한 가지를 이루면 더 큰 것을 바라게 돼요.', note:'사람의 욕심은 끝이 없어 하나를 이루면 더 바라게 된다는 뜻이에요.' },
    { id:'h05', level:'hard', category:'원인과 결과', before:'아니 땐 굴뚝에', after:'날까.', answer:'연기', choices:['연기','바람','재'], hint:'원인이 전혀 없으면 결과도 생기지 않아요.', note:'원인이 없으면 결과가 있을 수 없다는 뜻이에요.' },
    { id:'h06', level:'hard', category:'처지', before:'우물 안', after:'.', answer:'개구리', choices:['개구리','잉어','두꺼비'], hint:'자기가 아는 좁은 세상만 전부라고 여기는 사람을 가리켜요.', note:'넓은 세상을 알지 못하고 자기 경험만으로 판단하는 사람을 이르는 말이에요.' },
    { id:'h07', level:'hard', category:'관계', before:'도둑이 제 발', after:'.', answer:'저리다', choices:['저리다','빠르다','아프다'], hint:'잘못한 사람은 괜히 불안해하는 모습을 보일 수 있어요.', note:'잘못한 사람은 들키지 않았는데도 제 발이 저린 것처럼 불안해한다는 뜻이에요.' },
    { id:'h08', level:'hard', category:'경험', before:'낫 놓고', after:'자도 모른다.', answer:'기역', choices:['기역','시옷','니은'], hint:'눈앞에 있어도 기초적인 것을 모르는 경우를 말해요.', note:'아주 쉬운 글자도 모를 만큼 무식하거나 무관심하다는 뜻이에요.' },
    { id:'h09', level:'hard', category:'주의', before:'소 잃고', after:'고친다.', answer:'외양간', choices:['외양간','마구간','울타리'], hint:'일이 벌어진 뒤에야 뒤늦게 대비해요.', note:'이미 일을 그르친 뒤에 뒤늦게 손을 써도 소용없다는 뜻이에요.' },
    { id:'h10', level:'hard', category:'배움', before:'서당 개 삼 년이면', after:'을 읊는다.', spaceAfter:false, answer:'풍월', choices:['풍월','시조','속담'], hint:'오래 듣고 보다 보면 어깨너머로도 배우게 돼요.', note:'어떤 분야에 오래 있으면 잘 몰라도 어느 정도 익히게 된다는 뜻이에요.' },
    { id:'h11', level:'hard', category:'말과 행동', before:'발 없는 말이', after:'간다.', answer:'천 리', choices:['천 리','만 리','백 리'], hint:'말은 사람들의 입을 거치며 아주 멀리 퍼져요.', note:'말은 빠르게 퍼지므로 남의 이야기를 함부로 하지 말라는 뜻이에요.' },
    { id:'h12', level:'hard', category:'관계', before:'열 손가락 깨물어 안 아픈', after:'없다.', answer:'손가락', choices:['손가락','사람','자식'], hint:'부모에게는 어느 자식이나 똑같이 소중해요.', note:'부모에게는 자식 모두가 귀하고 소중하다는 뜻이에요.' },
  ];
  return { version:1, questions };
})();
if (typeof module !== 'undefined') module.exports = ProverbQuizBank;
