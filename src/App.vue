<script setup>
import { ref, computed, onMounted } from 'vue';
import { 
  MessageSquare, ShieldCheck, Sparkles, Settings, 
  Upload, ArrowLeft, Github, Database, FileText, CheckCircle2 
} from 'lucide-vue-next';
import UploadCard from './components/UploadCard.vue';
import ChatSidebar from './components/ChatSidebar.vue';
import ChatWindow from './components/ChatWindow.vue';
import AiReplyDrawer from './components/AiReplyDrawer.vue';
import ApiKeyModal from './components/ApiKeyModal.vue';
import ExportModal from './components/ExportModal.vue';
import { openDatabase, fetchChatThreads, fetchMessagesForChat, fetchUserSentHistory, generateMockWhatsAppDb } from './utils/db.js';

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
const exportPayload = ref(null);

// AI Configuration
const apiKey = ref('');
const model = ref('gemini-3.8-flash');

// Responsive mobile view: 'sidebar' | 'chat'
const mobileView = ref('sidebar');

// Active selected thread object
const selectedThread = computed(() => {
  if (!selectedChatId.value) return null;
  return threads.value.find(t => t.chatId === selectedChatId.value) || null;
});

// Total messages across all threads
const totalMessageCount = computed(() => {
  return threads.value.reduce((acc, t) => acc + (t.msgCount || 0), 0);
});

onMounted(() => {
  apiKey.value = localStorage.getItem('gemini_api_key') || '';
  model.value = localStorage.getItem('gemini_model') || 'gemini-3.8-flash';
});

// Database Ready Handler (from UploadCard)
async function handleDatabaseReady({ bytes, source, fileName }) {
  try {
    const database = await openDatabase(bytes);
    db.value = database;
    dbMeta.value = { source, fileName };

    // Fetch conversation threads
    const loadedThreads = fetchChatThreads(database);
    threads.value = loadedThreads;

    // Fetch user's sent message history for AI style analyzer
    userSentHistory.value = fetchUserSentHistory(database, 200);

    // Auto-select first thread if available
    if (loadedThreads.length > 0) {
      selectThread(loadedThreads[0]);
    }
  } catch (err) {
    console.error('Error loading database into workspace:', err);
    alert('Failed to load database: ' + err.message);
  }
}

// Select a thread to view
function selectThread(thread) {
  selectedChatId.value = thread.chatId;
  if (db.value) {
    currentMessages.value = fetchMessagesForChat(db.value, thread.chatId);
  }
  mobileView.value = 'chat';
}

// Load Demo DB from header
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

// Reset workspace to upload another file
function resetWorkspace() {
  if (db.value) {
    try {
      db.value.close();
    } catch {
      // Ignore
    }
  }
  db.value = null;
  dbMeta.value = null;
  threads.value = [];
  selectedChatId.value = null;
  currentMessages.value = [];
  mobileView.value = 'sidebar';
}

// Open Export Modal
function openExportModal({ thread, messages }) {
  exportPayload.value = { thread, messages };
  isExportModalOpen.value = true;
}

// Open AI Reply Drawer
function openAiDrawer() {
  isAiDrawerOpen.value = true;
}

// Save API Key Configuration
function handleSaveApiSettings({ apiKey: newKey, model: newModel }) {
  apiKey.value = newKey;
  model.value = newModel;
}
</script>

<template>
  <div class="h-screen w-screen flex flex-col bg-oled-900 text-waText-primary overflow-hidden font-sans select-none">
    <!-- Top Global App Header -->
    <header class="h-14 bg-oled-850 border-b border-oled-700 px-4 flex items-center justify-between shrink-0 z-30 shadow-md">
      <!-- Left: Logo & Database Status -->
      <div class="flex items-center gap-3">
        <!-- Mobile back button (when in chat view) -->
        <button
          v-if="db && mobileView === 'chat'"
          @click="mobileView = 'sidebar'"
          class="sm:hidden p-1.5 rounded-lg text-waText-secondary hover:text-white hover:bg-oled-750 mr-1"
          title="Back to conversations"
        >
          <ArrowLeft class="w-5 h-5" />
        </button>

        <div class="flex items-center gap-2">
          <!-- WhatsApp Emerald Icon -->
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
            <p v-if="dbMeta" class="text-[10px] text-waText-secondary truncate max-w-[200px] sm:max-w-xs">
              {{ dbMeta.fileName }} &bull; {{ threads.length }} chats &bull; {{ totalMessageCount.toLocaleString() }} msgs
            </p>
          </div>
        </div>
      </div>

      <!-- Right: Global Actions -->
      <div class="flex items-center gap-2">
        <!-- Load Demo Button (if no DB is active) -->
        <button
          v-if="!db"
          type="button"
          @click="loadDemoFromHeader"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-oled-750 hover:bg-oled-700 text-waText-primary border border-oled-700 transition-all cursor-pointer"
        >
          <Database class="w-3.5 h-3.5 text-wa-emerald" />
          <span class="hidden sm:inline">Load Demo</span>
        </button>

        <!-- Change / Upload New File (if DB active) -->
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

    <!-- Main Workspace with Vue Transition -->
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
          <!-- Left Sidebar (Desktop always visible, mobile toggleable) -->
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

          <!-- Right Chat Window (Desktop always visible, mobile toggleable) -->
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
            />

            <!-- Empty Selection State (if no thread selected) -->
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

    <ExportModal
      v-if="exportPayload"
      :is-open="isExportModalOpen"
      :thread="exportPayload.thread"
      :messages="exportPayload.messages"
      @close="isExportModalOpen = false"
    />

    <ApiKeyModal
      :is-open="isApiModalOpen"
      :initial-key="apiKey"
      :initial-model="model"
      @close="isApiModalOpen = false"
      @save="handleSaveApiSettings"
    />
  </div>
</template>
