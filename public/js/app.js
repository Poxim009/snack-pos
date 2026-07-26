// ============================================================
// app.js — ตัวควบคุมหลักของแอป
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // แสดงวันที่ปัจจุบันที่ Header
    document.getElementById('currentDate').textContent = formatDate(getTodayString());

    // การทำงานของเมนูด้านล่าง (Navigation)
    const navButtons = document.querySelectorAll('.nav-btn');
    const pages = document.querySelectorAll('.page');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetPage = btn.getAttribute('data-page');
            
            // เปลี่ยนปุ่ม Active
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // ซ่อนหน้าทั้งหมด แล้วแสดงเฉพาะหน้าที่เลือก
            pages.forEach(p => p.classList.remove('active'));
            document.getElementById(`page-${targetPage}`).classList.add('active');
            
            // โหลดข้อมูลตามหน้าที่เปิด
            loadPageData(targetPage);
        });
    });

    // โหลดหน้าแรก (Dashboard) ทันทีที่แอปเปิด
    loadPageData('dashboard');
});

// ฟังก์ชันสำหรับเรียกโหลดข้อมูลของแต่ละหน้า
function loadPageData(pageName) {
    switch (pageName) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'sales':
            renderSales();
            break;
        case 'expenses':
            renderExpenses();
            break;
        case 'analytics':
            renderAnalytics();
            break;
        case 'debts':
            renderDebts();
            break;
        case 'personal':
            renderPersonal();
            break;
        case 'settings':
            renderSettings();
            break;
    }
}
