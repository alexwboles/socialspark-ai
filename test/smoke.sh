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

echo ""
echo "smoke: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
