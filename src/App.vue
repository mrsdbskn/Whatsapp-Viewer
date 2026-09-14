<script setup>
import { ref, computed, onMounted } from 'vue';
import { 
  MessageSquare, ShieldCheck, Sparkles, Settings, 
  Upload, ArrowLeft, Github, Database, FileText, 
  CheckCircle2, Search, PlusCircle, Download, Layers
} from 'lucide-vue-next';
import UploadCard from './components/UploadCard.vue';
import ChatSidebar from './components/ChatSidebar.vue';
import ChatWindow from './components/ChatWindow.vue';
import AiReplyDrawer from './components/AiReplyDrawer.vue';
import ApiKeyModal from './components/ApiKeyModal.vue';
import ExportModal from './components/ExportModal.vue';
import AnalyticsModal from './components/AnalyticsModal.vue';
import MediaGalleryDrawer from './components/MediaGalleryDrawer.vue';
import GlobalSearchModal from './components/GlobalSearchModal.vue';
import { 
  openDatabase, fetchChatThreads, fetchMessagesForChat, 
  fetchUserSentHistory, generateMockWhatsAppDb, mergeSqliteDatabases 
} from './utils/db.js';
import { decryptCrypt15 } from './utils/crypto.js';

// State
const db = ref(null);
const dbMeta = ref(null); // { source: string, fileName: string }
const threads = ref([]);
const selectedChatId = ref(null);
const currentMessages = ref([]);
const userSentHistory = ref([]);

// Modals and Drawers
const isAiDrawerOpen = ref(false);
const isExportModalOpen = ref(false);
const isApiModalOpen = ref(false);
const isAnalyticsModalOpen = ref(false);
const isMediaGalleryOpen = ref(false);
const isGlobalSearchOpen = ref(false);
const exportPayload = ref(null);

// Merge Modal
const isMergeModalOpen = ref(false);
const mergeHexKey = ref('');
const isMerging = ref(false);
const mergeResult = ref(null);

// PWA Install prompt
const deferredInstallPrompt = ref(null);

// AI Configuration
const apiKey = ref('');
const model = ref('gemini-3.8-flash');

// Responsive mobile view
const mobileView = ref('sidebar');

const selectedThread = computed(() => {
  if (!selectedChatId.value) return null;
  return threads.value.find(t => t.chatId === selectedChatId.value) || null;
});

const totalMessageCount = computed(() => {
  return threads.value.reduce((acc, t) => acc + (t.msgCount || 0), 0);
});

onMounted(() => {
  apiKey.value = localStorage.getItem('gemini_api_key') || '';
  model.value = localStorage.getItem('gemini_model') || 'gemini-3.8-flash';

  // Listen for PWA install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt.value = e;
  });
});

async function installPwa() {
  if (!deferredInstallPrompt.value) return;
  deferredInstallPrompt.value.prompt();
  const choice = await deferredInstallPrompt.value.userChoice;
  if (choice.outcome === 'accepted') {
    deferredInstallPrompt.value = null;
  }
}

async function handleDatabaseReady({ bytes, source, fileName }) {
  try {
    const database = await openDatabase(bytes);
    db.value = database;
    dbMeta.value = { source, fileName };

    const loadedThreads = fetchChatThreads(database);
    threads.value = loadedThreads;
    userSentHistory.value = fetchUserSentHistory(database, 200);

    if (loadedThreads.length > 0) {
      selectThread(loadedThreads[0]);
    }
  } catch (err) {
    console.error('Error loading database into workspace:', err);
    alert('Failed to load database: ' + err.message);
  }
}

function selectThread(thread) {
  selectedChatId.value = thread.chatId;
  if (db.value) {
    currentMessages.value = fetchMessagesForChat(db.value, thread.chatId);
  }
  mobileView.value = 'chat';
}

function handleJumpToMessage(res) {
  const targetThread = threads.value.find(t => t.chatId === res.chatId);
  if (targetThread) {
    selectThread(targetThread);
  }
}

async function loadDemoFromHeader() {
  try {
    const mockBytes = await generateMockWhatsAppDb();
    await handleDatabaseReady({
      bytes: mockBytes,
      source: 'Demo Backup',
      fileName: 'demo_msgstore.db'
    });
  } catch (err) {
    console.error('Header demo load failed:', err);
  }
}

function resetWorkspace() {
  if (db.value) {
    try {
      db.value.close();
    } catch {}
  }
  db.value = null;
  dbMeta.value = null;
  threads.value = [];
  selectedChatId.value = null;
  currentMessages.value = [];
  mobileView.value = 'sidebar';
}

function openExportModal({ thread, messages }) {
  exportPayload.value = { thread, messages };
  isExportModalOpen.value = true;
}

function openAiDrawer() {
  isAiDrawerOpen.value = true;
}

function openAnalytics() {
  isAnalyticsModalOpen.value = true;
}

function openMedia() {
  isMediaGalleryOpen.value = true;
}

function handleSaveApiSettings({ apiKey: newKey, model: newModel }) {
  apiKey.value = newKey;
  model.value = newModel;
}

// Multi-backup merge handler
async function handleMergeFileSelected(e) {
  const file = e.target.files[0];
  if (!file || !db.value) return;

  isMerging.value = true;
  mergeResult.value = null;

  try {
    const buffer = await file.arrayBuffer();
    let sqliteBytes = null;

    // Check if unencrypted SQLite
    const headerStr = new TextDecoder().decode(new Uint8Array(buffer.slice(0, 15)));
    if (headerStr === 'SQLite format 3') {
      sqliteBytes = new Uint8Array(buffer);
    } else {
      if (!mergeHexKey.value.trim()) {
        alert('Please enter the 64-hex key for this encrypted backup.');
        isMerging.value = false;
        return;
      }
      sqliteBytes = await decryptCrypt15(buffer, mergeHexKey.value.trim());
    }

    const { importedCount, duplicateCount } = await mergeSqliteDatabases(db.value, sqliteBytes);
    mergeResult.value = { importedCount, duplicateCount };

    // Refresh threads and messages
    threads.value = fetchChatThreads(db.value);
    if (selectedChatId.value) {
      currentMessages.value = fetchMessagesForChat(db.value, selectedChatId.value);
    }
  } catch (err) {
    console.error('Merge error:', err);
    alert('Failed to merge backup: ' + err.message);
  } finally {
    isMerging.value = false;
  }
}
</script>

<template>
  <div class="h-screen w-screen flex flex-col bg-oled-900 text-waText-primary overflow-hidden font-sans select-none">
    <!-- Top Global App Header -->
    <header class="h-14 bg-oled-850 border-b border-oled-700 px-4 flex items-center justify-between shrink-0 z-30 shadow-md">
      <!-- Left: Logo & Database Status -->
      <div class="flex items-center gap-3">
        <button
          v-if="db && mobileView === 'chat'"
          @click="mobileView = 'sidebar'"
          class="sm:hidden p-1.5 rounded-lg text-waText-secondary hover:text-white hover:bg-oled-750 mr-1"
          title="Back to conversations"
        >
          <ArrowLeft class="w-5 h-5" />
        </button>

        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-wa-emerald/15 border border-wa-emerald/30 flex items-center justify-center text-wa-emerald">
            <MessageSquare class="w-4 h-4 fill-current" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold tracking-tight text-white">WhatsApp Viewer</span>
              <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-wa-emerald/10 text-wa-emerald border border-wa-emerald/20">
                crypt15
              </span>
            </div>
            <p v-if="dbMeta" class="text-[10px] text-waText-secondary truncate max-w-[180px] sm:max-w-xs">
              {{ dbMeta.fileName }} &bull; {{ threads.length }} chats &bull; {{ totalMessageCount.toLocaleString() }} msgs
            </p>
          </div>
        </div>
      </div>

      <!-- Right: Global Actions -->
      <div class="flex items-center gap-1.5 sm:gap-2">
        <!-- Global Search Button (Ctrl+K) -->
        <button
          v-if="db"
          type="button"
          @click="isGlobalSearchOpen = true"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-oled-750 hover:bg-oled-700 text-waText-secondary hover:text-waText-primary border border-oled-700 transition-all cursor-pointer"
          title="Search all conversations (Ctrl+K)"
        >
          <Search class="w-3.5 h-3.5 text-wa-emerald" />
          <span class="hidden md:inline">Global Search</span>
          <span class="hidden lg:inline text-[10px] font-mono bg-oled-700 px-1 py-0.5 rounded text-waText-muted">^K</span>
        </button>

        <!-- Merge Another Backup Button -->
        <button
          v-if="db"
          type="button"
          @click="isMergeModalOpen = true"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-oled-750 hover:bg-oled-700 text-waText-secondary hover:text-waText-primary border border-oled-700 transition-all cursor-pointer"
          title="Merge another backup to stitch chat timeline"
        >
          <Layers class="w-3.5 h-3.5 text-ai-violetLight" />
          <span class="hidden md:inline">Merge Backup</span>
        </button>

        <!-- Install PWA Button (if browser supports install prompt) -->
        <button
          v-if="deferredInstallPrompt"
          type="button"
          @click="installPwa"
          class="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-medium bg-wa-emerald/10 text-wa-emerald border border-wa-emerald/30 hover:bg-wa-emerald/20 transition-all cursor-pointer"
          title="Install as desktop / mobile app"
        >
          <Download class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">Install</span>
        </button>

        <!-- Load Demo Button -->
        <button
          v-if="!db"
          type="button"
          @click="loadDemoFromHeader"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-oled-750 hover:bg-oled-700 text-waText-primary border border-oled-700 transition-all cursor-pointer"
        >
          <Database class="w-3.5 h-3.5 text-wa-emerald" />
          <span class="hidden sm:inline">Load Demo</span>
        </button>

        <!-- Change / Upload New File -->
        <button
          v-if="db"
          type="button"
          @click="resetWorkspace"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-oled-750 hover:bg-oled-700 text-waText-primary border border-oled-700 transition-all cursor-pointer"
          title="Upload or decrypt another backup"
        >
          <Upload class="w-3.5 h-3.5 text-waText-secondary" />
          <span class="hidden sm:inline">Upload New</span>
        </button>

        <!-- Gemini Settings Button -->
        <button
          type="button"
          @click="isApiModalOpen = true"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer"
          :class="[
            apiKey 
              ? 'bg-ai-violet/15 text-ai-violetLight border border-ai-violet/30 hover:bg-ai-violet/25' 
              : 'bg-oled-750 hover:bg-oled-700 text-waText-secondary hover:text-waText-primary border border-oled-700'
          ]"
          title="Configure Gemini 3.8 Flash AI Model"
        >
          <Sparkles class="w-3.5 h-3.5 text-ai-violet" />
          <span class="hidden md:inline">{{ apiKey ? model : 'Gemini AI' }}</span>
          <span v-if="apiKey" class="w-1.5 h-1.5 rounded-full bg-wa-emerald"></span>
        </button>

        <!-- GitHub Repo Link -->
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          class="p-2 rounded-xl text-waText-secondary hover:text-white hover:bg-oled-750 transition-colors"
          title="GitHub Repository"
        >
          <Github class="w-4 h-4" />
        </a>
      </div>
    </header>

    <!-- Main Workspace -->
    <main class="flex-1 overflow-hidden relative">
      <Transition name="fade-slide" mode="out-in">
        <!-- View 1: Upload & Decrypt Screen -->
        <div 
          v-if="!db" 
          key="upload-view"
          class="h-full overflow-y-auto flex items-center justify-center p-4 scrollbar-thin scrollbar-thumb-zinc-700"
        >
          <UploadCard @database-ready="handleDatabaseReady" />
        </div>

        <!-- View 2: Split Chat Workspace Screen -->
        <div 
          v-else 
          key="chat-workspace"
          class="h-full flex overflow-hidden"
        >
          <!-- Left Sidebar -->
          <div 
            class="h-full transition-all duration-200"
            :class="[
              mobileView === 'sidebar' ? 'block w-full sm:w-auto' : 'hidden sm:block'
            ]"
          >
            <ChatSidebar
              :threads="threads"
              :selected-chat-id="selectedChatId"
              @select-chat="selectThread"
            />
          </div>

          <!-- Right Chat Window -->
          <div 
            class="h-full flex-1 min-w-0 transition-all duration-200"
            :class="[
              mobileView === 'chat' ? 'block' : 'hidden sm:block'
            ]"
          >
            <ChatWindow
              v-if="selectedThread"
              :thread="selectedThread"
              :messages="currentMessages"
              @open-ai-drawer="openAiDrawer"
              @open-export-modal="openExportModal"
              @open-analytics="openAnalytics"
              @open-media="openMedia"
            />

            <!-- Empty Selection State -->
            <div 
              v-else 
              class="h-full flex flex-col items-center justify-center text-center p-8 bg-oled-900 text-waText-secondary"
            >
              <div class="w-16 h-16 rounded-3xl bg-oled-800 border border-oled-700 flex items-center justify-center text-wa-emerald mb-4">
                <MessageSquare class="w-8 h-8" />
              </div>
              <h3 class="text-base font-semibold text-waText-primary mb-1">
                Select a conversation
              </h3>
              <p class="text-xs max-w-sm">
                Choose any chat from the left sidebar to inspect message threads, filter dates, export text, or generate AI replies.
              </p>
            </div>
          </div>
        </div>
      </Transition>
    </main>

    <!-- Modals & Drawers -->
    <!-- AI Reply & TL;DR Drawer -->
    <AiReplyDrawer
      :is-open="isAiDrawerOpen"
      :thread="selectedThread || {}"
      :recent-messages="currentMessages"
      :sent-history="userSentHistory"
      :api-key="apiKey"
      :model="model"
      @close="isAiDrawerOpen = false"
      @open-api-modal="isApiModalOpen = true"
    />

    <!-- Analytics Dashboard Modal (WhatsApp Wrapped) -->
    <AnalyticsModal
      v-if="selectedThread"
      :is-open="isAnalyticsModalOpen"
      :thread="selectedThread"
      :messages="currentMessages"
      @close="isAnalyticsModalOpen = false"
    />

    <!-- Media, Links & Docs Drawer -->
    <MediaGalleryDrawer
      v-if="selectedThread"
      :is-open="isMediaGalleryOpen"
      :thread="selectedThread"
      :messages="currentMessages"
      @close="isMediaGalleryOpen = false"
    />

    <!-- Global Cross-Chat Search Modal -->
    <GlobalSearchModal
      :is-open="isGlobalSearchOpen"
      :db="db"
      @close="isGlobalSearchOpen = false"
      @jump-to-message="handleJumpToMessage"
      @open-global-search="isGlobalSearchOpen = true"
    />

    <!-- Export Modal (Styled HTML, TXT, JSON) -->
    <ExportModal
      v-if="exportPayload"
      :is-open="isExportModalOpen"
      :thread="exportPayload.thread"
      :messages="exportPayload.messages"
      @close="isExportModalOpen = false"
    />

    <!-- API Key Settings Modal -->
    <ApiKeyModal
      :is-open="isApiModalOpen"
      :initial-key="apiKey"
      :initial-model="model"
      @close="isApiModalOpen = false"
      @save="handleSaveApiSettings"
    />

    <!-- Multi-Backup Merge Modal -->
    <div v-if="isMergeModalOpen" class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div class="bg-oled-800 border border-oled-700 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-slide-up">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Layers class="w-5 h-5 text-ai-violetLight" />
            <h3 class="text-sm font-bold text-waText-primary">Merge Secondary Backup</h3>
          </div>
          <button @click="isMergeModalOpen = false; mergeResult = null;" class="p-1 rounded text-waText-secondary hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="text-xs text-waText-secondary">
          Import messages from an older or newer WhatsApp backup. Messages are deduplicated based on timestamp and ID to stitch together an unbroken timeline.
        </p>

        <div>
          <label class="text-xs font-semibold text-waText-primary block mb-1">
            64-Hex Key (if encrypted crypt15)
          </label>
          <input
            v-model="mergeHexKey"
            type="text"
            placeholder="64-character hex key..."
            class="w-full bg-oled-850 border border-oled-700 rounded-xl px-3 py-2 text-xs font-mono text-waText-primary focus:outline-none focus:border-ai-violet"
          />
        </div>

        <div class="border-2 border-dashed border-oled-700 rounded-xl p-4 text-center cursor-pointer hover:border-ai-violet/50 relative">
          <input
            type="file"
            accept=".crypt15,.db,*"
            @change="handleMergeFileSelected"
            class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <Upload class="w-6 h-6 text-ai-violetLight mx-auto mb-1" />
          <span class="text-xs font-semibold text-waText-primary block">Select backup file to merge</span>
          <span class="text-[10px] text-waText-secondary">Click or drop .crypt15 or .db</span>
        </div>

        <div v-if="isMerging" class="text-xs text-waText-secondary text-center py-2">
          Merging and deduplicating messages...
        </div>

        <div v-if="mergeResult" class="p-3 rounded-xl bg-wa-emerald/10 border border-wa-emerald/30 text-xs text-wa-emerald">
          Successfully imported {{ mergeResult.importedCount }} new messages! ({{ mergeResult.duplicateCount }} duplicates skipped).
        </div>
      </div>
    </div>
  </div>
</template>
