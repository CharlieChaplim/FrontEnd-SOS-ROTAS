;(function(){
  const page = document.body.dataset.page || ''
  const nav = document.querySelector('.nav')
  const navToggle = document.getElementById('navToggle')
  const logoutBtn = document.getElementById('logoutBtn')
  if(navToggle){
    navToggle.addEventListener('click',()=>{ if(nav) nav.classList.toggle('open') })
  }
  if(logoutBtn){
    logoutBtn.addEventListener('click',()=>{ location.href = 'index.html' })
  }

  if(page === 'dashboard' || page === 'occurrences') initDashboard()
  if(page === 'occurrences') initOccurrencesUI()

  function initDashboard(){
    const canvas = document.getElementById('graphCanvas')
    if(!canvas) return

    // ----- dados (copiados do usuário) -----
    const bairros = [
      {id:1,name:'Jardim América'},
      {id:2,name:'Centro'},
      {id:3,name:'Setor Leste'},
      {id:4,name:'Vila Nova'},
      {id:5,name:'Alto da Serra'},
      {id:6,name:'Setor Oeste'},
      {id:7,name:'Distrito Industrial'},
      {id:8,name:'Residencial Esperança'},
      {id:9,name:'Recanto Verde'},
      {id:10,name:'Ecoparque Sul'},
      {id:11,name:'Nova Alvorada'},
      {id:12,name:'Setor das Palmeiras'},
      {id:13,name:'Colina Azul'},
      {id:14,name:'Bela Vista'},
      {id:15,name:'Morada do Sol'},
      {id:16,name:'Setor Central II'},
      {id:17,name:'Lago Azul'},
      {id:18,name:'Residencial Florença'},
      {id:19,name:'Setor Industrial Norte'},
      {id:20,name:'Vale do Cerrado'},
    ]
    const conexoes = [
      [9,16,6.4],[15,19,8.3],[17,7,1.2],[3,5,12.2],[12,4,14.0],[13,7,9.2],[13,6,19.2],[5,9,13.2],[16,3,3.4],[8,10,12.8],[20,1,14.4],[14,3,18.1],[2,18,1.9],[6,11,15.7],[1,17,14.5],[3,4,19.2],[14,19,18.9],[15,18,18.5],[20,2,14.7],[15,20,12.7],[17,15,7.9],[4,12,6.4],[5,15,8.6],[6,2,13.4],[14,15,9.4],[9,3,18.7],[18,7,1.7],[13,7,17.5],[18,9,9.0],[15,11,18.3],[3,4,3.0],[7,2,13.9],[20,4,7.7],[5,16,14.3],[13,4,12.8],[1,16,13.4],[14,3,14.3],[2,6,16.7],[11,8,16.6],[11,10,4.6],[4,1,7.0],[11,7,14.4],[13,5,6.2],[9,20,2.7],[13,15,8.3],[17,13,16.3],[10,14,7.9],[8,1,17.9],[9,2,19.3],[16,17,18.4],[6,14,9.0],[2,19,5.1],[6,5,1.3],[2,1,1.4],[20,19,3.7],[20,2,6.5],[4,8,13.1],[4,19,3.8],[16,11,2.8],[13,16,7.8]
    ]

    // ----- configurar bases / ambulâncias -----
    // ajuste aqui: ids das bases (vértices) e disponibilidade
    // Exemplo: base 2 (Centro) e base 11 (Nova Alvorada) têm ambulância disponível
    const bases = [
      {nodeId: 2, available:true, name:'Base Centro'},
      {nodeId: 11, available:true, name:'Base Nova Alvorada'},
      // adicione mais bases aqui se quiser
    ]

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
    function read(){
      try{ return JSON.parse(localStorage.getItem('occurrences')||'[]') }catch(e){ return [] }
    }
    function write(list){ localStorage.setItem('occurrences', JSON.stringify(list)) }
    function render(){
      const all = read()
      const s = severitySel && severitySel.value ? severitySel.value : ''
      const n = neighInp && neighInp.value ? neighInp.value.toLowerCase() : ''
      const st = statusSel && statusSel.value ? statusSel.value : ''
      const rows = all.filter(o=>(!s||o.severity===s)&&(!st||o.status===st)&&(!n||String(o.neighborhood||'').toLowerCase().includes(n)))
      const header = '<tr><th>ID</th><th>Bairro</th><th>Tipo</th><th>Severidade</th><th>Status</th><th>Data/Hora</th></tr>'
      const body = rows.map(o=>`<tr><td>${o.id||''}</td><td>${o.neighborhood||''}</td><td>${o.type||''}</td><td>${o.severity||''}</td><td>${o.status||''}</td><td>${o.dateTime||''}</td></tr>`).join('')
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
      form.addEventListener('submit',e=>{
        e.preventDefault()
        const err = document.getElementById('occurrenceError')
        const id = document.getElementById('occId')?.value||''
        const loc = document.getElementById('occLocation')?.value||''
        const neigh = document.getElementById('occNeighborhood')?.value||''
        const type = document.getElementById('occType')?.value||''
        const severity = document.getElementById('occSeverity')?.value||''
        const dateTime = document.getElementById('occDateTime')?.value||''
        const status = document.getElementById('occStatus')?.value||''
        const notes = document.getElementById('occNotes')?.value||''
        if(!neigh){ if(err) err.textContent = 'Selecione um bairro no mapa.'; return }
        if(err) err.textContent = ''
        const list = read()
        list.push({id, location:loc, neighborhood:neigh, type, severity, dateTime, status, notes})
        write(list)
        render()
        toast('Ocorrência salva')
        form.reset()
      })
    }
    ;['change','input'].forEach(ev=>{
      if(severitySel) severitySel.addEventListener(ev,render)
      if(neighInp) neighInp.addEventListener(ev,render)
      if(statusSel) statusSel.addEventListener(ev,render)
    })
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
