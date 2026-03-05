// roadmap.js
// shared engine for TPI and LI — expects materiasData, storageKey, gruposDisponibles from host HTML

// state
let materiasAprobadas = []; // persisted to localStorage
let materiasEnCurso   = []; // simulation only, not persisted

// --- Tema ---
const Tema = {
    STORAGE_KEY: 'roadmap_tema',
    get() {
        const g = localStorage.getItem(this.STORAGE_KEY);
        return g || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    },
    apply(tema) {
        document.documentElement.setAttribute('data-theme', tema);
        const btn = document.getElementById('btn-tema');
        if (btn) btn.textContent = tema === 'dark' ? '☀️' : '🌙';
    },
    toggle() {
        const actual = document.documentElement.getAttribute('data-theme') || 'light';
        const nuevo  = actual === 'dark' ? 'light' : 'dark';
        localStorage.setItem(this.STORAGE_KEY, nuevo);
        this.apply(nuevo);
    },
    init() { this.apply(this.get()); }
};

// --- Modal ---
const Modal = {
    _resolve: null,
    _getEl() { return document.getElementById('modal-overlay'); },
    _crear() {
        if (document.getElementById('modal-overlay')) return;
        document.body.insertAdjacentHTML('beforeend', `
            <div id="modal-overlay" class="modal-overlay" role="dialog" aria-modal="true">
                <div class="modal-caja">
                    <div class="modal-icono"  id="modal-icono"></div>
                    <div class="modal-titulo" id="modal-titulo"></div>
                    <div class="modal-texto"  id="modal-texto"></div>
                    <div class="modal-botones">
                        <button class="modal-btn modal-btn-cancelar"  id="modal-btn-cancelar">Cancelar</button>
                        <button class="modal-btn modal-btn-confirmar" id="modal-btn-confirmar">Confirmar</button>
                    </div>
                </div>
            </div>`);
        document.getElementById('modal-btn-cancelar') .addEventListener('click', () => this._cerrar(false));
        document.getElementById('modal-btn-confirmar').addEventListener('click', () => this._cerrar(true));
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && this._getEl()?.classList.contains('visible')) this._cerrar(false);
        });
        this._getEl().addEventListener('click', e => {
            if (e.target === this._getEl()) this._cerrar(false);
        });
    },
    _cerrar(resultado) {
        this._getEl()?.classList.remove('visible');
        if (this._resolve) { this._resolve(resultado); this._resolve = null; }
    },
    preguntar(opts = {}) {
        this._crear();
        const overlay = this._getEl();
        document.getElementById('modal-icono').textContent  = opts.icono  || '❓';
        document.getElementById('modal-titulo').textContent = opts.titulo || '¿Confirmar?';
        document.getElementById('modal-texto').textContent  = opts.texto  || '';
        const btnConf = document.getElementById('modal-btn-confirmar');
        btnConf.textContent = opts.confirmLabel || 'Confirmar';
        btnConf.className = 'modal-btn modal-btn-confirmar' + (opts.peligro ? ' peligro' : '');
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('visible')));
        return new Promise(resolve => { this._resolve = resolve; });
    }
};

// --- Toast ---
const Toast = {
    _getContainer() {
        let c = document.getElementById('toast-container');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toast-container';
            c.className = 'toast-container';
            document.body.appendChild(c);
        }
        return c;
    },
    mostrar(nombres) {
        if (!nombres.length) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <div class="toast-titulo">🔓 ${nombres.length === 1 ? 'Nueva materia desbloqueada' : `${nombres.length} materias desbloqueadas`}</div>
            <ul class="toast-lista">${nombres.map(n => `<li>${n}</li>`).join('')}</ul>`;
        this._getContainer().appendChild(toast);
        requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('visible')));
        setTimeout(() => {
            toast.classList.add('saliendo');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, 4500);
    }
};

// --- Calculation & evaluation ---
function calcularCreditosActuales(incluirEnCurso = false) {
    const creditos = { Total: 0 };
    gruposDisponibles.forEach(g => { creditos[g] = 0; });
    const ids = incluirEnCurso
        ? [...new Set([...materiasAprobadas, ...materiasEnCurso])]
        : materiasAprobadas;
    ids.forEach(id => {
        const m = materiasData.find(x => x.id === id);
        if (m) { creditos[m.grupo] = (creditos[m.grupo] || 0) + m.creditos; creditos.Total += m.creditos; }
    });
    return creditos;
}

function _creditosConLista(lista) {
    const creditos = { Total: 0 };
    gruposDisponibles.forEach(g => { creditos[g] = 0; });
    lista.forEach(id => {
        const m = materiasData.find(x => x.id === id);
        if (m) { creditos[m.grupo] = (creditos[m.grupo] || 0) + m.creditos; creditos.Total += m.creditos; }
    });
    return creditos;
}

function _estadoConLista(materia, creditos, lista) {
    if (lista.includes(materia.id)) return 'aprobada';
    if (!materia.requisitos.materiasAprobadas.every(r => lista.includes(r))) return 'bloqueada';
    for (const [g, min] of Object.entries(materia.requisitos.creditosNecesarios)) {
        if ((creditos[g] || 0) < min) return 'bloqueada';
    }
    return 'habilitada';
}

function verificarEstadoMateria(materia, creditosActuales) {
    if (materiasAprobadas.includes(materia.id)) return 'aprobada';
    if (materiasEnCurso.includes(materia.id))   return 'en-curso';
    if (!materia.requisitos.materiasAprobadas.every(r => materiasAprobadas.includes(r))) return 'bloqueada';
    for (const [g, min] of Object.entries(materia.requisitos.creditosNecesarios)) {
        if ((creditosActuales[g] || 0) < min) return 'bloqueada';
    }
    return 'habilitada';
}

// returns subjects unlocked by approving idMateria
function calcularDesbloqueos(idMateria) {
    const credAntes   = calcularCreditosActuales();
    const listaDespues = [...materiasAprobadas, idMateria];
    const credDespues  = _creditosConLista(listaDespues);
    return materiasData
        .filter(m => m.id !== idMateria && !materiasAprobadas.includes(m.id))
        .filter(m => {
            const antes   = _estadoConLista(m, credAntes,   materiasAprobadas);
            const despues = _estadoConLista(m, credDespues, listaDespues);
            return antes === 'bloqueada' && despues === 'habilitada';
        })
        .map(m => m.nombre);
}

function correlativasFaltantes(materia) {
    const faltanMaterias = materia.requisitos.materiasAprobadas
        .filter(r => !materiasAprobadas.includes(r))
        .map(r => { const m = materiasData.find(x => x.id === r); return m ? m.nombre : r; });
    const creditos = calcularCreditosActuales();
    const faltanCreditos = [];
    for (const [g, min] of Object.entries(materia.requisitos.creditosNecesarios)) {
        const act = creditos[g] || 0;
        if (act < min) faltanCreditos.push(`${g}: ${act}/${min} créditos`);
    }
    return [...faltanMaterias, ...faltanCreditos];
}

// --- Init ---
function inicializarTablero() {
    const datosGuardados = localStorage.getItem(storageKey);
    if (datosGuardados) {
        try { materiasAprobadas = JSON.parse(datosGuardados); } catch(e) { materiasAprobadas = []; }
    }

    document.getElementById('mat-total').innerText = materiasData.length;
    const tablero = document.getElementById('tablero');
    const creditos = calcularCreditosActuales();

    materiasData.forEach((materia, index) => {
        const estado = verificarEstadoMateria(materia, creditos);
        const div = document.createElement('div');
        div.id = `materia-${materia.id}`;
        div.className = `materia ${estado}`;
        div.style.animationDelay = `${index * 18}ms`;
        div.addEventListener('click', () => toggleMateria(materia.id));
        div.innerHTML = _buildCardHTML(materia, estado);
        tablero.appendChild(div);
    });

    actualizarStats(creditos);
    actualizarPanelSimulacion();
    aplicarFiltros();
}

function _buildCardHTML(materia, estado) {
    const iconos = { aprobada: '✅', habilitada: '🔓', bloqueada: '🔒', 'en-curso': '📖' };

    let hintHTML = '';
    if (estado === 'bloqueada') {
        const faltantes = correlativasFaltantes(materia);
        if (faltantes.length > 0) {
            const resumen = faltantes.length <= 2 ? faltantes.join(', ') : `${faltantes[0]} y ${faltantes.length - 1} más`;
            hintHTML = `<div class="materia-requisitos-hint">Falta: ${resumen}</div>`;
        }
    }
    if (estado === 'en-curso') {
        hintHTML = `<div class="materia-requisitos-hint">Cursando este cuatrimestre</div>`;
    }

    const btnQuitar = estado === 'en-curso'
        ? `<button class="btn-quitar-cuatri" onclick="quitarDeCuatrimestre('${materia.id}', event)" title="Quitar del cuatrimestre">✕ Quitar</button>`
        : '';

    return `
        <div>
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;">
                <h3>${materia.nombre}</h3>
                <span class="estado-icon">${iconos[estado] || ''}</span>
            </div>
            ${hintHTML}
        </div>
        <div class="materia-meta">
            <span class="materia-badge">${materia.grupo}</span>
            <p>${materia.creditos} créditos</p>
        </div>
        ${btnQuitar}`;
}

// --- Toggle (click cycle: habilitada → en-curso → aprobada) ---
async function toggleMateria(idMateria) {
    const materia = materiasData.find(m => m.id === idMateria);
    if (!materia) return;

    // Aprobada → desaprobar
    if (materiasAprobadas.includes(idMateria)) {
        const ok = await Modal.preguntar({
            icono: '↩️', titulo: 'Desmarcar materia',
            texto: `¿Querés desmarcar "${materia.nombre}" como aprobada?`,
            confirmLabel: 'Sí, desmarcar', peligro: true
        });
        if (ok) {
            materiasAprobadas = materiasAprobadas.filter(id => id !== idMateria);
            localStorage.setItem(storageKey, JSON.stringify(materiasAprobadas));
            actualizarTablero();
        }
        return;
    }

    // En curso → aprobar
    if (materiasEnCurso.includes(idMateria)) {
        const ok = await Modal.preguntar({
            icono: '📖', titulo: materia.nombre,
            texto: '¿Aprobaste esta materia? Se moverá de "en curso" a "aprobada".',
            confirmLabel: '✅ Marcar como aprobada'
        });
        if (ok) {
            const desbloqueados = calcularDesbloqueos(idMateria);
            materiasEnCurso = materiasEnCurso.filter(id => id !== idMateria);
            materiasAprobadas.push(idMateria);
            localStorage.setItem(storageKey, JSON.stringify(materiasAprobadas));
            actualizarTablero();
            if (desbloqueados.length > 0) setTimeout(() => Toast.mostrar(desbloqueados), 400);
        }
        return;
    }

    // Bloqueada → info
    const creditos = calcularCreditosActuales();
    if (verificarEstadoMateria(materia, creditos) === 'bloqueada') {
        await Modal.preguntar({
            icono: '🔒', titulo: 'Materia bloqueada',
            texto: `Todavía no podés cursar "${materia.nombre}". Faltan correlativas o créditos.`,
            confirmLabel: 'Entendido'
        });
        return;
    }

    // Habilitada → agregar al cuatrimestre
    const ok = await Modal.preguntar({
        icono: '📖', titulo: 'Agregar al cuatrimestre',
        texto: `¿Querés marcar "${materia.nombre}" como materia en curso?`,
        confirmLabel: '📖 La estoy cursando'
    });
    if (ok) {
        materiasEnCurso.push(idMateria);
        actualizarTablero();
    }
}

function quitarDeCuatrimestre(idMateria, event) {
    event.stopPropagation();
    materiasEnCurso = materiasEnCurso.filter(id => id !== idMateria);
    actualizarTablero();
}

async function reiniciarRoadmap() {
    const ok = await Modal.preguntar({
        icono: '⚠️', titulo: 'Reiniciar todo el progreso',
        texto: 'Se borrarán todas las materias marcadas. Esta acción no se puede deshacer.',
        confirmLabel: '🗑️ Borrar todo', peligro: true
    });
    if (ok) {
        materiasAprobadas = [];
        materiasEnCurso   = [];
        localStorage.removeItem(storageKey);
        actualizarTablero();
    }
}

// --- Simulation panel ---
function actualizarPanelSimulacion() {
    const panel = document.getElementById('panel-simulacion');
    if (!panel) return;

    if (materiasEnCurso.length === 0) { panel.classList.remove('visible'); return; }
    panel.classList.add('visible');

    const credAhora = calcularCreditosActuales(false);
    const credSim   = calcularCreditosActuales(true);
    const creditosNuevos = credSim.Total - credAhora.Total;

    // Cuántas materias nuevas se desbloquearían aprobando todo lo en-curso
    const listaSim = [...materiasAprobadas, ...materiasEnCurso];
    const credListaSim = _creditosConLista(listaSim);
    let materiasNuevas = 0;
    materiasData.forEach(m => {
        if (listaSim.includes(m.id)) return;
        const antes   = _estadoConLista(m, credAhora,     materiasAprobadas);
        const despues = _estadoConLista(m, credListaSim,  listaSim);
        if (antes === 'bloqueada' && despues === 'habilitada') materiasNuevas++;
    });

    document.getElementById('sim-cantidad').textContent  = materiasEnCurso.length;
    document.getElementById('sim-creditos').textContent  = `+${creditosNuevos}`;
    document.getElementById('sim-desbloquea').textContent = materiasNuevas;
}

function limpiarSimulacion() {
    materiasEnCurso = [];
    actualizarTablero();
}

// --- Filters ---
function aplicarFiltros() {
    const filtroGrupo  = document.getElementById('filtro-grupo').value;
    const filtroEstado = document.getElementById('filtro-estado').value;
    const creditos = calcularCreditosActuales();

    materiasData.forEach(materia => {
        const el = document.getElementById(`materia-${materia.id}`);
        if (!el) return;
        const estadoActual  = verificarEstadoMateria(materia, creditos);
        const okGrupo  = filtroGrupo  === 'Todos' || materia.grupo  === filtroGrupo;
        const okEstado = filtroEstado === 'Todos' || estadoActual   === filtroEstado;
        el.style.display = (okGrupo && okEstado) ? 'flex' : 'none';
    });
}

// --- UI update ---
function actualizarTablero() {
    const creditos = calcularCreditosActuales();
    actualizarStats(creditos);
    materiasData.forEach(materia => {
        const estado = verificarEstadoMateria(materia, creditos);
        const el = document.getElementById(`materia-${materia.id}`);
        if (!el) return;
        el.className = `materia ${estado}`;
        el.innerHTML = _buildCardHTML(materia, estado);
        el.onclick = () => toggleMateria(materia.id);
    });
    actualizarPanelSimulacion();
    aplicarFiltros();
}

function actualizarStats(creditos) {
    document.getElementById('mat-aprobadas').innerText = materiasAprobadas.length;
    document.getElementById('mat-restantes').innerText = materiasData.length - materiasAprobadas.length;
    document.getElementById('cred-total').innerText    = creditos.Total;
    gruposDisponibles.forEach(g => {
        const el = document.getElementById(`cred-${g}`);
        if (el) el.innerText = creditos[g] || 0;
    });
    const pct = materiasData.length > 0 ? Math.round((materiasAprobadas.length / materiasData.length) * 100) : 0;
    const fill = document.getElementById('barra-fill');
    const lbl  = document.getElementById('barra-pct');
    if (fill) fill.style.width = `${pct}%`;
    if (lbl)  lbl.textContent  = `${pct}%`;
}

// --- Boot ---
window.addEventListener('DOMContentLoaded', () => {
    Tema.init();
    inicializarTablero();
});
