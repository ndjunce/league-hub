// Fixed-score schedule comparisons. No forecasts, player data or network access.
(function(root){
  'use strict';
  const cmp=(a,b)=>a===b?0:a>b?1:-1;
  const record=()=>({w:0,l:0,t:0,n:0});
  function add(r,result){r.n++;if(result>0)r.w++;else if(result<0)r.l++;else r.t++;}
  function build(D){
    const ids=D.teams.map(t=>String(t.id)), known=new Set(ids), periods=new Map();
    for(const g of D.games){
      if(g.period<1||g.period>D.regWeeks||g.period>D.week)continue;
      if(!periods.has(g.period))periods.set(g.period,[]);
      periods.get(g.period).push(g);
    }
    for(let w=1;w<=Math.min(D.week,D.regWeeks);w++)if(!periods.has(w))periods.set(w,[]);
    const weeks=[],excluded=[];
    for(const [week,games] of [...periods].sort((a,b)=>a[0]-b[0])){
      const scores=new Map(),opponents=new Map();let reason=null;
      if(games.length*2!==ids.length) reason='Missing teams, byes or multiple games';
      for(const g of games){
        const h=String(g.homeId),a=String(g.awayId);
        if(!known.has(h)||!known.has(a)||h===a||scores.has(h)||scores.has(a)) reason='Duplicate or unsupported matchups';
        if(!(g.snapshotFinal||g.finalized)) reason='Week not fully ESPN-final';
        if(!Number.isFinite(g.snapshotHomePts)||!Number.isFinite(g.snapshotAwayPts)) reason='Missing final scores';
        scores.set(h,g.snapshotHomePts);scores.set(a,g.snapshotAwayPts);
        opponents.set(h,a);opponents.set(a,h);
        const outcome=cmp(g.snapshotHomePts,g.snapshotAwayPts);
        if((g.winner==='HOME'&&outcome<=0)||(g.winner==='AWAY'&&outcome>=0)||(g.winner==='TIE'&&outcome!==0)) reason='Result and final scores disagree';
      }
      if(scores.size!==ids.length) reason='Incomplete league coverage';
      if(reason){excluded.push({week,reason});continue;}
      weeks.push({week,scores,opponents});
    }
    const cells={};
    for(const id of ids){
      cells[id]={};
      for(const schedule of ids){
        const swapped=record(),actual=record(),included=[],skipped=[];
        for(const w of weeks){
          const opponent=w.opponents.get(schedule);
          if(opponent===id){skipped.push(w.week);continue;}
          add(swapped,cmp(w.scores.get(id),w.scores.get(opponent)));
          add(actual,cmp(w.scores.get(id),w.scores.get(w.opponents.get(id))));
          included.push(w.week);
        }
        cells[id][schedule]={swapped,actual,included,skipped};
      }
    }
    return {weeks:weeks.map(w=>w.week),excluded,cells};
  }
  const api={build};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.HubScheduleSwap=api;
})(typeof globalThis!=='undefined'?globalThis:this);
