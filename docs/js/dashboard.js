requireLoginOrRedirect();

const COLORS = ['#56705a', '#b23a2e', '#a9832f', '#3a5f6b', '#7c5b8a', '#8a6a3f'];
let selectedColor = COLORS[0];
let dashboardData = null;

document.getElementById('nickname-display').textContent = getNickname() + ' さん';

function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------- 初期化 ---------- */

function renderSwatches() {
  const wrap = document.getElementById('color-swatches');
  wrap.innerHTML = '';
  COLORS.forEach(function (c) {
    const el = document.createElement('div');
    el.className = 'swatch' + (c === selectedColor ? ' selected' : '');
    el.style.background = c;
    el.addEventListener('click', function () {
      selectedColor = c;
      renderSwatches();
    });
    wrap.appendChild(el);
  });
}
renderSwatches();

async function loadDashboard() {
  const res = await callApi('getDashboard', { token: getToken() });
  if (!res.ok) return handleAuthError(res);
  dashboardData = res;
  document.getElementById('today-label').textContent = res.today;
  renderHabits();
  renderShareSummary();
}

function handleAuthError(res) {
  if (res.error && res.error.indexOf('ログイン') !== -1) {
    clearToken();
    window.location.href = 'index.html';
  } else {
    toast(res.error || 'エラーが発生しました。');
  }
}

/* ---------- 習慣カード描画 ---------- */

function last14Dates(today) {
  const arr = [];
  const cursor = new Date(today + 'T00:00:00');
  for (let i = 13; i >= 0; i--) {
    const d = new Date(cursor);
    d.setDate(d.getDate() - i);
    arr.push(d.toISOString().slice(0, 10));
  }
  return arr;
}

function renderHabits() {
  const grid = document.getElementById('habit-grid');
  const empty = document.getElementById('habit-empty');
  grid.innerHTML = '';

  if (!dashboardData.habits.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const today = dashboardData.today;
  const days = last14Dates(today);

  dashboardData.habits.forEach(function (h) {
    const checkedToday = h.checkedDates.indexOf(today) !== -1;
    const card = document.createElement('div');
    card.className = 'habit-card';
    card.innerHTML = `
      <div class="habit-top">
        <h3><span class="habit-dot" style="background:${h.color}"></span>${escapeHtml(h.name)}</h3>
        <div class="hanko ${checkedToday ? 'done' : ''}" data-habit="${h.habitId}">
          <div class="n">${h.currentStreak}</div>
          <div class="u">DAYS</div>
        </div>
      </div>
      <div class="habit-stats">
        <span>累計 <b>${h.totalCount}</b>回</span>
        <span>最長 <b>${h.longestStreak}</b>日</span>
        <span>直近30日 <b>${h.last30Rate}</b>%</span>
      </div>
      <div class="heatmap"></div>
      <button class="check-btn ${checkedToday ? 'checked' : ''}" data-habit="${h.habitId}">
        ${checkedToday ? '✓ 今日は達成しました' : '今日の分を記録する'}
      </button>
      <div class="habit-actions">
        <button data-action="rename" data-habit="${h.habitId}">名前を編集</button>
        <button data-action="delete" data-habit="${h.habitId}">削除</button>
      </div>
    `;
    const heat = card.querySelector('.heatmap');
    days.forEach(function (d) {
      const cell = document.createElement('div');
      cell.className = 'heat-cell' + (h.checkedDates.indexOf(d) !== -1 ? ' on' : '') + (d === today ? ' today' : '');
      cell.title = d;
      if (h.checkedDates.indexOf(d) !== -1) cell.style.background = h.color;
      heat.appendChild(cell);
    });

    grid.appendChild(card);
  });

  grid.querySelectorAll('.check-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { toggleHabit(btn.dataset.habit); });
  });
  grid.querySelectorAll('[data-action="rename"]').forEach(function (btn) {
    btn.addEventListener('click', function () { renameHabit(btn.dataset.habit); });
  });
  grid.querySelectorAll('[data-action="delete"]').forEach(function (btn) {
    btn.addEventListener('click', function () { deleteHabit(btn.dataset.habit); });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ---------- 習慣の操作 ---------- */

document.getElementById('btn-add-habit').addEventListener('click', async function () {
  const input = document.getElementById('new-habit-name');
  const name = input.value.trim();
  if (!name) { toast('行動名を入力してください。'); return; }
  const res = await callApi('addHabit', { token: getToken(), name, color: selectedColor });
  if (!res.ok) return handleAuthError(res);
  input.value = '';
  toast('行動を追加しました。');
  await loadDashboard();
});

async function toggleHabit(habitId) {
  const hankoEl = document.querySelector('.hanko[data-habit="' + habitId + '"]');
  if (hankoEl) { hankoEl.classList.add('pressed'); setTimeout(() => hankoEl.classList.remove('pressed'), 200); }
  const res = await callApi('toggleLog', { token: getToken(), habitId, date: dashboardData.today });
  if (!res.ok) return handleAuthError(res);
  await loadDashboard();
}

async function renameHabit(habitId) {
  const current = dashboardData.habits.find(h => h.habitId === habitId);
  const name = prompt('新しい名前を入力してください', current ? current.name : '');
  if (!name || !name.trim()) return;
  const res = await callApi('updateHabit', { token: getToken(), habitId, name: name.trim() });
  if (!res.ok) return handleAuthError(res);
  await loadDashboard();
}

async function deleteHabit(habitId) {
  if (!confirm('この行動と記録をすべて削除します。よろしいですか？')) return;
  const res = await callApi('deleteHabit', { token: getToken(), habitId });
  if (!res.ok) return handleAuthError(res);
  toast('削除しました。');
  await loadDashboard();
}

/* ---------- お気に入り ---------- */

async function loadFavorites() {
  const res = await callApi('getFavorites', { token: getToken() });
  if (!res.ok) return handleAuthError(res);
  const grid = document.getElementById('fav-grid');
  const empty = document.getElementById('fav-empty');
  grid.innerHTML = '';
  if (!res.favorites.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  res.favorites.forEach(function (f) {
    const card = document.createElement('div');
    card.className = 'fav-card';
    card.innerHTML = `
      <h4>${escapeHtml(f.title)}</h4>
      <div class="fav-meta">${f.createdAt}</div>
      <div class="fav-actions">
        <button class="btn secondary" data-share="${f.favId}">シェア</button>
        <button class="btn link" data-del="${f.favId}" style="color:var(--shu);">削除</button>
      </div>
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll('[data-del]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const res = await callApi('deleteFavorite', { token: getToken(), favId: btn.dataset.del });
      if (!res.ok) return handleAuthError(res);
      await loadFavorites();
    });
  });
  grid.querySelectorAll('[data-share]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const fav = res.favorites.find(f => f.favId === btn.dataset.share);
      shareText(fav.snapshot && fav.snapshot.text ? fav.snapshot.text : fav.title);
    });
  });
}

function buildSummaryText() {
  if (!dashboardData || !dashboardData.habits.length) return '記録がまだありません。';
  const lines = ['【行動管理ダッシュボード】' + dashboardData.today + ' の記録'];
  dashboardData.habits.forEach(function (h) {
    lines.push(`・${h.name}：連続${h.currentStreak}日（最長${h.longestStreak}日 / 累計${h.totalCount}回）`);
  });
  return lines.join('\n');
}

function renderShareSummary() {
  document.getElementById('share-summary').textContent = buildSummaryText();
}

document.getElementById('btn-save-favorite').addEventListener('click', async function () {
  const text = buildSummaryText();
  const title = dashboardData.today + ' の記録';
  const res = await callApi('addFavorite', { token: getToken(), title, snapshot: { text } });
  if (!res.ok) return handleAuthError(res);
  toast('お気に入りに保存しました。');
  await loadFavorites();
});

async function shareText(text) {
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { /* キャンセル等は無視 */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('クリップボードにコピーしました。');
  } catch (e) {
    toast('お使いの環境ではシェアに対応していません。');
  }
}

document.getElementById('btn-share-sns').addEventListener('click', function () {
  shareText(buildSummaryText());
});

document.getElementById('btn-share-x').addEventListener('click', function () {
  const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(buildSummaryText());
  window.open(url, '_blank', 'noopener');
});

/* ---------- マイページ ---------- */

document.getElementById('btn-mypage').addEventListener('click', function () {
  document.getElementById('mp-nickname').value = getNickname();
  document.getElementById('mp-password').value = '';
  document.getElementById('modal-mypage').classList.add('show');
});
document.getElementById('btn-close-mypage').addEventListener('click', function () {
  document.getElementById('modal-mypage').classList.remove('show');
});
document.querySelectorAll('.pw-toggle').forEach(function (btn) {
  btn.addEventListener('click', function () {
    const input = document.getElementById(btn.dataset.target);
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.textContent = showing ? '表示' : '非表示';
  });
});

document.getElementById('btn-save-nickname').addEventListener('click', async function () {
  const nickname = document.getElementById('mp-nickname').value.trim();
  if (!nickname) { toast('ニックネームを入力してください。'); return; }
  const res = await callApi('updateProfile', { token: getToken(), nickname });
  if (!res.ok) return handleAuthError(res);
  setNickname(nickname);
  document.getElementById('nickname-display').textContent = nickname + ' さん';
  toast('ニックネームを保存しました。');
});

document.getElementById('btn-save-password').addEventListener('click', async function () {
  const newPassword = document.getElementById('mp-password').value;
  if (!newPassword) { toast('新しいパスワードを入力してください。'); return; }
  if (newPassword.length < 8) { toast('パスワードは8文字以上にしてください。'); return; }
  const res = await callApi('changePassword', { token: getToken(), newPassword });
  if (!res.ok) return handleAuthError(res);
  document.getElementById('mp-password').value = '';
  toast('パスワードを変更しました。');
});

document.getElementById('btn-delete-account').addEventListener('click', function () {
  document.getElementById('modal-delete-confirm').classList.add('show');
});
document.getElementById('btn-cancel-delete').addEventListener('click', function () {
  document.getElementById('modal-delete-confirm').classList.remove('show');
});
document.getElementById('btn-confirm-delete').addEventListener('click', async function () {
  const res = await callApi('deleteAccount', { token: getToken() });
  if (!res.ok) return handleAuthError(res);
  clearToken();
  window.location.href = 'index.html';
});

document.getElementById('btn-logout').addEventListener('click', async function () {
  await callApi('logout', { token: getToken() });
  clearToken();
  window.location.href = 'index.html';
});

/* ---------- 起動 ---------- */
loadDashboard().then(function () {
  if (typeof gcalTokenValid === 'function' && gcalTokenValid()) syncTodayFromCalendar();
});
loadFavorites();
