#!/usr/bin/env node
/* Baut die eigenständige Seite (vorschau.html + docs/index.html) aus CSS + app.js. */
const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..')

const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8')
const app = fs.readFileSync(path.join(root, 'standalone/app.js'), 'utf8')

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Focus & Goals</title>
<style>
${css}
</style>
</head>
<body>
<div class="app">
  <header>
    <h1>🎯 Focus &amp; Goals</h1>
    <p class="sub">Vision festlegen, Ziele über kurz-/mittel-/langfristig setzen – geführt. Fokus-Sessions zahlen darauf ein. Alles lokal im Browser.</p>
  </header>
  <section id="wizard" style="display:none"></section>
  <section id="areas"></section>
  <section id="focusCard"></section>
  <section id="overview"></section>
</div>
<script>
${app}
</script>
</body>
</html>
`

fs.writeFileSync(path.join(root, 'vorschau.html'), html)
fs.mkdirSync(path.join(root, 'docs'), { recursive: true })
fs.writeFileSync(path.join(root, 'docs/index.html'), html)
console.log('gebaut:', html.length, 'bytes')
