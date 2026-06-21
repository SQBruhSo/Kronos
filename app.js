// Memoria Persistente Enlazada por JSON (Vacíos nativos por defecto al iniciar por primera vez)
let tasks = JSON.parse(localStorage.getItem('kronos_tasks_data')) || [];
let notes = JSON.parse(localStorage.getItem('kronos_notes_data')) || [];

// Variables globales para la navegación fluida del calendario
let currentCalendarDate = new Date();
let deferredPrompt; 

document.addEventListener("DOMContentLoaded", () => {
    // 1. Desvanecimiento controlado del Loading Screen
    setTimeout(() => {
        document.getElementById('screen-loading').classList.remove('active');
        
        // Comprobar la bandera del LocalStorage para la primera experiencia
        if (!localStorage.getItem('kronos_app_installed_v1')) {
            document.getElementById('screen-welcome').classList.add('active');
        } else {
            navigateTo('home');
        }
    }, 2400);

    // 2. Ejecutar Motores Críticos
    syncLiveDate();
    fetchAndParseUpdates();
    renderTasksEngine();
    renderNotesEngine();
    buildCalendarEngine();

    // 3. Capturar Instalador Standalone de Google Chrome / Safari / Edge
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e; 
    });

    document.getElementById('btn-install-pwa').addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                skipWelcome();
            }
            deferredPrompt = null;
        } else {
            alert("¡Para emular el link directo sin marcos externos en tu dispositivo actual, ve a la configuración de tu navegador y selecciona 'Añadir a pantalla de inicio' u 'Opciones de Escritorio'!");
            skipWelcome();
        }
    });
});

// Enrutador SPA
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${screenId}`).classList.add('active');
}

function skipWelcome() {
    localStorage.setItem('kronos_app_installed_v1', 'true');
    navigateTo('home');
}

// Sincronizador de Reloj del Inicio
function syncLiveDate() {
    const tracker = new Date();
    const dayNum = tracker.getDate();
    const listMonths = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    
    document.getElementById('current-day-num').innerText = dayNum;
    document.getElementById('current-month').innerText = `de ${listMonths[tracker.getMonth()]}`;
}

// Motor del Archivo de Novedades (update.txt)
async function fetchAndParseUpdates() {
    const target = document.getElementById('update-container');
    try {
        const response = await fetch('update.txt');
        if (!response.ok) throw new Error();
        const rawContent = await response.text();
        
        const clusterLines = rawContent.split('\n');
        let HTML_Stack = "";

        clusterLines.forEach(line => {
            let processedLine = line.trim();
            if (processedLine.startsWith('H1>')) {
                HTML_Stack += `<h1 class="upd-h1">${processedLine.slice(3, -1)}</h1>`;
            } else if (processedLine.startsWith('H2>')) {
                HTML_Stack += `<h2 class="upd-h2">${processedLine.slice(3, -1)}</h2>`;
            } else if (processedLine.startsWith('H3>')) {
                let text = processedLine.slice(3, -1);
                // Reemplazo avanzado cruzado de negrita y cursiva solicitado
                text = text.replace(/\*(.*?)\*/g, "<strong>$1</strong>");
                text = text.replace(/_(.*?)_/g, "<em>$1</em>");
                HTML_Stack += `<p class="upd-h3">${text}</p>`;
            }
        });
        target.innerHTML = HTML_Stack;
    } catch (err) {
        target.innerHTML = `<p class="empty-msg">No se encontraron registros activos en update.txt</p>`;
    }
}

// MOTOR DE CONTROL: TAREAS
function toggleTimeInput() {
    const trigger = document.getElementById('task-has-time').checked;
    document.getElementById('task-time-input').style.display = trigger ? 'block' : 'none';
}

function addTask() {
    const textBuffer = document.getElementById('task-input');
    const scheduleFlag = document.getElementById('task-has-time').checked;
    const timeValue = document.getElementById('task-time-input').value;

    if (!textBuffer.value.trim()) return;

    const payload = {
        uid: Date.now(),
        title: textBuffer.value.trim(),
        time: scheduleFlag && timeValue ? timeValue : null
    };

    tasks.push(payload);
    localStorage.setItem('kronos_tasks_data', JSON.stringify(tasks));
    
    textBuffer.value = "";
    document.getElementById('task-has-time').checked = false;
    toggleTimeInput();
    
    renderTasksEngine();
}

function dropTask(uid) {
    tasks = tasks.filter(item => item.uid !== uid);
    localStorage.setItem('kronos_tasks_data', JSON.stringify(tasks));
    renderTasksEngine();
}

function renderTasksEngine() {
    const listArea = document.getElementById('tasks-list');
    const panelPreview = document.getElementById('home-tasks-preview');

    if (tasks.length === 0) {
        listArea.innerHTML = `<p class="empty-msg">No hay tareas planificadas.</p>`;
        panelPreview.innerHTML = `<li class="empty-msg">No tienes tareas para hoy.</li>`;
        return;
    }

    listArea.innerHTML = tasks.map(t => `
        <div class="item-card">
            <div class="item-card-left">
                <span class="item-title">${t.title}</span>
                ${t.time ? `<span class="item-time-badge"><i class="fa-regular fa-clock"></i> Módulo: ${t.time} hs</span>` : ''}
            </div>
            <i class="fa-solid fa-trash-can item-delete-btn" onclick="dropTask(${t.uid})"></i>
        </div>
    `).join('');

    panelPreview.innerHTML = tasks.slice(0, 3).map(t => `
        <li>• ${t.title} ${t.time ? `[${t.time}]` : ''}</li>
    `).join('');
}

// MOTOR DE CONTROL: NOTAS
function addNote() {
    const buffer = document.getElementById('note-input');
    if (!buffer.value.trim()) return;

    const payload = {
        uid: Date.now(),
        content: buffer.value.trim()
    };

    notes.push(payload);
    localStorage.setItem('kronos_notes_data', JSON.stringify(notes));
    buffer.value = "";
    renderNotesEngine();
}

function dropNote(uid) {
    notes = notes.filter(item => item.uid !== uid);
    localStorage.setItem('kronos_notes_data', JSON.stringify(notes));
    renderNotesEngine();
}

function renderNotesEngine() {
    const listArea = document.getElementById('notes-list');
    if (notes.length === 0) {
        listArea.innerHTML = `<p class="empty-msg">No hay anotaciones guardadas.</p>`;
        return;
    }

    listArea.innerHTML = notes.map(n => `
        <div class="item-card">
            <div class="item-card-left">
                <span class="item-title">${n.content}</span>
            </div>
            <i class="fa-solid fa-trash-can item-delete-btn" onclick="dropNote(${n.uid})"></i>
        </div>
    `).join('');
}

// MOTOR DE CONTROL: CALENDARIO INTERACTIVO
function buildCalendarEngine() {
    const grid = document.getElementById('calendar-days-grid');
    const headerTitle = document.getElementById('calendar-month-year');
    
    const realClock = new Date();
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const dictionaryMonths = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    headerTitle.innerText = `${dictionaryMonths[month]} de ${year}`;

    const indexFirstDay = new Date(year, month, 1).getDay();
    const countDaysTotal = new Date(year, month + 1, 0).getDate();

    grid.innerHTML = "";

    for (let i = 0; i < indexFirstDay; i++) {
        grid.innerHTML += `<div></div>`;
    }

    for (let day = 1; day <= countDaysTotal; day++) {
        const checkToday = (day === realClock.getDate() && month === realClock.getMonth() && year === realClock.getFullYear()) ? 'class="current-real-day"' : '';
        grid.innerHTML += `<div ${checkToday}>${day}</div>`;
    }
}

function changeMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    buildCalendarEngine();
}

// COMPONENTES AUXILIARES: ACORDEÓN & RESET DE FÁBRICA
function toggleAccordion(element) {
    element.classList.toggle('open');
}

function resetApp() {
    if (confirm("¿Estás completamente seguro de restablecer Kronos? Se eliminarán todas las tareas, notas y configuraciones guardadas de forma irreversible.")) {
        localStorage.clear();
        window.location.reload();
    }
}
