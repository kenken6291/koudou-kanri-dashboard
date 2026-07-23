/* GAS Web AppのURLをデプロイ後にここへ設定してください */
const API_URL = 'https://script.google.com/macros/s/AKfycbyN8Car7Sp0gznojVsNvBrUvzlMczpPmAvqG0SSS2aomTI7NPXDSr1xdmTcbSXFkxn51Q/exec';

async function callApi(action, payload) {
  const body = Object.assign({ action: action }, payload || {});
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // CORSプリフライト回避
    body: JSON.stringify(body)
  });
  const data = await res.json();
  return data;
}

function getToken() { return localStorage.getItem('kk_token') || ''; }
function setToken(t) { localStorage.setItem('kk_token', t); }
function clearToken() { localStorage.removeItem('kk_token'); }
function getNickname() { return localStorage.getItem('kk_nickname') || ''; }
function setNickname(n) { localStorage.setItem('kk_nickname', n); }

function requireLoginOrRedirect() {
  if (!getToken()) window.location.href = 'index.html';
}
