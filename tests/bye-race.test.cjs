const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');
function load(file){
  const html=fs.readFileSync(file,'utf8');
  const c=vm.createContext({LEAGUE:{season:2026},performance,HubScenarios:require('../assets/standings-scenarios.js'),esc:String,pts:x=>Number(x).toFixed(1),avatarHtml:()=>''});
  vm.runInContext(html.slice(html.indexOf('// standings sorted by W'),html.indexOf('// The playoff engine runs AFTER')),c);return c;
}
function fixture(){
  const teams=Array.from({length:12},(_,i)=>({id:i+1,disp:`Team ${i+1}`,short:`T${i+1}`,record:{w:6-i%7,l:i%7,t:0},pf:700-i*5,projTeam:100+i}));
  const games=[];for(let w=1;w<=14;w++)for(let i=0;i<6;i++)games.push({period:w,homeId:i+1,awayId:7+(i+w)%6,homePts:90+i+w,awayPts:120-i-w});
  return {teams,byId:Object.fromEntries(teams.map(t=>[t.id,t])),games,week:7,regWeeks:14,playoffTeams:7,byes:1,size:12};
}
const c=load(path.join(__dirname,'../index.html')),D=fixture();let passed=0;
function test(name,f){f();passed++;console.log('PASS '+name);}
test('no byes hides bye column while retaining playoff table',()=>{const html=c.byeRacePanel({...D,byes:0},null);assert.match(html,/Playoff odds/);assert.ok(!html.includes('>Bye odds<'));});
test('bye race counts tied games as half wins before applying PF',()=>{const d=fixture();d.teams.forEach(t=>{t.record={w:0,l:6,t:0};});d.teams[0].record={w:4,l:2,t:0};d.teams[1].record={w:3,l:1,t:2};d.teams[1].pf=999;assert.match(c.byeRacePanel(d,null),/T2 \(3-1-2, 999.0 PF\) leads today/);});
const mc=c.monteCarlo(D),cm=c.clinchMath(D).byId;
test('conditional partitions exactly match bye counts for every game and team',()=>{for(let g=0;g<mc.rem.length;g++)for(const t of D.teams){const i=mc.ix[t.id];assert.ok(Math.abs(mc.byeCond[g*2*mc.NT+i]+mc.byeCond[(g*2+1)*mc.NT+i]-mc.teams[t.id].pBye*mc.N)<1e-8);}});
test('bye probabilities total one seed',()=>assert.ok(Math.abs(Object.values(mc.teams).reduce((a,t)=>a+t.pBye,0)-1)<1e-10));
test('low sample conditional result is suppressed',()=>{const mock={...mc,homeWins:new Uint32Array(mc.rem.length)};assert.equal(c.conditionalBye(mock,0,1,true),null);});
test('tied records with games remaining cannot clinch the bye on current PF',()=>{const d=fixture();d.teams.forEach(t=>{t.record={w:3,l:3,t:0};});assert.equal(Object.values(c.clinchMath(d).byId).some(x=>x.clinchedBye),false);});
test('race includes all mathematically alive teams and labels assumptions',()=>{const html=c.byeRacePanel(D,{mc,cm});for(const t of D.teams.filter(t=>!cm[t.id].byeGone))assert.ok(html.includes(t.short));assert.match(html,/Official records/);assert.match(html,/conditional simulation estimates/);assert.match(html,/Season Predictor picks do not change/);});
test('clinched and bye-eliminated labels are separate from playoff elimination',()=>{const d=fixture();d.games=d.games.filter(g=>g.period<d.week);const math=c.clinchMath(d).byId;const html=c.byeRacePanel(d,{mc:null,cm:math});assert.match(html,/Clinched bye/);assert.match(html,/Out of bye race/);assert.match(html,/does not mean elimination from the playoffs/);});
test('multiple bye seeds sum to the configured allocation',()=>{const m=c.monteCarlo({...D,byes:2});assert.ok(Math.abs(Object.values(m.teams).reduce((a,t)=>a+t.pBye,0)-2)<1e-10);});
if(process.argv[2]){
  const base=load(process.argv[2]),a=base.monteCarlo(D),b=c.monteCarlo(D);
  test('all existing simulation outputs unchanged versus pre-feature baseline',()=>{for(const key of ['N','NT','n','sigma','K','L','sdTheta','rem','ix','cond','homeWins','teams'])assert.equal(JSON.stringify(b[key]),JSON.stringify(a[key]),key);});
  const times={base:[],new:[]};for(let i=0;i<9;i++){times.base.push(base.monteCarlo(D).simMs);times.new.push(c.monteCarlo(D).simMs);}
  const median=a=>a.slice(2).sort((x,y)=>x-y)[3],old=median(times.base),now=median(times.new);
  console.log(JSON.stringify({baselineMedianMs:old,previewMedianMs:now,overheadPercent:100*(now/old-1)}));
  test('warmed simulation overhead at most 25% and 250ms',()=>{assert.ok(now<=old*1.25);assert.ok(now-old<=250);});
}
console.log(`${passed} bye-race checks passed`);
