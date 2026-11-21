// Atualiza o ?v=… dos CSS/JS nos HTML para os visitantes não ficarem com arquivos velhos em cache.
// Uso: npm run bump   (rode antes de dar git push)
const fs = require('fs');
const path = require('path');

const v = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
for (const file of ['index.html', 'timer.html']) {
  const p = path.join(__dirname, file);
  const html = fs.readFileSync(p, 'utf8')
    .replace(/((?:href|src)="(?:css|js)\/[\w-]+\.(?:css|js))(?:\?v=\d+)?"/g, `$1?v=${v}"`);
  fs.writeFileSync(p, html);
}
console.log('versão dos arquivos:', v);
