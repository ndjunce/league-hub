// Pure, ESPN-only helpers shared by the UI and offline checks.
(function(root){
  'use strict';
  const VALID=new Set(['HOME','AWAY','TIE']);
  function resultOf(g){
    if(g.snapshotFinal && VALID.has(g.winner)) return g.winner;
    return Math.abs(g.snapshotHomePts-g.snapshotAwayPts)<1e-8?'TIE':g.snapshotHomePts>g.snapshotAwayPts?'HOME':'AWAY';
  }
  function done(g){return !!(g.snapshotFinal||g.playersFinished);}
  function starterLineup(matchupEntries,currentEntries,startSlots){
    const needs=new Map();for(const slot of startSlots)needs.set(slot,(needs.get(slot)||0)+1);
    const current=Array.isArray(currentEntries)?currentEntries.filter(e=>needs.has(e.lineupSlotId)):[];
    const snapshot=Array.isArray(matchupEntries)?matchupEntries.filter(e=>e.lineupSlotId!==20&&e.lineupSlotId!==21):[];
    // mRoster has the complete lineup; matchup scoring entries can omit players
    // with no points yet and use placeholder slot 0 for every player.
    const entries=current.length?current:snapshot,source=current.length?'current starting lineup':'matchup roster';
    const counts=new Map();for(const e of current)counts.set(e.lineupSlotId,(counts.get(e.lineupSlotId)||0)+1);
    const complete=startSlots.length>0 && entries.length===startSlots.length &&
      (!current.length || [...needs].every(([slot,count])=>counts.get(slot)===count));
    const starters=entries.map(e=>({proTeamId:(e.playerPoolEntry?.player||e.player||{}).proTeamId}));
    return {starters,complete,source};
  }
  function completion(starters,status,rosterComplete=true){
    if(!Array.isArray(starters)||!starters.length) return {done:false,remaining:0,unknown:1,total:0};
    let remaining=0,unknown=rosterComplete?0:1;
    for(const player of starters){
      const team=status?.teams?.[player.proTeamId];
      if(!team || team.state==='unknown' || typeof team.done!=='boolean') unknown++;
      else if(!team.done) remaining++;
    }
    return {done:remaining===0&&unknown===0,remaining,unknown,total:starters.length};
  }
  function rank(rows){
    const sorted=rows.slice().sort((a,b)=>(b.w+b.t/2-a.w-a.t/2)||(b.pf-a.pf)||(a.id-b.id));
    sorted.forEach((r,i)=>{
      const prev=sorted[i-1];
      r.rank=prev && r.w+r.t/2===prev.w+prev.t/2 && Math.abs(r.pf-prev.pf)<1e-8?prev.rank:i+1;
    });
    return sorted;
  }
  function apply(rows,g,result,delta){
    const h=rows.get(g.homeId),a=rows.get(g.awayId);
    if(result==='HOME'){h.w+=delta;a.l+=delta;}
    else if(result==='AWAY'){a.w+=delta;h.l+=delta;}
    else{h.t+=delta;a.t+=delta;}
  }
  const key=g=>`${g.period}:${g.homeId}:${g.awayId}`;
  function playoffStatus({inNow,wins,cutoffWins,clinchedBye,clinchedIn,eliminated}){
    if(clinchedBye)return 'bye';if(clinchedIn)return 'clinched';if(eliminated)return 'elim';
    return inNow&&wins-cutoffWins>1?'in':'bubble';
  }
  function scenario(D,snapshot,picks={}){
    if(snapshot.reason) return {reason:snapshot.reason,rows:[],games:[]};
    const all=D.games.filter(g=>g.period>=D.week&&g.period<=D.regWeeks);
    const ids=new Set(D.teams.map(t=>t.id)),seen=new Set();
    for(const g of all){
      if(!ids.has(g.homeId)||!ids.has(g.awayId)||g.homeId===g.awayId)
        return {reason:'ESPN has not supplied a complete remaining schedule.',rows:[],games:[]};
      for(const id of [g.homeId,g.awayId]){
        const slot=`${g.period}:${id}`;
        if(seen.has(slot)) return {reason:'ESPN returned duplicate remaining matchups.',rows:[],games:[]};
        seen.add(slot);
      }
    }
    for(let w=D.week;w<=D.regWeeks;w++) for(const id of ids)
      if(!seen.has(`${w}:${id}`)) return {reason:'ESPN has not supplied a complete remaining schedule.',rows:[],games:[]};
    const rows=new Map(snapshot.rows.map(r=>[r.id,{...r}]));
    const games=all.filter(g=>!done(g)).sort((a,b)=>(a.period-b.period)||(a.homeId-b.homeId));
    // Snapshot already includes current score leaders: remove every unfinished
    // result before applying personal picks. Current points remain the tiebreak.
    for(const g of games) if(g.period===D.week) apply(rows,g,resultOf(g),-1);
    let picked=0;
    for(const g of games){const choice=picks[key(g)];if(VALID.has(choice)){apply(rows,g,choice,1);picked++;}}
    return {reason:null,rows:rank([...rows.values()]),games,picked,left:games.length-picked,total:games.length};
  }
  function cleanPicks(value,games){
    const clean={};
    if(!value||typeof value!=='object'||Array.isArray(value)) return clean;
    for(const g of games){const k=key(g);if(!done(g)&&VALID.has(value[k])) clean[k]=value[k];}
    return clean;
  }
  const api={resultOf,done,starterLineup,completion,rank,key,playoffStatus,scenario,cleanPicks};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.HubScenarios=api;
})(typeof globalThis!=='undefined'?globalThis:this);
