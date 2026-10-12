#!/usr/bin/env bash
# SocialSpark AI — smoke tests (fast sanity checks)
set -u
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ❌ $1"; }

echo "== SocialSpark smoke =="

# 1-5: required files exist
for f in index.html css/style.css js/app.js js/generator.js README.md; do
  if [ -f "$f" ]; then ok "file exists: $f"; else bad "missing file: $f"; fi
done

# 6: generator.js parses
if node --check js/generator.js 2>/dev/null; then ok "generator.js syntax OK"; else bad "generator.js syntax error"; fi

# 7: app.js parses
if node --check js/app.js 2>/dev/null; then ok "app.js syntax OK"; else bad "app.js syntax error"; fi

# 8: index.html references both scripts
if grep -q 'js/generator.js' index.html && grep -q 'js/app.js' index.html; then
  ok "index.html loads both scripts"
else
  bad "index.html missing script tags"
fi

# 9: generator exports generateWeek in node
if node -e "const g=require('./js/generator.js'); if(typeof g.generateWeek!=='function') throw new Error('no fn')"; then
  ok "generateWeek exported"
else
  bad "generateWeek not exported"
fi

# 10: generates exactly 7 posts
if node -e "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'Test Co',trade:'plumber',jobDescription:'Replaced a leaking water heater and repiped the laundry room'});
if(w.posts.length!==7) throw new Error('got '+w.posts.length);
"; then ok "generates 7 posts"; else bad "does not generate 7 posts"; fi

# 11: all three tones present and differ
if node -e "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'Test Co',trade:'plumber',jobDescription:'Replaced a leaking water heater and repiped the laundry room'});
const p=w.posts[0].captions;
if(!p.professional||!p.friendly||!p.funny) throw new Error('tone missing');
if(p.professional===p.friendly||p.friendly===p.funny||p.professional===p.funny) throw new Error('tones identical');
"; then ok "3 tones present and differ"; else bad "tones missing or identical"; fi

# 12: hashtags non-empty on every post
if node -e "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'Test Co',trade:'plumber',jobDescription:'Replaced a leaking water heater and repiped the laundry room'});
if(!w.posts.every(p=>p.hashtags&&p.hashtags.length>=3)) throw new Error('hashtags missing');
"; then ok "hashtags present on all posts"; else bad "hashtags missing somewhere"; fi

# 13: best time present on every post
if node -e "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'Test Co',trade:'plumber',jobDescription:'Replaced a leaking water heater and repiped the laundry room'});
if(!w.posts.every(p=>p.bestTime&&p.bestTimeReason&&p.day)) throw new Error('bestTime missing');
"; then ok "best time + day on all posts"; else bad "best time missing somewhere"; fi

# 14: validation rejects empty business name
if node -e "
const g=require('./js/generator.js');
try { g.generateWeek({businessName:'',trade:'plumber',jobDescription:'Replaced a leaking water heater today ok'}); throw new Error('should have thrown'); }
catch(e){ if(!e.validationErrors) throw e; }
"; then ok "validation rejects empty business name"; else bad "validation missing for business name"; fi

# 15: validation rejects too-short description
if node -e "
const g=require('./js/generator.js');
try { g.generateWeek({businessName:'Test Co',trade:'plumber',jobDescription:'fix'}); throw new Error('should have thrown'); }
catch(e){ if(!e.validationErrors) throw e; }
"; then ok "validation rejects short description"; else bad "validation missing for description"; fi

# 16: formatPost produces copy-ready text
if node -e "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'Test Co',trade:'plumber',jobDescription:'Replaced a leaking water heater and repiped the laundry room'});
const t=g.formatPost({captions:w.posts[0].captions,hashtags:w.posts[0].hashtags},'friendly');
if(!t.includes('#')) throw new Error('no hashtags in formatted post');
"; then ok "formatPost produces copy-ready text"; else bad "formatPost broken"; fi

# 17: README mentions pricing
if grep -qi 'pricing' README.md; then ok "README mentions pricing"; else bad "README missing pricing"; fi

# 18: weekToMarkdown covers all 7 days with business name
if node -e "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'Test Co',trade:'plumber',jobDescription:'Replaced a leaking water heater and repiped the laundry room'});
const md=g.weekToMarkdown(w,'professional');
if(!md.startsWith('# Test Co')) throw new Error('title');
if((md.match(/## /g)||[]).length!==7) throw new Error('days');
if(!md.includes('Best time:')) throw new Error('best time');
"; then ok "weekToMarkdown covers all 7 days"; else bad "weekToMarkdown broken"; fi

# 19: platformCheck counts code points and flags over-limit platforms
if node -e "
const g=require('./js/generator.js');
const ok1=g.platformCheck('hello');
if(ok1.chars!==5||ok1.over.length) throw new Error('short text flagged');
const over=g.platformCheck('x'.repeat(300));
if(!over.over.includes('X')) throw new Error('X limit not flagged');
if(over.over.includes('Instagram')) throw new Error('Instagram wrongly flagged');
const emoji=g.platformCheck('😀'.repeat(10));
if(emoji.chars!==10) throw new Error('emoji counted as '+emoji.chars);
"; then ok "platformCheck: counts + over-limit flags"; else bad "platformCheck broken"; fi

# 20: nextPostAt is deterministic and honors skip
if node -e "
const g=require('./js/generator.js');
const w=g.generateWeek({businessName:'Test Co',trade:'plumber',jobDescription:'Replaced a leaking water heater and repiped the laundry room'});
const n=g.nextPostAt(w.posts,'2026-10-07T12:00:00');
if(!n||n.day!=='Wednesday'||n.time!=='7:00 PM') throw new Error('next='+JSON.stringify(n));
const s=g.nextPostAt(w.posts,'2026-10-07T12:00:00',[2]);
if(!s||s.day!=='Thursday') throw new Error('skip broken: '+JSON.stringify(s));
const all=g.nextPostAt(w.posts,'2026-10-07T12:00:00',[0,1,2,3,4,5,6]);
if(all!==null) throw new Error('all-posted should be null');
"; then ok "nextPostAt: deterministic + skip posted days"; else bad "nextPostAt broken"; fi

# 21: parseBankImport validates and rejects garbage
if node -e "
const g=require('./js/generator.js');
const items=g.parseBankImport(JSON.stringify([{day:'Mon',theme:'T',tone:'funny',text:'hello world'}]));
if(items.length!==1||items[0].tone!=='funny') throw new Error('valid import');
for(const bad of ['nope','{\"a\":1}','[]','[{\"text\":\"\"}]']){
  try { g.parseBankImport(bad); throw new Error('accepted: '+bad); } catch(e){ if(/accepted/.test(e.message)) throw e; }
}
"; then ok "parseBankImport validates + rejects garbage"; else bad "parseBankImport broken"; fi

# 22: index.html wires the new week/bank tools
for id in dlWeekBtn copyAllBtn upNext bankSearch bankExportBtn bankImportBtn bankImportFile; do
  if grep -q "id=\"$id\"" index.html; then ok "index.html has #$id"; else bad "index.html missing #$id"; fi
done

# 23: app.js uses the new engine functions
for fn in weekToMarkdown weekToPlainText platformCheck nextPostAt parseBankImport renderUpNext; do
  if grep -q "$fn" js/app.js; then ok "app.js uses $fn"; else bad "app.js missing $fn"; fi
done

# 24: new features wired — business profile, ICS export, posting stats
for fn in sanitizeProfile withCallToAction weekToICS postingStats; do
  if node -e "const g=require('./js/generator.js'); if(typeof g.$fn!=='function') throw new Error('no fn')"; then
    ok "generator exports $fn"
  else
    bad "generator missing $fn"
  fi
done
for needle in bizHandle dlIcsBtn postedLog getProfile; do
  if grep -q "$needle" js/app.js; then ok "app.js wires $needle"; else bad "app.js missing $needle"; fi
done
if grep -q 'id="bizHandle"' index.html && grep -q 'id="dlIcsBtn"' index.html; then
  ok "index.html has profile fields + ICS button"
else
  bad "index.html missing profile fields or ICS button"
fi

echo ""
echo "smoke: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
