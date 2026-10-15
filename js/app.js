/* ============================================================
   Axis · asistente de David — demo.
   Dos caras del mismo sistema:
   1) el NÚMERO DE AXIS (WhatsApp Business del celular de David, en
      coexistencia): los clientes escriben, el agente responde lo común
      y David puede contestar desde su celular cuando quiera; si David
      entra a una charla, el agente se calla ahí por 2 horas.
   2) el ASISTENTE DE DAVID, en su línea personal: presupuestos con el
      tarifario del Drive, correos de Gmail, archivos del Drive y
      respuestas a clientes. Nada sale sin el OK de David.
   En producción: Kapso (coexistencia) + Claude + Gmail/Drive de David.
   Acá todo es simulado y vive en el navegador.
   ============================================================ */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const Gs = (n) => 'Gs ' + Math.round(n).toLocaleString('es-PY');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const fechaLarga = (d) => `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
const quitarAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const PRESENTACION = 'Buen día, soy el asistente virtual de Axis Constructora. ¿En qué puedo ayudarle?';
const PAUSA_MIN = 120; // si David contesta en una charla, el agente se calla 2 h ahí

/* ---------------- estado ---------------- */
let S;
function sembrar() {
  S = {
    reloj: new Date(2026, 9, 13, 9, 0),
    chats: {},
    orden: [],
    asis: [],
    actividad: [],
    pendiente: null,       // lo último que espera el OK de David
    borradorCorreo: null,
    presupuestos: [],
    abierto: null,         // chat abierto en el número de Axis
    como: 'david',         // en el número de Axis: escribir como David o como el cliente
    vista: 'negocio',
    noLeidoAsis: 0,
    tarifario: [
      { clave: 'porton', nombre: 'Pintura de portón metálico (antióxido + 2 manos)', unidad: 'm²', precio: 85000 },
      { clave: 'muralla', nombre: 'Pintura de muralla (2 manos)', unidad: 'm²', precio: 38000 },
      { clave: 'techo', nombre: 'Techo de chapa con estructura', unidad: 'm²', precio: 420000 },
      { clave: 'electrico', nombre: 'Punto eléctrico nuevo', unidad: 'unidad', precio: 180000 },
    ],
    drive: [
      { nombre: 'Tarifario Axis 2026.xlsx', carpeta: 'Administración', tipo: 'xls' },
      { nombre: 'Modelo de presupuesto Axis.docx', carpeta: 'Administración', tipo: 'doc' },
      { nombre: 'Contrato Lucía Ortiz - ampliación dormitorio.pdf', carpeta: 'Contratos 2026', tipo: 'pdf' },
      { nombre: 'Presupuesto 1040 - Carlos Giménez - techo quincho.pdf', carpeta: 'Presupuestos 2026', tipo: 'pdf' },
      { nombre: 'Planos quincho Luque.pdf', carpeta: 'Obras / Luque', tipo: 'pdf' },
      { nombre: 'Fotos obra Villa Morra', carpeta: 'Obras / Villa Morra', tipo: 'carpeta' },
      { nombre: 'Constancia de RUC Axis Business Group.pdf', carpeta: 'Empresa', tipo: 'pdf' },
    ],
    correos: [
      { de: 'Ricardo González', mail: 'rgonzalez@correo.com', asunto: 'Presupuesto para piscina en Loma Grande', resumen: 'quiere cotizar una piscina de 8×4 y pregunta cuándo pueden ir a ver el terreno', pide: true },
      { de: 'Proveedor Aceros del Este', mail: 'contaduria@aceros.com.py', asunto: 'Factura 001-002-0004512', resumen: 'factura de perfiles por Gs 4.350.000, vence el 20/10', pide: false },
      { de: 'Lucía Ortiz', mail: 'lortiz@correo.com', asunto: 'Documentos para el contrato', resumen: 'mandó copia de cédula y título de propiedad para el contrato', pide: false },
      { de: 'Estudio jurídico', mail: 'legal@estudio.com.py', asunto: 'Notificación formal · obra Piribebuy', resumen: 'notificación formal sobre la obra de Piribebuy; conviene que la leas vos', pide: false, delicado: true },
    ],
  };
  // clientes que ya venían hablando
  nuevoChat('+595972222222', 'Carlos Giménez', [
    { de: 'cliente', texto: 'Buenas, recibí el presupuesto del techo. Lo estoy viendo con mi señora.', min: -1440 },
    { de: 'asistente', texto: 'Perfecto, Carlos. Quedamos a disposición para cualquier consulta.', min: -1439 },
  ], { saludado: true, presupuesto: { numero: 1040, total: 10080000, anticipo: 60, condicion: '60 / 30 / 10 según contrato' }, obra: 'lunes 20 a las 08:00' });
  nuevoChat('+595973333333', 'Lucía Ortiz', [
    { de: 'cliente', texto: 'Gracias por todo, el jueves firmamos.', min: -2900 },
    { de: 'david', texto: 'Gracias a vos Lucía, te esperamos el jueves.', min: -2890 },
  ], { saludado: true });
  asisDice('Buen día David. Estoy conectado a tu Gmail, tu Drive y al número de Axis. Pedime lo que necesites: presupuestos, correos, archivos o respuestas a clientes.');
  S.noLeidoAsis = 0;
}

function nuevoChat(tel, nombre, msgs = [], extra = {}) {
  const c = { tel, nombre, mensajes: [], noLeidos: 0, pausaHasta: null, etapa: 'inicio', datos: {}, saludado: false, ...extra };
  msgs.forEach((m) => c.mensajes.push({ de: m.de, texto: m.texto, ts: new Date(S.reloj.getTime() + (m.min || 0) * 60000) }));
  S.chats[tel] = c;
  S.orden = [tel, ...S.orden.filter((t) => t !== tel)];
  return c;
}
function tic(min = 1) { S.reloj = new Date(S.reloj.getTime() + min * 60000); }
function actividad(tipo, texto) { S.actividad.unshift({ tipo, texto, ts: new Date(S.reloj) }); }

/* ---------------- envío de mensajes ---------------- */
function enChat(tel, de, texto, extra = {}) {
  const c = S.chats[tel];
  c.mensajes.push({ de, texto, ts: new Date(S.reloj), ...extra });
  S.orden = [tel, ...S.orden.filter((t) => t !== tel)];
  if (de === 'cliente' && S.abierto !== tel) c.noLeidos++;
}
function asisDice(texto, extra = {}) {
  S.asis.push({ de: 'asistente', texto, ts: new Date(S.reloj), ...extra });
  if (S.vista !== 'asistente' || window.innerWidth > 1100) S.noLeidoAsis++;
}
function avisarADavid(texto, botones = []) {
  tic(); asisDice(texto, { botones, aviso: true });
  aviso('Tu asistente te escribió en tu línea personal');
}

/* ================= 1. el agente en el número de Axis ================= */
function clienteEscribe(tel, texto, { nombre = null, foto = false } = {}) {
  tic();
  let c = S.chats[tel];
  if (!c) c = nuevoChat(tel, nombre || 'Contacto ' + tel.slice(-4));
  enChat(tel, 'cliente', foto ? '📷 ' + texto : texto, { foto });
  // David está atendiendo esta charla: el agente no se mete
  if (c.pausaHasta && c.pausaHasta > S.reloj) {
    actividad('pausa', `${c.nombre} escribió y David está atendiendo esa charla: el asistente no responde (hasta las ${hhmm(c.pausaHasta)}).`);
    return;
  }
  setTimeout(() => { agente(c, texto, foto); render(); }, 450);
}
function agenteDice(c, texto, extra) { tic(); enChat(c.tel, 'asistente', texto, extra); }

function agente(c, texto, foto) {
  const t = quitarAcentos(texto);
  const nom = c.nombre.split(' ')[0];
  if (!c.saludado) { c.saludado = true; agenteDice(c, PRESENTACION); }

  // urgente: no se resuelve, se avisa ya
  if (/peligro|urgente|derrumb|incendio|chispa|cano|agua|herid|se cayo|se rompio/.test(t)) {
    agenteDice(c, `Entendido, ${nom}. Ya le avisé a David como urgente y se comunica con usted enseguida. Si hay riesgo para alguien, por favor aléjese del lugar.`);
    avisarADavid(`URGENTE · ${c.nombre} escribió al número de Axis: "${texto}". No le prometí nada, solo que te comunicás vos.`, ['Abrir la charla']);
    actividad('alerta', `Aviso urgente a David por el mensaje de ${c.nombre}.`);
    return;
  }
  if (/reclam|mal hecho|incumpl|devolu|abogad|estafa/.test(t)) {
    agenteDice(c, `Lamento el inconveniente, ${nom}. Le paso su mensaje directamente a David, que le responde personalmente.`);
    avisarADavid(`Reclamo de ${c.nombre}: "${texto}". Lo dejé para vos, no respondí nada de fondo.`, ['Abrir la charla']);
    actividad('alerta', `Reclamo de ${c.nombre} pasado a David.`);
    return;
  }
  if (foto) {
    agenteDice(c, 'Recibido, gracias. David lo revisa y le confirmamos por acá.');
    avisarADavid(`${c.nombre} mandó una foto (parece un comprobante). Revisala cuando puedas: no confirmé el pago.`, ['Abrir la charla']);
    return;
  }

  // flujo de presupuesto
  if (c.etapa === 'ubicacion') {
    c.datos.ubicacion = texto.trim(); c.etapa = 'medidas';
    return agenteDice(c, 'Gracias. ¿Tiene las medidas aproximadas o fotos? Si prefiere, coordinamos una visita sin costo.');
  }
  if (c.etapa === 'medidas') {
    const p = t.match(/porton[^\d]{0,30}(\d+[.,]?\d*)/); const m = t.match(/muralla[^\d]{0,30}(\d+[.,]?\d*)/);
    if (p || m || /visita/.test(t)) {
      if (p) c.datos.porton = parseFloat(p[1].replace(',', '.'));
      if (m) c.datos.muralla = parseFloat(m[1].replace(',', '.'));
      c.etapa = 'esperando_presupuesto';
      agenteDice(c, 'Perfecto, con eso preparamos el presupuesto. David lo revisa y se lo enviamos por acá hoy mismo.');
      const det = [c.datos.porton && `portón ${c.datos.porton} m²`, c.datos.muralla && `muralla ${c.datos.muralla} m²`].filter(Boolean).join(' y ');
      S.pendiente = { tipo: 'armar', tel: c.tel };
      avisarADavid(`Pedido de presupuesto · ${c.nombre} (${c.datos.ubicacion || 'sin ubicación'}): pintura de ${det || 'portón y muralla'}. ¿Te lo armo con el tarifario del Drive?`, ['Armalo', 'Lo veo yo']);
      actividad('whatsapp', `Atendió a ${c.nombre}: tomó ubicación y medidas, y le pasó el pedido a David.`);
      return;
    }
  }

  // respuestas verificables
  if (/con cuanto|anticipo|sena|para iniciar|para empezar/.test(t)) {
    if (c.presupuesto) return agenteDice(c, `Según el presupuesto ${c.presupuesto.numero}, para iniciar se requiere un anticipo del ${c.presupuesto.anticipo}% (${Gs(c.presupuesto.total * c.presupuesto.anticipo / 100)}), condición: ${c.presupuesto.condicion}. Cuando quiera avanzar le pasamos los datos para la transferencia.`);
    return agenteDice(c, 'El anticipo depende de cada presupuesto. Cuando tenga el suyo, ahí figura la condición exacta.');
  }
  if (/cambiar|pasar|mover|postergar|adelantar/.test(t) && /inicio|obra|fecha|lunes|martes|miercoles|jueves|viernes/.test(t)) {
    agenteDice(c, 'Se lo consulto a David y le respondemos por acá.');
    avisarADavid(`${c.nombre} pide cambiar la fecha de inicio${c.obra ? ` (hoy está para el ${c.obra})` : ''}: "${texto}". ¿Le contestás vos o le digo algo?`, ['Abrir la charla']);
    return;
  }
  if (/donde estan|direccion|ubicados/.test(t)) return agenteDice(c, 'Estamos en Ingavi N° 2570 c/ Cap. Caballero, Asunción. Atendemos de lunes a viernes de 08:30 a 12:00 y de 13:00 a 18:00.');
  if (/horario|a que hora atienden/.test(t)) return agenteDice(c, 'Atendemos de lunes a viernes de 08:30 a 12:00 y de 13:00 a 18:00.');
  if (/que hacen|servicios|a que se dedican/.test(t)) return agenteDice(c, 'Hacemos construcción, reformas y mantenimiento: viviendas, ampliaciones, pintura de portones y murallas, techos, instalaciones eléctricas, vestuarios y saunas. ¿Qué trabajo tiene en mente?');
  if (/^(gracias|ok|dale|perfecto|genial|listo)\b/.test(t)) return agenteDice(c, 'Con gusto. Estamos a disposición.');
  if (/presupuest|cotiz|pint|porton|muralla|techo|reforma|ampliac|electric|piscina|quincho/.test(t)) {
    c.etapa = 'ubicacion';
    actividad('whatsapp', `Nuevo pedido por WhatsApp de ${c.nombre}: "${texto}".`);
    return agenteDice(c, 'Con gusto le ayudo. Para preparar el presupuesto, ¿en qué ciudad o barrio está el inmueble?');
  }
  // no sé: no invento
  agenteDice(c, 'Se lo consulto a David y le respondemos por acá.');
  avisarADavid(`${c.nombre} preguntó: "${texto}". No tengo una respuesta segura, ¿le contestás vos o me decís qué decirle?`, ['Abrir la charla']);
}

/* David contesta desde su celular, en el número de Axis */
function davidEscribeEnNegocio(tel, texto) {
  tic();
  const c = S.chats[tel];
  enChat(tel, 'david', texto);
  c.pausaHasta = new Date(S.reloj.getTime() + PAUSA_MIN * 60000);
  actividad('pausa', `David contestó a ${c.nombre} desde su celular. El asistente se calla en esa charla hasta las ${hhmm(c.pausaHasta)}.`);
}

/* ================= 2. el asistente personal de David ================= */
function davidPide(texto) {
  tic();
  S.asis.push({ de: 'david', texto, ts: new Date(S.reloj) });
  setTimeout(() => { asistente(texto); render(); }, 500);
}

function asistente(texto) {
  const t = quitarAcentos(texto);
  const dice = (txt, extra) => { tic(); asisDice(txt, extra); };

  // --- presupuestos ---
  if (/^arm(a|á)lo|arma(le)? el presupuesto|arm(a|á) el presupuesto|hace(le)? el presupuesto/.test(t)) {
    const tel = S.pendiente?.tel || Object.values(S.chats).find((c) => c.etapa === 'esperando_presupuesto')?.tel;
    if (!tel) return dice('No tengo un pedido de presupuesto pendiente. Decime para quién y qué trabajo, por ejemplo: "armale a María pintura de portón 12 m² y muralla 40 m²".');
    return armarPresupuesto(S.chats[tel]);
  }
  if (/^lo veo yo/.test(t)) { S.pendiente = null; return dice('Perfecto, queda para vos. La charla está en el número de Axis.'); }
  const cambio = t.match(/(cambia|pone|subi|baja)[a-z]*\s+(el\s+|la\s+)?(porton|muralla)[^\d]*(\d+[.,]?\d*)/);
  if (cambio) {
    const p = S.presupuestos.slice(-1)[0];
    if (!p || p.estado === 'enviado') return dice('No tengo un presupuesto en borrador para cambiar.');
    const c = S.chats[p.tel]; c.datos[cambio[3]] = parseFloat(cambio[4].replace(',', '.'));
    return armarPresupuesto(c, true);
  }
  if (/^(mandalo|mandaselo|envialo|enviaselo|si,? mandalo|dale,? mandalo|manda)/.test(t) || (t === 'dale' && S.pendiente?.tipo === 'enviar')) {
    if (S.pendiente?.tipo !== 'enviar') return dice('No tengo nada esperando para mandar.');
    return enviarPresupuesto();
  }
  if (/^cambiar algo/.test(t)) return dice('Decime qué cambio, por ejemplo: "cambiá la muralla a 45 m²".');

  // --- correos ---
  if (/correo|mail|bandeja/.test(t) && /resum|que (tengo|hay|me llego)|leeme|novedades|hoy/.test(t)) {
    actividad('gmail', 'Leyó tu Gmail: 4 correos nuevos.');
    return dice(`Tenés 4 correos nuevos:\n${S.correos.map((m, i) => `${i + 1}. ${m.de} · ${m.asunto}: ${m.resumen}.`).join('\n')}\nEl de ${S.correos.find((m) => m.delicado).de} conviene que lo leas vos. ¿Querés que le conteste a alguno?`);
  }
  const resp = t.match(/(respondele|contestale|escribile|decile)\s+a\s+([a-z]+)\s+(que\s+)?(.+)/);
  if (resp) {
    const quien = resp[2]; const que = texto.slice(texto.toLowerCase().indexOf(resp[4].slice(0, 6)));
    const mail = S.correos.find((m) => quitarAcentos(m.de).includes(quien));
    const chat = Object.values(S.chats).find((c) => quitarAcentos(c.nombre).includes(quien));
    if (mail && !(chat && /whats|wasap|por aca/.test(t))) {
      const cuerpo = `Buen día Sr. ${mail.de.split(' ').slice(-1)[0]}. Gracias por escribirnos. ${que.charAt(0).toUpperCase() + que.slice(1).replace(/\.$/, '')}. Quedamos a disposición.\n\nDavid Sánchez\nAxis Constructora`;
      S.borradorCorreo = { mail, cuerpo }; S.pendiente = { tipo: 'correo' };
      actividad('gmail', `Preparó un borrador para ${mail.de}.`);
      return dice(`Borrador para ${mail.de} (${mail.mail}) · Re: ${mail.asunto}\n\n${cuerpo}\n\n¿Lo envío?`, { botones: ['Enviar', 'Cambiar algo'] });
    }
    if (chat) {
      S.pendiente = { tipo: 'whatsapp', tel: chat.tel, texto: que.charAt(0).toUpperCase() + que.slice(1) };
      return dice(`Le escribo a ${chat.nombre} por el número de Axis:\n"${S.pendiente.texto}"\n¿Lo mando?`, { botones: ['Enviar', 'Cambiar algo'] });
    }
    return dice(`No encuentro a "${resp[2]}" ni en tus correos ni en los chats del número de Axis.`);
  }
  if (/^(enviar|envialo|si,? envia|dale)$/.test(t) || /^enviar\b/.test(t)) {
    if (S.pendiente?.tipo === 'correo') {
      const { mail } = S.borradorCorreo; S.pendiente = null; S.borradorCorreo = null;
      actividad('gmail', `Envió desde tu Gmail la respuesta a ${mail.de}.`);
      return dice(`Enviado desde tu Gmail a ${mail.de}. Queda en Enviados con el hilo original.`);
    }
    if (S.pendiente?.tipo === 'whatsapp') {
      const { tel, texto: txt } = S.pendiente; S.pendiente = null;
      tic(); enChat(tel, 'asistente', txt);
      actividad('whatsapp', `Le escribió a ${S.chats[tel].nombre} por el número de Axis, por pedido de David.`);
      return dice(`Listo, se lo mandé a ${S.chats[tel].nombre} desde el número de Axis.`);
    }
    if (S.pendiente?.tipo === 'enviar') return enviarPresupuesto();
    return dice('No tengo nada esperando para enviar.');
  }

  // --- drive ---
  if (/busca|encontra|pasame|donde (esta|quedo)|drive|archivo/.test(t)) {
    const VACIAS = new Set(['buscame', 'busca', 'buscar', 'encontrame', 'encontra', 'pasame', 'drive', 'archivo', 'donde', 'esta', 'quedo', 'por', 'favor', 'los', 'las', 'del', 'que', 'mi', 'en']);
    const palabras = t.replace(/[^a-z0-9ñ ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !VACIAS.has(w));
    const hall = S.drive.map((f) => ({ f, p: palabras.filter((w) => quitarAcentos(f.nombre).includes(w)).length })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p).slice(0, 3).map((x) => x.f);
    actividad('drive', `Buscó en tu Drive: "${palabras.join(' ')}".`);
    if (!hall.length) return dice('No encontré nada con ese nombre en tu Drive. ¿Me das otra palabra?');
    return dice(hall.length === 1 ? `Lo encontré en Drive › ${hall[0].carpeta}. ¿Se lo mando a alguien?` : `Encontré ${hall.length} archivos:`, { archivos: hall });
  }

  // --- pendientes del número de Axis ---
  if (/sin contestar|sin responder|pendiente|que me escribieron|whats|wasap|quien me escribio/.test(t)) {
    const aten = Object.values(S.chats).filter((c) => c.pausaHasta && c.pausaHasta > S.reloj);
    const pend = Object.values(S.chats).filter((c) => { const u = c.mensajes[c.mensajes.length - 1]; return u && u.de === 'cliente' && !aten.includes(c); });
    return dice(`${pend.length ? `Esperan respuesta: ${pend.map((c) => `${c.nombre} ("${c.mensajes[c.mensajes.length - 1].texto.slice(0, 50)}")`).join('; ')}.` : 'No hay clientes esperando respuesta en el número de Axis.'}${aten.length ? ` Estás atendiendo vos: ${aten.map((c) => c.nombre).join(', ')}.` : ''}`);
  }
  if (/abrir la charla/.test(t)) { ir('negocio'); return; }
  if (/^(hola|buen dia|buenas)/.test(t)) return dice('Buen día David. Probá: "resumime los correos", "buscame el contrato de Lucía", "qué tengo sin contestar" o "respondele a González que el jueves a las 10 vamos a ver el terreno".');
  return dice('Puedo ayudarte con: presupuestos ("armalo", "cambiá la muralla a 45 m²", "mandalo"), correos ("resumime los correos", "respondele a González que…"), Drive ("buscame el contrato de Lucía") y WhatsApp ("qué tengo sin contestar", "decile a Carlos que…").');
}

function armarPresupuesto(c, esCambio = false) {
  const items = [];
  if (c.datos.porton) items.push({ ...S.tarifario.find((x) => x.clave === 'porton'), cant: c.datos.porton });
  if (c.datos.muralla) items.push({ ...S.tarifario.find((x) => x.clave === 'muralla'), cant: c.datos.muralla });
  if (!items.length) items.push({ ...S.tarifario.find((x) => x.clave === 'porton'), cant: 10 });
  const total = items.reduce((s, i) => s + i.cant * i.precio, 0);
  let p = S.presupuestos.find((x) => x.tel === c.tel && x.estado === 'borrador');
  if (!p) { p = { numero: 1041 + S.presupuestos.length, tel: c.tel, cliente: c.nombre, ubicacion: c.datos.ubicacion, version: 0, estado: 'borrador' }; S.presupuestos.push(p); }
  Object.assign(p, { items, total, anticipo: 70, fecha: new Date(S.reloj), version: p.version + 1 });
  S.pendiente = { tipo: 'enviar', numero: p.numero };
  actividad('drive', esCambio ? `Actualizó el presupuesto ${p.numero} (versión ${p.version}).` : `Leyó el Tarifario Axis 2026 del Drive y armó el presupuesto ${p.numero} para ${c.nombre}.`);
  tic();
  asisDice(`${esCambio ? 'Actualizado' : 'Listo, lo armé con el Tarifario Axis 2026 de tu Drive'}: ${items.map((i) => `${i.nombre.split(' (')[0].toLowerCase()} ${i.cant} ${i.unidad}`).join(' + ')}. Total ${Gs(total)}, IVA incluido, anticipo 70%. ¿Se lo mando a ${c.nombre.split(' ')[0]}?`, { pdf: p.numero, botones: ['Mandalo', 'Cambiar algo'] });
}
function enviarPresupuesto() {
  const p = S.presupuestos.find((x) => x.numero === S.pendiente.numero);
  p.estado = 'enviado'; S.pendiente = null;
  const c = S.chats[p.tel];
  c.presupuesto = { numero: p.numero, total: p.total, anticipo: p.anticipo, condicion: '70% al inicio' };
  c.etapa = 'presupuesto_enviado';
  tic(); enChat(p.tel, 'asistente', `Buen día ${c.nombre.split(' ')[0]}. Le enviamos el presupuesto ${p.numero} por ${Gs(p.total)}, IVA incluido. Para iniciar se requiere un anticipo del ${p.anticipo}% (${Gs(p.total * p.anticipo / 100)}). Quedamos a disposición para cualquier consulta.`, { pdf: p.numero });
  actividad('drive', `Guardó "Presupuesto ${p.numero} - ${p.cliente}.pdf" en Drive › Presupuestos 2026.`);
  actividad('whatsapp', `Mandó el presupuesto ${p.numero} a ${p.cliente} desde el número de Axis.`);
  S.drive.push({ nombre: `Presupuesto ${p.numero} - ${p.cliente}.pdf`, carpeta: 'Presupuestos 2026', tipo: 'pdf' });
  tic(); asisDice(`Enviado a ${p.cliente} desde el número de Axis, y guardado en Drive › Presupuestos 2026. Si en 2 días no responde, te aviso.`);
}

/* ---------------- render ---------------- */
function render() {
  renderNegocio(); renderAsistente(); renderActividad();
  const nNeg = Object.values(S.chats).reduce((n, c) => n + c.noLeidos, 0);
  $('#nNeg').textContent = nNeg || ''; $('#nAsis').textContent = S.noLeidoAsis || '';
  $('#nAct').textContent = S.actividad.length || '';
}

const VISTOS = {}; // cuántos mensajes ya se mostraron por chat: solo se animan los nuevos
function burbuja(m, lado, nueva = false) {
  const quien = m.de === 'asistente' && lado === 'negocio' ? '<span class="autor ia">Asistente</span>' : m.de === 'david' && lado === 'negocio' ? '<span class="autor">David</span>' : '';
  const pdf = m.pdf ? `<button class="adj pdf" data-pdf="${m.pdf}"><i>PDF</i><span>Presupuesto ${m.pdf}${(() => { const p = S.presupuestos.find((x) => x.numero === m.pdf); return p ? ' - ' + esc(p.cliente) : ''; })()}.pdf<small>tocar para ver</small></span></button>` : '';
  const arch = (m.archivos || []).map((f) => `<div class="adj ${f.tipo}"><i>${{ pdf: 'PDF', xls: 'XLS', doc: 'DOC', carpeta: 'DIR' }[f.tipo]}</i><span>${esc(f.nombre)}<small>Drive › ${esc(f.carpeta)}</small></span></div>`).join('');
  return `<div class="burbuja ${m.mia ? 'mia' : ''} ${m.aviso ? 'alerta' : ''} ${nueva ? 'nueva' : ''}">${quien}${esc(m.texto).replace(/\n/g, '<br>')}${pdf}${arch}<span class="hora">${hhmm(m.ts)}</span></div>`;
}

function renderNegocio() {
  const cab = $('#negCab'), cuerpo = $('#negCuerpo');
  if (!S.abierto) {
    cab.innerHTML = `<div class="avatar oro"><img src="img/x-axis.svg" alt=""></div><div><div class="wa-nombre">Axis Constructora | HSI</div><div class="wa-sub">WhatsApp Business · celular de David</div></div>`;
    cuerpo.className = 'wa-cuerpo lista';
    cuerpo.innerHTML = S.orden.map((tel) => {
      const c = S.chats[tel]; const u = c.mensajes[c.mensajes.length - 1];
      const at = c.pausaHasta && c.pausaHasta > S.reloj;
      return `<button class="item" data-abrir="${tel}"><div class="avatar">${esc(c.nombre.split(' ').map((w) => w[0]).join('').slice(0, 2))}</div><div class="item-txt"><div class="item-l1"><b>${esc(c.nombre)}</b><span class="${c.noLeidos ? 'verde' : ''}">${u ? hhmm(u.ts) : ''}</span></div><div class="item-l2"><span>${u ? (u.de === 'asistente' ? '<em>Asistente:</em> ' : u.de === 'david' ? '<em>Vos:</em> ' : '') + esc(u.texto.slice(0, 60)) : ''}</span>${c.noLeidos ? `<b class="cont">${c.noLeidos}</b>` : ''}</div>${at ? '<div class="chip-atiende">Atendés vos · asistente en pausa</div>' : ''}</div></button>`;
    }).join('') || '<p class="vacio">Sin conversaciones.</p>';
    $('#negComo').innerHTML = ''; $('#negForm').classList.add('oculto');
    return;
  }
  const c = S.chats[S.abierto]; c.noLeidos = 0;
  const at = c.pausaHasta && c.pausaHasta > S.reloj;
  cab.innerHTML = `<button class="atras" data-atras="1" title="Volver"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><div class="avatar">${esc(c.nombre.split(' ').map((w) => w[0]).join('').slice(0, 2))}</div><div class="crece"><div class="wa-nombre">${esc(c.nombre)}</div><div class="wa-sub">${at ? `Atendés vos · asistente en pausa hasta las ${hhmm(c.pausaHasta)}` : 'El asistente responde lo común'}</div></div>${at ? '<button class="reanudar" data-reanudar="1">Devolver al asistente</button>' : ''}`;
  cuerpo.className = 'wa-cuerpo chat';
  const vistos = VISTOS[c.tel] ?? c.mensajes.length;
  cuerpo.innerHTML = c.mensajes.map((m, i) => burbuja({ ...m, mia: m.de !== 'cliente' }, 'negocio', i >= vistos)).join('');
  VISTOS[c.tel] = c.mensajes.length;
  cuerpo.scrollTop = cuerpo.scrollHeight;
  $('#negForm').classList.remove('oculto');
  $('#negComo').innerHTML = `<button type="button" data-como="david" class="${S.como === 'david' ? 'activo' : ''}">Escribo yo (David)</button><button type="button" data-como="cliente" class="${S.como === 'cliente' ? 'activo' : ''}">Simular al cliente</button>`;
  $('#negInput').placeholder = S.como === 'david' ? 'Responder como David…' : `Escribir como ${c.nombre.split(' ')[0]}…`;
}

function renderAsistente() {
  const chat = $('#asisChat');
  const vistos = VISTOS.asis ?? S.asis.length;
  chat.innerHTML = S.asis.map((m, i) => burbuja({ ...m, mia: m.de === 'david' }, 'asistente', i >= vistos)).join('');
  VISTOS.asis = S.asis.length;
  chat.scrollTop = chat.scrollHeight;
  const u = S.asis[S.asis.length - 1];
  $('#asisBotones').innerHTML = u && u.de === 'asistente' && u.botones?.length ? u.botones.map((b) => `<button data-resp="${esc(b)}">${esc(b)}</button>`).join('') : '';
}

const ICO = { whatsapp: 'W', gmail: 'M', drive: 'D', alerta: '!', pausa: 'II' };
const ETI = { whatsapp: 'WhatsApp', gmail: 'Gmail', drive: 'Drive', alerta: 'Aviso a David', pausa: 'David atiende' };
function renderActividad() {
  $('#panActividad').innerHTML = S.actividad.length ? S.actividad.map((a) => `<div class="act ${a.tipo}"><i>${ICO[a.tipo]}</i><div><small>${ETI[a.tipo]} · ${hhmm(a.ts)}</small>${esc(a.texto)}</div></div>`).join('') : '<p class="vacio">Todavía nada. Seguí el guión.</p>';
}

/* ---------------- guión ---------------- */
const M = '+595971111111';
const GUION = [
  { t: 'Un cliente nuevo escribe al número de Axis', d: 'El asistente atiende, toma los datos y le pasa el pedido a David.', pasos: [
    { cliente: M, nombre: 'María Benítez', txt: 'Hola, buenas. Necesito presupuesto para pintar el portón y la muralla de mi casa' },
    { cliente: M, txt: 'Lambaré, barrio Santa Rosa' },
    { cliente: M, txt: 'El portón tiene unos 12 m² y la muralla unos 40 m²' } ] },
  { t: 'David arma el presupuesto desde su línea personal', d: 'Con el tarifario del Drive. Nada sale sin su OK.', pasos: [
    { david: 'Armalo' }, { david: 'Cambiá la muralla a 45 m²' }, { nota: 'Tocá el PDF en el chat para ver el presupuesto.' }, { david: 'Mandalo' },
    { cliente: M, txt: 'Perfecto, ¿con cuánto se inicia?' } ] },
  { t: 'David contesta él mismo y el asistente se corre', d: 'Mismo número, los dos pueden responder.', pasos: [
    { cliente: '+595972222222', txt: 'Buenas, ¿podemos pasar el inicio de la obra al martes?' },
    { abrir: '+595972222222', txt: 'Abrir la charla de Carlos en el número de Axis' },
    { negocioDavid: '+595972222222', txt: 'Sí Carlos, el martes a las 8 sin problema' },
    { cliente: '+595972222222', txt: 'Genial, gracias David' },
    { nota: 'El asistente no se mete: David está atendiendo esa charla. Con "Devolver al asistente" vuelve a responder.' } ] },
  { t: 'Correo y Drive', d: 'Todo desde el chat, sin abrir la compu.', pasos: [
    { david: 'Resumime los correos de hoy' },
    { david: 'Respondele a González que el jueves a las 10 vamos a ver el terreno' },
    { david: 'Enviar' },
    { david: 'Buscame el contrato de Lucía' } ] },
  { t: 'Lo que el asistente nunca resuelve solo', d: 'Urgencias, reclamos y pagos van directo a David.', pasos: [
    { cliente: '+595973333333', txt: 'David, se rompió un caño en la obra y está saliendo agua, es urgente' },
    { cliente: '+595973333333', txt: 'Le mando el comprobante de la transferencia', foto: true },
    { david: '¿Qué tengo sin contestar?' } ] },
];
function renderGuion() {
  $('#panGuion').innerHTML = `<p class="intro">Tocá cada paso en orden. A la izquierda ves el número de Axis; en el medio, la línea personal de David con su asistente.</p>` +
    GUION.map((g, i) => `<details ${i < 2 ? 'open' : ''}><summary><b>${i + 1}</b>${esc(g.t)}</summary><p class="desc">${esc(g.d)}</p>${g.pasos.map((p) => {
      if (p.nota) return `<p class="nota">${esc(p.nota)}</p>`;
      if (p.david) return `<button class="paso" data-paso='${esc(JSON.stringify(p))}'><span class="quien d">David → asistente</span>${esc(p.david)}</button>`;
      if (p.abrir) return `<button class="paso accion" data-paso='${esc(JSON.stringify(p))}'>${esc(p.txt)}</button>`;
      if (p.negocioDavid) return `<button class="paso" data-paso='${esc(JSON.stringify(p))}'><span class="quien d">David responde desde su celular</span>${esc(p.txt)}</button>`;
      const nom = p.nombre || S.chats[p.cliente]?.nombre || (p.cliente === M ? 'María Benítez' : 'Cliente');
      return `<button class="paso" data-paso='${esc(JSON.stringify({ ...p, nombre: nom }))}'><span class="quien c">${esc(nom)} → número de Axis</span>${p.foto ? '📷 ' : ''}${esc(p.txt)}</button>`;
    }).join('')}</details>`).join('');
}

/* ---------------- vista del presupuesto ---------------- */
function abrirPDF(numero) {
  const p = S.presupuestos.find((x) => x.numero === numero); if (!p) return;
  const iva = p.total / 11;
  $('#modalTit').textContent = `Presupuesto ${p.numero} - ${p.cliente}.pdf`;
  $('#hoja').innerHTML = `
    <div class="h-cab"><div class="h-marca"><img src="img/x-axis.svg" alt=""><div><b>AXIS</b><span>BUSINESS GROUP S.A.</span></div></div>
      <div class="h-num"><span>PRESUPUESTO</span><b>N° ${p.numero}</b><small>${fechaLarga(p.fecha)}${p.version > 1 ? ` · versión ${p.version}` : ''}</small></div></div>
    <div class="h-datos"><div><small>Cliente</small><b>${esc(p.cliente)}</b></div><div><small>Ubicación de la obra</small><b>${esc(p.ubicacion || '—')}</b></div><div><small>Validez</small><b>15 días</b></div></div>
    <table class="h-tabla"><thead><tr><th>Descripción</th><th>Cant.</th><th>Precio unit.</th><th>Subtotal</th></tr></thead><tbody>
      ${p.items.map((i) => `<tr><td>${esc(i.nombre)}</td><td>${i.cant} ${i.unidad}</td><td>${Gs(i.precio)}</td><td>${Gs(i.cant * i.precio)}</td></tr>`).join('')}
    </tbody></table>
    <div class="h-tot"><div><span>IVA 10% incluido</span><span>${Gs(iva)}</span></div><div class="grande"><span>Total</span><span>${Gs(p.total)}</span></div><div><span>Anticipo para iniciar (${p.anticipo}%)</span><span>${Gs(p.total * p.anticipo / 100)}</span></div></div>
    <div class="h-cond"><b>Condiciones</b><ul><li>Incluye materiales y mano de obra.</li><li>El saldo se abona según avance de obra, de acuerdo al contrato.</li><li>Precios del tarifario vigente al ${p.fecha.getDate()}/${p.fecha.getMonth() + 1}/${p.fecha.getFullYear()}.</li></ul></div>
    <div class="h-pie"><div class="firma"><span></span>David Sánchez<br><small>Axis Business Group S.A.</small></div><div class="h-contacto">Ingavi N° 2570 c/ Cap. Caballero, Asunción<br>Lunes a viernes, 08:30 a 12:00 y 13:00 a 18:00</div></div>`;
  $('#modal').classList.remove('oculto');
}

/* ---------------- navegación y eventos ---------------- */
function ir(v) {
  S.vista = v; if (v === 'asistente') S.noLeidoAsis = 0;
  $$('#abajo button').forEach((b) => b.classList.toggle('activa', b.dataset.ir === v));
  $$('.col').forEach((c) => c.classList.toggle('visible', c.dataset.vista === v));
  render();
}
let avisoT; function aviso(t) { const a = $('#aviso'); a.textContent = t; a.classList.add('ver'); clearTimeout(avisoT); avisoT = setTimeout(() => a.classList.remove('ver'), 2600); }

document.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.abrir) { S.abierto = b.dataset.abrir; render(); }
  if (b.dataset.atras) { S.abierto = null; render(); }
  if (b.dataset.como) { S.como = b.dataset.como; render(); }
  if (b.dataset.reanudar) { const c = S.chats[S.abierto]; c.pausaHasta = null; actividad('pausa', `David devolvió la charla de ${c.nombre} al asistente.`); render(); }
  if (b.dataset.resp) { if (b.dataset.resp === 'Abrir la charla') { const tel = S.orden[0]; S.abierto = tel; ir('negocio'); } else davidPide(b.dataset.resp); render(); }
  if (b.dataset.pdf) abrirPDF(+b.dataset.pdf);
  if (b.dataset.ir) ir(b.dataset.ir);
  if (b.dataset.pest) { $$('.pestanas button').forEach((x) => x.classList.toggle('activa', x === b)); $('#panGuion').classList.toggle('oculto', b.dataset.pest !== 'guion'); $('#panActividad').classList.toggle('oculto', b.dataset.pest !== 'actividad'); }
  if (b.dataset.paso) {
    const p = JSON.parse(b.dataset.paso); b.classList.add('hecho');
    if (p.david) { davidPide(p.david); if (window.innerWidth <= 1100) ir('asistente'); }
    else if (p.abrir) { S.abierto = p.abrir; if (window.innerWidth <= 1100) ir('negocio'); }
    else if (p.negocioDavid) { S.abierto = p.negocioDavid; davidEscribeEnNegocio(p.negocioDavid, p.txt); if (window.innerWidth <= 1100) ir('negocio'); }
    else { clienteEscribe(p.cliente, p.txt, { nombre: p.nombre, foto: !!p.foto }); if (window.innerWidth <= 1100) ir('negocio'); }
    render();
  }
  if (b.id === 'btnCerrar') $('#modal').classList.add('oculto');
  if (b.id === 'btnImprimir') window.print();
  if (b.id === 'btnReiniciar') { Object.keys(VISTOS).forEach((k) => delete VISTOS[k]); sembrar(); renderGuion(); ir(window.innerWidth <= 1100 ? 'negocio' : S.vista); aviso('Demo reiniciada'); }
});
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('#modal').classList.add('oculto'); });
$('#negForm').addEventListener('submit', (e) => {
  e.preventDefault(); const t = $('#negInput').value.trim(); if (!t || !S.abierto) return; $('#negInput').value = '';
  if (S.como === 'david') davidEscribeEnNegocio(S.abierto, t); else clienteEscribe(S.abierto, t);
  render();
});
$('#asisForm').addEventListener('submit', (e) => { e.preventDefault(); const t = $('#asisInput').value.trim(); if (!t) return; $('#asisInput').value = ''; davidPide(t); render(); });

/* ---------------- arranque ---------------- */
sembrar(); renderGuion(); ir('negocio');
