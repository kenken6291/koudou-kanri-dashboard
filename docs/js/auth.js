let pendingToken = null;

document.querySelectorAll('.tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    hideMsg();
  });
});

document.querySelectorAll('.pw-toggle').forEach(function (btn) {
  btn.addEventListener('click', function () {
    const input = document.getElementById(btn.dataset.target);
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.textContent = showing ? '表示' : '非表示';
  });
});

function showMsg(text, type) {
  const el = document.getElementById('msg');
  el.textContent = text;
  el.className = 'msg show ' + type;
}
function hideMsg() {
  const el = document.getElementById('msg');
  el.className = 'msg';
}

document.getElementById('form-login').addEventListener('submit', async function (e) {
  e.preventDefault();
  hideMsg();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  try {
    const res = await callApi('login', { email, password });
    if (!res.ok) { showMsg(res.error, 'error'); return; }
    if (res.isTempPassword) {
      pendingToken = res.token;
      pendingNickname = res.nickname;
      document.getElementById('modal-first-change').classList.add('show');
    } else {
      setToken(res.token);
      setNickname(res.nickname);
      window.location.href = 'dashboard.html';
    }
  } catch (err) {
    showMsg('通信エラーが発生しました。時間をおいて再度お試しください。', 'error');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('form-register').addEventListener('submit', async function (e) {
  e.preventDefault();
  hideMsg();
  const email = document.getElementById('reg-email').value.trim();
  const nickname = document.getElementById('reg-nickname').value.trim();
  const agreeTerms = document.getElementById('reg-agree').checked;
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  try {
    const res = await callApi('register', { email, nickname, agreeTerms });
    if (!res.ok) { showMsg(res.error, 'error'); return; }
    showMsg(res.message, 'success');
    e.target.reset();
    document.querySelector('.tab[data-tab="login"]').click();
  } catch (err) {
    showMsg('通信エラーが発生しました。時間をおいて再度お試しください。', 'error');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('form-forgot').addEventListener('submit', async function (e) {
  e.preventDefault();
  hideMsg();
  const email = document.getElementById('forgot-email').value.trim();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  try {
    const res = await callApi('forgotPassword', { email });
    showMsg(res.message || '手続きを受け付けました。', res.ok ? 'success' : 'error');
    e.target.reset();
  } catch (err) {
    showMsg('通信エラーが発生しました。時間をおいて再度お試しください。', 'error');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('form-first-change').addEventListener('submit', async function (e) {
  e.preventDefault();
  const newPassword = document.getElementById('fc-password').value;
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  try {
    const res = await callApi('changePassword', { token: pendingToken, newPassword });
    if (!res.ok) { alert(res.error); return; }
    setToken(pendingToken);
    setNickname(pendingNickname);
    window.location.href = 'dashboard.html';
  } catch (err) {
    alert('通信エラーが発生しました。');
  } finally {
    btn.disabled = false;
  }
});
