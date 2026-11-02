/* ==========================================================
   FUNCIONES AUXILIARES (Puras, sin estado global)
   ========================================================== */

function obtenerElemento(id) {
    return document.getElementById(id);
}

function eliminarMarcas(s) {
    const MARKS_RE = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g;
    return String(s).replace(MARKS_RE, '');
}

function tokenizar(texto) {
    const SEP_RE = /[\u05BE\u05C0\u05C3\u05C6]/g;
    const TOKEN_RE = /[\u05D0-\u05EA\u0591-\u05C7]+/g;
    const preparado = String(texto).replace(SEP_RE, ' ');
    const resultado = [];
    let m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(preparado)) !== null) {
        resultado.push({ raw: m[0], clean: eliminarMarcas(m[0]) });
    }
    return resultado;
}

function escapar(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

function quitarParentesis(str) {
    let prev;
    do {
        prev = str;
        str = str.replace(/\([^()]*\)/g, ' ');
    } while (str !== prev);
    return str;
}

function obtenerGlosaCorta(entrada) {
    const SKIP_CLAUSE = /^(properly|i\.e\.|that is|by implication|figuratively|literally|causative|compare|or|and)\b/i;
    if (!entrada) return '?';
    let sd = String(entrada.strongs_def || '').trim();
    sd = sd.replace(/^\{|\}$/g, '').trim();
    sd = quitarParentesis(sd);
    sd = sd.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();

    if (sd) {
        const clausulas = sd.split(/[,;]/)
            .map((s) => s.trim())
            .filter((s) => s && !SKIP_CLAUSE.test(s));
        if (clausulas.length) {
            return clausulas[0].replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim();
        }
    }

    const kjv = String(entrada.kjv_def || '')
        .replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ')
        .split(/[;.]/)[0].split(',')
        .map((s) => s.trim()).filter(Boolean);
    return kjv[0] || '?';
}

function construirIndice(datos) {
    const indice = new Map();
    let entradas = 0;
    for (const key of Object.keys(datos)) {
        const e = datos[key];
        if (!e || typeof e !== 'object') continue;
        entradas++;

        const set = new Set();
        if (Array.isArray(e.formas)) e.formas.forEach((f) => set.add(eliminarMarcas(f)));
        if (e.lemma_sin_niqqud) set.add(eliminarMarcas(e.lemma_sin_niqqud));
        if (e.lemma) set.add(eliminarMarcas(e.lemma));

        for (const f of set) {
            if (!f) continue;
            let arr = indice.get(f);
            if (!arr) { arr = []; indice.set(f, arr); }
            arr.push(key);
        }
    }
    return { indice, entradas, formasUnicas: indice.size };
}

function buscarPalabra(clean, indice) {
    if (!clean) return null;
    const exacto = indice.get(clean);
    if (exacto) return { form: clean, keys: exacto, type: 'exact' };

    for (let i = 1; i <= 3 && i < clean.length; i++) {
        const rest = clean.slice(i);
        const hit = indice.get(rest);
        if (hit) return { form: rest, keys: hit, type: 'prefix', affix: clean.slice(0, i) };
    }
    for (let i = 1; i <= 3 && i < clean.length; i++) {
        const stem = clean.slice(0, clean.length - i);
        const hit = indice.get(stem);
        if (hit) return { form: stem, keys: hit, type: 'suffix', affix: clean.slice(clean.length - i) };
    }
    return null;
}

function analizarTexto(texto, indice) {
    const lineas = String(texto).split(/\r?\n/);
    return lineas.map(linea => {
        const tokens = tokenizar(linea);
        return tokens.map(t => ({
            raw: t.raw,
            clean: t.clean,
            res: buscarPalabra(t.clean, indice)
        }));
    });
}

async function copiarAlPortapapeles(texto) {
    if (!texto) return false;
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(texto);
            return true;
        } catch (e) { /* probamos fallback */ }
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = texto;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.left = '-1000px';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch (e) {
        return false;
    }
}

function extraerDiccionario(codigo) {
    try {
        const fn = new Function('window', codigo + `
            ;return (window && (window.hebrew_biblical_dict || window.DATOS))
                 || (typeof hebrew_biblical_dict !== "undefined" ? hebrew_biblical_dict : null)
                 || (typeof DATOS !== "undefined" ? DATOS : null)
                 || (typeof strongsHebrewDictionary !== "undefined" ? strongsHebrewDictionary : null)
                 || null;`);
        const r = fn({});
        if (r && typeof r === 'object') return r;
    } catch (e) {}
    try {
        const m = codigo.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/);
        const src = m ? m[1] : codigo;
        const r = new Function('return (' + src + ')')();
        if (r && typeof r === 'object') return r;
    } catch (e) {}
    return JSON.parse(codigo);
}

/* ==========================================================
   FUNCIÓN PRINCIPAL DEL PROGRAMA
   ========================================================== */

function programa() {
    // --- ESTADO LOCAL (No global) ---
    let DATOS = {};
    let INDICE = new Map();
    let textoLiteralReciente = '';

    const CANDIDATE_NAMES = [
        'hebrew_biblical_dict', 'DATOS', 'strongsHebrewDictionary', 'strongsHebrew',
        'strongs_hebrew', 'STRONGS', 'strongs', 'hebrewDict', 'hebrew_dictionary'
    ];

    const FALLBACK_DATOS = {
        "H1": {
            "lemma":"אָב","xlit":"ʼâb","pron":"awb",
            "strongs_def":"father, in a literal and immediate, or figurative and remote application",
            "kjv_def":"chief, (fore-) father(-less), patrimony, principal.",
            "lemma_sin_niqqud":"אב",
            "formas":["אב","האב","ואב","באב","לאב","מאב","כאב","שאב"]
        },
        "H6": {
            "lemma":"אָבַד","xlit":"ʼâbad","pron":"aw-bad'",
            "strongs_def":"properly, to wander away, i.e. lose oneself; by implication to perish (causative, destroy)",
            "kjv_def":"break, destroy, lose, perish, spend.",
            "lemma_sin_niqqud":"אבד",
            "formas":["אבד","האבד","ואבד","באבד","לאבד","מאבד","כאבד","שאבד"]
        },
        "H3426": {
            "lemma":"יֵשׁ","xlit":"yêsh","pron":"yaysh",
            "strongs_def":"there is or are (or any other form of the verb to be, as may suit the connection)",
            "kjv_def":"(there) are, (he, it, shall, there, there may, there shall, there should) be, thou do, had, hast, (which) hath, (I, shalt, that) have, (he, it, there) is, substance, it (there) was, (there) were, ye will, thou wilt, wouldest.",
            "lemma_sin_niqqud":"יש",
            "formas":["יש","היש","ויש","ביש","ליש","מיש","כיש","שיש"]
        }
    };

    // --- FUNCIONES DE ESTADO Y UI (Requieren las variables locales) ---

    function setEstado(msg, cls) {
        const el = obtenerElemento('status');
        el.textContent = msg || '';
        el.classList.remove('err', 'ok');
        if (cls) el.classList.add(cls);
    }

    function usarDiccionario(data, sourceLabel) {
        DATOS = data;
        const stats = construirIndice(DATOS);
        INDICE = stats.indice;
        setEstado(
            `${sourceLabel} · ${stats.entradas.toLocaleString('es')} entradas · ` +
            `${stats.formasUnicas.toLocaleString('es')} formas indexadas`,
            'ok'
        );
    }

    function looksLikeDict(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
        let keys;
        try { keys = Object.keys(obj); } catch (e) { return false; }
        if (keys.length < 3) return false;

        let hits = 0;
        const probe = Math.min(keys.length, 40);
        for (let i = 0; i < probe; i++) {
            const k = keys[i];
            if (!/^H?\d+$/.test(k)) continue;
            let v;
            try { v = obj[k]; } catch (e) { continue; }
            if (v && typeof v === 'object' &&
                (v.lemma || v.strongs_def || v.kjv_def || v.formas || v.xlit)) {
                hits++;
            }
        }
        return hits >= 3;
    }

    function buscarDiccionario() {
        for (const name of CANDIDATE_NAMES) {
            let v;
            try { v = window[name]; } catch (e) { continue; }
            if (looksLikeDict(v)) return { name, data: v };
        }
        let keys = [];
        try { keys = Object.keys(window); } catch (e) { keys = []; }
        for (const k of keys) {
            if (k.startsWith('__') || k === 'window' || k === 'self' || k === 'top') continue;
            let v;
            try { v = window[k]; } catch (e) { continue; }
            if (looksLikeDict(v)) return { name: k, data: v };
        }
        return null;
    }

    function cargarAutomatico() {
        setEstado('Cargando diccionario…');
        const found = buscarDiccionario();
        if (found) {
            usarDiccionario(found.data, `✓ window.${found.name}`);
            return true;
        }
        if (window.__DICT_LOAD_ERROR) {
            setEstado('✗ No se encontró hebrew_biblical_dict.js (usa el fallback mínimo)', 'err');
        } else {
            setEstado('✗ No se detectó un diccionario válido (usa el fallback mínimo)', 'err');
        }
        usarDiccionario(FALLBACK_DATOS, '⚠ fallback mínimo');
        return false;
    }

    function flashCopiado(btn, ok) {
        const original = btn.dataset.originalLabel || btn.textContent;
        btn.dataset.originalLabel = original;
        btn.textContent = ok ? '✓ Copiado' : '✗ Error';
        btn.classList.toggle('copied', ok);
        clearTimeout(btn._copyTimer);
        btn._copyTimer = setTimeout(() => {
            btn.textContent = original;
            btn.classList.remove('copied');
        }, 1600);
    }

    function renderizar(lineas) {
        const panelOut = obtenerElemento('panelOut');
        const panelWords = obtenerElemento('panelWords');

        const lineasNoVacias = lineas.filter(line => line.length > 0);

        if (lineasNoVacias.length === 0) {
            panelOut.hidden = true;
            panelWords.hidden = true;
            textoLiteralReciente = '';
            return;
        }

        const lineasLiteral = lineasNoVacias.map(items => {
            const parts = items.map((it) => {
                if (!it.res) return `[${it.raw}]`;
                return obtenerGlosaCorta(DATOS[it.res.keys[0]]);
            });
            let literal = parts.join(' ');
            literal = literal.charAt(0).toUpperCase() + literal.slice(1);
            if (literal && !/[.!?]$/.test(literal)) literal += '.';
            return literal;
        });

        textoLiteralReciente = lineasLiteral.join('\n');

        obtenerElemento('literal').innerHTML = lineasLiteral.join('<br>');
        panelOut.hidden = false;

        let wordsHtml = '';

        lineasNoVacias.forEach((items, index) => {
            wordsHtml += `<div class="line-separator">Línea ${index + 1}</div>`;

            const cardsHtml = items.map((it) => {
                if (!it.res) {
                    return `<div class="card unknown">
                        <div class="card-head">
                            <span class="heb">${escapar(it.raw)}</span>
                            <span class="translit">sin coincidencia</span>
                        </div>
                        <div class="muted">Esta forma no está en el diccionario cargado.</div>
                    </div>`;
                }

                const r = it.res;
                const affixNote =
                    r.type === 'prefix' ? `<span class="affix">prefijo: ${escapar(r.affix)}־</span>` :
                    r.type === 'suffix' ? `<span class="affix">sufijo: ־${escapar(r.affix)}</span>` :
                    `<span class="affix">exacta</span>`;

                const opts = r.keys.map((k) => {
                    const e = DATOS[k] || {};
                    const xlit = e.xlit ? ` · ${escapar(e.xlit)}` : '';
                    return `<div class="opt">
                        <span class="tag">${escapar(k)}</span>
                        <span class="gloss">${escapar(obtenerGlosaCorta(e))}</span>
                        <span class="translit">${xlit}</span>
                        ${e.strongs_def ? `<div class="def">${escapar(e.strongs_def)}</div>` : ''}
                        ${e.kjv_def ? `<div class="kjv">KJV: ${escapar(e.kjv_def)}</div>` : ''}
                    </div>`;
                }).join('');

                return `<div class="card">
                    <div class="card-head">
                        <span class="heb">${escapar(it.raw)}</span>
                        <span class="translit">forma base: ${escapar(r.form)}</span>
                        ${affixNote}
                    </div>
                    ${opts}
                </div>`;
            }).join('');

            wordsHtml += cardsHtml;
        });

        obtenerElemento('words').innerHTML = wordsHtml;
        panelWords.hidden = false;
    }

    function traducir() {
        const texto = obtenerElemento('input').value;
        renderizar(analizarTexto(texto, INDICE));
    }

    // --- INICIALIZACIÓN Y EVENTOS ---
    
    cargarAutomatico();

    obtenerElemento('btnGo').addEventListener('click', traducir);

    obtenerElemento('btnClear').addEventListener('click', () => {
        obtenerElemento('input').value = '';
        obtenerElemento('panelOut').hidden = true;
        obtenerElemento('panelWords').hidden = true;
        textoLiteralReciente = '';
        obtenerElemento('input').focus();
    });

    obtenerElemento('btnSample').addEventListener('click', () => {
        obtenerElemento('input').value = 'טחר בצביה קסת שן יש מח אם זך אם קב.\nשלום עולם\nאני אוהב את התנ"ך';
        traducir();
    });

    obtenerElemento('btnReload').addEventListener('click', () => {
        cargarAutomatico();
        traducir();
    });

    obtenerElemento('btnCopy').addEventListener('click', async (ev) => {
        const btn = ev.currentTarget;
        const text = textoLiteralReciente || '';
        const ok = await copiarAlPortapapeles(text);
        flashCopiado(btn, ok);
    });

    obtenerElemento('input').addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
            ev.preventDefault();
            traducir();
        }
    });

    obtenerElemento('file').addEventListener('change', async (ev) => {
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;
        try {
            const code = await f.text();
            const data = extraerDiccionario(code);
            usarDiccionario(data, `✓ ${f.name}`);
            traducir();
        } catch (err) {
            setEstado('✗ No se pudo leer el diccionario: ' + err.message, 'err');
        }
    });
}

// Llamada final al programa
programa();
