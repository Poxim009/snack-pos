// ============================================================
// utils/helpers.js — ฟังก์ชันตัวช่วยต่างๆ
// ============================================================

// แปลงตัวเลขเป็น format เงินบาท (เช่น 1,234.00)
function formatCurrency(amount) {
    return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// แปลงวันที่ YYYY-MM-DD เป็น วัน/เดือน/ปี ไทย (เช่น 17/07/69)
function formatDate(dateString) {
    if (!dateString) return '-';
    // รองรับกรณี dateString มีเวลาติดมาด้วย
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-');
    
    // แปลง ค.ศ. เป็น พ.ศ. แบบย่อ
    const thaiYear = (parseInt(year) + 543).toString().slice(-2);
    return `${day}/${month}/${thaiYear}`;
}

// เอาวันที่ปัจจุบัน YYYY-MM-DD
function getTodayString() {
    const d = new Date();
    // ทำให้เป็นเวลา local
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
}

// แสดง Toast (ข้อความแจ้งเตือนมุมจอบน)
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // ลบ toast ทิ้งหลัง 3 วินาที
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px) scale(0.9)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// จัดการ Modal
function openModal(contentHtml) {
    const overlay = document.getElementById('modalOverlay');
    const content = document.getElementById('modalContent');
    content.innerHTML = contentHtml;
    overlay.classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

// ตั้ง event ปิด modal เมื่อคลิกพื้นหลัง
document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
});

// โหลด HTML สำหรับ Header Modal
function getModalHeader(title) {
    return `
        <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
    `;
}

// สร้าง Custom Dropdown สำหรับเลือกลูกค้า (โชว์รูปโปรไฟล์ได้)
function renderCustomCustomerSelect(customers, inputName = 'customer_id') {
    const defaultText = 'เลือกลูกค้า...';
    
    // ซ่อน Dropdown ถ้าคลิกที่อื่น
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.custom-select-container')) {
            document.querySelectorAll('.custom-select-options').forEach(el => el.style.display = 'none');
        }
    });

    let optionsHtml = customers.map(c => {
        const imgHtml = c.picture_url 
            ? `<img src="${c.picture_url}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">` 
            : `<div style="width: 24px; height: 24px; border-radius: 50%; background: var(--bg-body); display: flex; align-items: center; justify-content: center; font-size: 12px;">👤</div>`;
        const lineBadge = c.is_line_friend ? `<span style="color: #00B900; font-size: 0.7rem; margin-left: 5px;">🟢 ผูก LINE แล้ว</span>` : '';
        
        return `
            <div class="custom-select-option flex align-center gap-2" data-value="${c.id}" data-name="${c.display_name}">
                ${imgHtml}
                <div>
                    <div>${c.display_name}</div>
                    ${lineBadge}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="custom-select-container" style="position: relative; width: 100%;">
            <input type="hidden" name="${inputName}" id="hidden_${inputName}" required>
            <div class="form-control flex justify-between align-center" id="customSelectHeader_${inputName}" style="cursor: pointer; background: var(--bg-card);" onclick="document.getElementById('customSelectOptions_${inputName}').style.display = document.getElementById('customSelectOptions_${inputName}').style.display === 'block' ? 'none' : 'block'">
                <span id="customSelectText_${inputName}" class="text-muted">${defaultText}</span>
                <span>▼</span>
            </div>
            <div id="customSelectOptions_${inputName}" class="custom-select-options" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); max-height: 250px; overflow-y: auto; z-index: 100; box-shadow: var(--shadow-md); margin-top: 5px;">
                ${optionsHtml}
            </div>
        </div>
        <script>
            // Script เล็กๆ ไว้จัดการการคลิกเลือก Option
            document.querySelectorAll('#customSelectOptions_${inputName} .custom-select-option').forEach(opt => {
                opt.addEventListener('click', function() {
                    const val = this.getAttribute('data-value');
                    const name = this.getAttribute('data-name');
                    const imgHtml = this.querySelector('img, div').outerHTML;
                    
                    document.getElementById('hidden_${inputName}').value = val;
                    document.getElementById('customSelectText_${inputName}').innerHTML = '<div class="flex align-center gap-2">' + imgHtml + '<span>' + name + '</span></div>';
                    document.getElementById('customSelectText_${inputName}').classList.remove('text-muted');
                    document.getElementById('customSelectOptions_${inputName}').style.display = 'none';
                });
            });
        </script>
    `;
}

// อัปโหลดรูปหลักฐาน
async function uploadEvidenceImage(fileInput, previewId, hiddenInputId) {
    if (!fileInput.files || fileInput.files.length === 0) return;
    
    const file = fileInput.files[0];
    const previewEl = document.getElementById(previewId);
    const hiddenEl = document.getElementById(hiddenInputId);
    
    // โชว์พรีวิวคร่าวๆ ระหว่างอัปโหลด
    previewEl.style.display = 'block';
    previewEl.src = URL.createObjectURL(file);
    previewEl.style.opacity = '0.5';
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if (data.success) {
            hiddenEl.value = data.url;
            previewEl.style.opacity = '1';
            showToast('อัปโหลดรูปหลักฐานสำเร็จ!');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        alert('อัปโหลดรูปล้มเหลว: ' + error.message);
        previewEl.style.display = 'none';
        hiddenEl.value = '';
        fileInput.value = '';
    }
}
