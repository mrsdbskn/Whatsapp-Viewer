<script setup>
import { ref, computed } from 'vue';
import { Download, Copy, Check, X, FileText, FileCode, CheckCircle2 } from 'lucide-vue-next';
import { generateWhatsAppTxt, generateWhatsAppJson, triggerDownload } from '../utils/export.js';

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

const exportFormat = ref('txt'); // 'txt' | 'json'
const copied = ref(false);

const sanitizedName = computed(() => {
  return (props.thread?.displayName || 'Chat').replace(/[^a-zA-Z0-9_-]/g, '_');
});

const exportContent = computed(() => {
  if (exportFormat.value === 'json') {
    return generateWhatsAppJson({
      chatName: props.thread?.displayName || 'Contact',
      messages: props.messages
    });
  }
  return generateWhatsAppTxt({
    chatName: props.thread?.displayName || 'Contact',
    messages: props.messages
  });
});

const previewSnippet = computed(() => {
  const lines = exportContent.value.split('\n');
  return lines.slice(0, 15).join('\n') + (lines.length > 15 ? '\n... (more messages included in download)' : '');
});

function handleDownload() {
  const ext = exportFormat.value === 'json' ? 'json' : 'txt';
  const mime = exportFormat.value === 'json' ? 'application/json' : 'text/plain;charset=utf-8';
  const filename = `WhatsApp_Chat_${sanitizedName.value}.${ext}`;
  triggerDownload(exportContent.value, filename, mime);
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(exportContent.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.warn('Copy failed:', err);
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
    <div class="bg-oled-800 border border-oled-700 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden animate-slide-up">
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-oled-700 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-wa-emerald/20 text-wa-emerald flex items-center justify-center">
            <Download class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-waText-primary">
              Export Chat Thread
            </h3>
            <p class="text-xs text-waText-secondary">
              {{ thread.displayName }} &bull; {{ messages.length }} messages
            </p>
          </div>
        </div>

        <button 
          @click="emit('close')"
          class="p-1.5 rounded-lg text-waText-secondary hover:text-waText-primary hover:bg-oled-750 transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6 space-y-4">
        <!-- Format Selection -->
        <div>
          <label class="text-xs font-semibold text-waText-secondary uppercase tracking-wider block mb-2">
            Select Export Format
          </label>
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              @click="exportFormat = 'txt'"
              class="flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
              :class="[
                exportFormat === 'txt'
                  ? 'border-wa-emerald bg-wa-emerald/10 text-waText-primary'
                  : 'border-oled-700 hover:border-oled-600 bg-oled-850 text-waText-secondary'
              ]"
            >
              <FileText class="w-5 h-5" :class="exportFormat === 'txt' ? 'text-wa-emerald' : 'text-waText-secondary'" />
              <div>
                <span class="text-xs font-semibold block text-waText-primary">WhatsApp TXT</span>
                <span class="text-[10px] text-waText-secondary">Standard [DD/MM/YYYY, HH:MM]</span>
              </div>
            </button>

            <button
              type="button"
              @click="exportFormat = 'json'"
              class="flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
              :class="[
                exportFormat === 'json'
                  ? 'border-wa-emerald bg-wa-emerald/10 text-waText-primary'
                  : 'border-oled-700 hover:border-oled-600 bg-oled-850 text-waText-secondary'
              ]"
            >
              <FileCode class="w-5 h-5" :class="exportFormat === 'json' ? 'text-wa-emerald' : 'text-waText-secondary'" />
              <div>
                <span class="text-xs font-semibold block text-waText-primary">JSON Format</span>
                <span class="text-[10px] text-waText-secondary">Full structured metadata</span>
              </div>
            </button>
          </div>
        </div>

        <!-- Preview Box -->
        <div>
          <div class="flex items-center justify-between text-xs font-medium text-waText-secondary mb-1.5">
            <span>Preview</span>
            <span class="text-[10px] font-mono">{{ messages.length }} messages</span>
          </div>
          <pre class="bg-oled-900 border border-oled-700 rounded-xl p-3 text-[11px] font-mono text-waText-primary overflow-x-auto max-h-48 scrollbar-thin scrollbar-thumb-zinc-700 leading-relaxed">{{ previewSnippet }}</pre>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-4 bg-oled-850 border-t border-oled-700 flex items-center justify-end gap-3">
        <button
          type="button"
          @click="handleCopy"
          class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-oled-750 hover:bg-oled-700 text-waText-primary border border-oled-700 transition-colors"
        >
          <Check v-if="copied" class="w-4 h-4 text-wa-emerald" />
          <Copy v-else class="w-4 h-4" />
          <span>{{ copied ? 'Copied to Clipboard!' : 'Copy to Clipboard' }}</span>
        </button>

        <button
          type="button"
          @click="handleDownload"
          class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-wa-emerald hover:bg-wa-emeraldHover text-white shadow-lg shadow-wa-emerald/20 transition-all active:scale-95"
        >
          <Download class="w-4 h-4" />
          <span>Download {{ exportFormat.toUpperCase() }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
