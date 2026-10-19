// Run: node tests/score-held-standings.test.cjs
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1];
new Function(script); // syntax check the full application, not only the extracted helpers
const context=vm.createContext({standingsList:D=>D.teams.slice().sort((a,b)=>(b.record.w-a.record.w)||(b.pf-a.pf)).map((t,i)=>({id:t.id,rank:i+1})),esc:String,avatarHtml:()=>''});
vm.runInContext(script.slice(script.indexOf('function scoreHeldStandings('),script.indexOf('// The ONE official standings table')),context);
const calculate=context.scoreHeldStandings;
const game=(period,h,a,hp,ap,final=false,winner='UNDECIDED')=>({period,homeId:h,awayId:a,snapshotHomePts:hp,snapshotAwayPts:ap,snapshotFinal:final,winner});
function fixture(){
  const teams=[1,2,3,4].map(id=>({id,short:'Team '+id,disp:'Team '+id,record:{w:id%2?1:0,l:id%2?0:1,t:0},pf:[100,90,110,80][id-1]}));
  return {provider:'espn',week:2,regWeeks:14,playoffTeams:2,seedingRule:'TOTAL_POINTS_SCORED',teams,byId:Object.fromEntries(teams.map(t=>[t.id,t])),games:[game(1,1,2,100,90,true,'HOME'),game(1,3,4,110,80,true,'HOME'),game(2,1,3,85.23,90.11),game(2,2,4,95,60)]};
}
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
test('current leads change records, points and ranks without mutating official data',()=>{
  const D=fixture(),before=JSON.stringify(D),r=calculate(D); assert.equal(r.pending,2);assert.equal(r.rows[0].id,3);
  const nick=r.rows.find(t=>t.id===1);assert.equal(nick.w,1);assert.equal(nick.l,1);assert.ok(Math.abs(nick.pf-185.23)<1e-8);assert.equal(JSON.stringify(D),before);
});
test('pending Monday matchup stays provisional even with nonzero totals',()=>{const D=fixture();D.games[2].live=false;D.games[2].finalized=false;assert.equal(calculate(D).pending,2);assert.match(context.scoreHeldPanel(D),/IN PROGRESS — NOT FINAL/);});
test('updated official records cannot double count the current week',()=>{const D=fixture(),before=calculate(D);D.teams.forEach(t=>{const r=before.rows.find(r=>r.id===t.id);t.record={w:r.w,l:r.l,t:r.t};t.pf=r.pf;});const after=calculate(D);assert.equal(JSON.stringify(after.rows.map(({move,...r})=>r)),JSON.stringify(before.rows.map(({move,...r})=>r)));});
test('all-final week is included exactly once',()=>{const D=fixture();D.games.slice(2).forEach(g=>{g.snapshotFinal=true;g.winner=g.snapshotHomePts>g.snapshotAwayPts?'HOME':'AWAY';});const r=calculate(D);assert.equal(r.pending,0);assert.equal(r.rows.reduce((n,t)=>n+t.w,0),4);});
test('current equal scores produce provisional ties',()=>{const D=fixture();D.games[2].snapshotAwayPts=D.games[2].snapshotHomePts;const r=calculate(D);assert.equal(r.rows.find(t=>t.id===1).t,1);assert.equal(r.rows.find(t=>t.id===3).t,1);});
test('all-zero week has no fabricated 0-0 ties',()=>{const D=fixture();D.games.slice(2).forEach(g=>g.snapshotHomePts=g.snapshotAwayPts=0);assert.equal(calculate(D).rows.length,0);assert.match(calculate(D).reason,/No scores yet/);});
test('zero-point final ties are valid',()=>{const D=fixture();D.games[2]=game(2,1,3,0,0,true,'TIE');assert.equal(calculate(D).rows.find(t=>t.id===1).t,1);});
test('negative scores remain negative',()=>{const D=fixture();D.games[2].snapshotHomePts=-2;D.games[2].snapshotAwayPts=-4;assert.equal(calculate(D).rows.find(t=>t.id===1).w,2);});
test('official winner handles adjudicated final results',()=>{const D=fixture();D.games[2].snapshotFinal=true;D.games[2].winner='HOME';assert.equal(calculate(D).rows.find(t=>t.id===1).w,2);});
test('missing or duplicated matchup prevents misleading standings',()=>{const D=fixture();D.games.pop();assert.equal(calculate(D).rows.length,0);const E=fixture();E.games.push(E.games[0]);assert.match(calculate(E).reason,/duplicate/);});
test('missing scores are not silently converted to zero',()=>{const D=fixture();D.games[2].snapshotHomePts=null;assert.match(calculate(D).reason,/scores/);});
test('postseason and unsupported seeding fail clearly',()=>{const D=fixture();D.week=15;assert.match(calculate(D).reason,/Playoff/);D.week=2;D.seedingRule='HEAD_TO_HEAD';assert.match(calculate(D).reason,/seeding/);});
test('full precision determines PF order, exact ties share a rank',()=>{const D=fixture();D.games=[game(1,1,2,10.01,5,true,'HOME'),game(1,3,4,10.02,5,true,'HOME')];D.week=1;D.teams.forEach(t=>{t.record={w:0,l:0,t:0};t.pf=0;});let r=calculate(D);assert.equal(r.rows[0].id,3);D.games[0].snapshotHomePts=10.02;r=calculate(D);assert.equal(r.rows[0].rank,r.rows[1].rank);});
test('half-win ties rank correctly',()=>{const D=fixture();D.games[0]=game(1,1,2,100,100,true,'TIE');D.teams[0].record={w:0,l:0,t:1};D.teams[1].record={w:0,l:0,t:1};D.teams[1].pf=100;D.games[2]=game(2,1,3,100,100,true,'TIE');const r=calculate(D);assert.equal(r.rows.find(t=>t.id===3).rank,1);});
test('historical placeholder scores or inconsistent records suppress projection',()=>{const D=fixture();D.games[0].snapshotHomePts=0;assert.match(calculate(D).reason,/synchronized/);const E=fixture();E.teams[0].record.w=9;assert.match(calculate(E).reason,/synchronized/);});
// Evaluate the exact production score extractor in isolation too.
const start=script.indexOf('    function snapshotSideScore('),end=script.indexOf('    // games from schedule;',start);
vm.runInContext(script.slice(start,end),context);
test('score extractor preserves decimals, negatives, and excludes bench/IR',()=>{
  const side={totalPoints:0,rosterForMatchupPeriod:{entries:[{lineupSlotId:0,playerPoolEntry:{appliedStatTotal:1.234}},{lineupSlotId:2,playerPoolEntry:{appliedStatTotal:-3}},{lineupSlotId:20,playerPoolEntry:{appliedStatTotal:99}},{lineupSlotId:21,playerPoolEntry:{appliedStatTotal:99}}]}};
  assert.ok(Math.abs(context.snapshotSideScore(side,false)+1.766)<1e-8);assert.equal(context.snapshotSideScore({...side,totalPoints:-2},false),-2);assert.equal(context.snapshotSideScore(side,true),0);assert.equal(context.snapshotSideScore({},false),null);
});
console.log(`${count} checks passed`);
