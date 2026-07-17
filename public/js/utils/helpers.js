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
