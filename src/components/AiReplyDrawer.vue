<script setup>
import { ref, computed, watch } from 'vue';
import { 
  Sparkles, X, Copy, Check, RefreshCw, Sliders, 
  Send, Bot, BrainCircuit, Key, ArrowRight, Lightbulb, 
  MessageSquare, FileText, CheckCircle2, Calendar, Target
} from 'lucide-vue-next';
import { 
  analyzeTextingStyle, generateGeminiReplies, 
  generateOfflineDemoReplies, generateChatSummary 
} from '../utils/gemini.js';

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

const activeTab = ref('replies'); // 'replies' | 'summary'
const selectedTone = ref('casual'); // 'casual' | 'balanced' | 'professional' | 'witty'
const customInstruction = ref('');
const isGenerating = ref(false);
const isSummarizing = ref(false);
const errorMessage = ref('');
const copiedKey = ref(null);
const styleProfile = ref(null);

const replies = ref({
  casual: '',
  detailed: '',
  witty: ''
});

const summaryData = ref(null);

const QUICK_INTENTS = [
  'Confirm plans',
  'Running 10 mins late',
  'Polite decline',
  'Ask for details',
  'Excited agreement',
  'Suggest coffee/lunch'
];

const lastReceivedMsg = computed(() => {
  const reversed = [...props.recentMessages].reverse();
  const received = reversed.find(m => !m.fromMe && m.text);
  return received ? received.text : 'Hey, what are your thoughts?';
});

function computeStyle() {
  const history = props.sentHistory.length > 0 
    ? props.sentHistory 
    : props.recentMessages.filter(m => m.fromMe && m.text).map(m => m.text);

  styleProfile.value = analyzeTextingStyle(history);
}

function applyQuickIntent(intent) {
  customInstruction.value = intent;
  generateReplies();
}

async function generateReplies() {
  errorMessage.value = '';
  isGenerating.value = true;

  try {
    if (!styleProfile.value) computeStyle();

    if (props.apiKey && props.apiKey.trim()) {
      const results = await generateGeminiReplies({
        apiKey: props.apiKey,
        model: props.model,
        chatName: props.thread?.displayName || 'Contact',
        recentMessages: props.recentMessages,
        styleProfile: styleProfile.value,
        customInstruction: customInstruction.value,
        tone: selectedTone.value
      });
      replies.value = results;
    } else {
      await new Promise(r => setTimeout(r, 500));
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

async function handleGenerateSummary() {
  errorMessage.value = '';
  isSummarizing.value = true;

  try {
    const summary = await generateChatSummary({
      apiKey: props.apiKey,
      model: props.model,
      chatName: props.thread?.displayName || 'Contact',
      messages: props.recentMessages
    });
    summaryData.value = summary;
  } catch (err) {
    console.error('Summary error:', err);
    errorMessage.value = err.message || 'Failed to generate summary.';
  } finally {
    isSummarizing.value = false;
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
    if (!summaryData.value) {
      handleGenerateSummary();
    }
  }
});
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-hidden flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity">
    <div class="flex-1" @click="emit('close')"></div>

    <div class="bg-oled-800 border-t border-oled-700 rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col w-full max-w-4xl mx-auto overflow-hidden animate-slide-up">
      <!-- Drawer Header -->
      <div class="px-6 pt-3 pb-3 border-b border-oled-700/80 shrink-0 bg-oled-850">
        <div class="w-12 h-1 bg-oled-700 rounded-full mx-auto mb-3"></div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-ai-violet/20 border border-ai-violet/40 flex items-center justify-center text-ai-violetLight">
              <Sparkles class="w-4 h-4" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-waText-primary">
                  AI Texting &amp; Summary Suite
                </h3>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-ai-violet/20 text-ai-violetLight border border-ai-violet/30 font-semibold">
                  {{ model }}
                </span>
                <span v-if="!apiKey" class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                  Offline Demo
                </span>
              </div>
              <p class="text-[11px] text-waText-secondary">
                Mimics your authentic voice &bull; Summarizes long chat threads
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

        <!-- Tab Switcher -->
        <div class="flex gap-4 mt-3 border-t border-oled-700/60 pt-2.5 text-xs font-semibold">
          <button
            type="button"
            @click="activeTab = 'replies'"
            class="pb-1 transition-colors flex items-center gap-1.5"
            :class="activeTab === 'replies' ? 'border-b-2 border-ai-violet text-ai-violetLight' : 'text-waText-secondary hover:text-white'"
          >
            <MessageSquare class="w-3.5 h-3.5" />
            <span>Authentic Replies</span>
          </button>

          <button
            type="button"
            @click="activeTab = 'summary'"
            class="pb-1 transition-colors flex items-center gap-1.5"
            :class="activeTab === 'summary' ? 'border-b-2 border-ai-violet text-ai-violetLight' : 'text-waText-secondary hover:text-white'"
          >
            <FileText class="w-3.5 h-3.5" />
            <span>Chat Catch-Up &amp; TL;DR</span>
          </button>
        </div>
      </div>

      <!-- Tab 1: Authentic Replies -->
      <div v-if="activeTab === 'replies'" class="p-6 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-zinc-700">
        <!-- Error Banner -->
        <div v-if="errorMessage" class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <span>{{ errorMessage }}</span>
          <button @click="emit('open-api-modal')" class="underline font-medium ml-2">Settings</button>
        </div>

        <!-- Style Fingerprint Card -->
        <div v-if="styleProfile" class="p-4 rounded-2xl bg-oled-850 border border-oled-700/80 space-y-3">
          <div class="flex items-center justify-between text-xs font-semibold text-waText-primary">
            <span class="flex items-center gap-1.5 text-ai-violetLight">
              <BrainCircuit class="w-4 h-4 text-ai-violet" />
              <span>Extracted Texting Fingerprint (from your sent history)</span>
            </span>
            <span class="text-[10px] text-waText-secondary font-mono">
              {{ styleProfile.sampleCount }} sent messages analyzed
            </span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
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

        <!-- Tone Selector & Quick Intent Chips -->
        <div class="space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-xs font-semibold text-waText-primary flex items-center gap-1.5">
              <Sliders class="w-3.5 h-3.5 text-wa-emerald" />
              <span>Tone Dial:</span>
            </span>

            <div class="flex bg-oled-850 p-0.5 rounded-lg border border-oled-700 text-[11px]">
              <button
                v-for="t in [
                  { id: 'casual', label: 'Casual' },
                  { id: 'balanced', label: 'Natural' },
                  { id: 'professional', label: 'Polite' },
                  { id: 'witty', label: 'Witty' }
                ]"
                :key="t.id"
                type="button"
                @click="selectedTone = t.id; generateReplies()"
                class="px-2.5 py-1 rounded transition-colors"
                :class="selectedTone === t.id ? 'bg-ai-violet text-white font-medium' : 'text-waText-secondary hover:text-white'"
              >
                {{ t.label }}
              </button>
            </div>
          </div>

          <!-- Quick Intent Chips -->
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="intent in QUICK_INTENTS"
              :key="intent"
              type="button"
              @click="applyQuickIntent(intent)"
              class="px-2.5 py-1 rounded-full text-[11px] bg-oled-850 hover:bg-oled-750 text-waText-secondary hover:text-waText-primary border border-oled-700 transition-colors"
            >
              + {{ intent }}
            </button>
          </div>
        </div>

        <!-- Custom Guidance Input -->
        <div class="flex gap-2">
          <input
            v-model="customInstruction"
            @keyup.enter="generateReplies"
            type="text"
            placeholder="Type custom instructions (e.g. say I can make it at 8, or suggest coffee)..."
            class="flex-1 bg-oled-850 border border-oled-700 rounded-xl px-4 py-2 text-xs text-waText-primary placeholder-waText-secondary focus:outline-none focus:border-ai-violet"
          />
          <button
            type="button"
            @click="generateReplies"
            :disabled="isGenerating"
            class="px-4 py-2 rounded-xl bg-ai-violet hover:bg-ai-violetDark text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isGenerating }" />
            <span>{{ isGenerating ? 'Writing...' : 'Regenerate' }}</span>
          </button>
        </div>

        <!-- 3 Generated Replies -->
        <div class="space-y-2.5">
          <!-- Option 1: Casual -->
          <div class="bg-oled-850 border border-oled-700 rounded-xl p-3.5 transition-all hover:border-wa-emerald/50">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs font-bold text-wa-emerald">1. Quick &amp; Casual</span>
              <button
                type="button"
                @click="copyToClipboard(replies.casual, 'casual')"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-oled-750 hover:bg-oled-700 text-waText-primary border border-oled-700"
              >
                <Check v-if="copiedKey === 'casual'" class="w-3.5 h-3.5 text-wa-emerald" />
                <Copy v-else class="w-3.5 h-3.5 text-waText-secondary" />
                <span>{{ copiedKey === 'casual' ? 'Copied!' : 'Copy' }}</span>
              </button>
            </div>
            <p class="text-sm text-waText-primary font-sans leading-relaxed">{{ replies.casual }}</p>
          </div>

          <!-- Option 2: Detailed -->
          <div class="bg-oled-850 border border-oled-700 rounded-xl p-3.5 transition-all hover:border-ai-violet/50">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs font-bold text-ai-violetLight">2. Thoughtful &amp; Detailed</span>
              <button
                type="button"
                @click="copyToClipboard(replies.detailed, 'detailed')"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-oled-750 hover:bg-oled-700 text-waText-primary border border-oled-700"
              >
                <Check v-if="copiedKey === 'detailed'" class="w-3.5 h-3.5 text-wa-emerald" />
                <Copy v-else class="w-3.5 h-3.5 text-waText-secondary" />
                <span>{{ copiedKey === 'detailed' ? 'Copied!' : 'Copy' }}</span>
              </button>
            </div>
            <p class="text-sm text-waText-primary font-sans leading-relaxed">{{ replies.detailed }}</p>
          </div>

          <!-- Option 3: Witty -->
          <div class="bg-oled-850 border border-oled-700 rounded-xl p-3.5 transition-all hover:border-amber-400/50">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs font-bold text-amber-400">3. Witty &amp; Lighthearted</span>
              <button
                type="button"
                @click="copyToClipboard(replies.witty, 'witty')"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-oled-750 hover:bg-oled-700 text-waText-primary border border-oled-700"
              >
                <Check v-if="copiedKey === 'witty'" class="w-3.5 h-3.5 text-wa-emerald" />
                <Copy v-else class="w-3.5 h-3.5 text-waText-secondary" />
                <span>{{ copiedKey === 'witty' ? 'Copied!' : 'Copy' }}</span>
              </button>
            </div>
            <p class="text-sm text-waText-primary font-sans leading-relaxed">{{ replies.witty }}</p>
          </div>
        </div>
      </div>

      <!-- Tab 2: Chat Catch-Up & TL;DR -->
      <div v-else class="p-6 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-zinc-700">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-sm font-bold text-waText-primary">Executive Thread Catch-Up</h4>
            <p class="text-xs text-waText-secondary">Summarizes key decisions and commitments</p>
          </div>
          <button
            type="button"
            @click="handleGenerateSummary"
            :disabled="isSummarizing"
            class="px-3.5 py-1.5 rounded-xl bg-ai-violet hover:bg-ai-violetDark text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isSummarizing }" />
            <span>{{ isSummarizing ? 'Analyzing...' : 'Re-summarize' }}</span>
          </button>
        </div>

        <div v-if="summaryData" class="space-y-4">
          <!-- 3-Point TL;DR -->
          <div class="bg-oled-850 border border-oled-700 rounded-2xl p-4 space-y-2">
            <span class="text-xs font-bold text-wa-emerald uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 class="w-4 h-4" />
              <span>3-Bullet TL;DR</span>
            </span>
            <ul class="space-y-2 text-xs text-waText-primary">
              <li v-for="(pt, idx) in summaryData.summary" :key="idx" class="flex items-start gap-2">
                <span class="text-wa-emerald font-bold shrink-0">&bull;</span>
                <span>{{ pt }}</span>
              </li>
            </ul>
          </div>

          <!-- Key Decisions -->
          <div v-if="summaryData.decisions?.length" class="bg-oled-850 border border-oled-700 rounded-2xl p-4 space-y-2">
            <span class="text-xs font-bold text-ai-violetLight uppercase tracking-wider flex items-center gap-1.5">
              <Target class="w-4 h-4 text-ai-violet" />
              <span>Decisions Reached</span>
            </span>
            <ul class="space-y-1.5 text-xs text-waText-primary">
              <li v-for="(dec, idx) in summaryData.decisions" :key="idx" class="flex items-start gap-2">
                <span class="text-ai-violet font-bold shrink-0">&bull;</span>
                <span>{{ dec }}</span>
              </li>
            </ul>
          </div>

          <!-- Action Items -->
          <div v-if="summaryData.actionItems?.length" class="bg-oled-850 border border-oled-700 rounded-2xl p-4 space-y-2">
            <span class="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar class="w-4 h-4" />
              <span>Dates &amp; Commitments</span>
            </span>
            <ul class="space-y-1.5 text-xs text-waText-primary">
              <li v-for="(act, idx) in summaryData.actionItems" :key="idx" class="flex items-start gap-2">
                <span class="text-amber-400 font-bold shrink-0">&bull;</span>
                <span>{{ act }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
