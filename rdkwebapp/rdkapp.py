from flask import Flask, render_template, Response, jsonify
import cv2
import threading
import time
from collections import deque
import json
import os
import subprocess
from ultralytics import YOLO
import numpy as np
from datetime import datetime, timedelta

app = Flask(__name__)

# 加载YOLOv8模型
model = YOLO('rdkyolov8/weights/yolov8n.pt') 

# 主摄像头（默认摄像头）
main_camera = cv2.VideoCapture(0)

# 存储人数历史数据
people_history = deque(maxlen=300)  
timestamps = deque(maxlen=300)
current_count = 0
peak_count = 0
start_time = time.time()
total_people_entered = 0  # 总进入人数统计
frame_count = 0
last_count = 0  # 上一帧的人数

# 用于存储每小时和每日统计数据
hourly_counts = {}
daily_counts = {}

# 用于停止视频流的标志
stream_active = True

def update_statistics(person_count):
    """更新统计数据"""
    global current_count, peak_count, total_people_entered, frame_count, hourly_counts, daily_counts, last_count
    
    # 更新当前计数
    current_count = person_count
    
    # 更新峰值计数
    peak_count = max(peak_count, person_count)
    
    # 更新总进入人数统计（只计算新增的人数）
    if person_count > last_count:
        total_people_entered += (person_count - last_count)
    last_count = person_count
    
    frame_count += 1
    
    # 更新每小时统计
    now = datetime.now()
    current_hour = now.replace(minute=0, second=0, microsecond=0)
    if current_hour not in hourly_counts:
        hourly_counts[current_hour] = {'count': 0, 'samples': 0}
    hourly_counts[current_hour]['count'] += person_count
    hourly_counts[current_hour]['samples'] += 1
    
    # 更新每日统计
    current_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if current_day not in daily_counts:
        daily_counts[current_day] = {'count': 0, 'samples': 0}
    daily_counts[current_day]['count'] += person_count
    daily_counts[current_day]['samples'] += 1

def generate_main_frames():
    """生成主摄像头视频帧"""
    global current_count, peak_count, total_people_entered, frame_count
    
    while stream_active:
        # 从摄像头读取帧
        success, frame = main_camera.read()
        if not success:
            break
        else:
            # 使用YOLOv8进行人物检测
            results = model(frame, classes=[0], verbose=False)  # 0是person类的ID
            person_count = len(results[0].boxes)
            
            # 更新统计数据
            update_statistics(person_count)
            
            # 记录数据
            now = time.time()
            people_history.append(person_count)
            timestamps.append(now)
            
            # 在帧上绘制检测结果和人数信息
            annotated_frame = results[0].plot()
            cv2.putText(annotated_frame, f"People: {person_count}", (20, 40), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            
            # 转换为JPEG格式
            ret, buffer = cv2.imencode('.jpg', annotated_frame)
            frame = buffer.tobytes()
            
            # 生成帧
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/')
def index():
    """主页面"""
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    """主视频流路由"""
    return Response(generate_main_frames(), 
                   mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/data')
def get_data():
    """获取统计数据的API"""
    global start_time, current_count, peak_count, total_people_entered, frame_count, people_history, timestamps
    
    # 计算运行时间
    elapsed = time.time() - start_time
    minutes = int(elapsed // 60)
    seconds = int(elapsed % 60)
    uptime = f"{minutes}:{seconds:02d}"
    
    # 准备图表数据
    labels = [time.strftime("%H:%M:%S", time.localtime(ts)) for ts in timestamps]
    
    # 计算统计数据
    avg_count = np.mean(people_history) if people_history else 0
    min_count = min(people_history) if people_history else 0
    max_count = max(people_history) if people_history else 0
    
    # 计算峰值时间
    peak_time = "N/A"
    if people_history:
        peak_index = np.argmax(people_history)
        if peak_index < len(timestamps):
            peak_time = time.strftime("%H:%M:%S", time.localtime(timestamps[peak_index]))
    
    # 计算趋势 (最近30秒与之前30秒的比较)
    trend = "stable"
    if len(people_history) > 60:
        recent_avg = np.mean(list(people_history)[-30:])
        prev_avg = np.mean(list(people_history)[-60:-30])
        if recent_avg > prev_avg + 1:
            trend = "increasing"
        elif recent_avg < prev_avg - 1:
            trend = "decreasing"
    
    # 计算平均人数密度
    avg_density = np.mean(people_history) if people_history else 0
    
    return jsonify({
        'current': current_count,
        'peak': peak_count,
        'peak_time': peak_time,
        'average': round(avg_count, 1),
        'minimum': min_count,
        'maximum': max_count,
        'total_entered': total_people_entered,  # 修改为总进入人数
        'density': round(avg_density, 2),
        'trend': trend,
        'fps': 25,  # 模拟帧率
        'uptime': uptime,
        'chart_data': {
            'labels': labels,
            'values': list(people_history)
        }
    })

@app.route('/hourly_data')
def get_hourly_data():
    """获取实际的小时统计数据"""
    now = datetime.now()
    hourly_data = []
    
    # 获取过去12小时的数据
    for i in range(12):
        hour = now - timedelta(hours=i)
        hour_key = hour.replace(minute=0, second=0, microsecond=0)
        
        if hour_key in hourly_counts:
            avg_count = hourly_counts[hour_key]['count'] / hourly_counts[hour_key]['samples']
            hourly_data.append({
                'hour': hour_key.strftime("%H:00"),
                'count': round(avg_count, 1)
            })
        else:
            hourly_data.append({
                'hour': hour_key.strftime("%H:00"),
                'count': 0
            })
    
    return jsonify(hourly_data[::-1])  # 反转使最新数据在最后

@app.route('/daily_data')
def get_daily_data():
    """获取实际的日统计数据"""
    now = datetime.now()
    daily_data = []
    
    # 获取过去7天的数据
    for i in range(7):
        day = now - timedelta(days=i)
        day_key = day.replace(hour=0, minute=0, second=0, microsecond=0)
        
        if day_key in daily_counts:
            avg_count = daily_counts[day_key]['count'] / daily_counts[day_key]['samples']
            daily_data.append({
                'day': day_key.strftime("%Y-%m-%d"),
                'count': round(avg_count, 1)
            })
        else:
            daily_data.append({
                'day': day_key.strftime("%Y-%m-%d"),
                'count': 0
            })
    
    return jsonify(daily_data[::-1])

@app.route('/reset', methods=['POST'])
def reset_data():
    """重置统计数据"""
    global people_history, timestamps, peak_count, start_time, total_people_entered, frame_count, hourly_counts, daily_counts, last_count
    people_history = deque(maxlen=300)
    timestamps = deque(maxlen=300)
    peak_count = 0
    total_people_entered = 0
    frame_count = 0
    last_count = 0
    start_time = time.time()
    hourly_counts = {}
    daily_counts = {}
    return jsonify(success=True)

if __name__ == '__main__':
    # 在实际部署中，使用生产服务器如Gunicorn
    app.run(host='0.0.0.0', port=5000, threaded=True)