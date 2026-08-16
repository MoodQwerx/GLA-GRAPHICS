const DIAGNOSTIC_FONTS = [
  'GLA Anton',
  'Akzidenz-Grotesk BQ Condensed',
  'Arial Narrow',
  'Arial',
];

const PRIORITY_TEXT_SELECTORS = [
  '.score-home',
  '.score-away',
  '.score-goals',
  '.ov-score-team-name',
  '.ov-score-value',
  '.ov-short-name',
  '.ov-short-role',
  '.ov-long-name',
  '.ov-long-role',
  '.ov-cambio-title',
  '.ov-cambio-team',
  '.ov-var-title',
  '.ov-vs-team-name',
  '.ov-side-cell',
  '.ov-estrellas-name',
  '.ov-estrellas-stat',
  '.ov-pos-cell',
  '.ov-performance-name',
  '.ov-performance-stat',
];

function number(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null;
}

function rectData(rect) {
  return {
    x: number(rect.x),
    y: number(rect.y),
    width: number(rect.width),
    height: number(rect.height),
    top: number(rect.top),
    right: number(rect.right),
    bottom: number(rect.bottom),
    left: number(rect.left),
  };
}

function matrixScale(transform) {
  if (!transform || transform === 'none') return { x: 1, y: 1 };
  try {
    const Matrix = window.DOMMatrixReadOnly || window.WebKitCSSMatrix;
    const matrix = new Matrix(transform);
    return {
      x: number(Math.hypot(matrix.a, matrix.b)),
      y: number(Math.hypot(matrix.c, matrix.d)),
    };
  } catch (error) {
    return { error: String(error) };
  }
}

function cssPath(element) {
  if (element.id) return `#${element.id}`;
  const parts = [];
  let current = element;
  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
    let part = current.tagName.toLowerCase();
    if (current.classList.length) part += `.${Array.from(current.classList).join('.')}`;
    const siblings = current.parentElement
      ? Array.from(current.parentElement.children).filter((item) => item.tagName === current.tagName)
      : [];
    if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    parts.unshift(part);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

function directText(element) {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent.trim())
    .filter(Boolean)
    .join(' ');
}

function textStyleData(element, stageScale) {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return {
    selector: cssPath(element),
    module: element.closest('[id^="mod-"]')?.id || null,
    text: (directText(element) || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
    rendered: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
    rect: rectData(rect),
    logicalRectFromStageScale: stageScale.x && stageScale.y ? {
      width: number(rect.width / stageScale.x),
      height: number(rect.height / stageScale.y),
    } : null,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    font: style.font,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    fontStretch: style.fontStretch,
    letterSpacing: style.letterSpacing,
    textTransform: style.textTransform,
    transform: style.transform,
    zoom: style.zoom || null,
  };
}

function collectTextSamples(stage, stageScale) {
  const selected = [];
  const seen = new Set();

  for (const selector of PRIORITY_TEXT_SELECTORS) {
    for (const element of stage.querySelectorAll(selector)) {
      if (!seen.has(element)) {
        seen.add(element);
        selected.push(element);
      }
    }
  }

  for (const element of stage.querySelectorAll('[id^="mod-"] *')) {
    if (selected.length >= 40) break;
    if (!seen.has(element) && directText(element)) {
      seen.add(element);
      selected.push(element);
    }
  }

  return selected.slice(0, 40).map((element) => textStyleData(element, stageScale));
}

function fontMetrics(fontFamily) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const sample = 'GLA AaBb 0123456789 MWmw';
  context.font = `32px "${fontFamily}", monospace`;
  const metrics = context.measureText(sample);
  return {
    family: fontFamily,
    check16: document.fonts?.check(`16px "${fontFamily}"`) ?? null,
    check32: document.fonts?.check(`32px "${fontFamily}"`, sample) ?? null,
    sampleWidth32px: number(metrics.width),
    actualBoundingBoxAscent: number(metrics.actualBoundingBoxAscent),
    actualBoundingBoxDescent: number(metrics.actualBoundingBoxDescent),
  };
}

function loadedFontFaces() {
  if (!document.fonts) return [];
  try {
    return Array.from(document.fonts).map((face) => ({
      family: face.family,
      status: face.status,
      style: face.style,
      weight: face.weight,
      stretch: face.stretch,
    }));
  } catch (error) {
    return [{ error: String(error) }];
  }
}

function mediaResolutionMatches() {
  const resolutions = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  return Object.fromEntries(resolutions.map((value) => [
    `${value}dppx`,
    matchMedia(`(resolution: ${value}dppx)`).matches,
  ]));
}

function buildDiagnostics(stage, highEntropyUserAgent) {
  const stageStyle = getComputedStyle(stage);
  const stageRect = stage.getBoundingClientRect();
  const effectiveScale = matrixScale(stageStyle.transform);
  const rootStyle = getComputedStyle(document.documentElement);
  const bodyStyle = getComputedStyle(document.body);
  const visualViewport = window.visualViewport;
  const userAgentData = navigator.userAgentData;

  return {
    generatedAt: new Date().toISOString(),
    url: window.location.href,
    viewport: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio,
      documentElementClientWidth: document.documentElement.clientWidth,
      documentElementClientHeight: document.documentElement.clientHeight,
      bodyClientWidth: document.body.clientWidth,
      bodyClientHeight: document.body.clientHeight,
      visualViewport: visualViewport ? {
        width: number(visualViewport.width),
        height: number(visualViewport.height),
        scale: visualViewport.scale,
        offsetLeft: visualViewport.offsetLeft,
        offsetTop: visualViewport.offsetTop,
        pageLeft: visualViewport.pageLeft,
        pageTop: visualViewport.pageTop,
      } : null,
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
        orientation: screen.orientation ? {
          type: screen.orientation.type,
          angle: screen.orientation.angle,
        } : null,
      },
      resolutionMediaQueries: mediaResolutionMatches(),
    },
    stage: {
      boundingClientRect: rectData(stageRect),
      offsetWidth: stage.offsetWidth,
      offsetHeight: stage.offsetHeight,
      clientWidth: stage.clientWidth,
      clientHeight: stage.clientHeight,
      scrollWidth: stage.scrollWidth,
      scrollHeight: stage.scrollHeight,
      computed: {
        width: stageStyle.width,
        height: stageStyle.height,
        left: stageStyle.left,
        top: stageStyle.top,
        position: stageStyle.position,
        transform: stageStyle.transform,
        transformOrigin: stageStyle.transformOrigin,
        zoom: stageStyle.zoom || null,
      },
      inlineStyle: {
        left: stage.style.left,
        top: stage.style.top,
        transform: stage.style.transform,
      },
      effectiveScaleFromTransformMatrix: effectiveScale,
      effectiveScaleFromRect: {
        x: number(stageRect.width / stage.offsetWidth),
        y: number(stageRect.height / stage.offsetHeight),
      },
    },
    document: {
      readyState: document.readyState,
      visibilityState: document.visibilityState,
      hasFocus: document.hasFocus(),
      compatMode: document.compatMode,
      rootComputed: {
        width: rootStyle.width,
        height: rootStyle.height,
        zoom: rootStyle.zoom || null,
      },
      bodyComputed: {
        width: bodyStyle.width,
        height: bodyStyle.height,
        zoom: bodyStyle.zoom || null,
        transform: bodyStyle.transform,
      },
      bodyRect: rectData(document.body.getBoundingClientRect()),
    },
    fonts: {
      status: document.fonts?.status || 'unsupported',
      cssVariables: {
        display: rootStyle.getPropertyValue('--font-display').trim(),
        body: rootStyle.getPropertyValue('--font-body').trim(),
      },
      checksAndCanvasMetrics: DIAGNOSTIC_FONTS.map(fontMetrics),
      fontFacesKnownToDocument: loadedFontFaces(),
    },
    textSamples: collectTextSamples(stage, effectiveScale),
    engine: {
      userAgent: navigator.userAgent,
      appVersion: navigator.appVersion,
      platform: navigator.platform,
      vendor: navigator.vendor,
      product: navigator.product,
      language: navigator.language,
      languages: navigator.languages,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory ?? null,
      maxTouchPoints: navigator.maxTouchPoints,
      cookieEnabled: navigator.cookieEnabled,
      pdfViewerEnabled: navigator.pdfViewerEnabled ?? null,
      webdriver: navigator.webdriver,
      userAgentData: userAgentData ? {
        brands: userAgentData.brands,
        mobile: userAgentData.mobile,
        platform: userAgentData.platform,
        highEntropyValues: highEntropyUserAgent,
      } : null,
      crossOriginIsolated: window.crossOriginIsolated,
      secureContext: window.isSecureContext,
    },
  };
}

function createOverlay() {
  const overlay = document.createElement('section');
  overlay.id = 'gla-program-debug';
  overlay.setAttribute('aria-label', 'Diagnostico de PROGRAM');
  overlay.style.cssText = [
    'position:fixed',
    'inset:0 auto 0 0',
    'z-index:2147483647',
    'width:min(760px,100vw)',
    'box-sizing:border-box',
    'display:flex',
    'flex-direction:column',
    'gap:8px',
    'padding:10px',
    'background:rgba(8,8,8,.96)',
    'color:#fff',
    'font:14px/1.35 Consolas,monospace',
    'pointer-events:auto',
  ].join(';');

  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;align-items:center;gap:8px;flex:0 0 auto';

  const title = document.createElement('strong');
  title.textContent = 'GLA PROGRAM DEBUG';
  title.style.cssText = 'margin-right:auto;color:#f5c542';

  const status = document.createElement('span');
  status.textContent = 'actualizacion automatica: SI';

  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.textContent = 'Actualizar';

  const pause = document.createElement('button');
  pause.type = 'button';
  pause.textContent = 'Pausar';

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copiar todo';

  for (const button of [refresh, pause, copy]) {
    button.style.cssText = 'padding:5px 9px;border:1px solid #777;background:#222;color:#fff;cursor:pointer';
  }

  const output = document.createElement('textarea');
  output.readOnly = true;
  output.spellcheck = false;
  output.setAttribute('aria-label', 'Bloque de diagnostico copiable');
  output.style.cssText = [
    'flex:1 1 auto',
    'width:100%',
    'min-height:0',
    'box-sizing:border-box',
    'resize:none',
    'border:1px solid #666',
    'padding:10px',
    'background:#111',
    'color:#e8e8e8',
    'font:12px/1.35 Consolas,monospace',
    'white-space:pre',
  ].join(';');

  controls.append(title, status, refresh, pause, copy);
  overlay.append(controls, output);
  document.body.appendChild(overlay);
  return { overlay, output, status, refresh, pause, copy };
}

async function copyOutput(output, copyButton) {
  try {
    await navigator.clipboard.writeText(output.value);
    copyButton.textContent = 'Copiado';
  } catch (error) {
    output.focus();
    output.select();
    const copied = document.execCommand('copy');
    copyButton.textContent = copied ? 'Copiado' : 'Seleccionado: Ctrl+C';
  }
  setTimeout(() => { copyButton.textContent = 'Copiar todo'; }, 1600);
}

export function initProgramDiagnostics(stage) {
  if (!stage || document.getElementById('gla-program-debug')) return;

  const ui = createOverlay();
  let paused = false;
  let highEntropyUserAgent = null;

  const update = () => {
    const diagnostics = buildDiagnostics(stage, highEntropyUserAgent);
    const text = JSON.stringify(diagnostics, null, 2);
    ui.output.value = text;
    window.__GLA_PROGRAM_DIAGNOSTICS__ = diagnostics;
  };

  ui.refresh.addEventListener('click', update);
  ui.pause.addEventListener('click', () => {
    paused = !paused;
    ui.pause.textContent = paused ? 'Reanudar' : 'Pausar';
    ui.status.textContent = `actualizacion automatica: ${paused ? 'NO' : 'SI'}`;
    if (!paused) update();
  });
  ui.copy.addEventListener('click', () => copyOutput(ui.output, ui.copy));

  document.fonts?.ready.then(update).catch(() => {});
  if (navigator.userAgentData?.getHighEntropyValues) {
    navigator.userAgentData.getHighEntropyValues([
      'architecture',
      'bitness',
      'fullVersionList',
      'model',
      'platformVersion',
      'uaFullVersion',
    ]).then((values) => {
      highEntropyUserAgent = values;
      update();
    }).catch(() => {});
  }

  update();
  console.info('[GLA DEBUG] Diagnostico activo. Datos actuales:', window.__GLA_PROGRAM_DIAGNOSTICS__);
  window.setInterval(() => {
    if (!paused) update();
  }, 1000);
}
