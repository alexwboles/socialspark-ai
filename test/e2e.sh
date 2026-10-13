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

# Flow 8: week markdown differs by tone; plain-text has all 7 posts with separators
if run "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'G Co',trade:'painter',jobDescription:'Repainted a full home exterior in a modern coastal palette with crisp trim work'});
const a=g.weekToMarkdown(w,'professional'), b=g.weekToMarkdown(w,'funny');
if(a===b) throw new Error('tone variants identical in markdown');
const txt=g.weekToPlainText(w,'friendly');
if((txt.match(/---/g)||[]).length!==6) throw new Error('separators: '+txt.length);
for(const d of ['Monday','Sunday']) if(!txt.includes(d)) throw new Error('missing '+d);
"; then ok "flow 8: markdown + plain-text week exports"; else bad "flow 8 failed"; fi

# Flow 9: up-next scheduler picks the chronologically nearest future slot
if run "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'H Co',trade:'cleaner',jobDescription:'Deep cleaned a three bedroom rental including carpets grout and appliances'});
const n1=g.nextPostAt(w.posts,'2026-10-05T07:00:00');
if(n1.day!=='Monday'||n1.inHours!==11&&n1.inHours!==12) throw new Error('mon 6:30pm expected, got '+n1.day+' '+n1.inHours);
const n2=g.nextPostAt(w.posts,'2026-10-05T19:00:00');
if(n2.day!=='Tuesday') throw new Error('after Monday slot should be Tuesday, got '+n2.day);
"; then ok "flow 9: scheduler picks nearest future slot"; else bad "flow 9 failed"; fi

# Flow 10: bank import round-trip — exported shape re-imports cleanly
if run "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'I Co',trade:'roofer',jobDescription:'Replaced storm damaged shingles and installed new ridge vent on a ranch home'});
const bank=[{id:1,day:w.posts[0].day,theme:w.posts[0].theme,tone:'professional',text:g.formatPost({captions:w.posts[0].captions,hashtags:w.posts[0].hashtags},'professional')}];
const back=g.parseBankImport(JSON.stringify(bank));
if(back.length!==1||!back[0].text.includes('#')) throw new Error('round-trip lost text');
"; then ok "flow 10: bank export/import round-trip"; else bad "flow 10 failed"; fi

# Flow 11: business profile CTA is appended to copied posts
if run "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'J Co',trade:'painter',jobDescription:'Repainted a two story craftsman exterior including siding and trim work'});
const prof=g.sanitizeProfile({handle:'brightline',phone:'(555) 123-4567',cta:'Call for a free quote!'});
if(prof.handle!=='@brightline') throw new Error('handle not normalized: '+prof.handle);
const withCTA=g.formatPost({captions:w.posts[0].captions,hashtags:w.posts[0].hashtags},'friendly',prof);
if(!withCTA.includes('Call for a free quote!')) throw new Error('cta missing');
if(!withCTA.includes('(555) 123-4567')) throw new Error('phone missing');
if(!withCTA.includes('@brightline')) throw new Error('handle missing');
const plain=g.formatPost({captions:w.posts[0].captions,hashtags:w.posts[0].hashtags},'friendly');
if(plain.includes('Call for a free quote!')) throw new Error('cta leaked without profile');
"; then ok "flow 11: profile CTA appended only when profile given"; else bad "flow 11 failed"; fi

# Flow 12: posting schedule exports as valid-ish .ics with CRLF endings
if run "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'K Co',trade:'hvac',jobDescription:'Installed a new high efficiency heat pump and smart thermostat in a ranch home'});
const ics=g.weekToICS(w,'friendly',{},'2026-10-05T07:00:00');
if((ics.match(/BEGIN:VEVENT/g)||[]).length!==7) throw new Error('expected 7 events');
if(!ics.startsWith('BEGIN:VCALENDAR')) throw new Error('no calendar header');
if(ics.includes('\n') && !ics.includes('\r\n')) throw new Error('LF without CRLF');
if(/[^\\r]\\n/.test(ics)) throw new Error('bare LF found');
if(!/DTSTART:\\d{8}T\\d{6}/.test(ics)) throw new Error('no DTSTART stamps');
if(!ics.includes('SUMMARY:K Co: Monday')) throw new Error('summary missing');
"; then ok "flow 12: weekToICS emits 7 events with CRLF endings"; else bad "flow 12 failed"; fi

# Flow 13: posting stats — streaks, monthly counts
if run "
const g=require('./js/generator.js');
const iso=(d)=>new Date(Date.UTC(2026,9,d)).toISOString();
const log=[{dayIndex:0,dateISO:iso(12)},{dayIndex:1,dateISO:iso(11)},{dayIndex:2,dateISO:iso(10)}];
const s=g.postingStats(log,'2026-10-12T12:00:00Z');
if(s.streak!==3) throw new Error('streak should be 3, got '+s.streak);
if(s.total!==3||s.thisMonth!==3) throw new Error('counts wrong: '+JSON.stringify(s));
const gap=[{dayIndex:0,dateISO:iso(12)},{dayIndex:1,dateISO:iso(8)}];
const s2=g.postingStats(gap,'2026-10-12T12:00:00Z');
if(s2.streak!==1) throw new Error('streak should be 1 after a gap, got '+s2.streak);
const empty=g.postingStats([],'2026-10-12T12:00:00Z');
if(empty.streak!==0||empty.total!==0) throw new Error('empty log should be zeros');
"; then ok "flow 13: postingStats streak + monthly counts"; else bad "flow 13 failed"; fi

# Flow 14: trimForX — fits 280 chars, keeps CTA + hashtags, marks trims
if run "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'Trim Co',trade:'plumber',jobDescription:'Replaced a leaking water heater, repiped the laundry room with PEX, and installed a new pressure regulator valve'});
const p=w.posts[0];
const prof={handle:'@trimco',phone:'(555) 000-1111',cta:'Call today for a free quote!'};
const full=g.formatPost({captions:p.captions,hashtags:p.hashtags},'friendly',prof);
if([...full].length<=280) throw new Error('test needs an over-long post, got '+[...full].length);
const r=g.trimForX({captions:p.captions,hashtags:p.hashtags},'friendly',prof);
if(!r.trimmed) throw new Error('should report trimmed');
if([...r.text].length>280) throw new Error('still over 280: '+[...r.text].length);
if(!r.text.includes('Call today for a free quote!')) throw new Error('CTA dropped');
if(!r.text.includes('#')) throw new Error('all hashtags dropped');
if(!r.text.includes('…')) throw new Error('no ellipsis marking the cut');
const short=g.trimForX({captions:{friendly:'Hi.'},hashtags:['#a']},'friendly',{});
if(short.trimmed) throw new Error('short post should not be trimmed');
"; then ok "flow 14: trimForX fits X limit, keeps CTA + tags"; else bad "flow 14 failed"; fi

# Flow 15: hashtagReport — flags tags repeated across 5+ days
if run "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'Tag Co',trade:'roofer',jobDescription:'Replaced the whole roof with architectural shingles and new flashing everywhere'});
const rep=g.hashtagReport(w);
if(!rep.tags.length) throw new Error('no tags counted');
const top=rep.tags[0];
if(top.days!==7) throw new Error('trade tag should appear all 7 days, got '+top.days);
if(!rep.overused.length) throw new Error('expected overused tags');
if(!rep.overused.every(o=>o.days>=5)) throw new Error('overused threshold wrong');
const clean=g.hashtagReport({posts:[{hashtags:['#a']},{hashtags:['#b']}]});
if(clean.overused.length) throw new Error('no tag should be overused here');
"; then ok "flow 15: hashtagReport flags week-long tag repetition"; else bad "flow 15 failed"; fi

# Flow 16: shareLinks — X + Facebook web intents
if run "
const g=require('./js/generator.js');
const s=g.shareLinks('Hello world #test');
if(!s.x.startsWith('https://twitter.com/intent/tweet?text=')) throw new Error('bad X intent: '+s.x);
if(!s.x.includes(encodeURIComponent('#test'))) throw new Error('text not encoded in X intent');
if(!s.facebook.includes('facebook.com/sharer/sharer.php')) throw new Error('bad FB intent: '+s.facebook);
"; then ok "flow 16: shareLinks builds X + Facebook intents"; else bad "flow 16 failed"; fi

echo ""
echo "e2e: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
