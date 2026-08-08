// ============================================================
// pages/personal.js — หน้าบัญชีรายรับ-รายจ่ายส่วนตัว + ปฏิทินย้อนหลัง
// ============================================================

let personalCategories = [];
let allPersonalWallets = [];
let selectedPersonalMonth = ''; // รูปแบบ YYYY-MM
let currentPersonalTab = 'entry'; // 'entry' หรือ 'calendar'
let personalCalendarYear = new Date().getFullYear();
let personalCalendarMonth = new Date().getMonth() + 1;

async function renderPersonal(tab = currentPersonalTab) {
    currentPersonalTab = tab;
    const container = document.getElementById('personal-content');
    if (!container) return;
    container.innerHTML = '<div class="loading">กำลังโหลดข้อมูล...</div>';

    if (!selectedPersonalMonth) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        selectedPersonalMonth = `${yyyy}-${mm}`;
    }

    try {
        const [categories, summary, transactions, wallets] = await Promise.all([
            API.Personal.getCategories(),
            API.Personal.getSummary(selectedPersonalMonth),
            API.Personal.getTransactions(selectedPersonalMonth),
            API.Personal.getWallets()
        ]);

        personalCategories = categories;
        allPersonalWallets = wallets;

        const expenseCats = categories.filter(c => c.type === 'expense');
        const incomeCats = categories.filter(c => c.type === 'income');

        // --- ส่วนกระเป๋าเงิน ---
        const walletColors = ['#6366F1','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#EC4899'];
        const walletCardsHtml = `
            <div style="margin-bottom: 1.2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                    <h3 style="font-size: 1rem; margin: 0;">👛 กระเป๋าเงินของฉัน</h3>
                    <button class="btn btn-outline btn-sm" onclick="showCreateWalletModal()" style="font-size: 0.8rem;">+ สร้างกระเป๋าใหม่</button>
                </div>
                <div style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; scrollbar-width: thin;">
                    ${wallets.map((w, idx) => {
                        const bal = parseFloat(w.balance) || 0;
                        const color = w.color || walletColors[idx % walletColors.length];
                        return `
                        <div style="
                            min-width: 160px; background: linear-gradient(135deg, ${color}, ${color}cc);
                            border-radius: 16px; padding: 16px 14px; color: white; flex-shrink: 0;
                            box-shadow: 0 4px 12px ${color}44; position: relative;
                        ">
                            <div style="font-size: 1.6rem; margin-bottom: 4px;">${w.emoji}</div>
                            <div style="font-size: 0.8rem; opacity: 0.85; margin-bottom: 2px;">${w.name}</div>
                            <div style="font-size: 1.4rem; font-weight: bold;">${formatCurrency(bal)}</div>
                            ${wallets.length > 1 ? `<button onclick="deleteWallet(${w.id},'${w.name}')"
                                style="position:absolute; top:8px; right:8px; background:rgba(255,255,255,0.2); border:none; border-radius:50%; width:22px; height:22px; cursor:pointer; font-size:0.7rem; color:white; display:flex; align-items:center; justify-content:center;"
                            >✕</button>` : ''}
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;

        let html = `
            <div class="flex justify-between align-center mb-2">
                <h2>👛 บัญชีส่วนตัว</h2>
                <input type="month" id="personal-month-picker" class="form-control" style="width: auto; padding: 4px 8px;" value="${selectedPersonalMonth}" onchange="changePersonalMonth(this.value)">
            </div>

            ${walletCardsHtml}

            <!-- Tab switcher: บันทึกด่วน / ปฏิทินย้อนหลัง -->
            <div style="display:flex; gap:0; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid #E5E7EB; margin-bottom: 1rem;">
                <button id="tab-personal-entry" onclick="switchPersonalTab('entry')" style="flex:1; padding: 0.6rem; background:${tab === 'entry' ? '#fff' : '#F9FAFB'}; border:none; font-weight:600; cursor:pointer; color:${tab === 'entry' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom: 3px solid ${tab === 'entry' ? 'var(--primary)' : 'transparent'};">
                    ⚡ บันทึกด่วน
                </button>
                <button id="tab-personal-calendar" onclick="switchPersonalTab('calendar')" style="flex:1; padding: 0.6rem; background:${tab === 'calendar' ? '#fff' : '#F9FAFB'}; border:none; font-weight:600; cursor:pointer; color:${tab === 'calendar' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom: 3px solid ${tab === 'calendar' ? 'var(--primary)' : 'transparent'};">
                    📅 ปฏิทินรายวัน
                </button>
            </div>

            <!-- สรุปยอดเงินส่วนตัวประจำเดือน -->
            <div class="summary-grid mb-3">
                <div class="summary-box" style="background: rgba(16, 185, 129, 0.1); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.2);">
                    <span class="summary-label" style="color: #047857;">รายรับเดือนนี้</span>
                    <div class="summary-value">+${formatCurrency(summary.total_income)}</div>
                </div>
                <div class="summary-box" style="background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.2);">
                    <span class="summary-label" style="color: #B91C1C;">รายจ่ายเดือนนี้</span>
                    <div class="summary-value">-${formatCurrency(summary.total_expense)}</div>
                </div>
                <div class="summary-box" style="background: linear-gradient(135deg, #6366F1, #8B5CF6); color: white; border: none; grid-column: span 2;">
                    <span class="summary-label" style="color: rgba(255,255,255,0.85);">เงินคงเหลือทุกกระเป๋า (เปิดดู)</span>
                    <div class="summary-value" style="font-size: 1.8rem;">${formatCurrency(wallets.reduce((s,w) => s + parseFloat(w.balance||0), 0))}</div>
                </div>
            </div>
        `;

        if (tab === 'entry') {
            html += `
                <!-- ปุ่มกดบันทึกด่วนด้วย EMOJI GRID -->
                <div class="card mb-3" style="background: var(--bg-card); border-radius: 12px; padding: 1rem;">
                    <h3 class="mb-2" style="font-size: 1rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                        💸 บันทึกรายจ่ายส่วนตัว (แตะปุ่มปุ๊บ พิมพ์เงินปั๊บ)
                    </h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px;">
                        ${expenseCats.map(c => `
                            <button type="button" onclick="openQuickAddPersonalModal(${c.id})" style="
                                display: flex; flex-direction: column; align-items: center; justify-content: center;
                                padding: 12px 8px; background: rgba(239, 68, 68, 0.05); border: 1.5px solid rgba(239, 68, 68, 0.2);
                                border-radius: 12px; cursor: pointer; transition: all 0.2s ease; outline: none;
                            " onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'">
                                <span style="font-size: 1.8rem; margin-bottom: 4px;">${c.emoji}</span>
                                <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-main); text-align: center; line-height: 1.2;">${c.name}</span>
                            </button>
                        `).join('')}
                    </div>

                    <h3 class="mt-3 mb-2" style="font-size: 1rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                        💵 บันทึกรายรับส่วนตัว
                    </h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px;">
                        ${incomeCats.map(c => `
                            <button type="button" onclick="openQuickAddPersonalModal(${c.id})" style="
                                display: flex; flex-direction: column; align-items: center; justify-content: center;
                                padding: 12px 8px; background: rgba(16, 185, 129, 0.05); border: 1.5px solid rgba(16, 185, 129, 0.2);
                                border-radius: 12px; cursor: pointer; transition: all 0.2s ease; outline: none;
                            " onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'">
                                <span style="font-size: 1.8rem; margin-bottom: 4px;">${c.emoji}</span>
                                <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-main); text-align: center; line-height: 1.2;">${c.name}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- รายการประวัติส่วนตัวล่าสุด -->
                <div class="flex justify-between align-center mb-2">
                    <h3>📜 ประวัติรายการส่วนตัวล่าสุด</h3>
                    <span class="text-muted" style="font-size: 0.85rem;">${transactions.length} รายการ</span>
                </div>

                <div class="item-list">
                    ${transactions.length === 0 ? '<p class="text-center text-muted py-3">ยังไม่มีรายการส่วนตัวในเดือนนี้</p>' : ''}
                    ${transactions.map(t => {
                        const isIncome = t.type === 'income';
                        // หากระเป๋าของรายการนี้
                        const txWallet = allPersonalWallets.find(w => w.id === t.wallet_id);
                        return `
                            <div class="item-card" style="padding: 12px 14px;">
                                <div class="item-info">
                                    <div class="item-emoji" style="background: ${isIncome ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; font-size: 1.4rem; padding: 8px; border-radius: 10px;">
                                        ${t.category_emoji || (isIncome ? '💰' : '💸')}
                                    </div>
                                    <div>
                                        <div class="item-title" style="font-weight: 600;">${t.category_name || t.description || 'รายการส่วนตัว'}</div>
                                        <div class="item-subtitle">${formatDate(t.date)} ${t.description ? '• ' + t.description : ''}</div>
                                        ${txWallet ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">${txWallet.emoji} ${txWallet.name}</div>` : ''}
                                    </div>
                                </div>
                                <div class="text-right flex align-center gap-2">
                                    <div>
                                        <div class="item-price" style="font-weight: 700; color: ${isIncome ? '#10B981' : '#EF4444'};">
                                            ${isIncome ? '+' : '-'}${formatCurrency(t.amount)}
                                        </div>
                                    </div>
                                    <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 6px; color: #888; border-color: transparent;" onclick="deletePersonalTx(${t.id})" title="ลบรายการ">🗑️</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else if (tab === 'calendar') {
            html += `
                <div class="card mb-3">
                    <div id="personal-calendar-container">
                        <div class="loading">กำลังโหลดปฏิทินส่วนตัว...</div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        if (tab === 'calendar') {
            loadPersonalCalendar(personalCalendarYear, personalCalendarMonth);
        }

    } catch (error) {
        container.innerHTML = `<div class="text-danger text-center">โหลดข้อมูลล้มเหลว: ${error.message}</div>`;
    }
}

function switchPersonalTab(tabName) {
    renderPersonal(tabName);
}

function changePersonalMonth(val) {
    selectedPersonalMonth = val;
    if (val) {
        const parts = val.split('-');
        personalCalendarYear = parseInt(parts[0]);
        personalCalendarMonth = parseInt(parts[1]);
    }
    renderPersonal(currentPersonalTab);
}

// ------------------------------------------------------------------
// ปฏิทินส่วนตัวแบบโต้ตอบ (Interactive Personal Calendar)
// ------------------------------------------------------------------
async function loadPersonalCalendar(year, month) {
    const calendarContainer = document.getElementById('personal-calendar-container');
    if (!calendarContainer) return;

    try {
        const data = await API.Personal.getCalendar(year, month);
        const daysData = data.days || {};

        const monthNames = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ];
        const monthName = monthNames[month - 1];

        const firstDay = new Date(year, month - 1, 1).getDay();
        const daysInMonth = new Date(year, month, 0).getDate();
        const todayStr = getTodayString();

        let gridHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <button class="btn btn-outline btn-sm" onclick="prevPersonalCalendarMonth()">❮ เดือนก่อนหน้า</button>
                <h3 style="margin:0; font-size: 1.1rem;">📅 ${monthName} ${year + 543}</h3>
                <button class="btn btn-outline btn-sm" onclick="nextPersonalCalendarMonth()">เดือนถัดไป ❯</button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; font-weight: bold; margin-bottom: 6px; font-size: 0.85rem; color: #666;">
                <div style="color: var(--danger);">อา</div>
                <div>จ</div>
                <div>อ</div>
                <div>พ</div>
                <div>พฤ</div>
                <div>ศ</div>
                <div style="color: #2563EB;">ส</div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">
        `;

        for (let i = 0; i < firstDay; i++) {
            gridHtml += `<div style="background: #F9FAFB; border-radius: 6px; min-height: 55px; opacity: 0.3;"></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const dayData = daysData[dateStr] || { income: 0, expense: 0, balance: 0 };
            const hasData = dayData.income > 0 || dayData.expense > 0;

            gridHtml += `
                <div onclick="showPersonalDailyDetailsModal('${dateStr}')" style="
                    background: ${isToday ? '#EEF2FF' : hasData ? '#FFFFFF' : '#FAFAFA'};
                    border: ${isToday ? '2px solid var(--primary)' : '1px solid #E5E7EB'};
                    border-radius: 8px;
                    padding: 4px 2px;
                    min-height: 58px;
                    display: flex; flex-direction: column; justify-content: space-between;
                    cursor: pointer; transition: all 0.15s ease; position: relative;
                " onmouseover="this.style.transform='scale(1.03)'; this.style.zIndex='2'" onmouseout="this.style.transform='scale(1)'; this.style.zIndex='1'">
                    <div style="font-size: 0.8rem; font-weight: ${isToday ? 'bold' : '600'}; color: ${isToday ? 'var(--primary)' : '#374151'};">
                        ${day} ${isToday ? '📌' : ''}
                    </div>

                    ${hasData ? `
                        <div style="font-size: 0.65rem; line-height: 1.1;">
                            ${dayData.income > 0 ? `<div style="color: #10B981; font-weight: bold;">+${dayData.income}</div>` : ''}
                            ${dayData.expense > 0 ? `<div style="color: #EF4444; font-weight: bold;">-${dayData.expense}</div>` : ''}
                        </div>
                    ` : `<div style="font-size: 0.65rem; color: #D1D5DB;">-</div>`}
                </div>
            `;
        }

        gridHtml += `</div>
            <div style="margin-top: 10px; text-align: center; font-size: 0.8rem; color: #666;">
                💡 แตะที่ช่องวันในปฏิทินเพื่อกดดูสรุปย้อนหลังรายวัน
            </div>
        `;

        calendarContainer.innerHTML = gridHtml;

    } catch (err) {
        calendarContainer.innerHTML = `<div class="text-danger text-center">โหลดปฏิทินล้มเหลว: ${err.message}</div>`;
    }
}

function prevPersonalCalendarMonth() {
    personalCalendarMonth--;
    if (personalCalendarMonth < 1) {
        personalCalendarMonth = 12;
        personalCalendarYear--;
    }
    loadPersonalCalendar(personalCalendarYear, personalCalendarMonth);
}

function nextPersonalCalendarMonth() {
    personalCalendarMonth++;
    if (personalCalendarMonth > 12) {
        personalCalendarMonth = 1;
        personalCalendarYear++;
    }
    loadPersonalCalendar(personalCalendarYear, personalCalendarMonth);
}

// ------------------------------------------------------------------
// ดูรายละเอียดรายวันส่วนตัว (Daily Details Modal)
// ------------------------------------------------------------------
async function showPersonalDailyDetailsModal(dateStr) {
    const formattedDate = formatDate(dateStr);
    openModal(`${getModalHeader(`📅 รายละเอียดส่วนตัว: ${formattedDate}`)}<div class="loading">กำลังโหลด...</div>`);

    try {
        const details = await API.Personal.getDailyDetails(dateStr);
        const { summary, items } = details;

        const html = `
            ${getModalHeader(`📅 ส่วนตัว: ${formattedDate}`)}
            
            <div class="summary-grid mb-3" style="grid-template-columns: repeat(3, 1fr);">
                <div class="summary-box" style="padding: 8px; background: rgba(16, 185, 129, 0.1); color: #10B981;">
                    <span class="summary-label" style="font-size: 0.7rem;">รายรับ</span>
                    <div style="font-size: 1rem; font-weight: bold;">+${formatCurrency(summary.total_income)}</div>
                </div>
                <div class="summary-box" style="padding: 8px; background: rgba(239, 68, 68, 0.1); color: #EF4444;">
                    <span class="summary-label" style="font-size: 0.7rem;">รายจ่าย</span>
                    <div style="font-size: 1rem; font-weight: bold;">-${formatCurrency(summary.total_expense)}</div>
                </div>
                <div class="summary-box" style="padding: 8px; background: rgba(99, 102, 241, 0.1); color: #6366F1;">
                    <span class="summary-label" style="font-size: 0.7rem;">คงเหลือ</span>
                    <div style="font-size: 1rem; font-weight: bold;">${formatCurrency(summary.balance)}</div>
                </div>
            </div>

            <div class="item-list">
                ${items.length === 0 ? '<p class="text-center text-muted py-3">ไม่มีรายการบันทึกส่วนตัวในวันนี้</p>' : ''}
                ${items.map(t => {
                    const isIncome = t.type === 'income';
                    return `
                        <div class="item-card" style="padding: 10px 12px;">
                            <div class="item-info">
                                <div class="item-emoji" style="background: ${isIncome ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; font-size: 1.3rem; padding: 6px; border-radius: 8px;">
                                    ${t.category_emoji || (isIncome ? '💰' : '💸')}
                                </div>
                                <div>
                                    <div class="item-title" style="font-weight: 600; font-size: 0.9rem;">${t.category_name || 'รายการส่วนตัว'}</div>
                                    <div class="item-subtitle" style="font-size: 0.8rem;">${t.description || '-'}</div>
                                </div>
                            </div>
                            <div class="text-right flex align-center gap-2">
                                <div class="item-price" style="font-weight: 700; color: ${isIncome ? '#10B981' : '#EF4444'}; font-size: 1rem;">
                                    ${isIncome ? '+' : '-'}${formatCurrency(t.amount)}
                                </div>
                                <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 6px; color: #888; border-color: transparent;" onclick="deletePersonalTxInModal(${t.id}, '${dateStr}')" title="ลบรายการ">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        openModal(html);

    } catch (err) {
        openModal(`${getModalHeader('เกิดข้อผิดพลาด')}<div class="text-danger text-center">${err.message}</div>`);
    }
}

async function deletePersonalTxInModal(id, dateStr) {
    if (!confirm('ยืนยันลบรายการนี้?')) return;

    try {
        await API.Personal.deleteTransaction(id);
        showToast('ลบรายการเรียบร้อย');
        showPersonalDailyDetailsModal(dateStr);
        if (currentPersonalTab === 'calendar') {
            loadPersonalCalendar(personalCalendarYear, personalCalendarMonth);
        }
    } catch (error) {
        // handled in fetchAPI
    }
}

// ------------------------------------------------------------------
// สร้างกระเป๋าใหม่
// ------------------------------------------------------------------
function showCreateWalletModal() {
    const walletEmojis = ['👛','🏦','💳','💰','💴','🌟','🎯','🎥','🚗','🍔','🎛️','🍎','📚','🎮','💼'];
    const walletColors = ['#6366F1','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#EC4899','#F97316'];
    let selectedEmoji = '👛';
    let selectedColor = '#6366F1';

    const html = `
        ${getModalHeader('➕ สร้างกระเป๋าเงินใหม่')}
        <form id="formCreateWallet" onsubmit="submitCreateWallet(event)">
            <div class="form-group">
                <label class="form-label">ชื่อกระเป๋า</label>
                <input type="text" name="name" class="form-control" placeholder="เช่น ไปคอนเสิร์ต, เงินเพื่อน" required autofocus>
            </div>

            <div class="form-group">
                <label class="form-label">ยอดเงินตั้งต้น (บาท)</label>
                <input type="number" name="initial_balance" class="form-control" placeholder="0" min="0" step="1" value="0">
            </div>

            <div class="form-group">
                <label class="form-label">อิโมจิกระเป๋า</label>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${walletEmojis.map(em => `
                        <button type="button" id="emoji-btn-${em}" onclick="selectWalletEmoji('${em}')" style="
                            width: 40px; height: 40px; font-size: 1.4rem; border-radius: 8px; border: 2px solid ${em === selectedEmoji ? 'var(--primary)' : '#E5E7EB'};
                            background: ${em === selectedEmoji ? 'var(--primary-light, #EEF2FF)' : 'white'}; cursor: pointer;
                        ">${em}</button>
                    `).join('')}
                </div>
                <input type="hidden" name="emoji" id="wallet-emoji-input" value="${selectedEmoji}">
            </div>

            <div class="form-group">
                <label class="form-label">สีกระเป๋า</label>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    ${walletColors.map(c => `
                        <button type="button" id="color-btn-${c.replace('#','')}"
                            onclick="selectWalletColor('${c}')"
                            style="width: 32px; height: 32px; border-radius: 50%; background: ${c}; border: 3px solid ${c === selectedColor ? '#1e293b' : 'transparent'}; cursor: pointer;"
                        ></button>
                    `).join('')}
                </div>
                <input type="hidden" name="color" id="wallet-color-input" value="${selectedColor}">
            </div>

            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:1rem;">✅ สร้างกระเป๋า</button>
        </form>
    `;
    openModal(html);
}

function selectWalletEmoji(emoji) {
    document.getElementById('wallet-emoji-input').value = emoji;
    document.querySelectorAll('[id^="emoji-btn-"]').forEach(b => {
        b.style.border = '2px solid #E5E7EB';
        b.style.background = 'white';
    });
    const btn = document.getElementById(`emoji-btn-${emoji}`);
    if (btn) { btn.style.border = '2px solid var(--primary)'; btn.style.background = '#EEF2FF'; }
}

function selectWalletColor(color) {
    document.getElementById('wallet-color-input').value = color;
    document.querySelectorAll('[id^="color-btn-"]').forEach(b => b.style.border = '3px solid transparent');
    const safeId = color.replace('#','');
    const btn = document.getElementById(`color-btn-${safeId}`);
    if (btn) btn.style.border = '3px solid #1e293b';
}

async function submitCreateWallet(event) {
    event.preventDefault();
    const form = event.target;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'กำลังสร้าง...';
    try {
        await API.Personal.createWallet({
            name: form.name.value,
            emoji: form.emoji.value,
            initial_balance: parseFloat(form.initial_balance.value) || 0,
            color: form.color.value
        });
        showToast('สร้างกระเป๋าเรียบร้อย!');
        closeModal();
        renderPersonal(currentPersonalTab);
    } catch (e) {
        btn.disabled = false;
        btn.textContent = '✅ สร้างกระเป๋า';
    }
}

async function deleteWallet(id, name) {
    if (!confirm(`ลบกระเป๋า "${name}" ?
รายการที่อยู่ในกระเป๋านี้จะถูกบันทึกไว้แต่ไม่มีกระเป๋า`)) return;
    try {
        await API.Personal.deleteWallet(id);
        showToast('ลบกระเป๋าเรียบร้อย');
        renderPersonal(currentPersonalTab);
    } catch (e) { /* handled */ }
}

function openQuickAddPersonalModal(catId) {
    const cat = personalCategories.find(c => c.id === catId);
    if (!cat) return;

    const isIncome = cat.type === 'income';

    const html = `
        ${getModalHeader(`${cat.emoji} ${cat.name}`)}
        <form id="formQuickPersonal" onsubmit="submitPersonalTx(event)">
            <input type="hidden" name="category_id" value="${cat.id}">
            <input type="hidden" name="type" value="${cat.type}">
            
            <div class="form-group text-center">
                <label class="form-label" style="font-size: 0.9rem; color: var(--text-muted);">จำนวนเงิน (${isIncome ? 'รายรับ' : 'รายจ่าย'})</label>
                <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                    <span style="font-size: 1.8rem; font-weight: bold; color: ${isIncome ? '#10B981' : '#EF4444'};">฿</span>
                    <input type="number" name="amount" id="personal-amount-input" class="form-control text-center" 
                        style="font-size: 2rem; font-weight: bold; height: 60px; color: ${isIncome ? '#10B981' : '#EF4444'}; border-color: ${isIncome ? '#10B981' : '#EF4444'};" 
                        required min="0.5" step="0.5" placeholder="0" autofocus>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">หมายเหตุเพิ่มเติม (ถ้ามี)</label>
                <input type="text" name="description" class="form-control" placeholder="เช่น ก๋วยเตี๋ยว / ค่ารถเมล์">
            </div>

            <div class="form-group">
                <label class="form-label">วันที่</label>
                <input type="date" name="date" class="form-control" value="${getTodayString()}" required>
            </div>

            <button type="submit" class="btn" style="
                width: 100%; padding: 12px; font-size: 1.1rem; font-weight: bold; margin-top: 1rem;
                background: ${isIncome ? '#10B981' : '#EF4444'}; color: white; border: none; border-radius: 8px;
            ">
                ✅ บันทึก ${cat.name}
            </button>
        </form>
    `;

    openModal(html);
    setTimeout(() => {
        const input = document.getElementById('personal-amount-input');
        if (input) input.focus();
    }, 100);
}

async function submitPersonalTx(event) {
    event.preventDefault();
    const form = event.target;
    const btn = form.querySelector('button[type="submit"]');

    // ดึง wallet_id จาก radio หรือ hidden input
    const walletRadio = form.querySelector('input[name="wallet_id"]:checked') || form.querySelector('input[name="wallet_id"]');
    const walletId = walletRadio ? parseInt(walletRadio.value) || null : null;

    const data = {
        wallet_id: walletId,
        category_id: parseInt(form.category_id.value),
        type: form.type.value,
        amount: parseFloat(form.amount.value),
        description: form.description.value,
        date: form.date.value
    };

    btn.disabled = true;
    btn.textContent = 'กำลังบันทึก...';

    try {
        await API.Personal.createTransaction(data);
        showToast('บันทึกเรียบร้อย!');
        closeModal();
        renderPersonal(currentPersonalTab);
    } catch (error) {
        btn.disabled = false;
        btn.textContent = 'บันทึก';
    }
}

async function deletePersonalTx(id) {
    if (!confirm('ยืนยันลบรายการนี้?')) return;

    try {
        await API.Personal.deleteTransaction(id);
        showToast('ลบรายการเรียบร้อย');
        renderPersonal(currentPersonalTab);
    } catch (error) {
        // error handling inside fetchAPI
    }
}
