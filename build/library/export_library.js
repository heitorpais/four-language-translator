// Collects every saved library entry into library.json:
//   entries.js (24 built-in entries), index_v1.html (13 entries inside the page), db_entries.json (2 entries saved in the app's shared library).
// Run: node build/library/export_library.js
const fs = require('fs'), path = require('path'), d = __dirname;
const out = [];
const w = {}; new Function('window', fs.readFileSync(path.join(d, 'entries.js'), 'utf8'))(w);
w.BUILTIN.forEach(e => out.push(Object.assign({_source: 'entries.js'}, e)));
JSON.parse(fs.readFileSync(path.join(d, 'db_entries.json'), 'utf8')).forEach(e => out.push(Object.assign({_source: 'shared library'}, e)));
const html = fs.readFileSync(path.join(d, 'index_v1.html'), 'utf8');
const pure = html.slice(html.indexOf('/*PURE*/'), html.indexOf('/*END PURE*/'));
const inl = new Function(pure + '; return BUILTIN;')();
inl.forEach(e => out.push(Object.assign({_source: 'index.html'}, e)));
fs.writeFileSync(path.join(d, 'library.json'), JSON.stringify(out, null, 1));
console.log('library entries', out.length, out.reduce((a, e) => (a[e._source] = (a[e._source] || 0) + 1, a), {}));
