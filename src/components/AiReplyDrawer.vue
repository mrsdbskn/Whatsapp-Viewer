<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { 
  Sparkles, X, Copy, Check, RefreshCw, Sliders, 
  Send, Bot, BrainCircuit, Key, ArrowRight, Lightbulb, MessageSquare
} from 'lucide-vue-next';
import { analyzeTextingStyle, generateGeminiReplies, generateOfflineDemoReplies } from '../utils/gemini.js';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  thread: {
    type: Object,
    required: true
  },
  recentMessages: {
    type: Array,
    required: true
  },
  sentHistory: {
    type: Array,
    default: () => []
  },
  apiKey: {
    type: String,
    default: ''
  },
  model: {
    type: String,
    default: 'gemini-3.8-flash'
  }
});

const emit = defineEmits(['close', 'open-api-modal', 'apply-reply']);

const customInstruction = ref('');
const isGenerating = ref(false);
const errorMessage = ref('');
const copiedKey = ref(null);
const styleProfile = ref(null);

const replies = ref({
  casual: '',
  detailed: '',
  witty: ''
});

// Latest inbound message to respond to
const lastReceivedMsg = computed(() => {
  const reversed = [...props.recentMessages].reverse();
  const received = reversed.find(m => !m.fromMe && m.text);
  return received ? received.text : 'Hey, what are your thoughts?';
});

// Calculate style profile from sent history
function computeStyle() {
  const history = props.sentHistory.length > 0 
    ? props.sentHistory 
    : props.recentMessages.filter(m => m.fromMe && m.text).map(m => m.text);

  styleProfile.value = analyzeTextingStyle(history);
}

// Generate replies
async function generateReplies() {
  errorMessage.value = '';
  isGenerating.value = true;

  try {
    if (!styleProfile.value) {
      computeStyle();
    }

    if (props.apiKey && props.apiKey.trim()) {
      // Use live Gemini 3.8 Flash API
      const results = await generateGeminiReplies({
        apiKey: props.apiKey,
        model: props.model,
        chatName: props.thread?.displayName || 'Contact',
        recentMessages: props.recentMessages,
        styleProfile: styleProfile.value,
        customInstruction: customInstruction.value
      });
      replies.value = results;
    } else {
      // Use offline authentic demo generator
      await new Promise(r => setTimeout(r, 600)); // smooth micro-interaction
      const demo = generateOfflineDemoReplies(
        styleProfile.value, 
        props.thread?.displayName, 
        lastReceivedMsg.value
      );
      replies.value = demo;
    }
  } catch (err) {
    console.error('Failed to generate AI replies:', err);
    errorMessage.value = err.message || 'Error generating AI reply.';
  } finally {
    isGenerating.value = false;
  }
}

async function copyToClipboard(text, key) {
  try {
    await navigator.clipboard.writeText(text);
    copiedKey.value = key;
    setTimeout(() => {
      copiedKey.value = null;
    }, 2000);
  } catch (err) {
    console.warn('Copy failed:', err);
  }
}

watch(() => props.isOpen, (val) => {
  if (val) {
    computeStyle();
    if (!replies.value.casual) {
      generateReplies();
    }
  }
});
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-hidden flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity">
    <!-- Click outside to close -->
    <div class="flex-1" @click="emit('close')"></div>

    <!-- Slide-Up Drawer -->
    <div 
      class="bg-oled-800 border-t border-oled-700 rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col w-full max-w-4xl mx-auto overflow-hidden animate-slide-up"
    >
      <!-- Drawer Drag Handle & Header -->
      <div class="px-6 pt-3 pb-4 border-b border-oled-700/80 shrink-0">
        <div class="w-12 h-1 bg-oled-700 rounded-full mx-auto mb-3"></div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-ai-violet/20 border border-ai-violet/40 flex items-center justify-center text-ai-violetLight">
              <Sparkles class="w-4 h-4" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-waText-primary">
                  Authentic Texting AI Assistant
                </h3>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-ai-violet/20 text-ai-violetLight border border-ai-violet/30">
                  {{ model }}
                </span>
                <span v-if="!apiKey" class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Demo Mode (Offline)
                </span>
              </div>
              <p class="text-[11px] text-waText-secondary">
                Writes replies matching your authentic WhatsApp cadence, emojis, and sentence habits.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              v-if="!apiKey"
              type="button"
              @click="emit('open-api-modal')"
              class="text-xs px-2.5 py-1 rounded-lg bg-oled-750 hover:bg-oled-700 text-waText-primary border border-oled-700 transition-colors flex items-center gap-1.5"
            >
              <Key class="w-3.5 h-3.5 text-ai-violet" />
              <span>Set Gemini Key</span>
            </button>
            <button
              type="button"
              @click="emit('close')"
              class="p-1.5 rounded-lg text-waText-secondary hover:text-waText-primary hover:bg-oled-750 transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Drawer Body -->
      <div class="p-6 overflow-y-auto space-y-5 scrollbar-thin scrollbar-thumb-zinc-700">
        <!-- Error Banner -->
        <div v-if="errorMessage" class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <span>{{ errorMessage }}</span>
          <button @click="emit('open-api-modal')" class="underline font-medium ml-2">Check Settings</button>
        </div>

        <!-- Texting Style Fingerprint Card -->
        <div v-if="styleProfile" class="p-4 rounded-2xl bg-oled-850 border border-oled-700/80 space-y-3">
          <div class="flex items-center justify-between text-xs font-semibold text-waText-primary">
            <span class="flex items-center gap-1.5 text-ai-violetLight">
              <BrainCircuit class="w-4 h-4 text-ai-violet" />
              <span>Extracted Texting Fingerprint (from your sent history)</span>
            </span>
            <span class="text-[10px] text-waText-secondary font-mono">
              {{ styleProfile.sampleCount }} messages analyzed
            </span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div class="bg-oled-800 p-2.5 rounded-xl border border-oled-700/50">
              <span class="text-[10px] text-waText-secondary block mb-0.5">Capitalization</span>
              <span class="font-medium text-waText-primary text-[11px]">{{ styleProfile.casingTendency }}</span>
            </div>

            <div class="bg-oled-800 p-2.5 rounded-xl border border-oled-700/50">
              <span class="text-[10px] text-waText-secondary block mb-0.5">Avg Brevity</span>
              <span class="font-medium text-waText-primary text-[11px]">{{ styleProfile.avgWordsPerMsg }} words/msg</span>
            </div>

            <div class="bg-oled-800 p-2.5 rounded-xl border border-oled-700/50">
              <span class="text-[10px] text-waText-secondary block mb-0.5">Omit Period</span>
              <span class="font-medium text-wa-emerald text-[11px]">{{ styleProfile.omitsTerminalPeriodPct }}% informal</span>
            </div>

            <div class="bg-oled-800 p-2.5 rounded-xl border border-oled-700/50">
              <span class="text-[10px] text-waText-secondary block mb-0.5">Top Emojis</span>
              <span class="font-medium text-waText-primary text-sm tracking-wider">
                {{ styleProfile.topEmojis.join(' ') }}
              </span>
            </div>
          </div>
        </div>

        <!-- Last Received Message Prompt Indicator -->
        <div class="p-3 rounded-xl bg-oled-750/70 border border-oled-700 flex items-start gap-3">
          <MessageSquare class="w-4 h-4 text-wa-emerald shrink-0 mt-0.5" />
          <div class="text-xs min-w-0 flex-1">
            <span class="text-[10px] text-waText-secondary block uppercase tracking-wider font-semibold">
              Responding to {{ thread.displayName }}
            </span>
            <p class="text-waText-primary font-medium mt-0.5 truncate">
              "{{ lastReceivedMsg }}"
            </p>
          </div>
        </div>

        <!-- Custom Guidance / Intent Input -->
        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-waText-primary flex items-center gap-1.5">
            <Lightbulb class="w-3.5 h-3.5 text-amber-400" />
            <span>Custom Intent or Instruction (Optional)</span>
          </label>
          <div class="flex gap-2">
            <input
              v-model="customInstruction"
              @keyup.enter="generateReplies"
              type="text"
              placeholder="e.g. Say I'm running 10 mins late, or tell them I agree but want pizza instead..."
              class="flex-1 bg-oled-850 border border-oled-700 rounded-xl px-4 py-2.5 text-xs text-waText-primary placeholder-waText-secondary focus:outline-none focus:border-ai-violet focus:ring-1 focus:ring-ai-violet/40 transition-all"
            />
            <button
              type="button"
              @click="generateReplies"
              :disabled="isGenerating"
              class="px-4 py-2.5 rounded-xl bg-ai-violet hover:bg-ai-violetDark text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-60"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isGenerating }" />
              <span>{{ isGenerating ? 'Generating...' : 'Regenerate' }}</span>
            </button>
          </div>
        </div>

        <!-- 3 Generated Reply Candidates -->
        <div class="space-y-3">
          <h4 class="text-xs font-semibold text-waText-secondary uppercase tracking-wider">
            Choose a Response Candidate
          </h4>

          <!-- Option 1: Casual & Punchy -->
          <div class="bg-oled-850 border border-oled-700 rounded-xl p-4 transition-all hover:border-wa-emerald/50 group relative">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-wa-emerald flex items-center gap-1.5">
                <span>1. Quick &amp; Casual</span>
              </span>
              <button
                type="button"
                @click="copyToClipboard(replies.casual, 'casual')"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors bg-oled-750 hover:bg-oled-700 text-waText-primary border border-oled-700"
              >
                <Check v-if="copiedKey === 'casual'" class="w-3.5 h-3.5 text-wa-emerald" />
                <Copy v-else class="w-3.5 h-3.5 text-waText-secondary" />
                <span>{{ copiedKey === 'casual' ? 'Copied!' : 'Copy' }}</span>
              </button>
            </div>
            <p class="text-sm text-waText-primary font-sans leading-relaxed selection:bg-wa-emerald/30">
              {{ replies.casual || (isGenerating ? 'Thinking in your voice...' : 'Generating...') }}
            </p>
          </div>

          <!-- Option 2: Detailed / Thoughtful -->
          <div class="bg-oled-850 border border-oled-700 rounded-xl p-4 transition-all hover:border-ai-violet/50 group relative">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-ai-violetLight flex items-center gap-1.5">
                <span>2. Thoughtful &amp; Detailed</span>
              </span>
              <button
                type="button"
                @click="copyToClipboard(replies.detailed, 'detailed')"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors bg-oled-750 hover:bg-oled-700 text-waText-primary border border-oled-700"
              >
                <Check v-if="copiedKey === 'detailed'" class="w-3.5 h-3.5 text-wa-emerald" />
                <Copy v-else class="w-3.5 h-3.5 text-waText-secondary" />
                <span>{{ copiedKey === 'detailed' ? 'Copied!' : 'Copy' }}</span>
              </button>
            </div>
            <p class="text-sm text-waText-primary font-sans leading-relaxed selection:bg-ai-violet/30">
              {{ replies.detailed || (isGenerating ? 'Writing thoughtful reply...' : 'Generating...') }}
            </p>
          </div>

          <!-- Option 3: Witty / Lighthearted -->
          <div class="bg-oled-850 border border-oled-700 rounded-xl p-4 transition-all hover:border-amber-400/50 group relative">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <span>3. Witty &amp; Lighthearted</span>
              </span>
              <button
                type="button"
                @click="copyToClipboard(replies.witty, 'witty')"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors bg-oled-750 hover:bg-oled-700 text-waText-primary border border-oled-700"
              >
                <Check v-if="copiedKey === 'witty'" class="w-3.5 h-3.5 text-wa-emerald" />
                <Copy v-else class="w-3.5 h-3.5 text-waText-secondary" />
                <span>{{ copiedKey === 'witty' ? 'Copied!' : 'Copy' }}</span>
              </button>
            </div>
            <p class="text-sm text-waText-primary font-sans leading-relaxed selection:bg-amber-400/30">
              {{ replies.witty || (isGenerating ? 'Adding some wit...' : 'Generating...') }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
