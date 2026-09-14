<script setup>
import { ref, computed } from 'vue';
import { 
  Lock, Key, UploadCloud, FileCode, CheckCircle2, 
  AlertCircle, Sparkles, Play, ShieldCheck, Database, Loader2 
} from 'lucide-vue-next';
import { decryptCrypt15, generateSampleEncryptedCrypt15 } from '../utils/crypto.js';
import { generateMockWhatsAppDb } from '../utils/db.js';

const emit = defineEmits(['database-ready']);

const file = ref(null);
const fileName = ref('');
const fileSize = ref(0);
const hexKey = ref('');
const isDragging = ref(false);
const isProcessing = ref(false);
const errorMessage = ref('');
const statusMessage = ref('');
const currentStep = ref(0); // 0: Idle, 1: Key Derivation, 2: AES-GCM Decrypt, 3: Decompressing, 4: SQL.js Init

const SAMPLE_HEX_KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

// Format file size
const formattedFileSize = computed(() => {
  if (!fileSize.value) return '';
  if (fileSize.value < 1024) return `${fileSize.value} B`;
  if (fileSize.value < 1024 * 1024) return `${(fileSize.value / 1024).toFixed(1)} KB`;
  return `${(fileSize.value / (1024 * 1024)).toFixed(2)} MB`;
});

// Hex key validation
const cleanedKey = computed(() => hexKey.value.trim().replace(/^0x/i, '').replace(/[\s:-]/g, ''));
const isKeyValid = computed(() => cleanedKey.value.length === 64 && /^[0-9a-fA-F]{64}$/.test(cleanedKey.value));
const isUnencryptedDb = computed(() => {
  if (!fileName.value) return false;
  const name = fileName.value.toLowerCase();
  return name.endsWith('.db') && !name.includes('crypt');
});

const canDecrypt = computed(() => {
  if (!file.value || isProcessing.value) return false;
  if (isUnencryptedDb.value) return true;
  return isKeyValid.value;
});

function handleDrop(e) {
  isDragging.value = false;
  const droppedFiles = e.dataTransfer.files;
  if (droppedFiles.length > 0) {
    handleFileSelected(droppedFiles[0]);
  }
}

function handleFileInput(e) {
  const selected = e.target.files;
  if (selected.length > 0) {
    handleFileSelected(selected[0]);
  }
}

function handleFileSelected(f) {
  errorMessage.value = '';
  file.value = f;
  fileName.value = f.name;
  fileSize.value = f.size;
}

function handleKeyFileInput(e) {
  const selected = e.target.files;
  if (selected.length > 0) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        hexKey.value = result.trim();
      } else {
        // Uint8Array from binary key file
        const bytes = new Uint8Array(result);
        if (bytes.length === 32) {
          hexKey.value = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        } else {
          errorMessage.value = `Key file must be exactly 32 bytes or 64 hex characters. Got ${bytes.length} bytes.`;
        }
      }
    };
    if (selected[0].name.endsWith('.key') || selected[0].type === 'application/octet-stream') {
      reader.readAsArrayBuffer(selected[0]);
    } else {
      reader.readAsText(selected[0]);
    }
  }
}

async function pasteKeyFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      hexKey.value = text.trim();
    }
  } catch (err) {
    console.warn('Clipboard read failed:', err);
  }
}

async function startDecryption() {
  if (!canDecrypt.value) return;

  isProcessing.value = true;
  errorMessage.value = '';
  currentStep.value = 1;
  statusMessage.value = 'Reading backup file buffer...';

  try {
    const arrayBuffer = await file.value.arrayBuffer();

    // Check if directly an unencrypted SQLite DB
    const headerSlice = new Uint8Array(arrayBuffer.slice(0, 15));
    const headerStr = new TextDecoder().decode(headerSlice);
    if (headerStr === 'SQLite format 3') {
      currentStep.value = 4;
      statusMessage.value = 'Unencrypted SQLite database detected. Initializing database in memory...';
      emit('database-ready', {
        bytes: new Uint8Array(arrayBuffer),
        source: 'Uploaded SQLite Database',
        fileName: fileName.value
      });
      return;
    }

    currentStep.value = 1;
    statusMessage.value = 'Deriving crypt15 keys via Web Crypto API...';

    const decryptedSqliteBytes = await decryptCrypt15(arrayBuffer, cleanedKey.value, (p) => {
      if (p.step === 'deriving_key') {
        currentStep.value = 1;
        statusMessage.value = p.message;
      } else if (p.step === 'fast_path' || p.step === 'fallback_scanner') {
        currentStep.value = 2;
        statusMessage.value = p.message;
      } else if (p.step === 'inflating') {
        currentStep.value = 3;
        statusMessage.value = p.message;
      } else if (p.step === 'completed') {
        currentStep.value = 4;
        statusMessage.value = p.message;
      }
    });

    statusMessage.value = 'Parsing SQLite database with sql.js...';
    emit('database-ready', {
      bytes: decryptedSqliteBytes,
      source: 'Decrypted msgstore.db.crypt15',
      fileName: fileName.value
    });

  } catch (err) {
    console.error('Decryption error:', err);
    errorMessage.value = err.message || 'Decryption failed. Please verify your 64-hex key and backup file.';
  } finally {
    isProcessing.value = false;
  }
}

// Load built-in realistic demo database
async function loadDemoDatabase() {
  isProcessing.value = true;
  errorMessage.value = '';
  statusMessage.value = 'Generating mock WhatsApp database in memory...';
  currentStep.value = 4;

  try {
    const mockBytes = await generateMockWhatsAppDb();
    emit('database-ready', {
      bytes: mockBytes,
      source: 'Demo WhatsApp Backup (5 Chats, 20+ Messages)',
      fileName: 'demo_msgstore.db'
    });
  } catch (err) {
    console.error('Failed to load demo DB:', err);
    errorMessage.value = 'Failed to initialize demo database: ' + err.message;
  } finally {
    isProcessing.value = false;
  }
}

// Test Crypt15 Decryption with Live Generated crypt15 file
async function testCrypt15WithSample() {
  isProcessing.value = true;
  errorMessage.value = '';
  currentStep.value = 1;
  statusMessage.value = 'Creating authentic test .crypt15 file with sample key...';

  try {
    const mockBytes = await generateMockWhatsAppDb();
    const encryptedBytes = await generateSampleEncryptedCrypt15(mockBytes, SAMPLE_HEX_KEY);

    file.value = new File([encryptedBytes], 'msgstore.db.crypt15', { type: 'application/octet-stream' });
    fileName.value = 'msgstore.db.crypt15 (Sample Encrypted)';
    fileSize.value = encryptedBytes.byteLength;
    hexKey.value = SAMPLE_HEX_KEY;

    // Immediately trigger decrypt to demonstrate
    await startDecryption();
  } catch (err) {
    console.error('Sample crypt15 test failed:', err);
    errorMessage.value = 'Sample test error: ' + err.message;
    isProcessing.value = false;
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-8">
    <!-- Header Banner -->
    <div class="text-center mb-8">
      <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-wa-emerald/10 border border-wa-emerald/20 text-wa-emerald text-xs font-medium mb-4">
        <ShieldCheck class="w-4 h-4" />
        <span>100% Client-Side Web Crypto &amp; In-Memory Decryption</span>
      </div>
      <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-waText-primary mb-3">
        WhatsApp Crypt15 Backup Viewer
      </h1>
      <p class="text-waText-secondary text-sm sm:text-base max-w-xl mx-auto">
        Decrypt your Android <code class="text-wa-emerald font-mono bg-oled-800 px-1.5 py-0.5 rounded text-xs">msgstore.db.crypt15</code> backup with your 64-hex key, visualize message threads, and craft AI replies in your authentic voice.
      </p>
    </div>

    <!-- Main Card -->
    <div class="bg-oled-800 border border-oled-700 rounded-2xl shadow-oled overflow-hidden p-6 sm:p-8 backdrop-blur-md">
      <!-- Drag & Drop Zone -->
      <div 
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
        class="border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer relative group"
        :class="[
          isDragging 
            ? 'border-wa-emerald bg-wa-emerald/5 scale-[0.99]' 
            : file 
              ? 'border-wa-emerald/40 bg-oled-750/50' 
              : 'border-oled-700 hover:border-wa-emerald/50 bg-oled-850/40 hover:bg-oled-850/80'
        ]"
      >
        <input 
          type="file" 
          id="backup-file-input"
          accept=".crypt15,.db,.sqlite,.bin,*" 
          @change="handleFileInput" 
          class="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
        />

        <div class="flex flex-col items-center justify-center pointer-events-none">
          <div class="w-14 h-14 rounded-2xl bg-oled-750 border border-oled-700 flex items-center justify-center text-wa-emerald mb-3 group-hover:scale-110 transition-transform">
            <UploadCloud v-if="!file" class="w-7 h-7" />
            <FileCode v-else class="w-7 h-7 text-wa-emerald" />
          </div>

          <div v-if="!file">
            <p class="text-sm font-semibold text-waText-primary mb-1">
              Drop your <span class="text-wa-emerald">msgstore.db.crypt15</span> file here
            </p>
            <p class="text-xs text-waText-secondary">
              Or click to browse from device (Also supports unencrypted <code class="text-xs">msgstore.db</code>)
            </p>
          </div>

          <div v-else class="space-y-1">
            <div class="flex items-center gap-2 justify-center">
              <span class="text-sm font-medium text-waText-primary">{{ fileName }}</span>
              <span class="text-xs text-wa-emerald bg-wa-emerald/10 px-2 py-0.5 rounded-full font-mono">{{ formattedFileSize }}</span>
            </div>
            <p class="text-xs text-waText-secondary">Click or drop to replace file</p>
          </div>
        </div>
      </div>

      <!-- Hex Key Input (Shown if not unencrypted DB) -->
      <div v-if="!isUnencryptedDb" class="mt-6 space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold text-waText-primary flex items-center gap-1.5">
            <Key class="w-3.5 h-3.5 text-wa-emerald" />
            <span>64-Character Hexadecimal Key</span>
          </label>
          <div class="flex items-center gap-2 text-xs">
            <span 
              class="font-mono text-[11px] px-1.5 py-0.5 rounded"
              :class="isKeyValid ? 'text-wa-emerald bg-wa-emerald/10' : 'text-waText-secondary bg-oled-750'"
            >
              {{ cleanedKey.length }}/64 hex chars
            </span>
            <button 
              type="button"
              @click="pasteKeyFromClipboard"
              class="text-waText-secondary hover:text-waText-primary transition-colors hover:underline text-[11px]"
            >
              Paste
            </button>
            <label class="text-waText-secondary hover:text-waText-primary transition-colors cursor-pointer text-[11px] hover:underline">
              <span>Upload .key</span>
              <input type="file" accept=".key,.txt,*" @change="handleKeyFileInput" class="hidden" />
            </label>
          </div>
        </div>

        <div class="relative">
          <input 
            v-model="hexKey"
            type="text"
            placeholder="e.g. a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90"
            class="w-full bg-oled-850 border rounded-xl px-4 py-3 text-xs font-mono text-waText-primary placeholder-waText-muted focus:outline-none transition-all pr-10"
            :class="[
              isKeyValid 
                ? 'border-wa-emerald/50 focus:border-wa-emerald focus:ring-1 focus:ring-wa-emerald' 
                : hexKey.length > 0 
                  ? 'border-amber-500/50 focus:border-amber-500' 
                  : 'border-oled-700 focus:border-wa-emerald/50'
            ]"
          />
          <div class="absolute right-3 top-1/2 -translate-y-1/2">
            <CheckCircle2 v-if="isKeyValid" class="w-4 h-4 text-wa-emerald" />
            <Lock v-else class="w-4 h-4 text-waText-muted" />
          </div>
        </div>
        <p class="text-[11px] text-waText-secondary">
          Your Android WhatsApp key extracted from <code class="font-mono text-[10px] bg-oled-750 px-1 py-0.5 rounded">/data/data/com.whatsapp/files/key</code> or root backup tool.
        </p>
      </div>

      <!-- Error message -->
      <div v-if="errorMessage" class="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
        <AlertCircle class="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        <div class="space-y-1">
          <span class="font-semibold">Decryption Failed</span>
          <p>{{ errorMessage }}</p>
        </div>
      </div>

      <!-- Decryption Progress Stepper -->
      <div v-if="isProcessing" class="mt-6 p-4 rounded-xl bg-oled-850/90 border border-oled-700 space-y-3">
        <div class="flex items-center justify-between text-xs">
          <span class="text-waText-primary font-medium flex items-center gap-2">
            <Loader2 class="w-3.5 h-3.5 text-wa-emerald animate-spin" />
            <span>{{ statusMessage }}</span>
          </span>
          <span class="text-wa-emerald font-mono text-[11px]">Step {{ currentStep }}/4</span>
        </div>

        <div class="w-full bg-oled-750 h-1.5 rounded-full overflow-hidden">
          <div 
            class="bg-wa-emerald h-full transition-all duration-300 rounded-full"
            :style="{ width: `${(currentStep / 4) * 100}%` }"
          ></div>
        </div>

        <div class="grid grid-cols-4 text-[10px] text-waText-secondary text-center">
          <span :class="{ 'text-wa-emerald font-semibold': currentStep >= 1 }">1. Key Derivation</span>
          <span :class="{ 'text-wa-emerald font-semibold': currentStep >= 2 }">2. AES-GCM Probe</span>
          <span :class="{ 'text-wa-emerald font-semibold': currentStep >= 3 }">3. Zlib Inflate</span>
          <span :class="{ 'text-wa-emerald font-semibold': currentStep >= 4 }">4. sql.js Init</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="mt-6 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          @click="startDecryption"
          :disabled="!canDecrypt"
          class="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all shadow-lg"
          :class="[
            canDecrypt 
              ? 'bg-wa-emerald hover:bg-wa-emeraldHover text-white shadow-wa-emerald/20 cursor-pointer active:scale-[0.98]' 
              : 'bg-oled-750 text-waText-muted border border-oled-700 cursor-not-allowed opacity-60'
          ]"
        >
          <Lock v-if="!isProcessing" class="w-4 h-4" />
          <Loader2 v-else class="w-4 h-4 animate-spin" />
          <span>{{ isProcessing ? 'Processing Backup...' : 'Decrypt & View Chats' }}</span>
        </button>

        <button
          type="button"
          @click="loadDemoDatabase"
          :disabled="isProcessing"
          class="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm bg-oled-750 hover:bg-oled-700 text-waText-primary border border-oled-700 transition-all hover:border-waText-secondary cursor-pointer"
        >
          <Database class="w-4 h-4 text-wa-emerald" />
          <span>Load Demo Backup</span>
        </button>

        <button
          type="button"
          @click="testCrypt15WithSample"
          :disabled="isProcessing"
          title="Generates a live sample .crypt15 file in memory with a sample key to verify Web Crypto engine"
          class="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm bg-ai-violet/10 hover:bg-ai-violet/20 text-ai-violetLight border border-ai-violet/30 transition-all cursor-pointer"
        >
          <Sparkles class="w-4 h-4 text-ai-violet" />
          <span>Test Crypt15 Decryption</span>
        </button>
      </div>

      <!-- Privacy Guarantee Footer -->
      <div class="mt-6 pt-4 border-t border-oled-700 flex flex-col sm:flex-row items-center justify-between text-xs text-waText-secondary gap-2">
        <div class="flex items-center gap-1.5">
          <ShieldCheck class="w-3.5 h-3.5 text-wa-emerald" />
          <span>Privacy Guaranteed: Zero data leaves your browser. Decryption runs purely via Web Crypto API.</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-[11px] text-waText-muted">AES-GCM (128-bit)</span>
          <span class="text-[11px] text-waText-muted">pako zlib</span>
          <span class="text-[11px] text-waText-muted">sql.js WASM</span>
        </div>
      </div>
    </div>
  </div>
</template>
