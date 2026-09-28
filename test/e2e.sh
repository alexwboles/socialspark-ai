#!/usr/bin/env bash
# SocialSpark AI — end-to-end generation flows (exercises the real engine in node)
set -u
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ❌ $1"; }
run()  { node -e "$1"; }

echo "== SocialSpark e2e =="

# Flow 1: full week for an electrician — 7 unique themes, all fields populated
if run "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'VoltEdge Electric',trade:'electrician',jobDescription:'Rewired a 1970s kitchen, added under-cabinet lighting and a new dedicated circuit for the range'});
const themes=new Set(w.posts.map(p=>p.theme));
if(themes.size!==7) throw new Error('themes not unique: '+[...themes].join(','));
for(const p of w.posts){
  for(const t of ['professional','friendly','funny']) if(!p.captions[t]||p.captions[t].length<20) throw new Error('caption too short: '+p.day+'/'+t);
  if(p.hashtags.length<3||p.bestTime.length<3) throw new Error('missing hashtags/bestTime');
}
if(w.tradeLabel!=='Electrical') throw new Error('wrong trade label');
console.log('themes: '+[...themes].join(' | '));
"; then ok "flow 1: electrician week — 7 unique themes, complete posts"; else bad "flow 1 failed"; fi

# Flow 2: friendly tone is warm (emoji), professional tone is buttoned-up
if run "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'Mow Masters',trade:'landscaper',jobDescription:'Tore out an overgrown backyard and installed fresh sod with stone edging and native plant beds'});
const c=w.posts[0].captions;
const emojiRe=/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
if(!emojiRe.test(c.friendly)) throw new Error('friendly tone has no emoji');
if(emojiRe.test(c.professional)) throw new Error('professional tone should not use emoji');
"; then ok "flow 2: tone personalities differ (friendly warm, professional clean)"; else bad "flow 2 failed"; fi

# Flow 3: hashtags are trade-specific — plumber vs roofer differ
if run "
const g=require('./js/generator.js');
const job='Fixed the main issue and cleaned everything up afterwards for the customer';
const a=g.generateWeek({businessName:'A Co',trade:'plumber',jobDescription:job}).posts[0].hashtags.join(' ');
const b=g.generateWeek({businessName:'B Co',trade:'roofer',jobDescription:job}).posts[0].hashtags.join(' ');
if(!a.includes('#Plumber')) throw new Error('plumber tags missing: '+a);
if(!b.includes('#Roofer')) throw new Error('roofer tags missing: '+b);
if(a===b) throw new Error('trade hashtags identical');
"; then ok "flow 3: trade-specific hashtags (plumber vs roofer)"; else bad "flow 3 failed"; fi

# Flow 4: keyword extraction personalizes captions — 'kitchen' appears for kitchen jobs
if run "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'C Co',trade:'painter',jobDescription:'Repainted the entire kitchen including cabinets, walls and ceiling in a bright modern white'});
const all=w.posts.map(p=>p.captions.friendly).join(' ').toLowerCase();
if(!all.includes('kitchen')) throw new Error('keyword kitchen missing from captions');
const kw=g.extractKeywords('Repainted the entire kitchen including cabinets walls');
if(!kw.includes('kitchen')) throw new Error('extractKeywords missed kitchen: '+kw.join(','));
"; then ok "flow 4: keywords personalize captions"; else bad "flow 4 failed"; fi

# Flow 5: copy-ready text for every day/tone combo is non-trivial
if run "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'D Co',trade:'cleaner',jobDescription:'Deep cleaned a three bedroom rental including carpets, grout lines and inside all kitchen appliances'});
let n=0;
for(const p of w.posts) for(const t of ['professional','friendly','funny']){
  const txt=g.formatPost({captions:p.captions,hashtags:p.hashtags},t);
  if(txt.length<60) throw new Error('formatted post too short: '+p.day+'/'+t);
  n++;
}
if(n!==21) throw new Error('expected 21 combos, got '+n);
"; then ok "flow 5: 21 copy-ready day/tone combos"; else bad "flow 5 failed"; fi

# Flow 6: unknown trade falls back gracefully, still 7 posts
if run "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'E Co',trade:'beekeeping',jobDescription:'Relocated a beehive from inside a garden shed wall to a proper apiary box'});
if(w.posts.length!==7) throw new Error('not 7 posts');
if(w.trade!=='other') throw new Error('trade should fall back to other');
"; then ok "flow 6: unknown trade falls back gracefully"; else bad "flow 6 failed"; fi

# Flow 7: different descriptions -> different tip selection is deterministic per input
if run "
const g=require('./js/generator.js');
const mk=(d)=>g.generateWeek({businessName:'F Co',trade:'hvac',jobDescription:d}).posts[2].captions.professional;
const a1=mk('Installed a new high efficiency furnace with smart thermostat integration');
const a2=mk('Installed a new high efficiency furnace with smart thermostat integration');
const b=mk('Repaired a leaking refrigerant line on a rooftop commercial unit');
if(a1!==a2) throw new Error('not deterministic');
if(a1===b) throw new Error('tip/caption identical for different jobs');
"; then ok "flow 7: deterministic per job, varies across jobs"; else bad "flow 7 failed"; fi

echo ""
echo "e2e: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
