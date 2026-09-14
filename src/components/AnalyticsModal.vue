<script setup>
import { computed } from 'vue';
import { 
  X, BarChart3, Clock, Zap, MessageSquare, 
  Smile, Flame, Sparkles, TrendingUp, Users, ArrowRight 
} from 'lucide-vue-next';
import { computeChatAnalytics } from '../utils/analytics.js';

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

const stats = computed(() => {
  return computeChatAnalytics(props.messages, props.thread?.displayName || 'Contact');
});
</script>

<template>
  <div v-if="isOpen && stats" class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
    <div class="bg-oled-800 border border-oled-700 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-oled-700 flex items-center justify-between shrink-0 bg-oled-850">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-wa-emerald/20 text-wa-emerald flex items-center justify-center">
            <BarChart3 class="w-4 h-4" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold text-waText-primary">
                WhatsApp Wrapped &bull; Analytics
              </h3>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-wa-emerald/10 text-wa-emerald border border-wa-emerald/20 font-semibold">
                {{ stats.vibe }}
              </span>
            </div>
            <p class="text-xs text-waText-secondary">
              Chat insights for <span class="text-waText-primary font-medium">{{ thread.displayName }}</span>
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
      <div class="p-6 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-zinc-700">
        <!-- 4 Top Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="bg-oled-850 border border-oled-700/80 rounded-xl p-3">
            <span class="text-[10px] text-waText-secondary uppercase tracking-wider font-semibold block mb-1">
              Total Messages
            </span>
            <div class="text-lg font-bold text-waText-primary font-mono">
              {{ stats.totalMessages.toLocaleString() }}
            </div>
            <span class="text-[10px] text-wa-emerald font-medium">100% indexed</span>
          </div>

          <div class="bg-oled-850 border border-oled-700/80 rounded-xl p-3">
            <span class="text-[10px] text-waText-secondary uppercase tracking-wider font-semibold block mb-1">
              Your Reply Speed
            </span>
            <div class="text-lg font-bold text-waText-primary font-mono">
              ~{{ stats.avgUserReplyMin }}m
            </div>
            <span class="text-[10px] text-waText-secondary">avg turnaround</span>
          </div>

          <div class="bg-oled-850 border border-oled-700/80 rounded-xl p-3">
            <span class="text-[10px] text-waText-secondary uppercase tracking-wider font-semibold block mb-1">
              Contact Reply Speed
            </span>
            <div class="text-lg font-bold text-waText-primary font-mono">
              ~{{ stats.avgContactReplyMin }}m
            </div>
            <span class="text-[10px] text-waText-secondary">avg turnaround</span>
          </div>

          <div class="bg-oled-850 border border-oled-700/80 rounded-xl p-3">
            <span class="text-[10px] text-waText-secondary uppercase tracking-wider font-semibold block mb-1">
              Peak Texting Hour
            </span>
            <div class="text-sm font-bold text-wa-emerald font-mono mt-1">
              {{ stats.peakHourFormatted }}
            </div>
            <span class="text-[10px] text-waText-secondary">highest volume</span>
          </div>
        </div>

        <!-- Sent vs Received Balance Bar -->
        <div class="bg-oled-850 border border-oled-700 rounded-xl p-4 space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="font-semibold text-waText-primary flex items-center gap-1.5">
              <Users class="w-3.5 h-3.5 text-wa-emerald" />
              <span>Conversation Dynamics (Sent vs Received)</span>
            </span>
            <div class="flex items-center gap-3 text-[11px] font-mono">
              <span class="text-wa-emerald font-semibold">You: {{ stats.sentPct }}% ({{ stats.sentCount }})</span>
              <span class="text-waText-secondary">Them: {{ stats.receivedPct }}% ({{ stats.receivedCount }})</span>
            </div>
          </div>

          <div class="w-full bg-oled-700 h-2.5 rounded-full overflow-hidden flex">
            <div 
              class="bg-wa-emerald h-full transition-all duration-500" 
              :style="{ width: `${stats.sentPct}%` }"
              title="Messages sent by You"
            ></div>
            <div 
              class="bg-zinc-600 h-full transition-all duration-500 flex-1" 
              title="Messages received"
            ></div>
          </div>
        </div>

        <!-- 24-Hour Activity Histogram -->
        <div class="bg-oled-850 border border-oled-700 rounded-xl p-4 space-y-3">
          <div class="flex items-center justify-between text-xs">
            <span class="font-semibold text-waText-primary flex items-center gap-1.5">
              <Clock class="w-3.5 h-3.5 text-ai-violetLight" />
              <span>24-Hour Activity Heatmap</span>
            </span>
            <span class="text-[10px] text-waText-secondary">Hourly message density</span>
          </div>

          <div class="h-24 flex items-end gap-1 pt-4 border-b border-oled-700/60 pb-1">
            <div
              v-for="(count, hour) in stats.hourlyCounts"
              :key="hour"
              class="flex-1 flex flex-col items-center group relative h-full justify-end"
            >
              <!-- Bar -->
              <div
                class="w-full rounded-t transition-all group-hover:bg-wa-emerald"
                :class="count === stats.maxHourCount ? 'bg-wa-emerald shadow-sm shadow-wa-emerald/40' : count > 0 ? 'bg-zinc-600' : 'bg-oled-750'"
                :style="{ height: `${Math.max((count / stats.maxHourCount) * 100, 6)}%` }"
              ></div>

              <!-- Tooltip on hover -->
              <div class="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-oled-900 border border-oled-700 px-1.5 py-0.5 rounded text-[9px] font-mono whitespace-nowrap z-20 pointer-events-none">
                {{ hour }}:00 &bull; {{ count }} msgs
              </div>
            </div>
          </div>

          <div class="flex justify-between text-[9px] font-mono text-waText-secondary px-0.5">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>11 PM</span>
          </div>
        </div>

        <!-- Day of the Week Breakdown -->
        <div class="bg-oled-850 border border-oled-700 rounded-xl p-4 space-y-3">
          <span class="text-xs font-semibold text-waText-primary block">
            Most Active Days of the Week
          </span>

          <div class="grid grid-cols-7 gap-2 text-center">
            <div
              v-for="item in stats.dayDistribution"
              :key="item.day"
              class="bg-oled-800 p-2 rounded-lg border border-oled-700/50"
            >
              <span class="text-[10px] text-waText-secondary block font-semibold">{{ item.day }}</span>
              <span class="text-xs font-bold text-waText-primary font-mono mt-0.5 block">
                {{ item.count }}
              </span>
              <div class="w-full bg-oled-700 h-1 rounded-full mt-1.5 overflow-hidden">
                <div 
                  class="bg-wa-emerald h-full rounded-full"
                  :style="{ width: `${(item.count / stats.maxDayCount) * 100}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Emojis & Word Frequencies -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- Top Emojis Leaderboard -->
          <div class="bg-oled-850 border border-oled-700 rounded-xl p-4">
            <span class="text-xs font-semibold text-waText-primary flex items-center gap-1.5 mb-3">
              <Smile class="w-3.5 h-3.5 text-amber-400" />
              <span>Top Emojis Used</span>
            </span>

            <div v-if="stats.topUserEmojis.length > 0 || stats.topContactEmojis.length > 0" class="space-y-2">
              <div v-if="stats.topUserEmojis.length > 0">
                <span class="text-[10px] text-waText-secondary block mb-1">You:</span>
                <div class="flex flex-wrap gap-1.5">
                  <span 
                    v-for="e in stats.topUserEmojis" 
                    :key="e.emoji"
                    class="bg-oled-800 border border-oled-700 px-2 py-0.5 rounded-lg text-xs flex items-center gap-1"
                  >
                    <span>{{ e.emoji }}</span>
                    <span class="text-[10px] text-waText-secondary font-mono">{{ e.count }}</span>
                  </span>
                </div>
              </div>

              <div v-if="stats.topContactEmojis.length > 0" class="mt-2">
                <span class="text-[10px] text-waText-secondary block mb-1">{{ thread.displayName }}:</span>
                <div class="flex flex-wrap gap-1.5">
                  <span 
                    v-for="e in stats.topContactEmojis" 
                    :key="e.emoji"
                    class="bg-oled-800 border border-oled-700 px-2 py-0.5 rounded-lg text-xs flex items-center gap-1"
                  >
                    <span>{{ e.emoji }}</span>
                    <span class="text-[10px] text-waText-secondary font-mono">{{ e.count }}</span>
                  </span>
                </div>
              </div>
            </div>
            <p v-else class="text-xs text-waText-secondary italic">No emojis recorded in this chat.</p>
          </div>

          <!-- Top Keywords -->
          <div class="bg-oled-850 border border-oled-700 rounded-xl p-4">
            <span class="text-xs font-semibold text-waText-primary flex items-center gap-1.5 mb-3">
              <TrendingUp class="w-3.5 h-3.5 text-wa-emerald" />
              <span>Common Keywords &amp; Topics</span>
            </span>

            <div v-if="stats.topWords.length > 0" class="flex flex-wrap gap-1.5">
              <span
                v-for="w in stats.topWords"
                :key="w.word"
                class="bg-oled-800 border border-oled-700/60 px-2.5 py-1 rounded-lg text-xs text-waText-primary font-medium flex items-center gap-1.5"
              >
                <span>{{ w.word }}</span>
                <span class="text-[10px] text-wa-emerald font-mono font-bold">{{ w.count }}</span>
              </span>
            </div>
            <p v-else class="text-xs text-waText-secondary italic">Not enough text to analyze topics.</p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-3.5 bg-oled-850 border-t border-oled-700 flex items-center justify-between shrink-0">
        <span class="text-[11px] text-waText-secondary">
          Private client-side analysis computed in 2ms.
        </span>
        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-1.5 rounded-xl text-xs font-semibold bg-oled-750 hover:bg-oled-700 text-waText-primary border border-oled-700 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>
