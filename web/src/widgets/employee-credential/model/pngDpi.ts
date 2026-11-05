/**
 * Inserción de metadatos de resolución (DPI) en un PNG.
 *
 * El canvas exporta la imagen a 1016 × 638 px, pero sin declarar su densidad
 * física. El chunk `pHYs` del PNG indica los píxeles por unidad (metro) para
 * que imprenta y visores sepan que esos píxeles son 8.6 × 5.4 cm a 300 DPI.
 *
 * Se implementa aquí, sin dependencias: CRC-32 con el polinomio estándar PNG
 * (0xEDB88320) y el chunk insertado justo después de `IHDR`.
 */

const SIGNATURE_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Tabla CRC-32 (polinomio 0xEDB88320), calculada una sola vez. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const readUint32 = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]) >>>
  0;

/** Arma el chunk `pHYs`: X px/metro, Y px/metro, unidad = 1 (metro). */
const buildChunkPhys = (pixelsPerMeter: number): Uint8Array => {
  const type = new Uint8Array([0x70, 0x48, 0x59, 0x73]); // "pHYs"
  const data = new Uint8Array(9);
  const viewData = new DataView(data.buffer);
  viewData.setUint32(0, pixelsPerMeter);
  viewData.setUint32(4, pixelsPerMeter);
  data[8] = 1;

  const chunk = new Uint8Array(4 + type.length + data.length + 4);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(type, 4);
  chunk.set(data, 8);

  const crcInput = new Uint8Array(type.length + data.length);
  crcInput.set(type, 0);
  crcInput.set(data, type.length);
  view.setUint32(8 + data.length, crc32(crcInput));

  return chunk;
};

const isPng = (bytes: Uint8Array): boolean =>
  bytes.length > SIGNATURE_PNG.length && SIGNATURE_PNG.every((b, i) => bytes[i] === b);

/**
 * Devuelve una copia del PNG con un chunk `pHYs` declarando `dpi`.
 *
 * Si los bytes no son un PNG, se devuelven intactos.
 */
export const setPngDpi = (bytes: Uint8Array, dpi: number): Uint8Array => {
  if (!isPng(bytes)) return bytes;

  const pixelsPerMeter = Math.round(dpi / 0.0254);

  // Salto del bloque IHDR: firma(8) + largo(4) + tipo(4) + datos + crc(4).
  const lengthIhdr = readUint32(bytes, 8);
  const endIhdr = 8 + 4 + 4 + lengthIhdr + 4;

  const chunk = buildChunkPhys(pixelsPerMeter);
  const output = new Uint8Array(bytes.length + chunk.length);
  output.set(bytes.subarray(0, endIhdr), 0);
  output.set(chunk, endIhdr);
  output.set(bytes.subarray(endIhdr), endIhdr + chunk.length);

  return output;
};
