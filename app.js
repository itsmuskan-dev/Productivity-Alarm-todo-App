/**
 * App Shell Controller
 * Orchestrates views, tracks task intervals, manages state transitions, and integrates PWA APIs.
 */

let activeAlarmTask = null;
let customAudioBinary = null;

document.addEventListener('DOMContentLoaded', () => {
    AppController.init();
    NotificationEngine.requestPermission();
});

const AppController = {
    init() {
        this.bindNavigation();
        this.bindModals();
        this.bindForms();
        this.bindAlarmControls();
        this.startEngineTick();
        this.renderDashboard();
        this.renderDate();
    },

    renderDate() {
        const options = { weekday: 'long', month: 'short', day: 'numeric' };
        document.getElementById('currentDateStr').innerText = new Date().toLocaleDateString('en-US', options);
    },

    bindNavigation() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.getAttribute('data-target');
                
                document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
                
                e.currentTarget.classList.add('active');
                document.getElementById(target).classList.add('active');
            });
        });

        document.getElementById('themeToggle').addEventListener('click', () => {
            const html = document.documentElement;
            const currentTheme = html.getAttribute('data-theme');
            const targetTheme = currentTheme === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', targetTheme);
            document.getElementById('themeToggle').innerHTML = targetTheme === 'dark' ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon"></i>';
        });
    },

    bindModals() {
        const modal = document.getElementById('taskModal');
        document.getElementById('openTaskModalBtn').addEventListener('click', () => {
            AlarmAudioEngine.init(); // Warm up context via user interaction gesture
            modal.classList.add('open');
            // Set current time + 1 min as default input value
            const now = new Date();
            now.setMinutes(now.getMinutes() + 1);
            document.getElementById('taskDatetime').value = now.toISOString().slice(0,16);
        });
        document.getElementById('closeTaskModalBtn').addEventListener('click', () => modal.classList.remove('open'));
        
        document.getElementById('alarmTone').addEventListener('change', (e) => {
            const group = document.getElementById('customAudioGroup');
            if(e.target.value === 'custom') group.classList.remove('hidden');
            else group.classList.add('hidden');
        });

        document.getElementById('customAudioFile').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if(file) {
                await AlarmAudioEngine.setCustomAudio(file);
            }
        });
    },

    bindForms() {
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const newTask = {
                id: 'task_' + Date.now(),
                title: document.getElementById('taskTitle').value,
                desc: document.getElementById('taskDesc').value,
                datetime: document.getElementById('taskDatetime').value,
                priority: document.getElementById('taskPriority').value,
                category: document.getElementById('taskCategory').value,
                tone: document.getElementById('alarmTone').value,
                status: 'pending'
            };

            StorageEngine.save(newTask);
            document.getElementById('taskForm').reset();
            document.getElementById('customAudioGroup').classList.add('hidden');
            document.getElementById('taskModal').classList.remove('open');
            
            this.renderDashboard();
        });
    },

    bindAlarmControls() {
        document.getElementById('alarmDismissBtn').addEventListener('click', () => {
            if (activeAlarmTask) {
                activeAlarmTask.status = 'completed';
                StorageEngine.save(activeAlarmTask);
                this.stopAlarmLifecycle();
            }
        });

        document.getElementById('alarmSnoozeBtn').addEventListener('click', () => {
            if (activeAlarmTask) {
                const now = new Date();
                now.setMinutes(now.getMinutes() + 5); // 5 min increment fallback
                activeAlarmTask.datetime = now.toISOString();
                activeAlarmTask.status = 'pending';
                StorageEngine.save(activeAlarmTask);
                this.stopAlarmLifecycle();
            }
        });
    },

    stopAlarmLifecycle() {
        AlarmAudioEngine.stop();
        if (navigator.vibrate) navigator.vibrate(0);
        document.getElementById('alarmOverlay').classList.remove('triggered');
        activeAlarmTask = null;
        this.renderDashboard();
    },

    startEngineTick() {
        setInterval(() => {
            const tasks = StorageEngine.getAll();
            const nowMs = Date.now();
            let stateMutated = false;

            tasks.forEach(task => {
                const taskMs = new Date(task.datetime).getTime();
                
                // Trigger condition check
                if (task.status === 'pending' && nowMs >= taskMs) {
                    this.fireAlarmIntercept(task);
                } 
                // Auto-miss transition threshold edge case
                else if (task.status === 'pending' && (nowMs - taskMs) > 600000 && !activeAlarmTask) {
                    task.status = 'missed';
                    stateMutated = true;
                }
            });

            if (stateMutated) this.renderDashboard();
        }, 1000);
    },

    fireAlarmIntercept(task) {
        if (activeAlarmTask && activeAlarmTask.id === task.id) return; // Already intercepting
        
        activeAlarmTask = task;
        
        // Render Meta Layer
        document.getElementById('alarmMetaPriority').innerText = `${task.priority.toUpperCase()} ACTION SEGMENT`;
        document.getElementById('alarmMetaPriority').className = `prio-tag text-${task.priority}`;
        document.getElementById('alarmMetaTitle').innerText = task.title;
        document.getElementById('alarmMetaDesc').innerText = task.desc || 'No context attached.';
        document.getElementById('alarmMetaTime').innerText = new Date(task.datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        // Trigger Layout Mechanics
        document.getElementById('alarmOverlay').classList.add('triggered');
        
        // Fire Engines
        AlarmAudioEngine.start(task.tone);
        NotificationEngine.send(task.title, task.desc);
        
        if (navigator.vibrate) {
            navigator.vibrate([500, 250, 500, 250, 500]);
        }
    },

    renderDashboard() {
        const tasks = StorageEngine.getAll();
        
        const activeContainer = document.getElementById('activeTasksContainer');
        const missedContainer = document.getElementById('missedTasksContainer');
        const historyContainer = document.getElementById('historyTasksContainer');

        activeContainer.innerHTML = '';
        missedContainer.innerHTML = '';
        historyContainer.innerHTML = '';

        let counts = { completed: 0, pending: 0, missed: 0 };

        tasks.forEach(task => {
            counts[task.status]++;
            const node = this.createTaskDOMNode(task);

            if (task.status === 'pending') activeContainer.appendChild(node);
            else if (task.status === 'missed') missedContainer.appendChild(node);
            else historyContainer.appendChild(node);
        });

        // Update stats
        document.getElementById('countCompleted').innerText = counts.completed;
        document.getElementById('countPending').innerText = counts.pending;
        document.getElementById('countMissed').innerText = counts.missed;
        document.getElementById('activeTasksBadge').innerText = counts.pending;

        const total = counts.completed + counts.pending + counts.missed;
        const ratio = total > 0 ? Math.round((counts.completed / total) * 100) : 0;
        document.getElementById('progressPercentage').innerText = `${ratio}%`;
        document.getElementById('progressFill').style.width = `${ratio}%`;
    },

    createTaskDOMNode(task) {
        const el = document.createElement('div');
        el.className = `task-item state-${task.status}`;
        
        const dateObj = new Date(task.datetime);
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

        el.innerHTML = `
            <div class="task-left">
                <div class="task-checkbox-wrapper">
                    <button class="task-checkbox-trigger" onclick="AppController.toggleTaskCompletion('${task.id}')">
                        <i class="bi bi-check-lg"></i>
                    </button>
                </div>
                <div class="task-details">
                    <span class="task-title-line">${task.title}</span>
                    ${task.desc ? `<span class="task-desc-line">${task.desc}</span>` : ''}
                    <div class="task-meta-row">
                        <span class="task-time-badge"><i class="bi bi-alarm"></i> ${dateStr} @ ${timeStr}</span>
                        <span class="prio-tag ${task.priority}">${task.priority}</span>
                        <span class="category-tag">${task.category}</span>
                    </div>
                </div>
            </div>
            <div class="task-right">
                <button class="delete-task-btn" onclick="AppController.removeTask('${task.id}')"><i class="bi bi-trash3-fill"></i></button>
            </div>
        `;
        return el;
    },

    toggleTaskCompletion(id) {
        const tasks = StorageEngine.getAll();
        const task = tasks.find(t => t.id === id);
        if(task) {
            task.status = task.status === 'completed' ? 'pending' : 'completed';
            StorageEngine.save(task);
            this.renderDashboard();
        }
    },

    removeTask(id) {
        StorageEngine.delete(id);
        this.renderDashboard();
    }
};

const NotificationEngine = {
    requestPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    },
    send(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`AURA: ${title}`, {
                body: body || 'Action required immediately.',
                icon: 'icons/icon-192.png',
                tag: 'aura-alert-intercept',
                requireInteraction: true
            });
        }
    }
};