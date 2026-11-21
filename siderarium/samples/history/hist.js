global.window = global; global.Astronomy = require(process.env.ASTRONOMY || 'astronomy-engine');
const R=__dirname + '/../../js/';
['color','correspondences','engine'].forEach(f=>require(R+f+'.js'));
const EV=require('./history.json');
function metrics(s){
  const c=s.configs, figs=[c.primary,...c.secondary].filter(Boolean);
  return { primary: c.primary?c.primary.power:0, intensity: figs.reduce((a,f)=>a+f.power,0),
    rarity: c.primary?c.primary.rarity:0, outerExact: s.events.filter(e=>e.type==='outer exact').length,
    special: s.events.filter(e=>['eclipse','lunation','cazimi','station'].includes(e.type)).length };
}
let seed=7; const rnd=()=>{seed=(seed*1103515245+12345)%2147483648; return seed/2147483648;};
const base={primary:[],intensity:[],rarity:[]};
const t0=Date.parse('1900-01-01'), t1=Date.parse('2030-01-01');
for(let i=0;i<1500;i++){const e=EV[i%EV.length]; const s=SD.engine.compute(new Date(t0+rnd()*(t1-t0)),{name:'x',lat:e.lat,lon:e.lon,tz:'UTC'}); const m=metrics(s); for(const k in base) base[k].push(m[k]);}
for(const k in base) base[k].sort((a,b)=>a-b);
const pct=(k,v)=>Math.round(100*base[k].filter(x=>x<v).length/base[k].length);
const rows=[];
for(const e of EV){
  const s=SD.engine.compute(new Date(e.iso),{name:e.name,lat:e.lat,lon:e.lon,tz:e.tz,zoneLabel:e.zoneLabel});
  const m=metrics(s), p=s.configs.primary;
  rows.push({id:e.id,label:e.label,fig:p?`${p.a} ${p.aspect} ${p.b}`+(p.event?` (${p.event})`:''):'quiet',orb:p?p.orb.toFixed(2):'',
    primary:m.primary.toFixed(2),pPrimary:pct('primary',m.primary),pIntensity:pct('intensity',m.intensity),pRarity:pct('rarity',m.rarity),
    moon:s.moon.verdict+(s.moon.next?` → ${s.moon.next.aspect} ${s.moon.next.planet}`:''),scale:s.configs.scale.toFixed(2),cut:s.configs.cut?s.configs.cut.by:'',
    events:s.events.map(x=>x.type+(x.planet?' '+x.planet:'')+(x.kind?' '+x.kind:'')).join(', ')});
}
console.table(rows.map(r=>({id:r.id,fig:r.fig,orb:r.orb,P:r.primary,'%prim':r.pPrimary,'%int':r.pIntensity,'%rare':r.pRarity,moon:r.moon,scale:r.scale,cut:r.cut})));
rows.forEach(r=>console.log(r.id,'|',r.events));
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
console.log('mean percentile primary',mean(rows.map(r=>r.pPrimary)).toFixed(1),'intensity',mean(rows.map(r=>r.pIntensity)).toFixed(1),'rarity',mean(rows.map(r=>r.pRarity)).toFixed(1));
require('fs').writeFileSync('history-results.json',JSON.stringify(rows,null,1));
