const app = () => {
    // --- Pomodoro State ---
    const WORK_MINUTES = 25;
    const BREAK_MINUTES = 5;
    let timeRemaining = WORK_MINUTES * 60;
    let timerInterval = null;
    let isWorkMode = true;

    let sessionsCompleted = 0;
    try {
        sessionsCompleted = parseInt(localStorage.getItem('pomodoroSessions')) || 0;
    } catch (e) {
        console.warn('localStorage not accessible for sessions. State will not persist.');
    }

    // --- DOM Elements ---
    const timeDisplay = document.getElementById('time-left');
    const btnToggle = document.getElementById('btn-toggle');
    const btnReset = document.getElementById('btn-reset');
    const btnWork = document.getElementById('btn-work');
    const btnBreak = document.getElementById('btn-break');
    const sessionCountDisplay = document.getElementById('session-count');

    // --- Todo DOM Elements ---
    const todoForm = document.getElementById('todo-form');
    const todoInput = document.getElementById('todo-input');
    const todoList = document.getElementById('todo-list');

    // --- Init ---
    updateDisplay();
    sessionCountDisplay.textContent = sessionsCompleted;
    loadTodos();

    // --- Pomodoro Logic ---
    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function updateDisplay() {
        timeDisplay.textContent = formatTime(timeRemaining);
        document.title = `${formatTime(timeRemaining)} | Focus`;
    }

    function toggleTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
            btnToggle.textContent = 'Start';
        } else {
            btnToggle.textContent = 'Pause';
            timerInterval = setInterval(() => {
                timeRemaining--;
                if (timeRemaining < 0) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                    btnToggle.textContent = 'Start';
                    playAlarm();

                    if (isWorkMode) {
                        sessionsCompleted++;
                        try { localStorage.setItem('pomodoroSessions', sessionsCompleted); } catch (e) { }
                        sessionCountDisplay.textContent = sessionsCompleted;
                        setMode(false); // Switch to break
                        alert("Work session complete! Time for a break.");
                    } else {
                        setMode(true); // Switch to work
                        alert("Break is over! Time to focus.");
                    }
                }
                updateDisplay();
            }, 1000);
        }
    }

    function resetTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
            btnToggle.textContent = 'Start';
        }
        timeRemaining = (isWorkMode ? WORK_MINUTES : BREAK_MINUTES) * 60;
        updateDisplay();
    }

    function setMode(workMode) {
        isWorkMode = workMode;
        if (isWorkMode) {
            btnWork.classList.add('active');
            btnBreak.classList.remove('active');
            document.documentElement.style.setProperty('--accent', 'rgba(255, 113, 113, 0.4)');
            document.documentElement.style.setProperty('--accent-hover', 'rgba(255, 113, 113, 0.6)');
        } else {
            btnBreak.classList.add('active');
            btnWork.classList.remove('active');
            document.documentElement.style.setProperty('--accent', 'rgba(126, 255, 222, 0.4)');
            document.documentElement.style.setProperty('--accent-hover', 'rgba(126, 255, 222, 0.6)');
        }
        resetTimer();
    }

    function playAlarm() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);

            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 1);
        } catch (e) {
            console.log("Audio not supported or blocked", e);
        }
    }

    // --- Event Listeners ---
    btnToggle.addEventListener('click', toggleTimer);
    btnReset.addEventListener('click', resetTimer);

    btnWork.addEventListener('click', () => {
        if (!isWorkMode) setMode(true);
    });

    btnBreak.addEventListener('click', () => {
        if (isWorkMode) setMode(false);
    });

    // --- Todo Logic ---
    let todos = [];
    try {
        todos = JSON.parse(localStorage.getItem('todos'));
        if (!Array.isArray(todos)) {
            todos = [];
        }
    } catch (e) {
        console.warn('localStorage not accessible for todos. State will not persist.');
    }

    function saveTodos() {
        try {
            localStorage.setItem('todos', JSON.stringify(todos));
        } catch (e) {
            console.warn('Could not save to localStorage');
        }
    }

    function renderTodos() {
        todoList.innerHTML = '';
        todos.forEach((todo, index) => {
            const li = document.createElement('li');
            li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            li.dataset.index = index;

            li.innerHTML = `
                <div class="drag-handle">≡</div>
                <div class="checkbox-wrapper">
                    <input type="checkbox" class="checkbox" ${todo.completed ? 'checked' : ''} data-index="${index}">
                </div>
                <span class="todo-text">${escapeHTML(todo.text)}</span>
                <button class="delete-btn" data-index="${index}">×</button>
            `;
            todoList.appendChild(li);
        });

        document.querySelectorAll('.checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const idx = e.target.getAttribute('data-index');
                todos[idx].completed = e.target.checked;
                saveTodos();
                renderTodos();
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                todos.splice(idx, 1);
                saveTodos();
                renderTodos();
            });
        });
    }

    todoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = todoInput.value.trim();
        if (text) {
            todos.push({ text, completed: false });
            todoInput.value = '';
            saveTodos();
            renderTodos();
        }
    });

    function loadTodos() {
        renderTodos();

        if (typeof Sortable !== 'undefined') {
            new Sortable(todoList, {
                animation: 150,
                handle: '.drag-handle',
                ghostClass: 'sortable-ghost',
                onEnd: function (evt) {
                    const oldIndex = evt.oldIndex;
                    const newIndex = evt.newIndex;

                    if (oldIndex !== newIndex) {
                        const movedItem = todos.splice(oldIndex, 1)[0];
                        todos.splice(newIndex, 0, movedItem);
                        saveTodos();
                        renderTodos();
                    }
                }
            });
        }
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag])
        );
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', app);
} else {
    app();
}
