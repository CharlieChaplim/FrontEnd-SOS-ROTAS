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

  if(page === 'dashboard') initDashboard()

  function initDashboard(){
    const canvas = document.getElementById('graphCanvas')
    if(!canvas) return
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
    const idToNode = new Map()
    const nodes = bairros.map((b,i)=>{
      const a = (i/norm(bairros.length))*Math.PI*2
      return {id:b.id,name:b.name,x:Math.cos(a)*200,y:Math.sin(a)*200,fx:0,fy:0}
    })
    function norm(n){ return n||1 }
    nodes.forEach(n=>idToNode.set(n.id,n))
    const edges = conexoes.map(([u,v,d])=>({u:idToNode.get(u),v:idToNode.get(v),d}))

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

    let dragging = false, lastX = 0, lastY = 0
    canvas.addEventListener('mousedown',e=>{ dragging = true; lastX = e.offsetX*deviceRatio; lastY = e.offsetY*deviceRatio })
    window.addEventListener('mouseup',()=>{ dragging = false })
    window.addEventListener('mousemove',e=>{
      if(!dragging) return
      const x = e.offsetX*deviceRatio, y = e.offsetY*deviceRatio
      tx += x - lastX
      ty += y - lastY
      lastX = x; lastY = y
      draw()
    })
    canvas.addEventListener('wheel',e=>{
      e.preventDefault()
      const mouseX = e.offsetX*deviceRatio, mouseY = e.offsetY*deviceRatio
      const [wx,wy] = toWorld(mouseX,mouseY)
      const k = Math.exp(-e.deltaY*0.001)
      scale = Math.max(0.2, Math.min(4, scale*k))
      const [sx,sy] = [wx*scale, wy*scale]
      tx = mouseX - sx
      ty = mouseY - sy
      draw()
    },{passive:false})

    let hoverNode = null
    canvas.addEventListener('mousemove',e=>{
      const x = e.offsetX*deviceRatio, y = e.offsetY*deviceRatio
      const [wx,wy] = toWorld(x,y)
      hoverNode = findNode(wx,wy)
      draw()
    })

    function findNode(x,y){
      let best=null, bestD=Infinity
      for(const n of nodes){
        const dx = n.x-x, dy = n.y-y
        const d2 = dx*dx+dy*dy
        if(d2 < bestD && d2 < 16*16){ best=n; bestD=d2 }
      }
      return best
    }

    function layout(){
      const ITER = 200;    // menos iterações → menos “explosão”
      const REP = 2000;    // força repulsiva menor
      const SPRING = 0.01; // força da mola reduzida
      const BASE = 20;     // tamanho base da aresta bem menor
      const SCALE = 2;     // escala da distância bem menor

      for (let iter = 0; iter < ITER; iter++){
        for(const n of nodes){ n.fx = 0; n.fy = 0 }

        // repulsão
        for(let i=0;i<nodes.length;i++){
          for(let j=i+1;j<nodes.length;j++){
            const a = nodes[i], b = nodes[j]
            const dx = b.x - a.x, dy = b.y - a.y
            const dist = Math.hypot(dx, dy) || 1
            const rep = REP / (dist * dist)
            const ux = dx / dist, uy = dy / dist
            a.fx -= ux * rep; a.fy -= uy * rep
            b.fx += ux * rep; b.fy += uy * rep
          }
        }

        // atração das arestas
        for (const e of edges){
          const dx = e.v.x - e.u.x
          const dy = e.v.y - e.u.y
          const dist = Math.hypot(dx,dy) || 1
          const target = BASE + e.d * SCALE
          const k = (dist - target) * SPRING
          const ux = dx / dist, uy = dy / dist
          e.u.fx += ux * k; e.u.fy += uy * k
          e.v.fx -= ux * k; e.v.fy -= uy * k
        }

        // deslocamento
        for(const n of nodes){
          n.x += n.fx * 0.05
          n.y += n.fy * 0.05
        }
      }
    }


    function fit(){
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity
      for(const n of nodes){
        if(n.x<minX)minX=n.x; if(n.y<minY)minY=n.y; if(n.x>maxX)maxX=n.x; if(n.y>maxY)maxY=n.y
      }
      const w = canvas.width, h = canvas.height
      const gw = maxX-minX, gh = maxY-minY
      const pad = 40*deviceRatio
      const sx = (w - 2*pad)/gw
      const sy = (h - 2*pad)/gh
      scale = Math.min(sx,sy)
      tx = pad - minX*scale
      ty = pad - minY*scale
    }

    function draw(){
      const w = canvas.width, h = canvas.height
      ctx.setTransform(1,0,0,1,0,0)
      ctx.clearRect(0,0,w,h)
      ctx.fillStyle = '#e5e7eb'
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
      ctx.globalAlpha = 0.8
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
        ctx.strokeStyle = '#9e9e9e'
        ctx.lineWidth = 5
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke()
        const mx = (x1+x2)/2, my = (y1+y2)/2
        const ang = Math.atan2(y2-y1,x2-x1)
        ctx.save()
        ctx.translate(mx,my)
        ctx.rotate(ang)
        ctx.fillStyle = '#1a1a1a'
        ctx.font = '12px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText(e.d.toFixed(1)+' km',0,-8)
        ctx.restore()
      }
    }

    function drawNodes(){
      for(const n of nodes){
        const r = hoverNode && hoverNode.id===n.id ? 8 : 6
        ctx.fillStyle = '#d32f2f'
        ctx.beginPath(); ctx.arc(n.x,n.y,r,0,Math.PI*2); ctx.fill()
        ctx.fillStyle = '#000'
        ctx.font = '12px system-ui'
        ctx.textAlign = 'left'
        ctx.fillText(n.name,n.x+10,n.y+4)
      }
    }

    layout()
    resize()
    fit()
    draw()
  }
})();

