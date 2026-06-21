// Almacenamiento local reactivo por defecto vacío
let tasks = JSON.parse(localStorage.getItem('kronos_tasks')) || [];
let notes = JSON.parse(localStorage.getItem('kronos_notes')) || [];
let deferredPrompt; // Guardará el evento de instalación nativo

document.addEventListener("DOMContentLoaded", () => {
    // 1. Simulación del Loading Screen
    setTimeout(() => {
        document.getElementById('screen-loading').classList.remove('active');
        
        // Comprobar si ya pasó por la pantalla "Primera Vez"
        if (!localStorage.getItem('kronos_user_initialized')) {
            document.getElementById('screen-welcome').classList.add('active');
        } else {
            navigateTo('home');
        }
    }, 2000);

    // 2. Controlar Reloj y Fecha del Home de manera Dinámica e Instantánea
    renderLiveDate();

    // 3. Cargar Novedades desde update.txt
    fetchUpdatesFile();

    // 4. Renderizar contenido inicial (si hay datos guardados)
    renderTasks();
    renderNotes();
    generateCalendarGrid();

    // 5. Capturar el evento nativo de instalación PWA
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e; // Guardamos el evento para activarlo con tu botón personalizado
    });

    // Acción del botón personalizado de descargar la APP
    document.getElementById('btn-install-pwa').addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt(); // Muestra el cartel nativo del navegador
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log('El usuario instaló Kronos con éxito.');
                skipWelcome();
            }
            deferredPrompt = null;
        } else {
            // Si la app ya está instalada o el navegador no la soporta directamente
            alert("¡Para instalarla de forma directa, pulsa en el menú de opciones de tu navegador (los tres puntos o compartir) y selecciona 'Añadir a la pantalla de inicio'!");
            skipWelcome();
        }
    });
});

// Cambiar de pantalla de manera limpia
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(`screen-${screenId}`).classList.add('active');
}

function skipWelcome() {
    localStorage.setItem('kronos_user_initialized', 'true');
    navigateTo('home');
}

// Configuración de Fechas reales
function renderLiveDate() {
    const today = new Date();
    const num = today.getDate();
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    
    document.getElementById('current-day-num').innerText = num;
    document.getElementById('current-month').innerText = `de ${months[today.getMonth()]}`;
}

// Parseador personalizado de update.txt
async function fetchUpdatesFile() {
    const container = document.getElementById('update-container');
    try {
        const res = await fetch('update.txt');
        if (!res.ok) throw new Error();
        const text = await res.text();
        
        const lines = text.split('\n');
        let htmlResult = "";

        lines.forEach(line => {
            let clean = line.trim();
            if (clean.startsWith('H1>')) {
                htmlResult += `<h1 class="upd-h1">${clean.slice(3, -1)}</h1>`;
            } else if (clean.startsWith('H2>')) {
                htmlResult += `<h2 class="upd-h2">${clean.slice(3, -1)}</h2>`;
            } else if (clean.startsWith('H3>')) {
                let content = clean.slice(3, -1);
                // Reemplazos de formato enriquecido solicitados
                content = content.replace(/\*(.*?)\*/g, "<strong>$1</strong>");
                content = content.replace(/_(.*?)_/g, "<em>$1</em>");
                htmlResult += `<p class="upd-h3">${content}</p>`;
            }
        });
        container.innerHTML = htmlResult;
    } catch (e) {
        container.innerHTML = `<p class="empty-msg">No hay actualizaciones registradas en update.txt</p>`;
    }
}

// LÓGICA DE TAREAS (Gestión Completa)
function toggleTimeInput() {
    const checkbox = document.getElementById('task-has-time');
    document.getElementById('task-time-input').style.display = checkbox.checked ? 'block' : 'none';
}

function addTask() {
    const input = document.getElementById('task-input');
    const hasTime = document.getElementById('task-has-time').checked;
    const timeInput = document.getElementById('task-time-input').value;

    if (!input.value.trim()) return;

    const newTask = {
        id: Date.now(),
        title: input.value.trim(),
        time: hasTime && timeInput ? timeInput : null
    };

    tasks.push(newTask);
    saveAndRenderTasks();

    // Resetear inputs
    input.value = "";
    document.getElementById('task-has-time').checked = false;
    toggleTimeInput();
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveAndRenderTasks();
}

function saveAndRenderTasks() {
    localStorage.setItem('kronos_tasks', JSON.stringify(tasks));
    renderTasks();
}

function renderTasks() {
    const container = document.getElementById('tasks-list');
    const previewContainer = document.getElementById('home-tasks-preview');
    
    if (tasks.length === 0) {
        container.innerHTML = `<p class="empty-msg">No hay tareas aún.</p>`;
        previewContainer.innerHTML = `<li class="empty-msg">No tienes tareas para hoy.</li>`;
        return;
    }

    // Render en sección Tareas
    container.innerHTML = tasks.map(t => `
        <div class="item-card">
            <div class="item-card-left">
                <span class="item-title">${t.title}</span>
                ${t.time ? `<span class="item-time-badge"><i class="fa-regular fa-clock"></i> ${t.time}</span>` : ''}
            </div>
            <i class="fa-solid fa-trash-can item-delete-btn" onclick="deleteTask(${t.id})"></i>
        </div>
    `).join('');

    // Render en sección Vista Previa Home
    previewContainer.innerHTML = tasks.slice(0, 3).map(t => `
        <li>• ${t.title} ${t.time ? `(${t.time})` : ''}</li>
    `).join('');
}

// LÓGICA DE NOTAS (Gestión Completa)
function addNote() {
    const input = document.getElementById('note-input');
    if (!input.value.trim()) return;

    const newNote = {
        id: Date.now(),
        text: input.value.trim()
    };

    notes.push(newNote);
    localStorage.setItem('kronos_notes', JSON.stringify(notes));
    input.value = "";
    renderNotes();
}

function deleteNote(id) {
    notes = notes.filter(n => n.id !== id);
    localStorage.setItem('kronos_notes', JSON.stringify(notes));
    renderNotes();
}

function renderNotes() {
    const container = document.getElementById('notes-list');
    if (notes.length === 0) {
        container.innerHTML = `<p class="empty-msg">No hay notas aún.</p>`;
        return;
    }

    container.innerHTML = notes.map(n => `
        <div class="item-card">
            <div class="item-card-left">
                <span class="item-title">${n.text}</span>
            </div>
            <i class="fa-solid fa-trash-can item-delete-btn" onclick="deleteNote(${n.id})"></i>
        </div>
    `).join('');
}

// GENERADOR AUTOMÁTICO DE CALENDARIO REAL
function generateCalendarGrid() {
    const grid = document.getElementById('calendar-days-grid');
    const title = document.getElementById('calendar-month-year');
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayDate = now.getDate();

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    title.innerText = `${monthNames[currentMonth]} ${currentYear}`;

    // Obtener primer día del mes y total de días
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

    grid.innerHTML = "";

    // Espacios vacíos para cuadrar el inicio de semana
    for (let i = 0; i < firstDayIndex; i++) {
        grid.innerHTML += `<div></div>`;
    }

    // Insertar los días numéricos reales
    for (let day = 1; day <= totalDays; day++) {
        const isToday = day === todayDate ? 'class="current-real-day"' : '';
        grid.innerHTML += `<div ${isToday}>${day}</div>`;
    }
}
