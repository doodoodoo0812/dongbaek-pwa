/* ===========================
   동백전 납부 매칭 PWA - 앱 로직
   =========================== */

// ===== 데이터 =====
let db = {
  members: [],
  payments: [],
  settings: { apiKey: '', orgName: '' }
};

let currentTab = 'members';
let statusMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
let statusFilter = 'all';
let pendingImageBase64 = null;

// ===== 초기화 =====
function init() {
  loadData();
  setMonth(statusMonth);
  renderMembers();
  renderPayments();
  renderStatus();

  // 설정에 저장된 API 키 여부에 따라 캡처 탭 UI 초기화
  updateCaptureUI();

  // 붙여넣기 이벤트 (전역)
  document.addEventListener('paste', handlePaste);

  // 서비스 워커 등록
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // 오늘 날짜를 기본값으로
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().slice(0, 5);
  document.getElementById('p-date').value = today;
  document.getElementById('p-time').value = now;

  // 월 필터 기본값
  document.getElementById('payment-month').value = statusMonth;
}

// ===== 데이터 저장/불러오기 =====
function saveData() {
  localStorage.setItem('dongbaek_db', JSON.stringify(db));
}

function loadData() {
  const saved = localStorage.getItem('dongbaek_db');
  if (saved) {
    try { db = { ...db, ...JSON.parse(saved) }; }
    catch (e) { console.warn('데이터 로드 실패', e); }
  }
}

// ===== 탭 전환 =====
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`panel-${tab}`).classList.add('active');

  if (tab === 'status') renderStatus();
  if (tab === 'payments') renderPayments();
  if (tab === 'capture') updateCaptureUI();
}

// ===== 회원 관리 =====
function addMember() {
  const name = document.getElementById('m-name').value.trim();
  const mask = document.getElementById('m-mask').value.trim();
  const fee = parseInt(document.getElementById('m-fee').value) || 0;
  const memo = document.getElementById('m-memo').value.trim();

  if (!name) { showToast('이름을 입력하세요'); return; }

  // 중복 확인
  if (db.members.find(m => m.name === name)) {
    showToast('이미 등록된 이름이에요'); return;
  }

  db.members.push({ id: Date.now(), name, mask, fee, memo, createdAt: new Date().toISOString() });
  saveData();
  renderMembers();

  ['m-name', 'm-mask', 'm-fee', 'm-memo'].forEach(id => document.getElementById(id).value = '');
  showToast(`${name} 회원이 추가됐어요`);
}

function deleteMember(id) {
  const m = db.members.find(m => m.id === id);
  if (!m) return;
  if (!confirm(`${m.name} 회원을 삭제할까요?`)) return;
  db.members = db.members.filter(m => m.id !== id);
  saveData();
  renderMembers();
  showToast('삭제됐어요');
}

function renderMembers() {
  const query = (document.getElementById('member-search')?.value || '').trim();
  const list = document.getElementById('member-list');
  const countBadge = document.getElementById('member-count');
  countBadge.textContent = `${db.members.length}명`;

  let filtered = db.members;
  if (query) filtered = filtered.filter(m => m.name.includes(query) || (m.mask && m.mask.includes(query)));

  if (!filtered.length) {
    list.innerHTML = `<div class="list-empty">${query ? '검색 결과가 없어요' : '등록된 회원이 없어요'}</div>`;
    return;
  }

  list.innerHTML = filtered.map(m => `
    <div class="member-item">
      <div class="member-info">
        <div class="member-name">${m.name}</div>
        <div class="member-meta">
          ${m.mask ? `<span class="member-mask">${m.mask}</span>` : ''}
          ${m.fee ? `<span class="member-fee">${m.fee.toLocaleString()}원/월</span>` : ''}
          ${m.memo ? `<span style="color:var(--text3)">${m.memo}</span>` : ''}
        </div>
      </div>
      <div class="member-actions">
        <button class="btn btn-danger btn-sm" onclick="deleteMember(${m.id})">삭제</button>
      </div>
    </div>
  `).join('');
}

// ===== 결제 내역 =====
function addPayment() {
  const date = document.getElementById('p-date').value;
  const time = document.getElementById('p-time').value;
  const payer = document.getElementById('p-payer').value.trim();
  const amount = parseInt(document.getElementById('p-amount').value) || 0;

  if (!date && !payer) { showToast('날짜 또는 결제자를 입력하세요'); return; }

  const datetime = date ? `${date}${time ? ' ' + time : ''}` : '';
  db.payments.push({ id: Date.now(), datetime, date, time, payer, amount, memberId: null, createdAt: new Date().toISOString() });
  saveData();
  renderPayments();

  document.getElementById('p-payer').value = '';
  document.getElementById('p-amount').value = '';
  showToast('내역이 추가됐어요');
}

function deletePayment(id) {
  db.payments = db.payments.filter(p => p.id !== id);
  saveData();
  renderPayments();
  renderStatus();
  showToast('삭제됐어요');
}

function renderPayments() {
  const monthFilter = document.getElementById('payment-month')?.value || '';
  const list = document.getElementById('payment-list');
  const countBadge = document.getElementById('payment-count');

  let filtered = db.payments;
  if (monthFilter) filtered = filtered.filter(p => p.date && p.date.startsWith(monthFilter));

  countBadge.textContent = `${db.payments.length}건`;

  if (!filtered.length) {
    list.innerHTML = `<div class="list-empty">결제 내역이 없어요</div>`;
    return;
  }

  // 최신 순
  const sorted = [...filtered].sort((a, b) => (b.datetime || '').localeCompare(a.datetime || ''));

  list.innerHTML = sorted.map(p => {
    const member = p.memberId ? db.members.find(m => m.id === p.memberId) : null;
    const candidates = getCandidates(p.payer);
    return `
      <div class="payment-item">
        <div class="payment-row">
          <span class="payment-payer">${p.payer || '(이름없음)'}</span>
          <span class="payment-amount">${p.amount ? p.amount.toLocaleString() + '원' : '-'}</span>
        </div>
        <div class="payment-row">
          <span class="payment-datetime">${p.datetime || '-'}</span>
          ${member
            ? `<span class="payment-matched">✅ ${member.name}</span>`
            : candidates.length === 1
              ? `<span class="payment-matched" style="cursor:pointer" onclick="assignPayment(${p.id},${candidates[0].id})">🔗 ${candidates[0].name}?</span>`
              : candidates.length > 1
                ? `<span class="payment-unmatched" onclick="openMatchModal(${p.id})" style="cursor:pointer;color:var(--unknown)">후보 ${candidates.length}명</span>`
                : `<span class="payment-unmatched">미매칭</span>`
          }
        </div>
        <div style="margin-top:6px;display:flex;justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" onclick="deletePayment(${p.id})">삭제</button>
        </div>
      </div>
    `;
  }).join('');
}

// ===== 마스킹 매칭 =====
function matchMask(mask, pattern) {
  if (!mask || !pattern) return false;
  if (mask === pattern) return true;
  // * 를 . 로 변환해서 정규식 매칭
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, c => c === '*' ? '.' : '\\' + c);
  try { return new RegExp(`^${escaped}$`).test(mask); } catch { return false; }
}

function getCandidates(payer) {
  if (!payer) return [];
  return db.members.filter(m => matchMask(payer, m.mask));
}

function assignPayment(paymentId, memberId) {
  const p = db.payments.find(p => p.id === paymentId);
  if (p) { p.memberId = memberId; saveData(); }
  renderPayments();
  renderStatus();
  const m = db.members.find(m => m.id === memberId);
  showToast(`${m?.name}으로 매칭됐어요`);
  closeMatchModal();
}

function unassignPayment(paymentId) {
  const p = db.payments.find(p => p.id === paymentId);
  if (p) { p.memberId = null; saveData(); }
  renderStatus();
}

// ===== 자동 매칭 =====
function runAutoMatch() {
  let count = 0;
  db.payments.forEach(p => {
    if (!p.memberId) {
      const candidates = getCandidates(p.payer);
      if (candidates.length === 1) { p.memberId = candidates[0].id; count++; }
    }
  });
  saveData();
  renderPayments();
  renderStatus();
  showToast(`${count}건이 자동 매칭됐어요`);
}

// ===== 납부 현황 =====
function setMonth(ym) {
  statusMonth = ym;
  const [y, m] = ym.split('-');
  document.getElementById('status-month-display').textContent = `${y}년 ${parseInt(m)}월`;
}

function changeMonth(delta) {
  const [y, m] = statusMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta);
  statusMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  setMonth(statusMonth);
  renderStatus();
}

function setFilter(f, btn) {
  statusFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderStatus();
}

function renderStatus() {
  if (currentTab !== 'status') return;
  const list = document.getElementById('status-list');

  // 해당 월 결제 내역
  const monthPayments = db.payments.filter(p => p.date && p.date.startsWith(statusMonth));

  let paid = 0, unpaid = 0, unknown = 0;

  const items = db.members.map(m => {
    const mPayments = monthPayments.filter(p => p.memberId === m.id);
    const candidatePayments = monthPayments.filter(p => !p.memberId && getCandidates(p.payer).some(c => c.id === m.id));

    let status;
    if (mPayments.length > 0) { status = 'paid'; paid++; }
    else if (candidatePayments.length > 0) { status = 'unknown'; unknown++; }
    else { status = 'unpaid'; unpaid++; }

    return { member: m, status, mPayments, candidatePayments };
  });

  // 통계 업데이트
  document.getElementById('s-total').textContent = db.members.length;
  document.getElementById('s-paid').textContent = paid;
  document.getElementById('s-unpaid').textContent = unpaid;
  document.getElementById('s-unknown').textContent = unknown;

  // 필터 적용
  const filtered = statusFilter === 'all' ? items : items.filter(i => i.status === statusFilter);

  if (!filtered.length) {
    list.innerHTML = `<div class="list-empty">${db.members.length === 0 ? '회원을 먼저 등록하세요' : '해당 항목이 없어요'}</div>`;
    return;
  }

  // 미납 → 확인필요 → 납부 순서로 정렬
  const order = { unpaid: 0, unknown: 1, paid: 2 };
  filtered.sort((a, b) => order[a.status] - order[b.status]);

  list.innerHTML = filtered.map(({ member: m, status, mPayments, candidatePayments }) => {
    const lastPayment = mPayments[mPayments.length - 1];
    const badgeClass = { paid: 'badge-paid', unpaid: 'badge-unpaid', unknown: 'badge-unknown' }[status];
    const badgeText = { paid: '납부 ✓', unpaid: '미납', unknown: '확인필요' }[status];

    let detailHtml = '';
    if (status === 'paid' && lastPayment) {
      detailHtml = `<div class="status-detail">${lastPayment.datetime || ''} · ${lastPayment.amount ? lastPayment.amount.toLocaleString() + '원' : ''}</div>`;
    }
    if (status === 'unknown') {
      const tags = candidatePayments.map(p => `
        <span class="candidate-tag" onclick="assignPayment(${p.id}, ${m.id})" title="클릭하면 이 회원으로 매칭">
          ${p.payer} ${p.amount ? p.amount.toLocaleString() + '원' : ''} ${p.time || ''}
        </span>
      `).join('');
      detailHtml = `<div class="status-detail" style="margin-bottom:6px">이 결제가 ${m.name}님일 수 있어요:</div><div class="status-candidates">${tags}</div>`;
    }

    return `
      <div class="status-item ${status}">
        <div class="status-top">
          <div>
            <span class="status-name">${m.name}</span>
            ${m.mask ? `<span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--primary);margin-left:8px">${m.mask}</span>` : ''}
          </div>
          <span class="status-badge ${badgeClass}">${badgeText}</span>
        </div>
        ${detailHtml}
        ${m.memo ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">${m.memo}</div>` : ''}
        ${status === 'paid' && mPayments.length > 0 ? `<button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="unassignPayment(${mPayments[0].id})">매칭 취소</button>` : ''}
      </div>
    `;
  }).join('');
}

// ===== 이미지 업로드 처리 =====
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('drag-over');
}
function handleDragLeave(e) {
  document.getElementById('upload-zone').classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadImageFile(file);
  else showToast('이미지 파일만 올려주세요');
}
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) loadImageFile(file);
}
function handlePaste(e) {
  if (currentTab !== 'capture') return;
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) { loadImageFile(file); break; }
    }
  }
}

function loadImageFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const base64 = dataUrl.split(',')[1];
    pendingImageBase64 = base64;

    document.getElementById('preview-img').src = dataUrl;
    document.getElementById('preview-area').style.display = 'block';
    document.getElementById('upload-zone').style.display = 'none';

    // API 키 있으면 자동 분석
    if (db.settings.apiKey) {
      document.getElementById('result-card').style.display = 'block';
      analyzeImage();
    } else {
      document.getElementById('no-api-card').style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
}

function clearPreview() {
  pendingImageBase64 = null;
  document.getElementById('preview-area').style.display = 'none';
  document.getElementById('upload-zone').style.display = 'block';
  document.getElementById('result-card').style.display = 'none';
  document.getElementById('no-api-card').style.display = 'none';
  document.getElementById('file-input').value = '';
  ['r-date', 'r-time', 'r-payer', 'r-amount'].forEach(id => document.getElementById(id).value = '');
}

function updateCaptureUI() {
  const hasKey = !!db.settings.apiKey;
  const noApiCard = document.getElementById('no-api-card');
  if (noApiCard) noApiCard.style.display = (!hasKey && pendingImageBase64) ? 'block' : 'none';
}

// ===== Gemini AI 분석 =====
async function analyzeImage() {
  if (!pendingImageBase64) { showToast('사진을 먼저 업로드하세요'); return; }
  if (!db.settings.apiKey) { openSettings(); return; }

  const statusEl = document.getElementById('ai-status');
  statusEl.className = 'ai-status loading';
  statusEl.textContent = '🔍 Gemini AI가 사진을 분석하는 중...';
  document.getElementById('result-card').style.display = 'block';

  const prompt = `이 이미지는 동백전(부산 지역화폐) 결제 화면 캡처입니다.
이미지에서 다음 정보를 찾아서 JSON 형식으로만 답해주세요:
{
  "date": "YYYY-MM-DD 형식의 결제 날짜",
  "time": "HH:MM 형식의 결제 시간",
  "payer": "결제자 이름 (예: 김*수 형태의 마스킹된 이름)",
  "amount": 숫자만 (원 단위, 쉼표 없이)
}
정보를 찾지 못한 경우 해당 값을 null로 설정하세요.
반드시 JSON만 응답하고 다른 텍스트는 포함하지 마세요.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${db.settings.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: 'image/jpeg', data: pendingImageBase64 } }
            ]
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 256 }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('응답에서 데이터를 찾지 못했어요');

    const result = JSON.parse(jsonMatch[0]);

    // 결과 채우기
    if (result.date) document.getElementById('r-date').value = result.date;
    if (result.time) document.getElementById('r-time').value = result.time;
    if (result.payer) document.getElementById('r-payer').value = result.payer;
    if (result.amount) document.getElementById('r-amount').value = result.amount;

    statusEl.className = 'ai-status success';
    statusEl.textContent = '✅ 인식 완료! 내용을 확인 후 저장하세요.';

  } catch (err) {
    statusEl.className = 'ai-status error';
    statusEl.textContent = `❌ 오류: ${err.message}`;
    console.error(err);
  }
}

function saveFromCapture() {
  const date = document.getElementById('r-date').value;
  const time = document.getElementById('r-time').value;
  const payer = document.getElementById('r-payer').value.trim();
  const amount = parseInt(document.getElementById('r-amount').value) || 0;

  if (!date && !payer) { showToast('날짜 또는 결제자 정보가 필요해요'); return; }

  const datetime = date ? `${date}${time ? ' ' + time : ''}` : '';
  db.payments.push({ id: Date.now(), datetime, date, time, payer, amount, memberId: null, createdAt: new Date().toISOString() });
  saveData();
  showToast('내역에 저장됐어요!');
  clearPreview();

  // 내역 탭으로 이동
  switchTab('payments');
}

// ===== 매칭 모달 =====
function openMatchModal(paymentId) {
  const p = db.payments.find(p => p.id === paymentId);
  if (!p) return;
  const candidates = getCandidates(p.payer);

  const body = document.getElementById('match-modal-body');
  body.innerHTML = `
    <p style="margin-bottom:14px;color:var(--text2)">
      <strong>${p.payer}</strong> · ${p.amount ? p.amount.toLocaleString() + '원' : ''} · ${p.datetime || ''}
    </p>
    <p style="font-size:13px;margin-bottom:10px;color:var(--text2)">어떤 회원의 결제인가요?</p>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${candidates.map(c => `
        <button class="btn btn-ghost" onclick="assignPayment(${p.id}, ${c.id})" style="justify-content:flex-start">
          <span style="font-weight:700">${c.name}</span>
          <span style="font-family:'JetBrains Mono',monospace;color:var(--primary);margin-left:8px">${c.mask}</span>
          ${c.memo ? `<span style="color:var(--text3);margin-left:8px">${c.memo}</span>` : ''}
        </button>
      `).join('')}
    </div>
  `;
  document.getElementById('match-modal').style.display = 'flex';
}
function closeMatchModal() { document.getElementById('match-modal').style.display = 'none'; }
function closeMatchModalOutside(e) { if (e.target === document.getElementById('match-modal')) closeMatchModal(); }

// ===== 설정 =====
function openSettings() {
  document.getElementById('api-key-input').value = db.settings.apiKey || '';
  document.getElementById('setting-name').value = db.settings.orgName || '';
  document.getElementById('settings-modal').style.display = 'flex';
}
function closeSettings() { document.getElementById('settings-modal').style.display = 'none'; }
function closeSettingsOutside(e) { if (e.target === document.getElementById('settings-modal')) closeSettings(); }

function saveSettings() {
  db.settings.apiKey = document.getElementById('api-key-input').value.trim();
  db.settings.orgName = document.getElementById('setting-name').value.trim();
  saveData();
  closeSettings();
  updateCaptureUI();
  showToast('설정이 저장됐어요');
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('api-key-input');
  input.type = input.type === 'password' ? 'text' : 'password';
}

// ===== 데이터 백업/복원 =====
function exportAllData() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dongbaek_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('백업 파일이 다운로드됐어요');
}

function importData() { document.getElementById('import-file').click(); }

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!confirm('기존 데이터를 덮어쓸까요?')) return;
      db = { ...db, ...imported };
      saveData();
      renderMembers();
      renderPayments();
      renderStatus();
      closeSettings();
      showToast('데이터가 복원됐어요');
    } catch { showToast('파일 형식이 올바르지 않아요'); }
  };
  reader.readAsText(file);
}

// ===== CSV 내보내기 =====
function exportCSV() {
  const monthPayments = db.payments.filter(p => p.date && p.date.startsWith(statusMonth));
  const rows = [['이름', '마스킹', '상태', '결제일시', '금액', '메모']];

  db.members.forEach(m => {
    const mPay = monthPayments.filter(p => p.memberId === m.id);
    const candPay = monthPayments.filter(p => !p.memberId && getCandidates(p.payer).some(c => c.id === m.id));
    let status, datetime, amount;

    if (mPay.length > 0) {
      status = '납부'; datetime = mPay[0].datetime || ''; amount = mPay[0].amount || '';
    } else if (candPay.length > 0) {
      status = '확인필요'; datetime = candPay[0].datetime || ''; amount = candPay[0].amount || '';
    } else {
      status = '미납'; datetime = ''; amount = '';
    }
    rows.push([m.name, m.mask || '', status, datetime, amount, m.memo || '']);
  });

  const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `납부현황_${statusMonth}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV 파일이 다운로드됐어요');
}

// ===== 토스트 =====
function showToast(msg, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ===== 시작 =====
document.addEventListener('DOMContentLoaded', init);
