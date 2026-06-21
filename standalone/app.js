/* Focus & Goals – eigenständige App (kein Build/Server nötig, Daten im Browser). */
(function () {
  'use strict'

  // ---------- State ----------
  var KEY = 'focus-goals-v1'
  var state = load()
  function defaults(){ return { settings:{ workMin:25, breakMin:5 }, goals:[], sessions:[] } }
  function load(){
    try{ var r=localStorage.getItem(KEY); if(r){ var s=JSON.parse(r); s.settings=s.settings||{workMin:25,breakMin:5}; s.goals=s.goals||[]; s.sessions=s.sessions||[]; return s } }catch(e){}
    return defaults()
  }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(state)) }catch(e){} }
  function uid(){ return Math.random().toString(36).slice(2,9) + (state.sessions.length+state.goals.length) }

  // ---------- Timer-Laufzeit (nicht persistiert) ----------
  var timer = { mode:'idle', remaining:0, running:false, goalId:'', intId:null }

  // ---------- Helpers ----------
  function el(id){ return document.getElementById(id) }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]}) }
  function pad(n){ return (n<10?'0':'')+n }
  function fmt(secs){ var m=Math.floor(secs/60), s=secs%60; return pad(m)+':'+pad(s) }
  function startOfWeek(d){ var x=new Date(d); var day=(x.getDay()+6)%7; x.setHours(0,0,0,0); x.setDate(x.getDate()-day); return x.getTime() }
  function isToday(ts){ var d=new Date(); d.setHours(0,0,0,0); return ts>=d.getTime() }
  function isThisWeek(ts){ return ts>=startOfWeek(new Date()) }
  function goalById(id){ return state.goals.find(function(g){return g.id===id}) }

  function goalFocus(goalId){
    var min=0, count=0
    state.sessions.forEach(function(s){ if(s.goalId===goalId){ min+=s.min; count++ } })
    return { min:min, count:count }
  }
  function totalMin(filterFn){ var m=0; state.sessions.forEach(function(s){ if(filterFn(s.ts)) m+=s.min }); return m }
  function sessionsCount(filterFn){ var c=0; state.sessions.forEach(function(s){ if(filterFn(s.ts)) c++ }); return c }
  function goalProgress(g){
    if(g.status==='done') return 100
    if(!g.milestones || !g.milestones.length) return 0
    var done=g.milestones.filter(function(m){return m.done}).length
    return Math.round(done/g.milestones.length*100)
  }
  function humanMin(min){
    if(min<60) return min+' min'
    var h=Math.floor(min/60), m=min%60
    return h+' h'+(m?' '+m+' min':'')
  }

  // ---------- Timer-Logik ----------
  function beep(){
    try{
      var ctx=new (window.AudioContext||window.webkitAudioContext)()
      var o=ctx.createOscillator(), g=ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type='sine'; o.frequency.value=660; g.gain.value=0.15
      o.start(); o.stop(ctx.currentTime+0.25)
    }catch(e){}
  }
  function tick(){
    if(timer.remaining>0){ timer.remaining--; renderTimer(); return }
    // 0 erreicht
    stopInterval()
    if(timer.mode==='work'){
      logSession()
      beep()
      flash(el('focusCard'))
      timer.mode='break'; timer.remaining=state.settings.breakMin*60; timer.running=false
    } else if(timer.mode==='break'){
      beep()
      timer.mode='idle'; timer.remaining=0; timer.running=false
    }
    renderTimer(); renderToday(); renderGoals(); setTitle()
  }
  function stopInterval(){ if(timer.intId){ clearInterval(timer.intId); timer.intId=null } }
  function startTimer(){
    if(timer.mode==='idle'){ timer.mode='work'; timer.remaining=state.settings.workMin*60 }
    timer.running=true
    stopInterval(); timer.intId=setInterval(tick,1000)
    renderTimer(); setTitle()
  }
  function pauseTimer(){ timer.running=false; stopInterval(); renderTimer(); setTitle() }
  function resetTimer(){ stopInterval(); timer.mode='idle'; timer.remaining=0; timer.running=false; renderTimer(); setTitle() }
  function startBreak(){ timer.mode='break'; timer.remaining=state.settings.breakMin*60; startTimer() }
  function logSession(){
    state.sessions.push({ id:uid(), ts:Date.now(), min:state.settings.workMin, goalId:timer.goalId||'' })
    save()
  }
  function setTitle(){
    if(timer.running && timer.remaining>0){ document.title=fmt(timer.remaining)+' · '+(timer.mode==='work'?'Fokus':'Pause') }
    else document.title='Focus & Goals'
  }
  function flash(node){ if(!node)return; node.classList.remove('flash'); void node.offsetWidth; node.classList.add('flash') }

  // ---------- Rendering ----------
  function render(){ renderTimer(); renderToday(); renderGoals() }

  function renderTimer(){
    var box=el('focusCard')
    var disp = timer.mode==='idle' ? fmt(state.settings.workMin*60) : fmt(timer.remaining)
    var modeLabel = timer.mode==='work' ? 'Fokus läuft' : timer.mode==='break' ? 'Pause' : 'Bereit'
    var activeGoals = state.goals.filter(function(g){return g.status!=='done'})
    var h=''
    h+='<div class="timer-mode">'+esc(modeLabel)+'</div>'
    h+='<div class="timer-display '+timer.mode+'">'+disp+'</div>'
    h+='<div class="timer-controls">'
    if(!timer.running) h+='<button id="tStart" class="primary">'+(timer.mode==='idle'?'Start':'Weiter')+'</button>'
    else h+='<button id="tPause">Pause</button>'
    if(timer.mode==='break' && !timer.running) h+='<button id="tBreak">Pause starten</button>'
    h+='<button id="tReset" class="ghost">Reset</button>'
    h+='</div>'
    h+='<div class="focus-row linkgoal">Fokus für: <select id="tGoal"><option value="">– kein Ziel –</option>'
    activeGoals.forEach(function(g){ h+='<option value="'+g.id+'"'+(g.id===timer.goalId?' selected':'')+'>'+esc(g.title)+'</option>' })
    h+='</select></div>'
    h+='<div class="focus-row">Fokus <input class="mins" id="sWork" type="number" min="1" max="180" value="'+state.settings.workMin+'"> min · '
    h+='Pause <input class="mins" id="sBreak" type="number" min="1" max="60" value="'+state.settings.breakMin+'"> min</div>'
    box.innerHTML=h

    if(el('tStart')) el('tStart').onclick=startTimer
    if(el('tPause')) el('tPause').onclick=pauseTimer
    if(el('tBreak')) el('tBreak').onclick=startBreak
    el('tReset').onclick=resetTimer
    el('tGoal').onchange=function(){ timer.goalId=this.value }
    el('sWork').onchange=function(){ var v=Math.max(1,Math.min(180,+this.value||25)); state.settings.workMin=v; save(); if(timer.mode==='idle')renderTimer() }
    el('sBreak').onchange=function(){ var v=Math.max(1,Math.min(60,+this.value||5)); state.settings.breakMin=v; save() }
  }

  function renderToday(){
    var tMin=totalMin(isToday), tCnt=sessionsCount(isToday), wMin=totalMin(isThisWeek)
    el('today').innerHTML=
      '<h2>Überblick</h2><div class="today">'
      +'<div class="stat"><div class="num">'+humanMin(tMin)+'</div><div class="lbl">Fokus heute</div></div>'
      +'<div class="stat"><div class="num">'+tCnt+'</div><div class="lbl">Sessions heute</div></div>'
      +'<div class="stat"><div class="num">'+humanMin(wMin)+'</div><div class="lbl">Fokus diese Woche</div></div>'
      +'<div class="stat"><div class="num">'+state.goals.filter(function(g){return g.status!=="done"}).length+'</div><div class="lbl">aktive Ziele</div></div>'
      +'</div>'
  }

  function dueLabel(due){
    if(!due) return ''
    var d=new Date(due+'T00:00:00'), now=new Date(); now.setHours(0,0,0,0)
    var days=Math.round((d-now)/86400000)
    var cls = days<0?'due-over' : days<=7?'due-soon' : 'muted'
    var txt = days<0?('überfällig ('+(-days)+' T)') : days===0?'heute fällig' : days===1?'morgen fällig' : ('in '+days+' Tagen')
    return ' · <span class="'+cls+'">📅 '+esc(d.toLocaleDateString('de'))+' ('+txt+')</span>'
  }

  function renderGoals(){
    var box=el('goals')
    var h='<h2>Ziele</h2>'
    // Neues Ziel
    h+='<div class="addrow">'
      +'<input id="ngTitle" placeholder="Neues Ziel…">'
      +'<input id="ngDue" type="date" title="Zieldatum (optional)">'
      +'<button id="ngAdd" class="primary">+ Ziel</button></div>'

    var active=state.goals.filter(function(g){return g.status!=='done'})
    var done=state.goals.filter(function(g){return g.status==='done'})

    if(!state.goals.length) h+='<p class="muted">Noch keine Ziele. Leg oben dein erstes an – und ordne Fokus-Sessions dann diesem Ziel zu.</p>'

    active.forEach(function(g){ h+=goalHtml(g) })
    if(done.length){ h+='<h3>Erledigt</h3>'; done.forEach(function(g){ h+=goalHtml(g) }) }
    box.innerHTML=h

    el('ngAdd').onclick=function(){
      var t=el('ngTitle').value.trim(); if(!t)return
      state.goals.push({ id:uid(), title:t, due:el('ngDue').value||'', color:'', milestones:[], status:'active', created:Date.now() })
      save(); renderGoals(); renderTimer()
    }
    el('ngTitle').onkeydown=function(e){ if(e.key==='Enter') el('ngAdd').click() }

    box.querySelectorAll('[data-act]').forEach(function(btn){
      btn.onclick=function(){ goalAction(btn.getAttribute('data-act'), btn.getAttribute('data-id'), btn) }
    })
    box.querySelectorAll('[data-mtoggle]').forEach(function(cb){
      cb.onclick=function(){ var gid=cb.getAttribute('data-gid'), mid=cb.getAttribute('data-mtoggle')
        var g=goalById(gid), m=g.milestones.find(function(x){return x.id===mid}); m.done=!m.done; save(); renderGoals() }
    })
    box.querySelectorAll('[data-maddbtn]').forEach(function(btn){
      btn.onclick=function(){ addMilestone(btn.getAttribute('data-maddbtn')) }
    })
    box.querySelectorAll('[data-maddinput]').forEach(function(inp){
      inp.onkeydown=function(e){ if(e.key==='Enter') addMilestone(inp.getAttribute('data-maddinput')) }
    })
  }

  function goalHtml(g){
    var p=goalProgress(g), f=goalFocus(g.id)
    var h='<div class="goal'+(g.status==='done'?' done':'')+'">'
    h+='<div class="goal-head"><div class="goal-title">'+esc(g.title)+'</div>'
      +'<div class="goal-actions">'
    if(g.status!=='done') h+='<button class="sm" data-act="complete" data-id="'+g.id+'">✓ erledigt</button>'
    else h+='<button class="sm" data-act="reopen" data-id="'+g.id+'">↺ öffnen</button>'
    h+='<button class="sm ghost" data-act="delete" data-id="'+g.id+'">🗑</button>'
    h+='</div></div>'
    h+='<div class="goal-meta">'+p+'% '+dueLabel(g.due)+'</div>'
    h+='<div class="bar"><span style="width:'+p+'%"></span></div>'
    h+='<div class="goal-stats"><span>⏱ '+humanMin(f.min)+' Fokus</span><span>▶ '+f.count+' Sessions</span></div>'
    // Meilensteine
    if(g.milestones && g.milestones.length){
      h+='<ul class="miles">'
      g.milestones.forEach(function(m){
        h+='<li class="'+(m.done?'done':'')+'"><input type="checkbox" data-gid="'+g.id+'" data-mtoggle="'+m.id+'"'+(m.done?' checked':'')+'><span class="mt">'+esc(m.text)+'</span></li>'
      })
      h+='</ul>'
    }
    if(g.status!=='done'){
      h+='<div class="addrow"><input data-maddinput="'+g.id+'" placeholder="Meilenstein hinzufügen…"><button class="sm" data-maddbtn="'+g.id+'">+ Schritt</button></div>'
    }
    h+='</div>'
    return h
  }

  function addMilestone(gid){
    var inp=document.querySelector('[data-maddinput="'+gid+'"]')
    var t=inp.value.trim(); if(!t)return
    goalById(gid).milestones.push({ id:uid(), text:t, done:false })
    save(); renderGoals()
  }

  function goalAction(act, id, btn){
    var g=goalById(id)
    if(act==='complete'){ g.status='done'; save(); renderGoals(); renderToday(); renderTimer() }
    else if(act==='reopen'){ g.status='active'; save(); renderGoals(); renderToday(); renderTimer() }
    else if(act==='delete'){
      if(confirm('Ziel „'+g.title+'" wirklich löschen? (Fokus-Sessions bleiben erhalten, aber ohne Ziel-Zuordnung.)')){
        state.sessions.forEach(function(s){ if(s.goalId===id) s.goalId='' })
        state.goals=state.goals.filter(function(x){return x.id!==id})
        save(); renderGoals(); renderToday(); renderTimer()
      }
    }
  }

  // ---------- Init ----------
  function init(){ render(); setTitle() }
  init()
})()
