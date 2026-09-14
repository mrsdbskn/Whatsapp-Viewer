<script setup>
import { ref, computed } from 'vue';
import { 
  X, ExternalLink, Link2, FileText, ImageIcon, 
  Play, Pause, Mic, FolderOpen, Calendar, ArrowUpRight 
} from 'lucide-vue-next';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  thread: {
    type: Object,
    required: true
  },
  messages: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['close']);

const activeTab = ref('links'); // 'links' | 'media' | 'docs'
const playingAudioId = ref(null);

// Extract URLs from messages
const extractedLinks = computed(() => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const links = [];

  props.messages.forEach(msg => {
    if (!msg.text) return;
    const matches = msg.text.match(urlRegex);
    if (matches) {
      matches.forEach(url => {
        let domain = 'link';
        try {
          domain = new URL(url).hostname.replace('www.', '');
        } catch {}

        links.push({
          url,
          domain,
          text: msg.text,
          fromMe: msg.fromMe,
          timestamp: msg.timestamp,
          dateFormatted: new Date(msg.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
        });
      });
    }
  });

  return links.reverse(); // Newest first
});

// Extract Media & Audio
const extractedMedia = computed(() => {
  return props.messages.filter(m => m.type > 0 || (m.text && m.text.includes('Voice Message'))).map(m => {
    let mediaType = 'Photo';
    if (m.type === 2 || (m.text && m.text.includes('Voice Message'))) mediaType = 'Voice Note';
    if (m.type === 9) mediaType = 'Document';

    return {
      id: m.id,
      type: mediaType,
      rawType: m.type,
      text: m.text,
      timestamp: m.timestamp,
      fromMe: m.fromMe,
      dateFormatted: new Date(m.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })
    };
  }).reverse();
});

function togglePlay(id) {
  if (playingAudioId.value === id) {
    playingAudioId.value = null;
  } else {
    playingAudioId.value = id;
    // Auto-stop after 3 seconds simulation
    setTimeout(() => {
      if (playingAudioId.value === id) {
        playingAudioId.value = null;
      }
    }, 4000);
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
    <!-- Click backdrop to close -->
    <div class="flex-1" @click="emit('close')"></div>

    <!-- Drawer Panel -->
    <div class="bg-oled-800 border-l border-oled-700 w-full max-w-md h-full shadow-2xl flex flex-col animate-slide-up">
      <!-- Drawer Header -->
      <div class="px-5 py-4 border-b border-oled-700 flex items-center justify-between bg-oled-850">
        <div>
          <h3 class="text-sm font-bold text-waText-primary">Media, Links &amp; Docs</h3>
          <p class="text-xs text-waText-secondary">{{ thread.displayName }}</p>
        </div>
        <button 
          @click="emit('close')"
          class="p-1.5 rounded-lg text-waText-secondary hover:text-waText-primary hover:bg-oled-750 transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Tab Switcher -->
      <div class="flex border-b border-oled-700 bg-oled-850 px-4 gap-4 text-xs font-semibold">
        <button
          type="button"
          @click="activeTab = 'links'"
          class="py-3 border-b-2 transition-colors flex items-center gap-1.5"
          :class="activeTab === 'links' ? 'border-wa-emerald text-wa-emerald' : 'border-transparent text-waText-secondary hover:text-white'"
        >
          <Link2 class="w-3.5 h-3.5" />
          <span>Links ({{ extractedLinks.length }})</span>
        </button>

        <button
          type="button"
          @click="activeTab = 'media'"
          class="py-3 border-b-2 transition-colors flex items-center gap-1.5"
          :class="activeTab === 'media' ? 'border-wa-emerald text-wa-emerald' : 'border-transparent text-waText-secondary hover:text-white'"
        >
          <ImageIcon class="w-3.5 h-3.5" />
          <span>Media &amp; Audio ({{ extractedMedia.length }})</span>
        </button>
      </div>

      <!-- Drawer Content -->
      <div class="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-700">
        <!-- Links Tab -->
        <div v-if="activeTab === 'links'" class="space-y-2.5">
          <div v-if="extractedLinks.length === 0" class="text-center py-12 text-waText-secondary">
            <Link2 class="w-8 h-8 mx-auto mb-2 text-oled-700" />
            <p class="text-xs">No links shared in this conversation</p>
          </div>

          <a
            v-for="(item, idx) in extractedLinks"
            :key="idx"
            :href="item.url"
            target="_blank"
            rel="noopener noreferrer"
            class="block bg-oled-850 hover:bg-oled-750 border border-oled-700 rounded-xl p-3.5 transition-all group"
          >
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-wa-emerald/10 text-wa-emerald border border-wa-emerald/20 truncate max-w-[180px]">
                {{ item.domain }}
              </span>
              <span class="text-[10px] text-waText-secondary font-mono flex items-center gap-1">
                {{ item.dateFormatted }}
                <ArrowUpRight class="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </span>
            </div>
            <p class="text-xs text-waText-primary font-medium truncate mt-1 group-hover:text-wa-emerald transition-colors">
              {{ item.url }}
            </p>
            <p class="text-[11px] text-waText-secondary truncate mt-0.5">
              {{ item.text }}
            </p>
          </a>
        </div>

        <!-- Media & Audio Tab -->
        <div v-if="activeTab === 'media'" class="space-y-3">
          <div v-if="extractedMedia.length === 0" class="text-center py-12 text-waText-secondary">
            <ImageIcon class="w-8 h-8 mx-auto mb-2 text-oled-700" />
            <p class="text-xs">No media or audio messages found</p>
          </div>

          <div
            v-for="item in extractedMedia"
            :key="item.id"
            class="bg-oled-850 border border-oled-700 rounded-xl p-3 flex items-center justify-between gap-3"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div 
                class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                :class="item.type === 'Voice Note' ? 'bg-wa-emerald/20 text-wa-emerald' : 'bg-ai-violet/20 text-ai-violetLight'"
              >
                <Mic v-if="item.type === 'Voice Note'" class="w-5 h-5" />
                <ImageIcon v-else-if="item.type === 'Photo'" class="w-5 h-5" />
                <FileText v-else class="w-5 h-5" />
              </div>

              <div class="min-w-0">
                <span class="text-xs font-semibold text-waText-primary block truncate">
                  {{ item.type }}
                </span>
                <span class="text-[10px] text-waText-secondary">
                  {{ item.fromMe ? 'Sent by you' : 'Received' }} &bull; {{ item.dateFormatted }}
                </span>
              </div>
            </div>

            <!-- Voice Note Player Simulation -->
            <button
              v-if="item.type === 'Voice Note'"
              type="button"
              @click="togglePlay(item.id)"
              class="px-3 py-1.5 rounded-lg bg-oled-750 hover:bg-oled-700 text-wa-emerald text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
            >
              <Pause v-if="playingAudioId === item.id" class="w-3.5 h-3.5 fill-current" />
              <Play v-else class="w-3.5 h-3.5 fill-current" />
              <span>{{ playingAudioId === item.id ? 'Playing...' : 'Play' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
