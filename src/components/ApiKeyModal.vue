<script setup>
import { ref, watch, onMounted } from 'vue';
import { 
  Key, X, Eye, EyeOff, Check, ExternalLink, 
  Sparkles, ShieldCheck, AlertCircle, Loader2, RefreshCw, 
  Cpu, CheckCircle2, Edit3, HelpCircle
} from 'lucide-vue-next';
import { 
  DEFAULT_GEMINI_MODELS, 
  sanitizeModelId, 
  fetchAvailableGeminiModels 
} from '../utils/gemini.js';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  initialKey: {
    type: String,
    default: ''
  },
  initialModel: {
    type: String,
    default: 'gemini-3.8-flash'
  }
});

const emit = defineEmits(['close', 'save']);

const apiKey = ref('');
const selectedModel = ref('gemini-3.8-flash');
const showKey = ref(false);
const isTesting = ref(false);
const isFetchingModels = ref(false);
const isLiveFromApi = ref(false);
const testResult = ref(null); // { success: boolean, message: string }
const fetchModelsError = ref('');
const isCustomMode = ref(false);
const customModelInput = ref('');

const availableModels = ref([...DEFAULT_GEMINI_MODELS]);

watch(() => props.isOpen, (val) => {
  if (val) handleOpen();
});

function handleOpen() {
  apiKey.value = props.initialKey || localStorage.getItem('gemini_api_key') || '';
  const storedModel = props.initialModel || localStorage.getItem('gemini_model') || 'gemini-3.8-flash';
  selectedModel.value = sanitizeModelId(storedModel);
  testResult.value = null;
  fetchModelsError.value = '';

  // If the user already has an API key, dynamically refresh available models in background
  if (apiKey.value.trim()) {
    refreshModelsFromApi(false);
  }
}

/**
 * Dynamically queries Google's Gemini API to discover active models.
 */
async function refreshModelsFromApi(showToast = true) {
  if (!apiKey.value.trim()) {
    fetchModelsError.value = 'Enter an API key first to query live models.';
    return;
  }

  isFetchingModels.value = true;
  fetchModelsError.value = '';

  try {
    const liveModels = await fetchAvailableGeminiModels(apiKey.value.trim());
    if (liveModels && liveModels.length > 0) {
      availableModels.value = liveModels;
      isLiveFromApi.value = true;

      // If currently selected model is not in the live list, select the recommended one
      const exists = liveModels.some(m => m.id === selectedModel.value);
      if (!exists) {
        const rec = liveModels.find(m => m.isRecommended) || liveModels[0];
        if (rec) selectedModel.value = rec.id;
      }

      if (showToast) {
        testResult.value = { 
          success: true, 
          message: `Discovered ${liveModels.length} active models directly from Google Gemini API!` 
        };
      }
    }
  } catch (err) {
    console.warn('Failed to fetch live Gemini models:', err);
    fetchModelsError.value = `Live model query failed: ${err.message}. Using built-in Gemini 3 catalog.`;
  } finally {
    isFetchingModels.value = false;
  }
}

async function testConnection() {
  if (!apiKey.value.trim()) {
    testResult.value = { success: false, message: 'Please enter an API key first.' };
    return;
  }

  const modelToTest = isCustomMode.value ? (customModelInput.value.trim() || 'gemini-3.8-flash') : selectedModel.value;

  isTesting.value = true;
  testResult.value = null;

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTest}:generateContent?key=${encodeURIComponent(apiKey.value.trim())}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with "OK" in 1 word.' }] }]
      })
    });

    if (res.ok) {
      testResult.value = { success: true, message: `Connected to ${modelToTest} successfully!` };
      // Refresh models dynamically upon successful verification
      await refreshModelsFromApi(false);
    } else {
      const err = await res.json().catch(() => ({}));
      testResult.value = { 
        success: false, 
        message: err.error?.message || `HTTP ${res.status}: Invalid key or model unavailable.` 
      };
    }
  } catch (err) {
    testResult.value = { success: false, message: 'Connection test failed: ' + err.message };
  } finally {
    isTesting.value = false;
  }
}

function handleSave() {
  const trimmed = apiKey.value.trim();
  const finalModel = isCustomMode.value 
    ? (customModelInput.value.trim() || 'gemini-3.8-flash')
    : sanitizeModelId(selectedModel.value);

  localStorage.setItem('gemini_api_key', trimmed);
  localStorage.setItem('gemini_model', finalModel);
  emit('save', { apiKey: trimmed, model: finalModel });
  emit('close');
}

function clearKey() {
  apiKey.value = '';
  localStorage.removeItem('gemini_api_key');
  isLiveFromApi.value = false;
  availableModels.value = [...DEFAULT_GEMINI_MODELS];
  selectedModel.value = 'gemini-3.8-flash';
  emit('save', { apiKey: '', model: 'gemini-3.8-flash' });
  testResult.value = null;
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
    <div class="bg-oled-800 border border-oled-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slide-up">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-oled-700 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-ai-violet/20 text-ai-violetLight flex items-center justify-center">
            <Sparkles class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-waText-primary">
              AI Configuration (Gemini)
            </h3>
            <p class="text-xs text-waText-secondary">
              Power authentic style reply generation
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

      <!-- Body -->
      <div class="p-6 space-y-4">
        <!-- Dynamic Model Selection -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-waText-primary flex items-center gap-1.5">
              <Cpu class="w-3.5 h-3.5 text-ai-violet" />
              <span>Gemini Model</span>
              <span v-if="isLiveFromApi" class="text-[10px] px-1.5 py-0.2 rounded bg-wa-emerald/15 text-wa-emerald border border-wa-emerald/30 font-medium">
                Live from API
              </span>
            </label>

            <div class="flex items-center gap-2">
              <button 
                type="button" 
                @click="isCustomMode = !isCustomMode"
                class="text-[11px] text-waText-secondary hover:text-waText-primary flex items-center gap-1"
                :title="isCustomMode ? 'Choose from list' : 'Type custom model ID'"
              >
                <Edit3 class="w-3 h-3" />
                <span>{{ isCustomMode ? 'List Models' : 'Custom ID' }}</span>
              </button>

              <button
                type="button"
                @click="refreshModelsFromApi(true)"
                :disabled="isFetchingModels || !apiKey.trim()"
                class="text-[11px] text-ai-violetLight hover:underline flex items-center gap-1 disabled:opacity-40"
                title="Fetch all available models directly from your Gemini API account"
              >
                <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': isFetchingModels }" />
                <span>{{ isFetchingModels ? 'Checking...' : 'Check Live Models' }}</span>
              </button>
            </div>
          </div>

          <!-- Dropdown Select Mode -->
          <div v-if="!isCustomMode" class="relative">
            <select
              v-model="selectedModel"
              class="w-full bg-oled-850 border border-oled-700 rounded-xl px-3 py-2.5 text-xs text-waText-primary focus:outline-none focus:border-ai-violet focus:ring-1 focus:ring-ai-violet/30 cursor-pointer"
            >
              <option 
                v-for="m in availableModels" 
                :key="m.id" 
                :value="m.id"
              >
                {{ m.badge ? `[${m.badge}] ` : '' }}{{ m.name }} ({{ m.id }})
              </option>
            </select>
          </div>

          <!-- Custom Model ID Input Mode -->
          <div v-else class="space-y-1">
            <input
              v-model="customModelInput"
              type="text"
              placeholder="e.g. gemini-3.8-flash or gemini-flash-latest"
              class="w-full bg-oled-850 border border-oled-700 rounded-xl px-3 py-2 text-xs font-mono text-waText-primary placeholder-waText-secondary focus:outline-none focus:border-ai-violet focus:ring-1 focus:ring-ai-violet/30"
            />
            <p class="text-[10px] text-waText-secondary">
              Enter any valid endpoint name (e.g. <code class="text-waText-primary">gemini-3.6-flash</code>, <code class="text-waText-primary">gemini-flash-latest</code>).
            </p>
          </div>

          <!-- Selected Model Info Box -->
          <div 
            v-if="!isCustomMode && availableModels.find(m => m.id === selectedModel)" 
            class="p-2.5 rounded-xl bg-oled-850/80 border border-oled-700/60 text-[11px] space-y-1"
          >
            <div class="flex items-center justify-between text-waText-primary font-medium">
              <span class="flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-wa-emerald"></span>
                <span>{{ availableModels.find(m => m.id === selectedModel)?.name }}</span>
              </span>
              <span class="text-[10px] font-mono text-waText-secondary">
                {{ selectedModel }}
              </span>
            </div>
            <p class="text-waText-secondary leading-relaxed text-[10.5px]">
              {{ availableModels.find(m => m.id === selectedModel)?.desc }}
            </p>
          </div>

          <!-- Model fetch error or notice -->
          <div v-if="fetchModelsError" class="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-1.5">
            <AlertCircle class="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{{ fetchModelsError }}</span>
          </div>
        </div>

        <!-- API Key Input -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-waText-primary flex items-center gap-1.5">
              <Key class="w-3.5 h-3.5 text-ai-violet" />
              <span>Google Gemini API Key</span>
            </label>
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              class="text-[11px] text-ai-violetLight hover:underline flex items-center gap-1"
            >
              <span>Get Free Key</span>
              <ExternalLink class="w-3 h-3" />
            </a>
          </div>

          <div class="relative">
            <input
              v-model="apiKey"
              :type="showKey ? 'text' : 'password'"
              placeholder="AIzaSy..."
              class="w-full bg-oled-850 border border-oled-700 rounded-xl pl-3 pr-10 py-2.5 text-xs font-mono text-waText-primary placeholder-waText-secondary focus:outline-none focus:border-ai-violet focus:ring-1 focus:ring-ai-violet/30"
            />
            <button
              type="button"
              @click="showKey = !showKey"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-waText-secondary hover:text-waText-primary"
            >
              <EyeOff v-if="showKey" class="w-4 h-4" />
              <Eye v-else class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Connection Test Feedback -->
        <div v-if="testResult" class="p-3 rounded-xl text-xs flex items-start gap-2" :class="testResult.success ? 'bg-wa-emerald/10 border border-wa-emerald/30 text-wa-emerald' : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'">
          <Check v-if="testResult.success" class="w-4 h-4 shrink-0 mt-0.5" />
          <AlertCircle v-else class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{{ testResult.message }}</span>
        </div>

        <!-- Privacy Assurance -->
        <div class="p-3 rounded-xl bg-oled-850/60 border border-oled-700/60 flex items-start gap-2 text-[11px] text-waText-secondary">
          <ShieldCheck class="w-4 h-4 text-wa-emerald shrink-0 mt-0.5" />
          <span>Your API key is saved solely in your browser's <code class="text-waText-primary">localStorage</code>. It is never logged or sent to any server other than Google's official Gemini endpoint.</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 bg-oled-850 border-t border-oled-700 flex items-center justify-between">
        <button
          v-if="apiKey"
          type="button"
          @click="clearKey"
          class="text-xs text-rose-400 hover:underline"
        >
          Remove Key
        </button>
        <span v-else></span>

        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="testConnection"
            :disabled="isTesting || !apiKey"
            class="px-3 py-2 rounded-xl text-xs font-medium bg-oled-750 hover:bg-oled-700 text-waText-primary border border-oled-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Loader2 v-if="isTesting" class="w-3.5 h-3.5 animate-spin" />
            <span>{{ isTesting ? 'Testing...' : 'Test Connection' }}</span>
          </button>

          <button
            type="button"
            @click="handleSave"
            class="px-4 py-2 rounded-xl text-xs font-semibold bg-ai-violet hover:bg-ai-violetDark text-white shadow-lg shadow-ai-violet/20 transition-all active:scale-95"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
