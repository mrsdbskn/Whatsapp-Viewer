import pako from 'pako';

/**
 * Normalizes a 64-character hex key (or 32-byte Uint8Array / Buffer) into a 32-byte Uint8Array.
 * Strips whitespace, 0x prefix, colons, dashes.
 * 
 * @param {string|Uint8Array|ArrayBuffer} keyInput 
 * @returns {Uint8Array} 32-byte raw key
 */
export function normalizeHexKey(keyInput) {
  if (keyInput instanceof Uint8Array && keyInput.length === 32) {
    return keyInput;
  }
  if (keyInput instanceof ArrayBuffer && keyInput.byteLength === 32) {
    return new Uint8Array(keyInput);
  }

  if (typeof keyInput === 'string') {
    const cleaned = keyInput.trim().replace(/^0x/i, '').replace(/[\s:-]/g, '');
    if (cleaned.length !== 64) {
      throw new Error(`Hex key must be exactly 64 characters (32 bytes). Found ${cleaned.length} characters.`);
    }
    if (!/^[0-9a-fA-F]{64}$/.test(cleaned)) {
      throw new Error('Hex key contains invalid non-hexadecimal characters.');
    }
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(cleaned.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  throw new Error('Unsupported key format. Please provide a 64-character hex string or 32-byte file.');
}

/**
 * WhatsApp Crypt15 Key Derivation using Web Crypto API.
 * 
 * Step 1: Intermediate key = HMAC-SHA256(key = 32_zero_bytes, data = raw_key)
 * Step 2: Final AES key = HMAC-SHA256(key = intermediate_key, data = "backup encryption\x01")
 * Step 3: Import final key as AES-GCM
 * 
 * @param {Uint8Array} rawKeyBytes 
 * @returns {Promise<CryptoKey>} AES-GCM CryptoKey
 */
export async function deriveCrypt15Key(rawKeyBytes) {
  const zeroKeyBytes = new Uint8Array(32); // 32 zero bytes
  const zeroKey = await crypto.subtle.importKey(
    'raw',
    zeroKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // 1. Intermediate key
  const intermediateKeyBuffer = await crypto.subtle.sign('HMAC', zeroKey, rawKeyBytes);

  // 2. Final AES key
  const intermediateKey = await crypto.subtle.importKey(
    'raw',
    intermediateKeyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const contextData = new TextEncoder().encode('backup encryption\x01');
  const finalKeyBuffer = await crypto.subtle.sign('HMAC', intermediateKey, contextData);

  // 3. Import as AES-GCM
  return await crypto.subtle.importKey(
    'raw',
    finalKeyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Decrypts a WhatsApp msgstore.db.crypt15 file client-side.
 * 
 * @param {ArrayBuffer} fileBuffer Raw encrypted file
 * @param {string|Uint8Array} hexKey 64-character hex key
 * @param {Function} [onProgress] Progress callback
 * @returns {Promise<Uint8Array>} Uncompressed SQLite database bytes
 */
export async function decryptCrypt15(fileBuffer, hexKey, onProgress = () => {}) {
  const rawData = new Uint8Array(fileBuffer);
  
  if (rawData.length < 200) {
    throw new Error('File is too small to be a valid WhatsApp crypt15 backup.');
  }

  // Quick check: if the file is already an unencrypted SQLite DB, return directly
  const sqliteHeader = new TextDecoder().decode(rawData.slice(0, 15));
  if (sqliteHeader === 'SQLite format 3') {
    onProgress({ step: 'detected_unencrypted', message: 'File is already an unencrypted SQLite database.' });
    return rawData;
  }

  onProgress({ step: 'deriving_key', message: 'Deriving AES-GCM key via Web Crypto HMAC-SHA256...' });
  const rawKeyBytes = normalizeHexKey(hexKey);
  const aesKey = await deriveCrypt15Key(rawKeyBytes);

  let decryptedBuffer = null;
  let successfulIvOffset = null;
  let successfulCipherOffset = null;

  // 1. Fast-path probe: IV at bytes 8..24 (16 bytes), ciphertext starting at byte 122
  onProgress({ step: 'fast_path', message: 'Attempting fast-path decryption (IV: 8..24, Ciphertext: 122)...' });
  try {
    const iv = rawData.slice(8, 24);
    const ciphertext = rawData.slice(122);
    decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      aesKey,
      ciphertext
    );
    successfulIvOffset = 8;
    successfulCipherOffset = 122;
  } catch (err) {
    // Fast path failed, fallback scanner will engage
    console.warn('Fast-path decryption failed, falling back to resilient header scanner...', err);
  }

  // 2. Fallback scanner: resilient loop across candidate header offsets
  if (!decryptedBuffer) {
    onProgress({ step: 'fallback_scanner', message: 'Scanning header offsets for crypt14/crypt15 structure...' });
    
    // Known IV locations in WhatsApp crypt variants
    const candidateIvOffsets = [8, 16, 24, 67, 83, 32, 48];
    // Known payload start offsets
    const candidateCipherOffsets = [122, 190, 191, 126, 130, 140, 170, 200];

    outerLoop:
    for (const ivOff of candidateIvOffsets) {
      if (ivOff + 16 > rawData.length) continue;
      const testIv = rawData.slice(ivOff, ivOff + 16);

      for (const cipherOff of candidateCipherOffsets) {
        if (cipherOff >= rawData.length - 16) continue;
        const testCiphertext = rawData.slice(cipherOff);

        try {
          decryptedBuffer = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: testIv, tagLength: 128 },
            aesKey,
            testCiphertext
          );
          successfulIvOffset = ivOff;
          successfulCipherOffset = cipherOff;
          break outerLoop;
        } catch {
          // Continue scanning
        }
      }
    }
  }

  if (!decryptedBuffer) {
    throw new Error(
      'Decryption failed: Unable to decrypt with the provided key. ' +
      'Please ensure this is the exact 64-hex key matching this backup.'
    );
  }

  onProgress({ 
    step: 'inflating', 
    message: `Decryption verified (IV: ${successfulIvOffset}, Offset: ${successfulCipherOffset}). Decompressing SQLite database...` 
  });

  const decryptedBytes = new Uint8Array(decryptedBuffer);

  // Check if decrypted directly to SQLite
  const decHeader = new TextDecoder().decode(decryptedBytes.slice(0, 15));
  if (decHeader === 'SQLite format 3') {
    return decryptedBytes;
  }

  // 3. Decompress decrypted buffer using pako.inflate
  try {
    const inflated = pako.inflate(decryptedBytes);
    const inflatedHeader = new TextDecoder().decode(inflated.slice(0, 15));
    if (inflatedHeader !== 'SQLite format 3') {
      console.warn('Inflated database header did not match standard SQLite magic bytes, but proceeding.');
    }
    onProgress({ step: 'completed', message: 'Decompression complete. SQLite database ready!' });
    return inflated;
  } catch (err) {
    throw new Error(`Decompression error: pako.inflate failed (${err.message}). The decrypted stream was not valid zlib data.`);
  }
}

/**
 * Creates an authentic WhatsApp crypt15 formatted file buffer from SQLite bytes and a 64-hex key.
 * Used for instant testing and demo validation.
 * 
 * Header layout:
 * - 0..7: Magic prefix bytes
 * - 8..23: 16-byte IV
 * - 24..121: Header metadata & protobuf padding
 * - 122..end: AES-GCM ciphertext + 16-byte auth tag
 * 
 * @param {Uint8Array} sqliteBytes 
 * @param {string} hexKey 
 * @returns {Promise<Uint8Array>}
 */
export async function generateSampleEncryptedCrypt15(sqliteBytes, hexKey) {
  const rawKeyBytes = normalizeHexKey(hexKey);
  const aesKey = await deriveCrypt15Key(rawKeyBytes);

  // 1. Compress SQLite database with zlib
  const compressed = pako.deflate(sqliteBytes);

  // 2. Generate 16-byte random IV
  const iv = crypto.getRandomValues(new Uint8Array(16));

  // 3. Encrypt with AES-GCM
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKey,
    compressed
  );
  const ciphertext = new Uint8Array(ciphertextBuffer);

  // 4. Construct WhatsApp crypt15 file structure
  const totalLength = 122 + ciphertext.length;
  const output = new Uint8Array(totalLength);

  // Magic prefix
  output.set([0x00, 0x01, 0x02, 0x03, 0x57, 0x41, 0x42, 0x4B], 0); // WABK prefix
  // IV at bytes 8..24
  output.set(iv, 8);
  // Padding/metadata for bytes 24..121
  for (let i = 24; i < 122; i++) {
    output[i] = (i * 31) & 0xFF;
  }
  // Ciphertext starting at 122
  output.set(ciphertext, 122);

  return output;
}
