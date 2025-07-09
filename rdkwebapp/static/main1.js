// 初始化图表
const ctx = document.getElementById('peopleChart').getContext('2d');
const peopleChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: '检测人数',
            data: [],
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: '#2E7D32',
            tension: 0.4,
            fill: true
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                titleFont: {
                    size: 14
                },
                bodyFont: {
                    size: 13
                },
                padding: 12
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: '人数',
                    font: {
                        size: 14,
                        weight: 'bold'
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                }
            },
            x: {
                title: {
                    display: true,
                    text: '时间',
                    font: {
                        size: 14,
                        weight: 'bold'
                    }
                },
                grid: {
                    display: false
                }
            }
        },
        animation: {
            duration: 300
        }
    }
});

// 更新统计数据
function updateStats(data) {
    document.getElementById('currentCount').textContent = data.current;
    document.getElementById('peakCount').textContent = data.peak;
    document.getElementById('fps').textContent = data.fps;
    document.getElementById('uptime').textContent = data.uptime;
    
    // 更新图表
    peopleChart.data.labels = data.chart_data.labels;
    peopleChart.data.datasets[0].data = data.chart_data.values;
    peopleChart.update();
}

// 从后端获取数据
function fetchData() {
    fetch('/data')
        .then(response => response.json())
        .then(data => {
            updateStats(data);
        })
        .catch(error => {
            console.error('获取数据失败:', error);
        });
}

// 初始化事件监听器
document.addEventListener('DOMContentLoaded', function() {
    // 每2秒获取一次数据
    setInterval(fetchData, 2000);
    
    // 重置按钮
    document.getElementById('resetBtn').addEventListener('click', function() {
        if (confirm('确定要重置所有统计数据吗？')) {
            fetch('/reset', {
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // 重置前端显示
                    document.getElementById('peakCount').textContent = '0';
                    peopleChart.data.labels = [];
                    peopleChart.data.datasets[0].data = [];
                    peopleChart.update();
                }
            });
        }
    });
    
    // 快照按钮
    document.getElementById('snapshotBtn').addEventListener('click', function() {
        alert('快照功能已触发！在实际应用中，此操作将保存当前画面。');
    });
    
    // 开始/停止按钮
    document.getElementById('startBtn').addEventListener('click', function() {
        const icon = this.querySelector('i');
        if (icon.classList.contains('fa-play')) {
            icon.classList.remove('fa-play');
            icon.classList.add('fa-pause');
            this.innerHTML = '<i class="fas fa-pause"></i> 暂停检测';
        } else {
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
            this.innerHTML = '<i class="fas fa-play"></i> 开始检测';
        }
    });
});
