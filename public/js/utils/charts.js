// ============================================================
// utils/charts.js — ตั้งค่าและวาดกราฟ
// ============================================================

// ตัวแปรเก็บกราฟที่กำลังวาดอยู่
let dailyChartInstance = null;

// วาดกราฟยอดขาย 7 วันล่าสุด
function renderDailyChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    // เรียงวันที่จากอดีตไปปัจจุบัน
    const sortedData = [...data].reverse();
    
    const labels = sortedData.map(d => d.day_name);
    const sales = sortedData.map(d => d.sales);
    const expenses = sortedData.map(d => d.expenses);
    
    // ถ้ามีกราฟเก่าอยู่ให้ทำลายทิ้งก่อนวาดใหม่
    if (dailyChartInstance) {
        dailyChartInstance.destroy();
    }
    
    // สีของธีม
    const primaryColor = '#4F46E5';
    const secondaryColor = '#10B981';
    
    dailyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'ยอดขาย',
                    data: sales,
                    backgroundColor: primaryColor,
                    borderRadius: 4,
                },
                {
                    label: 'รายจ่าย',
                    data: expenses,
                    backgroundColor: secondaryColor,
                    borderRadius: 4,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { family: "'Prompt', sans-serif" }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '฿' + value;
                        },
                        font: { family: "'Prompt', sans-serif" }
                    }
                },
                x: {
                    ticks: { font: { family: "'Prompt', sans-serif" } }
                }
            }
        }
    });
}
