<script setup>
import { ref, computed } from 'vue';
import { Search, Users, User, MessageSquare, X } from 'lucide-vue-next';

const props = defineProps({
  threads: {
    type: Array,
    required: true
  },
  selectedChatId: {
    type: [Number, String],
    default: null
  }
});

const emit = defineEmits(['select-chat']);

const searchQuery = ref('');

// Filter threads by search query
const filteredThreads = computed(() => {
  if (!searchQuery.value.trim()) return props.threads;
  const q = searchQuery.value.toLowerCase().trim();
  return props.threads.filter(t => 
    (t.displayName && t.displayName.toLowerCase().includes(q)) ||
    (t.jid && t.jid.toLowerCase().includes(q)) ||
    (t.lastMsg && t.lastMsg.toLowerCase().includes(q))
  );
});

// Format timestamp for sidebar list
function formatThreadTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Generate initials for avatar
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
</script>

<template>
  <div class="h-full flex flex-col bg-oled-800 border-r border-oled-700 w-full sm:w-80 md:w-96 shrink-0">
    <!-- Search Bar -->
    <div class="p-3 border-b border-oled-700">
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search or start new chat"
          class="w-full bg-oled-850 border border-oled-700 rounded-xl pl-9 pr-8 py-2 text-xs text-waText-primary placeholder-waText-secondary focus:outline-none focus:border-wa-emerald/50 focus:ring-1 focus:ring-wa-emerald/30 transition-all"
        />
        <Search class="w-4 h-4 text-waText-secondary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <button 
          v-if="searchQuery" 
          @click="searchQuery = ''"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-waText-secondary hover:text-waText-primary"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Threads Count / Status Header -->
    <div class="px-4 py-2 text-[11px] font-medium text-waText-secondary flex items-center justify-between border-b border-oled-700/50 bg-oled-850/40">
      <span>{{ filteredThreads.length }} {{ filteredThreads.length === 1 ? 'CONVERSATION' : 'CONVERSATIONS' }}</span>
      <span class="text-wa-emerald font-mono">{{ threads.reduce((acc, t) => acc + (t.msgCount || 0), 0).toLocaleString() }} total msgs</span>
    </div>

    <!-- Conversation List -->
    <div class="flex-1 overflow-y-auto divide-y divide-oled-700/30">
      <div v-if="filteredThreads.length === 0" class="p-8 text-center text-waText-secondary">
        <MessageSquare class="w-8 h-8 mx-auto mb-2 text-oled-600" />
        <p class="text-xs">No conversations match your search</p>
      </div>

      <TransitionGroup name="list">
        <button
          v-for="thread in filteredThreads"
          :key="thread.chatId"
          type="button"
          @click="emit('select-chat', thread)"
          class="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer group relative"
          :class="[
            selectedChatId === thread.chatId 
              ? 'bg-oled-750' 
              : 'hover:bg-oled-750/60 bg-transparent'
          ]"
        >
          <!-- Active Indicator Bar -->
          <div 
            v-if="selectedChatId === thread.chatId"
            class="absolute left-0 top-0 bottom-0 w-1 bg-wa-emerald rounded-r"
          ></div>

          <!-- Avatar -->
          <div 
            class="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold transition-transform group-hover:scale-105"
            :class="[
              thread.isGroup 
                ? 'bg-oled-700 text-wa-emerald border border-oled-600' 
                : 'bg-emerald-950/80 text-wa-emerald border border-wa-emerald/30'
            ]"
          >
            <Users v-if="thread.isGroup" class="w-5 h-5 text-wa-emerald" />
            <span v-else>{{ getInitials(thread.displayName) }}</span>
          </div>

          <!-- Thread Details -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-semibold text-waText-primary truncate group-hover:text-white">
                {{ thread.displayName }}
              </span>
              <span class="text-[10px] text-waText-secondary shrink-0 font-mono ml-2">
                {{ formatThreadTime(thread.lastTimestamp) }}
              </span>
            </div>

            <div class="flex items-center justify-between gap-2">
              <p class="text-[11px] text-waText-secondary truncate flex-1 group-hover:text-waText-primary/80">
                {{ thread.lastMsg || 'Tap to view conversation' }}
              </p>
              <span 
                v-if="thread.msgCount > 0"
                class="text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 font-medium"
                :class="selectedChatId === thread.chatId ? 'bg-wa-emerald text-white' : 'bg-oled-700 text-waText-secondary'"
              >
                {{ thread.msgCount }}
              </span>
            </div>
          </div>
        </button>
      </TransitionGroup>
    </div>
  </div>
</template>
