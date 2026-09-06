'use strict';

// App mínimo: login com LinkedIn (OpenID Connect) + import do export "Baixar seus
// dados" (.zip). Sem dependências. Node 18+ (fetch global).
//
// O que o LinkedIn entrega por API neste app: sub, name, given_name, family_name,
// picture, locale, email, email_verified. Cargo/formação/skills só via este import
// do arquivo que o próprio usuário baixa em linkedin.com/mypreferences/d/download-my-data.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

// --- Config: parser mínimo de .env (sem dotenv) --------------------------------
function loadEnv() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv();

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/callback';
const PORT = Number(process.env.PORT || 3000);

const AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const SCOPE = 'openid profile email';
const STATE_COOKIE = 'li_state';
const SESSION_COOKIE = 'li_session';
const SESSION_SECRET = CLIENT_SECRET || 'dev-secret-change-me';
const MAX_UPLOAD = 25 * 1024 * 1024; // 25 MB

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    'Faltam credenciais. Preencha LINKEDIN_CLIENT_ID e LINKEDIN_CLIENT_SECRET no arquivo .env'
  );
  process.exit(1);
}

// --- Helpers gerais ---------------------------------------------------------
function getCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

// --- Sessão: cookie assinado (HMAC), sem estado no servidor ----------------
function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function readSession(req) {
  const token = getCookies(req)[SESSION_COOKIE];
  if (!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

// --- Leitor de ZIP mínimo (STORED + DEFLATE, sem ZIP64/senha) -------------
function readZip(buf) {
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  const minScan = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= minScan; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('Não parece um arquivo .zip válido (EOCD não encontrado).');

  const entryCount = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // offset do central directory
  const files = {};

  for (let n = 0; n < entryCount; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Central directory corrompido.');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith('/')) continue; // diretório

    if (buf.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`Local header inválido em "${name}".`);
    }
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);

    let content;
    if (method === 0) content = raw;
    else if (method === 8) content = zlib.inflateRawSync(raw);
    else throw new Error(`Método de compressão ${method} não suportado em "${name}".`);

    files[name] = content;
  }
  return files;
}

// --- CSV -> linhas (respeita aspas, vírgulas e quebras internas) ----------
function parseCsvRows(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// --- Monta o HTML do resultado do import ----------------------------------
const KNOWN_FILES = [
  ['Profile.csv', 'Perfil'],
  ['Positions.csv', 'Experiência'],
  ['Education.csv', 'Formação'],
  ['Skills.csv', 'Competências'],
  ['Languages.csv', 'Idiomas'],
  ['Certifications.csv', 'Certificações'],
  ['Email Addresses.csv', 'E-mails'],
];

function findFile(files, basename) {
  const key = Object.keys(files).find(
    (k) => k.split('/').pop().toLowerCase() === basename.toLowerCase()
  );
  return key ? files[key].toString('utf8') : null;
}

function csvTable(text, maxRows = 100) {
  const rows = parseCsvRows(text);
  if (rows.length < 1) return '<p class="muted">(vazio)</p>';
  const head = rows[0];
  const body = rows
    .slice(1)
    .filter((r) => r.some((v) => v !== ''))
    .slice(0, maxRows);
  if (!body.length) return '<p class="muted">(sem linhas)</p>';
  return (
    `<div class="tw"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>` +
    `<tbody>${body
      .map(
        (r) => `<tr>${head.map((_, i) => `<td>${esc(r[i] ?? '')}</td>`).join('')}</tr>`
      )
      .join('')}</tbody></table></div>`
  );
}

function buildImportHtml(files) {
  const names = Object.keys(files);
  let out = `<h2>Import concluído — ${names.length} arquivo(s) no .zip</h2>`;

  let matched = 0;
  for (const [file, label] of KNOWN_FILES) {
    const text = findFile(files, file);
    if (text == null) continue;
    matched++;
    out += `<h3>${esc(label)} <span class="muted">(${esc(file)})</span></h3>${csvTable(text)}`;
  }
  if (!matched) {
    out +=
      '<p class="muted">Nenhum dos CSVs esperados (Profile/Positions/Education/Skills) ' +
      'foi encontrado. Veja a lista completa abaixo.</p>';
  }

  out +=
    `<details><summary>Todos os arquivos do .zip</summary><ul>` +
    names
      .map((n) => `<li><code>${esc(n)}</code> — ${files[n].length} bytes</li>`)
      .join('') +
    `</ul></details>`;
  return out;
}

// --- Corpo bruto da requisição (com limite) ------------------------------
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('Arquivo acima do limite de 25 MB.'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// --- Páginas -----------------------------------------------------------------
function shell(body) {
  return `<!doctype html>
<html lang="pt-br">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Login com LinkedIn</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; max-width: 900px; margin: 6vh auto; padding: 0 1rem; color: #1a1a1a; }
  a { color: #0a66c2; }
  a.btn, button { display: inline-block; background: #0a66c2; color: #fff; border: 0; text-decoration: none;
    padding: .6rem 1.1rem; border-radius: 6px; font: inherit; font-weight: 600; cursor: pointer; }
  a.btn:hover, button:hover { background: #004182; }
  img.avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; vertical-align: middle; }
  pre { background: #f4f4f4; padding: 1rem; border-radius: 6px; overflow: auto; }
  .muted { color: #666; font-weight: 400; }
  .err { color: #b00020; }
  .tw { overflow-x: auto; }
  table { border-collapse: collapse; font-size: 14px; margin: .5rem 0 1.5rem; }
  th, td { border: 1px solid #ddd; padding: .35rem .6rem; text-align: left; vertical-align: top; white-space: nowrap; }
  th { background: #f4f4f4; }
  details { margin-top: 1rem; }
  code { background: #f4f4f4; padding: .1rem .3rem; border-radius: 3px; }
</style>
${body}
</html>`;
}

function pageHome(session) {
  if (!session) {
    return shell(`<h1>Login com LinkedIn</h1>
<p class="muted">App mínimo: login OpenID Connect + import do export de dados.</p>
<p><a class="btn" href="/login">Entrar com LinkedIn</a></p>`);
  }
  return shell(`<h1>Autenticado ✓</h1>
<p>${session.picture ? `<img class="avatar" src="${esc(session.picture)}" alt=""> ` : ''}
<strong>${esc(session.name || '')}</strong> <span class="muted">${esc(session.email || '')}</span></p>
<p><a href="/logout">Sair</a></p>

<h2>Importar dados do LinkedIn (.zip)</h2>
<p class="muted">
  Baixe em
  <a href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noopener">linkedin.com/mypreferences/d/download-my-data</a>
  (opção rápida já serve — Profile, Positions, Education, Skills). O arquivo é lido em memória, nada é gravado em disco.
</p>
<p>
  <input type="file" id="f" accept=".zip,application/zip,application/x-zip-compressed">
  <button id="b">Enviar e processar</button>
</p>
<div id="out"></div>
<script>
  document.getElementById('b').onclick = async () => {
    const f = document.getElementById('f').files[0];
    const out = document.getElementById('out');
    if (!f) { out.textContent = 'Escolha o arquivo .zip primeiro.'; return; }
    out.textContent = 'Processando...';
    try {
      const r = await fetch('/upload', { method: 'POST', body: f });
      out.innerHTML = await r.text();
    } catch (e) {
      out.textContent = 'Falha no envio: ' + e.message;
    }
  };
</script>`);
}

function pageError(message) {
  return shell(`<h1 class="err">Erro na autenticação</h1>
<p>${esc(message)}</p>
<p><a href="/">Voltar</a></p>`);
}

// --- Handlers -----------------------------------------------------------------
function handleLogin(res) {
  const state = crypto.randomUUID();
  const url = new URL(AUTH_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('state', state);
  res.writeHead(302, {
    Location: url.toString(),
    'Set-Cookie': `${STATE_COOKIE}=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`,
  });
  res.end();
}

async function handleCallback(req, res, query) {
  if (query.get('error')) {
    sendError(res, 400, `${query.get('error')}: ${query.get('error_description') || 'sem descrição'}`);
    return;
  }

  const code = query.get('code');
  const state = query.get('state');
  const cookieState = getCookies(req)[STATE_COOKIE];

  if (!code) {
    sendError(res, 400, 'Faltou o parâmetro "code" na resposta do LinkedIn.');
    return;
  }
  if (!state || !cookieState || state !== cookieState) {
    sendError(res, 400, 'Parâmetro "state" inválido (possível CSRF). Tente novamente.');
    return;
  }

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  const tokenBody = await tokenRes.text();
  if (!tokenRes.ok) {
    sendError(res, 502, `Falha ao obter token (${tokenRes.status}): ${tokenBody}`);
    return;
  }
  const { access_token: accessToken } = JSON.parse(tokenBody);
  if (!accessToken) {
    sendError(res, 502, 'Resposta de token sem access_token.');
    return;
  }

  const userRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const userBody = await userRes.text();
  if (!userRes.ok) {
    sendError(res, 502, `Falha ao obter perfil (${userRes.status}): ${userBody}`);
    return;
  }
  const user = JSON.parse(userBody);

  const session = signSession({
    sub: user.sub,
    name: user.name,
    email: user.email,
    picture: user.picture,
    ts: Date.now(),
  });

  res.writeHead(302, {
    Location: '/',
    'Set-Cookie': [
      `${STATE_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
      `${SESSION_COOKIE}=${session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`,
    ],
  });
  res.end();
}

async function handleUpload(req, res) {
  const session = readSession(req);
  if (!session) {
    res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<p class="err">Faça login antes de importar.</p>');
    return;
  }
  try {
    const buf = await readBody(req, MAX_UPLOAD);
    if (!buf.length) throw new Error('Corpo vazio — nenhum arquivo recebido.');
    const files = readZip(buf);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buildImportHtml(files));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<p class="err">${esc(err.message)}</p>`);
  }
}

function sendError(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(pageError(message));
}

// --- Server -----------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (req.method === 'POST' && url.pathname === '/upload') {
      await handleUpload(req, res);
      return;
    }
    if (req.method !== 'GET') {
      sendError(res, 405, 'Método não suportado.');
      return;
    }

    switch (url.pathname) {
      case '/': {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(pageHome(readSession(req)));
        return;
      }
      case '/login':
        handleLogin(res);
        return;
      case '/callback':
        await handleCallback(req, res, url.searchParams);
        return;
      case '/logout':
        res.writeHead(302, {
          Location: '/',
          'Set-Cookie': [
            `${STATE_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
            `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
          ],
        });
        res.end();
        return;
      case '/favicon.ico':
        res.writeHead(204);
        res.end();
        return;
      default:
        sendError(res, 404, 'Página não encontrada.');
    }
  } catch (err) {
    console.error(err);
    sendError(res, 500, 'Erro interno. Veja o console do servidor.');
  }
});

server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
  console.log(`Redirect URI: ${REDIRECT_URI}`);
});
