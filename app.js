document.addEventListener('DOMContentLoaded', () => {
    // --- Pomodoro State ---
    const WORK_MINUTES = 25;
    const BREAK_MINUTES = 5;
    let timeRemaining = WORK_MINUTES * 60;
    let timerInterval = null;
    let isWorkMode = true;
    let sessionsCompleted = parseInt(localStorage.getItem('pomodoroSessions')) || 0;

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
                        localStorage.setItem('pomodoroSessions', sessionsCompleted);
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
        // A simple beep using AudioContext (better than requiring an external audio file)
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, ctx.currentTime); // A4 note
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            // Envelope to avoid clicking
            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 1);
        } catch (e) {
            console.log("Audio not supported or blocked");
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
    let todos = JSON.parse(localStorage.getItem('todos')) || [];

    function saveTodos() {
        localStorage.setItem('todos', JSON.stringify(todos));
    }

    function renderTodos() {
        todoList.innerHTML = '';
        todos.forEach((todo, index) => {
            const li = document.createElement('li');
            li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            li.dataset.index = index; // Used for SortableJS syncing

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

        // Re-attach event listeners
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
        
        // Initialize SortableJS functionality
        if (typeof Sortable !== 'undefined') {
            new Sortable(todoList, {
                animation: 150,
                handle: '.drag-handle', // drag handle selector within list items
                ghostClass: 'sortable-ghost',
                onEnd: function (evt) {
                    // Update array order based on DOM changes
                    const itemEl = evt.item;  // dragged HTMLElement
                    const oldIndex = evt.oldIndex;
                    const newIndex = evt.newIndex;
                    
                    if (oldIndex !== newIndex) {
                       // Move element in the array
                       const movedItem = todos.splice(oldIndex, 1)[0];
                       todos.splice(newIndex, 0, movedItem);
                       saveTodos();
                       renderTodos(); // Full re-render to update data-index attributes
                    }
                }
            });
        } else {
            console.error("SortableJS failed to load.");
        }
    }

    // Helper: escape HTML to prevent XSS
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
});
