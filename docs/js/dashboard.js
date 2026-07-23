requireLoginOrRedirect();

const COLORS = ['#3b6fe0', '#f2803a', '#1f9d6b', '#e3ac1a', '#d8483a', '#e0679f', '#1aa3a3', '#7a5cd6'];
const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];
let selectedColor = COLORS[0];
let dashboardData = null;
let timelineFilter = 'all';

document.getElementById('nickname-display').textContent = getNickname() + ' さん';

function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ---------- 初期化 ---------- */

function renderSwatches() {
  const wrap = document.getElementById('color-swatches');
  wrap.innerHTML = '';
  COLORS.forEach(function (c) {
    const el = document.createElement('div');
    el.className = 'swatch' + (c === selectedColor ? ' selected' : '');
    el.style.background = c;
    el.addEventListener('click', function () { selectedColor = c; renderSwatches(); });
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
  renderOverviewAll();
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

  if (!dashboardData.habits.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  const today = dashboardData.today;
  const days = last14Dates(today);

  dashboardData.habits.forEach(function (h) {
    const checkedToday = h.checkedDates.indexOf(today) !== -1;
    const card = document.createElement('div');
    card.className = 'card habit-card';
    card.innerHTML = `
      <div class="habit-top">
        <h3><span class="habit-dot" style="background:${h.color}"></span>${escapeHtml(h.name)}</h3>
        <div class="streak-badge ${checkedToday ? 'done' : ''}" data-habit="${h.habitId}">
          <div class="n">${h.currentStreak}</div>
          <div class="u">DAYS</div>
        </div>
      </div>
      <div class="habit-stats">
        <span>累計 <b>${h.totalCount}</b>回</span>
        <span>最長 <b>${h.longestStreak}</b>日</span>
        <span>直近30日 <b>${h.last30Rate}</b>%</span>
      </div>
      <div class="mini-heatmap"></div>
      <button class="check-btn ${checkedToday ? 'checked' : ''}" data-habit="${h.habitId}">
        ${checkedToday ? '✓ 今日は達成しました' : '今日の分を記録する'}
      </button>
      <div class="habit-actions">
        <button data-action="rename" data-habit="${h.habitId}">名前を編集</button>
        <button data-action="delete" data-habit="${h.habitId}">削除</button>
      </div>
    `;
    const heat = card.querySelector('.mini-heatmap');
    days.forEach(function (d) {
      const cell = document.createElement('div');
      cell.className = 'heat-cell' + (d === today ? ' today' : '');
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
  const badgeEl = document.querySelector('.streak-badge[data-habit="' + habitId + '"]');
  if (badgeEl) { badgeEl.style.transform = 'scale(1.1)'; setTimeout(() => { badgeEl.style.transform = ''; }, 180); }
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

/* ---------- 概要（統計・内訳・曜日・ヒートマップ・タイムライン） ---------- */

function isoWeekdayIndex(dateStr) {
  // 月曜=0 ... 日曜=6
  const d = new Date(dateStr + 'T00:00:00');
  return (d.getDay() + 6) % 7;
}

function buildAllEntries(windowDays) {
  // {date, habitId, name, color} のフラットな配列（直近 windowDays 日分）
  const today = dashboardData.today;
  const cutoff = new Date(today + 'T00:00:00');
  cutoff.setDate(cutoff.getDate() - (windowDays - 1));
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const entries = [];
  dashboardData.habits.forEach(function (h) {
    h.checkedDates.forEach(function (d) {
      if (d >= cutoffStr && d <= today) {
        entries.push({ date: d, habitId: h.habitId, name: h.name, color: h.color });
      }
    });
  });
  entries.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { entries, cutoffStr };
}

function renderOverviewAll() {
  const WINDOW = 31;
  const { entries, cutoffStr } = buildAllEntries(WINDOW);
  document.getElementById('overview-range').textContent =
    cutoffStr + ' – ' + dashboardData.today + '（' + WINDOW + '日間）・チェック記録より自動集計';

  renderStats(entries, WINDOW, cutoffStr);
  renderBreakdown(entries);
  renderWeekday(entries);
  renderHeatmap(WINDOW, cutoffStr);
  renderTimeline();
}

function renderStats(entries, windowDays, cutoffStr) {
  const grid = document.getElementById('stat-grid');
  if (!dashboardData.habits.length) {
    grid.innerHTML = '<div class="empty-state">行動を追加すると、ここに統計が表示されます。</div>';
    return;
  }

  const activeDays = new Set(entries.map(e => e.date)).size;
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  entries.forEach(e => weekdayCounts[isoWeekdayIndex(e.date)]++);
  let busiestIdx = 0;
  weekdayCounts.forEach((c, i) => { if (c > weekdayCounts[busiestIdx]) busiestIdx = i; });
  const sortedCounts = weekdayCounts.slice().sort((a, b) => b - a);
  const secondLabel = sortedCounts[1] > 0
    ? '次いで' + WEEKDAY_LABELS[weekdayCounts.indexOf(sortedCounts[1])] + '曜日（' + sortedCounts[1] + '件）'
    : '他の曜日はまだ記録なし';
  const avgPerWeek = (entries.length / (windowDays / 7)).toFixed(1);

  const topHabit = dashboardData.habits.slice().sort((a, b) => b.totalCount - a.totalCount)[0];

  grid.innerHTML = `
    <div class="card stat-card">
      <div class="stat-label">総チェック数</div>
      <div class="stat-value">${entries.length}<span class="unit">件</span></div>
      <div class="stat-sub">${cutoffStr}〜${dashboardData.today}</div>
    </div>
    <div class="card stat-card">
      <div class="stat-label">アクティブな日数</div>
      <div class="stat-value">${activeDays}<span class="unit">/ ${windowDays}日</span></div>
      <div class="stat-sub">全体の${Math.round((activeDays / windowDays) * 100)}%の日に記録あり</div>
    </div>
    <div class="card stat-card">
      <div class="stat-label">最も多い曜日</div>
      <div class="stat-value">${weekdayCounts[busiestIdx] > 0 ? WEEKDAY_LABELS[busiestIdx] : '―'}<span class="unit">${weekdayCounts[busiestIdx] > 0 ? '曜日・' + weekdayCounts[busiestIdx] + '件' : ''}</span></div>
      <div class="stat-sub">${secondLabel}</div>
    </div>
    <div class="card stat-card">
      <div class="stat-label">週平均チェック数</div>
      <div class="stat-value">${avgPerWeek}<span class="unit">件/週</span></div>
      <div class="stat-sub">${topHabit ? escapeHtml(topHabit.name) + 'がよく継続中' : ''}</div>
    </div>
  `;
}

function renderBreakdown(entries) {
  const card = document.getElementById('breakdown-card');
  document.getElementById('breakdown-note').textContent =
    entries.length ? '全' + entries.length + '件を' + dashboardData.habits.length + '個の行動に分類' : '';

  if (!entries.length) {
    card.innerHTML = '<div class="empty-state">まだ記録がありません。</div>';
    return;
  }
  const counts = {};
  dashboardData.habits.forEach(h => counts[h.habitId] = { name: h.name, color: h.color, count: 0 });
  entries.forEach(e => { if (counts[e.habitId]) counts[e.habitId].count++; });

  const list = Object.values(counts).filter(c => c.count > 0).sort((a, b) => b.count - a.count);
  const max = list.length ? list[0].count : 1;
  const total = entries.length;

  card.innerHTML = list.map(function (c) {
    const pct = Math.round((c.count / total) * 100);
    const width = Math.max(6, Math.round((c.count / max) * 100));
    return `
      <div class="breakdown-row">
        <div class="b-label"><span class="habit-dot" style="background:${c.color}"></span>${escapeHtml(c.name)}</div>
        <div class="b-track"><div class="b-fill" style="width:${width}%;background:${c.color}"></div></div>
        <div class="b-value">${c.count}件・${pct}%</div>
      </div>
    `;
  }).join('');
}

function renderWeekday(entries) {
  const card = document.getElementById('weekday-card');
  const counts = [0, 0, 0, 0, 0, 0, 0];
  entries.forEach(e => counts[isoWeekdayIndex(e.date)]++);
  const max = Math.max(1, ...counts);

  card.innerHTML = '<div class="weekday-chart">' + counts.map(function (c, i) {
    const h = Math.max(4, Math.round((c / max) * 130));
    return `
      <div class="weekday-col">
        <div class="w-count">${c}</div>
        <div class="w-bar" style="height:${h}px;"></div>
        <div class="w-label">${WEEKDAY_LABELS[i]}</div>
      </div>
    `;
  }).join('') + '</div>';
}

function renderHeatmap(windowDays, cutoffStr) {
  const card = document.getElementById('heatmap-card');
  if (!dashboardData.habits.length) {
    card.innerHTML = '<div class="empty-state">行動を追加すると、ここにヒートマップが表示されます。</div>';
    return;
  }

  // 日付ごとのチェック数と内訳を集計
  const perDate = {};
  dashboardData.habits.forEach(function (h) {
    h.checkedDates.forEach(function (d) {
      if (!perDate[d]) perDate[d] = { count: 0, names: [] };
      perDate[d].count++;
      perDate[d].names.push(h.name);
    });
  });

  // 月曜始まりの週単位でグリッドを構築（cutoffStr を含む週の月曜から今日まで）
  const cutoff = new Date(cutoffStr + 'T00:00:00');
  const startMonday = new Date(cutoff);
  startMonday.setDate(startMonday.getDate() - isoWeekdayIndex(cutoffStr));

  const today = dashboardData.today;
  const weeks = [];
  let cursor = new Date(startMonday);
  while (cursor.toISOString().slice(0, 10) <= today) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  const counts = Object.keys(perDate).map(d => perDate[d].count);
  const maxCount = Math.max(1, ...counts, 0);

  function levelColor(count) {
    if (count <= 0) return 'var(--border-soft)';
    const ratio = count / maxCount;
    if (ratio > 0.75) return 'var(--ink)';
    if (ratio > 0.45) return '#4b7bea';
    if (ratio > 0.15) return '#a9c3f5';
    return '#dde7fb';
  }

  let html = '<div class="heatmap-legend"><span>少ない</span>'
    + '<span class="lg-cell" style="background:var(--border-soft)"></span>'
    + '<span class="lg-cell" style="background:#dde7fb"></span>'
    + '<span class="lg-cell" style="background:#a9c3f5"></span>'
    + '<span class="lg-cell" style="background:#4b7bea"></span>'
    + '<span class="lg-cell" style="background:var(--ink)"></span><span>多い</span></div>';

  html += '<div class="heatmap-grid">';
  html += '<div class="heatmap-header-row"><span></span>' + WEEKDAY_LABELS.map(l => '<span>' + l + '</span>').join('') + '</div>';

  weeks.forEach(function (week) {
    html += '<div class="heatmap-week-row"><span class="wk-label">' + week[0].slice(5).replace('-', '/') + '</span>';
    week.forEach(function (d) {
      const inRange = d >= cutoffStr && d <= today;
      if (!inRange) { html += '<span></span>'; return; }
      const info = perDate[d];
      const count = info ? info.count : 0;
      const tip = d.slice(5).replace('-', '/') + '　' + (count > 0 ? info.names.join('・') : '記録なし');
      html += `<div class="hm-cell${d === today ? ' today' : ''}" style="background:${levelColor(count)}" data-count="${count}" data-tip="${escapeHtml(tip)}"></div>`;
    });
    html += '</div>';
  });
  html += '</div>';

  card.innerHTML = html;
}

function renderTimeline() {
  const chipsEl = document.getElementById('timeline-chips');
  const listEl = document.getElementById('timeline-list');
  const emptyEl = document.getElementById('timeline-empty');

  const counts = {};
  dashboardData.habits.forEach(h => counts[h.habitId] = 0);
  dashboardData.habits.forEach(h => { counts[h.habitId] = h.checkedDates.length; });

  let chipsHtml = `<button class="chip ${timelineFilter === 'all' ? 'active' : ''}" data-filter="all">すべて</button>`;
  dashboardData.habits.forEach(function (h) {
    chipsHtml += `<button class="chip ${timelineFilter === h.habitId ? 'active' : ''}" data-filter="${h.habitId}">
      <span class="c-dot" style="background:${h.color}"></span>${escapeHtml(h.name)}（${counts[h.habitId]}）
    </button>`;
  });
  chipsEl.innerHTML = chipsHtml;
  chipsEl.querySelectorAll('.chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      timelineFilter = chip.dataset.filter;
      renderTimeline();
    });
  });

  let entries = [];
  dashboardData.habits.forEach(function (h) {
    if (timelineFilter !== 'all' && timelineFilter !== h.habitId) return;
    h.checkedDates.forEach(function (d) {
      entries.push({ date: d, name: h.name, color: h.color });
    });
  });
  entries.sort((a, b) => (a.date < b.date ? 1 : -1));

  if (!entries.length) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  let html = '';
  let lastWeekLabel = null;
  entries.forEach(function (e) {
    const weekLabel = weekLabelForDate(e.date);
    if (weekLabel !== lastWeekLabel) {
      html += '<div class="timeline-group-label">' + weekLabel + '</div>';
      lastWeekLabel = weekLabel;
    }
    html += `
      <div class="timeline-item">
        <span class="t-dot" style="background:${e.color}"></span>
        <span class="t-date">${e.date.slice(5).replace('-', '/')}</span>
        <span class="t-name">${escapeHtml(e.name)}</span>
      </div>
    `;
  });
  listEl.innerHTML = html;
}

function weekLabelForDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const monday = new Date(d);
  monday.setDate(monday.getDate() - isoWeekdayIndex(dateStr));
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const fmt = x => (x.getMonth() + 1) + '/' + x.getDate();
  return fmt(monday) + ' - ' + fmt(sunday);
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
    card.className = 'card fav-card';
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

document.getElementById('btn-share-sns').addEventListener('click', function () { shareText(buildSummaryText()); });
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
