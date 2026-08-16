export const PROGRAM_FONT_FAMILY = '"GLA Anton"';

const FONT_PROBE = 'GLA AaBb 0123456789 ÁÉÍÓÚÑ';
const REQUIRED_WEIGHTS = [400, 600, 700, 800, 900];

export async function waitForProgramFonts() {
  const loadedFaces = await Promise.all(REQUIRED_WEIGHTS.map((weight) =>
    document.fonts.load(`${weight} 32px ${PROGRAM_FONT_FAMILY}`, FONT_PROBE)
  ));
  await document.fonts.ready;

  if (loadedFaces.some((faces) => faces.length === 0 || faces.some((face) => face.status !== 'loaded'))) {
    throw new Error('No se pudo cargar /assets/fonts/Anton-Regular.ttf para PROGRAM.');
  }

  document.documentElement.classList.add('program-fonts-ready');
}
