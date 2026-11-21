// Prepara o site para publicar. Rode antes de cada `git push`:   npm run build
//
// 1) Atualiza o ?v=… dos CSS/JS (ninguém fica com arquivos velhos em cache).
// 2) Gera cfop/index.html a partir do index.html, para o endereço …/rubiks-cube/cfop/
//    abrir direto no modo Avançado (o GitHub Pages só serve arquivos que existem).
//    Edite sempre o index.html — o cfop/index.html é gerado.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SITE = 'https://smmezp.github.io/rubiks-cube/';
const v = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, f), s); };
const bump = (html) => html.replace(/((?:href|src)="(?:css|js)\/[\w-]+\.(?:css|js))(?:\?v=\d+)?"/g, `$1?v=${v}"`);

// 1) versões
const index = bump(read('index.html'));
write('index.html', index);
write('timer/index.html', bump(read('timer/index.html')));

// 2) página do CFOP
const cfop = index
  .replace('<meta charset="utf-8" />', '<meta charset="utf-8" />\n  <base href="../" />')
  .replace('<html lang="en" data-mode="basic">', '<html lang="en" data-mode="advanced">')
  .replace('href="#render-ready"', 'href="cfop/#render-ready"')
  .replace(`<meta property="og:url" content="${SITE}" />`, `<meta property="og:url" content="${SITE}cfop/" />`)
  .replace(/<title>[^<]*<\/title>/, "<title>CFOP — Rubik's Cube</title>")
  .replace('<!doctype html>', '<!doctype html>\n<!-- GERADO por build.js a partir do index.html — não edite este arquivo -->');
write('cfop/index.html', cfop);

console.log(`ok · versão ${v} · cfop/index.html gerado`);
