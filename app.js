/* ===========================
   동백전 납부 매칭 PWA - 앱 로직 v2
   =========================== */

let db = {
  members: [],
  payments: [],
  settings: { apiKey: '', orgName: '' }
};

let currentTab = 'members';
let statusMonth = new Date().toISOString().slice(0, 7);
let statusFilter = 'all';
let pendingImageBase64 = null;

// ===== 초기화 =====
function init() {
  loadData();
  setMonth(statusMonth);
  renderMembers();
  renderPayments();

  updateCaptureUI();
  document.addEventListener('paste', handlePaste);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().slice(0, 5);
  document.getElementById('p-date').value = today;
  document.getElementById('p-time').value = now;
  document.getElementById('payment-month').value = statusMonth;
}

function saveData() {
  localStorage.setItem('dongbaek_db', JSON.stringify(db));
}

function loadData() {
  const saved = localStorage.getItem('dongbaek_db');
  if (saved) {
    try { db = { ...db, ...JSON.parse(saved) }; } catch (e) {}
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

// ===== 납부액 드롭다운 =====
function handleFeeSelect() {
  const sel = document.getElementById('m-fee-select').value;
  const wrap = document.getElementById('m-fee-custom-wrap');
  wrap.style.display = sel === 'custom' ? 'flex' : 'none';
  if (sel !== 'custom') document.getElementById('m-fee-custom').value = '';
}

function getFeeValue() {
  const sel = document.getElementById('m-fee-select').value;
  if (sel === 'custom') return parseInt(document.getElementById('m-fee-custom').value) || 0;
  return parseInt(sel) || 0;
}

// ===== 회원 관리 =====
function addMember() {
  const name = document.getElementById('m-name').value.trim();
  const mask = document.getElementById('m-mask').value.trim();
  const fee = getFeeValue();
  const teacher = document.getElementById('m-teacher').value.trim();
  const memo = document.getElementById('m-memo').value.trim();

  if (!name) { showToast('회원(학생) 이름을 입력하세요'); return; }
  if (!mask) { showToast('마스킹 패턴을 입력하세요 (예: 김*수)'); return; }

  if (db.members.find(m => m.name === name)) {
    showToast('이미 등록된 이름이에요'); return;
  }

  // 마스킹 패턴 중복 경고
  const sameMask = db.members.filter(m => m.mask === mask);
  if (sameMask.length > 0) {
    showConfirm(
      '⚠️ 마스킹 패턴 중복',
      `"${mask}" 패턴이 이미 ${sameMask.map(m => m.name).join(', ')} 회원에 등록되어 있어요.\n자동 매칭 시 구분이 어려울 수 있어요.`,
      `중복 회원: ${sameMask.map(m => `${m.name} (${m.mask})`).join('\n')}`,
      () => {
        db.members.push({ id: Date.now(), name, mask, fee, teacher, memo, createdAt: new Date().toISOString() });
        saveData(); renderMembers(); clearMemberForm();
        showToast(`${name} 회원이 추가됐어요`);
      }
    );
    return;
  }

  db.members.push({ id: Date.now(), name, mask, fee, teacher, memo, createdAt: new Date().toISOString() });
  saveData(); renderMembers(); clearMemberForm();
  showToast(`${name} 회원이 추가됐어요`);
}

function clearMemberForm() {
  ['m-name', 'm-mask', 'm-fee-custom', 'm-teacher', 'm-memo'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('m-fee-select').value = '';
  document.getElementById('m-fee-custom-wrap').style.display = 'none';
}

function deleteMember(id) {
  const m = db.members.find(m => m.id === id);
  if (!m) return;
  showConfirm('🗑️ 회원 삭제', `${m.name} 회원을 삭제할까요?\n해당 회원의 매칭 정보도 함께 초기화돼요.`, '', () => {
    db.payments.forEach(p => { if (p.memberId === id) p.memberId = null; });
    db.members = db.members.filter(m => m.id !== id);
    saveData(); renderMembers(); renderStatus();
    showToast('삭제됐어요');
  });
}

function renderMembers() {
  const query = (document.getElementById('member-search')?.value || '').trim().toLowerCase();
  const list = document.getElementById('member-list');
  document.getElementById('member-count').textContent = `${db.members.length}명`;

  let filtered = db.members;
  if (query) {
    filtered = filtered.filter(m =>
      m.name.includes(query) ||
      (m.mask && m.mask.includes(query)) ||
      (m.teacher && m.teacher.toLowerCase().includes(query)) ||
      (m.memo && m.memo.includes(query))
    );
  }

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
          ${m.teacher ? `<span style="color:var(--text2)">👨‍🏫 ${m.teacher}</span>` : ''}
          ${m.memo ? `<span style="color:var(--text3)">${m.memo}</span>` : ''}
        </div>
      </div>
      <div class="member-actions">
        <button class="btn btn-danger btn-sm" onclick="deleteMember(${m.id})">삭제</button>
      </div>
    </div>
  `).join('');
  renderTeacherGroups();
}

// ===== 선생님별 그룹 리스트 =====
const TEACHER_ORDER = ['지사장님', '최수정', '김가영', '이묘련', '김선미', '이현주', '김보온', '(담당 미지정)'];

function renderTeacherGroups() {
  const container = document.getElementById('teacher-group-list');
  if (!container) return;

  const source = db.members.length > 0 ? db.members : getSampleMembers();
  const isSample = db.members.length === 0;

  const groups = {};
  source.forEach(m => {
    const teacher = m.teacher || '(담당 미지정)';
    if (!groups[teacher]) groups[teacher] = [];
    groups[teacher].push(m);
  });

  const teacherNames = Object.keys(groups).sort((a, b) => {
    const ai = TEACHER_ORDER.indexOf(a), bi = TEACHER_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  if (!teacherNames.length) {
    container.innerHTML = `<div class="list-empty">등록된 회원이 없어요</div>`;
    return;
  }

  container.innerHTML =
    (isSample ? `<div style="font-size:12px;color:var(--unknown);background:var(--unknown-bg);padding:8px 10px;border-radius:var(--radius-sm);margin-bottom:10px">📋 임시 샘플 데이터 표시 중 — 회원을 등록하면 실제 데이터로 바뀌어요</div>` : '') +
    teacherNames.map(teacher => {
      const students = groups[teacher];
      const safeId = 'tg-' + teacher.replace(/[\s()]/g, '-');
      return `
        <div class="teacher-group" id="${safeId}">
          <div class="teacher-group-header" onclick="toggleTeacherGroup('${safeId}')">
            <div class="teacher-group-title">
              <span>👨‍🏫</span><span>${teacher}</span>
            </div>
            <div class="teacher-group-meta">
              <span style="background:var(--primary-light);color:var(--primary);padding:2px 8px;border-radius:12px;font-weight:700">${students.length}명</span>
              <span class="teacher-group-arrow">▼</span>
            </div>
          </div>
          <div class="teacher-group-body">
            ${students.map(s => `
              <div class="teacher-student-item">
                <div style="flex:1">
                  <div class="teacher-student-name">${s.name}</div>
                  <div class="teacher-student-info">
                    ${s.mask ? `<span style="font-family:'JetBrains Mono',monospace;color:var(--primary)">${s.mask}</span>` : ''}
                    ${s.fee ? ` · ${s.fee.toLocaleString()}원/월` : ''}
                    ${s.memo ? ` · ${s.memo}` : ''}
                  </div>
                </div>
                ${!isSample ? `<button class="btn btn-danger btn-sm" style="margin-left:8px;flex-shrink:0" onclick="deleteMember(${s.id})">삭제</button>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
}

function toggleTeacherGroup(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}

function getSampleMembers() {
  return [
    { id: -1,  name: '김민준', mask: '김*준', fee: 180000, teacher: '지사장님', memo: '초등4학년' },
    { id: -2,  name: '이서연', mask: '이*연', fee: 200000, teacher: '지사장님', memo: '중등1학년' },
    { id: -3,  name: '최지우', mask: '최*우', fee: 180000, teacher: '최수정',  memo: '초등6학년' },
    { id: -4,  name: '정예린', mask: '정*린', fee: 200000, teacher: '최수정',  memo: '고등1학년' },
    { id: -5,  name: '한도윤', mask: '한*윤', fee: 180000, teacher: '김가영',  memo: '중등3학년' },
    { id: -6,  name: '오승현', mask: '오*현', fee: 200000, teacher: '이묘련',  memo: '고등2학년' },
    { id: -7,  name: '윤하은', mask: '윤*은', fee: 180000, teacher: '김선미',  memo: '초등5학년' },
    { id: -8,  name: '임준호', mask: '임*호', fee: 180000, teacher: '이현주',  memo: '초등3학년' },
    { id: -9,  name: '강수아', mask: '강*아', fee: 200000, teacher: '김보온',  memo: '중등2학년' },
    { id: -10, name: '박재현', mask: '박*현', fee: 180000, teacher: '',        memo: '고등3학년' },
  ];
}


function downloadExcelTemplate() {
  const b64 = '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';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '회원등록_양식.xlsx';
  a.click();
  URL.revokeObjectURL(url);
  showToast('엑셀 양식이 다운로드됐어요');
}

function handleExcelUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const text = ev.target.result;
      const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
      if (lines.length < 2) { showToast('데이터가 없어요'); return; }

      const rows = lines.slice(1); // 헤더 제외
      let added = 0, skipped = 0, warnings = [];

      rows.forEach(line => {
        const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
        // 열 순서: 이름, 담당선생님, 마스킹패턴, 월납부액, 메모
        const [name, teacher, mask, feeStr, memo] = cols;
        if (!name) return;

        if (db.members.find(m => m.name === name)) { skipped++; return; }

        const sameMask = db.members.filter(m => m.mask === mask);
        if (sameMask.length > 0) warnings.push(`"${name}" - 마스킹 패턴 "${mask}" 중복`);

        db.members.push({
          id: Date.now() + added,
          name, mask: mask || '',
          fee: parseInt(feeStr) || 0,
          teacher: teacher || '',
          memo: memo || '',
          createdAt: new Date().toISOString()
        });
        added++;
      });

      saveData(); renderMembers();
      let msg = `${added}명 추가됐어요`;
      if (skipped) msg += `, ${skipped}명 중복 건너뜀`;
      if (warnings.length) {
        showConfirm('⚠️ 업로드 완료 (주의사항)', msg, warnings.join('\n'), null, true);
      } else {
        showToast(msg);
      }
    } catch (err) {
      showToast('파일을 읽을 수 없어요. CSV 형식인지 확인하세요');
    }
  };
  reader.readAsText(file, 'UTF-8');
  e.target.value = '';
}

// ===== 결제 내역 금액 드롭다운 =====
function handlePaymentFeeSelect() {
  const sel = document.getElementById('p-fee-select').value;
  const wrap = document.getElementById('p-fee-custom-wrap');
  wrap.style.display = sel === 'custom' ? 'flex' : 'none';
  if (sel !== 'custom') document.getElementById('p-amount').value = '';
}
function getPaymentFeeValue() {
  const sel = document.getElementById('p-fee-select').value;
  if (!sel) return 0;
  if (sel === 'custom') return parseInt(document.getElementById('p-amount').value) || 0;
  return parseInt(sel) || 0;
}

// ===== 캡처 금액 드롭다운 =====
function handleCaptureFeeSelect() {
  const sel = document.getElementById('r-fee-select').value;
  const wrap = document.getElementById('r-fee-custom-wrap');
  wrap.style.display = sel === 'custom' ? 'flex' : 'none';
  if (sel !== 'custom') document.getElementById('r-amount').value = '';
}
function getCaptureFeeValue() {
  const sel = document.getElementById('r-fee-select').value;
  if (!sel) return 0;
  if (sel === 'custom') return parseInt(document.getElementById('r-amount').value) || 0;
  return parseInt(sel) || 0;
}
function setCaptureFeeDropdown(amount) {
  const sel = document.getElementById('r-fee-select');
  const wrap = document.getElementById('r-fee-custom-wrap');
  if (amount === 180000) { sel.value = '180000'; wrap.style.display = 'none'; }
  else if (amount === 200000) { sel.value = '200000'; wrap.style.display = 'none'; }
  else if (amount) {
    sel.value = 'custom'; wrap.style.display = 'flex';
    document.getElementById('r-amount').value = amount;
  }
}

// ===== 결제 내역 =====
function addPayment() {
  const date = document.getElementById('p-date').value;
  const time = document.getElementById('p-time').value;
  const payer = document.getElementById('p-payer').value.trim();
  const amount = getPaymentFeeValue();

  if (!date && !payer) { showToast('날짜 또는 결제자를 입력하세요'); return; }

  // 중복 결제 확인 (같은 날짜+마스킹+금액)
  const dup = db.payments.find(p => p.date === date && p.payer === payer && p.amount === amount);
  if (dup) {
    showConfirm('⚠️ 중복 결제 의심', `동일한 날짜·결제자·금액의 내역이 이미 있어요.\n정말 추가할까요?`,
      `날짜: ${date}\n결제자: ${payer}\n금액: ${amount.toLocaleString()}원`, () => {
        pushPayment(date, time, payer, amount);
      });
    return;
  }

  // 같은 달 동일 마스킹 이중 납부 확인
  const month = date.slice(0, 7);
  const sameMonthSamePayer = db.payments.filter(p => p.date && p.date.startsWith(month) && p.payer === payer && p.memberId);
  if (sameMonthSamePayer.length > 0) {
    const m = db.members.find(m => m.id === sameMonthSamePayer[0].memberId);
    showConfirm('⚠️ 이중 납부 의심', `${month} 에 "${payer}" 결제자가 이미 납부한 내역이 있어요.\n중복 납부일 수 있어요.`,
      `기존 납부: ${sameMonthSamePayer[0].datetime} · ${sameMonthSamePayer[0].amount?.toLocaleString()}원${m ? ' → ' + m.name : ''}`, () => {
        pushPayment(date, time, payer, amount);
      });
    return;
  }

  pushPayment(date, time, payer, amount);
}

function pushPayment(date, time, payer, amount) {
  const datetime = date ? `${date}${time ? ' ' + time : ''}` : '';
  db.payments.push({ id: Date.now(), datetime, date, time, payer, amount, memberId: null, createdAt: new Date().toISOString() });
  saveData(); renderPayments();
  document.getElementById('p-payer').value = '';
  document.getElementById('p-fee-select').value = '';
  document.getElementById('p-amount').value = '';
  document.getElementById('p-fee-custom-wrap').style.display = 'none';
  showToast('내역이 추가됐어요');
}

function deletePayment(id) {
  showConfirm('🗑️ 내역 삭제', '이 결제 내역을 삭제할까요?', '', () => {
    db.payments = db.payments.filter(p => p.id !== id);
    saveData(); renderPayments(); renderStatus();
    showToast('삭제됐어요');
  });
}

function renderPayments() {
  const monthFilter = document.getElementById('payment-month')?.value || '';
  const list = document.getElementById('payment-list');
  document.getElementById('payment-count').textContent = `${db.payments.length}건`;

  let filtered = db.payments;
  if (monthFilter) filtered = filtered.filter(p => p.date && p.date.startsWith(monthFilter));

  if (!filtered.length) {
    list.innerHTML = `<div class="list-empty">결제 내역이 없어요</div>`;
    return;
  }

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
              ? `<span class="payment-matched" style="cursor:pointer" onclick="confirmAssign(${p.id},${candidates[0].id})">🔗 ${candidates[0].name}?</span>`
              : candidates.length > 1
                ? `<span style="cursor:pointer;color:var(--unknown);font-size:12px" onclick="openMatchModal(${p.id})">⚠️ 후보 ${candidates.length}명</span>`
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
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, c => c === '*' ? '.' : '\\' + c);
  try { return new RegExp(`^${escaped}$`).test(mask); } catch { return false; }
}

function getCandidates(payer) {
  if (!payer) return [];
  return db.members.filter(m => matchMask(payer, m.mask));
}

// 매칭 전 금액 검증 포함
function confirmAssign(paymentId, memberId) {
  const p = db.payments.find(x => x.id === paymentId);
  const m = db.members.find(x => x.id === memberId);
  if (!p || !m) return;

  // 금액 불일치 경고
  if (m.fee && p.amount && m.fee !== p.amount) {
    showConfirm('⚠️ 금액 불일치',
      `${m.name} 회원의 등록 납부액(${m.fee.toLocaleString()}원)과\n결제 금액(${p.amount.toLocaleString()}원)이 달라요.\n그래도 매칭할까요?`,
      `등록 납부액: ${m.fee.toLocaleString()}원\n실제 결제액: ${p.amount.toLocaleString()}원`,
      () => assignPayment(paymentId, memberId)
    );
    return;
  }

  // 같은 달 이미 납부한 경우
  const month = p.date ? p.date.slice(0, 7) : '';
  if (month) {
    const alreadyPaid = db.payments.find(x => x.id !== paymentId && x.memberId === memberId && x.date && x.date.startsWith(month));
    if (alreadyPaid) {
      showConfirm('⚠️ 이중 납부 의심',
        `${m.name} 회원이 ${month}에 이미 납부한 내역이 있어요.\n중복 매칭할까요?`,
        `기존 납부: ${alreadyPaid.datetime} · ${alreadyPaid.amount?.toLocaleString()}원`,
        () => assignPayment(paymentId, memberId)
      );
      return;
    }
  }

  assignPayment(paymentId, memberId);
}

function assignPayment(paymentId, memberId) {
  const p = db.payments.find(p => p.id === paymentId);
  if (p) { p.memberId = memberId; saveData(); }
  renderPayments(); renderStatus();
  const m = db.members.find(m => m.id === memberId);
  showToast(`${m?.name}으로 매칭됐어요`);
  closeMatchModal();
}

function unassignPayment(paymentId) {
  const p = db.payments.find(p => p.id === paymentId);
  if (p) { p.memberId = null; saveData(); }
  renderStatus();
  showToast('매칭이 취소됐어요');
}

// ===== 자동 매칭 =====
function runAutoMatch() {
  let matched = 0, skipped = 0, multipleList = [];

  db.payments.forEach(p => {
    if (p.memberId) return;
    const candidates = getCandidates(p.payer);
    if (candidates.length === 1) {
      // 금액 불일치 체크
      const m = candidates[0];
      if (m.fee && p.amount && m.fee !== p.amount) {
        skipped++;
        multipleList.push(`${p.payer} (${p.datetime}) → 금액불일치: 등록${m.fee.toLocaleString()}원 vs 결제${p.amount.toLocaleString()}원`);
      } else {
        p.memberId = m.id; matched++;
      }
    } else if (candidates.length > 1) {
      skipped++;
      multipleList.push(`${p.payer} (${p.datetime || '-'}) → 후보 ${candidates.length}명: ${candidates.map(c => c.name).join(', ')}`);
    }
  });

  saveData(); renderPayments(); renderStatus();

  if (multipleList.length > 0) {
    showConfirm('🔗 자동 매칭 완료 (수동 확인 필요)',
      `${matched}건 매칭됐어요. ${skipped}건은 수동 확인이 필요해요.`,
      multipleList.join('\n'),
      null, true
    );
  } else {
    showToast(`${matched}건이 자동 매칭됐어요`);
  }
}

// ===== 납부 현황 =====
let pickerYear = new Date().getFullYear();

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

// ===== 월 달력 피커 =====
function toggleMonthPicker() {
  const picker = document.getElementById('month-picker');
  if (picker.style.display === 'none') {
    pickerYear = parseInt(statusMonth.split('-')[0]);
    renderMonthPicker();
    picker.style.display = 'block';
  } else {
    picker.style.display = 'none';
  }
}

function changePickerYear(delta) {
  pickerYear += delta;
  renderMonthPicker();
}

function renderMonthPicker() {
  document.getElementById('picker-year').textContent = `${pickerYear}년`;
  const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const curM = statusMonth;
  document.getElementById('picker-months').innerHTML = months.map((label, i) => {
    const ym = `${pickerYear}-${String(i+1).padStart(2,'0')}`;
    const isActive = ym === curM;
    return `<button onclick="selectPickerMonth('${ym}')"
      style="padding:8px 4px;border-radius:var(--radius-sm);border:1px solid ${isActive ? 'var(--primary)' : 'var(--border)'};
      background:${isActive ? 'var(--primary)' : 'transparent'};
      color:${isActive ? 'white' : 'var(--text-primary)'};
      font-family:'Noto Sans KR',sans-serif;font-size:13px;cursor:pointer;font-weight:${isActive ? '700' : '400'}"
    >${label}</button>`;
  }).join('');
}

function selectPickerMonth(ym) {
  document.getElementById('month-picker').style.display = 'none';
  statusMonth = ym;
  setMonth(ym);
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

  // 회원이 없으면 임시 예시 표시
  if (db.members.length === 0) {
    renderSampleStatus();
    return;
  }

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

  document.getElementById('s-total').textContent = db.members.length;
  document.getElementById('s-paid').textContent = paid;
  document.getElementById('s-unpaid').textContent = unpaid;
  document.getElementById('s-unknown').textContent = unknown;

  const filtered = statusFilter === 'all' ? items : items.filter(i => i.status === statusFilter);

  if (!filtered.length) {
    list.innerHTML = `<div class="list-empty">${db.members.length === 0 ? '회원을 먼저 등록하세요' : '해당 항목이 없어요'}</div>`;
    return;
  }

  const order = { unpaid: 0, unknown: 1, paid: 2 };
  filtered.sort((a, b) => order[a.status] - order[b.status]);

  list.innerHTML = filtered.map(({ member: m, status, mPayments, candidatePayments }) => {
    const lastPayment = mPayments[mPayments.length - 1];
    const badgeClass = { paid: 'badge-paid', unpaid: 'badge-unpaid', unknown: 'badge-unknown' }[status];
    const badgeText = { paid: '납부 ✓', unpaid: '미납', unknown: '확인필요' }[status];

    // 금액 불일치 경고
    let amountWarning = '';
    if (status === 'paid' && lastPayment && m.fee && lastPayment.amount && m.fee !== lastPayment.amount) {
      amountWarning = `<div style="font-size:11px;color:var(--unknown);margin-top:4px">⚠️ 등록 납부액(${m.fee.toLocaleString()}원)과 실제 결제(${lastPayment.amount.toLocaleString()}원)가 달라요</div>`;
    }

    let detailHtml = '';
    if (status === 'paid' && lastPayment) {
      detailHtml = `<div class="status-detail">${lastPayment.datetime || ''} · ${lastPayment.amount ? lastPayment.amount.toLocaleString() + '원' : ''}</div>${amountWarning}`;
    }
    if (status === 'unknown') {
      const tags = candidatePayments.map(p => `
        <span class="candidate-tag" onclick="confirmAssign(${p.id}, ${m.id})" title="클릭하면 이 회원으로 매칭">
          ${p.payer} ${p.amount ? p.amount.toLocaleString() + '원' : ''} ${p.time || ''}
        </span>`).join('');
      detailHtml = `<div class="status-detail" style="margin-bottom:6px">👇 클릭해서 매칭 확인</div><div class="status-candidates">${tags}</div>`;
    }

    // 이중납부 경고
    let dupWarning = '';
    if (mPayments.length > 1) {
      dupWarning = `<div style="font-size:11px;color:var(--unpaid);margin-top:4px">⚠️ 이달 납부 내역이 ${mPayments.length}건이에요 (중복 확인 필요)</div>`;
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
        ${m.teacher ? `<div style="font-size:12px;color:var(--text2);margin-bottom:4px">👨‍🏫 ${m.teacher}</div>` : ''}
        ${detailHtml}
        ${dupWarning}
        ${m.memo ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">${m.memo}</div>` : ''}
        ${status === 'paid' && mPayments.length > 0 ? `<button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="unassignPayment(${mPayments[0].id})">매칭 취소</button>` : ''}
      </div>
    `;
  }).join('');
}

// ===== 현황 임시 예시 =====
function renderSampleStatus() {
  const list = document.getElementById('status-list');
  document.getElementById('s-total').textContent = '10';
  document.getElementById('s-paid').textContent = '6';
  document.getElementById('s-unpaid').textContent = '2';
  document.getElementById('s-unknown').textContent = '2';

  const samples = [
    { name: '김민준', mask: '김*준', teacher: '지사장님', memo: '초등4학년', status: 'unpaid', datetime: '', amount: 0 },
    { name: '이서연', mask: '이*연', teacher: '지사장님', memo: '중등1학년', status: 'unknown', datetime: '2025-03-05 14:22', amount: 200000 },
    { name: '최지우', mask: '최*우', teacher: '최수정',  memo: '초등6학년', status: 'paid',    datetime: '2025-03-03 10:15', amount: 180000 },
    { name: '정예린', mask: '정*린', teacher: '최수정',  memo: '고등1학년', status: 'paid',    datetime: '2025-03-07 16:40', amount: 200000 },
    { name: '한도윤', mask: '한*윤', teacher: '김가영',  memo: '중등3학년', status: 'paid',    datetime: '2025-03-02 09:30', amount: 180000 },
    { name: '오승현', mask: '오*현', teacher: '이묘련',  memo: '고등2학년', status: 'unpaid',  datetime: '', amount: 0 },
    { name: '윤하은', mask: '윤*은', teacher: '김선미',  memo: '초등5학년', status: 'paid',    datetime: '2025-03-10 11:05', amount: 180000 },
    { name: '임준호', mask: '임*호', teacher: '이현주',  memo: '초등3학년', status: 'unknown', datetime: '2025-03-08 15:33', amount: 180000 },
    { name: '강수아', mask: '강*아', teacher: '김보온',  memo: '중등2학년', status: 'paid',    datetime: '2025-03-04 13:20', amount: 200000 },
    { name: '박재현', mask: '박*현', teacher: '김보온',  memo: '고등3학년', status: 'paid',    datetime: '2025-03-06 17:55', amount: 180000 },
  ];

  const filtered = statusFilter === 'all' ? samples : samples.filter(s => s.status === statusFilter);
  const order = { unpaid: 0, unknown: 1, paid: 2 };
  filtered.sort((a, b) => order[a.status] - order[b.status]);

  const badgeMap = { paid: ['badge-paid','납부 ✓'], unpaid: ['badge-unpaid','미납'], unknown: ['badge-unknown','확인필요'] };

  list.innerHTML = `<div style="font-size:12px;color:var(--unknown);background:var(--unknown-bg);padding:8px 10px;border-radius:var(--radius-sm);margin-bottom:10px">📋 임시 샘플 데이터 표시 중 — 회원을 등록하면 실제 데이터로 바뀌어요</div>` +
    filtered.map(s => {
      const [badgeClass, badgeText] = badgeMap[s.status];
      return `
        <div class="status-item ${s.status}">
          <div class="status-top">
            <div>
              <span class="status-name">${s.name}</span>
              <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--primary);margin-left:8px">${s.mask}</span>
            </div>
            <span class="status-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:4px">👨‍🏫 ${s.teacher}</div>
          ${s.status === 'paid' ? `<div class="status-detail">${s.datetime} · ${s.amount.toLocaleString()}원</div>` : ''}
          ${s.status === 'unknown' ? `
            <div class="status-detail" style="margin-bottom:6px">👇 클릭해서 매칭 확인 (샘플)</div>
            <div class="status-candidates">
              <span class="candidate-tag">${s.mask} ${s.amount.toLocaleString()}원</span>
            </div>` : ''}
          <div style="font-size:11px;color:var(--text3);margin-top:4px">${s.memo}</div>
        </div>
      `;
    }).join('');
}
function handleDragOver(e) { e.preventDefault(); document.getElementById('upload-zone').classList.add('drag-over'); }
function handleDragLeave() { document.getElementById('upload-zone').classList.remove('drag-over'); }
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadImageFile(file);
  else showToast('이미지 파일만 올려주세요');
}
function handleFileSelect(e) { if (e.target.files[0]) loadImageFile(e.target.files[0]); }
function handlePaste(e) {
  if (currentTab !== 'capture') return;
  for (const item of (e.clipboardData?.items || [])) {
    if (item.type.startsWith('image/')) { loadImageFile(item.getAsFile()); break; }
  }
}

function loadImageFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    pendingImageBase64 = dataUrl.split(',')[1];
    document.getElementById('preview-img').src = dataUrl;
    document.getElementById('preview-area').style.display = 'block';
    document.getElementById('upload-zone').style.display = 'none';
    if (db.settings.apiKey) {
      document.getElementById('result-card').style.display = 'block';
      document.getElementById('no-api-card').style.display = 'none';
      analyzeImage();
    } else {
      document.getElementById('no-api-card').style.display = 'block';
      document.getElementById('result-card').style.display = 'none';
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
  document.getElementById('ai-warnings').innerHTML = '';
  document.getElementById('r-fee-select').value = '';
  document.getElementById('r-fee-custom-wrap').style.display = 'none';
  document.getElementById('r-teacher').value = '';
  ['r-date', 'r-time', 'r-payer', 'r-amount', 'r-member-name'].forEach(id => document.getElementById(id).value = '');
}

function updateCaptureUI() {
  const hasKey = !!db.settings.apiKey;
  const noApiCard = document.getElementById('no-api-card');
  if (noApiCard && pendingImageBase64) noApiCard.style.display = hasKey ? 'none' : 'block';
}

// ===== Gemini AI 분석 =====
async function analyzeImage() {
  if (!pendingImageBase64) { showToast('사진을 먼저 업로드하세요'); return; }
  if (!db.settings.apiKey) { openSettings(); return; }

  const statusEl = document.getElementById('ai-status');
  const warningsEl = document.getElementById('ai-warnings');
  statusEl.className = 'ai-status loading';
  statusEl.textContent = '🔍 Gemini AI가 사진을 분석하는 중...';
  warningsEl.innerHTML = '';
  document.getElementById('result-card').style.display = 'block';

  const prompt = `이 이미지는 동백전(부산 지역화폐) 결제 화면 캡처입니다.
이미지에서 다음 정보를 찾아서 JSON 형식으로만 답해주세요:
{"date":"YYYY-MM-DD","time":"HH:MM","payer":"김*수 형태의 마스킹 이름","amount":숫자만,"memberName":"결제자 실명(있으면)","teacher":"담당선생님이름(있으면)"}
찾지 못한 경우 null. JSON만 응답하세요.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${db.settings.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: pendingImageBase64 } }] }],
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
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('응답에서 데이터를 찾지 못했어요');
    const result = JSON.parse(jsonMatch[0]);

    if (result.date) document.getElementById('r-date').value = result.date;
    if (result.time) document.getElementById('r-time').value = result.time;
    if (result.payer) document.getElementById('r-payer').value = result.payer;
    if (result.amount) setCaptureFeeDropdown(result.amount);
    if (result.memberName) document.getElementById('r-member-name').value = result.memberName;

    // 선생님 매칭 시도 (인식된 이름이 드롭다운 목록에 있으면 자동 선택)
    if (result.teacher) {
      const teacherSelect = document.getElementById('r-teacher');
      const opts = Array.from(teacherSelect.options).map(o => o.value);
      if (opts.includes(result.teacher)) teacherSelect.value = result.teacher;
    }

    // 회원 명단에서 마스킹 패턴으로 자동 매칭 시도
    if (result.payer && !result.memberName) {
      const cands = getCandidates(result.payer);
      if (cands.length === 1) {
        document.getElementById('r-member-name').value = cands[0].name;
        if (cands[0].teacher) {
          const teacherSelect = document.getElementById('r-teacher');
          const opts = Array.from(teacherSelect.options).map(o => o.value);
          if (opts.includes(cands[0].teacher)) teacherSelect.value = cands[0].teacher;
        }
      }
    }

    // 인식 불완전 경고
    const missing = [];
    if (!result.date) missing.push('결제 날짜');
    if (!result.time) missing.push('결제 시간');
    if (!result.payer) missing.push('결제자 이름');
    if (!result.amount) missing.push('금액');

    if (missing.length > 0) {
      statusEl.className = 'ai-status error';
      statusEl.textContent = `⚠️ 일부 정보를 인식하지 못했어요. 직접 입력해주세요.`;
      warningsEl.innerHTML = `<div class="warning-box" style="margin-bottom:10px"><span>⚠️</span><div><strong>수동 입력 필요</strong><p>다음 항목을 직접 확인하세요: ${missing.join(', ')}</p></div></div>`;
    } else {
      statusEl.className = 'ai-status success';
      statusEl.textContent = '✅ 인식 완료! 내용을 확인 후 저장하세요.';
    }

  } catch (err) {
    statusEl.className = 'ai-status error';
    statusEl.textContent = `❌ 오류: ${err.message}`;
  }
}

function saveFromCapture() {
  const date = document.getElementById('r-date').value;
  const time = document.getElementById('r-time').value;
  const payer = document.getElementById('r-payer').value.trim();
  const amount = getCaptureFeeValue();
  const memberName = document.getElementById('r-member-name').value.trim();
  const teacher = document.getElementById('r-teacher').value;

  if (!date || !payer) {
    showConfirm('⚠️ 정보 불완전', '날짜 또는 결제자 이름이 없어요.\n불완전한 정보로 저장할까요?',
      `날짜: ${date || '(없음)'}\n결제자: ${payer || '(없음)'}\n금액: ${amount ? amount.toLocaleString() + '원' : '(없음)'}`,
      () => doSaveCapture(date, time, payer, amount, memberName, teacher));
    return;
  }
  doSaveCapture(date, time, payer, amount, memberName, teacher);
}

function doSaveCapture(date, time, payer, amount, memberName, teacher) {
  const datetime = date ? `${date}${time ? ' ' + time : ''}` : '';

  // 회원 이름으로 memberId 자동 매칭 시도
  let memberId = null;
  if (memberName) {
    const found = db.members.find(m => m.name === memberName);
    if (found) memberId = found.id;
  }
  if (!memberId && payer) {
    const cands = getCandidates(payer);
    if (cands.length === 1) memberId = cands[0].id;
  }

  db.payments.push({ id: Date.now(), datetime, date, time, payer, amount, memberId, createdAt: new Date().toISOString() });
  saveData(); clearPreview(); switchTab('payments');
  showToast(memberId ? `내역 저장 및 ${db.members.find(m=>m.id===memberId)?.name} 매칭 완료!` : '내역에 저장됐어요!');
}

// ===== 매칭 모달 (후보 여러 명) =====
function openMatchModal(paymentId) {
  const p = db.payments.find(p => p.id === paymentId);
  if (!p) return;
  const candidates = getCandidates(p.payer);

  document.getElementById('match-modal-title').textContent = '🔗 매칭할 회원 선택';
  document.getElementById('match-modal-body').innerHTML = `
    <div style="background:var(--surface2);padding:10px;border-radius:var(--radius-sm);margin-bottom:14px;font-size:13px">
      <strong>${p.payer}</strong> · ${p.amount ? p.amount.toLocaleString() + '원' : '-'} · ${p.datetime || '-'}
    </div>
    <p style="font-size:13px;margin-bottom:10px;color:var(--text2)">⚠️ 마스킹 패턴이 여러 회원과 일치해요. 직접 선택해주세요:</p>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${candidates.map(c => `
        <button class="btn btn-ghost" onclick="confirmAssign(${p.id}, ${c.id})" style="justify-content:flex-start;text-align:left">
          <span style="font-weight:700">${c.name}</span>
          <span style="font-family:'JetBrains Mono',monospace;color:var(--primary);margin-left:8px">${c.mask}</span>
          ${c.fee ? `<span style="color:var(--text2);margin-left:8px">${c.fee.toLocaleString()}원</span>` : ''}
          ${c.teacher ? `<span style="color:var(--text3);margin-left:8px">${c.teacher}</span>` : ''}
          ${c.memo ? `<span style="color:var(--text3);margin-left:4px">${c.memo}</span>` : ''}
        </button>`).join('')}
    </div>
  `;
  document.getElementById('match-modal-footer').innerHTML = '';
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
  saveData(); closeSettings(); updateCaptureUI();
  showToast('설정이 저장됐어요');
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('api-key-input');
  input.type = input.type === 'password' ? 'text' : 'password';
}

// ===== 확인 모달 (범용) =====
function showConfirm(title, message, detail, onOk, infoOnly = false) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  const detailEl = document.getElementById('confirm-detail');
  if (detail) {
    detailEl.style.display = 'block';
    detailEl.textContent = detail;
  } else {
    detailEl.style.display = 'none';
  }

  const cancelBtn = document.getElementById('confirm-cancel');
  const okBtn = document.getElementById('confirm-ok');

  if (infoOnly) {
    cancelBtn.style.display = 'none';
    okBtn.textContent = '확인';
    okBtn.onclick = () => { document.getElementById('confirm-modal').style.display = 'none'; };
  } else {
    cancelBtn.style.display = '';
    okBtn.textContent = '확인';
    okBtn.onclick = () => {
      document.getElementById('confirm-modal').style.display = 'none';
      if (onOk) onOk();
    };
    cancelBtn.onclick = () => { document.getElementById('confirm-modal').style.display = 'none'; };
  }

  document.getElementById('confirm-modal').style.display = 'flex';
}

function closeConfirmModal() { document.getElementById('confirm-modal').style.display = 'none'; }

// ===== 데이터 백업/복원 =====
function exportAllData() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `동백전_전체백업_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('전체 백업 파일이 다운로드됐어요');
}

function importData() { document.getElementById('import-file').click(); }

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      showConfirm('📥 데이터 복원', '기존 데이터를 모두 덮어쓸까요?\n이 작업은 되돌릴 수 없어요.', '', () => {
        db = { ...db, ...imported };
        saveData(); renderMembers(); renderPayments(); renderStatus(); closeSettings();
        showToast('데이터가 복원됐어요');
      });
    } catch { showToast('파일 형식이 올바르지 않아요'); }
  };
  reader.readAsText(file);
}

// ===== 월별 JSON 백업 =====
function exportMonthlyJSON() {
  const month = document.getElementById('backup-month').value || statusMonth;
  if (!month) { showToast('월을 선택하세요'); return; }
  const monthPayments = db.payments.filter(p => p.date && p.date.startsWith(month));
  const payload = { month, members: db.members, payments: monthPayments, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `동백전_${month}_백업.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${month} 월별 백업이 완료됐어요`);
}

// ===== 월별 엑셀(CSV) 저장 =====
function exportMonthlyExcel() {
  const month = document.getElementById('backup-month').value || statusMonth;
  if (!month) { showToast('월을 선택하세요'); return; }
  const [y, m] = month.split('-');
  const monthLabel = `${y}년 ${parseInt(m)}월`;
  const monthPayments = db.payments.filter(p => p.date && p.date.startsWith(month));

  // 헤더
  const rows = [[`${monthLabel} 납부 현황`], []];
  rows.push(['회원(학생)이름', '담당선생님', '마스킹패턴', '상태', '결제일시', '결제금액', '등록납부액', '메모']);

  // 선생님 순서대로 정렬
  const sorted = [...db.members].sort((a, b) => {
    const ai = TEACHER_ORDER.indexOf(a.teacher || ''), bi = TEACHER_ORDER.indexOf(b.teacher || '');
    if (ai === -1 && bi === -1) return (a.teacher || '').localeCompare(b.teacher || '');
    if (ai === -1) return 1; if (bi === -1) return -1;
    return ai - bi;
  });

  sorted.forEach(m => {
    const mPay = monthPayments.filter(p => p.memberId === m.id);
    const candPay = monthPayments.filter(p => !p.memberId && getCandidates(p.payer).some(c => c.id === m.id));
    let status, datetime, amount;
    if (mPay.length > 0) { status = '납부'; datetime = mPay[0].datetime || ''; amount = mPay[0].amount || ''; }
    else if (candPay.length > 0) { status = '확인필요'; datetime = candPay[0].datetime || ''; amount = candPay[0].amount || ''; }
    else { status = '미납'; datetime = ''; amount = ''; }
    rows.push([m.name, m.teacher || '', m.mask || '', status, datetime, amount ? `₩${Number(amount).toLocaleString()}` : '', m.fee ? `₩${Number(m.fee).toLocaleString()}` : '', m.memo || '']);
  });

  // 요약 행
  const paid = sorted.filter(m => monthPayments.some(p => p.memberId === m.id)).length;
  const unpaid = sorted.length - paid;
  rows.push([]);
  rows.push(['합계', '', '', `납부 ${paid}명 / 미납 ${unpaid}명`, '', '', '', '']);

  const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `동백전_납부현황_${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${monthLabel} 엑셀 파일이 다운로드됐어요`);
}

// ===== CSV 내보내기 (납부현황 탭) =====
function exportCSV() {
  exportMonthlyExcel();
}

// ===== 토스트 =====
function showToast(msg, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

document.addEventListener('DOMContentLoaded', init);
