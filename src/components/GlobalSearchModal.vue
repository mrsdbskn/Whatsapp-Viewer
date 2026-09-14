<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { Search, X, MessageSquare, ArrowRight, CornerDownLeft } from 'lucide-vue-next';
import { searchAllMessages } from '../utils/db.js';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  db: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'jump-to-message']);

const searchQuery = ref('');
const searchResults = ref([]);
const searchInput = ref(null);

watch(searchQuery, (q) => {
  if (!props.db || !q.trim()) {
    searchResults.value = [];
    return;
  }
  searchResults.value = searchAllMessages(props.db, q.trim());
});

watch(() => props.isOpen, (val) => {
  if (val) {
    searchQuery.value = '';
    searchResults.value = [];
    setTimeout(() => {
      if (searchInput.value) searchInput.value.focus();
    }, 100);
  }
});

function handleSelectResult(result) {
  emit('jump-to-message', result);
  emit('close');
}

function highlightMatch(text, query) {
  if (!query || !query.trim() || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<mark class="bg-amber-400 text-black px-0.5 rounded font-semibold">$1</mark>');
}

// Global Ctrl+K / Cmd+K listener
function handleKeyDown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    emit(props.isOpen ? 'close' : 'open-global-search');
  }
  if (e.key === 'Escape' && props.isOpen) {
    emit('close');
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center pt-20 px-4 bg-black/75 backdrop-blur-sm animate-fade-in">
    <div class="bg-oled-800 border border-oled-700 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-slide-up flex flex-col max-h-[75vh]">
      <!-- Search Input Header -->
      <div class="p-4 border-b border-oled-700 flex items-center gap-3 bg-oled-850">
        <Search class="w-5 h-5 text-wa-emerald shrink-0" />
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          placeholder="Search all conversations (e.g. matcha, tokens, dinner, lasagna)..."
          class="flex-1 bg-transparent border-none text-sm text-waText-primary placeholder-waText-secondary focus:outline-none"
        />
        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-oled-700 text-waText-secondary">
          ESC
        </span>
        <button 
          @click="emit('close')"
          class="p-1.5 rounded-lg text-waText-secondary hover:text-waText-primary hover:bg-oled-750 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Results List -->
      <div class="p-3 overflow-y-auto divide-y divide-oled-700/40 scrollbar-thin scrollbar-thumb-zinc-700 flex-1">
        <div v-if="!searchQuery.trim()" class="p-8 text-center text-waText-secondary text-xs">
          Type keywords to search across all chats in your WhatsApp backup
        </div>

        <div v-else-if="searchResults.length === 0" class="p-8 text-center text-waText-secondary text-xs">
          No messages found matching "<span class="text-waText-primary">{{ searchQuery }}</span>"
        </div>

        <button
          v-for="res in searchResults"
          :key="res.id"
          type="button"
          @click="handleSelectResult(res)"
          class="w-full text-left p-3 rounded-xl hover:bg-oled-750/70 transition-colors cursor-pointer group flex flex-col gap-1"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-waText-primary group-hover:text-wa-emerald transition-colors flex items-center gap-1.5">
              <MessageSquare class="w-3.5 h-3.5 text-wa-emerald" />
              <span>{{ res.chatName }}</span>
            </span>
            <span class="text-[10px] text-waText-secondary font-mono">
              {{ new Date(res.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }) }}
            </span>
          </div>

          <div class="text-xs text-waText-secondary">
            <span class="font-semibold text-waText-primary mr-1">{{ res.fromMe ? 'You:' : `${res.chatName}:` }}</span>
            <span v-html="highlightMatch(res.text, searchQuery)"></span>
          </div>
        </button>
      </div>

      <!-- Footer -->
      <div class="px-4 py-2 bg-oled-850 border-t border-oled-700 text-[11px] text-waText-secondary flex items-center justify-between">
        <span>{{ searchResults.length }} matching messages found</span>
        <span class="text-[10px] font-mono">Press ESC to exit</span>
      </div>
    </div>
  </div>
</template>
