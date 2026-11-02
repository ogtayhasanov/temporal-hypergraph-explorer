window.renderConstructorChrome = function(state, navigate) {
  const {year,current,selected,groupMap,items,internal,entityCount,relationCount,paperCount} = state;
  const root=document.getElementById('constructor-cluster-explorer');
  const set=(selector,value)=>{const el=document.querySelector(selector);if(el)el.textContent=value;};
  const group=current?groupMap.get(current):null;
  const isLeaf=!!group&&group.id.startsWith('L2-');
  const counts=[0,1,2].map(level=>[...groupMap.values()].filter(g=>g.id.startsWith('L'+level+'-')).length);
  set('[data-snapshot-meta]',year+' snapshot · '+entityCount.toLocaleString()+' entities · '+relationCount.toLocaleString()+' relations · '+paperCount+' source papers');
  set('[data-current-title]',group?group.label:'All broad groups');
  set('[data-view-level]',!group?'WHOLE HIERARCHY':isLeaf?'INDIVIDUAL ENTITIES':group.id.startsWith('L0-')?'INSIDE A BROAD GROUP':'INSIDE A MIDDLE GROUP');
  set('[data-list-title]',!group?'Broad groups':isLeaf?'Entities':group.id.startsWith('L0-')?'Middle groups':'Fine groups');
  set('[data-list-count]',items.length);
  set('[data-list-hint]',isLeaf?'Select an entity to inspect an original relation.':'Select a group to see its actual children.');
  set('[data-current-count]',isLeaf?items.length+' entity members · '+internal.length+' complete internal relations':items.length+' child groups'+(group?' · '+group.members.length+' entity members':''));
  set('[data-group-counts]','Whole map: '+counts[0]+' broad / '+counts[1]+' middle / '+counts[2]+' fine');
  set('[data-graph-description]',isLeaf?'Circles are actual entities. Diamonds are complete internal relations. The selected relation and its endpoints are highlighted.':'Each circle is one '+(!group?'broad':group.id.startsWith('L0-')?'middle':'fine')+' group. Circle area shows its number of entity members. Select a group to look inside.');
  if(selected===null)set('[data-selection]','');
  const list=root.querySelector('[data-children]');list.replaceChildren();
  for(const item of items){
    const button=document.createElement('button');button.type='button';button.className='child-button';
    button.setAttribute('aria-label',item.id+' '+item.label+(item.n===undefined?', '+item.count+' entities':''));
    if(selected===item.id)button.setAttribute('aria-current','true');
    const title=document.createElement('span');title.textContent=item.label;
    const sub=document.createElement('small');
    const id=document.createElement('span');id.textContent=item.n===undefined?item.id:item.type;
    const count=document.createElement('span');count.textContent=item.n===undefined?item.count.toLocaleString()+' entities':'';
    sub.appendChild(id);sub.appendChild(count);button.appendChild(title);button.appendChild(sub);
    button.addEventListener('click',()=>navigate(item.id));list.appendChild(button);
  }
  const crumbs=root.querySelector('[data-breadcrumbs]');crumbs.replaceChildren();
  const home=document.createElement('button');home.type='button';home.textContent='All groups';home.addEventListener('click',()=>navigate(null));crumbs.appendChild(home);
  const chain=[];let at=group;
  while(at){chain.unshift(at);at=at.parent?groupMap.get(at.parent):null;}
  for(const g of chain){
    const sep=document.createElement('span');sep.textContent='/';sep.setAttribute('aria-hidden','true');crumbs.appendChild(sep);
    if(g.id===current){const label=document.createElement('span');label.className='crumb-current';label.textContent=g.id;crumbs.appendChild(label);}
    else{const button=document.createElement('button');button.type='button';button.textContent=g.id;button.setAttribute('aria-label','Open '+g.label);button.addEventListener('click',()=>navigate(g.id));crumbs.appendChild(button);}
  }
  for(const [selector,value] of [['[data-output-year]',year],['[data-output-l0]',counts[0]],['[data-output-l1]',counts[1]],['[data-output-l2]',counts[2]],['[data-output-n]',entityCount.toLocaleString()]])set(selector,value);
};
