// We NEVER trust the client-supplied Content-Type / filename extension for
// an uploaded file — it's attacker-controlled. Instead we sniff the actual
// magic bytes of the buffer, same as the original Worker did.
export function sniffImageMime(bytes) {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 && // G
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x38 && // 8
    (bytes[4] === 0x37 || bytes[4] === 0x39) && // 7 or 9
    bytes[5] === 0x61 // a
  ) {
    return 'image/gif';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return 'image/webp';
  }
  return null;
}

/**
 * Strips EXIF (APP1) segments from a JPEG buffer, in place logic ported
 * from the original Worker. This removes embedded metadata (which can
 * include GPS location, device info, etc.) before the file is ever
 * forwarded to Shopify, without pulling in a heavyweight image library.
 *
 * Walks the JPEG marker stream, drops any APP1 segment whose payload
 * begins with the "Exif" tag, copies every other marker/segment through
 * unchanged, and copies the compressed scan data verbatim once it hits
 * the Start-Of-Scan (0xFFDA) marker.
 */
export function stripJpegExif(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return input; // Not a JPEG (or too short) — return untouched.
  }

  const out = new Uint8Array(bytes.length);
  out[0] = bytes[0];
  out[1] = bytes[1];
  let writePos = 2;
  let readPos = 2;

  while (readPos + 1 < bytes.length && bytes[readPos] === 0xff) {
    const marker = bytes[readPos + 1];

    // Markers with no length/payload: EOI (0xD9), TEM (0x01), RST0-7 (0xD0-0xD7)
    if (marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out[writePos++] = bytes[readPos];
      out[writePos++] = bytes[readPos + 1];
      readPos += 2;
      continue;
    }

    if (readPos + 3 >= bytes.length) break; // Not enough bytes to read a length field.

    const segmentLen = (bytes[readPos + 2] << 8) | bytes[readPos + 3];
    const segmentEnd = readPos + 2 + segmentLen;
    if (segmentLen < 2 || segmentEnd > bytes.length) break; // Malformed — bail safely.

    const isExifApp1 =
      marker === 0xe1 &&
      segmentLen >= 8 &&
      bytes[readPos + 4] === 0x45 && // E
      bytes[readPos + 5] === 0x78 && // x
      bytes[readPos + 6] === 0x69 && // i
      bytes[readPos + 7] === 0x66; // f

    if (!isExifApp1) {
      out.set(bytes.subarray(readPos, segmentEnd), writePos);
      writePos += segmentEnd - readPos;
    }
    // else: skip writing this segment entirely — this is the actual strip.

    readPos = segmentEnd;

    if (marker === 0xda) {
      // Start Of Scan — everything after this is compressed image data
      // (plus the trailing EOI marker); copy the remainder verbatim.
      out.set(bytes.subarray(readPos), writePos);
      writePos += bytes.length - readPos;
      return out.subarray(0, writePos);
    }
  }

  // Fell out of the loop without finding SOS (malformed/truncated JPEG,
  // or no more FF-prefixed markers) — copy whatever remains and return.
  out.set(bytes.subarray(readPos), writePos);
  writePos += bytes.length - readPos;
  return out.subarray(0, writePos);
}
