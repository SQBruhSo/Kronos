// Base de datos reactiva persistente
let tasks = JSON.parse(localStorage.getItem('k_tasks')) || [];
let notes = JSON.parse(localStorage.getItem('k_notes')) || [];
let appSettings = JSON.parse(localStorage.getItem('k_settings')) || {
    theme: 'theme-light',
    size: 'size-medium',
    font: 'font-jakarta',
    notif: true,
    sound: true
};

let currentCalendarDate = new Date();
let activeCalendarDayStr = null; // Guardará la fecha seleccionada YYYY-MM-DD
let editingNoteId = null; // Si está editando, guarda el ID de la nota aquí
let deferredPrompt;

document.addEventListener("DOMContentLoaded", () => {
    // Inicializar Configuración Visual guardada
    applySettingsEngine();

    setTimeout(() => {
        document.getElementById('screen-loading').classList.remove('active');
        if (!localStorage.getItem('k_init')) {
            document.getElementById('screen-welcome').classList.add('active');
        } else {
            navigateTo('home');
        }
    }, 2000);

    // Arrancar motores gráficos y lógicos
    syncLiveClock();
    fetchUpdatesLog();
    renderTasksEngine();
    renderNotesEngine();
    buildCalendarGrid();

    // Sincronizar inputs del panel de opciones con los datos reales
    document.getElementById('cfg-theme').value = appSettings.theme;
    document.getElementById('cfg-size').value = appSettings.size;
    document.getElementById('cfg-font').value = appSettings.font;
    document.getElementById('cfg-notif').checked = appSettings.notif;
    document.getElementById('cfg-sound').checked = appSettings.sound;

    // Escucha de descarga PWA
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
    });
    
    const installBtn = document.getElementById('btn-install-pwa');
    if(installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') skipWelcome();
                deferredPrompt = null;
            } else {
                alert("Para instalar Kronos como app nativa sin barras, dale a 'Compartir' o 'Tres puntos' en tu navegador y elige 'Añadir a pantalla de inicio'.");
                skipWelcome();
            }
        });
    }
});

// Enrutamiento SPA
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${screenId}`).classList.add('active');
}

function skipWelcome() {
    localStorage.setItem('k_init', 'true');
    navigateTo('home');
}

// Reloj y Fechas
function syncLiveClock() {
    const d = new Date();
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    document.getElementById('current-day-num').innerText = d.getDate();
    document.getElementById('current-month').innerText = `de ${months[d.getMonth()]}`;
}

// Configuración Interactiva
function updateSettings() {
    appSettings.theme = document.getElementById('cfg-theme').value;
    appSettings.size = document.getElementById('cfg-size').value;
    appSettings.font = document.getElementById('cfg-font').value;
    appSettings.notif = document.getElementById('cfg-notif').checked;
    appSettings.sound = document.getElementById('cfg-sound').checked;

    localStorage.setItem('k_settings', JSON.stringify(appSettings));
    applySettingsEngine();
    
    if(appSettings.sound) {
        // Sonido táctil sutil nativo del navegador si se permite
        try { window.navigator.vibrate(10); } catch(e){}
    }
}

function applySettingsEngine() {
    const body = document.body;
    body.className = ""; // Limpiar clases tipográficas y de color
    body.classList.add(appSettings.theme, appSettings.size, appSettings.font);
}

// PARSER LOG: update.txt
async function fetchUpdatesLog() {
    const box = document.getElementById('update-container');
    try {
        const r = await fetch('update.txt');
        if(!r.ok) throw new Error();
        const raw = await r.text();
        const lines = raw.split('\n');
        let html = "";
        lines.forEach(l => {
            let cl = l.trim();
            if(cl.startsWith('H1>')) html += `<h1 class="upd-h1">${cl.slice(3,-1)}</h1>`;
            else if(cl.startsWith('H2>')) html += `<h2 class="upd-h2">${cl.slice(3,-1)}</h2>`;
            else if(cl.startsWith('H3>')) {
                let txt = cl.slice(3,-1).replace(/\*(.*?)\*/g, "<strong>$1</strong>").replace(/_(.*?)_/g, "<em>$1</em>");
                html += `<p class="upd-h3">${txt}</p>`;
            }
        });
        box.innerHTML = html;
    } catch(e) {
        box.innerHTML = `<p class="empty-msg">No hay logs de actualización cargados.</p>`;
    }
}

// GESTIÓN: TAREAS (image_037f67.png Sync)
function toggleTimeInput() {
    const checked = document.getElementById('task-has-time').checked;
    document.getElementById('time-wrapper').style.display = checked ? 'flex' : 'none';
}

function addTask() {
    const input = document.getElementById('task-input');
    const hasTime = document.getElementById('task-has-time').checked;
    const timeVal = document.getElementById('task-time-input').value;
    
    if(!input.value.trim()) return;

    // Obtener string de fecha de hoy local YYYY-MM-DD
    const todayStr = new Date().toISOString().split('T')[0];

    const item = {
        id: Date.now(),
        title: input.value.trim(),
        time: hasTime ? timeVal : null,
        date: todayStr
    };

    tasks.push(item);
    localStorage.setItem('k_tasks', JSON.stringify(tasks));
    input.value = "";
    document.getElementById('task-has-time').checked = false;
    toggleTimeInput();
    
    renderTasksEngine();
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    localStorage.setItem('k_tasks', JSON.stringify(tasks));
    renderTasksEngine();
    if(activeCalendarDayStr) renderCalendarDayTasks(activeCalendarDayStr);
}

function renderTasksEngine() {
    const area = document.getElementById('tasks-list');
    const preview = document.getElementById('home-tasks-preview');
    const todayStr = new Date().toISOString().split('T')[0];

    // Filtrar tareas generales del día de hoy para el panel home
    const todayTasks = tasks.filter(t => t.date === todayStr);

    if (tasks.length === 0) {
        area.innerHTML = `<p class="empty-msg">No hay tareas creadas.</p>`;
    } else {
        area.innerHTML = tasks.map(t => `
            <div class="item-card">
                <div class="item-card-left">
                    <span class="item-title">${t.title}</span>
                    <span class="item-time-badge"><i class="fa-solid fa-calendar-day"></i> ${t.date} ${t.time ? `| ${t.time} hs` : ''}</span>
                </div>
                <i class="fa-solid fa-trash-can item-delete-btn" onclick="deleteTask(${t.id}); event.stopPropagation();"></i>
            </div>
        `).join('');
    }

    if(todayTasks.length === 0) {
        preview.innerHTML = `<li class="empty-msg">Agenda libre para hoy.</li>`;
    } else {
        preview.innerHTML = todayTasks.slice(0,3).map(t => `<li>• ${t.title} ${t.time ? `(${t.time})`:''}</li>`).join('');
    }
}

// GESTIÓN: NOTAS (Edición de la 7ma imagen solicitada)
function addNote() {
    const input = document.getElementById('note-input');
    if(!input.value.trim()) return;

    if(editingNoteId !== null) {
        // Modo Edición activo
        notes = notes.map(n => n.id === editingNoteId ? { ...n, text: input.value.trim() } : n);
        editingNoteId = null;
        document.getElementById('note-submit-icon').className = "fa-solid fa-circle-plus";
        input.placeholder = "Escribir nota...";
    } else {
        // Modo Creación estándar
        notes.push({ id: Date.now(), text: input.value.trim() });
    }

    localStorage.setItem('k_notes', JSON.stringify(notes));
    input.value = "";
    renderNotesEngine();
}

function enterEditNoteMode(id, currentText) {
    editingNoteId = id;
    const input = document.getElementById('note-input');
    input.value = currentText;
    input.focus();
    // Cambiar ícono a Guardar Check
    document.getElementById('note-submit-icon').className = "fa-solid fa-circle-check";
    input.placeholder = "Modificando nota...";
}

function deleteNote(id) {
    notes = notes.filter(n => n.id !== id);
    localStorage.setItem('k_notes', JSON.stringify(notes));
    if(editingNoteId === id) {
        editingNoteId = null;
        document.getElementById('note-submit-icon').className = "fa-solid fa-circle-plus";
        document.getElementById('note-input').value = "";
    }
    renderNotesEngine();
}

function renderNotesEngine() {
    const area = document.getElementById('notes-list');
    if(notes.length === 0) {
        area.innerHTML = `<p class="empty-msg">No hay notas guardadas.</p>`;
        return;
    }
    area.innerHTML = notes.map(n => `
        <div class="item-card" onclick="enterEditNoteMode(${n.id}, '${n.text}')">
            <div class="item-card-left">
                <span class="item-title">${n.text}</span>
            </div>
            <i class="fa-solid fa-trash-can item-delete-btn" onclick="deleteNote(${n.id}); event.stopPropagation();"></i>
        </div>
    `).join('');
}

// GESTIÓN: CALENDARIO CON ASIGNACIÓN DE FECHAS SELECCIONABLES
function buildCalendarGrid() {
    const grid = document.getElementById('calendar-days-grid');
    const header = document.getElementById('calendar-month-year');
    const realDate = new Date();
    
    const y = currentCalendarDate.getFullYear();
    const m = currentCalendarDate.getMonth();

    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    header.innerText = `${months[m]} ${y}`;

    const firstDayIndex = new Date(y, m, 1).getDay();
    const totalDays = new Date(y, m + 1, 0).getDate();

    grid.innerHTML = "";

    for (let i = 0; i < firstDayIndex; i++) {
        grid.innerHTML += `<div></div>`;
    }

    for (let d = 1; d <= totalDays; d++) {
        const isToday = (d === realDate.getDate() && m === realDate.getMonth() && y === realDate.getFullYear()) ? 'current-real-day' : '';
        
        // Crear string identificador único de fecha YYYY-MM-DD para mapeo de datos
        const dayString = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        
        grid.innerHTML += `<div class="${isToday}" data-date="${dayString}" onclick="selectCalendarDay(this, '${dayString}')">${d}</div>`;
    }
}

function changeMonth(dir) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + dir);
    buildCalendarGrid();
    document.getElementById('cal-selected-box').style.display = "none";
}

function selectCalendarDay(element, dateStr) {
    document.querySelectorAll('#calendar-days-grid div').forEach(div => div.classList.remove('selected-day-focus'));
    element.classList.add('selected-day-focus');
    
    activeCalendarDayStr = dateStr;
    document.getElementById('cal-selected-box').style.display = "flex";
    
    // Parsear fecha linda para el encabezado
    const parts = dateStr.split('-');
    document.getElementById('cal-selected-date-lbl').innerText = `Tareas del ${parts[2]}/${parts[1]}/${parts[0]}:`;
    
    renderCalendarDayTasks(dateStr);
}

function renderCalendarDayTasks(dateStr) {
    const targetArea = document.getElementById('cal-day-tasks-list');
    const dayTasks = tasks.filter(t => t.date === dateStr);

    if(dayTasks.length === 0) {
        targetArea.innerHTML = `<p class="empty-msg" style="font-size:0.8rem;">Sin tareas asignadas en esta fecha.</p>`;
    } else {
        targetArea.innerHTML = dayTasks.map(t => `
            <div class="item-card" style="padding: 8px 12px; margin-bottom:4px;">
                <span class="item-title" style="font-size:0.85rem;">${t.title} ${t.time ? `[${t.time} hs]` : ''}</span>
                <i class="fa-solid fa-xmark item-delete-btn" style="font-size:0.9rem;" onclick="deleteTask(${t.id})"></i>
            </div>
        `).join('');
    }
}

function addCalendarDayTask() {
    const input = document.getElementById('cal-task-input');
    const time = document.getElementById('cal-task-time').value;

    if(!input.value.trim() || !activeCalendarDayStr) return;

    tasks.push({
        id: Date.now(),
        title: input.value.trim(),
        time: time || null,
        date: activeCalendarDayStr
    });

    localStorage.setItem('k_tasks', JSON.stringify(tasks));
    input.value = "";
    document.getElementById('cal-task-time').value = "";
    
    renderCalendarDayTasks(activeCalendarDayStr);
    renderTasksEngine();
}

// Auxiliares
function toggleAccordion(el) { el.classList.toggle('open'); }
function resetApp() {
    if(confirm("¿Restablecer el ecosistema de Kronos a valores nulos de fábrica? Se borrarán todas las notas, configuraciones y tareas asignadas.")){
        localStorage.clear();
        window.location.reload();
    }
}
