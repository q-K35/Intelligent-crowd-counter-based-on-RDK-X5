// 在原有JavaScript基础上，更新以下内容

// 初始化所有图表
function initCharts() {
    // 实时人数图表
    const peopleCtx = document.getElementById('peopleChart').getContext('2d');
    const peopleChart = new Chart(peopleCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '实时人数',
                data: [],
                borderColor: '#4e73df',
                backgroundColor: 'rgba(78, 115, 223, 0.05)',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: getChartOptions('人数')
    });

    // 分布图表
    const distributionCtx = document.getElementById('distributionChart').getContext('2d');
    const distributionChart = new Chart(distributionCtx, {
        type: 'bar',
        data: {
            labels: ['0人', '1人', '2人', '3人', '4人', '5人+'],
            datasets: [{
                label: '出现频率',
                data: [0, 0, 0, 0, 0, 0],
                backgroundColor: 'rgba(78, 115, 223, 0.8)',
                borderColor: 'rgba(78, 115, 223, 1)',
                borderWidth: 1
            }]
        },
        options: getChartOptions('频率', false)
    });

    // 小时图表
    const hourlyCtx = document.getElementById('hourlyChart').getContext('2d');
    const hourlyChart = new Chart(hourlyCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '每小时平均人数',
                data: [],
                borderColor: '#1cc88a',
                backgroundColor: 'rgba(28, 200, 138, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: getChartOptions('人数')
    });

    // 日图表
    const dailyCtx = document.getElementById('dailyChart').getContext('2d');
    const dailyChart = new Chart(dailyCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: '每日总人数',
                data: [],
                backgroundColor: 'rgba(78, 115, 223, 0.8)',
                borderColor: 'rgba(78, 115, 223, 1)',
                borderWidth: 1
            }]
        },
        options: getChartOptions('人数', false)
    });

    return { peopleChart, distributionChart, hourlyChart, dailyChart };
}

// 通用图表配置
function getChartOptions(title, showLegend = true) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: showLegend,
                position: 'top',
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: title
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    };
}

// 更新分布图表数据
function updateDistributionChart(chart, history) {
    if (!history || history.length === 0) return;
    
    const counts = [0, 0, 0, 0, 0, 0]; // 0, 1, 2, 3, 4, 5+
    
    history.forEach(count => {
        if (count <= 4) {
            counts[count]++;
        } else {
            counts[5]++;
        }
    });
    
    // 转换为百分比
    const total = history.length;
    const percentages = counts.map(c => Math.round((c / total) * 100));
    
    chart.data.datasets[0].data = percentages;
    chart.update();
}

// 更新所有数据
async function updateAllData() {
    try {
        // 获取实时数据
        const dataResponse = await fetch('/data');
        const data = await dataResponse.json();
        
        // 更新基础统计
        document.getElementById('currentCount').textContent = data.current;
        document.getElementById('peakCount').textContent = data.peak;
        document.getElementById('totalCount').textContent = data.total;
        document.getElementById('density').textContent = data.density.toFixed(2);
        
        // 更新趋势
        const trendElem = document.getElementById('trend');
        trendElem.textContent = 
            data.trend === 'increasing' ? '上升 ↑' :
            data.trend === 'decreasing' ? '下降 ↓' : '稳定 →';
        trendElem.className = `trend-indicator ${
            data.trend === 'increasing' ? 'trend-up' :
            data.trend === 'decreasing' ? 'trend-down' : 'trend-stable'
        }`;
        
        // 更新实时图表
        charts.peopleChart.data.labels = data.chart_data.labels;
        charts.peopleChart.data.datasets[0].data = data.chart_data.values;
        charts.peopleChart.update();
        
        // 更新分布图表
        updateDistributionChart(charts.distributionChart, data.chart_data.values);
        
        // 获取小时数据
        const hourlyResponse = await fetch('/hourly_data');
        const hourlyData = await hourlyResponse.json();
        
        // 更新小时图表
        charts.hourlyChart.data.labels = hourlyData.map(item => item.hour);
        charts.hourlyChart.data.datasets[0].data = hourlyData.map(item => item.count);
        charts.hourlyChart.update();
        
        // 获取日数据
        const dailyResponse = await fetch('/daily_data');
        const dailyData = await dailyResponse.json();
        
        // 更新日图表
        charts.dailyChart.data.labels = dailyData.map(item => item.day);
        charts.dailyChart.data.datasets[0].data = dailyData.map(item => item.count);
        charts.dailyChart.update();
        
    } catch (error) {
        console.error('数据更新失败:', error);
    }
}

// 初始化图表
const charts = initCharts();

// 每3秒更新一次数据
setInterval(updateAllData, 3000);
updateAllData(); // 初始加载