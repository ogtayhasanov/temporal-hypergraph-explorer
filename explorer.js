
(async () => {
  const root=document.getElementById('constructor-cluster-explorer');
  const response=await fetch('assets/clusters.json');
  if(!response.ok)throw new Error('Saved data unavailable');
  const data=await response.json();
  const yearControl=root.querySelector('[data-year]'),up=root.querySelector('[data-up]'),open=root.querySelector('[data-open]');
  const path=root.querySelector('[data-path]'),selection=root.querySelector('[data-selection]'),chart=root.querySelector('.ce-chart'),svg=chart.querySelector('svg');
  const evidence=root.querySelector('[data-evidence]'),edgeControl=root.querySelector('[data-edge]'),source=root.querySelector('[data-source]'),endpoints=root.querySelector('[data-endpoints]');
  const NS='http://www.w3.org/2000/svg';
  let year=2026,current=null,selected=null,edge=null,items=[],positions=[],groupMap=new Map(),parentMap=new Map(),eligible=[],internal=[];
  const layoutCache=new Map();
  const create=(name,attrs,text)=>{const el=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs||{}))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;};
  const escapeOption=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;};
  function renderChrome(){
    window.renderConstructorChrome({year,current,selected,groupMap,items,internal,
      entityCount:parentMap.size,relationCount:eligible.length,paperCount:new Set(eligible.map(e=>e[3])).size},
      id=>{if(id&&id.startsWith('n:'))inspect(id);else{current=id;selected=null;update();}});
  }
  function setup(){
    groupMap=new Map(data.g[String(year)].map(g=>[g[0],{id:g[0],parent:g[1],label:g[2],members:g[3]}]));
    parentMap=new Map();for(const g of groupMap.values())if(g.id.startsWith('L2-'))for(const n of g.members)parentMap.set(n,g.id);
    eligible=data.e.filter(e=>e[2]<=year);
    if(current&&!groupMap.has(current))current=null;
    selected=null;edge=null;update();
  }
  function update(){
    const group=current?groupMap.get(current):null;
    const leaf=group&&group.id.startsWith('L2-');
    items=leaf?group.members.map(n=>({id:'n:'+n,n,label:data.n[n][1],type:data.n[n][2],count:1})):
      [...groupMap.values()].filter(g=>g.parent===current).map(g=>({...g,count:g.members.length}));
    items.sort((a,b)=>a.id.localeCompare(b.id));
    up.disabled=current===null;
    const pieces=[];let at=group;
    while(at){pieces.unshift(at.id+' '+at.label);at=at.parent?groupMap.get(at.parent):null;}
    path.textContent=year+' / '+(pieces.length?pieces.join(' / '):'All '+parentMap.size.toLocaleString()+' entities')+' / '+items.length+' '+(leaf?'entities':'child groups');
    open.replaceChildren(escapeOption('',leaf?'Select an entity':'Open a child group'));
    for(const item of items)open.appendChild(escapeOption(item.id,item.id+' — '+item.label+(leaf?'':' ('+item.count+')')));
    if(leaf){
      const members=new Set(group.members);internal=eligible.filter(e=>e[4].every(n=>members.has(n)));
      path.textContent+=' / '+internal.length+' complete internal relations';
      edgeControl.replaceChildren(escapeOption('','No relation selected'));
      for(const e of internal)edgeControl.appendChild(escapeOption(e[0],e[0]+' '+e[1]+' ('+e[4].length+' endpoints, '+e[2]+')'));
      if(current==='L2-00105'&&internal.some(e=>e[0]==='h_00512'))edge='h_00512';
      else edge=null;
      edgeControl.value=edge||'';evidence.hidden=internal.length===0;
    }else{internal=[];edge=null;evidence.hidden=true;}
    selection.textContent=group?group.id+' · '+group.label+' · '+group.members.length+' members':'15 broad groups in the 2026 snapshot; choose a group to inspect its actual children.';
    if(!group)selection.textContent=items.length+' broad groups · '+parentMap.size.toLocaleString()+' entities';
    draw();showEvidence();renderChrome();
  }
  function packing(rows){
    if(rows.length>38){
      const cols=Math.ceil(Math.sqrt(rows.length*1.45));
      return rows.map((r,i)=>({x:(i%cols)*2.1+(Math.floor(i/cols)%2)*1.05,y:Math.floor(i/cols)*1.85,r:.75}));
    }
    const rr=rows.map(n=>Math.sqrt(n.count));const order=rows.map((_,i)=>i).sort((a,b)=>rr[b]-rr[a]);const placed=[],p=[];
    for(const i of order){
      if(!placed.length)p[i]={x:0,y:0,r:rr[i]};
      else{
        let best=null,score=Infinity;
        for(const j of placed)for(let a=0;a<360;a+=15){
          const r=rr[i]+rr[j]+.7,x=p[j].x+r*Math.cos(a*Math.PI/180),y=p[j].y+r*Math.sin(a*Math.PI/180);
          if(!placed.every(k=>Math.hypot(x-p[k].x,y-p[k].y)>=rr[i]+rr[k]+.65))continue;
          const sc=Math.hypot(x,y)+rr[i];if(sc<score){score=sc;best={x,y,r:rr[i]};}
        }
        p[i]=best||{x:placed.length*rr[i]*2.5,y:0,r:rr[i]};
      }placed.push(i);
    }return p;
  }
  function incidenceLayout(){
    const key=year+':'+current;
    if(layoutCache.has(key))return layoutCache.get(key);
    const nodeIndex=new Map(items.map((item,i)=>[item.n,i]));
    const total=items.length+internal.length;
    const p=Array.from({length:total},(_,i)=>{
      const angle=i*2.399963229728653,r=45+125*Math.sqrt((i+1)/total);
      return {x:r*Math.cos(angle),y:r*Math.sin(angle),r:i<items.length?7:3};
    });
    const links=[];
    internal.forEach((e,j)=>{for(const n of e[4])links.push([nodeIndex.get(n),items.length+j]);});
    for(let iteration=0;iteration<220;iteration++){
      const fx=new Float64Array(total),fy=new Float64Array(total),alpha=1-iteration/230;
      for(let a=0;a<total;a++)for(let b=a+1;b<total;b++){
        const dx=p[a].x-p[b].x,dy=p[a].y-p[b].y,d2=Math.max(25,dx*dx+dy*dy);
        const strength=(a<items.length&&b<items.length?650:220)/d2;
        fx[a]+=dx*strength;fy[a]+=dy*strength;fx[b]-=dx*strength;fy[b]-=dy*strength;
      }
      for(const [a,b] of links){
        const dx=p[b].x-p[a].x,dy=p[b].y-p[a].y,d=Math.max(1,Math.hypot(dx,dy)),force=(d-36)*.12/d;
        fx[a]+=dx*force;fy[a]+=dy*force;fx[b]-=dx*force;fy[b]-=dy*force;
      }
      for(let a=0;a<total;a++){
        fx[a]-=p[a].x*.006;fy[a]-=p[a].y*.006;
        const magnitude=Math.max(1,Math.hypot(fx[a],fy[a])/(10*alpha));p[a].x+=fx[a]/magnitude;p[a].y+=fy[a]/magnitude;
      }
    }
    const result={p,links};layoutCache.set(key,result);return result;
  }
  function draw(){
    const width=Math.max(280,chart.clientWidth),height=width<480?365:460;
    svg.setAttribute('viewBox','0 0 '+width+' '+height);svg.setAttribute('height',height);svg.replaceChildren();
    svg.appendChild(create('title',{},'Actual '+year+' clusters, current parent '+(current||'all groups')));
    svg.appendChild(create('desc',{},'Circle sizes show member counts within this view. Click groups to descend. A selected fine group can display complete internal raw relations.'));
    if(!items.length)return;
    const isEntityView=items[0].n!==undefined,network=isEntityView?incidenceLayout():null;
    const packed=network?network.p:packing(items),xmin=Math.min(...packed.map(p=>p.x-p.r)),xmax=Math.max(...packed.map(p=>p.x+p.r)),ymin=Math.min(...packed.map(p=>p.y-p.r)),ymax=Math.max(...packed.map(p=>p.y+p.r));
    const scale=Math.min((width-36)/(xmax-xmin),(height-28)/(ymax-ymin));
    const sx=network?(width-44)/(xmax-xmin):scale,sy=network?(height-52)/(ymax-ymin):scale;
    const allPositions=packed.map((p,i)=>({x:width/2+(p.x-(xmin+xmax)/2)*sx,y:height/2+(p.y-(ymin+ymax)/2)*sy,r:network?4.2:p.r*scale,item:items[i]}));
    positions=allPositions.slice(0,items.length);
    const chosen=internal.find(e=>e[0]===edge),active=new Set(chosen?chosen[4]:[]);
    if(network){
      for(const [a,b] of network.links){const p=allPositions[a],q=allPositions[b];svg.appendChild(create('line',{x1:p.x,y1:p.y,x2:q.x,y2:q.y,class:'ce-context-edge'}));}
      internal.forEach((e,j)=>{const p=allPositions[items.length+j],r=2.5;svg.appendChild(create('polygon',{points:[[p.x,p.y-r],[p.x+r,p.y],[p.x,p.y+r],[p.x-r,p.y]].map(p=>p.join(',')).join(' '),class:'ce-context-hyperedge'}));});
      if(chosen){
        const hub=allPositions[items.length+internal.indexOf(chosen)],x=hub.x,y=hub.y;
        for(const p of positions.filter(p=>active.has(p.item.n)))svg.appendChild(create('line',{x1:x,y1:y,x2:p.x,y2:p.y,class:'ce-edge'}));
        const r=6;svg.appendChild(create('polygon',{points:[[x,y-r],[x+r,y],[x,y+r],[x-r,y]].map(p=>p.join(',')).join(' '),class:'ce-hyperedge'}));
      }
    }
    for(const p of positions){
      const entity=p.item.n!==undefined,cl='ce-node'+(entity?' ce-entity':'')+(active.has(p.item.n)?' ce-evidence':'')+(selected===p.item.id?' ce-selected':'');
      const g=create('g',{'data-id':p.item.id});
      g.appendChild(create('circle',{cx:p.x,cy:p.y,r:p.r*(entity&&active.has(p.item.n)?1.45:1),class:cl}));
      if(!entity&&p.r>16){
        const short=p.item.id.split('-')[1].replace(/^0+/,'')||'0';
        g.appendChild(create('text',{x:p.x,y:p.y-3,'text-anchor':'middle'},p.item.id.slice(0,2)+'-'+short));
        if(p.r>26)g.appendChild(create('text',{x:p.x,y:p.y+14,'text-anchor':'middle'},p.item.count.toLocaleString()));
      }
      if(entity&&active.has(p.item.n)&&chosen[4].length<=6)g.appendChild(create('text',{x:p.x,y:p.y-p.r-4,'text-anchor':'middle'},String(chosen[4].indexOf(p.item.n)+1)));
      svg.appendChild(g);
    }
  }
  function inspect(id){
    const item=items.find(n=>n.id===id);if(!item)return;
    if(item.n!==undefined){
      selected=id;selection.textContent=data.n[item.n][0]+' · '+item.type+' · '+item.label;
      const match=internal.find(e=>e[4].includes(item.n));if(match){edge=match[0];edgeControl.value=edge;}else{edge=null;edgeControl.value='';}
      draw();showEvidence();renderChrome();
    }else{current=id;selected=null;update();}
  }
  function showEvidence(){
    endpoints.replaceChildren();const e=internal.find(x=>x[0]===edge);
    if(!e){source.textContent=internal.length?internal.length+' complete raw relations lie inside this fine group.':'';return;}
    source.textContent=e[0]+' · '+e[1]+' · source article '+e[3]+' · publication year '+e[2]+' · '+e[4].length+' original endpoints';
    for(const n of e[4]){const li=document.createElement('li');li.textContent=data.n[n][0]+' · '+data.n[n][2]+' · '+data.n[n][1];endpoints.appendChild(li);}
  }
  svg.addEventListener('click',event=>{
    const rect=svg.getBoundingClientRect(),p={x:event.clientX-rect.left,y:event.clientY-rect.top};
    const nearest=positions.slice().sort((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)-a.r-(Math.hypot(p.x-b.x,p.y-b.y)-b.r))[0];
    if(nearest&&Math.hypot(p.x-nearest.x,p.y-nearest.y)<=Math.max(nearest.r,22))inspect(nearest.item.id);
  });
  yearControl.addEventListener('change',()=>{year=Number(yearControl.value);setup();});
  up.addEventListener('click',()=>{current=current?groupMap.get(current).parent:null;selected=null;update();});
  root.querySelector('[data-example]').addEventListener('click',()=>{year=2026;yearControl.value='2026';current='L2-00105';setup();});
  open.addEventListener('change',()=>{if(open.value)inspect(open.value);});
  edgeControl.addEventListener('change',()=>{edge=edgeControl.value||null;selected=null;draw();showEvidence();renderChrome();});
  new ResizeObserver(()=>draw()).observe(chart);
  const hover=root.querySelector('[data-hover]');
  svg.addEventListener('pointermove',event=>{
    const bounds=svg.getBoundingClientRect(),x=event.clientX-bounds.left,y=event.clientY-bounds.top;
    const p=positions.find(p=>Math.hypot(x-p.x,y-p.y)<=Math.max(p.r,8));
    if(!p){hover.hidden=true;return;}
    hover.textContent=(p.item.n===undefined?p.item.id+' · '+p.item.count+' entities':p.item.type)+' · '+p.item.label;
    hover.style.left=Math.max(5,Math.min(x+13,chart.clientWidth-270))+'px';hover.style.top=Math.max(0,y-45)+'px';hover.hidden=false;
  });
  svg.addEventListener('pointerleave',()=>{hover.hidden=true;});
  setup();
})().catch(error=>{
  console.error(error);
  const line=document.querySelector('[data-snapshot-meta]');if(line)line.textContent='Could not load the saved results. Please reload the page.';
});
