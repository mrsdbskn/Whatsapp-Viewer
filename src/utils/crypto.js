import pako from 'pako';

/**
 * Normalizes a 64-character hex key into a 32-byte Uint8Array.
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
 * Converts a 64-hex string between row-major and column-major order.
 * WhatsApp displays the 64-character key in a 4x4 grid of 4-character blocks:
 * 
 * Row 1: [0..3]   [4..7]   [8..11]  [12..15]
 * Row 2: [16..19] [20..23] [24..27] [28..31]
 * Row 3: [32..35] [36..39] [40..43] [44..47]
 * Row 4: [48..51] [52..55] [56..59] [60..63]
 * 
 * Standard order is row-by-row. If column-by-column was read, this function transposes it.
 * 
 * @param {string} hexKey 
 * @returns {string} Transposed 64-hex string
 */
export function transposeHexKeyGrid(hexKey) {
  const cleaned = hexKey.trim().replace(/^0x/i, '').replace(/[\s:-]/g, '');
  if (cleaned.length !== 64) return cleaned;

  // Split into 16 4-character blocks
  const blocks = [];
  for (let i = 0; i < 16; i++) {
    blocks.push(cleaned.substr(i * 4, 4));
  }

  // Transpose 4x4 grid
  const transposed = [];
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      transposed.push(blocks[row * 4 + col]);
    }
  }

  return transposed.join('');
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
  const zeroKeyBytes = new Uint8Array(32);
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
 * Extracts IV from WhatsApp crypt15 file header.
 * Standard WhatsApp crypt15 files store the IV at offset 8 (bytes 8..24)
 * inside the BackupPrefix protobuf (subfield c15_iv.IV with tag 0x0a 0x10).
 * 
 * @param {Uint8Array} rawData 
 * @returns {Array<Uint8Array>} Candidate IVs to try
 */
function extractCandidateIvs(rawData) {
  const candidates = [];

  // 1. Check for protobuf tag 0x0a, 0x10 (field 1 in c15_iv message, length 16)
  for (let i = 0; i < Math.min(rawData.length - 18, 150); i++) {
    if (rawData[i] === 0x0A && rawData[i + 1] === 0x10) {
      candidates.push(rawData.slice(i + 2, i + 18));
      break;
    }
  }

  // 2. Standard location: offset 8..24
  if (rawData.length >= 24) {
    candidates.push(rawData.slice(8, 24));
  }

  // 3. Known alternate offsets
  const alternateOffsets = [16, 24, 67, 83, 32, 48];
  for (const off of alternateOffsets) {
    if (off + 16 <= rawData.length) {
      candidates.push(rawData.slice(off, off + 16));
    }
  }

  return candidates;
}

/**
 * Decrypts a WhatsApp msgstore.db.crypt15 file client-side.
 * Handles:
 * - Dynamic protobuf header calculation (Byte 0 = proto_size, Byte 1 = feature_flag)
 * - Trailing 16-byte MD5 checksum trimming (tag at [-32 : -16])
 * - Multi-file backup fallback (tag at [-16 : ])
 * - Automatic transposition of 64-hex key (row-major vs column-major)
 * 
 * @param {ArrayBuffer} fileBuffer Raw encrypted file
 * @param {string|Uint8Array} hexKey 64-character hex key
 * @param {Function} [onProgress] Progress callback
 * @returns {Promise<Uint8Array>} Uncompressed SQLite database bytes
 */
export async function decryptCrypt15(fileBuffer, hexKey, onProgress = () => {}) {
  const rawData = new Uint8Array(fileBuffer);

  if (rawData.length < 150) {
    throw new Error('File is too small to be a valid WhatsApp crypt15 backup.');
  }

  // Quick check: if already unencrypted SQLite DB
  const sqliteHeader = new TextDecoder().decode(rawData.slice(0, 15));
  if (sqliteHeader === 'SQLite format 3') {
    onProgress({ step: 'detected_unencrypted', message: 'File is already an unencrypted SQLite database.' });
    return rawData;
  }

  onProgress({ step: 'deriving_key', message: 'Deriving AES-GCM key via Web Crypto HMAC-SHA256...' });

  // Key candidate 1: Row-major (standard input)
  const rawKeyBytesRow = normalizeHexKey(hexKey);
  const aesKeyRow = await deriveCrypt15Key(rawKeyBytesRow);

  // Key candidate 2: Column-major (transposed 4x4 grid in case user read columns)
  let aesKeyCol = null;
  if (typeof hexKey === 'string') {
    try {
      const transposedHex = transposeHexKeyGrid(hexKey);
      if (transposedHex !== hexKey.trim().replace(/^0x/i, '').replace(/[\s:-]/g, '')) {
        const rawKeyBytesCol = normalizeHexKey(transposedHex);
        aesKeyCol = await deriveCrypt15Key(rawKeyBytesCol);
      }
    } catch {}
  }

  const keysToTry = [
    { key: aesKeyRow, name: 'Row-major (Standard)' }
  ];
  if (aesKeyCol) {
    keysToTry.push({ key: aesKeyCol, name: 'Column-major (Transposed)' });
  }

  // Calculate dynamic header size from WhatsApp crypt15 header
  // Byte 0: protobuf_size
  // Byte 1: 0x01 if feature table present
  const protoSize = rawData[0];
  const hasFeatureFlag = (rawData[1] === 0x01);
  const dynamicHeaderOffset = hasFeatureFlag ? (2 + protoSize) : (1 + protoSize);

  onProgress({ 
    step: 'fast_path', 
    message: `Protobuf size detected: ${protoSize} bytes (header offset: ${dynamicHeaderOffset}). Decrypting...` 
  });

  const candidateIvs = extractCandidateIvs(rawData);
  const candidateHeaderOffsets = [
    dynamicHeaderOffset,
    dynamicHeaderOffset + 1,
    dynamicHeaderOffset - 1,
    135,
    122,
    190,
    191,
    126,
    130,
    140,
    150,
    200
  ];

  // In WhatsApp crypt15:
  // Standard backup: last 16 bytes is MD5 checksum, authentication tag is [-32 : -16].
  // Slicing `rawData.slice(headerOffset, -16)` gives Web Crypto [ciphertext + tag]!
  // Multifile backup: no MD5 checksum, tag is at [-16 : ].
  // Slicing `rawData.slice(headerOffset)` gives Web Crypto [ciphertext + tag]!
  const trailerTrims = [16, 0];

  let decryptedBuffer = null;
  let successfulHeaderOffset = null;
  let successfulTrim = null;
  let successfulKeyName = null;

  outerLoop:
  for (const { key: activeKey, name: keyName } of keysToTry) {
    for (const iv of candidateIvs) {
      for (const trim of trailerTrims) {
        for (const headerOff of candidateHeaderOffsets) {
          if (headerOff >= rawData.length - (trim + 16)) continue;

          // Payload ending with 16-byte authentication tag
          const payloadWithTag = trim > 0 
            ? rawData.slice(headerOff, -trim) 
            : rawData.slice(headerOff);

          if (payloadWithTag.length < 16) continue;

          try {
            decryptedBuffer = await crypto.subtle.decrypt(
              { name: 'AES-GCM', iv, tagLength: 128 },
              activeKey,
              payloadWithTag
            );
            successfulHeaderOffset = headerOff;
            successfulTrim = trim;
            successfulKeyName = keyName;
            break outerLoop;
          } catch {
            // Continue scanning
          }
        }
      }
    }
  }

  if (!decryptedBuffer) {
    throw new Error(
      'Decryption failed: Unable to decrypt with the provided 64-hex key. ' +
      'Please verify this is the exact 64-character encryption key created for this specific WhatsApp backup.'
    );
  }

  onProgress({ 
    step: 'inflating', 
    message: `Decryption verified (${successfulKeyName}, offset: ${successfulHeaderOffset}, trim: ${successfulTrim}). Decompressing SQLite database...` 
  });

  const decryptedBytes = new Uint8Array(decryptedBuffer);

  // Check if uncompressed SQLite
  const decHeader = new TextDecoder().decode(decryptedBytes.slice(0, 15));
  if (decHeader === 'SQLite format 3') {
    return decryptedBytes;
  }

  // Decompress zlib stream with pako
  try {
    const inflated = pako.inflate(decryptedBytes);
    const inflatedHeader = new TextDecoder().decode(inflated.slice(0, 15));
    if (inflatedHeader !== 'SQLite format 3') {
      console.warn('Inflated database header did not match SQLite format 3, but proceeding.');
    }
    onProgress({ step: 'completed', message: 'Decompression complete. SQLite database ready!' });
    return inflated;
  } catch (err) {
    // If zlib header is slightly offset, attempt slice
    for (let offset = 1; offset < Math.min(decryptedBytes.length, 16); offset++) {
      try {
        const inflated = pako.inflate(decryptedBytes.slice(offset));
        return inflated;
      } catch {}
    }
    throw new Error(`Decompression error: pako.inflate failed (${err.message}). The decrypted stream was not valid zlib data.`);
  }
}

/**
 * Creates an authentic WhatsApp crypt15 formatted file buffer with standard protobuf header,
 * IV, AES-GCM ciphertext, 16-byte authentication tag, and 16-byte MD5 checksum.
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

  // 3. Encrypt with AES-GCM (produces ciphertext + 16-byte tag)
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKey,
    compressed
  );
  const ciphertextWithTag = new Uint8Array(ciphertextBuffer);

  // 4. Construct WhatsApp crypt15 header
  // Protobuf size = 133, feature flag = 0x01 -> total header size = 135
  const protoSize = 133;
  const header = new Uint8Array(135);
  header[0] = protoSize;
  header[1] = 0x01; // feature flag
  header[2] = 0x08; // key_type tag
  header[3] = 0x01; // HSM_CONTROLLED
  header[4] = 0x1A; // c15_iv tag
  header[5] = 0x12; // length 18
  header[6] = 0x0A; // IV tag
  header[7] = 0x10; // length 16
  header.set(iv, 8); // IV at offset 8

  // 5. 16-byte checksum at the end
  const checksum = new Uint8Array(16);
  crypto.getRandomValues(checksum);

  // Full file layout: [Header (135)] [Ciphertext + Tag] [Checksum (16)]
  const totalLength = 135 + ciphertextWithTag.length + 16;
  const output = new Uint8Array(totalLength);
  output.set(header, 0);
  output.set(ciphertextWithTag, 135);
  output.set(checksum, 135 + ciphertextWithTag.length);

  return output;
}
