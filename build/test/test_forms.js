// Checks that app/forms.js gives exactly the forms build/generate_forms.py gives, for every entry.
// Run:  python3 -I build/test/dump_forms.py && node build/test/test_forms.js
const fs = require('fs'), path = require('path');
const F = require('../../app/forms.js');
const root = path.join(__dirname, '..', '..');
const py = JSON.parse(fs.readFileSync(path.join(root, 'build/work/forms_py.json'), 'utf8'));
let entries = 0, forms = 0, bad = 0; const shown = [];
for (const l of ['de', 'en', 'fr', 'pt']) {
  for (const e of JSON.parse(require('zlib').gunzipSync(fs.readFileSync(path.join(root, 'app/data/core-' + l + '.json.gz'))).toString('utf8'))) {
    if (!(e.id in py)) continue;
    entries++;
    const js = F.forms(e), want = py[e.id];
    for (const k of new Set([...Object.keys(js), ...Object.keys(want)])) {
      forms++;
      if (js[k] !== want[k]) { bad++; if (shown.length < 25) shown.push([e.id, k, 'js=' + js[k], 'py=' + want[k]].join('  ')); }
    }
    F.regularForms(e);
  }
}
console.log('entries', entries, 'forms compared', forms, 'differences', bad);
shown.forEach(s => console.log('  ', s));
process.exit(bad ? 1 : 0);
