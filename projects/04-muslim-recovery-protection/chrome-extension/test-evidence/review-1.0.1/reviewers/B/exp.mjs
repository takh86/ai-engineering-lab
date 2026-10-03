const R='/home/user/ai-engineering-lab/projects/04-muslim-recovery-protection/chrome-extension/src/';
const {exportSettings,mergeImport,defaultConfig,settingsOf,weakeningReasons}=await import(R+'core/config.js');
const host=i=>`${'a'.repeat(60)}.${'b'.repeat(60)}.${'c'.repeat(60)}.h${String(i).padStart(4,'0')}${'d'.repeat(5)}.com`;
const cfg={...defaultConfig(),domains:Array.from({length:1000},(_,i)=>host(i)).map(h=>h.slice(0,253))};
const text=JSON.stringify(exportSettings(cfg),null,2);
console.log('max-ish export chars',text.length,'limit 262144 ->',text.length>262144?'self-export not re-importable':'ok');
// import exception injection (no lock)
const cur=settingsOf({...defaultConfig(),domains:['example.org']});
const evil=JSON.stringify({format:'tabsira-settings',version:2,settings:{baseList:false,starterTerms:false,domains:[],allow:['pornhub.com','xvideos.com'],words:[],contains:[]}});
const merged=mergeImport(cur,evil);console.log('merged allow',merged.allow,'baseList',merged.baseList,'weakening vs current (no lock check at import):',weakeningReasons({...defaultConfig(),...cur},{...defaultConfig(),...merged}));
