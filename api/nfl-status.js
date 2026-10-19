// Public ESPN NFL status only. No fantasy credentials or model data.
function normalizeScoreboard(data, season, week){
  if(Number(data?.season?.year)!==season || Number(data?.week?.number)!==week ||
     (data.season.type!=null&&Number(data.season.type)!==2))
    throw new Error('ESPN returned a different season/week');
  const teams={};
  for(const event of data.events||[]){
    if(Number(event.season?.year)!==season || Number(event.week?.number)!==week) continue;
    for(const competition of event.competitions||[]){
      const status=competition.status?.type || event.status?.type;
      for(const side of competition.competitors||[]){
        const id=Number(side.team?.id);
        if(Number.isInteger(id)&&id>0) teams[id]={done:status?.completed===true && status?.state==='post',
          state:status?.state||'unknown',detail:status?.shortDetail||status?.description||'Status unavailable'};
      }
    }
  }
  for(const team of data.week.teamsOnBye||[]){
    const id=Number(team.id);
    if(Number.isInteger(id)&&id>0&&!teams[id]) teams[id]={done:true,state:'bye',detail:'Bye week'};
  }
  if(!Object.keys(teams).length) throw new Error('No verified NFL team statuses');
  return {season,week,asOf:new Date().toISOString(),source:'ESPN NFL scoreboard',teams};
}
async function handler(req,res){
  if(req.method!=='GET'){res.status(405).json({error:'method_not_allowed'});return;}
  const season=Number(req.query?.season),week=Number(req.query?.week);
  if(!Number.isInteger(season)||season<2000||season>2100||!Number.isInteger(week)||week<1||week>18){
    res.status(400).json({error:'invalid_season_or_week'});return;
  }
  try{
    const upstream=await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?year=${season}&week=${week}&seasontype=2`,
      {headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
    if(!upstream.ok) throw new Error('upstream');
    const body=normalizeScoreboard(await upstream.json(),season,week);
    res.setHeader('Cache-Control','public, max-age=0, s-maxage=30');
    res.status(200).json(body);
  }catch(_){res.status(502).json({error:'nfl_status_unavailable'});}
}
module.exports=handler;
module.exports.normalizeScoreboard=normalizeScoreboard;
