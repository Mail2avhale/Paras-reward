() => {
  function parse(c){const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};}
  function lum(c){const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);}
  function blend(top,bot){const a=top.a;return {r:top.r*a+bot.r*(1-a),g:top.g*a+bot.g*(1-a),b:top.b*a+bot.b*(1-a),a:1};}
  function bgOf(el){const layers=[];let e=el;let grad=null;
    while(e&&e.nodeType===1){const s=getComputedStyle(e);
      if(s.backgroundImage&&s.backgroundImage!=='none'&&!grad){const cols=(s.backgroundImage.match(/rgba?\([^)]+\)/g)||[]).map(parse);if(cols.length){grad=cols;break;}}
      const c=parse(s.backgroundColor);if(c&&c.a>0){layers.push(c);if(c.a>=0.99)break;}
      e=e.parentElement;}
    let base={r:255,g:255,b:255,a:1};
    if(grad){ // average gradient colours, also return min/max
      const avg=grad.reduce((a,c)=>({r:a.r+c.r/grad.length,g:a.g+c.g/grad.length,b:a.b+c.b/grad.length}),{r:0,g:0,b:0});
      base={...avg,a:1};
      // blend gradient alpha over ivory if transparent
      const ga=grad.reduce((a,c)=>a+c.a,0)/grad.length; if(ga<0.99) base=blend({...avg,a:ga},{r:255,g:249,b:232,a:1});
    }
    for(let i=layers.length-1;i>=0;i--) base=blend(layers[i],base);
    return {bg:base,grad:!!grad};}
  const out=[];
  const root=document.querySelector('[data-testid="referrals-page"]')||document.body;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const seen=new Set();
  while(walker.nextNode()){const t=walker.currentNode;const txt=t.textContent.trim();if(!txt)continue;const el=t.parentElement;if(seen.has(el))continue;seen.add(el);
    const r=el.getBoundingClientRect();if(r.width===0||r.height===0)continue;const s=getComputedStyle(el);if(s.visibility==='hidden'||parseFloat(s.opacity)===0)continue;
    let op=1;let e=el;while(e){op*=parseFloat(getComputedStyle(e).opacity);e=e.parentElement;}
    const fg=parse(s.color);if(!fg)continue;const {bg,grad}=bgOf(el);const f=blend({...fg,a:fg.a*op},bg);
    const L1=lum(f),L2=lum(bg);const cr=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    if(cr<3){let sec=el.closest('[data-testid]');out.push({txt:txt.slice(0,50),cr:cr.toFixed(2),color:s.color,bg:`rgb(${bg.r|0},${bg.g|0},${bg.b|0})`,grad,section:sec?sec.getAttribute('data-testid'):'',cls:(el.className&&el.className.baseVal===undefined?el.className:'').slice(0,90)});}
  }
  return out;
}
