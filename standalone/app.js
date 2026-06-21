/* Focus & Goals – geführter Ziel-Assistent (Vision → Ziele über 3 Horizonte).
   Vanilla JS, alles lokal im Browser. */
(function () {
  'use strict'

  // ---------- Bereiche (aus "FULL FOCUS") ----------
  var SEED_AREAS = [
    { id:'physical',  name:'Physical',   desc:'Gesundheit, Fitness, Energie, Ruhe' },
    { id:'spiritual', name:'Spiritual',  desc:'Glaube, Sinn, Charakter, Gebet' },
    { id:'financial', name:'Financial',  desc:'Versorgung, Haushalterschaft, Freiheit' },
    { id:'relational',name:'Relational', desc:'Ehe, Familie, Freundschaften' },
    { id:'mental',    name:'Mental',     desc:'Lernen, Fähigkeiten, Denkweise' },
    { id:'career',    name:'Career',     desc:'Arbeit, Berufung, Beitrag' },
  ]
  var AREA_ICON = { physical:'💪', spiritual:'🙏', financial:'💶', relational:'❤️', mental:'🧠', career:'🚀' }

  // ---------- Zeithorizonte (Goal = Vision + Timeline) ----------
  var HORIZONS = [
    { key:'long',  label:'Langfristig',   span:'~1 Jahr',
      q:'Dein 1-Jahres-Ziel', hint:'Die Vision mit Zeitachse: Was willst du in rund einem Jahr erreicht haben? Mach es SMART – konkret und messbar.' },
    { key:'mid',   label:'Mittelfristig', span:'1–3 Monate',
      q:'Dein 1–3-Monats-Ziel', hint:'Welcher Meilenstein in 1–3 Monaten bringt dich dem Jahresziel spürbar näher?' },
    { key:'short', label:'Kurzfristig',   span:'1–2 Wochen',
      q:'Dein 1–2-Wochen-Ziel', hint:'Was ist der nächste konkrete Schritt für die nächsten 1–2 Wochen?' },
  ]
  function horizon(key){ return HORIZONS.find(function(h){return h.key===key}) }

  // ---------- State ----------
  var KEY = 'focus-goals-v2'
  var state = load()
  function defaults(){
    return { settings:{workMin:25,breakMin:5}, areas:SEED_AREAS.map(function(a){return {id:a.id,name:a.name,desc:a.desc,vision:''}}), goals:[], sessions:[] }
  }
  function load(){
    try{ var r=localStorage.getItem(KEY); if(r){ var s=JSON.parse(r); s.settings=s.settings||{workMin:25,breakMin:5}; s.areas=s.areas||defaults().areas; s.goals=s.goals||[]; s.sessions=s.sessions||[]; return s } }catch(e){}
    return defaults()
  }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(state)) }catch(e){} }
  function uid(){ return Math.random().toString(36).slice(2,9)+(state.goals.length+state.sessions.length) }

  // ---------- UI-Runtime (nicht persistiert) ----------
  var timer = { mode:'idle', remaining:0, running:false, goalId:'', intId:null }
  var wiz = { open:false, step:0, areaId:'', draft:null }
  var WSTEPS = ['area','vision','long','mid','short','done']

  // ---------- Helpers ----------
  function el(id){ return document.getElementById(id) }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]}) }
  function pad(n){ return (n<10?'0':'')+n }
  function fmt(secs){ return pad(Math.floor(secs/60))+':'+pad(secs%60) }
  function ymd(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()) }
  function addDays(n){ var d=new Date(); d.setDate(d.getDate()+n); return ymd(d) }
  function addMonths(n){ var d=new Date(); d.setMonth(d.getMonth()+n); return ymd(d) }
  function addYears(n){ var d=new Date(); d.setFullYear(d.getFullYear()+n); return ymd(d) }
  function defDeadline(key){ return key==='long'?addYears(1):key==='mid'?addMonths(2):addDays(14) }
  function startOfWeek(d){ var x=new Date(d); var day=(x.getDay()+6)%7; x.setHours(0,0,0,0); x.setDate(x.getDate()-day); return x.getTime() }
  function isToday(ts){ var d=new Date(); d.setHours(0,0,0,0); return ts>=d.getTime() }
  function isThisWeek(ts){ return ts>=startOfWeek(new Date()) }
  function areaById(id){ return state.areas.find(function(a){return a.id===id}) }
  function goalById(id){ return state.goals.find(function(g){return g.id===id}) }
  function goalsOfArea(id){ return state.goals.filter(function(g){return g.areaId===id}) }
  function goalFocus(id){ var min=0,c=0; state.sessions.forEach(function(s){ if(s.goalId===id){min+=s.min;c++} }); return {min:min,count:c} }
  function totalMin(f){ var m=0; state.sessions.forEach(function(s){ if(f(s.ts)) m+=s.min }); return m }
  function sessCount(f){ var c=0; state.sessions.forEach(function(s){ if(f(s.ts)) c++ }); return c }
  function humanMin(min){ if(min<60)return min+' min'; var h=Math.floor(min/60),m=min%60; return h+' h'+(m?' '+m+' min':'') }
  function goalProgress(g){ if(g.status==='done')return 100; if(!g.milestones||!g.milestones.length)return 0; return Math.round(g.milestones.filter(function(m){return m.done}).length/g.milestones.length*100) }
  function seasonGoal(){ return state.goals.find(function(g){return g.seasonPriority && g.status!=='done'}) }

  // ---------- Export (Notion) ----------
  var HZ_LABEL = { long:'Langfristig (~1 Jahr)', mid:'Mittelfristig (1–3 Monate)', short:'Kurzfristig (1–2 Wochen)' }
  function download(name, text, mime){
    try{
      var b=new Blob([text],{type:mime+';charset=utf-8'}), u=URL.createObjectURL(b)
      var a=document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u)
    }catch(e){ alert('Download nicht möglich: '+e) }
  }
  function csvCell(v){ v=(v==null?'':String(v)); return '"'+v.replace(/"/g,'""')+'"' }
  function exportCSV(){
    var head=['Bereich','Vision','Horizont','Ziel','Messbar','Deadline','Fortschritt %','Status','Saison-Prioritaet','Fokus (min)']
    var rows=[head.map(csvCell).join(',')]
    state.areas.forEach(function(a){
      goalsOfArea(a.id).forEach(function(g){
        rows.push([ a.name, a.vision||'', HZ_LABEL[g.horizon]||g.horizon, g.title, g.measurable||'',
          g.deadline||'', goalProgress(g), g.status==='done'?'Erledigt':'Aktiv',
          g.seasonPriority?'Ja':'', goalFocus(g.id).min ].map(csvCell).join(','))
      })
    })
    download('focus-goals.csv', '﻿'+rows.join('\r\n'), 'text/csv')
  }
  function buildMarkdown(){
    var lines=['# Focus & Goals — Export ('+new Date().toLocaleDateString('de')+')','']
    var sg=seasonGoal()
    if(sg){ var sa=areaById(sg.areaId); lines.push('> ★ **Diese Saison – die eine Sache:** '+(sa?sa.name+': ':'')+sg.title,'') }
    state.areas.forEach(function(a){
      var goals=goalsOfArea(a.id)
      if(!a.vision && !goals.length) return
      lines.push('## '+(AREA_ICON[a.id]||'🎯')+' '+a.name)
      if(a.vision) lines.push('**Vision:** '+a.vision)
      HORIZONS.forEach(function(hz){
        var list=goals.filter(function(g){return g.horizon===hz.key})
        if(!list.length) return
        lines.push('','### '+hz.label+' · '+hz.span)
        list.forEach(function(g){
          var bits=[]
          if(g.measurable) bits.push('🎯 '+g.measurable)
          if(g.deadline) bits.push('📅 '+g.deadline)
          bits.push(goalProgress(g)+'%')
          if(g.status==='done') bits.push('✅ erledigt')
          if(g.seasonPriority) bits.push('★ Saison')
          lines.push('- **'+g.title+'**'+(bits.length?' — '+bits.join(' · '):''))
          ;(g.milestones||[]).forEach(function(m){ lines.push('    - ['+(m.done?'x':' ')+'] '+m.text) })
        })
      })
      lines.push('')
    })
    return lines.join('\n')
  }
  function exportMarkdown(){
    var md=buildMarkdown()
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(md).then(function(){ alert('Markdown in die Zwischenablage kopiert.\n\nIn Notion: neue Seite öffnen und einfügen (Cmd/Ctrl+V).') },
        function(){ download('focus-goals.md', md, 'text/markdown') })
    } else download('focus-goals.md', md, 'text/markdown')
  }

  // ---------- Timer ----------
  function beep(){ try{ var c=new (window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain(); o.connect(g);g.connect(c.destination); o.type='sine';o.frequency.value=660;g.gain.value=0.15;o.start();o.stop(c.currentTime+0.25) }catch(e){} }
  function stopInt(){ if(timer.intId){clearInterval(timer.intId);timer.intId=null} }
  function tick(){
    if(timer.remaining>0){ timer.remaining--; renderTimer(); return }
    stopInt()
    if(timer.mode==='work'){ logSession(); beep(); flash(el('focusCard')); timer.mode='break'; timer.remaining=state.settings.breakMin*60; timer.running=false }
    else if(timer.mode==='break'){ beep(); timer.mode='idle'; timer.remaining=0; timer.running=false }
    renderTimer(); renderOverview(); renderAreas(); setTitle()
  }
  function startTimer(){ if(timer.mode==='idle'){timer.mode='work';timer.remaining=state.settings.workMin*60} timer.running=true; stopInt(); timer.intId=setInterval(tick,1000); renderTimer(); setTitle() }
  function pauseTimer(){ timer.running=false; stopInt(); renderTimer(); setTitle() }
  function resetTimer(){ stopInt(); timer.mode='idle'; timer.remaining=0; timer.running=false; renderTimer(); setTitle() }
  function startBreak(){ timer.mode='break'; timer.remaining=state.settings.breakMin*60; startTimer() }
  function logSession(){ state.sessions.push({id:uid(),ts:Date.now(),min:state.settings.workMin,goalId:timer.goalId||''}); save() }
  function setTitle(){ document.title = (timer.running&&timer.remaining>0) ? fmt(timer.remaining)+' · '+(timer.mode==='work'?'Fokus':'Pause') : 'Focus & Goals' }
  function flash(n){ if(!n)return; n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash') }

  // ---------- Render: Timer + Overview ----------
  function renderTimer(){
    var disp = timer.mode==='idle'?fmt(state.settings.workMin*60):fmt(timer.remaining)
    var modeLabel = timer.mode==='work'?'Fokus läuft':timer.mode==='break'?'Pause':'Bereit'
    var active = state.goals.filter(function(g){return g.status!=='done'})
    var h='<h2>Fokus-Session</h2>'
    h+='<div class="focus"><div class="timer-mode">'+esc(modeLabel)+'</div><div class="timer-display '+timer.mode+'">'+disp+'</div>'
    h+='<div class="timer-controls">'
    h+= !timer.running ? '<button id="tStart" class="primary">'+(timer.mode==='idle'?'Start':'Weiter')+'</button>' : '<button id="tPause">Pause</button>'
    if(timer.mode==='break'&&!timer.running) h+='<button id="tBreak">Pause starten</button>'
    h+='<button id="tReset" class="ghost">Reset</button></div>'
    h+='<div class="focus-row linkgoal">Fokus für: <select id="tGoal"><option value="">– kein Ziel –</option>'
    active.forEach(function(g){ var a=areaById(g.areaId); h+='<option value="'+g.id+'"'+(g.id===timer.goalId?' selected':'')+'>'+esc((a?a.name+': ':'')+g.title)+'</option>' })
    h+='</select></div>'
    h+='<div class="focus-row">Fokus <input class="mins" id="sWork" type="number" min="1" max="180" value="'+state.settings.workMin+'"> min · Pause <input class="mins" id="sBreak" type="number" min="1" max="60" value="'+state.settings.breakMin+'"> min</div></div>'
    el('focusCard').innerHTML=h
    if(el('tStart'))el('tStart').onclick=startTimer
    if(el('tPause'))el('tPause').onclick=pauseTimer
    if(el('tBreak'))el('tBreak').onclick=startBreak
    el('tReset').onclick=resetTimer
    el('tGoal').onchange=function(){ timer.goalId=this.value }
    el('sWork').onchange=function(){ state.settings.workMin=Math.max(1,Math.min(180,+this.value||25)); save(); if(timer.mode==='idle')renderTimer() }
    el('sBreak').onchange=function(){ state.settings.breakMin=Math.max(1,Math.min(60,+this.value||5)); save() }
  }

  function renderOverview(){
    el('overview').innerHTML='<h2>Überblick</h2><div class="today">'
      +'<div class="stat"><div class="num">'+humanMin(totalMin(isToday))+'</div><div class="lbl">Fokus heute</div></div>'
      +'<div class="stat"><div class="num">'+sessCount(isToday)+'</div><div class="lbl">Sessions heute</div></div>'
      +'<div class="stat"><div class="num">'+humanMin(totalMin(isThisWeek))+'</div><div class="lbl">Fokus diese Woche</div></div>'
      +'<div class="stat"><div class="num">'+state.goals.filter(function(g){return g.status!=="done"}).length+'</div><div class="lbl">aktive Ziele</div></div></div>'
  }

  function dueLabel(due){
    if(!due)return ''
    var d=new Date(due+'T00:00:00'),now=new Date();now.setHours(0,0,0,0)
    var days=Math.round((d-now)/86400000)
    var cls=days<0?'due-over':days<=7?'due-soon':'muted'
    var txt=days<0?('überfällig ('+(-days)+' T)'):days===0?'heute fällig':days===1?'morgen fällig':('in '+days+' Tagen')
    return '<span class="'+cls+'">📅 '+esc(d.toLocaleDateString('de'))+' · '+txt+'</span>'
  }

  // ---------- Render: Ziel-Assistent (Wizard) ----------
  function startWizard(areaId){
    wiz.open=true; wiz.step=areaId?1:0; wiz.areaId=areaId||''
    var a=areaId?areaById(areaId):null
    wiz.draft={ vision:a?a.vision:'', long:{title:'',measurable:'',deadline:''}, mid:{title:'',measurable:'',deadline:''}, short:{title:'',measurable:'',deadline:''} }
    renderWizard(); window.scrollTo(0,0)
  }
  function closeWizard(){ wiz.open=false; renderWizard(); renderAreas() }
  function commitWizard(){
    var a=areaById(wiz.areaId); if(a) a.vision=wiz.draft.vision.trim()
    ;['long','mid','short'].forEach(function(k){
      var d=wiz.draft[k]; if(d.title && d.title.trim()){
        state.goals.push({ id:uid(), areaId:wiz.areaId, horizon:k, title:d.title.trim(), measurable:(d.measurable||'').trim(), deadline:d.deadline||defDeadline(k), why:'', milestones:[], status:'active', seasonPriority:false, created:Date.now() })
      }
    })
    save(); wiz.open=false; renderWizard(); renderAreas(); renderTimer(); renderOverview()
  }

  function renderWizard(){
    var box=el('wizard')
    if(!wiz.open){ box.innerHTML=''; box.style.display='none'; return }
    box.style.display='block'
    var step=WSTEPS[wiz.step]
    var h='<div class="wiz">'
    h+='<div class="wiz-top"><span class="wiz-prog">Schritt '+(wiz.step+1)+' / '+WSTEPS.length+'</span><button id="wClose" class="sm ghost">✕ schließen</button></div>'

    if(step==='area'){
      h+='<h2>🧭 Ziel-Assistent</h2><p class="muted">In welchem Lebensbereich willst du Ziele setzen? Du gehst danach Schritt für Schritt durch: Vision → Langfristig → Mittel → Kurzfristig.</p>'
      h+='<div class="area-pick">'
      state.areas.forEach(function(a){ h+='<button class="area-btn" data-pick="'+a.id+'"><span class="ai">'+(AREA_ICON[a.id]||'🎯')+'</span><b>'+esc(a.name)+'</b><small>'+esc(a.desc)+'</small></button>' })
      h+='</div>'
    } else if(step==='vision'){
      var a=areaById(wiz.areaId)
      h+='<h2>'+(AREA_ICON[a.id]||'🎯')+' Vision · '+esc(a.name)+'</h2>'
      h+='<p class="muted">Deine <b>Vision</b> ist das längerfristige, gewünschte Ergebnis – wohin willst du in „'+esc(a.name)+'"? Noch ohne Datum, ruhig groß denken.</p>'
      h+='<textarea id="wVision" rows="4" placeholder="z. B. „Ich bin körperlich stark, energiegeladen und gesund – ein Vorbild für meine Familie.">'+esc(wiz.draft.vision)+'</textarea>'
    } else if(step==='long'||step==='mid'||step==='short'){
      var hz=horizon(step), d=wiz.draft[step]
      if(!d.deadline) d.deadline=defDeadline(step)
      h+='<h2>'+esc(hz.label)+' · '+esc(hz.span)+'</h2>'
      h+='<p class="muted"><b>Goal = Vision mit Zeitachse.</b> '+esc(hz.hint)+'</p>'
      h+='<label class="fld">Ziel<input id="wTitle" placeholder="'+esc(hz.q)+'…" value="'+esc(d.title)+'"></label>'
      h+='<label class="fld">Messbar (woran erkennst du, dass es erreicht ist?)<input id="wMeas" placeholder="z. B. 5 kg abgenommen / 8.000 € getilgt" value="'+esc(d.measurable)+'"></label>'
      h+='<label class="fld">Deadline<input id="wDue" type="date" value="'+esc(d.deadline)+'"></label>'
      h+='<p class="muted small">Optional – leer lassen und „Weiter", wenn dieser Horizont (noch) nicht dran ist.</p>'
    } else if(step==='done'){
      var a2=areaById(wiz.areaId)
      h+='<h2>✓ Fertig · '+esc(a2.name)+'</h2><p class="muted">Das wird gespeichert:</p><ul class="review">'
      h+='<li><b>Vision:</b> '+(wiz.draft.vision.trim()?esc(wiz.draft.vision.trim()):'<span class="muted">—</span>')+'</li>'
      ;['long','mid','short'].forEach(function(k){ var d=wiz.draft[k]; if(d.title&&d.title.trim()){ var hz=horizon(k); h+='<li><b>'+esc(hz.label)+':</b> '+esc(d.title.trim())+(d.measurable?' · <span class="muted">'+esc(d.measurable)+'</span>':'')+' · '+esc(d.deadline||'')+'</li>' } })
      h+='</ul>'
    }

    // Navigation
    h+='<div class="wiz-nav">'
    if(wiz.step>0 && step!=='area') h+='<button id="wBack" class="ghost">← Zurück</button>'
    if(step==='done') h+='<button id="wSave" class="primary">Speichern</button>'
    else if(step!=='area') h+='<button id="wNext" class="primary">Weiter →</button>'
    h+='</div></div>'
    box.innerHTML=h

    if(el('wClose'))el('wClose').onclick=closeWizard
    box.querySelectorAll('[data-pick]').forEach(function(b){ b.onclick=function(){ wiz.areaId=b.getAttribute('data-pick'); var ar=areaById(wiz.areaId); wiz.draft.vision=ar.vision||''; wiz.step=1; renderWizard() } })
    if(el('wBack'))el('wBack').onclick=function(){ readStep(); wiz.step--; renderWizard() }
    if(el('wNext'))el('wNext').onclick=function(){ readStep(); wiz.step++; renderWizard() }
    if(el('wSave'))el('wSave').onclick=function(){ commitWizard() }
  }
  function readStep(){
    var step=WSTEPS[wiz.step]
    if(step==='vision' && el('wVision')) wiz.draft.vision=el('wVision').value
    else if((step==='long'||step==='mid'||step==='short')){
      if(el('wTitle')) wiz.draft[step].title=el('wTitle').value
      if(el('wMeas')) wiz.draft[step].measurable=el('wMeas').value
      if(el('wDue')) wiz.draft[step].deadline=el('wDue').value
    }
  }

  // ---------- Render: Bereiche & Ziele ----------
  function renderAreas(){
    var box=el('areas')
    var h='<div class="areas-head"><h2>Bereiche & Ziele</h2><div class="areas-actions">'
      +'<button id="startWiz" class="primary">🧭 Ziel-Assistent</button>'
      +'<button id="expCsv" class="sm">⬇ Notion-CSV</button>'
      +'<button id="expMd" class="sm">⬇ Markdown</button></div></div>'

    var sg=seasonGoal()
    if(sg){ var sa=areaById(sg.areaId)
      h+='<div class="season"><div class="season-lbl">★ Diese Saison – die eine Sache</div><div class="season-goal">'+esc((sa?sa.name+': ':'')+sg.title)+'</div><div class="muted small">Alles andere wartet seinen Turn.</div></div>'
    }

    state.areas.forEach(function(a){
      var goals=goalsOfArea(a.id)
      h+='<div class="area"><div class="area-h"><span class="ai">'+(AREA_ICON[a.id]||'🎯')+'</span><b>'+esc(a.name)+'</b> <span class="muted small">'+esc(a.desc)+'</span>'
        +'<button class="sm ghost" data-wiz="'+a.id+'" style="margin-left:auto">+ Ziele</button></div>'
      if(a.vision) h+='<div class="vision">🌅 <b>Vision:</b> '+esc(a.vision)+'</div>'
      else h+='<div class="vision muted">Noch keine Vision – „+ Ziele" startet den Assistenten.</div>'

      var active=goals.filter(function(g){return g.status!=='done'})
      var done=goals.filter(function(g){return g.status==='done'})
      HORIZONS.forEach(function(hz){
        var list=active.filter(function(g){return g.horizon===hz.key})
        if(!list.length) return
        h+='<div class="hz"><div class="hz-lbl">'+esc(hz.label)+' <span class="muted">· '+esc(hz.span)+'</span></div>'
        list.forEach(function(g){ h+=goalHtml(g) })
        h+='</div>'
      })
      if(done.length){ h+='<div class="hz"><div class="hz-lbl muted">Erledigt</div>'; done.forEach(function(g){ h+=goalHtml(g) }); h+='</div>' }
      h+='</div>'
    })
    box.innerHTML=h

    el('startWiz').onclick=function(){ startWizard('') }
    el('expCsv').onclick=exportCSV
    el('expMd').onclick=exportMarkdown
    box.querySelectorAll('[data-wiz]').forEach(function(b){ b.onclick=function(){ startWizard(b.getAttribute('data-wiz')) } })
    bindGoalEvents(box)
  }

  function goalHtml(g){
    var p=goalProgress(g), f=goalFocus(g.id)
    var h='<div class="goal'+(g.status==='done'?' done':'')+(g.seasonPriority?' season-pri':'')+'">'
    h+='<div class="goal-head"><div class="goal-title">'+esc(g.title)+'</div><div class="goal-actions">'
    if(g.status!=='done'){
      h+='<button class="sm ghost" data-act="season" data-id="'+g.id+'" title="Als Saison-Priorität">'+(g.seasonPriority?'★':'☆')+'</button>'
      h+='<button class="sm" data-act="complete" data-id="'+g.id+'">✓</button>'
    } else h+='<button class="sm" data-act="reopen" data-id="'+g.id+'">↺</button>'
    h+='<button class="sm ghost" data-act="delete" data-id="'+g.id+'">🗑</button></div></div>'
    var meta=[]
    if(g.measurable) meta.push('🎯 '+esc(g.measurable))
    if(g.deadline) meta.push(dueLabel(g.deadline))
    meta.push(p+'%')
    h+='<div class="goal-meta">'+meta.join(' · ')+'</div>'
    h+='<div class="bar"><span style="width:'+p+'%"></span></div>'
    h+='<div class="goal-stats"><span>⏱ '+humanMin(f.min)+'</span><span>▶ '+f.count+' Sessions</span></div>'
    if(g.milestones&&g.milestones.length){ h+='<ul class="miles">'; g.milestones.forEach(function(m){ h+='<li class="'+(m.done?'done':'')+'"><input type="checkbox" data-gid="'+g.id+'" data-mt="'+m.id+'"'+(m.done?' checked':'')+'><span class="mt">'+esc(m.text)+'</span></li>' }); h+='</ul>' }
    if(g.status!=='done') h+='<div class="addrow"><input data-madd="'+g.id+'" placeholder="Schritt/Meilenstein…"><button class="sm" data-maddb="'+g.id+'">+</button></div>'
    h+='</div>'
    return h
  }

  function bindGoalEvents(box){
    box.querySelectorAll('[data-act]').forEach(function(b){ b.onclick=function(){ goalAction(b.getAttribute('data-act'), b.getAttribute('data-id')) } })
    box.querySelectorAll('[data-mt]').forEach(function(cb){ cb.onclick=function(){ var g=goalById(cb.getAttribute('data-gid')), m=g.milestones.find(function(x){return x.id===cb.getAttribute('data-mt')}); m.done=!m.done; save(); renderAreas() } })
    box.querySelectorAll('[data-maddb]').forEach(function(b){ b.onclick=function(){ addMile(b.getAttribute('data-maddb')) } })
    box.querySelectorAll('[data-madd]').forEach(function(i){ i.onkeydown=function(e){ if(e.key==='Enter') addMile(i.getAttribute('data-madd')) } })
  }
  function addMile(gid){ var i=document.querySelector('[data-madd="'+gid+'"]'); var t=i.value.trim(); if(!t)return; goalById(gid).milestones.push({id:uid(),text:t,done:false}); save(); renderAreas() }
  function goalAction(act,id){
    var g=goalById(id)
    if(act==='complete'){ g.status='done'; g.seasonPriority=false }
    else if(act==='reopen'){ g.status='active' }
    else if(act==='season'){ var on=!g.seasonPriority; state.goals.forEach(function(x){x.seasonPriority=false}); g.seasonPriority=on }
    else if(act==='delete'){ if(!confirm('Ziel „'+g.title+'" löschen?'))return; state.sessions.forEach(function(s){if(s.goalId===id)s.goalId=''}); state.goals=state.goals.filter(function(x){return x.id!==id}) }
    save(); renderAreas(); renderOverview(); renderTimer()
  }

  // ---------- Init ----------
  function init(){ renderWizard(); renderAreas(); renderTimer(); renderOverview(); setTitle() }
  init()
})()
