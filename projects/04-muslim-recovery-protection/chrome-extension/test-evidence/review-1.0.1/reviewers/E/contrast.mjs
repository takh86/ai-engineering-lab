const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const navy='#0B3B8F',royal='#1456C5',lime='#B7E445',sky='#5F8FD9',surf='#F3F6FB';
const L={bg:surf,card:'#FFFFFF',ink:'#0F2347',muted:'#44546F',line:'#CBD6EA',field:'#5B6E92',link:royal,heading:navy,pbg:lime,pink:navy,phover:'#A7D635',sbg:'#FFFFFF',sink:navy,sborder:royal,shover:'#E6EEFB',focus:navy,halo:'#FFFFFF',infobg:'#E6EEFB',infoink:'#0F2347',infob:royal,warnbg:'#FFF3D6',warnink:'#5C3A00',warnb:'#8A5A00',dbg:'#FDECEA',dink:'#8E1B10',db:'#B42318',nbg:'#E9EEF6',nink:'#1F3050',nb:'#5B6E92'};
const D={bg:'#071A3F',card:'#0E2859',ink:'#EAF0FB',muted:'#B8C7E3',line:'#2B4A86',field:'#8FA6D2',link:'#9DBDF5',heading:'#FFFFFF',pbg:lime,pink:'#0B2A66',phover:'#CBEF6A',sbg:'#0E2859'/*transparent over card; on bg page also*/,sink:'#EAF0FB',sborder:'#9DBDF5',shover:'#163872',focus:lime,halo:'#071A3F',infobg:'#123271',infoink:'#EAF0FB',infob:'#9DBDF5',warnbg:'#4A3305',warnink:'#FFE6A8',warnb:'#E3B341',dbg:'#561912',dink:'#FFD3CD',db:'#FF8F82',nbg:'#14305F',nink:'#EAF0FB',nb:'#8FA6D2'};
const pairs=(T)=>[
['body text on bg',T.ink,T.bg,4.5],['body text on card',T.ink,T.card,4.5],
['muted (hint/tag/lock) on card',T.muted,T.card,4.5],['muted on bg (.tag in brandbar/onboarding)',T.muted,T.bg,4.5],
['heading on card',T.heading,T.card,4.5],['heading on bg',T.heading,T.bg,4.5],
['link on card',T.link,T.card,4.5],['link on bg',T.link,T.bg,4.5],
['primary btn',T.pink,T.pbg,4.5],['primary btn hover',T.pink,T.phover,4.5],['primary btn disabled (opacity .55 over card)',null,null,4.5],
['secondary btn text on card',T.sink,T.card,4.5],['secondary btn hover',T.sink,T.shover,4.5],
['secondary border vs card (non-text 3:1)',T.sborder,T.card,3],['secondary border vs bg',T.sborder,T.bg,3],
['field border vs card (3:1)',T.field,T.card,3],
['line (card border) vs bg (informational, decorative)',T.line,T.bg,3],
['steps inactive li (line) vs card (3:1 progress indicator)',T.line,T.card,3],['steps current (link) vs card',T.link,T.card,3],
['timer track (line) vs card',T.line,T.card,3],['timer progress (link) vs card',T.link,T.card,3],
['focus ring vs card (3:1)',T.focus,T.card,3],['focus ring vs bg',T.focus,T.bg,3],['focus ring vs primary btn (lime)',T.focus,T.pbg,3],['focus ring vs halo',T.focus,T.halo,3],
['info status text',T.infoink,T.infobg,4.5],['info status border vs bg',T.infob,T.card,3],['info status text on card? n/a',null],
['warn text',T.warnink,T.warnbg,4.5],['warn border vs card',T.warnb,T.card,3],
['danger status text',T.dink,T.dbg,4.5],['danger btn text',T.dink,T.dbg,4.5],['danger border vs card',T.db,T.card,3],
['neutral text',T.nink,T.nbg,4.5],['neutral border vs card',T.nb,T.card,3],
['.msg.error text on card (danger-ink)',T.dink,T.card,4.5],['.msg.error text on bg (danger-ink, popup/onboarding? )',T.dink,T.bg,4.5],['.msg.ok (info-ink) on card',T.infoink,T.card,4.5],
['onboarding msg.error on bg',T.dink,T.bg,4.5],
['confirm text on warn bg',T.warnink,T.warnbg,4.5],['confirm secondary btn: ink on card',T.ink,T.card,4.5],
['lime (brand) vs card (non-text: primary btn boundary)',T.pbg,T.card,3],['lime vs bg (primary btn boundary light)',T.pbg,T.bg,3],
['checkbox accent royal vs card',royal,T.card,3],
];
for (const [name,T] of [['LIGHT',L],['DARK',D]]){console.log('==',name);for(const [n,a,b,min] of pairs(T)){if(!a||!b)continue;const r=cr(a,b);console.log((r>=min?'ok  ':'FAIL')+' '+r.toFixed(2).padStart(6)+' (min '+min+') '+n+' '+a+' on '+b)}}
// disabled primary btn: opacity .55 whole element composite over card
const mix=(f,b,a)=>'#'+[1,3,5].map(i=>Math.round(parseInt(f.slice(i,i+2),16)*a+parseInt(b.slice(i,i+2),16)*(1-a)).toString(16).padStart(2,'0')).join('');
for (const [n,T] of [['light',L],['dark',D]]){const bg=mix(T.pbg,T.card,.55),fg=mix(T.pink,T.card,.55);console.log('disabled primary',n,cr(fg,bg).toFixed(2),'(WCAG exempts disabled controls)');}
