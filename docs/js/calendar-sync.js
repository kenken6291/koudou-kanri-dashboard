/************************************************************
 * Googleカレンダー連携
 *
 * Google Identity Services (GIS) を使い、ユーザー本人のGoogleアカウントで
 * 読み取り専用スコープを許可してもらい、ブラウザから直接 Calendar API を呼び出す。
 * データはGAS/スプレッドシートを経由せず、ブラウザ⇔Google間で完結する。
 *
 * 事前準備（README参照）:
 *   Google Cloud Console で OAuthクライアントID（ウェブアプリケーション）を作成し、
 *   下の CALENDAR_CLIENT_ID に設定。承認済みJavaScript生成元にGitHub PagesのURLを追加。
 ************************************************************/

const CALENDAR_CLIENT_ID = '256690964271-4tfdv5g89nj9c94lv7a48105nup0392v.apps.googleusercontent.com';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

let gcalTokenClient = null;
let gcalAccessToken = sessionStorage.getItem('kk_gcal_token') || null;
let gcalTokenExp = Number(sessionStorage.getItem('kk_gcal_token_exp') || 0);

function gcalTokenValid() {
  return !!gcalAccessToken && Date.now() < gcalTokenExp;
}

function gcalUpdateUI() {
  const connected = gcalTokenValid();
  const statusEl = document.getElementById('gcal-status');
  const mpStatusEl = document.getElementById('mp-gcal-status');
  const connectBtn = document.getElementById('btn-gcal-connect');
  const syncBtn = document.getElementById('btn-gcal-sync');

  if (statusEl) statusEl.textContent = 'Googleカレンダー: ' + (connected ? '連携中' : '未連携');
  if (mpStatusEl) mpStatusEl.textContent = connected ? '連携中です' : '未連携です';
  if (connectBtn) connectBtn.style.display = connected ? 'none' : 'inline-flex';
  if (syncBtn) syncBtn.style.display = connected ? 'inline-flex' : 'none';
}

function gcalInitTokenClient() {
  if (gcalTokenClient || typeof google === 'undefined' || !google.accounts) return;
  gcalTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CALENDAR_CLIENT_ID,
    scope: CALENDAR_SCOPE,
    callback: function (resp) {
      if (resp.error) {
        toast('Googleカレンダーの連携に失敗しました。');
        return;
      }
      gcalAccessToken = resp.access_token;
      gcalTokenExp = Date.now() + (Number(resp.expires_in || 3500) * 1000);
      sessionStorage.setItem('kk_gcal_token', gcalAccessToken);
      sessionStorage.setItem('kk_gcal_token_exp', String(gcalTokenExp));
      gcalUpdateUI();
      toast('Googleカレンダーと連携しました。');
      syncTodayFromCalendar();
    }
  });
}

function connectGoogleCalendar() {
  if (CALENDAR_CLIENT_ID.indexOf('ここに') !== -1) {
    toast('先にGoogleカレンダー連携の設定（クライアントID）が必要です。README参照。');
    return;
  }
  gcalInitTokenClient();
  if (!gcalTokenClient) {
    toast('Google連携の読み込みに失敗しました。時間をおいて再度お試しください。');
    return;
  }
  gcalTokenClient.requestAccessToken({ prompt: gcalAccessToken ? '' : 'consent' });
}

function disconnectGoogleCalendar() {
  if (gcalAccessToken && typeof google !== 'undefined' && google.accounts) {
    google.accounts.oauth2.revoke(gcalAccessToken, function () {});
  }
  gcalAccessToken = null;
  gcalTokenExp = 0;
  sessionStorage.removeItem('kk_gcal_token');
  sessionStorage.removeItem('kk_gcal_token_exp');
  gcalUpdateUI();
  toast('Googleカレンダーとの連携を解除しました。');
}

async function fetchTodayCalendarEvents() {
  const today = new Date();
  const timeMin = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();
  const timeMax = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
    + '?timeMin=' + encodeURIComponent(timeMin)
    + '&timeMax=' + encodeURIComponent(timeMax)
    + '&singleEvents=true&orderBy=startTime';

  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + gcalAccessToken } });
  if (res.status === 401) {
    // トークン失効時は連携を解除して再連携を促す
    disconnectGoogleCalendar();
    throw new Error('認証の有効期限が切れました。再度連携してください。');
  }
  const data = await res.json();
  return (data.items || []).map(function (ev) { return (ev.summary || '').trim(); }).filter(Boolean);
}

function habitMatchesEvent(habitName, eventName) {
  const a = habitName.toLowerCase();
  const b = eventName.toLowerCase();
  return a.length > 0 && b.length > 0 && (b.indexOf(a) !== -1 || a.indexOf(b) !== -1);
}

async function syncTodayFromCalendar() {
  if (!gcalTokenValid()) { connectGoogleCalendar(); return; }
  if (!dashboardData || !dashboardData.habits.length) { toast('先に行動を登録してください。'); return; }

  const syncBtn = document.getElementById('btn-gcal-sync');
  if (syncBtn) syncBtn.disabled = true;

  try {
    const eventNames = await fetchTodayCalendarEvents();
    let matchedCount = 0;

    for (const habit of dashboardData.habits) {
      const alreadyChecked = habit.checkedDates.indexOf(dashboardData.today) !== -1;
      if (alreadyChecked) continue;
      const hit = eventNames.some(function (ev) { return habitMatchesEvent(habit.name, ev); });
      if (hit) {
        await callApi('toggleLog', { token: getToken(), habitId: habit.habitId, date: dashboardData.today });
        matchedCount++;
      }
    }

    if (matchedCount > 0) {
      toast('カレンダーの予定と一致した ' + matchedCount + ' 件を記録しました。');
      await loadDashboard();
    } else {
      toast('本日の予定と一致する行動はありませんでした。');
    }
  } catch (err) {
    toast(err.message || 'カレンダーの同期に失敗しました。');
  } finally {
    if (syncBtn) syncBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  gcalUpdateUI();
  const connectBtn = document.getElementById('btn-gcal-connect');
  const syncBtn = document.getElementById('btn-gcal-sync');
  const disconnectBtn = document.getElementById('btn-gcal-disconnect');
  if (connectBtn) connectBtn.addEventListener('click', connectGoogleCalendar);
  if (syncBtn) syncBtn.addEventListener('click', syncTodayFromCalendar);
  if (disconnectBtn) disconnectBtn.addEventListener('click', disconnectGoogleCalendar);
});
