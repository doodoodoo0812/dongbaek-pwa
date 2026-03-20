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
function renderTeacherGroups() {
  const container = document.getElementById('teacher-group-list');
  if (!container) return;

  // 임시 샘플 데이터 표시 (회원이 없을 때)
  const source = db.members.length > 0 ? db.members : getSampleMembers();
  const isSample = db.members.length === 0;

  // 선생님별 그룹핑
  const groups = {};
  source.forEach(m => {
    const teacher = m.teacher || '(담당 미지정)';
    if (!groups[teacher]) groups[teacher] = [];
    groups[teacher].push(m);
  });

  const teacherNames = Object.keys(groups).sort((a, b) => {
    if (a === '(담당 미지정)') return 1;
    if (b === '(담당 미지정)') return -1;
    return a.localeCompare(b);
  });

  if (!teacherNames.length) {
    container.innerHTML = `<div class="list-empty">등록된 회원이 없어요</div>`;
    return;
  }

  container.innerHTML = (isSample ? `<div style="font-size:12px;color:var(--unknown);background:var(--unknown-bg);padding:8px 10px;border-radius:var(--radius-sm);margin-bottom:10px">📋 회원이 없어 임시 샘플 데이터를 표시하고 있어요</div>` : '') +
    teacherNames.map(teacher => {
      const students = groups[teacher];
      const id = `tg-${teacher.replace(/\s/g, '-')}`;
      return `
        <div class="teacher-group" id="${id}">
          <div class="teacher-group-header" onclick="toggleTeacherGroup('${id}')">
            <div class="teacher-group-title">
              <span>👨‍🏫</span>
              <span>${teacher}</span>
            </div>
            <div class="teacher-group-meta">
              <span style="background:var(--primary-light);color:var(--primary);padding:2px 8px;border-radius:12px;font-weight:700">${students.length}명</span>
              <span class="teacher-group-arrow">▼</span>
            </div>
          </div>
          <div class="teacher-group-body">
            ${students.map(s => `
              <div class="teacher-student-item">
                <div>
                  <div class="teacher-student-name">${s.name}</div>
                  <div class="teacher-student-info">
                    ${s.mask ? `<span style="font-family:'JetBrains Mono',monospace;color:var(--primary)">${s.mask}</span>` : ''}
                    ${s.fee ? ` · ${s.fee.toLocaleString()}원/월` : ''}
                    ${s.memo ? ` · ${s.memo}` : ''}
                  </div>
                </div>
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
    { name: '김민준', mask: '김*준', fee: 180000, teacher: '박지수 선생님', memo: '초등4학년' },
    { name: '이서연', mask: '이*연', fee: 200000, teacher: '박지수 선생님', memo: '중등1학년' },
    { name: '최지우', mask: '최*우', fee: 180000, teacher: '박지수 선생님', memo: '초등6학년' },
    { name: '정예린', mask: '정*린', fee: 200000, teacher: '김태양 선생님', memo: '고등1학년' },
    { name: '한도윤', mask: '한*윤', fee: 180000, teacher: '김태양 선생님', memo: '중등3학년' },
    { name: '오승현', mask: '오*현', fee: 200000, teacher: '김태양 선생님', memo: '고등2학년' },
    { name: '윤하은', mask: '윤*은', fee: 180000, teacher: '이나래 선생님', memo: '초등5학년' },
    { name: '임준호', mask: '임*호', fee: 180000, teacher: '이나래 선생님', memo: '초등3학년' },
    { name: '강수아', mask: '강*아', fee: 200000, teacher: '', memo: '중등2학년' },
  ];
}


function downloadExcelTemplate() {
  const header = '회원(학생)이름,마스킹패턴,월납부액,담당선생님,메모';
  const examples = [
    '김철수,김*수,180000,홍길동 선생님,초등3학년',
    '이영희,이*희,200000,김선생님,중등1학년',
    '박민준,박*준,180000,,고등2학년'
  ].join('\n');
  const csv = '\uFEFF' + header + '\n' + examples;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '회원등록_양식.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('양식이 다운로드됐어요');
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
        const [name, mask, feeStr, teacher, memo] = cols;
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

// ===== 결제 내역 =====
function addPayment() {
  const date = document.getElementById('p-date').value;
  const time = document.getElementById('p-time').value;
  const payer = document.getElementById('p-payer').value.trim();
  const amount = parseInt(document.getElementById('p-amount').value) || 0;

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
  document.getElementById('p-amount').value = '';
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

// ===== 이미지 업로드 =====
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
  ['r-date', 'r-time', 'r-payer', 'r-amount'].forEach(id => document.getElementById(id).value = '');
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
{"date":"YYYY-MM-DD","time":"HH:MM","payer":"김*수 형태의 마스킹 이름","amount":숫자만}
찾지 못한 경우 null. JSON만 응답하세요.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${db.settings.apiKey}`,
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
    if (result.amount) document.getElementById('r-amount').value = result.amount;

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
  const amount = parseInt(document.getElementById('r-amount').value) || 0;

  if (!date || !payer) {
    showConfirm('⚠️ 정보 불완전', '날짜 또는 결제자 이름이 없어요.\n불완전한 정보로 저장할까요?',
      `날짜: ${date || '(없음)'}\n결제자: ${payer || '(없음)'}\n금액: ${amount ? amount.toLocaleString() + '원' : '(없음)'}`,
      () => {
        const datetime = date ? `${date}${time ? ' ' + time : ''}` : '';
        db.payments.push({ id: Date.now(), datetime, date, time, payer, amount, memberId: null, createdAt: new Date().toISOString() });
        saveData(); clearPreview(); switchTab('payments');
        showToast('내역에 저장됐어요');
      });
    return;
  }

  const datetime = date ? `${date}${time ? ' ' + time : ''}` : '';
  db.payments.push({ id: Date.now(), datetime, date, time, payer, amount, memberId: null, createdAt: new Date().toISOString() });
  saveData(); clearPreview(); switchTab('payments');
  showToast('내역에 저장됐어요!');
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
  db.settings.orgName = document.getElementById('setting-name').value.trim();
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
      showConfirm('📥 데이터 복원', '기존 데이터를 모두 덮어쓸까요?\n이 작업은 되돌릴 수 없어요.', '', () => {
        db = { ...db, ...imported };
        saveData(); renderMembers(); renderPayments(); renderStatus(); closeSettings();
        showToast('데이터가 복원됐어요');
      });
    } catch { showToast('파일 형식이 올바르지 않아요'); }
  };
  reader.readAsText(file);
}

// ===== CSV 내보내기 =====
function exportCSV() {
  const monthPayments = db.payments.filter(p => p.date && p.date.startsWith(statusMonth));
  const rows = [['회원(학생)이름', '마스킹', '담당선생님', '상태', '결제일시', '금액', '등록납부액', '메모']];

  db.members.forEach(m => {
    const mPay = monthPayments.filter(p => p.memberId === m.id);
    const candPay = monthPayments.filter(p => !p.memberId && getCandidates(p.payer).some(c => c.id === m.id));
    let status, datetime, amount;
    if (mPay.length > 0) { status = '납부'; datetime = mPay[0].datetime || ''; amount = mPay[0].amount || ''; }
    else if (candPay.length > 0) { status = '확인필요'; datetime = candPay[0].datetime || ''; amount = candPay[0].amount || ''; }
    else { status = '미납'; datetime = ''; amount = ''; }
    rows.push([m.name, m.mask || '', m.teacher || '', status, datetime, amount, m.fee || '', m.memo || '']);
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

document.addEventListener('DOMContentLoaded', init);
