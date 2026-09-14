<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { 
  Search, Calendar, Download, Sparkles, CheckCheck, 
  ArrowDown, Users, ChevronRight, X, Play, FileText, Image as ImageIcon,
  Clock, Check
} from 'lucide-vue-next';

const props = defineProps({
  thread: {
    type: Object,
    required: true
  },
  messages: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['open-ai-drawer', 'open-export-modal']);

const messagesContainer = ref(null);
const showSearch = ref(false);
const showDateFilter = ref(false);
const inChatSearch = ref('');
const senderFilter = ref('all'); // 'all' | 'sent' | 'received'
const startDate = ref('');
const endDate = ref('');
const showScrollBottom = ref(false);

// Filter messages locally in window
const filteredMessages = computed(() => {
  return props.messages.filter(msg => {
    // Sender filter
    if (senderFilter.value === 'sent' && !msg.fromMe) return false;
    if (senderFilter.value === 'received' && msg.fromMe) return false;

    // Date range filter
    if (startDate.value) {
      const startMs = new Date(startDate.value).setHours(0, 0, 0, 0);
      if (msg.timestamp < startMs) return false;
    }
    if (endDate.value) {
      const endMs = new Date(endDate.value).setHours(23, 59, 59, 999);
      if (msg.timestamp > endMs) return false;
    }

    // Search query filter
    if (inChatSearch.value.trim()) {
      const q = inChatSearch.value.toLowerCase().trim();
      const text = (msg.text || '').toLowerCase();
      if (!text.includes(q)) return false;
    }

    return true;
  });
});

// Group messages by date for date separator pill
const groupedByDate = computed(() => {
  const groups = [];
  let currentDateStr = '';
  let currentGroup = null;

  filteredMessages.value.forEach(msg => {
    const d = new Date(msg.timestamp);
    const dateStr = d.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    if (dateStr !== currentDateStr) {
      currentDateStr = dateStr;
      currentGroup = {
        dateLabel: formatDateLabel(d),
        messages: []
      };
      groups.push(currentGroup);
    }
    currentGroup.messages.push(msg);
  });

  return groups;
});

function formatDateLabel(d) {
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return d.toLocaleDateString(undefined, { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

function formatMessageTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

function handleScroll() {
  if (!messagesContainer.value) return;
  const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value;
  showScrollBottom.value = scrollHeight - scrollTop - clientHeight > 300;
}

// Highlight search query in text
function highlightText(text, query) {
  if (!query || !query.trim() || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<mark class="bg-amber-400 text-black px-0.5 rounded font-semibold">$1</mark>');
}

// Reset filters
function clearFilters() {
  inChatSearch.value = '';
  startDate.value = '';
  endDate.value = '';
  senderFilter.value = 'all';
}

watch(() => props.thread?.chatId, () => {
  clearFilters();
  scrollToBottom();
}, { immediate: true });

onMounted(() => {
  scrollToBottom();
});
</script>

<template>
  <div class="flex-1 h-full flex flex-col bg-oled-900 relative overflow-hidden">
    <!-- Chat Header -->
    <div class="h-16 px-4 bg-oled-800 border-b border-oled-700 flex items-center justify-between shrink-0 z-20 shadow-sm">
      <div class="flex items-center gap-3 min-w-0">
        <div 
          class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
          :class="[
            thread.isGroup 
              ? 'bg-oled-700 text-wa-emerald border border-oled-600' 
              : 'bg-emerald-950/80 text-wa-emerald border border-wa-emerald/30'
          ]"
        >
          <Users v-if="thread.isGroup" class="w-5 h-5 text-wa-emerald" />
          <span v-else>{{ thread.displayName.slice(0, 2).toUpperCase() }}</span>
        </div>

        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-waText-primary truncate">
            {{ thread.displayName }}
          </h2>
          <p class="text-[11px] text-waText-secondary truncate font-mono">
            {{ thread.jid || 'WhatsApp Thread' }} &bull; {{ props.messages.length }} messages
          </p>
        </div>
      </div>

      <!-- Header Action Controls -->
      <div class="flex items-center gap-1.5 sm:gap-2">
        <!-- In-Chat Search Button -->
        <button
          type="button"
          @click="showSearch = !showSearch"
          class="p-2 rounded-lg transition-colors text-waText-secondary hover:text-waText-primary"
          :class="showSearch || inChatSearch ? 'bg-oled-700 text-wa-emerald' : 'hover:bg-oled-750'"
          title="Search within conversation"
        >
          <Search class="w-4 h-4" />
        </button>

        <!-- Date Range Filter Button -->
        <button
          type="button"
          @click="showDateFilter = !showDateFilter"
          class="p-2 rounded-lg transition-colors text-waText-secondary hover:text-waText-primary"
          :class="showDateFilter || startDate || endDate ? 'bg-oled-700 text-wa-emerald' : 'hover:bg-oled-750'"
          title="Filter by date range"
        >
          <Calendar class="w-4 h-4" />
        </button>

        <!-- Export to TXT Button -->
        <button
          type="button"
          @click="emit('open-export-modal', { thread, messages: filteredMessages })"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-oled-750 hover:bg-oled-700 text-waText-primary border border-oled-700 transition-colors"
          title="Export filtered conversation to TXT"
        >
          <Download class="w-3.5 h-3.5 text-wa-emerald" />
          <span class="hidden sm:inline">Export TXT</span>
        </button>

        <!-- AI Reply Button -->
        <button
          type="button"
          @click="emit('open-ai-drawer', { thread, messages: props.messages })"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-ai-violet to-purple-600 hover:from-purple-500 hover:to-ai-violet text-white shadow-ai-glow transition-all active:scale-95 cursor-pointer"
        >
          <Sparkles class="w-3.5 h-3.5" />
          <span>AI Reply</span>
        </button>
      </div>
    </div>

    <!-- Collapsible Search & Filter Sub-Bar -->
    <div 
      v-if="showSearch || showDateFilter || inChatSearch || startDate || endDate || senderFilter !== 'all'"
      class="bg-oled-850/95 border-b border-oled-700 px-4 py-2.5 flex flex-wrap items-center gap-3 text-xs z-10 animate-fade-in backdrop-blur-sm"
    >
      <!-- Search Input -->
      <div v-if="showSearch || inChatSearch" class="relative flex-1 min-w-[180px]">
        <input
          v-model="inChatSearch"
          type="text"
          placeholder="Search text in this chat..."
          class="w-full bg-oled-800 border border-oled-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-waText-primary placeholder-waText-secondary focus:outline-none focus:border-wa-emerald"
        />
        <Search class="w-3.5 h-3.5 text-waText-secondary absolute left-2.5 top-1/2 -translate-y-1/2" />
        <button 
          v-if="inChatSearch" 
          @click="inChatSearch = ''" 
          class="absolute right-2 top-1/2 -translate-y-1/2 text-waText-secondary hover:text-white"
        >
          <X class="w-3 h-3" />
        </button>
      </div>

      <!-- Date Pickers -->
      <div v-if="showDateFilter || startDate || endDate" class="flex items-center gap-2">
        <div class="flex items-center gap-1 text-[11px] text-waText-secondary">
          <span>From:</span>
          <input 
            v-model="startDate" 
            type="date" 
            class="bg-oled-800 border border-oled-700 rounded px-1.5 py-1 text-[11px] text-waText-primary focus:outline-none focus:border-wa-emerald" 
          />
        </div>
        <div class="flex items-center gap-1 text-[11px] text-waText-secondary">
          <span>To:</span>
          <input 
            v-model="endDate" 
            type="date" 
            class="bg-oled-800 border border-oled-700 rounded px-1.5 py-1 text-[11px] text-waText-primary focus:outline-none focus:border-wa-emerald" 
          />
        </div>
      </div>

      <!-- Sender Filter Selector -->
      <div class="flex items-center bg-oled-800 p-0.5 rounded-lg border border-oled-700 text-[11px]">
        <button 
          type="button" 
          @click="senderFilter = 'all'"
          class="px-2 py-0.5 rounded transition-colors"
          :class="senderFilter === 'all' ? 'bg-wa-emerald text-white font-medium' : 'text-waText-secondary hover:text-white'"
        >
          All
        </button>
        <button 
          type="button" 
          @click="senderFilter = 'sent'"
          class="px-2 py-0.5 rounded transition-colors"
          :class="senderFilter === 'sent' ? 'bg-wa-emerald text-white font-medium' : 'text-waText-secondary hover:text-white'"
        >
          Sent
        </button>
        <button 
          type="button" 
          @click="senderFilter = 'received'"
          class="px-2 py-0.5 rounded transition-colors"
          :class="senderFilter === 'received' ? 'bg-wa-emerald text-white font-medium' : 'text-waText-secondary hover:text-white'"
        >
          Received
        </button>
      </div>

      <!-- Results Count & Reset Button -->
      <div class="flex items-center gap-2 ml-auto text-[11px] text-waText-secondary">
        <span>{{ filteredMessages.length }} shown</span>
        <button 
          v-if="inChatSearch || startDate || endDate || senderFilter !== 'all'"
          @click="clearFilters"
          class="text-wa-emerald hover:underline font-medium"
        >
          Reset
        </button>
      </div>
    </div>

    <!-- Message Bubble Stream -->
    <div 
      ref="messagesContainer"
      @scroll="handleScroll"
      class="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4 chat-bg-pattern scrollbar-thin scrollbar-thumb-zinc-700"
    >
      <div v-if="filteredMessages.length === 0" class="h-full flex flex-col items-center justify-center text-center py-12 text-waText-secondary">
        <Search class="w-10 h-10 text-oled-700 mb-2" />
        <p class="text-sm font-medium">No messages found matching criteria</p>
        <button 
          v-if="inChatSearch || startDate || endDate || senderFilter !== 'all'" 
          @click="clearFilters" 
          class="mt-2 text-xs text-wa-emerald hover:underline"
        >
          Clear all filters
        </button>
      </div>

      <!-- Groups by Date -->
      <div v-for="group in groupedByDate" :key="group.dateLabel" class="space-y-2">
        <!-- Date Separator Badge -->
        <div class="flex justify-center my-3 sticky top-2 z-10">
          <span class="px-3 py-1 rounded-lg bg-oled-800/90 border border-oled-700 text-waText-secondary text-[11px] font-medium shadow-sm backdrop-blur-sm">
            {{ group.dateLabel }}
          </span>
        </div>

        <!-- Message Item -->
        <div
          v-for="msg in group.messages"
          :key="msg.id"
          class="flex flex-col"
          :class="msg.fromMe ? 'items-end' : 'items-start'"
        >
          <!-- Message Bubble Container -->
          <div
            class="max-w-[85%] sm:max-w-[70%] md:max-w-[60%] rounded-xl px-3 py-1.5 shadow-bubble relative transition-all group select-text"
            :class="[
              msg.fromMe 
                ? 'bg-bubble-sent text-waText-primary rounded-tr-none' 
                : 'bg-bubble-received text-waText-primary rounded-tl-none border border-oled-700/60'
            ]"
          >
            <!-- Group Sender Name if Received & Group -->
            <div 
              v-if="!msg.fromMe && thread.isGroup" 
              class="text-[11px] font-semibold text-emerald-400 mb-0.5"
            >
              {{ thread.displayName }}
            </div>

            <!-- Media Item Layouts -->
            <div v-if="msg.type === 1" class="mb-1 rounded-lg bg-oled-900/40 p-3 flex items-center gap-2.5 border border-white/5">
              <ImageIcon class="w-5 h-5 text-wa-emerald shrink-0" />
              <div class="text-xs">
                <p class="font-medium text-waText-primary">Photo Attachment</p>
                <p class="text-[10px] text-waText-secondary">Encrypted media payload</p>
              </div>
            </div>

            <div v-else-if="msg.type === 2" class="mb-1 rounded-lg bg-oled-900/40 p-2 flex items-center gap-3 border border-white/5 min-w-[200px]">
              <button class="w-8 h-8 rounded-full bg-wa-emerald/20 text-wa-emerald flex items-center justify-center shrink-0 hover:scale-105 transition-transform">
                <Play class="w-4 h-4 fill-current ml-0.5" />
              </button>
              <div class="flex-1 space-y-1">
                <div class="h-1 bg-white/20 rounded-full overflow-hidden">
                  <div class="h-full bg-wa-emerald w-1/3"></div>
                </div>
                <div class="flex justify-between text-[10px] text-waText-secondary font-mono">
                  <span>0:14</span>
                  <span>Voice Note</span>
                </div>
              </div>
            </div>

            <div v-else-if="msg.type === 9" class="mb-1 rounded-lg bg-oled-900/40 p-2.5 flex items-center gap-2.5 border border-white/5">
              <FileText class="w-5 h-5 text-ai-violetLight shrink-0" />
              <div class="text-xs truncate">
                <p class="font-medium text-waText-primary truncate">Document Attachment</p>
                <p class="text-[10px] text-waText-secondary">PDF / Office Document</p>
              </div>
            </div>

            <!-- Message Text with highlighted search matches -->
            <p 
              class="text-[13px] leading-relaxed break-words whitespace-pre-wrap selection:bg-wa-emerald/40"
              v-html="highlightText(msg.text, inChatSearch)"
            ></p>

            <!-- Message Footer: Time + Status Tick -->
            <div class="flex items-center justify-end gap-1 mt-1 text-[10px] text-waText-secondary float-right ml-3 select-none">
              <span class="font-mono">{{ formatMessageTime(msg.timestamp) }}</span>
              <span v-if="msg.fromMe" class="text-wa-emerald">
                <CheckCheck v-if="msg.status >= 4" class="w-3.5 h-3.5 stroke-[2.5]" />
                <Check v-else class="w-3.5 h-3.5 stroke-[2.5]" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Jump to Bottom Floating Button -->
    <button
      v-if="showScrollBottom"
      type="button"
      @click="scrollToBottom"
      class="absolute bottom-6 right-6 w-10 h-10 rounded-full bg-oled-750 hover:bg-oled-700 text-waText-primary border border-oled-700 shadow-xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95 z-20 cursor-pointer"
      title="Scroll to latest messages"
    >
      <ArrowDown class="w-4 h-4 text-wa-emerald" />
    </button>
  </div>
</template>
