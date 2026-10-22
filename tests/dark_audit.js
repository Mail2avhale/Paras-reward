() => {
  const parse = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(s=>parseFloat(s)); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; };
  const lum = ({r,g,b}) => { const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const effBg = (el) => {
    let e = el;
    while (e && e !== document.documentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && cs.backgroundImage.includes('gradient')) {
        const m = cs.backgroundImage.match(/rgba?\([^)]+\)/); if (m) { const c = parse(m[0]); if (c && c.a > 0.5) return {c, el:e, grad:true}; }
      }
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0.5) return {c, el:e};
      e = e.parentElement;
    }
    return {c: parse(getComputedStyle(document.body).backgroundColor) || {r:255,g:255,b:255}, el: document.body};
  };
  const desc = (e) => { const t = e.getAttribute && e.getAttribute('data-testid'); let s = e.tagName.toLowerCase(); if (t) s += `[data-testid=${t}]`; else if (e.className && typeof e.className==='string') s += '.' + e.className.split(/\s+/).slice(0,4).join('.'); return s; };
  const nearestTestid = (e) => { while (e) { const t = e.getAttribute && e.getAttribute('data-testid'); if (t) return t; e = e.parentElement; } return null; };
  const issues = []; const seen = new Set();
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const direct = Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ').trim();
    if (!direct) continue;
    const r = el.getBoundingClientRect(); if (r.width<2||r.height<2) continue;
    const cs = getComputedStyle(el); if (cs.visibility==='hidden'||parseFloat(cs.opacity)===0||cs.display==='none') continue;
    if (cs.webkitTextFillColor && cs.webkitTextFillColor.includes('rgba(0, 0, 0, 0)')) continue;
    const fg = parse(cs.color); if (!fg) continue;
    const bg = effBg(el);
    const L1 = lum(fg), L2 = lum(bg.c); const ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    if (ratio < 2.6) {
      const key = direct.slice(0,40)+cs.color;
      if (seen.has(key)) continue; seen.add(key);
      issues.push({text: direct.slice(0,50), ratio: ratio.toFixed(2), color: cs.color, bg: `rgb(${bg.c.r},${bg.c.g},${bg.c.b})`, el: desc(el), bgEl: desc(bg.el).slice(0,90), tid: nearestTestid(el), y: Math.round(r.top + window.scrollY)});
    }
  }
  const panels = [];
  for (const el of all) {
    const cs = getComputedStyle(el); const c = parse(cs.backgroundColor);
    if (!c || c.a < 0.6) continue;
    if (lum(c) < 0.6) continue;
    const r = el.getBoundingClientRect(); if (r.width*r.height < 6000) continue;
    if (cs.display==='none'||cs.visibility==='hidden') continue;
    panels.push({el: desc(el).slice(0,110), tid: nearestTestid(el), bg: cs.backgroundColor, size: `${Math.round(r.width)}x${Math.round(r.height)}`, y: Math.round(r.top+window.scrollY)});
  }
  return {bodyClass: document.body.className, bodyBg: getComputedStyle(document.body).backgroundColor, issues: issues.slice(0,40), nIssues: issues.length, panels: panels.slice(0,25), nPanels: panels.length};
}
