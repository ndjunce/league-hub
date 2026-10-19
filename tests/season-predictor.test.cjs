const assert=require('node:assert/strict'),S=require('../assets/standings-scenarios.js');
const {normalizeScoreboard}=require('../api/nfl-status.js');
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const game=(period,homeId,awayId,extra={})=>({period,homeId,awayId,snapshotHomePts:100,snapshotAwayPts:90,snapshotFinal:false,playersFinished:false,...extra});
function fixture(){
  const D={week:2,regWeeks:3,teams:[1,2,3,4].map(id=>({id})),games:[game(2,1,2),game(2,3,4),game(3,1,3),game(3,2,4)]};
  const snap={reason:null,rows:[{id:1,w:2,l:0,t:0,pf:220},{id:2,w:0,l:2,t:0,pf:190},{id:3,w:2,l:0,t:0,pf:210},{id:4,w:0,l:2,t:0,pf:180}]};
  return {D,snap};
}
test('all starters in finished games completes, including an inactive starter',()=>{assert.equal(S.completion([{proTeamId:1},{proTeamId:2}],{teams:{1:{done:true},2:{done:true}}}).done,true);});
test('one Monday starter blocks completion; bench players are not an input',()=>{const c=S.completion([{proTeamId:1},{proTeamId:2}],{teams:{1:{done:true},2:{done:false}}});assert.equal(c.done,false);assert.equal(c.remaining,1);});
test('bye starter is finished, unknown/FA status is conservative',()=>{assert.equal(S.completion([{proTeamId:1}],{teams:{1:{done:true,state:'bye'}}}).done,true);assert.equal(S.completion([{proTeamId:0}],{teams:{}}).unknown,1);assert.equal(S.completion([],{}).done,false);});
test('missing NFL feed cannot infer final',()=>{assert.equal(S.completion([{proTeamId:1}],null).done,false);});
test('unpicked games add no results; existing current-score assumptions removed',()=>{const {D,snap}=fixture(),before=JSON.stringify({D,snap});const r=S.scenario(D,snap);assert.equal(r.left,4);assert.equal(r.rows.find(t=>t.id===1).w,1);assert.equal(r.rows.find(t=>t.id===2).l,1);assert.equal(r.rows[0].pf,220);assert.equal(JSON.stringify({D,snap}),before);});
test('picks produce exact final records and update ranks',()=>{const {D,snap}=fixture();const picks=Object.fromEntries(D.games.map(g=>[S.key(g),'AWAY']));const r=S.scenario(D,snap,picks);assert.equal(r.left,0);assert.equal(r.rows.reduce((n,t)=>n+t.w,0),6);assert.equal(r.rows.reduce((n,t)=>n+t.l,0),6);assert.equal(r.rows.find(t=>t.id===4).w,2);assert.equal(r.rows.every(t=>t.w+t.l+t.t===3),true);});
test('tie choices add one tie to both teams',()=>{const {D,snap}=fixture(),r=S.scenario(D,snap,{[S.key(D.games[0])]:'TIE'});assert.equal(r.rows.find(t=>t.id===1).t,1);assert.equal(r.rows.find(t=>t.id===2).t,1);assert.equal(r.left,3);});
test('finished starter matchups and ESPN finals are locked',()=>{const {D,snap}=fixture();D.games[0].playersFinished=true;D.games[1].snapshotFinal=true;D.games[1].winner='HOME';const picks=Object.fromEntries(D.games.map(g=>[S.key(g),'AWAY']));const r=S.scenario(D,snap,picks);assert.equal(r.total,2);assert.equal(r.rows.find(t=>t.id===1).w,2);assert.deepEqual(Object.keys(S.cleanPicks(picks,D.games)).sort(),D.games.slice(2).map(S.key).sort());});
test('reset has no picks; malformed or stale storage choices are discarded',()=>{const {D,snap}=fixture();assert.equal(S.scenario(D,snap,{}).picked,0);assert.deepEqual(S.cleanPicks(null,D.games),{});assert.deepEqual(S.cleanPicks({bogus:'HOME',[S.key(D.games[0])]:'BAD'},D.games),{});assert.deepEqual(S.cleanPicks([],D.games),{});});
test('future schedule duplicates or omissions suppress final seeding',()=>{const {D,snap}=fixture();D.games.pop();assert.match(S.scenario(D,snap).reason,/complete/);D.games.push(D.games[0]);assert.match(S.scenario(D,snap).reason,/duplicate/);});
test('half wins and fixed PF sort; exact ties share seed',()=>{const rows=S.rank([{id:1,w:1,l:1,t:0,pf:150},{id:2,w:0,l:0,t:2,pf:160},{id:3,w:0,l:0,t:2,pf:160}]);assert.equal(rows[0].id,2);assert.equal(rows[0].rank,rows[1].rank);assert.equal(rows[2].rank,3);});
function scoreboard(){return {season:{year:2026},week:{number:6,teamsOnBye:[{id:'3'}]},events:[{season:{year:2026},week:{number:6},status:{type:{completed:true,state:'post',description:'Final'}},competitions:[{competitors:[{team:{id:'1'}},{team:{id:'2'}}]}]}]};}
test('ESPN normalization confirms completed games and explicit byes',()=>{const r=normalizeScoreboard(scoreboard(),2026,6);assert.equal(r.teams[1].done,true);assert.equal(r.teams[3].state,'bye');assert.equal(r.source,'ESPN NFL scoreboard');});
test('postponed and live games remain unfinished even if start time has passed',()=>{const d=scoreboard();d.events[0].status.type={state:'pre',completed:false,name:'STATUS_POSTPONED'};assert.equal(normalizeScoreboard(d,2026,6).teams[1].done,false);d.events[0].status.type={state:'in',completed:false};assert.equal(normalizeScoreboard(d,2026,6).teams[1].done,false);});
test('wrong year/week or empty feed fails closed',()=>{assert.throws(()=>normalizeScoreboard(scoreboard(),2025,6));assert.throws(()=>normalizeScoreboard(scoreboard(),2026,7));const d=scoreboard();d.events=[];d.week.teamsOnBye=[];assert.throws(()=>normalizeScoreboard(d,2026,6));});
test('unknown status stays unknown even if a team object exists',()=>{assert.equal(S.completion([{proTeamId:1}],{teams:{1:{done:false,state:'unknown'}}}).unknown,1);});
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const app=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1];
function storageContext(storage){
  const ctx=vm.createContext({LEAGUE:{id:'963488',season:'2026'},HubScenarios:S,localStorage:storage});
  vm.runInContext(app.slice(app.indexOf('let SEASON_PICKS='),app.indexOf('// The ONE official standings table')),ctx);
  return ctx;
}
test('browser storage denial keeps usable in-memory picks and reports no persistence',()=>{
  const ctx=storageContext({getItem(){throw new Error('blocked');},setItem(){throw new Error('quota');}}),{D}=fixture();
  ctx.loadSeasonPicks(D);assert.equal(vm.runInContext('SEASON_PICKS.persistent',ctx),false);
  vm.runInContext('SEASON_PICKS.picks={"2:1:2":"HOME"}',ctx);ctx.saveSeasonPicks();
  assert.equal(vm.runInContext('SEASON_PICKS.picks["2:1:2"]',ctx),'HOME');
});
test('saved picks use a league-season key and reset removes only that key',()=>{
  const store=new Map([['bs-theme','dark']]),ctx=storageContext({getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}),{D}=fixture();
  ctx.loadSeasonPicks(D);ctx.saveSeasonPicks();assert.ok(store.has('hub-season-predictor:963488:2026:v1'));ctx.saveSeasonPicks(true);assert.equal(store.has('hub-season-predictor:963488:2026:v1'),false);assert.equal(store.get('bs-theme'),'dark');
});
test('corrupt stored JSON is ignored without claiming storage is unavailable',()=>{
  const ctx=storageContext({getItem:()=>'{bad json'}),{D}=fixture();ctx.loadSeasonPicks(D);assert.equal(vm.runInContext('Object.keys(SEASON_PICKS.picks).length',ctx),0);assert.equal(vm.runInContext('SEASON_PICKS.persistent',ctx),true);
});
const entry=(slot,proTeamId)=>({lineupSlotId:slot,playerPoolEntry:{player:{proTeamId}}});
test('partial scoring roster cannot hide an unplayed Monday starter',()=>{
  const lineup=S.starterLineup([entry(0,1)],[entry(0,1),entry(2,25),entry(20,7)],[0,2]);
  assert.equal(lineup.complete,true);assert.equal(lineup.source,'current starting lineup');
  const status={teams:{1:{done:true,state:'post'},25:{done:false,state:'pre'},7:{done:false,state:'pre'}}};
  const c=S.completion(lineup.starters,status,lineup.complete);assert.equal(c.done,false);assert.equal(c.remaining,1);assert.equal(c.total,2);
});
test('incomplete lineup coverage cannot infer final from all returned players being done',()=>{
  const lineup=S.starterLineup([entry(0,1)],[],[0,2]);assert.equal(lineup.complete,false);
  const c=S.completion(lineup.starters,{teams:{1:{done:true,state:'post'}}},lineup.complete);assert.equal(c.done,false);assert.equal(c.unknown,1);
});
test('current full lineup takes precedence over a full but conflicting scoring roster',()=>{
  const lineup=S.starterLineup([entry(0,1),entry(0,1)],[entry(0,25),entry(2,1)],[0,2]);
  assert.equal(lineup.starters[0].proTeamId,25);assert.equal(lineup.complete,true);
});
test('future week stays pickable after it starts and rolls off after every matchup finishes',()=>{
  const {D,snap}=fixture();D.week=3;D.games=D.games.filter(g=>g.period===3);
  const r=S.scenario(D,snap);assert.equal(r.total,2);D.games.forEach(g=>g.playersFinished=true);
  assert.equal(S.scenario(D,snap).total,0);
});
test('bubble includes all alive below line and only up to one win above',()=>{
  assert.equal(S.playoffStatus({inNow:false,wins:0,cutoffWins:5}),'bubble');
  assert.equal(S.playoffStatus({inNow:true,wins:6,cutoffWins:5}),'bubble');
  assert.equal(S.playoffStatus({inNow:true,wins:6.5,cutoffWins:5}),'in');
  assert.equal(S.playoffStatus({inNow:false,wins:0,cutoffWins:5,eliminated:true}),'elim');
  assert.equal(S.playoffStatus({inNow:true,wins:5,cutoffWins:5,clinchedIn:true}),'clinched');
});
console.log(`${passed} checks passed`);
