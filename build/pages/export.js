// Runs the real app in a headless browser and asks it, for the most frequent words of each language,
// which word it shows in every other language. Output: build/pages/words.json
const path=require('path');
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http=require('http'),fs=require('fs');
const root=path.join(__dirname,'..','..','app'), N=+process.argv[2]||1000;
const T={'.js':'text/javascript','.html':'text/html','.json':'application/json','.gz':'application/gzip','.png':'image/png','.jpg':'image/jpeg','.css':'text/css','.woff2':'font/woff2','.webmanifest':'application/json'};
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';
 fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(d)})}).listen(+process.env.PORT||8770);
(async()=>{const b=await chromium.launch({executablePath:"/usr/bin/google-chrome",args:["--no-sandbox","--js-flags=--max-old-space-size=6144"]});
const OUT=path.join(__dirname,process.env.OUT||'words.json'), only=(process.argv[3]||'en,de,fr,pt,cs,it,es,nl,sv,la').split(',');
const out=fs.existsSync(OUT)&&process.argv[4]==='keep'?JSON.parse(fs.readFileSync(OUT)):{};
for(const SRC of only){
const p=await b.newPage(); p.on('pageerror',e=>console.error('pageerror',e.message));
await p.goto('http://localhost:'+(process.env.PORT||8770)+'/'); await p.waitForFunction(()=>window.FLT&&window.FLT.D.ready,null,{timeout:120000});
const one=await p.evaluate(async ([N,SRC])=>{
  const {D,S,loadLang,ensureIds,visibleSenses,trIds,withArt,article,withTo,levelOf,cleanGloss}=window.FLT;
  const linkedIds=e=>[...e.senses.flatMap(s=>Object.values(s.translations).flat()),...(e.synonyms||[])];
  const L=['en','de','fr','pt','cs','it','es','nl','sv','la'];
  for(const l of L) await loadLang(l);
  S.order.splice(0,S.order.length,...L);
  const res={};
  for(const l of [SRC]){
    const rows=[...D.byId.values()].filter(e=>e.lang===l&&e.tier==='core'&&e.frequency_rank).sort((a,b)=>a.frequency_rank-b.frequency_rank);
    const seen=new Set(), list=[];
    for(const e of rows){ if(list.length>=N) break; if(seen.has(e.id)) continue; seen.add(e.id); list.push(e); }
    res[l]=[];
    for(const e of list){
      try{ await ensureIds(linkedIds(e)); }catch(x){}
      const vis=visibleSenses(e); if(!vis.length) continue;
      const senses=[];
      for(const {s,i} of vis.slice(0,4)){
        const tr={};
        for(const o of L){ if(o===e.lang) continue; const ids=trIds(s,o); try{await ensureIds(ids);}catch(x){}
          const w=ids.map(id=>D.byId.get(id)).filter(Boolean).slice(0,3).map(t=>({id:t.id,lemma:t.lemma,shown:withArt(article(o,t,t.lemma),withTo(t.id,t.lemma)),pos:t.pos}));
          if(w.length) tr[o]=w; }
        if(Object.keys(tr).length) senses.push({gloss:cleanGloss(s.gloss_en),tr});
      }
      if(!senses.length) continue;
      res[l].push({id:e.id,lemma:e.lemma,pos:e.pos,shown:withArt(article(l,e,e.lemma),withTo(e.id,e.lemma)),level:(levelOf(e)||{}).level||levelOf(e)||null,ipa:e.ipa&&e.ipa.default,gender:e.noun&&e.noun.gender,plural:e.noun&&e.noun.plural,rank:e.frequency_rank,senses});
    }
  }
  return res;
},[N,SRC]);
out[SRC]=one[SRC]; fs.writeFileSync(OUT,JSON.stringify(out)); console.log(SRC,out[SRC].length); await p.close();
}
await b.close();srv.close();})();
