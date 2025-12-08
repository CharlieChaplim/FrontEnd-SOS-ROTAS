;(function(){
  const page = document.body.dataset.page || ''
  const authToken = localStorage.getItem('authToken') || ''
  const usuarioTipo = localStorage.getItem('userPerfilNome') || ''
  const usuarioLogin = localStorage.getItem('userLogin') || ''

  // bloqueia acesso às páginas internas sem token salvo
  if(page !== 'login' && !authToken){  const authToken = localStorage.getItem('authToken') || ''
  console.log('authToken?', authToken)
  if (page !== 'login' && !authToken) { location.href = 'index.html'; return }
    location.href = 'index.html'
    return
  }

  const paginasDoAdmin = ['bases', 'users', 'professionals', 'ambulances', 'teams']
  if (usuarioTipo !== 'Admin' && paginasDoAdmin.includes(page)) {
    alert('Acesso negado. Página restrita a administradores.')
    location.href = 'dashboard.html'
    return
  }

  const API_URL = 'http://localhost:8080/api'

  // Busca historico de ocorrencias reutilizavel entre dashboard e pagina dedicada
  async function fetchHistoryRecords(){
    try{
      const resp = await fetch(`${API_URL}/ocorrencia/historico`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'http://localhost:8080'
        },
        body: JSON.stringify({
          login: usuarioLogin,
          token: authToken
        })
      })
      if(!resp.ok){ throw new Error(`Status ${resp.status}`) }
      const data = await resp.json()
      if(!Array.isArray(data)) return []

      return data.map(item => ({
        id: item.ocorrenciaId || '',
        type: item.tipoOcorrencia || '',
        gravity: item.gravidade || '',
        neighborhood: item.bairro || '',
        status: item.status || '',
        dateTime: item.dataHoraAbertura ? new Date(item.dataHoraAbertura).toLocaleString('pt-BR') : '',
        rawDateTime: item.dataHoraAbertura || '',
        observation: item.observacao || '',
        slaViolation: item.infringiuSLA || '-',
        attendances: Array.isArray(item.atendimentos) ? item.atendimentos : []
      }))
    }catch(err){
      console.error('Erro ao buscar historico', err)
      return []
    }
  }

  async function loadNav(){
    const mount = document.getElementById('nav-placeholder')
    if(!mount) return
    try{
      const resp = await fetch('nav.html')
      const html = await resp.text()
      mount.innerHTML = html
      initNavHandlers()
      applyRoleVisibility()
    }catch(err){
      console.error('Falha ao carregar nav:', err)
    }
  }

  function initNavHandlers(){
    const nav = document.querySelector('.nav')
    const navToggle = document.getElementById('navToggle')
    const logoutBtn = document.getElementById('logoutBtn')
    if(navToggle){
      navToggle.addEventListener('click',()=>{ if(nav) nav.classList.toggle('open') })
    }
    if(logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.clear()
        sessionStorage.clear()
        location.replace('index.html')
      })
    }
  }

  function applyRoleVisibility(){
    const role = String(usuarioTipo || '').trim().toLowerCase()
    const isAdmin = role === 'admin' || role === 'administrador'
    const adminOnly = document.querySelectorAll('[data-role="admin"]')
    adminOnly.forEach(el=>{
      el.style.display = isAdmin ? '' : 'none'
    })
    
    const hideForAdmin = document.querySelectorAll('[data-role="no-admin"]')
    hideForAdmin.forEach(el=>{
      el.style.display = isAdmin ? 'none' : ''
    })
  }

  // Se voltar pelo histórico sem token, força redirecionar
  window.addEventListener('pageshow', (event) => {
    if (page === 'login') return;
    const token = localStorage.getItem('authToken') || '';
    if (!token) {
      location.replace('index.html');
    }
  });

  loadNav()

  if(page === 'dashboard' || page === 'occurrences' || page === 'dispatch') initDashboard()
  if(page === 'occurrences') initOccurrencesUI()
  if(page === 'ambulances') initAmbulancesUI()
  if(page === 'professionals') initProfessionalsUI()
  if(page === 'bases') initBasesUI()
  if(page === 'dispatch') initDispatchUI()
  if(page === 'teams') initTeamsUI()
  if(page === 'history') initHistoryUI()
  
  function initHistoryUI(){
    const table = document.getElementById('historyTable')
    const filterStatus = document.getElementById('filterHistoryStatus')
    const filterGravity = document.getElementById('filterHistoryGravity')
    const filterNeighborhood = document.getElementById('filterHistoryNeighborhood')
    
    async function render(){
      const all = await fetchHistoryRecords()
      
      const status = filterStatus?.value || ''
      const gravity = filterGravity?.value || ''
      const neighborhood = filterNeighborhood?.value || ''
      
      const filtered = all.filter(item => 
        (!status || item.status === status) &&
        (!gravity || item.gravity === gravity) &&
        (!neighborhood || item.neighborhood.toLowerCase().includes(neighborhood.toLowerCase()))
      )
      
      const header = '<thead><tr><th>ID</th><th>Tipo</th><th>Gravidade</th><th>Bairro</th><th>Status</th><th>Data/Hora</th><th>SLA</th><th>Atendimentos</th></tr></thead>'
      const body = filtered.map(item => {
        const slaClass = item.slaViolation === 'Infringiu' ? 'sla-violated' : ''
        const attendanceCount = item.attendances.length
        const attendanceInfo = attendanceCount > 0 
          ? `${attendanceCount} atendimento(s)` 
          : 'Sem atendimentos'
        
        return `<tr>
          <td>${item.id}</td>
          <td>${item.type}</td>
          <td>${item.gravity}</td>
          <td>${item.neighborhood}</td>
          <td>${item.status}</td>
          <td>${item.dateTime}</td>
          <td class="${slaClass}">${item.slaViolation}</td>
          <td>${attendanceInfo}</td>
        </tr>`
      }).join('')
      
      if(table) table.innerHTML = header + `<tbody>${body}</tbody>`
    }
    
    // Event listeners para filtros
    ;['change', 'input'].forEach(ev => {
      if(filterStatus) filterStatus.addEventListener(ev, render)
      if(filterGravity) filterGravity.addEventListener(ev, render)
      if(filterNeighborhood) filterNeighborhood.addEventListener(ev, render)
    })
    
    render()
  }
    

  function readBases(){
    try{
      const s = localStorage.getItem('bases')
      if(s) return JSON.parse(s)
    }catch(e){}
    return []
  }
  function writeBases(list){
    localStorage.setItem('bases', JSON.stringify(list))
  }

  async function fetchBairros(){
    try{
      const resp = await fetch(
        `${API_URL}/localizacao/bairros`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'http://localhost:8080'
          },
          body: JSON.stringify({
            login: usuarioLogin,
            token: authToken
          })
        }
      )
      const data = await resp.json()
      if(!Array.isArray(data)) return []
      return data.map((bairro)=>({
        id: Number(Object.keys(bairro)[0]),
        name: bairro[Object.keys(bairro)[0]]
      }))
    }catch(err){
      console.error('Erro ao carregar bairros', err)
      return []
    }
  }

  // MECHER
  async function initDashboard(){
    const summaryEl = document.getElementById('summary')
    const refreshHistoryBtn = document.getElementById('refreshHistory')
    const detailModal = document.getElementById('historyDetailModal')
    const detailBody = document.getElementById('historyDetailBody')
    let dashboardHistoryCache = []

    function formatDateTime(value){
      if(!value) return '-'
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR')
    }

    function renderHistorySummary(list){
      if(!summaryEl) return
      if(!list.length){
        summaryEl.innerHTML = '<p class="muted">Nenhuma ocorrência encontrada.</p>'
        return
      }
      summaryEl.innerHTML = list.map(item =>{
        const slaBadge = item.slaViolation === 'Infringiu' ? '<span class="badge danger">SLA</span>' : ''
        const attendanceLabel = item.attendances.length ? `${item.attendances.length} atendimento(s)` : 'Sem atendimento'
        return `<article class="summary-item">
          <div class="summary-content">
            <h4>Ocorrência #${item.id || '-'} ${slaBadge}</h4>
            <p>${item.type || 'Sem tipo'} · ${item.neighborhood || 'Sem bairro'} · ${item.status || 'Sem status'}</p>
            <div class="summary-meta">
              <small>${item.gravity || 'Sem gravidade'} · ${item.dateTime || ''}</small>
              <small>${attendanceLabel}</small>
            </div>
          </div>
          <button class="btn small" type="button" data-history-id="${item.id}">Detalhes</button>
        </article>`
      }).join('')
    }

    async function loadHistorySummary(){
      if(!summaryEl) return
      summaryEl.innerHTML = '<p class="muted">Carregando ocorrências...</p>'
      const data = await fetchHistoryRecords()
      const sorted = data.slice().sort((a,b)=>{
        const aTime = a.rawDateTime ? Date.parse(a.rawDateTime) : 0
        const bTime = b.rawDateTime ? Date.parse(b.rawDateTime) : 0
        return bTime - aTime
      })
      dashboardHistoryCache = sorted
      renderHistorySummary(sorted.slice(0,5))
    }

    function buildAttendanceHtml(att){
      return `<li>
        <strong>Atendimento #${att.atendimentoId || '-'}</strong>
        <p>${att.ambulanciaPlaca || 'Sem placa'} · ${att.ambulanciaTipo || 'Tipo não informado'} · ${att.baseNome || 'Base não informada'}</p>
        <small>Despacho: ${formatDateTime(att.dataHoraDespacho)} | Chegada: ${formatDateTime(att.dataHoraChegada)} | Distância: ${typeof att.distanciaKm === 'number' ? att.distanciaKm.toFixed(2)+' km' : '-'}</small>
      </li>`
    }

    function openHistoryDetailById(id){
      if(!detailBody) return
      const item = dashboardHistoryCache.find(entry => String(entry.id) === String(id))
      if(!item){
        detailBody.innerHTML = '<p class="muted">Ocorrência não encontrada.</p>'
      } else {
        const attendanceHtml = item.attendances.length
          ? `<ul class="detail-list">${item.attendances.map(buildAttendanceHtml).join('')}</ul>`
          : '<p class="muted">Sem atendimentos registrados.</p>'
        detailBody.innerHTML = `
          <dl class="detail-grid">
            <dt>ID</dt><dd>${item.id || '-'}</dd>
            <dt>Tipo</dt><dd>${item.type || '-'}</dd>
            <dt>Gravidade</dt><dd>${item.gravity || '-'}</dd>
            <dt>Bairro</dt><dd>${item.neighborhood || '-'}</dd>
            <dt>Status</dt><dd>${item.status || '-'}</dd>
            <dt>Data/Hora</dt><dd>${item.dateTime || '-'}</dd>
            <dt>SLA</dt><dd>${item.slaViolation || '-'}</dd>
            <dt>Observação</dt><dd>${item.observation || 'Sem observações'}</dd>
          </dl>
          <section>
            <h4>Atendimentos</h4>
            ${attendanceHtml}
          </section>
        `
      }

      if(detailModal && typeof detailModal.showModal === 'function'){
        if(!detailModal.open) detailModal.showModal()
      }else if(detailModal){
        detailModal.setAttribute('open', 'open')
      }
    }

    if(summaryEl){
      summaryEl.addEventListener('click', e=>{
        const btn = e.target.closest('[data-history-id]')
        if(!btn) return
        const id = btn.dataset.historyId
        if(!id) return
        openHistoryDetailById(id)
      })
      loadHistorySummary()
    }

    if(refreshHistoryBtn){
      refreshHistoryBtn.addEventListener('click', loadHistorySummary)
    }

    const canvas = document.getElementById('graphCanvas')
    if(!canvas) return
    
    const bairros = await fetchBairros()

    
    const conexoesReq = await fetch(
      `${API_URL}/localizacao/conexoes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'http://localhost:8080'
        },
        body: JSON.stringify({
          login: usuarioLogin,
          token: authToken
        })
      }
    )
    
    const conexoesResp = await conexoesReq.json()
    const conexoes = conexoesResp.map(c=>(
      [c.origem.id, c.destino.id, c.distanciaKm]
    ))

    // ----- configurar bases / ambulâncias -----
    const bases = readBases()

    // ----- criar nós e arestas -----
    const idToNode = new Map()
    const nodes = bairros.map((b,i)=>{
      // distribuição inicial em círculo maior para evitar sobreposição
      const radius = 360
      const a = (i / bairros.length) * Math.PI * 2
      const jitter = (Math.random()-0.5) * 30
      const x = Math.cos(a) * radius + Math.sin(a*3)*jitter
      const y = Math.sin(a) * radius + Math.cos(a*2)*jitter
      const node = {id:b.id,name:b.name,x,y,fx:0,fy:0}
      idToNode.set(b.id,node)
      return node
    })
    const edges = conexoes.map(([u,v,d])=>{
      const a = idToNode.get(u), b = idToNode.get(v)
      return {u:a, v:b, d, highlighted:false}
    })

    // ----- canvas, transform -----
    const deviceRatio = window.devicePixelRatio||1
    const ctx = canvas.getContext('2d')
    function resize(){
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.floor(rect.width*deviceRatio)
      canvas.height = Math.floor(rect.height*deviceRatio)
      draw()
    }
    window.addEventListener('resize',resize)

    let scale = 1, tx = 0, ty = 0
    function toScreen(x,y){ return [(x*scale+tx), (y*scale+ty)] }
    function toWorld(x,y){ return [(x-tx)/scale, (y-ty)/scale] }

    // pan/zoom
    let dragging = false, lastX = 0, lastY = 0
    canvas.addEventListener('mousedown',e=>{
      dragging = true
      lastX = e.offsetX*deviceRatio; lastY = e.offsetY*deviceRatio
    })
    window.addEventListener('mouseup',()=>{ dragging = false })
    window.addEventListener('mousemove',e=>{
      if(!dragging) return
      const x = e.offsetX*deviceRatio, y = e.offsetY*deviceRatio
      tx += x - lastX; ty += y - lastY
      lastX = x; lastY = y
      draw()
    })
    canvas.addEventListener('wheel',e=>{
      e.preventDefault()
      const mouseX = e.offsetX*deviceRatio, mouseY = e.offsetY*deviceRatio
      const [wx,wy] = toWorld(mouseX,mouseY)
      const k = Math.exp(-e.deltaY*0.0015) // sensibilidade suave
      scale = Math.max(0.25, Math.min(4, scale*k))
      const [sx,sy] = [wx*scale, wy*scale]
      tx = mouseX - sx
      ty = mouseY - sy
      draw()
    },{passive:false})

    // hover
    let hoverNode = null
    canvas.addEventListener('mousemove',e=>{
      const x = e.offsetX*deviceRatio, y = e.offsetY*deviceRatio
      const [wx,wy] = toWorld(x,y)
      hoverNode = findNode(wx,wy)
      draw()
    })

    // click para marcar ocorrência e rodar Dijkstra
    canvas.addEventListener('click',e=>{
      const x = e.offsetX*deviceRatio, y = e.offsetY*deviceRatio
      const [wx,wy] = toWorld(x,y)
      const n = findNode(wx,wy)
      if(n) {
        handleOccurrence(n)
        if(page==='occurrences'){
          const occNeighborhood = document.getElementById('occNeighborhood')
          const occLocation = document.getElementById('occLocation')
          const occNodeId = document.getElementById('occNodeId')
          const occDateTime = document.getElementById('occDateTime')
          if(occNeighborhood) occNeighborhood.value = n.name
          if(occLocation) occLocation.value = n.name
          if(occNodeId) occNodeId.value = n.id
          if(occDateTime && !occDateTime.value){
            const now = new Date();
            const tz = new Date(now.getTime()-now.getTimezoneOffset()*60000)
            occDateTime.value = tz.toISOString().slice(0,16)
          }
        }
      }
    })

    function findNode(x,y){
      let best=null, bestD=Infinity
      for(const n of nodes){
        const dx = n.x-x, dy = n.y-y
        const d2 = dx*dx+dy*dy
        if(d2 < bestD && d2 < (14/scale)*(14/scale)){ best=n; bestD=d2 } // raio adaptado ao zoom
      }
      return best
    }

    // ----- layout (força) -----
    function layout(){
      // parâmetros calibrados para um "mapa"
      const ITER = 120
      const REP = 800    // repulsão moderada (não explode)
      const SPRING = 0.003 // mola suave
      const BASE = 40      // distância base em pixels
      const KM_TO_PX = 6   // mapeia km para pixels, ajuste para "espalhar" arestas

      for (let iter = 0; iter < ITER; iter++){
        // reset forces
        for(const n of nodes){ n.fx = 0; n.fy = 0 }

        // repulsão (O(n^2), nodes ~20 então ok)
        for(let i=0;i<nodes.length;i++){
          for(let j=i+1;j<nodes.length;j++){
            const a = nodes[i], b = nodes[j]
            const dx = b.x - a.x, dy = b.y - a.y
            let dist = Math.hypot(dx, dy) || 1
            const rep = REP / (dist * dist)
            const ux = dx / dist, uy = dy / dist
            a.fx -= ux * rep; a.fy -= uy * rep
            b.fx += ux * rep; b.fy += uy * rep
          }
        }

        // atração pela aresta (molas) - alvo baseado em distância em km mapeada
        for (const e of edges){
          const dx = e.v.x - e.u.x
          const dy = e.v.y - e.u.y
          let dist = Math.hypot(dx,dy) || 1
          const target = BASE + Math.min(120, e.d * KM_TO_PX) // limite para não ficar gigante
          const k = (dist - target) * SPRING
          const ux = dx / dist, uy = dy / dist
          e.u.fx += ux * k; e.u.fy += uy * k
          e.v.fx -= ux * k; e.v.fy -= uy * k
        }

        // deslocamento suave (reduzido)
        for(const n of nodes){
          n.x += n.fx * 0.04
          n.y += n.fy * 0.04
        }
      }
    }

    // ----- Dijkstra (retorna caminho e distância) -----
    function buildAdjacency(){
      const adj = new Map()
      for(const n of nodes) adj.set(n.id, [])
      for(const e of edges){
        // grafo não-direcionado
        adj.get(e.u.id).push({to: e.v.id, w: e.d, edge:e})
        adj.get(e.v.id).push({to: e.u.id, w: e.d, edge:e})
      }
      return adj
    }

    function dijkstra(startId){
      const adj = buildAdjacency()
      const dist = new Map(); const prev = new Map()
      for(const n of nodes){ dist.set(n.id, Infinity); prev.set(n.id, null) }
      dist.set(startId, 0)
      const seen = new Set()
      // simple priority via array (n small). If quiser, trocar por heap.
      while(true){
        let u = null, best = Infinity
        for(const [id,d] of dist.entries()){
          if(seen.has(id)) continue
          if(d < best){ best = d; u = id }
        }
        if(u===null) break
        seen.add(u)
        for(const {to,w} of adj.get(u)){
          if(seen.has(to)) continue
          const alt = dist.get(u) + w
          if(alt < dist.get(to)){
            dist.set(to, alt)
            prev.set(to, u)
          }
        }
      }
      return {dist, prev}
    }

    function reconstructPath(prev, fromId, toId){
      const path = []
      let u = toId
      while(u !== null && u !== undefined){
        path.push(u)
        if(u === fromId) break
        u = prev.get(u)
      }
      return path.reverse()
    }

    // ----- lógica de ocorrência: achar base disponível mais próxima por distância do grafo -----
    function handleOccurrence(node){
      // limpar destaques
      for(const e of edges) e.highlighted = false
      let bestBase = null, bestDist = Infinity, bestPath = null

      for(const base of bases){
        if(!base.available) continue
        const res = dijkstra(base.nodeId)
        const d = res.dist.get(node.id)
        if(d < bestDist){
          bestDist = d
          bestBase = base
          bestPath = reconstructPath(res.prev, base.nodeId, node.id)
        }
      }

      if(!bestBase){
        alert('Nenhuma ambulância disponível nas bases configuradas.')
        return
      }

      // destacar caminho nas arestas
      if(bestPath && bestPath.length > 1){
        // marcar edges que pertencem ao caminho
        const edgeSet = new Set()
        for(let i=0;i<bestPath.length-1;i++){
          const a = bestPath[i], b = bestPath[i+1]
          // procurar aresta entre a e b
          for(const e of edges){
            if((e.u.id===a && e.v.id===b) || (e.u.id===b && e.v.id===a)){
              e.highlighted = true
              edgeSet.add(e)
              break
            }
          }
        }
      }

      // mensagem com info
      const distStr = bestDist === Infinity ? 'inacessível' : bestDist.toFixed(1) + ' km'
      console.log('Ocorrência em:', node.name)
      console.log('Base selecionada:', bestBase.name, '-> distância:', distStr)
      // desenhar e mostrar popup simples
      draw()
      // desenhar badge com info próxima ao nó (temporário)
      setTimeout(()=>{ drawInfoBox(node, bestBase, bestDist, bestPath) }, 30)
    }

    function drawInfoBox(node, base, dist, path){
      // desenho simples em sobreposição (screen coords)
      const [sx,sy] = toScreen(node.x,node.y)
      ctx.save()
      ctx.setTransform(1,0,0,1,0,0)
      ctx.font = '14px system-ui'
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.strokeStyle = '#111'
      ctx.lineWidth = 1
      const text = `${node.name}\nBase: ${base.name}\nDistância: ${dist.toFixed(1)} km`
      const lines = text.split('\n')
      const w = Math.max(...lines.map(l=>ctx.measureText(l).width)) + 12
      const h = lines.length*18 + 10
      const px = Math.min(canvas.width - w - 10, Math.max(10, sx+10))
      const py = Math.min(canvas.height - h - 10, Math.max(10, sy+10))
      roundRect(ctx, px, py, w, h, 6)
      ctx.fillStyle = '#000'
      ctx.textAlign = 'left'
      for(let i=0;i<lines.length;i++){
        ctx.fillText(lines[i], px+6, py+18 + i*18 -2)
      }
      ctx.restore()
    }

    function roundRect(ctx, x, y, w, h, r){
      ctx.beginPath()
      ctx.moveTo(x+r,y)
      ctx.arcTo(x+w,y,x+w,y+h,r)
      ctx.arcTo(x+w,y+h,x,y+h,r)
      ctx.arcTo(x,y+h,x,y,r)
      ctx.arcTo(x,y,x+w,y,r)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }

    // ----- desenho -----
    function draw(){
      const w = canvas.width, h = canvas.height
      ctx.setTransform(1,0,0,1,0,0)
      ctx.clearRect(0,0,w,h)
      // fundo
      ctx.fillStyle = '#e9eef2'
      ctx.fillRect(0,0,w,h)
      drawGrid()
      ctx.save()
      ctx.translate(tx,ty)
      ctx.scale(scale,scale)
      drawEdges()
      drawNodes()
      ctx.restore()
    }

    function drawGrid(){
      const step = 40*deviceRatio
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.9
      for(let x=0;x<canvas.width;x+=step){
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke()
      }
      for(let y=0;y<canvas.height;y+=step){
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    function drawEdges(){
      ctx.lineCap = 'round'
      for(const e of edges){
        const [x1,y1] = [e.u.x,e.u.y]
        const [x2,y2] = [e.v.x,e.v.y]
        // highlight path
        if(e.highlighted){
          ctx.strokeStyle = '#0b6' // cor de destaque
          ctx.lineWidth = 6
        } else {
          ctx.strokeStyle = '#9aa0a6'
          ctx.lineWidth = 4
        }
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke()

        // desenhar rótulo de distância somente se zoom for suficiente
        if(scale > 0.9){
          const mx = (x1+x2)/2, my = (y1+y2)/2
          const ang = Math.atan2(y2-y1,x2-x1)
          ctx.save()
          ctx.translate(mx,my)
          ctx.rotate(ang)
          ctx.fillStyle = '#111'
          ctx.font = Math.max(10, Math.round(12/scale)) + 'px system-ui'
          ctx.textAlign = 'center'
          ctx.fillText(e.d.toFixed(1)+' km',0,-8/scale)
          ctx.restore()
        }
      }
    }

    function drawNodes(){
      for(const n of nodes){
        const r = hoverNode && hoverNode.id===n.id ? 9 : 7
        // color:
        let fill = '#d32f2f' // bairro padrão
        // bairros sinalizáveis (ex.: vou considerar alguns como sinalizáveis azul)
        // aqui vamos pintar alguns nodes em azul para representar "podem ser sinalizados"
        // (você pode personalizar a lista)
        const blueIds = new Set([2,5,9,13,16,18]) // exemplo: "locais que o usuário pode sinalizar"
        if(blueIds.has(n.id)) fill = '#1976d2'
        // bases com ambulância -> verde
        const baseObj = bases.find(b=>b.nodeId===n.id)
        if(baseObj && baseObj.available) fill = '#2e7d32'

        ctx.beginPath(); ctx.fillStyle = fill; ctx.arc(n.x,n.y,r,0,Math.PI*2); ctx.fill()
        // nome
        ctx.fillStyle = '#111'
        ctx.font = Math.max(11, Math.round(12/scale)) + 'px system-ui'
        ctx.textAlign = 'left'
        ctx.fillText(n.name, n.x + 12, n.y + 4)
      }
    }

    // ----- util: ajustar visão (fit) para caber tudo -----
    function fit(){
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity
      for(const n of nodes){
        if(n.x<minX)minX=n.x; if(n.y<minY)minY=n.y; if(n.x>maxX)maxX=n.x; if(n.y>maxY)maxY=n.y
      }
      const w = canvas.width, h = canvas.height
      const gw = Math.max(1, maxX-minX), gh = Math.max(1, maxY-minY)
      const pad = 60*deviceRatio
      const sx = (w - 2*pad)/gw
      const sy = (h - 2*pad)/gh
      scale = Math.min(1.0, Math.min(sx,sy))
      tx = pad - minX*scale
      ty = pad - minY*scale
    }

    // ----- execução inicial -----
    layout()
    resize()
    fit()
    draw()

    // exposições para depuração no console (opcional)
    window._mapNodes = nodes
    window._mapEdges = edges
    window._bases = bases

  }
  
  function initOccurrencesUI(){
    const form = document.getElementById('occurrenceForm')
    const table = document.getElementById('occurrenceTable')
    const severitySel = document.getElementById('filterOccSeverity')
    const neighInp = document.getElementById('filterOccNeighborhood')
    const statusSel = document.getElementById('filterOccStatus')
    const dt = document.getElementById('occDateTime')
    if(dt && !dt.value){
      const now = new Date();
      const tz = new Date(now.getTime()-now.getTimezoneOffset()*60000)
      dt.value = tz.toISOString().slice(0,16)
    }
    
    // Carregar bairros no select de localização e no filtro
    async function loadBairrosIntoSelect(){
      const bairros = await fetchBairros()
      
      const locationSelect = document.getElementById('occLocation')
      if(locationSelect) {
        locationSelect.innerHTML = '<option value="">Selecione o bairro</option>' +
          bairros.map(b=>`<option value="${b.id}">${b.name}</option>`).join('')
      }
      
      const filterNeighborhood = document.getElementById('filterOccNeighborhood')
      if(filterNeighborhood) {
        filterNeighborhood.innerHTML = '<option value="">Bairro</option>' +
          bairros.map(b=>`<option value="${b.name}">${b.name}</option>`).join('')
      }
    }
    loadBairrosIntoSelect()
    
    // Buscar ocorrências da API
    async function fetchOccurrencesFromApi(){
      try{
        const resp = await fetch(`${API_URL}/ocorrencia/listar-ocorrencias`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'http://localhost:8080'
          },
          body: JSON.stringify({
            login: usuarioLogin,
            token: authToken
          })
        })
        if(!resp.ok){ throw new Error(`Status ${resp.status}`) }
        const data = await resp.json()
        if(!Array.isArray(data)) return []
        
        // Mapear resposta da API para formato local
        return data.map(occ => {
          return {
            id: occ.id || '',
            neighborhood: occ.bairro?.nomeBairro || '',
            type: occ.tipo?.tipo || '',
            severity: occ.gravidade?.gravidade || '',
            status: occ.status?.status || '',
            dateTime: occ.dataHoraAbertura ? new Date(occ.dataHoraAbertura).toLocaleString('pt-BR') : '',
            notes: occ.observacao || '',
            justification: occ.justificativa || ''
          }
        })
      }catch(err){
        console.error('Erro ao buscar ocorrências', err)
        return []
      }
    }
    
    let occurrencesCache = []
    
    function read(){
      try{ return JSON.parse(localStorage.getItem('occurrences')||'[]') }catch(e){ return [] }
    }
    function write(list){ localStorage.setItem('occurrences', JSON.stringify(list)) }
    
    async function render(){
      const all = await fetchOccurrencesFromApi()
      occurrencesCache = all
      const s = severitySel && severitySel.value ? severitySel.value : ''
      const n = neighInp && neighInp.value ? neighInp.value : ''
      const st = statusSel && statusSel.value ? statusSel.value : ''
      const rows = all.filter(o=>(!s||o.severity===s)&&(!st||o.status===st)&&(!n||o.neighborhood===n))
      const header = '<thead><tr><th>Bairro</th><th>Tipo</th><th>Severidade</th><th>Status</th><th>Data/Hora</th><th>Ações</th></tr></thead>'
      const body = rows.map((o,idx)=>`<tr><td>${o.neighborhood||''}</td><td>${o.type||''}</td><td>${o.severity||''}</td><td>${o.status||''}</td><td>${o.dateTime||''}</td><td><button class="icon-button" title="Editar status" onclick="window.editOccurrence(${all.indexOf(o)})">✏️</button></td></tr>`).join('')
      if(table) table.innerHTML = header+`<tbody>${body}</tbody>`
    }
    
    // Modal de edição
    const editModal = document.getElementById('occurrenceEditModal')
    const editForm = document.getElementById('occurrenceEditForm')
    const editStatusSelect = document.getElementById('editOccStatus')
    const editErrorEl = document.getElementById('occurrenceEditError')
    const editCancelBtn = document.getElementById('editOccCancel')
    let editingOccurrenceIndex = -1
    
    window.editOccurrence = function(index){
      editingOccurrenceIndex = index
      const occ = occurrencesCache[index]
      if(!occ) return
      
      const editNotesTextarea = document.getElementById('editOccNotes')
      const editJustificativaTextarea = document.getElementById('editOccJustificativa')
      
      if(editStatusSelect) editStatusSelect.value = occ.status || 'Aberta'
      if(editNotesTextarea) editNotesTextarea.value = occ.notes || ''
      if(editJustificativaTextarea) {
        editJustificativaTextarea.value = occ.justification || ''
        editJustificativaTextarea.disabled = false
        editJustificativaTextarea.required = true
      }
      if(editErrorEl) editErrorEl.textContent = ''
      if(editModal) editModal.hidden = false
    }
    
    if(editCancelBtn){
      editCancelBtn.addEventListener('click', ()=>{
        if(editModal) editModal.hidden = true
        editingOccurrenceIndex = -1
        if(editErrorEl) editErrorEl.textContent = ''
      })
    }
    
    if(editForm){
      editForm.addEventListener('submit', async e=>{
        e.preventDefault()
        if(editingOccurrenceIndex < 0) return
        
        const occ = occurrencesCache[editingOccurrenceIndex]
        const newStatus = editStatusSelect?.value || ''
        const editNotesTextarea = document.getElementById('editOccNotes')
        const editJustificativaTextarea = document.getElementById('editOccJustificativa')
        const notes = editNotesTextarea?.value.trim() || ''
        const justificativa = editJustificativaTextarea?.value.trim() || ''
        
        if(!newStatus){
          if(editErrorEl) editErrorEl.textContent = 'Selecione um status.'
          return
        }
        
        if(!justificativa){
          if(editErrorEl) editErrorEl.textContent = 'Justificativa obrigatória para alteração de status.'
          return
        }
        
        const statusToId = {
          'Aberta': 1,
          'Despachada': 2,
          'Em atendimento': 3,
          'Concluída': 4,
          'Cancelada': 5
        }
        const statusId = statusToId[newStatus] || 1
        
        // Construir body com campos obrigatórios e opcionais
        const payload = {
          login: usuarioLogin,
          token: authToken,
          ocorrenciaId: occ.id,
          statusId: statusId,
          observacao: notes || '',
          justificativa: justificativa
        }
        
        try{
          const resp = await fetch(`${API_URL}/ocorrencia/editar-ocorrencia`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': 'http://localhost:8080'
            },
            body: JSON.stringify(payload)
          })
          
          if(!resp.ok){
            const errData = await resp.json().catch(()=>({}))
            throw new Error(errData.mensagem || `Status ${resp.status}`)
          }
        }catch(err){
          console.error('Erro ao editar ocorrência', err)
          if(editErrorEl) editErrorEl.textContent = 'Falha ao editar ocorrência.'
          return
        }
        
        if(editErrorEl) editErrorEl.textContent = ''
        toast('Ocorrência atualizada')
        if(editModal) editModal.hidden = true
        editingOccurrenceIndex = -1
        render()
      })
    }
    
    function toast(msg){
      const t = document.getElementById('toast')
      if(!t) return
      t.textContent = msg
      t.hidden = false
      setTimeout(()=>{ t.hidden = true }, 1800)
    }
    if(form){
      form.addEventListener('submit',async e=>{
        e.preventDefault()
        const err = document.getElementById('occurrenceError')
        const locationSelect = document.getElementById('occLocation')
        const locationId = locationSelect?.value||''
        const locationText = locationSelect?.selectedOptions?.[0]?.textContent || ''
        const type = document.getElementById('occType')?.value||''
        const severity = document.getElementById('occSeverity')?.value||''
        const dateTime = document.getElementById('occDateTime')?.value||''
        const notes = document.getElementById('occNotes')?.value||''
        
        if(!locationId){ if(err) err.textContent = 'Selecione um bairro.'; return }
        if(!type){ if(err) err.textContent = 'Digite o tipo de acidente.'; return }
        if(!severity){ if(err) err.textContent = 'Selecione a gravidade.'; return }
        if(!dateTime){ if(err) err.textContent = 'Informe a data/hora.'; return }
        
        if(err) err.textContent = ''
        
        // Mapear severidade para gravidadeId (ajuste conforme IDs do backend)
        const severityToId = {
          'Alta': 1,
          'Media': 2,
          'Baixa': 3,
        }
        const gravidadeId = severityToId[severity] || 1
        
        // Todas as ocorrências são criadas como "Aberta" (statusId = 1)
        const statusId = 1
        
        // Converter dateTime para formato Date (ISO)
        const dataHoraAbertura = new Date(dateTime).toISOString()
        
        // Construir URL com parâmetros
        const params = new URLSearchParams({
          observacao: notes || 'Sem observações',
          gravidadeId: String(gravidadeId),
          bairroId: locationId,
          tipoAcidente: type,
          dataHoraAbertura: dataHoraAbertura,
          statusId: String(statusId)
        })
        
        try {
          const resp = await fetch(`${API_URL}/ocorrencia/cadastrar?${params.toString()}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': 'http://localhost:8080'
            },
            body: JSON.stringify({
              login: usuarioLogin,
              token: authToken
            })
          })
          
          if(!resp.ok){
            const errorData = await resp.json().catch(()=>({}))
            throw new Error(errorData.mensagem || `Status ${resp.status}`)
          }
          
          // Salvar também localmente para exibição
          const list = read()
          list.push({
            location: locationText,
            locationId,
            neighborhood: locationText,
            type,
            severity,
            dateTime,
            status,
            notes
          })
          write(list)
          render()
          toast('Ocorrência cadastrada com sucesso')
          form.reset()
          loadBairrosIntoSelect()
          
        } catch(apiErr) {
          console.error('Erro ao cadastrar ocorrência:', apiErr)
          if(err) err.textContent = 'Falha ao cadastrar ocorrência: ' + apiErr.message
        }
      })
    }
    ;['change','input'].forEach(ev=>{
      if(severitySel) severitySel.addEventListener(ev,render)
      if(neighInp) neighInp.addEventListener(ev,render)
      if(statusSel) statusSel.addEventListener(ev,render)
    })
    render()
  }
  
  function initDispatchUI(){
    const occurrenceSelect = document.getElementById('dispatchOccurrence')
    const ambulanceSelect = document.getElementById('dispatchAmbulance')
    const dispatchBtn = document.getElementById('dispatchBtn')
    const errorEl = document.getElementById('dispatchError')
    
    // Buscar ocorrências da API
    async function fetchOccurrencesFromApi(){
      try{
        const resp = await fetch(`${API_URL}/ocorrencia/listar-ocorrencias`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'http://localhost:8080'
          },
          body: JSON.stringify({
            login: usuarioLogin,
            token: authToken
          })
        })
        if(!resp.ok){ throw new Error(`Status ${resp.status}`) }
        const data = await resp.json()
        if(!Array.isArray(data)) return []
        
        // Mapear resposta da API e filtrar apenas ocorrências abertas
        return data.filter(occ => occ.status?.status === 'Aberta').map(occ => {
          return {
            id: occ.id || '',
            neighborhood: occ.bairro?.nomeBairro || '',
            gravity: occ.gravidade?.gravidade || '',
            dateTime: occ.dataHoraAbertura ? new Date(occ.dataHoraAbertura).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : ''
          }
        })
      }catch(err){
        console.error('Erro ao buscar ocorrências', err)
        return []
      }
    }
    
    // Carregar ocorrências no dropdown
    async function loadOccurrences(){
      const occurrences = await fetchOccurrencesFromApi()
      if(occurrenceSelect){
        occurrenceSelect.innerHTML = '<option value="">Selecione uma ocorrência</option>' +
          occurrences.map(occ => `<option value="${occ.id}">${occ.id} - ${occ.neighborhood} - ${occ.gravity} - ${occ.dateTime}</option>`).join('')
      }
    }
    
    // Buscar ambulâncias disponíveis para a ocorrência selecionada
    async function fetchAvailableAmbulances(occurrenceId){
      try{
        const params = new URLSearchParams({
          ocorrenciaId: String(occurrenceId)
        })
        
        const resp = await fetch(`${API_URL}/ocorrencia/disponiveis?${params.toString()}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'http://localhost:8080'
          },
          body: JSON.stringify({
            login: usuarioLogin,
            token: authToken
          })
        })
        
        if(!resp.ok){ throw new Error(`Status ${resp.status}`) }
        const data = await resp.json()
        
        if(!Array.isArray(data)){
          console.error('Resposta da API não é um array:', data)
          if(ambulanceSelect){
            ambulanceSelect.innerHTML = '<option value="">Nenhuma ambulância disponível</option>'
          }
          return
        }
        
        console.log('Ambulâncias disponíveis:', data)
        
        if(ambulanceSelect){
          if(data.length === 0){
            ambulanceSelect.innerHTML = '<option value="">Nenhuma ambulância disponível</option>'
          } else {
            ambulanceSelect.innerHTML = '<option value="">Selecione uma ambulância</option>' +
              data.map(amb => {
                const slaIcon = amb.dentroDoSLA ? '🟢' : '🔴'
                const distancia = amb.distanciaKm ? amb.distanciaKm.toFixed(2) : '0.00'
                const tempo = amb.tempoEstimadoMinutos ? Math.round(amb.tempoEstimadoMinutos) : '0'
                return `<option value="${amb.ambulanciaId}">${amb.placa} | ${amb.baseNome} | ${distancia} km | ${tempo} min | ${slaIcon}</option>`
              }).join('')
          }
        }
        
      }catch(err){
        console.error('Erro ao buscar ambulâncias disponíveis', err)
        if(errorEl) errorEl.textContent = 'Erro ao buscar ambulâncias disponíveis.'
        if(ambulanceSelect){
          ambulanceSelect.innerHTML = '<option value="">Erro ao carregar ambulâncias</option>'
        }
      }
    }
    
    // Listener para quando selecionar uma ocorrência
    if(occurrenceSelect){
      occurrenceSelect.addEventListener('change', ()=>{
        const occurrenceId = occurrenceSelect.value
        if(occurrenceId){
          if(errorEl) errorEl.textContent = ''
          fetchAvailableAmbulances(occurrenceId)
        } else {
          // Limpar dropdown de ambulâncias se nenhuma ocorrência estiver selecionada
          if(ambulanceSelect){
            ambulanceSelect.innerHTML = '<option value="">Selecione uma ambulância</option>'
          }
        }
      })
    }
    
    // Listener para o botão de despacho
    if(dispatchBtn){
      dispatchBtn.addEventListener('click', async ()=>{
        const occurrenceId = occurrenceSelect?.value || ''
        const ambulanceId = ambulanceSelect?.value || ''
        
        // Validações
        if(!occurrenceId){
          if(errorEl) errorEl.textContent = 'Selecione uma ocorrência.'
          return
        }
        
        if(!ambulanceId){
          if(errorEl) errorEl.textContent = 'Selecione uma ambulância.'
          return
        }
        
        if(errorEl) errorEl.textContent = ''
        
        // Construir parâmetros da URL
        const params = new URLSearchParams({
          ocorrenciaId: occurrenceId,
          ambulanciaId: ambulanceId
        })
        
        try{
          const resp = await fetch(`${API_URL}/ocorrencia/despachar?${params.toString()}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': 'http://localhost:8080'
            },
            body: JSON.stringify({
              login: usuarioLogin,
              token: authToken
            })
          })
          
          if(!resp.ok){
            const errorData = await resp.json().catch(()=>({}))
            throw new Error(errorData.mensagem || `Status ${resp.status}`)
          }
          
          toast('Ambulância despachada com sucesso')
          
          // Limpar seleções e recarregar ocorrências
          if(occurrenceSelect) occurrenceSelect.value = ''
          if(ambulanceSelect) ambulanceSelect.innerHTML = '<option value="">Selecione uma ambulância</option>'
          loadOccurrences()
          
        }catch(err){
          console.error('Erro ao despachar ambulância:', err)
          if(errorEl) errorEl.textContent = 'Falha ao despachar: ' + err.message
        }
      })
    }
    
    function toast(msg){
      const t = document.getElementById('toast')
      if(!t) return
      t.textContent = msg
      t.hidden = false
      setTimeout(()=>{ t.hidden = true }, 1800)
    }
    
    loadOccurrences()
  }
  
  function initTeamsUI(){
    const form = document.getElementById('teamForm')
    const table = document.getElementById('teamTable')
    const filterShift = document.getElementById('filterTeamShift')
    const filterAmb = document.getElementById('filterTeamAmb')
    const filterDriver = document.getElementById('filterTeamDriver')
    const filterNurse = document.getElementById('filterTeamNurse')
    const filterDoctor = document.getElementById('filterTeamDoctor')
    
    let teamsCache = []
    let professionalsCache = []
    
    // Buscar equipes da API
    async function fetchTeamsFromApi(){
      try{
        const resp = await fetch(`${API_URL}/equipe/listar-equipes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'http://localhost:8080'
          },
          body: JSON.stringify({
            login: usuarioLogin,
            token: authToken
          })
        })
        if(!resp.ok){ throw new Error(`Status ${resp.status}`) }
        const data = await resp.json()
        if(!Array.isArray(data)) return []
        
        return data.map(team => {
          // Extrair profissionais do array
          const profissionais = team.profissionais || []
          const driver = profissionais.find(p => p.funcao === 'Condutor')
          const nurse = profissionais.find(p => p.funcao === 'Enfermeiro')
          const doctor = profissionais.find(p => p.funcao === 'Médico')
          
          return {
            id: team.id || '',
            shift: team.turno?.descricao || '',
            ambulance: team.ambulancia?.placa || '',
            driver: driver?.nome || '',
            nurse: nurse?.nome || '',
            doctor: doctor?.nome || ''
          }
        })
      }catch(err){
        console.error('Erro ao buscar equipes', err)
        return []
      }
    }
    
    // Buscar profissionais da API
    async function fetchProfessionalsFromApi(){
      try{
        const resp = await fetch(`${API_URL}/profissional/listar-profissionais`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'http://localhost:8080'
          },
          body: JSON.stringify({
            login: usuarioLogin,
            token: authToken
          })
        })
        if(!resp.ok){ throw new Error(`Status ${resp.status}`) }
        const data = await resp.json()
        if(!Array.isArray(data)) return []
        
        return data.map(p => ({
          id: p.id || '',
          name: p.nome || '',
          role: p.funcao?.profissao || '',
          active: p.ativo === true
        }))
      }catch(err){
        console.error('Erro ao buscar profissionais', err)
        return []
      }
    }
    
    // Buscar ambulâncias da API
    async function fetchAmbulancesFromApi(){
      try{
        const resp = await fetch(`${API_URL}/ambulancia/listar-ambulancias`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'http://localhost:8080'
          },
          body: JSON.stringify({
            login: usuarioLogin,
            token: authToken
          })
        })
        if(!resp.ok){ throw new Error(`Status ${resp.status}`) }
        const data = await resp.json()
        if(!Array.isArray(data)) return []
        
        return data.map(amb => ({
          id: amb.id || '',
          plate: amb.placa || '',
          type: amb.tipo?.tipo || '',
          baseName: amb.base?.nome || '',
          active: amb.status?.status === 'Disponivel' || false
        }))
      }catch(err){
        console.error('Erro ao buscar ambulâncias', err)
        return []
      }
    }
    
    // Carregar ambulâncias no dropdown
    async function loadAmbulancesIntoSelect(){
      const ambulances = await fetchAmbulancesFromApi()
      const ambulanceSelect = document.getElementById('teamAmb')
      const filterAmbulanceSelect = document.getElementById('filterTeamAmb')
      
      // Filtrar apenas ambulâncias ativas
      const activeAmbulances = ambulances.filter(amb => amb.active)
      
      if(ambulanceSelect){
        ambulanceSelect.innerHTML = '<option value="">Selecione a ambulância</option>' +
          activeAmbulances.map(amb => `<option value="${amb.id}">${amb.plate} | ${amb.baseName} | ${amb.type}</option>`).join('')
      }
      
      if(filterAmbulanceSelect){
        filterAmbulanceSelect.innerHTML = '<option value="">Ambulância</option>' +
          activeAmbulances.map(amb => `<option value="${amb.plate}">${amb.plate} | ${amb.baseName} | ${amb.type}</option>`).join('')
      }
    }
    
    // Carregar profissionais nos dropdowns
    async function loadProfessionalsIntoSelects(){
      professionalsCache = await fetchProfessionalsFromApi()
      
      const driverSelect = document.getElementById('profDriver')
      const nurseSelect = document.getElementById('profNurse')
      const doctorSelect = document.getElementById('profDoctor')
      const filterDriverSelect = document.getElementById('filterTeamDriver')
      const filterNurseSelect = document.getElementById('filterTeamNurse')
      const filterDoctorSelect = document.getElementById('filterTeamDoctor')
      
      const drivers = professionalsCache.filter(p => p.role === 'Condutor' && p.active)
      const nurses = professionalsCache.filter(p => p.role === 'Enfermeiro' && p.active)
      const doctors = professionalsCache.filter(p => p.role === 'Médico' && p.active)
      
      if(driverSelect){
        driverSelect.innerHTML = '<option value="">Selecione o motorista</option>' +
          drivers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
      }
      
      if(nurseSelect){
        nurseSelect.innerHTML = '<option value="">Selecione o enfermeiro</option>' +
          nurses.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
      }
      
      if(doctorSelect){
        doctorSelect.innerHTML = '<option value="">Selecione o médico</option>' +
          doctors.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
      }
      
      if(filterDriverSelect){
        filterDriverSelect.innerHTML = '<option value="">Motorista</option>' +
          drivers.map(p => `<option value="${p.name}">${p.name}</option>`).join('')
      }
      
      if(filterNurseSelect){
        filterNurseSelect.innerHTML = '<option value="">Enfermeiro(a)</option>' +
          nurses.map(p => `<option value="${p.name}">${p.name}</option>`).join('')
      }
      
      if(filterDoctorSelect){
        filterDoctorSelect.innerHTML = '<option value="">Médico(a)</option>' +
          doctors.map(p => `<option value="${p.name}">${p.name}</option>`).join('')
      }
    }
    
    async function render(){
      const all = await fetchTeamsFromApi()
      teamsCache = all
      
      const shift = filterShift && filterShift.value ? filterShift.value : ''
      const amb = filterAmb && filterAmb.value ? filterAmb.value : ''
      const driver = filterDriver && filterDriver.value ? filterDriver.value : ''
      const nurse = filterNurse && filterNurse.value ? filterNurse.value : ''
      const doctor = filterDoctor && filterDoctor.value ? filterDoctor.value : ''
      
      const rows = all.filter(t => 
        (!shift || t.shift === shift) &&
        (!amb || t.ambulance === amb) &&
        (!driver || t.driver === driver) &&
        (!nurse || t.nurse === nurse) &&
        (!doctor || t.doctor === doctor)
      )
      
      const header = '<thead><tr><th>Turno</th><th>Ambulância</th><th>Motorista</th><th>Enfermeiro</th><th>Médico</th></tr></thead>'
      const body = rows.map(t => 
        `<tr><td>${t.shift||''}</td><td>${t.ambulance||''}</td><td>${t.driver||''}</td><td>${t.nurse||''}</td><td>${t.doctor||''}</td></tr>`
      ).join('')
      
      if(table) table.innerHTML = header + `<tbody>${body}</tbody>`
    }
    
    function toast(msg){
      const t = document.getElementById('toast')
      if(!t) return
      t.textContent = msg
      t.hidden = false
      setTimeout(()=>{ t.hidden = true }, 1800)
    }
    
    // Validação do formulário de equipe
    if(form){
      form.addEventListener('submit', async e=>{
        e.preventDefault()
        const errorEl = document.getElementById('teamError')
        
        const shiftSelect = document.getElementById('ambShift')
        const ambulanceSelect = document.getElementById('teamAmb')
        const driverSelect = document.getElementById('profDriver')
        const nurseSelect = document.getElementById('profNurse')
        const doctorSelect = document.getElementById('profDoctor')
        
        const shift = shiftSelect?.value || ''
        const ambulanceId = ambulanceSelect?.value || ''
        const driverId = driverSelect?.value || ''
        const nurseId = nurseSelect?.value || ''
        const doctorId = doctorSelect?.value || ''
        
        // Validações básicas
        if(!shift){
          if(errorEl) errorEl.textContent = 'Selecione o turno.'
          return
        }
        
        if(!ambulanceId){
          if(errorEl) errorEl.textContent = 'Selecione a ambulância.'
          return
        }
        
        // Verificar tipo de ambulância selecionada
        const selectedOption = ambulanceSelect.selectedOptions?.[0]
        const optionText = selectedOption?.textContent || ''
        const isUTI = optionText.includes('UTI')
        const isBasica = optionText.includes('Basica')
        
        // Validações baseadas no tipo de ambulância
        if(isBasica){
          // Ambulância Básica: apenas condutor obrigatório
          if(!driverId){
            if(errorEl) errorEl.textContent = 'Para ambulância Básica, selecione ao menos o condutor.'
            return
          }
        } else if(isUTI){
          // Ambulância UTI: todos os profissionais obrigatórios
          if(!driverId || !nurseId || !doctorId){
            if(errorEl) errorEl.textContent = 'Para ambulância UTI, selecione o condutor, enfermeiro e médico.'
            return
          }
        } else {
          // Se não conseguiu identificar o tipo, exige pelo menos o condutor
          if(!driverId){
            if(errorEl) errorEl.textContent = 'Selecione ao menos o condutor.'
            return
          }
        }
        
        if(errorEl) errorEl.textContent = ''
        
        // Construir parâmetros da query - usar 0 para campos não preenchidos em ambulância básica
        const params = new URLSearchParams({
          turnoId: shift,
          ambulanciaId: ambulanceId,
          motoristaId: driverId || '0',
          enfermeiroId: nurseId || '0',
          medicoId: doctorId || '0'
        })
        
        try {
          const resp = await fetch(`${API_URL}/equipe/cadastrar?${params.toString()}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': 'http://localhost:8080'
            },
            body: JSON.stringify({
              login: usuarioLogin,
              token: authToken
            })
          })
          
          if(!resp.ok){
            const errorData = await resp.json().catch(()=>({}))
            throw new Error(errorData.mensagem || `Status ${resp.status}`)
          }
          
          toast('Equipe cadastrada com sucesso')
          form.reset()
          await loadAmbulancesIntoSelect()
          await loadProfessionalsIntoSelects()
          render()
        } catch(apiErr) {
          console.error('Erro ao cadastrar equipe:', apiErr)
          if(errorEl) errorEl.textContent = 'Falha ao cadastrar equipe: ' + apiErr.message
        }
      })
    }
    
    loadAmbulancesIntoSelect()
    loadProfessionalsIntoSelects()
    render()
    
    ;['change','input'].forEach(ev=>{
      if(filterShift) filterShift.addEventListener(ev, render)
      if(filterAmb) filterAmb.addEventListener(ev, render)
      if(filterDriver) filterDriver.addEventListener(ev, render)
      if(filterNurse) filterNurse.addEventListener(ev, render)
      if(filterDoctor) filterDoctor.addEventListener(ev, render)
    })
  }
  
  function populateBaseSelect(el, bases, emptyLabel){
    if(!el) return
    el.innerHTML = ''
    if(emptyLabel){
      const opt = document.createElement('option')
      opt.value = ''
      opt.textContent = emptyLabel
      el.appendChild(opt)
    }
    bases.forEach(b=>{
      const opt = document.createElement('option')
      opt.value = String(b.nodeId)
      opt.textContent = b.name
      if(b.baseId) opt.dataset.baseId = String(b.baseId)
      el.appendChild(opt)
    })
  }
  async function initAmbulancesUI(){
    async function fetchBasesFromApi(){
      try{
        const resp = await fetch(
          `${API_URL}/localizacao/bases`,{
            method:'POST',
            headers:{
              'Content-Type':'application/json',
              'Access-Control-Allow-Origin':'http://localhost:8080'
            },
            body:JSON.stringify({ login: usuarioLogin, token: authToken })
          }
        )
        const data = await resp.json()
        if(!Array.isArray(data)) return []
        return data.map(b=>({
          baseId: b.id,
          nodeId: b.bairro?.id || null,
          name: b.nome || '',
          bairroNome: b.bairro?.nomeBairro || '',
          endereco: b.endereco || ''
        }))
      }catch(err){
        console.error('Erro ao buscar bases na API', err)
        return []
      }
    }
    
    const bases = await fetchBasesFromApi()
    const filterSel = document.getElementById('filterAmbBase')
    const formSel = document.getElementById('ambBase')
    populateBaseSelect(filterSel, bases, 'Base')
    populateBaseSelect(formSel, bases, '')

    const table = document.getElementById('ambulanceTable')
    const filterType = document.getElementById('filterAmbType')
    
    let ambulancesCache = []

    async function fetchAmbulancesFromApi(){
      try{
        const resp = await fetch(`${API_URL}/ambulancia/listar-ambulancias`,{
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'Access-Control-Allow-Origin':'http://localhost:8080'
          },
          body: JSON.stringify({ login: usuarioLogin, token: authToken })
        })
        if(!resp.ok){ throw new Error(`Status ${resp.status}`) }
        const data = await resp.json()
        if(!Array.isArray(data)) return []
        return data.map(item=>{
          /*
          Exemplo de resposta da API:
          {"id":1,"placa":"1234-ABC","tipo":{"id":1,"tipo":"UTI"},
          "status":{"id":1,"status":"Disponivel"},
          "base":{"id":1,"nome":"H do Centro","bairro":{"id":2,"nomeBairro":"Centro"},
          "endereco":"Qd 15 N 16"},"ativo":false}
          */
          const tipoStr = item.tipo?.tipo || ''
          const statusStr = item.status?.status || ''
          
          return {
            id: item.id || 0,
            plate: item.placa || '',
            type: tipoStr,
            tipoId: item.tipo?.id || 0,
            baseId: item.base?.id || 0,
            baseNodeId: item.base?.bairro?.id || 0,
            baseName: item.base?.nome || '',
            status: statusStr,
            statusId: item.status?.id || 0
          }
        })
      }catch(err){
        console.error('Erro ao buscar ambulâncias', err)
        return []
      }
    }

    async function renderAmbulances(){
      const list = await fetchAmbulancesFromApi()
      ambulancesCache = list
      const typeFilterValue = filterType?.value || ''
      const baseFilterValue = filterSel?.value || ''
      const filtered = list.filter(a=>{
        const matchesType = !typeFilterValue || a.type === typeFilterValue
        const matchesBase = !baseFilterValue || (a.baseNodeId && String(a.baseNodeId) === baseFilterValue)
        return matchesType && matchesBase
      })
      const header = '<thead><tr><th>Placa</th><th>Tipo</th><th>Base</th><th>Status</th><th>Ações</th></tr></thead>'
      const body = filtered.map((a, idx)=>{
        const statusLabel = a.status || '—'
        const baseLabel = a.baseName || '—'
        const originalIndex = list.indexOf(a)
        return `<tr><td>${a.plate || '—'}</td><td>${a.type || '—'}</td><td>${baseLabel}</td><td>${statusLabel}</td><td><button class="icon-button" title="Editar" onclick="window.editAmbulance(${originalIndex})">✏️</button></td></tr>`
      }).join('')
      if(table){
        table.innerHTML = header + `<tbody>${body}</tbody>`
      }
    }

    ;['change','input'].forEach(ev=>{
      if(filterType) filterType.addEventListener(ev, renderAmbulances)
      if(filterSel) filterSel.addEventListener(ev, renderAmbulances)
    })

    const form = document.getElementById('ambulanceForm')
    const plateInput = document.getElementById('ambPlate')
    const typeSelect = document.getElementById('ambType')
    const statusSelect = document.getElementById('ambStatus')
    const errorEl = document.getElementById('ambulanceError')
    const tipoToId = { 'UTI': 1, 'Basica': 2 }
    const idToTipo = { 1: 'UTI', 2: 'Basica' }
    const statusToId = {
      'Disponivel': 1,
      'EmAtendimento': 2,
      'Inativa': 3,
      'EmManutencao': 4
    }
    const idToStatus = { 1: 'Disponivel', 2: 'EmAtendimento', 3: 'Inativa', 4: 'EmManutencao' }

    function formatPlate(value){
      const cleaned = (value || '').toUpperCase().replace(/[^A-Z0-9]/g,'')
      let digits = ''
      let letters = ''
      for(const ch of cleaned){
        if(digits.length < 4 && /[0-9]/.test(ch)){
          digits += ch
          continue
        }
        if(digits.length === 4 && letters.length < 3 && /[A-Z]/.test(ch)){
          letters += ch
        }
      }
      let formatted = digits
      if(digits.length === 4){
        formatted += letters.length ? '-' + letters : '-'
      }
      return formatted
    }

    function handlePlateInput(){
      if(!plateInput) return
      const caret = plateInput.selectionStart || 0
      const oldLength = plateInput.value.length
      const formatted = formatPlate(plateInput.value)
      plateInput.value = formatted
      const diff = formatted.length - oldLength
      plateInput.selectionStart = plateInput.selectionEnd = Math.max(0, caret + diff)
    }

    function showError(msg){
      if(!errorEl) return
      errorEl.textContent = msg
    }

    function toast(msg){
      const t = document.getElementById('toast')
      if(!t) return
      t.textContent = msg
      t.hidden = false
      setTimeout(()=>{ t.hidden = true }, 1800)
    }

    async function submitAmbulance(){
      if(!formSel) {
        showError('Selecione uma base válida.')
        return false
      }
      const plate = plateInput?.value.trim() || ''
      const typeValue = typeSelect?.value || ''
      const statusValue = statusSelect?.value || ''
      const baseOption = formSel.selectedOptions?.[0]
      
      // Pegar o baseId do dataset (ID da base no banco) e nodeId do value (ID do bairro)
      const baseId = baseOption?.dataset.baseId ? Number(baseOption.dataset.baseId) : null
      
      if(!plate || !typeValue || !baseId || !statusValue){
        showError('Preencha placa, tipo, base e status.')
        return false
      }
      const tipoId = tipoToId[typeValue] || 0
      const statusId = statusToId[statusValue] || 0
      if(!tipoId || !statusId){
        showError('Tipo ou status inválido.')
        return false
      }
      
      console.log('Cadastrando ambulância:', { plate, tipoId, baseId, statusId })
      
      const query = new URLSearchParams({
        placa: plate,
        tipoId: String(tipoId),
        baseId: String(baseId),
        statusId: String(statusId)
      }).toString()
      const payload = {
        login: usuarioLogin,
        token: authToken
      }
      try{
        const resp = await fetch(`${API_URL}/ambulancia/cadastrar?${query}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'http://localhost:8080'
          },
          body: JSON.stringify(payload)
        })
        if(!resp.ok) throw new Error(`Status ${resp.status}`)
      }catch(err){
        console.error('Erro ao cadastrar ambulância', err)
        showError('Falha ao salvar ambulância.')
        return false
      }
      showError('')
      toast('Ambulância cadastrada')
      form?.reset()
      return true
    }

    if(form){
      form.addEventListener('submit', async e=>{
        e.preventDefault()
        const ok = await submitAmbulance()
        if(ok){
          renderAmbulances()
        }
      })
    }

    if(plateInput){
      plateInput.addEventListener('input', handlePlateInput)
      plateInput.value = formatPlate(plateInput.value)
    }

    // Edit modal setup
    const editModal = document.getElementById('ambulanceEditModal')
    const editForm = document.getElementById('ambulanceEditForm')
    const editPlateInput = document.getElementById('editAmbPlate')
    const editTypeSelect = document.getElementById('editAmbType')
    const editBaseSelect = document.getElementById('editAmbBase')
    const editStatusSelect = document.getElementById('editAmbStatus')
    const editErrorEl = document.getElementById('ambulanceEditError')
    const editCancelBtn = document.getElementById('editAmbCancel')
    
    let editingAmbulanceIndex = -1
    
    // Populate edit base select
    populateBaseSelect(editBaseSelect, bases, '')
    
    window.editAmbulance = function(index){
      editingAmbulanceIndex = index
      const amb = ambulancesCache[index]
      if(!amb) return
      
      console.log('Editando ambulância:', amb)
      
      if(editPlateInput) editPlateInput.value = amb.plate || ''
      
      // A API retorna o tipo como string ("UTI" ou "Basica")
      if(editTypeSelect) editTypeSelect.value = amb.type || 'UTI'
      
      // Usar o baseNodeId para selecionar a base (value do option é o nodeId)
      if(editBaseSelect) editBaseSelect.value = String(amb.baseNodeId || '')
      
      // Mapear o status corretamente - usar statusId com fallback para string
      let statusValue = amb.status || 'Disponivel'
      if(amb.statusId && idToStatus[amb.statusId]) {
        statusValue = idToStatus[amb.statusId]
      }
      if(editStatusSelect) editStatusSelect.value = statusValue
      
      if(editErrorEl) editErrorEl.textContent = ''
      if(editModal) editModal.hidden = false
    }
    
    if(editCancelBtn){
      editCancelBtn.addEventListener('click', ()=>{
        if(editModal) editModal.hidden = true
        editingAmbulanceIndex = -1
        if(editErrorEl) editErrorEl.textContent = ''
      })
    }
    
    if(editPlateInput){
      editPlateInput.addEventListener('input', function(){
        const caret = editPlateInput.selectionStart || 0
        const oldLength = editPlateInput.value.length
        const formatted = formatPlate(editPlateInput.value)
        editPlateInput.value = formatted
        const diff = formatted.length - oldLength
        editPlateInput.selectionStart = editPlateInput.selectionEnd = Math.max(0, caret + diff)
      })
    }
    
    if(editForm){
      editForm.addEventListener('submit', async e=>{
        e.preventDefault()
        if(editingAmbulanceIndex < 0) return
        
        const amb = ambulancesCache[editingAmbulanceIndex]
        const plate = editPlateInput?.value.trim() || ''
        const typeValue = editTypeSelect?.value || ''
        const statusValue = editStatusSelect?.value || ''
        const baseOption = editBaseSelect?.selectedOptions?.[0]
        
        // Pegar o baseId do dataset (ID da base no banco)
        const baseId = baseOption?.dataset.baseId ? Number(baseOption.dataset.baseId) : null
        
        if(!plate || !typeValue || !baseId || !statusValue){
          if(editErrorEl) editErrorEl.textContent = 'Preencha todos os campos.'
          return
        }
        
        const tipoId = tipoToId[typeValue] || 0
        const statusId = statusToId[statusValue] || 0
        
        if(!tipoId || !statusId){
          if(editErrorEl) editErrorEl.textContent = 'Tipo ou status inválido.'
          return
        }
        
        console.log('Editando ambulância:', { ambulanciaId: amb.id, plate, tipoId, baseId, statusId })
        
        const payload = {
          token: authToken,
          login: usuarioLogin,
          ambulanciaId: amb.id,
          placa: plate,
          tipoId: tipoId,
          baseId: baseId,
          statusId: statusId
        }
        
        try{
          const resp = await fetch(`${API_URL}/ambulancia/editar-ambulancia`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': 'http://localhost:8080'
            },
            body: JSON.stringify(payload)
          })
          
          if(!resp.ok){
            const errData = await resp.json().catch(()=>({}))
            throw new Error(errData.mensagem || `Status ${resp.status}`)
          }
        }catch(err){
          console.error('Erro ao editar ambulância', err)
          if(editErrorEl) editErrorEl.textContent = 'Falha ao editar ambulância.'
          return
        }
        
        if(editErrorEl) editErrorEl.textContent = ''
        toast('Ambulância atualizada')
        if(editModal) editModal.hidden = true
        editingAmbulanceIndex = -1
        renderAmbulances()
      })
    }

    renderAmbulances()
  }
  function initProfessionalsUI(){
    const table = document.getElementById('professionalTable')
    const filterRole = document.getElementById('filterProfRole')
    const filterStatus = document.getElementById('filterProfStatus')
    const form = document.getElementById('professionalForm')
    const errorEl = document.getElementById('professionalError')
    const editModal = document.getElementById('professionalEditModal')
    const editForm = document.getElementById('professionalEditForm')
    const editErrorEl = document.getElementById('professionalEditError')
    const editNameInput = document.getElementById('editProfName')
    const editRoleSelect = document.getElementById('editProfRole')
    const editContactInput = document.getElementById('editProfContact')
    const editStatusSelect = document.getElementById('editProfStatus')
    const roleToFuncaoId = {
      'Condutor': 1,
      'Enfermeiro': 2,
      'Médico': 3
    }
    let professionalsCache = []
    let editingProfessionalId = null
    const funcaoIdToRole = Object.fromEntries(Object.entries(roleToFuncaoId).map(([role, id]) => [String(id), role]))

    function closeEditModal(){
      if(!editModal) return
      editModal.hidden = true
      editingProfessionalId = null
      if(editErrorEl) editErrorEl.textContent = ''
      editForm?.reset()
    }

    function openEditModal(prof){
      if(!editModal || !editForm || !prof) return
      editingProfessionalId = prof.id
      if(editNameInput) editNameInput.value = prof.nome || ''
      const roleLabel = funcaoIdToRole[String(prof.funcaoId)] || prof.funcao || ''
      if(editRoleSelect) editRoleSelect.value = roleLabel
      if(editContactInput) editContactInput.value = prof.contato || ''
      if(editStatusSelect) editStatusSelect.value = prof.status ? 'Ativo' : 'Inativo'
      if(editErrorEl) editErrorEl.textContent = ''
      editModal.hidden = false
    }

    if(editModal){
      editModal.addEventListener('click', e=>{
        if(e.target === editModal) closeEditModal()
      })
      editModal.querySelectorAll('[data-modal-action="close"]').forEach(btn=>{
        btn.addEventListener('click', closeEditModal)
      })
    }

    async function fetchProfessionalsFromApi(){
      try{
        const resp = await fetch(`${API_URL}/profissional/listar-profissionais`,{
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'Access-Control-Allow-Origin':'http://localhost:8080'
          },
          body:JSON.stringify({ login: usuarioLogin, token: authToken })
        })
        const data = await resp.json()
        if(!Array.isArray(data)) return []

        return data.map(p=>{
          const statusValue = p.ativo === true || String(p.ativo).toLowerCase() === 'true'
          return {
            id: Number(p.id) || null,
            nome: p.nome || p.name || '',
            funcao: p.funcao?.profissao || '',
            funcaoId: Number(p.funcao?.id) || null,
            contato: p.contato || p.contact || '',
            status: statusValue
          }
        })
      }catch(err){
        console.error('Erro ao buscar profissionais', err)
        return []
      }
    }

    async function render(){
      const list = await fetchProfessionalsFromApi()
      professionalsCache = list
      const roleFilterValue = filterRole?.value || ''
      const statusFilterValue = filterStatus?.value || ''
      const filtered = list.filter(p=>{
        const statusLabel = p.status ? 'Ativo' : 'Inativo'
        return (!roleFilterValue || p.funcao===roleFilterValue) && (!statusFilterValue || statusLabel===statusFilterValue)
      })
      
      const header = '<thead><tr><th>Nome</th><th>Função</th><th>Contato</th><th>Status</th><th>Ações</th></tr></thead>'
      const body = filtered.map(p=>{
        const statusLabel = p.status ? 'Ativo' : 'Inativo'
        return `<tr><td><span class="truncate" title="${p.nome}">${p.nome}</span></td><td>${p.funcao}</td><td>${p.contato}</td><td>${statusLabel}</td><td><button type="button" class="icon-button" data-action="edit-prof" data-professional-id="${p.id}">✏️</button></td></tr>`
      }).join('')
      const bodyWrapper = `<tbody>${body}</tbody>`
      if(table){
        table.innerHTML = header + bodyWrapper
        table.querySelectorAll('[data-action="edit-prof"]').forEach(btn=>{
          const id = Number(btn.dataset.professionalId)
          btn.addEventListener('click', ()=>{
            const prof = professionalsCache.find(p=>p.id === id)
            if(prof) openEditModal(prof)
          })
        })
      }
    }

    function toast(msg){
      const t = document.getElementById('toast')
      if(!t) return
      t.textContent = msg
      t.hidden = false
      setTimeout(()=>{ t.hidden = true }, 1800)
    }

    if(editForm){
      editForm.addEventListener('submit',async e=>{
        e.preventDefault()
        if(!editingProfessionalId){
          if(editErrorEl) editErrorEl.textContent = 'Selecione um profissional para editar.'
          return
        }
        const name = editNameInput?.value.trim() || ''
        const roleLabel = editRoleSelect?.value || ''
        const contato = editContactInput?.value.trim() || ''
        const status = editStatusSelect?.value || ''
        if(!name || !roleLabel || !contato){
          if(editErrorEl) editErrorEl.textContent = 'Preencha nome, função e contato.'
          return
        }
        if(editErrorEl) editErrorEl.textContent = ''
        const funcaoId = roleToFuncaoId[roleLabel] || professionalsCache.find(p=>p.id === editingProfessionalId)?.funcaoId || 0
        const ativo = status === 'Ativo'
        const payload = {
          adminToken: authToken,
          adminLogin: usuarioLogin,
          profissionalId: editingProfessionalId,
          nome: name,
          contato,
          funcaoId,
          ativo
        }
        try{
          const resp = await fetch(`${API_URL}/profissional/editar-profissional`,{
            method:'POST',
            headers:{
              'Content-Type':'application/json',
              'Access-Control-Allow-Origin':'http://localhost:8080'
            },
            body: JSON.stringify(payload)
          })
          if(!resp.ok){ throw new Error(`Status ${resp.status}`) }
        }catch(err){
          console.error('Erro ao atualizar profissional', err)
          if(editErrorEl) editErrorEl.textContent = 'Falha ao atualizar profissional.'
          return
        }
        await render()
        closeEditModal()
        toast('Profissional atualizado')
      })
    }

    if(form){
      form.addEventListener('submit',async e=>{
        e.preventDefault()
        const name = document.getElementById('profName')?.value.trim() || ''
        const funcao = document.getElementById('profRole')?.value || ''
        const contato = document.getElementById('profContact')?.value.trim() || ''
        const status = document.getElementById('profStatus')?.value || ''
        if(!name || !funcao || !contato){
          if(errorEl) errorEl.textContent = 'Preencha nome, função e contato.'
          return
        }
        if(errorEl) errorEl.textContent = ''
        const funcaoId = roleToFuncaoId[funcao] || 0
        const ativo = status === 'Ativo' ? 'true' : 'false'
        const url = `${API_URL}/profissional/cadastrar?nome=${encodeURIComponent(name)}&contato=${encodeURIComponent(contato)}&funcaoId=${encodeURIComponent(funcaoId)}&ativo=${encodeURIComponent(ativo)}`
        try{
          const resp = await fetch(url,{ 
            method:'POST',
            headers:{
              'Content-Type':'application/json',
              'Access-Control-Allow-Origin':'http://localhost:8080'
            },
            body:JSON.stringify({ login: usuarioLogin, token: authToken })
          })
          if(!resp.ok){ throw new Error(`Status ${resp.status}`) }
        }catch(err){
          console.error('Erro ao salvar profissional', err)
          if(errorEl) errorEl.textContent = 'Falha ao salvar profissional.'
          return
        }
        await render()
        toast('Profissional salvo')
        form.reset()
      })
    }

    ;['change','input'].forEach(ev=>{
      if(filterRole) filterRole.addEventListener(ev, render)
      if(filterStatus) filterStatus.addEventListener(ev, render)
    })

    render()
  }
  function initBasesUI(){
    const form = document.getElementById('baseForm')
    const table = document.getElementById('baseTable')
    const baseConfirmModal = document.getElementById('baseConfirmModal')
    const baseConfirmNameEl = document.getElementById('confirmBaseName')
    const baseConfirmBairroEl = document.getElementById('confirmBaseBairro')
    const baseConfirmEnderecoEl = document.getElementById('confirmBaseEndereco')
    let baseConfirmResolver = null
    if(baseConfirmModal){
      const confirmBtn = baseConfirmModal.querySelector('[data-modal-action="confirm"]')
      const cancelBtn = baseConfirmModal.querySelector('[data-modal-action="cancel"]')
      const settle = value => {
        baseConfirmModal.hidden = true
        if(!baseConfirmResolver) return
        const resolve = baseConfirmResolver
        baseConfirmResolver = null
        resolve(value)
      }
      confirmBtn?.addEventListener('click',()=>settle(true))
      cancelBtn?.addEventListener('click',()=>settle(false))
    }
    function requestBaseConfirmation(details){
      if(!baseConfirmModal) return Promise.resolve(true)
      baseConfirmNameEl && (baseConfirmNameEl.textContent = details.name)
      baseConfirmBairroEl && (baseConfirmBairroEl.textContent = details.bairro)
      baseConfirmEnderecoEl && (baseConfirmEnderecoEl.textContent = details.endereco)
      baseConfirmModal.hidden = false
      return new Promise(resolve=>{ baseConfirmResolver = resolve })
    }

    async function loadBairros(){
      try{
        const resp = await fetch(
          `${API_URL}/localizacao/bairros`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': 'http://localhost:8080'
            },
            body: JSON.stringify({ login: usuarioLogin, token: authToken })
          }
        )
        const data = await resp.json()
        if(!Array.isArray(data)) return []
        return data.map((b)=>({
          id: Number(Object.keys(b)[0]),
          name: b[Object.keys(b)[0]]
        }))
      }catch(err){
        console.error('Erro ao carregar bairros', err)
        return []
      }
    }

    async function populateBairroSelect(){
      const select = document.getElementById('baseNodeId')
      if(!select) return
      const bairros = await loadBairros()
      select.innerHTML = '<option value="">Selecione o bairro</option>' +
        bairros.map(b=>`<option value="${b.id}">${b.id} - ${b.name}</option>`).join('')
    }

    async function fetchBasesFromApi(){
      try{
        const resp = await fetch(
          `${API_URL}/localizacao/bases`,{
            method:'POST',
            headers:{
              'Content-Type':'application/json',
              'Access-Control-Allow-Origin':'http://localhost:8080'
            },
            body:JSON.stringify({ login: usuarioLogin, token: authToken })
          }
        )
        const data = await resp.json()
        if(!Array.isArray(data)) return []
        return data.map(b=>({
          baseId: b.id,
          nodeId: b.bairro?.id || null,
          name: b.nome || '',
          bairroNome: b.bairro?.nomeBairro || '',
          endereco: b.endereco || ''
        }))
      }catch(err){
        console.error('Erro ao buscar bases na API', err)
        return []
      }
    }

    async function render(){
      const apiBases = await fetchBasesFromApi()
      writeBases(apiBases)
      console.log('Bases carregadas da API:', apiBases)
      const header = '<tr><th>Base ID</th><th>Bairro ID</th><th>Nome</th><th>Bairro</th><th>Endereço</th></tr>'
      const body = apiBases.map(b=>`<tr><td>${b.baseId||''}</td><td>${b.nodeId||''}</td><td>${b.name||''}</td><td>${b.bairroNome||''}</td><td>${b.endereco||''}</td></tr>`).join('')
      if(table) table.innerHTML = header+body
    }

    function toast(msg){
      const t = document.getElementById('toast')
      if(!t) return
      t.textContent = msg
      t.hidden = false
      setTimeout(()=>{ t.hidden = true }, 1800)
    }

    if(form){
      populateBairroSelect()
      form.addEventListener('submit',async e=>{
        e.preventDefault()
        const err = document.getElementById('baseError')
        const name = document.getElementById('baseName')?.value||''
        const nodeIdStr = document.getElementById('baseNodeId')?.value||''
        const endereco = document.getElementById('baseAddress')?.value||''
        const nodeId = Number(nodeIdStr)
        if(!name || !nodeId || !endereco){ if(err) err.textContent = 'Preencha nome, bairro e endereço.'; return }
        if(err) err.textContent = ''

        const bairroSelect = document.getElementById('baseNodeId')
        const bairroLabel = bairroSelect && bairroSelect.selectedIndex >= 0
          ? bairroSelect.options[bairroSelect.selectedIndex].textContent
          : ''
        const confirmed = await requestBaseConfirmation({
          name,
          bairro: bairroLabel || nodeId,
          endereco
        })
        if(!confirmed) return

        const url = `${API_URL}/localizacao/bases/criar?nomeBase=${encodeURIComponent(name)}&enderecoBase=${encodeURIComponent(endereco)}&idBairro=${encodeURIComponent(nodeId)}`
        try{
          const resp = await fetch(url,
            {
              method:'POST',
              headers:  {
              'Content-Type':'application/json',
              'Access-Control-Allow-Origin':'http://localhost:8080'
              },
              body:JSON.stringify({ login: usuarioLogin, token: authToken })
            })
          if(!resp.ok){ throw new Error(`Status ${resp.status}`) }
        }catch(apiErr){
          console.error('Erro ao criar base', apiErr)
          if(err) err.textContent = 'Falha ao salvar base no servidor.'
          return
        }

        await render()
        toast('Base salva')
        form.reset()
      })
    }

    render()
  }
})();

var _lf = document.getElementById("loginForm")
if(_lf){
  _lf.addEventListener("submit", function(e) {
    e.preventDefault();
    window.location.href = "dashboard.html";
  })
}
