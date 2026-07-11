// src/research/engines/probability.ts
function distanceToTargetPercent(quote2, target) {
  return Number(((target - quote2.price) / quote2.price * 100).toFixed(1));
}
function enforceProbabilityBounds(value) {
  if (Number.isNaN(value)) return 5;
  return Math.min(95, Math.max(5, Math.round(value)));
}
function enforceTargetMonotonicity(predictions) {
  const ordered = [...predictions].sort((a, b) => a.target - b.target);
  let previous = 100;
  return ordered.map((prediction) => {
    const probability = Math.min(previous, enforceProbabilityBounds(prediction.probability));
    previous = probability;
    return { ...prediction, probability };
  });
}
function classifyConfidence(probability) {
  if (probability >= 70 || probability <= 20) return "\u9AD8";
  if (probability >= 50 || probability <= 30) return "\u4E2D";
  return "\u4F4E";
}
function classifySignal(probability) {
  if (probability >= 65) return "\u504F\u591A";
  if (probability >= 55) return "\u4E2D\u6027\u504F\u591A";
  if (probability >= 40) return "\u4E2D\u6027";
  if (probability >= 25) return "\u4E2D\u6027\u504F\u7A7A";
  return "\u504F\u7A7A";
}
var LIKELY_WINDOWS = {
  17: "2026 \u5E74 8 \u6708\u4E0B\u65EC - 9 \u6708",
  18: "2026 \u5E74 9 \u6708 - 10 \u6708",
  19: "2026 \u5E74 10 \u6708 - 11 \u6708"
};
var NEAR_TERM_BASE_START = {
  17: "2026-08-24",
  18: "2026-09-21",
  19: "2026-10-26"
};
function likelyWindowForTarget(target) {
  return LIKELY_WINDOWS[target];
}
function buildNearTermForecast(input) {
  const context = calculateForecastContext(input);
  const baseStart = parseIsoDate(NEAR_TERM_BASE_START[input.target]);
  const start = addUtcDays(baseStart, context.weekShift * 7);
  const end = addUtcDays(start, 6);
  const support = summarizeDrivers(input.positiveDrivers, "\u6280\u672F\u9762\u548C\u516C\u5F00\u4E8B\u4EF6", 2);
  const pressure = summarizeDrivers(input.negativeDrivers, "\u5730\u4EA7\u6570\u636E\u9A8C\u8BC1\u4E0D\u8DB3", 2);
  const hasPriceMemory = context.evidenceSummary.historyPoints >= 240 || context.evidenceSummary.memoryItems > 0;
  const priceMemoryLine = hasPriceMemory ? "\u8FC7\u53BB\u4E24\u5E74\u76F8\u4F3C\u8D70\u52BF\u91CC\uFF0C\u80FD\u53BB\u78B0\u76EE\u6807\u4EF7\u7684\u6BB5\u843D\uFF0C\u901A\u5E38\u90FD\u5148\u6709\u4E00\u4E2A\u52A8\u4F5C\uFF1A15 \u7F8E\u5143\u9644\u8FD1\u522B\u7834\u3002" : "\u8FD1\u671F\u4EF7\u683C\u7ED9\u6211\u7684\u63D0\u793A\u5F88\u76F4\u767D\uFF1A\u5148\u5B88\u4F4F\uFF0C\u518D\u8BD5\u524D\u9AD8\u3002";
  const humanThesis = {
    17: `\u6211\u5224\u65AD\u8FD9\u4E00\u5468\u7684\u620F\u773C\u662F 15 \u7F8E\u5143\uFF1ABEKE \u5148\u7AD9\u7A33\u8FD9\u91CC\uFF0C\u624D\u6709\u8D44\u683C\u53BB\u6572 17 \u7F8E\u5143\u7684\u95E8\u3002${priceMemoryLine}\u53EA\u8981${support}\u8FD8\u6491\u5F97\u4F4F\uFF0C17 \u4F1A\u88AB\u8BD5\u4E00\u6B21\uFF1B\u5982\u679C${pressure}\u8F6C\u5F31\uFF0C\u8FD9\u95E8\u5148\u4E0D\u5F00\uFF0C\u7A97\u53E3\u540E\u79FB\u3002`,
    18: `\u6211\u4F1A\u770B 18 \u7F8E\u5143\u50CF\u7B2C\u4E8C\u9053\u95E8\uFF1ABEKE \u4E0D\u80FD\u53EA\u9760\u53CD\u5F39\u8E6D\u8FC7\u53BB\uFF0C\u5F97\u5148\u8BA9${support}\u63A5\u4E0A\u3002\u63A5\u4E0A\u4E86\u624D\u53EB\u57FA\u672C\u9762\u786E\u8BA4\uFF1B\u63A5\u4E0D\u4E0A\uFF0C\u5B83\u5927\u6982\u7387\u53EA\u5728\u53CD\u5F39\u4E0A\u6CBF\u6643\u4E00\u4E0B\uFF0C\u7559\u5230\u540E\u9762\u3002`,
    19: `\u6211\u5224\u65AD 19 \u7F8E\u5143\u73B0\u5728\u8FD8\u4E0D\u662F\u4E3B\u83DC\u3002\u5B83\u8981\u7684\u662F\u5E02\u573A\u91CD\u65B0\u7ED9 BEKE \u5B9A\u4EF7\uFF1A\u6210\u4EA4\u3001\u623F\u4EF7\u548C\u4E2D\u6982\u60C5\u7EEA\u81F3\u5C11\u4E24\u6761\u540C\u65F6\u8F6C\u597D\u3002\u5C11\u4E00\u6761\uFF0C19 \u5C31\u5148\u7559\u5230\u540E\u9762\u3002`
  };
  const triggerLens = {
    17: "\u80A1\u4EF7\u5B88\u5728 15 \u7F8E\u5143\u9644\u8FD1\uFF0C\u5730\u4EA7\u6570\u636E\u4E0D\u518D\u6076\u5316\uFF0C\u56DE\u8D2D\u548C\u6BDB\u5229\u7387\u97E7\u6027\u7EE7\u7EED\u88AB\u5E02\u573A\u63A5\u53D7",
    18: "GTV\u3001\u5229\u6DA6\u7387\u6216\u653F\u7B56\u6548\u679C\u51FA\u73B0\u4E00\u4E2A\u53EF\u9A8C\u8BC1\u6539\u5584\uFF0C\u540C\u65F6\u4E2D\u6982\u60C5\u7EEA\u4E0D\u660E\u663E\u62D6\u7D2F",
    19: "\u5730\u4EA7\u6210\u4EA4\u548C\u623F\u4EF7\u8FDE\u7EED\u786E\u8BA4\uFF0C\u5E02\u573A\u613F\u610F\u6309\u73B0\u91D1\u6D41\u548C\u5E73\u53F0\u6548\u7387\u8D44\u4EA7\u7ED9 BEKE \u4F30\u503C"
  };
  return {
    label: formatForecastLabel(start, end),
    windowStart: toIsoDate(start),
    windowEnd: toIsoDate(end),
    thesis: humanThesis[input.target],
    trigger: `\u89E6\u53D1\u6761\u4EF6\uFF1A${triggerLens[input.target]}\u3002`,
    invalidation: `\u5931\u6548\u6761\u4EF6\uFF1A${pressure}\u7EE7\u7EED\u6076\u5316\uFF0C\u6216\u4EF7\u683C\u63D0\u524D\u8DCC\u7834\u4FEE\u590D\u7ED3\u6784\uFF1B\u82E5\u53D1\u751F\uFF0C\u7A97\u53E3\u987A\u5EF6\u3002`,
    confidence: classifyConfidence(input.probability),
    modelName: "context-weighted-week-forecast-v0.2",
    contextScore: context.contextScore,
    contextDrivers: context.contextDrivers,
    evidenceSummary: context.evidenceSummary,
    agentDebate: {
      bullCase: `${input.target} \u7F8E\u5143\u591A\u5934\u7814\u7A76\u5458\uFF1A\u82E5 ${support} \u7EE7\u7EED\u53D1\u9175\uFF0C\u7A97\u53E3\u53EF\u4EE5\u63D0\u524D\u5230 ${formatForecastLabel(start, end)}\u3002`,
      bearCase: `${input.target} \u7F8E\u5143\u7A7A\u5934\u7814\u7A76\u5458\uFF1A\u5931\u6548\u70B9\u5728 ${pressure}\uFF0C\u4EFB\u4F55\u5730\u4EA7\u6216\u4E2D\u6982\u60C5\u7EEA\u8D70\u5F31\u90FD\u4F1A\u63A8\u8FDF\u7A97\u53E3\u3002`,
      baseCase: `\u57FA\u51C6\u7814\u7A76\u5458\uFF1A\u5F53\u524D\u6982\u7387 ${input.probability}%\u3001\u4E0A\u4E0B\u6587\u5206 ${context.contextScore}\uFF0C\u53EA\u7ED9\u4E00\u5468\u7A97\u53E3\uFF0C\u4E0D\u7ED9\u786E\u5B9A\u6027\u7ED3\u8BBA\u3002`
    }
  };
}
function calculateBaseProbability(quote2, target) {
  const baseProbabilities = { 17: 70, 18: 55, 19: 40 };
  const distanceSensitivity = { 17: 2, 18: 1.9, 19: 1.8 };
  const distancePercent = distanceToTargetPercent(quote2, target);
  return baseProbabilities[target] - distancePercent * distanceSensitivity[target];
}
function calculateVolatilityContext(history = []) {
  if (history.length < 2) {
    return { recentReturn: 0, volatility: 0, trendSlope: 0, adjustment: 0 };
  }
  const closes = history.map((point) => point.close).filter((value) => value > 0);
  if (closes.length < 2) {
    return { recentReturn: 0, volatility: 0, trendSlope: 0, adjustment: 0 };
  }
  const recentReturn = (closes[closes.length - 1] - closes[0]) / closes[0] * 100;
  const dailyReturns = closes.slice(1).map((close, index) => (close - closes[index]) / closes[index] * 100);
  const averageReturn = dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, value) => sum + (value - averageReturn) ** 2, 0) / dailyReturns.length;
  const volatility = Math.sqrt(variance);
  const trendSlope = averageReturn;
  let adjustment = 0;
  if (recentReturn > 3) adjustment += 1.5;
  else if (recentReturn > 1) adjustment += 0.8;
  else if (recentReturn < -3) adjustment -= 1.5;
  else if (recentReturn < -1) adjustment -= 0.8;
  if (volatility > 4) adjustment -= 1.2;
  else if (volatility > 2.5) adjustment -= 0.6;
  return {
    recentReturn: Number(recentReturn.toFixed(2)),
    volatility: Number(volatility.toFixed(2)),
    trendSlope: Number(trendSlope.toFixed(2)),
    adjustment: Number(adjustment.toFixed(1))
  };
}
var FACTOR_WEIGHTS = {
  technical: 0.25,
  company: 0.25,
  property: 0.25,
  chinaAdr: 0.15,
  macro: 0.05,
  geopolitics: 0.05
};
function calculateFactorAdjustment(factors) {
  let totalWeight = 0;
  let weightedAdjustment = 0;
  for (const factor of factors) {
    const weight = FACTOR_WEIGHTS[factor.factor] ?? 0.1;
    const adjustment = (factor.score - 50) * 0.8;
    weightedAdjustment += adjustment * weight * factor.confidence;
    totalWeight += weight;
  }
  return totalWeight > 0 ? weightedAdjustment / totalWeight : 0;
}
function detectMajorEvents(events) {
  return events.some((event) => event.importance >= 8 && event.confidence >= 0.75);
}
function eventImpactSign(event) {
  if (event.impact === "positive") return 1;
  if (event.impact === "negative") return -1;
  return 0;
}
function calculateEventAdjustment(events, target) {
  const relevantEvents = events.filter((event) => event.affectedTargets.includes(target));
  const adjustment = relevantEvents.reduce((sum, event) => {
    const horizonWeight = event.timeHorizon === "\u77ED\u671F" ? 1 : event.timeHorizon === "\u4E2D\u671F" ? 0.75 : 0.45;
    return sum + eventImpactSign(event) * event.importance * event.confidence * horizonWeight * 0.7;
  }, 0);
  return Math.max(-15, Math.min(15, adjustment));
}
function memoryImpactSign(memory) {
  const text = memory.content.toLowerCase();
  const positiveWords = ["\u6539\u5584", "\u56DE\u8D2D", "\u652F\u6491", "\u97E7\u6027", "\u4FEE\u590D", "\u4F01\u7A33", "\u589E\u957F"];
  const negativeWords = ["\u4E0B\u964D", "\u627F\u538B", "\u8D70\u5F31", "\u98CE\u9669", "\u6076\u5316", "\u4E0B\u6ED1"];
  const positive = positiveWords.some((word) => text.includes(word));
  const negative = negativeWords.some((word) => text.includes(word));
  if (positive && !negative) return 1;
  if (negative && !positive) return -1;
  return 0;
}
function calculateMemoryAdjustment(memories) {
  const adjustment = memories.reduce((sum, memory) => {
    return sum + memoryImpactSign(memory) * memory.importance * memory.confidence * memory.decayScore * 0.2;
  }, 0);
  return Math.max(-4, Math.min(4, adjustment));
}
function applyJumpLimit(newProbability, previousProbability, hasMajorEvent = false, normalLimit = 5, majorEventLimit = 10) {
  if (previousProbability === void 0) return newProbability;
  const jump = newProbability - previousProbability;
  const absJump = Math.abs(jump);
  if (absJump <= normalLimit) return newProbability;
  const limit = hasMajorEvent ? majorEventLimit : normalLimit;
  const limitedJump = Math.sign(jump) * limit;
  return previousProbability + limitedJump;
}
function generateTargetSpecificRationale(input) {
  const lens = {
    17: "17 \u7F8E\u5143\u4EE3\u8868\u4FEE\u590D\u56DE\u8865\uFF0C\u6838\u5FC3\u4E0D\u662F\u8D8B\u52BF\u53CD\u8F6C\uFF0C\u800C\u662F\u5E02\u573A\u662F\u5426\u613F\u610F\u91CD\u65B0\u5B9A\u4EF7\u77ED\u7EBF\u6280\u672F\u9762\u3001\u56DE\u8D2D\u548C\u6BDB\u5229\u7387\u97E7\u6027\u3002",
    18: "18 \u7F8E\u5143\u4EE3\u8868\u57FA\u672C\u9762\u786E\u8BA4\uFF0C\u9700\u8981 GTV\u3001\u5229\u6DA6\u7387\u6216\u653F\u7B56\u6548\u679C\u81F3\u5C11\u4E00\u4E2A\u65B9\u5411\u88AB\u6570\u636E\u9A8C\u8BC1\u3002",
    19: "19 \u7F8E\u5143\u4EE3\u8868\u91CD\u65B0\u5B9A\u4EF7\uFF0C\u9700\u8981\u5730\u4EA7\u6210\u4EA4\u548C\u623F\u4EF7\u8FDE\u7EED\u786E\u8BA4\uFF0C\u5E76\u4E14\u4E2D\u6982\u98CE\u9669\u504F\u597D\u4E0D\u80FD\u62D6\u7D2F\u4F30\u503C\u3002"
  };
  const support = input.positiveDrivers.length > 0 ? input.positiveDrivers.join("\u3001") : "\u6682\u65E0\u5F3A\u652F\u6491\u56E0\u5B50";
  const pressure = input.negativeDrivers.length > 0 ? input.negativeDrivers.join("\u3001") : "\u6682\u65E0\u660E\u786E\u538B\u5236\u9879";
  const eventLine = input.hasMajorEvent ? "\u672C\u8F6E\u5B58\u5728\u9AD8\u91CD\u8981\u6027\u4E8B\u4EF6\uFF0C\u56E0\u6B64\u5141\u8BB8\u66F4\u5927\u7684\u6982\u7387\u8C03\u6574\u3002" : "\u672C\u8F6E\u6CA1\u6709\u9AD8\u91CD\u8981\u6027\u4E8B\u4EF6\uFF0C\u6982\u7387\u53D8\u5316\u53D7\u5230\u666E\u901A\u8DF3\u53D8\u9650\u5236\u3002";
  return `${lens[input.target]} \u7A7A\u95F4\u96BE\u5EA6 ${input.distancePercent.toFixed(1)}%\uFF0C\u56E0\u5B50 ${input.factorAdjustment.toFixed(1)} \u70B9\uFF0C\u4E8B\u4EF6 ${input.eventAdjustment.toFixed(1)} \u70B9\uFF0C\u8BB0\u5FC6 ${input.memoryAdjustment.toFixed(1)} \u70B9\uFF0C\u6CE2\u52A8 ${input.volatilityAdjustment.toFixed(1)} \u70B9\u3002${eventLine} \u652F\u6491\uFF1A${support}\uFF1B\u538B\u5236\uFF1A${pressure}\u3002`;
}
function calculateTargetPredictions(input) {
  const { quote: quote2, history = [], factors, events, memories, previousSnapshot, llmProvider } = input;
  const factorAdjustment = calculateFactorAdjustment(factors);
  const memoryAdjustment = calculateMemoryAdjustment(memories);
  const volatilityContext = calculateVolatilityContext(history);
  const hasMajorEvent = detectMajorEvents(events);
  const predictions = [17, 18, 19].map((target) => {
    const distancePercent = distanceToTargetPercent(quote2, target);
    const baseProb = calculateBaseProbability(quote2, target);
    const eventAdjustment = calculateEventAdjustment(events, target);
    let boundedLlmAdjustment = 0;
    if (llmProvider) {
      try {
        boundedLlmAdjustment = 0;
      } catch {
        boundedLlmAdjustment = 0;
      }
    }
    let adjustedProb = baseProb + factorAdjustment + eventAdjustment + memoryAdjustment + volatilityContext.adjustment + boundedLlmAdjustment;
    const previousPrediction = previousSnapshot?.predictions.find((p) => p.target === target);
    adjustedProb = applyJumpLimit(adjustedProb, previousPrediction?.probability, hasMajorEvent);
    const probability = enforceProbabilityBounds(adjustedProb);
    const likelyWindow = likelyWindowForTarget(target);
    const positiveDrivers = [
      ...factors.filter((f) => f.direction === "positive").map((f) => f.label),
      ...events.filter((event) => event.impact === "positive").slice(0, 2).map((event) => event.title)
    ];
    const negativeDrivers = [
      ...factors.filter((f) => f.direction === "negative").map((f) => f.label),
      ...events.filter((event) => event.impact === "negative").slice(0, 2).map((event) => event.title)
    ];
    return {
      target,
      probability,
      previousProbability: previousPrediction?.probability,
      probabilityChange: previousPrediction ? probability - previousPrediction.probability : void 0,
      likelyWindow,
      nearTermForecast: buildNearTermForecast({
        target,
        probability,
        likelyWindow,
        positiveDrivers,
        negativeDrivers,
        quote: quote2,
        history,
        factors,
        events,
        memories,
        previousPrediction
      }),
      distancePercent,
      signal: classifySignal(probability),
      confidence: classifyConfidence(probability),
      modelScore: probability,
      baseProbability: enforceProbabilityBounds(baseProb),
      factorAdjustment: Math.round(factorAdjustment * 10) / 10,
      llmAdjustment: boundedLlmAdjustment,
      analysis: generateTargetSpecificRationale({
        target,
        distancePercent,
        factorAdjustment,
        eventAdjustment,
        memoryAdjustment,
        volatilityAdjustment: volatilityContext.adjustment,
        positiveDrivers,
        negativeDrivers,
        hasMajorEvent
      }),
      positiveDrivers,
      negativeDrivers,
      nextWatchpoints: [
        "\u56FD\u5BB6\u7EDF\u8BA1\u5C40\u623F\u5730\u4EA7\u6570\u636E",
        "\u4E0B\u4E00\u4EFD\u8D22\u62A5\u7684 GTV \u4E0E\u5229\u6DA6\u7387",
        "KWEB / FXI \u662F\u5426\u4F01\u7A33"
      ]
    };
  });
  return enforceTargetMonotonicity(predictions);
}
function calculateForecastContext(input) {
  const quant = calculateQuantSignal(input.quote, input.history ?? []);
  const event = calculateEventSignal(input.events ?? [], input.target);
  const factor = calculateFactorSignal(input.factors ?? []);
  const memory = calculateMemorySignal(input.memories ?? []);
  const previousDrift = input.previousPrediction ? Math.max(-8, Math.min(8, (input.probability - input.previousPrediction.probability) * 0.6)) : 0;
  const contextScore = clampRound(
    input.probability * 0.45 + quant.score * 0.18 + event.score * 0.16 + factor.score * 0.14 + memory.score * 0.07 + previousDrift,
    5,
    95
  );
  return {
    contextScore,
    weekShift: contextWeekShift(contextScore, event.hasFreshHighReliabilityPositive),
    contextDrivers: [
      quant.driver,
      event.driver,
      factor.driver,
      memory.driver,
      input.previousPrediction ? `\u4E0A\u4E00\u8F6E\u6982\u7387 ${input.previousPrediction.probability}% -> \u672C\u8F6E ${input.probability}%` : "\u6682\u65E0\u4E0A\u4E00\u8F6E\u76EE\u6807\u6982\u7387\u4F5C\u4E3A\u6F02\u79FB\u951A\u70B9"
    ],
    evidenceSummary: {
      newsItems: (input.events ?? []).filter((eventItem) => eventItem.affectedTargets.includes(input.target)).length,
      historyPoints: input.history?.length ?? 0,
      memoryItems: input.memories?.length ?? 0,
      dominantFactor: factor.dominantFactor,
      quantSignal: quant.label,
      eventSignal: event.label
    }
  };
}
function calculateQuantSignal(quote2, history) {
  const volatility = calculateVolatilityContext(history);
  const intraday = quote2 && quote2.previousClose > 0 ? (quote2.price - quote2.previousClose) / quote2.previousClose * 100 : 0;
  const trendScore = 50 + volatility.recentReturn * 4 + volatility.trendSlope * 8 + intraday * 3 - volatility.volatility * 2;
  const score = clampRound(trendScore, 5, 95);
  const label = score >= 58 ? "\u91CF\u5316\u504F\u65E9" : score <= 42 ? "\u91CF\u5316\u504F\u665A" : "\u91CF\u5316\u4E2D\u6027";
  return {
    score,
    label,
    driver: `${label}\uFF1A\u8FD1\u7AEF\u6536\u76CA ${volatility.recentReturn.toFixed(2)}%\uFF0C\u6CE2\u52A8 ${volatility.volatility.toFixed(2)}\uFF0C\u65E5\u5185 ${intraday.toFixed(2)}%`
  };
}
function calculateEventSignal(events, target) {
  const relevant = events.filter((event) => event.affectedTargets.includes(target));
  if (relevant.length === 0) {
    return {
      score: 50,
      label: "\u4E8B\u4EF6\u4E2D\u6027",
      driver: "\u4E8B\u4EF6\u4E2D\u6027\uFF1A\u6682\u65E0\u76F4\u63A5\u5F71\u54CD\u8BE5\u76EE\u6807\u7684\u65B0\u4E8B\u4EF6",
      hasFreshHighReliabilityPositive: false
    };
  }
  let total = 0;
  let totalWeight = 0;
  let headline = relevant[0];
  for (const event of relevant) {
    const freshness = event.freshnessHours === void 0 ? 0.75 : Math.max(0.25, 1 - Math.min(event.freshnessHours, 168) / 240);
    const reliability = event.sourceReliability ?? (event.evidenceType === "official" ? 0.9 : 0.65);
    const horizon = event.timeHorizon === "\u77ED\u671F" ? 1 : event.timeHorizon === "\u4E2D\u671F" ? 0.7 : 0.45;
    const signed = event.impact === "positive" ? 1 : event.impact === "negative" ? -1 : 0;
    const weight = event.importance * event.confidence * reliability * freshness * horizon;
    total += signed * weight;
    totalWeight += weight;
    if (weight > headline.importance * headline.confidence) {
      headline = event;
    }
  }
  const score = clampRound(50 + (totalWeight === 0 ? 0 : total / Math.max(totalWeight, 1) * 28), 5, 95);
  const label = score >= 58 ? "\u4E8B\u4EF6\u50AC\u5316\u504F\u65E9" : score <= 42 ? "\u4E8B\u4EF6\u538B\u5236\u504F\u665A" : "\u4E8B\u4EF6\u4E2D\u6027";
  const hasFreshHighReliabilityPositive = relevant.some(
    (event) => event.impact === "positive" && event.importance >= 8 && (event.sourceReliability ?? 0.65) >= 0.8 && (event.freshnessHours ?? 72) <= 48
  );
  return {
    score,
    label,
    driver: `${label}\uFF1A${headline.source}\u300A${headline.title}\u300B\u6743\u91CD\u6700\u9AD8`,
    hasFreshHighReliabilityPositive
  };
}
function calculateFactorSignal(factors) {
  if (factors.length === 0) {
    return { score: 50, dominantFactor: "\u6682\u65E0\u4E3B\u5BFC\u56E0\u5B50", driver: "\u56E0\u5B50\u4E2D\u6027\uFF1A\u6682\u65E0\u56E0\u5B50\u8F93\u5165" };
  }
  let total = 0;
  let totalWeight = 0;
  let dominant = factors[0];
  for (const factor of factors) {
    const weight = Math.max(0.2, factor.confidence);
    total += factor.score * weight;
    totalWeight += weight;
    if (Math.abs(factor.score - 50) * factor.confidence > Math.abs(dominant.score - 50) * dominant.confidence) {
      dominant = factor;
    }
  }
  const score = clampRound(total / totalWeight, 5, 95);
  return {
    score,
    dominantFactor: dominant.label,
    driver: `\u4E3B\u5BFC\u56E0\u5B50 ${dominant.label}\uFF1A${Math.round(dominant.score)} \u5206\uFF0C${dominant.reason}`
  };
}
function calculateMemorySignal(memories) {
  if (memories.length === 0) {
    return { score: 50, driver: "\u8BB0\u5FC6\u4E2D\u6027\uFF1A\u6682\u65E0\u53EF\u7528\u5386\u53F2\u8BB0\u5FC6" };
  }
  const signedScore = memories.reduce((sum, memory) => {
    return sum + memoryImpactSign(memory) * memory.importance * memory.confidence * memory.decayScore;
  }, 0);
  const score = clampRound(50 + signedScore * 3.2, 5, 95);
  const topMemory = [...memories].sort((a, b) => b.importance * b.confidence * b.decayScore - a.importance * a.confidence * a.decayScore)[0];
  return {
    score,
    driver: `\u8BB0\u5FC6\u5F15\u7528\uFF1A${topMemory.content.slice(0, 42)}`
  };
}
function contextWeekShift(contextScore, hasFreshHighReliabilityPositive) {
  if (contextScore >= 70) return hasFreshHighReliabilityPositive ? -2 : -1;
  if (contextScore >= 58) return 0;
  if (contextScore >= 45) return 1;
  if (contextScore >= 32) return 2;
  return 3;
}
function clampRound(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(value)));
}
function parseIsoDate(value) {
  return /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
}
function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}
function summarizeDrivers(items = [], fallback, limit) {
  const labels = items.map(toDriverLabel).filter(Boolean);
  return labels.length > 0 ? naturalList(Array.from(new Set(labels)).slice(0, limit)) : fallback;
}
function naturalList(items) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]}\u548C${items[1]}`;
  return `${items.slice(0, -1).join("\u3001")}\u548C${items[items.length - 1]}`;
}
function toDriverLabel(value) {
  if (/回购|股东大会/.test(value)) return "\u56DE\u8D2D\u6388\u6743";
  if (/企稳|技术/.test(value)) return "\u4EF7\u683C\u4F01\u7A33";
  if (/收入|GTV/.test(value)) return "\u6536\u5165\u538B\u529B";
  if (/毛利率/.test(value)) return "\u6BDB\u5229\u7387\u97E7\u6027";
  if (/地产环境|房地产|住房|二手房|新房|房价/.test(value)) return "\u5730\u4EA7\u73AF\u5883";
  if (/中概|KWEB|FXI|ADR/.test(value)) return "\u4E2D\u6982\u60C5\u7EEA";
  return value.length > 14 ? `${value.slice(0, 14)}...` : value;
}
function formatForecastLabel(start, end) {
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const startMonth = start.getUTCMonth() + 1;
  const endMonth = end.getUTCMonth() + 1;
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  if (startYear !== endYear) {
    return `${startYear} \u5E74 ${startMonth} \u6708 ${startDay} \u65E5 - ${endYear} \u5E74 ${endMonth} \u6708 ${endDay} \u65E5`;
  }
  return `${startYear} \u5E74 ${startMonth} \u6708 ${startDay} \u65E5 - ${endMonth} \u6708 ${endDay} \u65E5`;
}

// src/research/backtest/BacktestEngine.ts
var BacktestEngine = class {
  calculateBrierScore(audits) {
    if (audits.length === 0) return 0;
    const sum = audits.reduce((acc, audit) => {
      const predicted = audit.predictedProbability / 100;
      const actual = audit.actualHit ? 1 : 0;
      return acc + Math.pow(predicted - actual, 2);
    }, 0);
    return sum / audits.length;
  }
  calculateCalibrationError(audits, buckets = 10) {
    if (audits.length === 0) return 0;
    const bucketSize = 1 / buckets;
    let totalError = 0;
    for (let i = 0; i < buckets; i++) {
      const lower = i * bucketSize;
      const upper = (i + 1) * bucketSize;
      const inBucket = audits.filter((a) => {
        const p = a.predictedProbability / 100;
        return p >= lower && p < upper;
      });
      if (inBucket.length === 0) continue;
      const avgPredicted = inBucket.reduce((sum, a) => sum + a.predictedProbability / 100, 0) / inBucket.length;
      const avgActual = inBucket.filter((a) => a.actualHit).length / inBucket.length;
      totalError += Math.abs(avgPredicted - avgActual) * (inBucket.length / audits.length);
    }
    return totalError;
  }
  calculateHitWindowError(audits) {
    const hitAudits = audits.filter((a) => a.actualHit && a.actualHitDate);
    if (hitAudits.length === 0) return 0;
    const errors = hitAudits.map((a) => {
      const predictionDate = new Date(a.predictionDate);
      const hitDate = new Date(a.actualHitDate);
      const actualDays = (hitDate.getTime() - predictionDate.getTime()) / (24 * 60 * 60 * 1e3);
      let expectedDays;
      switch (a.horizon) {
        case "30d":
          expectedDays = 30;
          break;
        case "60d":
          expectedDays = 60;
          break;
        case "90d":
          expectedDays = 90;
          break;
      }
      return Math.abs(actualDays - expectedDays) / expectedDays;
    });
    return errors.reduce((sum, e) => sum + e, 0) / errors.length;
  }
  calculateDirectionAccuracy(audits) {
    if (audits.length === 0) return 0;
    const correct = audits.filter((a) => {
      const predicted = a.predictedProbability / 100;
      return a.actualHit ? predicted > 0.5 : predicted <= 0.5;
    }).length;
    return correct / audits.length;
  }
  generateCalibrationReport(audits) {
    return {
      brierScore: this.calculateBrierScore(audits),
      calibrationError: this.calculateCalibrationError(audits),
      hitWindowError: this.calculateHitWindowError(audits),
      directionAccuracy: this.calculateDirectionAccuracy(audits)
    };
  }
};

// src/research/engines/calibration/CalibrationEngine.ts
var MIN_OUTCOME_SAMPLE_SIZE = 20;
var REQUIRED_FACTOR_COUNT = 6;
function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
function roundMetric(value) {
  return Number(value.toFixed(4));
}
function sourceDiversityScore(snapshot) {
  const publishers = new Set(
    [
      ...snapshot.news.map((item) => item.source),
      ...snapshot.sources.map((source) => source.publisher)
    ].filter(Boolean)
  );
  const hasOfficialSource = [...publishers].some(
    (publisher) => /ir|investor|holdings|ke holdings/i.test(publisher)
  );
  return clampScore(publishers.size * 25 + (hasOfficialSource ? 20 : 0) + Math.min(snapshot.news.length, 5) * 5);
}
function factorCoverageScore(snapshot) {
  const factors = new Set(snapshot.factors.map((factor) => factor.factor));
  return clampScore(factors.size / REQUIRED_FACTOR_COUNT * 100);
}
function forecastEvidenceScore(snapshot) {
  if (snapshot.predictions.length === 0) return 0;
  const scores = snapshot.predictions.map((prediction) => {
    const forecast = prediction.nearTermForecast;
    const evidence = forecast?.evidenceSummary;
    if (!forecast || !evidence) return 0;
    return clampScore(
      (evidence.newsItems > 0 ? 30 : 0) + (evidence.historyPoints >= 5 ? 25 : evidence.historyPoints > 0 ? 15 : 0) + (evidence.memoryItems > 0 ? 15 : 8) + (evidence.dominantFactor && evidence.dominantFactor !== "\u6682\u65E0\u4E3B\u5BFC\u56E0\u5B50" ? 15 : 0) + (forecast.agentDebate ? 15 : 0)
    );
  });
  return clampScore(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}
function memoryEvidenceScore(snapshot) {
  if (snapshot.predictions.length === 0) return 0;
  const memoryCounts = snapshot.predictions.map(
    (prediction) => prediction.nearTermForecast?.evidenceSummary?.memoryItems ?? 0
  );
  const averageMemoryCount = memoryCounts.reduce((sum, count) => sum + count, 0) / memoryCounts.length;
  const hasPersistentMemory = memoryCounts.some((count) => count > 4);
  return clampScore(
    (averageMemoryCount >= 4 ? 90 : averageMemoryCount >= 2 ? 70 : averageMemoryCount > 0 ? 50 : 0) + (hasPersistentMemory ? 10 : 0)
  );
}
function historyCoverageScore(snapshot) {
  if (snapshot.history.length >= 10) return 100;
  if (snapshot.history.length >= 5) return 70;
  if (snapshot.history.length > 0) return 55;
  return 0;
}
function calibrationScore(report) {
  if (report.status === "pending_outcomes") return 65;
  if (report.status === "insufficient_outcomes") return 55;
  const brier = report.brierScore ?? 1;
  const calibrationError = report.calibrationError ?? 1;
  const directionPenalty = report.directionAccuracy === null ? 20 : (1 - report.directionAccuracy) * 20;
  return clampScore(100 - brier * 80 - calibrationError * 60 - directionPenalty);
}
function qualityFindings(input) {
  const findings = [];
  if (input.sourceScore < 50) {
    findings.push({ code: "SOURCE_DIVERSITY_WEAK", severity: "critical", message: "\u516C\u5F00\u6765\u6E90\u8FC7\u5C11\uFF0C\u65E0\u6CD5\u652F\u6491\u53D1\u5E03\u7EA7\u7814\u7A76\u5224\u65AD\u3002" });
  } else if (input.sourceScore < 75) {
    findings.push({ code: "SOURCE_DIVERSITY_THIN", severity: "warning", message: "\u6765\u6E90\u8986\u76D6\u504F\u8584\uFF0C\u9700\u8981\u8865\u5145\u5B98\u65B9\u3001\u65B0\u95FB\u6216\u5E02\u573A\u6765\u6E90\u3002" });
  }
  if (input.factorScore < 80) {
    findings.push({ code: "FACTOR_COVERAGE_WEAK", severity: "critical", message: "\u56E0\u5B50\u8986\u76D6\u4E0D\u8DB3\uFF0C\u6982\u7387\u5224\u65AD\u7F3A\u5C11\u5B8C\u6574\u6A2A\u622A\u9762\u7EA6\u675F\u3002" });
  }
  if (input.forecastScore < 80) {
    findings.push({ code: "FORECAST_EVIDENCE_WEAK", severity: "critical", message: "\u4E00\u5468\u9884\u6D4B\u7F3A\u5C11\u65B0\u95FB\u3001\u5386\u53F2\u3001\u8BB0\u5FC6\u6216 debate \u8BC1\u636E\u3002" });
  }
  if (input.memoryScore < 50) {
    findings.push({ code: "MEMORY_EVIDENCE_WEAK", severity: "critical", message: "\u8BB0\u5FC6\u8BC1\u636E\u4E0D\u8DB3\uFF0C\u7CFB\u7EDF\u65E0\u6CD5\u8BC1\u660E\u8DE8 run \u590D\u76D8\u80FD\u529B\u3002" });
  } else if (input.memoryScore < 80) {
    findings.push({ code: "MEMORY_EVIDENCE_THIN", severity: "warning", message: "\u8BB0\u5FC6\u8BC1\u636E\u504F\u8584\uFF0C\u9884\u6D4B\u66F4\u4F9D\u8D56\u5F53\u524D\u4E8B\u4EF6\u548C\u4EF7\u683C\u5E93\u3002" });
  }
  if (input.historyScore === 0) {
    findings.push({ code: "HISTORY_COVERAGE_WEAK", severity: "critical", message: "\u6982\u7387\u5386\u53F2\u4E0D\u8DB3\uFF0C\u8D8B\u52BF\u5C55\u793A\u7F3A\u5C11\u590D\u76D8\u57FA\u7EBF\u3002" });
  } else if (input.historyScore < 100) {
    findings.push({ code: "HISTORY_COVERAGE_THIN", severity: "warning", message: "\u6982\u7387\u5386\u53F2\u672A\u6EE1 10 \u4E2A\u70B9\uFF0C\u8D8B\u52BF\u8BFB\u6570\u4ECD\u504F\u8584\u3002" });
  }
  if (input.calibration.status === "pending_outcomes") {
    findings.push({
      code: "CALIBRATION_PENDING_OUTCOMES",
      severity: "warning",
      message: "\u6821\u51C6\u62A5\u544A\u5DF2\u751F\u6210\uFF0C\u4F46\u8FD8\u5728\u7B49\u5F85\u76EE\u6807\u662F\u5426\u89E6\u8FBE\u7684\u771F\u5B9E\u7ED3\u679C\u3002"
    });
  } else if (input.calibration.status === "insufficient_outcomes") {
    findings.push({
      code: "CALIBRATION_SAMPLE_THIN",
      severity: "warning",
      message: "\u5DF2\u6709\u90E8\u5206\u771F\u5B9E\u7ED3\u679C\uFF0C\u4F46\u6837\u672C\u91CF\u4E0D\u8DB3\u4EE5\u5F62\u6210\u7A33\u5B9A\u6821\u51C6\u7ED3\u8BBA\u3002"
    });
  }
  if (input.calibrationScore < 45) {
    findings.push({ code: "CALIBRATION_SCORE_WEAK", severity: "critical", message: "\u5386\u53F2\u6821\u51C6\u6307\u6807\u8FC7\u5F31\uFF0C\u9700\u8981\u56DE\u5230\u6982\u7387\u6A21\u578B\u4FEE\u6B63\u3002" });
  }
  return findings;
}
var CalibrationEngine = class {
  backtest = new BacktestEngine();
  buildCalibrationReport(audits = [], now = (/* @__PURE__ */ new Date()).toISOString()) {
    if (audits.length === 0) {
      return {
        modelName: "probability-rules-mvp-0.1",
        status: "pending_outcomes",
        sampleSize: 0,
        brierScore: null,
        calibrationError: null,
        hitWindowError: null,
        directionAccuracy: null,
        generatedAt: now,
        thresholdPolicy: {
          minOutcomeSampleSize: MIN_OUTCOME_SAMPLE_SIZE,
          publishWithoutOutcomes: true
        },
        notes: ["\u7B49\u5F85\u76EE\u6807\u662F\u5426\u89E6\u8FBE\u7684\u771F\u5B9E\u7ED3\u679C\uFF1B\u5F53\u524D\u53EA\u53D1\u5E03\u900F\u660E\u7684\u5F85\u6821\u51C6\u72B6\u6001\uFF0C\u4E0D\u4F2A\u9020 Brier/ECE\u3002"]
      };
    }
    const metrics = this.backtest.generateCalibrationReport(audits);
    const status = audits.length >= MIN_OUTCOME_SAMPLE_SIZE ? "ready" : "insufficient_outcomes";
    return {
      modelName: "probability-rules-mvp-0.1",
      status,
      sampleSize: audits.length,
      brierScore: roundMetric(metrics.brierScore),
      calibrationError: roundMetric(metrics.calibrationError),
      hitWindowError: roundMetric(metrics.hitWindowError),
      directionAccuracy: roundMetric(metrics.directionAccuracy),
      generatedAt: now,
      thresholdPolicy: {
        minOutcomeSampleSize: MIN_OUTCOME_SAMPLE_SIZE,
        publishWithoutOutcomes: true
      },
      notes: status === "ready" ? ["\u771F\u5B9E outcome \u6837\u672C\u8FBE\u5230\u9608\u503C\uFF0CBrier/ECE \u53EF\u4F5C\u4E3A\u6A21\u578B\u6821\u51C6\u8BC1\u636E\u3002"] : ["\u5DF2\u6709\u771F\u5B9E outcome\uFF0C\u4F46\u6837\u672C\u91CF\u5C1A\u672A\u8FBE\u5230\u7A33\u5B9A\u6821\u51C6\u9608\u503C\u3002"]
    };
  }
  evaluateResearchQuality(snapshot, calibration = this.buildCalibrationReport()) {
    const sourceScore = sourceDiversityScore(snapshot);
    const factorScore = factorCoverageScore(snapshot);
    const forecastScore = forecastEvidenceScore(snapshot);
    const memoryScore = memoryEvidenceScore(snapshot);
    const historyScore = historyCoverageScore(snapshot);
    const calScore = calibrationScore(calibration);
    const overallScore = clampScore(
      sourceScore * 0.2 + factorScore * 0.2 + forecastScore * 0.2 + memoryScore * 0.1 + historyScore * 0.15 + calScore * 0.15
    );
    return {
      overallScore,
      sourceDiversityScore: sourceScore,
      factorCoverageScore: factorScore,
      forecastEvidenceScore: forecastScore,
      memoryEvidenceScore: memoryScore,
      historyCoverageScore: historyScore,
      calibrationScore: calScore,
      findings: qualityFindings({
        calibration,
        sourceScore,
        factorScore,
        forecastScore,
        memoryScore,
        historyScore,
        calibrationScore: calScore
      })
    };
  }
  attachResearchQuality(snapshot, options = {}) {
    const calibration = this.buildCalibrationReport(options.audits ?? [], options.now);
    const quality = this.evaluateResearchQuality(snapshot, calibration);
    return {
      ...snapshot,
      calibration,
      quality
    };
  }
};
function attachResearchQuality(snapshot, options = {}) {
  return new CalibrationEngine().attachResearchQuality(snapshot, options);
}

// src/data/latestSnapshot.ts
var quote = {
  symbol: "BEKE",
  price: 15.09,
  currency: "USD",
  previousClose: 14.84,
  asOf: "2026-07-03T15:15:00+08:00",
  source: "Published fallback snapshot",
  provenance: {
    provider: "StaticMarketProvider",
    freshness: "fallback",
    fetchedAt: "2026-07-03T15:15:00+08:00"
  }
};
var fallbackPriceHistory = [
  { date: "2026-06-27", close: 14.32 },
  { date: "2026-06-28", close: 14.48 },
  { date: "2026-06-29", close: 14.63 },
  { date: "2026-06-30", close: 14.77 },
  { date: "2026-07-01", close: 14.91 },
  { date: "2026-07-02", close: 15.03 },
  { date: "2026-07-03", close: 15.09 }
];
var fallbackFactors = [
  {
    factor: "technical",
    label: "\u6280\u672F\u9762",
    score: 72,
    confidence: 0.8,
    direction: "positive",
    reason: "17 \u7F8E\u5143\u76EE\u6807\u8DDD\u73B0\u4EF7\u7EA6 12.7%\uFF0C\u4ECD\u5C5E\u4E8E\u77ED\u7EBF\u4FEE\u590D\u53EF\u89C2\u5BDF\u533A\u95F4\u3002",
    sourceEventIds: ["ke-historical-price"]
  },
  {
    factor: "company",
    label: "\u516C\u53F8\u57FA\u672C\u9762",
    score: 64,
    confidence: 0.7,
    direction: "positive",
    reason: "\u6210\u672C\u7EAA\u5F8B\u548C\u56DE\u8D2D\u6388\u6743\u63D0\u4F9B\u652F\u6491\uFF0C\u4F46\u6536\u5165\u7AEF\u4ECD\u627F\u538B\u3002",
    sourceEventIds: ["ke-q1-2026", "ke-agm-2026"]
  },
  {
    factor: "property",
    label: "\u5730\u4EA7\u73AF\u5883",
    score: 42,
    confidence: 0.6,
    direction: "negative",
    reason: "\u6210\u4EA4\u548C\u4EF7\u683C\u4FEE\u590D\u4ECD\u4E0D\u5145\u5206\uFF0C\u662F\u6982\u7387\u4E0A\u884C\u7684\u4E3B\u8981\u7EA6\u675F\u3002",
    sourceEventIds: []
  },
  {
    factor: "chinaAdr",
    label: "\u4E2D\u6982\u60C5\u7EEA",
    score: 51,
    confidence: 0.5,
    direction: "neutral",
    reason: "\u98CE\u9669\u504F\u597D\u5206\u5316\uFF0C\u77ED\u7EBF\u6CE2\u52A8\u5BF9 ADR \u4EF7\u683C\u5F71\u54CD\u8F83\u5927\u3002",
    sourceEventIds: []
  },
  {
    factor: "macro",
    label: "\u5B8F\u89C2\u73AF\u5883",
    score: 50,
    confidence: 0.4,
    direction: "neutral",
    reason: "\u5B8F\u89C2\u6570\u636E\u5E73\u7A33\uFF0C\u65E0\u91CD\u5927\u53D8\u5316\u3002",
    sourceEventIds: []
  },
  {
    factor: "geopolitics",
    label: "\u5730\u7F18\u653F\u6CBB",
    score: 50,
    confidence: 0.4,
    direction: "neutral",
    reason: "\u4E2D\u7F8E\u5173\u7CFB\u5E73\u7A33\uFF0C\u65E0\u91CD\u5927\u98CE\u9669\u4E8B\u4EF6\u3002",
    sourceEventIds: []
  }
];
var fallbackEvents = [
  {
    id: "evt-q1-2026",
    rawItemId: "ke-q1-2026",
    category: "\u516C\u53F8",
    title: "\u8D1D\u58F3 Q1 2026 \u6536\u5165\u540C\u6BD4\u4E0B\u964D\uFF0C\u4F46\u6BDB\u5229\u7387\u6539\u5584",
    summary: "\u6536\u5165\u548C GTV \u627F\u538B\uFF0C\u4F46\u6BDB\u5229\u7387\u6539\u5584\uFF0C\u8BF4\u660E\u6210\u672C\u548C\u4E1A\u52A1\u7ED3\u6784\u4ECD\u6709\u97E7\u6027\u3002",
    impact: "neutral",
    importance: 8,
    confidence: 0.82,
    timeHorizon: "\u4E2D\u671F",
    affectedTargets: [17, 18, 19],
    source: "KE Holdings IR",
    sourceUrl: "https://investors.ke.com/news-releases/news-release-details/ke-holdings-inc-announces-first-quarter-2026-unaudited-financial/",
    publishedAt: "2026-05-19T12:00:00Z",
    reason: "\u57FA\u672C\u9762\u97E7\u6027\u5F71\u54CD 17/18/19 \u4E09\u4E2A\u76EE\u6807\u7684\u65F6\u95F4\u7A97\uFF0C\u4F46\u6536\u5165\u538B\u529B\u9650\u5236\u4E0A\u884C\u786E\u8BA4\u3002",
    evidenceType: "official",
    freshnessHours: 1080,
    sourceReliability: 0.92
  },
  {
    id: "evt-agm-2026",
    rawItemId: "ke-agm-2026",
    category: "\u516C\u53F8",
    title: "\u5E74\u5EA6\u80A1\u4E1C\u5927\u4F1A\u901A\u8FC7\u8463\u4E8B\u91CD\u9009\u4E0E\u4E00\u822C\u56DE\u8D2D\u6388\u6743",
    summary: "\u56DE\u8D2D\u6388\u6743\u5F3A\u5316\u8D44\u672C\u56DE\u62A5\u9884\u671F\uFF0C\u662F\u77ED\u7EBF\u4FEE\u590D\u76EE\u6807\u7684\u91CD\u8981\u652F\u6491\u3002",
    impact: "positive",
    importance: 7,
    confidence: 0.76,
    timeHorizon: "\u4E2D\u671F",
    affectedTargets: [17, 18],
    source: "KE Holdings IR",
    sourceUrl: "https://investors.ke.com/news-releases/news-release-details/ke-holdings-inc-announces-results-annual-general-meeting-2",
    publishedAt: "2026-06-12T12:00:00Z",
    reason: "\u56DE\u8D2D\u6388\u6743\u66F4\u76F4\u63A5\u652F\u6491 17/18 \u7F8E\u5143\u7684\u4FEE\u590D\u548C\u57FA\u672C\u9762\u786E\u8BA4\uFF0C\u4E0D\u8DB3\u4EE5\u5355\u72EC\u652F\u6491 19 \u7F8E\u5143\u91CD\u4F30\u3002",
    evidenceType: "official",
    freshnessHours: 504,
    sourceReliability: 0.9
  },
  {
    id: "evt-price-stabilize",
    rawItemId: "ke-historical-price",
    category: "\u516C\u53F8",
    title: "BEKE 6 \u6708\u4E0B\u65EC\u4EF7\u683C\u56DE\u843D\u540E\u4F01\u7A33",
    summary: "\u4EF7\u683C\u4ECE 6 \u6708\u4F4E\u4F4D\u8FDE\u7EED\u4FEE\u590D\uFF0C\u7ED9\u4E00\u5468\u5927\u80C6\u9884\u6D4B\u63D0\u4F9B\u91CF\u5316\u951A\u70B9\u3002",
    impact: "positive",
    importance: 7,
    confidence: 0.72,
    timeHorizon: "\u77ED\u671F",
    affectedTargets: [17, 18, 19],
    source: "KE Holdings IR",
    sourceUrl: "https://investors.ke.com/stock-information/historical-price-lookup/",
    publishedAt: "2026-06-26T21:00:00Z",
    reason: "\u77ED\u7EBF\u4EF7\u683C\u7ED3\u6784\u6539\u5584\u4F1A\u63D0\u524D 17 \u7F8E\u5143\u7A97\u53E3\uFF0C\u4E5F\u4F1A\u63D0\u9AD8 18/19 \u7684\u89C2\u5BDF\u4EF7\u503C\u3002",
    evidenceType: "market",
    freshnessHours: 168,
    sourceReliability: 0.82
  },
  {
    id: "evt-property-policy",
    rawItemId: "property-policy-20260701",
    category: "\u5730\u4EA7",
    title: "\u4F4F\u5EFA\u90E8\u5F3A\u8C03\u652F\u6301\u521A\u6027\u548C\u6539\u5584\u6027\u4F4F\u623F\u9700\u6C42",
    summary: "\u653F\u7B56\u8868\u6001\u63D0\u4F9B\u5730\u4EA7\u4FEE\u590D\u7684\u8FB9\u9645\u652F\u6491\uFF0C\u4F46\u4ECD\u9700\u6210\u4EA4\u548C\u623F\u4EF7\u6570\u636E\u9A8C\u8BC1\u3002",
    impact: "positive",
    importance: 8,
    confidence: 0.7,
    timeHorizon: "\u77ED\u671F",
    affectedTargets: [17, 18],
    source: "\u65B0\u534E\u793E",
    publishedAt: "2026-07-01T08:00:00Z",
    reason: "\u653F\u7B56\u4FE1\u53F7\u80FD\u652F\u6301\u4FEE\u590D\u4EA4\u6613\uFF0C\u4F46\u4E0D\u7B49\u540C\u4E8E\u5730\u4EA7\u57FA\u672C\u9762\u5DF2\u7ECF\u8D8B\u52BF\u53CD\u8F6C\u3002",
    evidenceType: "news",
    freshnessHours: 56,
    sourceReliability: 0.85
  },
  {
    id: "evt-sector-pressure",
    rawItemId: "sector-pressure-20260702",
    category: "\u4E2D\u6982",
    title: "\u4E2D\u6982\u677F\u5757\u5206\u5316\uFF0C\u5730\u4EA7\u79D1\u6280\u80A1\u627F\u538B",
    summary: "\u4E2D\u6982\u98CE\u9669\u504F\u597D\u5206\u5316\u4F1A\u9650\u5236 BEKE \u4ECE\u4FEE\u590D\u4EA4\u6613\u8FDB\u5165\u91CD\u4F30\u4EA4\u6613\u3002",
    impact: "negative",
    importance: 6,
    confidence: 0.68,
    timeHorizon: "\u77ED\u671F",
    affectedTargets: [18, 19],
    source: "\u8D22\u8054\u793E",
    publishedAt: "2026-07-02T09:00:00Z",
    reason: "\u98CE\u9669\u504F\u597D\u5206\u5316\u4E3B\u8981\u538B\u5236\u66F4\u9AD8\u76EE\u6807\u4EF7\u7684\u5151\u73B0\u901F\u5EA6\u3002",
    evidenceType: "news",
    freshnessHours: 32,
    sourceReliability: 0.72
  }
];
var fallbackMemories = [
  {
    id: "mem-17-repair-anchor",
    memoryType: "market",
    content: "\u524D\u4E00\u8F6E 17 \u7F8E\u5143\u4FEE\u590D\u6765\u81EA\u4EF7\u683C\u4F01\u7A33\u3001\u56DE\u8D2D\u6388\u6743\u548C\u6BDB\u5229\u7387\u97E7\u6027\u5171\u540C\u53D1\u9175\u3002",
    sourceEventId: "evt-price-stabilize",
    validFrom: "2026-06-25T00:00:00Z",
    importance: 8,
    confidence: 0.78,
    decayScore: 0.9,
    createdAt: "2026-06-25T00:00:00Z",
    lastUsedAt: "2026-07-03T15:15:00+08:00"
  },
  {
    id: "mem-19-repricing-bar",
    memoryType: "model",
    content: "19 \u7F8E\u5143\u4E0D\u662F\u4FEE\u590D\u76EE\u6807\uFF0C\u800C\u662F\u5730\u4EA7\u6210\u4EA4\u3001\u623F\u4EF7\u548C\u4E2D\u6982\u60C5\u7EEA\u5171\u540C\u6539\u5584\u540E\u7684\u91CD\u65B0\u5B9A\u4EF7\u60C5\u666F\u3002",
    validFrom: "2026-06-29T00:00:00Z",
    importance: 7,
    confidence: 0.75,
    decayScore: 0.86,
    createdAt: "2026-06-29T00:00:00Z",
    lastUsedAt: "2026-07-03T15:15:00+08:00"
  }
];
var fallbackPreviousPredictions = {
  17: {
    target: 17,
    probability: 58,
    likelyWindow: "2026 \u5E74 8 \u6708\u4E0B\u65EC - 9 \u6708",
    distancePercent: 14.2,
    signal: "\u4E2D\u6027\u504F\u591A",
    confidence: "\u4E2D",
    modelScore: 58,
    baseProbability: 70,
    factorAdjustment: -8,
    llmAdjustment: 0,
    analysis: "\u4E0A\u4E00\u8F6E 17 \u7F8E\u5143\u6982\u7387\u951A\u70B9\u3002",
    positiveDrivers: ["\u6280\u672F\u9762"],
    negativeDrivers: ["\u5730\u4EA7\u73AF\u5883"],
    nextWatchpoints: []
  },
  18: {
    target: 18,
    probability: 43,
    likelyWindow: "2026 \u5E74 9 \u6708 - 10 \u6708",
    distancePercent: 21.2,
    signal: "\u4E2D\u6027",
    confidence: "\u4E2D",
    modelScore: 43,
    baseProbability: 55,
    factorAdjustment: -9,
    llmAdjustment: 0,
    analysis: "\u4E0A\u4E00\u8F6E 18 \u7F8E\u5143\u6982\u7387\u951A\u70B9\u3002",
    positiveDrivers: ["\u516C\u53F8\u57FA\u672C\u9762"],
    negativeDrivers: ["\u5730\u4EA7\u73AF\u5883"],
    nextWatchpoints: []
  },
  19: {
    target: 19,
    probability: 29,
    likelyWindow: "2026 \u5E74 10 \u6708 - 11 \u6708",
    distancePercent: 28,
    signal: "\u4E2D\u6027\u504F\u7A7A",
    confidence: "\u4E2D",
    modelScore: 29,
    baseProbability: 40,
    factorAdjustment: -8,
    llmAdjustment: 0,
    analysis: "\u4E0A\u4E00\u8F6E 19 \u7F8E\u5143\u6982\u7387\u951A\u70B9\u3002",
    positiveDrivers: ["\u6280\u672F\u9762"],
    negativeDrivers: ["\u5730\u4EA7\u73AF\u5883"],
    nextWatchpoints: []
  }
};
function buildStaticNearTermForecast(input) {
  return buildNearTermForecast({
    ...input,
    quote,
    history: fallbackPriceHistory,
    factors: fallbackFactors,
    events: fallbackEvents,
    memories: fallbackMemories,
    previousPrediction: fallbackPreviousPredictions[input.target]
  });
}
var latestSnapshotBase = {
  project: "beke19",
  symbol: "BEKE",
  route: "/beke19",
  runId: "beke19-20260703-1515",
  inputVersion: "public-snapshot-2026-07-03",
  modelVersion: "probability-rules-mvp-0.1",
  promptVersion: "analysis-zh-public-research-0.2",
  dataVersion: "mock-public-providers-0.1",
  updatedAt: "2026-07-03T15:15:00+08:00",
  nextUpdateAt: "2026-07-03T21:15:00+08:00",
  quote,
  predictions: [
    {
      target: 17,
      probability: 62,
      likelyWindow: "2026 \u5E74 8 \u6708\u4E0B\u65EC - 9 \u6708",
      nearTermForecast: buildStaticNearTermForecast({
        target: 17,
        probability: 62,
        likelyWindow: "2026 \u5E74 8 \u6708\u4E0B\u65EC - 9 \u6708",
        positiveDrivers: ["\u6280\u672F\u9762", "\u516C\u53F8\u57FA\u672C\u9762"],
        negativeDrivers: ["\u5730\u4EA7\u73AF\u5883"]
      }),
      distancePercent: 12.7,
      signal: "\u4E2D\u6027\u504F\u591A",
      confidence: "\u4E2D",
      modelScore: 62,
      baseProbability: 70,
      factorAdjustment: -8,
      llmAdjustment: 0,
      analysis: "\u57FA\u4E8E\u8DDD\u79BB 12.7% \u548C\u56E0\u5B50\u8C03\u6574 -8.0 \u7684\u6982\u7387\u3002",
      positiveDrivers: ["\u6280\u672F\u9762", "\u516C\u53F8\u57FA\u672C\u9762"],
      negativeDrivers: ["\u5730\u4EA7\u73AF\u5883"],
      nextWatchpoints: []
    },
    {
      target: 18,
      probability: 46,
      likelyWindow: "2026 \u5E74 9 \u6708 - 10 \u6708",
      nearTermForecast: buildStaticNearTermForecast({
        target: 18,
        probability: 46,
        likelyWindow: "2026 \u5E74 9 \u6708 - 10 \u6708",
        positiveDrivers: ["\u6280\u672F\u9762", "\u516C\u53F8\u57FA\u672C\u9762"],
        negativeDrivers: ["\u5730\u4EA7\u73AF\u5883"]
      }),
      distancePercent: 19.3,
      signal: "\u4E2D\u6027",
      confidence: "\u4E2D",
      modelScore: 46,
      baseProbability: 55,
      factorAdjustment: -9,
      llmAdjustment: 0,
      analysis: "\u57FA\u4E8E\u8DDD\u79BB 19.3% \u548C\u56E0\u5B50\u8C03\u6574 -9.0 \u7684\u6982\u7387\u3002",
      positiveDrivers: ["\u6280\u672F\u9762", "\u516C\u53F8\u57FA\u672C\u9762"],
      negativeDrivers: ["\u5730\u4EA7\u73AF\u5883"],
      nextWatchpoints: []
    },
    {
      target: 19,
      probability: 32,
      likelyWindow: "2026 \u5E74 10 \u6708 - 11 \u6708",
      nearTermForecast: buildStaticNearTermForecast({
        target: 19,
        probability: 32,
        likelyWindow: "2026 \u5E74 10 \u6708 - 11 \u6708",
        positiveDrivers: ["\u6280\u672F\u9762", "\u516C\u53F8\u57FA\u672C\u9762"],
        negativeDrivers: ["\u5730\u4EA7\u73AF\u5883"]
      }),
      distancePercent: 25.9,
      signal: "\u4E2D\u6027\u504F\u7A7A",
      confidence: "\u4F4E",
      modelScore: 32,
      baseProbability: 40,
      factorAdjustment: -8,
      llmAdjustment: 0,
      analysis: "\u57FA\u4E8E\u8DDD\u79BB 25.9% \u548C\u56E0\u5B50\u8C03\u6574 -8.0 \u7684\u6982\u7387\u3002",
      positiveDrivers: ["\u6280\u672F\u9762", "\u516C\u53F8\u57FA\u672C\u9762"],
      negativeDrivers: ["\u5730\u4EA7\u73AF\u5883"],
      nextWatchpoints: []
    }
  ],
  analysis: {
    headline: "BEKE 17 \u7F8E\u5143\u4FEE\u590D\u56DE\u8865\u5EF6\u7EED\uFF0C\u76D8\u9762\u8F6C\u5F3A\u3002",
    today: "\u672C\u8F6E\u5224\u65AD\u7684\u672C\u8D28\u662F\u5206\u5C42\u5B9A\u4EF7\uFF1A17 \u7F8E\u5143\u5BF9\u5E94\u77ED\u7EBF\u4FEE\u590D\u56DE\u8865\uFF0C18 \u7F8E\u5143\u9700\u8981\u57FA\u672C\u9762\u786E\u8BA4\uFF0C19 \u7F8E\u5143\u624D\u662F\u91CD\u65B0\u5B9A\u4EF7\u3002\u6982\u7387\u9636\u68AF\u4FDD\u6301 62/46/32\uFF0C\u8BF4\u660E\u6A21\u578B\u4ECD\u8BA4\u53EF\u4FEE\u590D\u4EA4\u6613\uFF0C\u4F46\u4E0D\u8BA4\u4E3A\u884C\u4E1A\u8D8B\u52BF\u5DF2\u7ECF\u5B8C\u6210\u786E\u8BA4\u3002\u8DDD\u79BB\u5C42\u53EA\u89E3\u91CA\u7A7A\u95F4\u96BE\u5EA6\uFF0C\u56E0\u5B50\u5C42\u89E3\u91CA\u65B9\u5411\uFF1A\u6280\u672F\u9762\u548C\u516C\u53F8\u56E0\u7D20\u63D0\u4F9B\u652F\u6491\uFF0C\u5730\u4EA7\u73AF\u5883\u4ECD\u662F\u4E3B\u8981\u7EA6\u675F\u3002",
    changes: "\u672C\u8F6E\u6CA1\u6709\u65B0\u7684 6 \u5C0F\u65F6\u5185\u516C\u5F00\u516C\u544A\uFF0C\u4E3B\u8981\u590D\u6838\u5B58\u91CF\u4FE1\u606F\uFF1AQ1 \u6BDB\u5229\u7387\u6539\u5584\u3001\u56DE\u8D2D\u6388\u6743\u30016 \u6708\u4E0B\u65EC\u80A1\u4EF7\u4F01\u7A33\u3001\u4F4F\u5EFA\u90E8\u653F\u7B56\u8868\u6001\u548C\u4E2D\u6982\u5206\u5316\u3002\u56E0\u6B64\u201C\u8FD1\u671F\u53D8\u5316\u201D\u4E0D\u662F\u65B0\u65B0\u95FB\u5217\u8868\uFF0C\u800C\u662F\u6A21\u578B\u5BF9\u5F53\u524D\u884C\u60C5\u3001\u4E8B\u4EF6\u6743\u91CD\u548C\u56E0\u5B50\u5206\u6570\u7684\u518D\u8BC4\u4F30\u3002",
    positives: [
      "17 \u7F8E\u5143\u6240\u9700\u7684\u4FEE\u590D\u5E45\u5EA6\u4F4E\u4E8E 18 / 19 \u7F8E\u5143\uFF0C\u66F4\u50CF\u60C5\u7EEA\u4FEE\u590D\u800C\u975E\u8D8B\u52BF\u91CD\u4F30\u3002",
      "\u516C\u53F8\u73B0\u91D1\u57FA\u7840\u3001\u56DE\u8D2D\u6388\u6743\u548C\u6210\u672C\u7EAA\u5F8B\u4ECD\u6784\u6210\u4F30\u503C\u652F\u6491\u3002",
      "Q1 \u6BDB\u5229\u7387\u6539\u5584\u7F13\u89E3\u4E86\u5E02\u573A\u5BF9\u5229\u6DA6\u7387\u5FEB\u901F\u4E0B\u6ED1\u7684\u62C5\u5FE7\u3002"
    ],
    negatives: [
      "\u4E2D\u56FD\u5730\u4EA7\u9500\u552E\u548C\u4EF7\u683C\u6570\u636E\u4ECD\u504F\u5F31\uFF0C\u884C\u4E1A\u4FEE\u590D\u5C1A\u672A\u5F62\u6210\u6E05\u6670\u8D8B\u52BF\u3002",
      "\u65B0\u623F\u4E1A\u52A1\u5F39\u6027\u53D7\u5F00\u53D1\u5546\u4FE1\u7528\u73AF\u5883\u548C\u9879\u76EE\u4F9B\u7ED9\u5F71\u54CD\u3002",
      "\u4E2D\u6982\u80A1\u6574\u4F53\u98CE\u9669\u504F\u597D\u4E0D\u7A33\u5B9A\uFF0C\u53EF\u80FD\u653E\u5927 ADR \u77ED\u7EBF\u6CE2\u52A8\u3002"
    ],
    watch: [
      "\u56FD\u5BB6\u7EDF\u8BA1\u5C40\u623F\u5730\u4EA7\u6570\u636E\uFF0C\u5C24\u5176\u662F\u4E00\u7EBF\u53CA\u5F3A\u4E8C\u7EBF\u4E8C\u624B\u623F\u4EF7\u683C\u3002",
      "\u4E0B\u4E00\u4EFD\u8D22\u62A5\u4E2D\u7684 GTV\u3001\u5229\u6DA6\u7387\u3001\u73B0\u91D1\u548C\u56DE\u8D2D\u8282\u594F\u3002",
      "KWEB / FXI \u662F\u5426\u4F01\u7A33\uFF0C\u51B3\u5B9A\u4E2D\u6982\u60C5\u7EEA\u662F\u5426\u7EE7\u7EED\u62D6\u7D2F\u3002"
    ],
    targetExplanations: {
      17: "17 \u7F8E\u5143\u4EE3\u8868\u4FEE\u590D\u56DE\u8865\uFF0C\u4E0D\u662F\u8D8B\u52BF\u53CD\u8F6C\u3002\u6982\u7387\u5224\u65AD\u56F4\u7ED5\u5730\u4EA7\u6570\u636E\u4E0D\u7EE7\u7EED\u6076\u5316\u3001\u56DE\u8D2D\u548C\u6BDB\u5229\u7387\u97E7\u6027\u662F\u5426\u8DB3\u591F\u652F\u6491\u4E00\u6B21\u4FEE\u590D\u3002",
      18: "18 \u7F8E\u5143\u4EE3\u8868\u57FA\u672C\u9762\u786E\u8BA4\u3002\u6982\u7387\u5224\u65AD\u56F4\u7ED5 GTV\u3001\u5229\u6DA6\u7387\u6216\u653F\u7B56\u6548\u679C\u662F\u5426\u81F3\u5C11\u4E00\u4E2A\u65B9\u5411\u88AB\u6570\u636E\u9A8C\u8BC1\uFF0C\u540C\u65F6\u4E2D\u6982\u98CE\u9669\u504F\u597D\u4E0D\u80FD\u660E\u663E\u62D6\u7D2F\u3002",
      19: "19 \u7F8E\u5143\u4EE3\u8868\u91CD\u65B0\u5B9A\u4EF7\u3002\u6982\u7387\u5224\u65AD\u56F4\u7ED5\u5730\u4EA7\u6210\u4EA4\u548C\u623F\u4EF7\u662F\u5426\u8FDE\u7EED\u786E\u8BA4\uFF0C\u4EE5\u53CA\u5E02\u573A\u662F\u5426\u628A BEKE \u4ECE\u5730\u4EA7\u60C5\u7EEA\u80A1\u770B\u6210\u73B0\u91D1\u6D41\u548C\u5E73\u53F0\u6548\u7387\u8D44\u4EA7\u3002"
    }
  },
  factors: fallbackFactors,
  news: [
    {
      id: "ke-buyback-20260702",
      eventId: "evt-ke-buyback-20260702",
      title: "\u8D1D\u58F3-W 7 \u6708 2 \u65E5\u7EE7\u7EED\u6267\u884C\u7EA6 500 \u4E07\u7F8E\u5143\u56DE\u8D2D",
      source: "\u4E1C\u65B9\u8D22\u5BCC",
      category: "\u516C\u53F8",
      summary: "\u516C\u5F00\u5E02\u573A\u4FE1\u606F\u663E\u793A\u8D1D\u58F3-W 7 \u6708 2 \u65E5\u7EE7\u7EED\u56DE\u8D2D\u80A1\u4EFD\uFF0C\u56DE\u8D2D\u8282\u594F\u4ECD\u662F BEKE \u4FEE\u590D\u4EA4\u6613\u7684\u91CD\u8981\u652F\u6491\u3002",
      impact: "positive",
      importance: 7,
      url: "https://quote.eastmoney.com/us/BEKE.html?jump_to_web=true",
      publishedAt: "2026-07-03T08:00:00Z"
    },
    {
      id: "beke-close-20260702",
      eventId: "evt-beke-close-20260702",
      title: "BEKE 7 \u6708 2 \u65E5\u6536\u4E8E 15.09 \u7F8E\u5143\uFF0C\u673A\u6784\u76EE\u6807\u4EF7\u5747\u503C\u9AD8\u4E8E\u73B0\u4EF7",
      source: "\u8BC1\u5238\u4E4B\u661F",
      category: "\u4E2D\u6982",
      summary: "\u8BC1\u5238\u4E4B\u661F\u636E\u516C\u5F00\u4FE1\u606F\u6574\u7406\uFF0CBEKE 7 \u6708 2 \u65E5\u6536\u4E8E 15.09 \u7F8E\u5143\uFF0C\u673A\u6784\u76EE\u6807\u4EF7\u5747\u503C\u7EA6 20.68 \u7F8E\u5143\u3002",
      impact: "neutral",
      importance: 6,
      url: "https://www.sohu.com/a/1045050282_122123195",
      publishedAt: "2026-07-03T06:01:00Z"
    },
    {
      id: "ke-buyback-20260701",
      eventId: "evt-ke-buyback-20260701",
      title: "\u8D1D\u58F3-W 7 \u6708 1 \u65E5\u8017\u8D44\u7EA6 500 \u4E07\u7F8E\u5143\u56DE\u8D2D",
      source: "\u5BCC\u9014\u725B\u725B",
      category: "\u516C\u53F8",
      summary: "\u6E2F\u80A1\u516C\u544A\u4FE1\u606F\u663E\u793A\u8D1D\u58F3-W 7 \u6708 1 \u65E5\u7EE7\u7EED\u56DE\u8D2D\uFF0C\u8BF4\u660E\u8D44\u672C\u56DE\u62A5\u8282\u594F\u4ECD\u5728\u5EF6\u7EED\u3002",
      impact: "positive",
      importance: 7,
      url: "https://www.futunn.com/hk/stock/BEKE-US/news",
      publishedAt: "2026-07-02T10:30:00Z"
    },
    {
      id: "china-adr-sentiment",
      eventId: "evt-sector-pressure",
      title: "\u4E2D\u6982\u80A1\u677F\u5757\u5206\u5316\uFF0C\u5730\u4EA7\u79D1\u6280\u80A1\u627F\u538B",
      source: "\u8D22\u8054\u793E",
      category: "\u4E2D\u6982",
      summary: "\u4E2D\u6982\u80A1\u677F\u5757\u6574\u4F53\u5206\u5316\uFF0C\u5730\u4EA7\u79D1\u6280\u7C7B\u516C\u53F8\u627F\u538B\uFF0C\u53EF\u80FD\u653E\u5927 BEKE ADR \u7684\u77ED\u7EBF\u6CE2\u52A8\u3002",
      impact: "negative",
      importance: 6,
      url: "https://www.cls.cn/",
      publishedAt: "2026-07-02T09:00:00Z"
    },
    {
      id: "property-policy-watch",
      eventId: "evt-property-policy",
      title: "\u4F4F\u5EFA\u90E8\u5F3A\u8C03\u652F\u6301\u521A\u6027\u548C\u6539\u5584\u6027\u4F4F\u623F\u9700\u6C42",
      source: "\u65B0\u534E\u793E",
      category: "\u5730\u4EA7",
      summary: "\u4F4F\u5EFA\u90E8\u4F1A\u8BAE\u5F3A\u8C03\u56E0\u57CE\u65BD\u7B56\u652F\u6301\u521A\u6027\u548C\u6539\u5584\u6027\u4F4F\u623F\u9700\u6C42\uFF0C\u4F46\u5E02\u573A\u4ECD\u9700\u8981\u6210\u4EA4\u548C\u623F\u4EF7\u6570\u636E\u9A8C\u8BC1\u3002",
      impact: "positive",
      importance: 7,
      url: "https://www.xinhuanet.com/",
      publishedAt: "2026-07-01T10:00:00Z"
    },
    {
      id: "ke-buyback-mandate-20260629",
      eventId: "evt-ke-buyback-mandate-20260629",
      title: "KE Holdings Steps Up Share Buybacks Under June 2026 Mandate",
      source: "MarketWatch",
      category: "\u516C\u53F8",
      summary: "MarketWatch \u805A\u5408\u4FE1\u606F\u663E\u793A\uFF0CKE Holdings \u5728 6 \u6708\u56DE\u8D2D\u6388\u6743\u4E0B\u7EE7\u7EED\u63A8\u8FDB\u80A1\u4EFD\u56DE\u8D2D\u3002",
      impact: "positive",
      importance: 7,
      url: "https://www.marketwatch.com/investing/stock/beke",
      publishedAt: "2026-06-29T13:35:00Z"
    },
    {
      id: "ke-historical-price",
      eventId: "evt-price-stabilize",
      title: "BEKE 6 \u6708\u4E0B\u65EC\u4EF7\u683C\u56DE\u843D\u540E\u4F01\u7A33",
      source: "KE Holdings IR",
      category: "\u4E2D\u6982",
      summary: "\u5386\u53F2\u4EF7\u683C\u663E\u793A 6 \u6708\u4E0B\u65EC\u6536\u76D8\u4EF7\u56DE\u843D\u540E\u4F01\u7A33\uFF0C\u6210\u4E3A\u672C\u6B21\u76EE\u6807\u4EF7\u6982\u7387\u66F4\u65B0\u7684\u5E02\u573A\u57FA\u7840\u3002",
      impact: "neutral",
      importance: 6,
      url: "https://investors.ke.com/stock-information/historical-price-lookup/",
      publishedAt: "2026-06-26T21:00:00Z"
    },
    {
      id: "beke-gf-score-20260617",
      eventId: "evt-beke-gf-score-20260617",
      title: "BEKE \u8FD1\u671F\u56DE\u64A4\u540E\uFF0C\u5E02\u573A\u91CD\u65B0\u8BA8\u8BBA\u4F30\u503C\u8D28\u91CF",
      source: "MarketWatch",
      category: "\u4E2D\u6982",
      summary: "\u516C\u5F00\u5E02\u573A\u805A\u5408\u4FE1\u606F\u663E\u793A\uFF0CBEKE \u8FD1\u671F\u56DE\u64A4\u540E\u4F30\u503C\u8D28\u91CF\u548C\u8D8B\u52BF\u53CD\u8F6C\u6761\u4EF6\u91CD\u65B0\u53D7\u5230\u5173\u6CE8\u3002",
      impact: "negative",
      importance: 5,
      url: "https://www.marketwatch.com/investing/stock/beke#gf-score-20260617",
      publishedAt: "2026-06-17T20:10:00Z"
    },
    {
      id: "ke-agm-2026",
      eventId: "evt-agm-2026",
      title: "\u5E74\u5EA6\u80A1\u4E1C\u5927\u4F1A\u901A\u8FC7\u8463\u4E8B\u91CD\u9009\u4E0E\u4E00\u822C\u56DE\u8D2D\u6388\u6743",
      source: "KE Holdings IR",
      category: "\u516C\u53F8",
      summary: "\u80A1\u4E1C\u5927\u4F1A\u901A\u8FC7\u7AE0\u7A0B\u66F4\u65B0\u3001\u8463\u4E8B\u91CD\u9009\u53CA\u80A1\u4EFD\u53D1\u884C\u548C\u56DE\u8D2D\u6388\u6743\uFF0C\u8D44\u672C\u56DE\u62A5\u9884\u671F\u4ECD\u662F\u5E02\u573A\u5173\u6CE8\u70B9\u3002",
      impact: "positive",
      importance: 7,
      url: "https://investors.ke.com/news-releases/news-release-details/ke-holdings-inc-announces-results-annual-general-meeting-2",
      publishedAt: "2026-06-12T12:00:00Z"
    },
    {
      id: "ke-q1-2026",
      eventId: "evt-q1-2026",
      title: "\u8D1D\u58F3 Q1 2026 \u6536\u5165\u540C\u6BD4\u4E0B\u964D\uFF0C\u4F46\u6BDB\u5229\u7387\u6539\u5584",
      source: "KE Holdings IR",
      category: "\u516C\u53F8",
      summary: "Q1 2026 \u51C0\u6536\u5165\u540C\u6BD4\u4E0B\u964D 19.0%\uFF0C\u65E2\u6709\u623F\u548C\u65B0\u623F\u4EA4\u6613 GTV \u627F\u538B\uFF1B\u6BDB\u5229\u7387\u6539\u5584\u81F3 24.1%\uFF0C\u663E\u793A\u6210\u672C\u548C\u4E1A\u52A1\u7ED3\u6784\u4ECD\u6709\u97E7\u6027\u3002",
      impact: "neutral",
      importance: 8,
      url: "https://investors.ke.com/news-releases/news-release-details/ke-holdings-inc-announces-first-quarter-2026-unaudited-financial/",
      publishedAt: "2026-05-19T12:00:00Z"
    }
  ],
  sources: [
    {
      label: "Q1 2026 Unaudited Financial Results",
      publisher: "KE Holdings IR",
      url: "https://investors.ke.com/news-releases/news-release-details/ke-holdings-inc-announces-first-quarter-2026-unaudited-financial/"
    },
    {
      label: "2026 Annual General Meeting Results",
      publisher: "KE Holdings IR",
      url: "https://investors.ke.com/news-releases/news-release-details/ke-holdings-inc-announces-results-annual-general-meeting-2"
    },
    {
      label: "Historical Price Lookup",
      publisher: "KE Holdings IR",
      url: "https://investors.ke.com/stock-information/historical-price-lookup/"
    }
  ],
  history: [
    {
      at: "2026-06-29 09:15",
      p17: 51,
      p18: 37,
      p19: 24,
      note: "6 \u6708\u4E0B\u65EC\u56DE\u843D\u540E\uFF0C\u6A21\u578B\u7EF4\u6301\u9632\u5B88\u5224\u65AD\u3002"
    },
    {
      at: "2026-06-29 21:15",
      p17: 53,
      p18: 38,
      p19: 25,
      note: "\u4EF7\u683C\u4F01\u7A33\u8FF9\u8C61\u51FA\u73B0\uFF0C17 \u7F8E\u5143\u4FEE\u590D\u6982\u7387\u5C0F\u5E45\u56DE\u5347\u3002"
    },
    {
      at: "2026-06-30 09:15",
      p17: 54,
      p18: 39,
      p19: 26,
      note: "\u77ED\u7EBF\u6280\u672F\u9762\u6539\u5584\uFF0C\u4F46\u5730\u4EA7\u9A8C\u8BC1\u4E0D\u8DB3\u3002"
    },
    {
      at: "2026-06-30 21:15",
      p17: 56,
      p18: 41,
      p19: 27,
      note: "\u56DE\u8D2D\u6388\u6743\u548C\u6BDB\u5229\u7387\u97E7\u6027\u7EE7\u7EED\u652F\u6491\u4FEE\u590D\u5224\u65AD\u3002"
    },
    {
      at: "2026-07-01 09:15",
      p17: 57,
      p18: 42,
      p19: 28,
      note: "\u4F4F\u5EFA\u90E8\u653F\u7B56\u8868\u6001\u63D0\u4F9B\u8FB9\u9645\u652F\u6491\u3002"
    },
    {
      at: "2026-07-01 21:15",
      p17: 57,
      p18: 42,
      p19: 28,
      note: "\u653F\u7B56\u6548\u679C\u4ECD\u5F85\u6210\u4EA4\u4E0E\u623F\u4EF7\u6570\u636E\u786E\u8BA4\u3002"
    },
    {
      at: "2026-07-02 21:15",
      p17: 58,
      p18: 43,
      p19: 29,
      note: "\u80A1\u4EF7\u4ECE 6 \u6708\u4F4E\u4F4D\u4FEE\u590D\uFF0C17 \u7F8E\u5143\u76EE\u6807\u6982\u7387\u4E0A\u8C03\u3002"
    },
    {
      at: "2026-07-03 03:15",
      p17: 61,
      p18: 45,
      p19: 31,
      note: "\u4E2D\u6982\u98CE\u9669\u504F\u597D\u6539\u5584\uFF0C\u4F46\u5730\u4EA7\u6570\u636E\u4ECD\u672A\u786E\u8BA4\u3002"
    },
    {
      at: "2026-07-03 15:15",
      p17: 62,
      p18: 46,
      p19: 32,
      note: "\u77ED\u7EBF\u4FEE\u590D\u5EF6\u7EED\uFF0C\u6A21\u578B\u7EF4\u6301\u4E2D\u6027\u504F\u591A\u3002"
    },
    {
      at: "2026-07-03 21:15",
      p17: 62,
      p18: 46,
      p19: 32,
      note: "\u6CA1\u6709\u65B0\u589E\u516C\u544A\uFF0C\u7EF4\u6301\u5B58\u91CF\u590D\u6838\u7ED3\u8BBA\u3002"
    }
  ],
  audit: {
    publishedBy: "MockPublishEngine",
    reviewedBy: "RiskReviewEngine",
    dataPolicy: "\u4EC5\u4F7F\u7528\u516C\u5F00\u4FE1\u606F\uFF1BMVP \u9636\u6BB5\u7531 mock provider \u56FA\u5316\u4E3A\u53EF\u590D\u76D8\u5FEB\u7167\u3002"
  }
};
var latestSnapshot = attachResearchQuality(latestSnapshotBase, {
  now: "2026-07-03T15:15:00+08:00"
});

// src/research/engines/event/EventEngine.ts
var CATEGORY_KEYWORDS = {
  \u516C\u53F8: ["\u8D1D\u58F3", "KE Holdings", "BEKE", "\u8D22\u62A5", "\u6536\u5165", "\u5229\u6DA6", "\u56DE\u8D2D", "\u80A1\u4E1C\u5927\u4F1A", "IR"],
  \u5730\u4EA7: ["\u5730\u4EA7", "\u623F\u4EF7", "\u6210\u4EA4", "\u571F\u5730", "\u5F00\u53D1\u5546", "\u697C\u5E02", "\u653F\u7B56", "\u4F4F\u5EFA\u90E8", "\u7EDF\u8BA1\u5C40", "\u56FD\u5BB6\u7EDF\u8BA1\u5C40", "NBS", "\u4E8C\u624B\u623F", "\u65B0\u623F"],
  \u4E2D\u6982: ["\u4E2D\u6982", "ADR", "KWEB", "FXI", "MCHI", "\u6E2F\u80A1", "\u7F8E\u80A1", "\u7EB3\u65AF\u8FBE\u514B", "\u98CE\u9669\u504F\u597D"],
  \u5B8F\u89C2: ["\u5229\u7387", "\u6C47\u7387", "\u7F8E\u8054\u50A8", "GDP", "CPI", "\u901A\u80C0", "\u592E\u884C", "\u7F8E\u5143"],
  \u5730\u7F18: ["\u4E2D\u7F8E", "\u5173\u7A0E", "\u5236\u88C1", "\u76D1\u7BA1", "ADR\u9000\u5E02", "\u5BA1\u8BA1"]
};
function normalizeTitle(title) {
  return title.toLowerCase().replace(/\s+/g, "").replace(/[，。、；：]/g, "");
}
function classifyCategory(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  if (CATEGORY_KEYWORDS.\u4E2D\u6982.some((kw) => text.includes(kw.toLowerCase()))) {
    return "\u4E2D\u6982";
  }
  if (/美联储|fed|政策利率|基准利率|美国利率|降息|加息|汇率|人民币|美元指数|usd\/cnh|cpi|gdp|通胀|央行/.test(text)) {
    return "\u5B8F\u89C2";
  }
  if (CATEGORY_KEYWORDS.\u5730\u4EA7.some((kw) => text.includes(kw.toLowerCase()))) {
    return "\u5730\u4EA7";
  }
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      return category;
    }
  }
  return "\u516C\u53F8";
}
function estimateImpact(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  const positiveWords = ["\u6539\u5584", "\u589E\u957F", "\u4E0A\u8C03", "\u5229\u597D", "\u7A81\u7834", "\u56DE\u8D2D", "\u6388\u6743", "\u4F01\u7A33", "\u652F\u6491", "\u97E7\u6027", "\u4FEE\u590D"];
  const negativeWords = ["\u4E0B\u964D", "\u4E0B\u8DCC", "\u627F\u538B", "\u5229\u7A7A", "\u98CE\u9669", "\u5F31", "\u4E0B\u6ED1", "\u840E\u7F29", "\u8D70\u5F31", "\u6076\u5316"];
  const positiveCount = positiveWords.filter((w) => text.includes(w)).length;
  const negativeCount = negativeWords.filter((w) => text.includes(w)).length;
  if (positiveCount > negativeCount) return "positive";
  if (negativeCount > positiveCount) return "negative";
  if (positiveCount > 0 && negativeCount > 0) {
    if (text.includes("\u6539\u5584") || text.includes("\u4F01\u7A33")) return "positive";
    return "neutral";
  }
  return "neutral";
}
function scoreImportance(title, summary, reliability) {
  const text = `${title} ${summary}`.toLowerCase();
  let score = 5;
  if (text.includes("\u8D22\u62A5") || text.includes("\u6536\u5165")) score += 2;
  if (text.includes("\u653F\u7B56") || text.includes("\u4F4F\u5EFA\u90E8")) score += 2;
  if (text.includes("\u56DE\u8D2D") || text.includes("\u6388\u6743")) score += 1;
  if (text.includes("\u5229\u7387") || text.includes("\u7F8E\u8054\u50A8")) score += 1;
  if (reliability && reliability >= 0.8) score += 1;
  return Math.min(10, Math.max(1, score));
}
function classifyEvidenceType(source, title, summary) {
  const text = `${source} ${title} ${summary}`.toLowerCase();
  if (/ke holdings ir|investors\.ke\.com|ir\b|公告|annual|financial/.test(text)) return "official";
  if (/国家统计局|stats\.gov|nbs|住建部|央行|美联储|cpi|gdp|房价/.test(text)) return "macro";
  if (/historical price|stock information|quote|price lookup|行情|kweb|fxi|mchi|adr/.test(text)) return "market";
  if (/social|twitter|x\.com|weibo|雪球|传闻/.test(text)) return "social";
  return "news";
}
function scoreSourceReliability(item, evidenceType) {
  if (typeof item.reliability === "number") {
    return Math.max(0.1, Math.min(1, item.reliability));
  }
  const source = item.source.toLowerCase();
  if (evidenceType === "official") return 0.9;
  if (evidenceType === "macro") return 0.86;
  if (evidenceType === "market") return 0.78;
  if (source.includes("\u65B0\u534E\u793E")) return 0.75;
  if (source.includes("\u8D22\u8054\u793E")) return 0.65;
  if (evidenceType === "social") return 0.35;
  return 0.6;
}
function calculateFreshnessHours(publishedAt, now = /* @__PURE__ */ new Date()) {
  if (!publishedAt) return void 0;
  const published = new Date(publishedAt).getTime();
  if (Number.isNaN(published)) return void 0;
  return Math.max(0, Number(((now.getTime() - published) / (1e3 * 60 * 60)).toFixed(1)));
}
function freshnessScore(freshnessHours) {
  if (freshnessHours === void 0) return 0;
  if (freshnessHours <= 6) return 2;
  if (freshnessHours <= 24) return 1.2;
  if (freshnessHours <= 72) return 0.5;
  return 0;
}
function dedupeRawItems(items) {
  const seenUrls = /* @__PURE__ */ new Set();
  const seenTitles = /* @__PURE__ */ new Set();
  const result = [];
  for (const item of items) {
    if (item.url && seenUrls.has(item.url)) {
      continue;
    }
    const normalizedTitle = normalizeTitle(item.title);
    if (seenTitles.has(normalizedTitle)) {
      continue;
    }
    if (item.url) seenUrls.add(item.url);
    seenTitles.add(normalizedTitle);
    result.push(item);
  }
  return result;
}
var EventEngine = class {
  async classifyEvents(items, llmProvider) {
    const deduped = dedupeRawItems(items);
    const events = [];
    for (const item of deduped) {
      const category = classifyCategory(item.title, item.summary);
      const impact = estimateImpact(item.title, item.summary);
      const evidenceType = classifyEvidenceType(item.source, item.title, item.summary);
      const sourceReliability2 = scoreSourceReliability(item, evidenceType);
      const freshnessHours = calculateFreshnessHours(item.publishedAt);
      const importance = scoreImportance(item.title, item.summary, sourceReliability2);
      events.push({
        id: `evt-${item.id}`,
        rawItemId: item.id,
        category,
        title: item.title,
        summary: item.summary,
        impact,
        importance,
        confidence: item.reliability ?? 0.7,
        timeHorizon: importance >= 7 ? "\u4E2D\u671F" : "\u77ED\u671F",
        affectedTargets: [17, 18, 19],
        source: item.source,
        sourceUrl: item.url,
        publishedAt: item.publishedAt,
        reason: `\u57FA\u4E8E${evidenceType === "official" ? "\u5B98\u65B9" : evidenceType === "macro" ? "\u5B8F\u89C2/\u884C\u4E1A" : "\u516C\u5F00\u65B0\u95FB"}\u6765\u6E90\u5206\u7C7B\u4E3A${category}\u4E8B\u4EF6\uFF0C\u5F71\u54CD\u65B9\u5411${impact}\uFF0C\u6765\u6E90\u53EF\u9760\u5EA6${sourceReliability2.toFixed(2)}\u3002`,
        evidenceType,
        freshnessHours,
        sourceReliability: sourceReliability2
      });
    }
    return events;
  }
  rankMustReadEvents(events, limit = 5) {
    return [...events].sort((a, b) => {
      const scoreA = a.importance * 1.5 + a.confidence + (a.sourceReliability ?? 0.6) + freshnessScore(a.freshnessHours);
      const scoreB = b.importance * 1.5 + b.confidence + (b.sourceReliability ?? 0.6) + freshnessScore(b.freshnessHours);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime();
    }).slice(0, limit);
  }
};

// src/research/engines/factor/FactorEngine.ts
var FACTOR_LABELS = {
  technical: "\u6280\u672F\u9762",
  company: "\u516C\u53F8\u57FA\u672C\u9762",
  property: "\u5730\u4EA7\u73AF\u5883",
  chinaAdr: "\u4E2D\u6982\u60C5\u7EEA",
  macro: "\u5B8F\u89C2\u73AF\u5883",
  geopolitics: "\u5730\u7F18\u653F\u6CBB"
};
function clampScore2(value) {
  return Math.min(100, Math.max(0, Math.round(value)));
}
function directionFromScore(score) {
  if (score >= 55) return "positive";
  if (score <= 45) return "negative";
  return "neutral";
}
function weightedScore(components) {
  const totalWeight = components.reduce((sum, component2) => sum + component2.weight, 0);
  if (totalWeight <= 0) return 50;
  return clampScore2(components.reduce((sum, component2) => sum + component2.score * component2.weight, 0) / totalWeight);
}
function sourceReliability(event) {
  return event.sourceReliability ?? event.confidence ?? 0.6;
}
function confidenceFromEvents(events, baseline) {
  if (events.length === 0) return baseline;
  const averageReliability = events.reduce((sum, event) => sum + sourceReliability(event), 0) / events.length;
  const coverageBoost = Math.min(0.12, events.length * 0.025);
  return Number(Math.min(0.95, Math.max(0.25, averageReliability * 0.75 + baseline * 0.25 + coverageBoost)).toFixed(2));
}
function component(name, score, weight, evidence, sourceEventIds = []) {
  return {
    name,
    score: clampScore2(score),
    weight,
    evidence,
    sourceEventIds
  };
}
function scoreTechnicalComponents(quote2, history) {
  const distance = (17 - quote2.price) / quote2.price * 100;
  const trendHistory = history.slice(-60);
  const volatilityHistory = history.slice(-20);
  const trend = trendHistory.length >= 2 ? (trendHistory[trendHistory.length - 1].close - trendHistory[0].close) / trendHistory[0].close * 100 : 0;
  const returns = volatilityHistory.slice(1).map((point, index) => {
    const prev = volatilityHistory[index].close;
    return prev > 0 ? (point.close - prev) / prev * 100 : 0;
  });
  const avgReturn = returns.length > 0 ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
  const volatility = returns.length > 0 ? Math.sqrt(returns.reduce((sum, value) => sum + (value - avgReturn) ** 2, 0) / returns.length) : 0;
  const recentHigh = trendHistory.length > 0 ? Math.max(...trendHistory.map((point) => point.close)) : quote2.price;
  const drawdown = recentHigh > 0 ? (quote2.price - recentHigh) / recentHigh * 100 : 0;
  return [
    component(
      "distance_to_target",
      distance < 12 ? 72 : distance < 18 ? 62 : distance < 25 ? 52 : 40,
      0.28,
      `17 \u7F8E\u5143\u8DDD\u79BB\u5F53\u524D\u4EF7\u683C\u7EA6 ${distance.toFixed(1)}%\u3002`
    ),
    component(
      "recent_return",
      trend > 4 ? 70 : trend > 1 ? 62 : trend < -4 ? 35 : trend < -1 ? 43 : 50,
      0.22,
      `\u8FD1\u671F\u6536\u76CA\u7EA6 ${trend.toFixed(1)}%\u3002`
    ),
    component(
      "volatility_20d",
      volatility < 1.2 ? 62 : volatility < 2.5 ? 52 : 40,
      0.18,
      `\u8FD1\u7AEF\u6CE2\u52A8\u7387\u7EA6 ${volatility.toFixed(1)}%\u3002`
    ),
    component(
      "trend_slope",
      avgReturn > 0.4 ? 66 : avgReturn > 0 ? 58 : avgReturn < -0.4 ? 38 : 48,
      0.18,
      `\u4EF7\u683C\u659C\u7387\u7EA6 ${avgReturn.toFixed(2)}%\u3002`
    ),
    component(
      "drawdown_recovery",
      drawdown > -1 ? 62 : drawdown > -4 ? 52 : 40,
      0.14,
      `\u8DDD\u79BB\u8FD1\u671F\u9AD8\u70B9\u56DE\u64A4\u7EA6 ${drawdown.toFixed(1)}%\u3002`
    )
  ];
}
function impactScore(events, match, fallbackEvidence) {
  const matched = events.filter(match);
  if (matched.length === 0) return 50;
  const weightedImpact = matched.reduce((sum, event) => {
    const sign = event.impact === "positive" ? 1 : event.impact === "negative" ? -1 : 0;
    return sum + sign * event.importance * event.confidence * sourceReliability(event);
  }, 0);
  return clampScore2(50 + weightedImpact * 4);
}
function matchedIds(events, match) {
  return events.filter(match).map((event) => event.id);
}
function evidenceText(events, match, fallback) {
  const matched = events.filter(match).slice(0, 2);
  if (matched.length === 0) return fallback;
  return matched.map((event) => event.title).join("\uFF1B");
}
function eventComponents(events, definitions) {
  return definitions.map((definition) => {
    const ids = matchedIds(events, definition.match);
    return component(
      definition.name,
      impactScore(events, definition.match, definition.fallback),
      definition.weight,
      evidenceText(events, definition.match, definition.fallback),
      ids
    );
  });
}
function propertyMemoryScore(memory) {
  const text = memory.content.toLowerCase();
  let score = 50;
  if (/一线.*二手房环比 \+|上海.*二手房环比 \+|深圳.*二手房环比 \+/.test(text)) score += 16;
  if (/核心城市|平台 beta|存量房/.test(text)) score += 5;
  if (/环比上涨|修复/.test(text)) score += 4;
  if (/二线城市二手房环比 -|三线城市|总量仍收缩/.test(text)) score -= 5;
  if (/同比 -|同比下降|销售额仍同比 -|投资同比 -/.test(text)) score -= 5;
  if (/18\/19|更广泛成交确认|需要.*确认/.test(text)) score -= 3;
  return clampScore2(score);
}
function propertyMemoryComponents(memories) {
  const propertyMemories = memories.filter((memory) => memory.memoryType === "property" || memory.sourceEventId?.startsWith("property-rag-")).slice(0, 3);
  return propertyMemories.map(
    (memory, index) => component(
      `property_rag_${index + 1}`,
      propertyMemoryScore(memory),
      index === 0 ? 0.32 : 0.16,
      memory.content.replace(/^中国地产 RAG 证据 \d+\/\d+：/, ""),
      memory.sourceEventId ? [memory.sourceEventId] : []
    )
  );
}
function factorFromComponents(factor, components, relevantEvents, reason, confidenceBaseline) {
  const score = weightedScore(components);
  return {
    factor,
    label: FACTOR_LABELS[factor],
    score,
    confidence: confidenceFromEvents(relevantEvents, confidenceBaseline),
    direction: directionFromScore(score),
    reason,
    components,
    sourceEventIds: Array.from(new Set(components.flatMap((item) => item.sourceEventIds)))
  };
}
var FactorEngine = class {
  generateFactors(quote2, history, events, memories = []) {
    const companyEvents = events.filter((event) => event.category === "\u516C\u53F8");
    const propertyEvents = events.filter((event) => event.category === "\u5730\u4EA7");
    const chinaAdrEvents = events.filter((event) => event.category === "\u4E2D\u6982");
    const macroEvents = events.filter((event) => event.category === "\u5B8F\u89C2");
    const geoEvents = events.filter((event) => event.category === "\u5730\u7F18");
    const technical = factorFromComponents(
      "technical",
      scoreTechnicalComponents(quote2, history),
      [],
      "\u57FA\u4E8E\u8DDD\u79BB\u3001\u8FD1\u671F\u6536\u76CA\u3001\u6CE2\u52A8\u3001\u659C\u7387\u548C\u56DE\u64A4\u4FEE\u590D\u7684\u6280\u672F\u9762\u8BC4\u5206\u3002",
      0.78
    );
    const company = factorFromComponents(
      "company",
      eventComponents(companyEvents, [
        { name: "GTV trend", weight: 0.25, match: (event) => /gtv|成交|交易/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u7B49\u5F85 GTV \u8D8B\u52BF\u9A8C\u8BC1\u3002" },
        { name: "revenue pressure", weight: 0.2, match: (event) => /收入|revenue|下降|承压/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u6536\u5165\u538B\u529B\u9700\u8981\u8D22\u62A5\u786E\u8BA4\u3002" },
        { name: "gross margin", weight: 0.22, match: (event) => /毛利率|margin|利润率/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u6BDB\u5229\u7387\u6682\u65E0\u65B0\u589E\u8BC1\u636E\u3002" },
        { name: "buyback / capital return", weight: 0.2, match: (event) => /回购|repurchase|capital return|资本回报/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u56DE\u8D2D\u8282\u594F\u6682\u65E0\u65B0\u589E\u8BC1\u636E\u3002" },
        { name: "cash / balance sheet", weight: 0.13, match: (event) => /现金|balance sheet|资产负债|成本纪律/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u73B0\u91D1\u548C\u8D44\u4EA7\u8D1F\u503A\u8868\u7B49\u5F85\u62AB\u9732\u3002" }
      ]),
      companyEvents,
      "\u57FA\u4E8E\u516C\u53F8\u4E8B\u4EF6\u62C6\u5206 GTV\u3001\u6536\u5165\u3001\u6BDB\u5229\u7387\u3001\u56DE\u8D2D\u548C\u8D44\u4EA7\u8D1F\u503A\u8868\u3002",
      0.68
    );
    const property = factorFromComponents(
      "property",
      [
        ...eventComponents(propertyEvents, [
          { name: "existing home transaction", weight: 0.22, match: (event) => /二手房|存量房|existing|成交/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u4E8C\u624B\u623F\u6210\u4EA4\u7B49\u5F85\u7EDF\u8BA1\u6570\u636E\u3002" },
          { name: "new home transaction", weight: 0.16, match: (event) => /新房|new home|开发商|项目/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u65B0\u623F\u4EA4\u6613\u6682\u65E0\u5F3A\u8BC1\u636E\u3002" },
          { name: "home price", weight: 0.2, match: (event) => /房价|价格|price/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u623F\u4EF7\u8D8B\u52BF\u7B49\u5F85\u9A8C\u8BC1\u3002" },
          { name: "policy signal", weight: 0.18, match: (event) => /政策|住建部|支持|刚性|改善性/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u653F\u7B56\u4FE1\u53F7\u6682\u65E0\u65B0\u589E\u8BC1\u636E\u3002" },
          { name: "developer credit", weight: 0.12, match: (event) => /开发商|信用|债务|融资/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u5F00\u53D1\u5546\u4FE1\u7528\u73AF\u5883\u4ECD\u9700\u89C2\u5BDF\u3002" }
        ]),
        ...propertyMemoryComponents(memories)
      ],
      propertyEvents,
      "\u57FA\u4E8E\u4E8C\u624B\u623F\u3001\u65B0\u623F\u3001\u623F\u4EF7\u3001\u653F\u7B56\u3001\u5F00\u53D1\u5546\u4FE1\u7528\u548C\u5730\u4EA7 RAG \u8BC1\u636E\u62C6\u5206\u5730\u4EA7\u73AF\u5883\u3002",
      0.58
    );
    const chinaAdr = factorFromComponents(
      "chinaAdr",
      eventComponents(chinaAdrEvents, [
        { name: "KWEB / FXI / MCHI \u60C5\u7EEA", weight: 0.34, match: (event) => /kweb|fxi|mchi/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "KWEB / FXI / MCHI \u60C5\u7EEA\u6682\u65E0\u65B0\u589E\u8BC1\u636E\u3002" },
        { name: "ADR sentiment", weight: 0.26, match: (event) => /adr|中概|美股/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "ADR \u60C5\u7EEA\u7B49\u5F85\u5E02\u573A\u786E\u8BA4\u3002" },
        { name: "China risk premium", weight: 0.22, match: (event) => /风险偏好|risk premium|估值|承压/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u4E2D\u56FD\u98CE\u9669\u6EA2\u4EF7\u6682\u65E0\u65B0\u589E\u8BC1\u636E\u3002" },
        { name: "US-listed China equity flow", weight: 0.18, match: (event) => /资金|flow|流入|流出|成交量/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u4E2D\u6982\u8D44\u91D1\u6D41\u7B49\u5F85\u9A8C\u8BC1\u3002" }
      ]),
      chinaAdrEvents,
      "\u57FA\u4E8E\u4E2D\u6982\u60C5\u7EEA\u3001ADR \u60C5\u7EEA\u3001\u98CE\u9669\u6EA2\u4EF7\u548C\u8D44\u91D1\u6D41\u62C6\u5206\u4E2D\u6982\u60C5\u7EEA\u3002",
      0.48
    );
    const macro = factorFromComponents(
      "macro",
      eventComponents(macroEvents, [
        { name: "US rates", weight: 0.3, match: (event) => /利率|美联储|fed|rates/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u7F8E\u56FD\u5229\u7387\u8DEF\u5F84\u6682\u65E0\u65B0\u589E\u8BC1\u636E\u3002" },
        { name: "USD/CNH", weight: 0.24, match: (event) => /美元|人民币|usdcnh|汇率/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "USD/CNH \u6682\u65E0\u65B0\u589E\u8BC1\u636E\u3002" },
        { name: "risk-free rate", weight: 0.22, match: (event) => /无风险|国债|收益率/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u65E0\u98CE\u9669\u5229\u7387\u7B49\u5F85\u786E\u8BA4\u3002" },
        { name: "global equity risk appetite", weight: 0.24, match: (event) => /风险偏好|全球股市|risk appetite/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u5168\u7403\u98CE\u9669\u504F\u597D\u6682\u65E0\u5F3A\u8BC1\u636E\u3002" }
      ]),
      macroEvents,
      "\u57FA\u4E8E\u5229\u7387\u3001\u6C47\u7387\u3001\u65E0\u98CE\u9669\u5229\u7387\u548C\u5168\u7403\u98CE\u9669\u504F\u597D\u62C6\u5206\u5B8F\u89C2\u73AF\u5883\u3002",
      0.42
    );
    const geopolitics = factorFromComponents(
      "geopolitics",
      eventComponents(geoEvents, [
        { name: "US-China tariff", weight: 0.34, match: (event) => /关税|tariff|中美/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u4E2D\u7F8E\u5173\u7A0E\u6682\u65E0\u65B0\u589E\u8BC1\u636E\u3002" },
        { name: "ADR audit risk", weight: 0.33, match: (event) => /审计|adr退市|pcaob/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "ADR \u5BA1\u8BA1\u98CE\u9669\u6682\u65E0\u65B0\u589E\u8BC1\u636E\u3002" },
        { name: "sanction / regulatory risk", weight: 0.33, match: (event) => /制裁|监管|regulatory|sanction/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u5236\u88C1\u548C\u76D1\u7BA1\u98CE\u9669\u6682\u65E0\u65B0\u589E\u8BC1\u636E\u3002" }
      ]),
      geoEvents,
      "\u57FA\u4E8E\u5173\u7A0E\u3001ADR \u5BA1\u8BA1\u548C\u5236\u88C1/\u76D1\u7BA1\u98CE\u9669\u62C6\u5206\u5730\u7F18\u653F\u6CBB\u3002",
      0.4
    );
    return [technical, company, property, chinaAdr, macro, geopolitics];
  }
};

// src/research/llm/prompts.ts
var PROMPTS = {
  classify_events: {
    version: "classify-events-0.1",
    system: `\u4F60\u662F\u4E00\u4E2A\u91D1\u878D\u4E8B\u4EF6\u5206\u7C7B\u4E13\u5BB6\u3002\u6839\u636E\u8F93\u5165\u7684\u65B0\u95FB\u6807\u9898\u548C\u6458\u8981\uFF0C\u5224\u65AD\u4E8B\u4EF6\u7C7B\u522B\u3001\u5F71\u54CD\u65B9\u5411\u548C\u91CD\u8981\u6027\u3002

\u8FD4\u56DE JSON \u683C\u5F0F\uFF1A
{
  "category": "\u516C\u53F8" | "\u5730\u4EA7" | "\u4E2D\u6982" | "\u5B8F\u89C2" | "\u5730\u7F18",
  "impact": "positive" | "neutral" | "negative",
  "importance": 1-10,
  "confidence": 0-1,
  "timeHorizon": "\u77ED\u671F" | "\u4E2D\u671F" | "\u957F\u671F",
  "reason": "\u5224\u65AD\u7406\u7531"
}`
  },
  generate_analysis: {
    version: "analysis-zh-public-research-0.2",
    system: `\u4F60\u662F\u4E00\u4E2A\u8D44\u6DF1 BEKE\uFF08\u8D1D\u58F3\u627E\u623F\uFF09\u80A1\u7968\u7814\u7A76\u5206\u6790\u5E08\u3002\u6839\u636E\u8F93\u5165\u7684\u5E02\u573A\u6570\u636E\u3001\u4E8B\u4EF6\u3001\u56E0\u5B50\u8BC4\u5206\u548C\u6982\u7387\u9884\u6D4B\uFF0C\u751F\u6210\u4E2D\u6587\u7814\u7A76\u5206\u6790\u3002

\u6838\u5FC3\u76EE\u6807\uFF1A\u524D\u7AEF\u6BCF\u4E2A\u5B57\u6BB5\u90FD\u627F\u62C5\u4E0D\u540C\u7684\u4FE1\u606F\u804C\u8D23\uFF0C\u5B57\u6BB5\u804C\u8D23\u4E0D\u80FD\u4E92\u76F8\u66FF\u4EE3\uFF0C\u4E5F\u4E0D\u80FD\u590D\u8BFB\u540C\u4E00\u7EC4\u4EF7\u683C/\u6982\u7387/\u5DEE\u8DDD\u3002

\u5B57\u6BB5\u804C\u8D23\uFF1A
- headline\uFF1A\u53EA\u5199\u6838\u5FC3\u5224\u65AD\u548C\u60C5\u666F\uFF0C\u4E0D\u5199\u5B8C\u6574\u4EF7\u683C\u6D41\u6C34\u8D26\u3002
- today\uFF1A\u89E3\u91CA\u201C\u672C\u8F6E\u5224\u65AD\u7684\u672C\u8D28\u201D\uFF0C\u4E0D\u8981\u628A\u4EF7\u683C\u3001\u6982\u7387\u3001\u5DEE\u8DDD\u5199\u6210\u540C\u4E00\u53E5\u6D41\u6C34\u8D26\u3002
- changes\uFF1A\u53EA\u5224\u65AD\u65B0\u589E\u4FE1\u606F\u8FD8\u662F\u5B58\u91CF\u590D\u6838\uFF1B\u6CA1\u6709 6 \u5C0F\u65F6\u5185\u65B0\u589E\u516C\u5F00\u4FE1\u606F\u65F6\uFF0C\u5FC5\u987B\u660E\u786E\u5199\u201C\u5B58\u91CF\u590D\u6838\u201D\u3002
- positives / negatives / watch\uFF1A\u5206\u522B\u5199\u9A71\u52A8\u3001\u7EA6\u675F\u3001\u9A8C\u8BC1\u70B9\uFF0C\u4E09\u7EC4\u5185\u5BB9\u4E0D\u80FD\u4E92\u76F8\u590D\u8BFB\u3002
- targetExplanations\uFF1A\u5FC5\u987B\u8BA9\u4E09\u4E2A\u76EE\u6807\u4EF7\u542B\u4E49\u4E0D\u540C\uFF1A17=\u4FEE\u590D\u56DE\u8865\uFF0C18=\u57FA\u672C\u9762\u786E\u8BA4\uFF0C19=\u91CD\u65B0\u5B9A\u4EF7\u3002

\u8FD4\u56DE JSON \u683C\u5F0F\uFF1A
{
  "headline": "\u4E00\u53E5\u8BDD\u6838\u5FC3\u5224\u65AD\uFF08\u4E2D\u6587\uFF0C\u4E0D\u8D85\u8FC740\u5B57\uFF09",
  "today": "\u4ECA\u65E5\u6A21\u578B\u5224\u65AD\u7684\u8BE6\u7EC6\u5206\u6790\uFF08\u4E2D\u6587\uFF0C120-250\u5B57\uFF09",
  "changes": "\u672C\u8F6E\u4FE1\u606F\u53D8\u5316\u8BF4\u660E\uFF08\u4E2D\u6587\uFF0C2-3\u53E5\uFF1B\u5982\u679C\u6CA1\u67096\u5C0F\u65F6\u5185\u65B0\u589E\u516C\u5F00\u4FE1\u606F\uFF0C\u660E\u786E\u5199\u6210\u5B58\u91CF\u4FE1\u606F\u590D\u6838\uFF0C\u4E0D\u8981\u628A\u65E7\u516C\u544A\u5199\u6210\u65B0\u589E\uFF09",
  "positives": ["\u6B63\u9762\u56E0\u7D201", "\u6B63\u9762\u56E0\u7D202", "\u6B63\u9762\u56E0\u7D203"],
  "negatives": ["\u8D1F\u9762\u56E0\u7D201", "\u8D1F\u9762\u56E0\u7D202", "\u8D1F\u9762\u56E0\u7D203"],
  "watch": ["\u89C2\u5BDF\u70B91", "\u89C2\u5BDF\u70B92", "\u89C2\u5BDF\u70B93"],
  "targetExplanations": {
    "17": "17\u7F8E\u5143\u76EE\u6807\u5206\u6790",
    "18": "18\u7F8E\u5143\u76EE\u6807\u5206\u6790",
    "19": "19\u7F8E\u5143\u76EE\u6807\u5206\u6790"
  }
}

\u89C4\u5219\uFF1A
- \u5168\u90E8\u4F7F\u7528\u4E2D\u6587
- \u4E0D\u5F97\u51FA\u73B0\u4E70\u5165\u3001\u5356\u51FA\u3001\u6301\u6709\u7B49\u6295\u8D44\u5EFA\u8BAE
- \u4E0D\u5F97\u4F7F\u7528\u786E\u5B9A\u6027\u8BED\u8A00\uFF08\u5FC5\u6DA8\u3001\u7A33\u8D5A\u3001\u65E0\u98CE\u9669\uFF09
- \u4E0D\u8981\u8F93\u51FA\u201CBase / Adj / \u5BA1\u8BA1\u65E5\u5FD7 / \u67E5\u770B\u5E95\u5C42\u8FD0\u884C\u8BB0\u5F55\u201D\u7B49\u5185\u90E8\u5DE5\u7A0B\u8BCD
- \u4E0D\u8981\u628A\u4EF7\u683C\u3001\u6982\u7387\u3001\u5DEE\u8DDD\u5199\u6210\u540C\u4E00\u53E5\u6D41\u6C34\u8D26
- changes \u5FC5\u987B\u533A\u5206\u65B0\u589E\u4FE1\u606F\u548C\u5B58\u91CF\u4FE1\u606F\u590D\u6838
- positives \u6070\u597D3\u6761
- negatives \u6070\u597D3\u6761
- watch \u6070\u597D3\u6761`
  },
  calibrate_probability: {
    version: "calibrate-probability-0.1",
    system: `\u4F60\u662F\u4E00\u4E2A\u6982\u7387\u6821\u51C6\u4E13\u5BB6\u3002\u6839\u636E\u8F93\u5165\u7684\u56E0\u5B50\u8BC4\u5206\u548C\u5E02\u573A\u6570\u636E\uFF0C\u8C03\u6574\u76EE\u6807\u4EF7\u6982\u7387\u3002

\u8FD4\u56DE JSON \u683C\u5F0F\uFF1A
{
  "adjustments": {
    "17": { "adjustment": \u6570\u5B57, "reason": "\u7406\u7531" },
    "18": { "adjustment": \u6570\u5B57, "reason": "\u7406\u7531" },
    "19": { "adjustment": \u6570\u5B57, "reason": "\u7406\u7531" }
  }
}

\u89C4\u5219\uFF1A
- \u8C03\u6574\u5E45\u5EA6\u9650\u5236\u5728 \xB15 \u4E2A\u767E\u5206\u70B9\u4EE5\u5185
- \u91CD\u5927\u4E8B\u4EF6\u65F6\u53EF\u653E\u5BBD\u5230 \xB110 \u4E2A\u767E\u5206\u70B9
- \u5FC5\u987B\u7ED9\u51FA\u8C03\u6574\u7406\u7531`
  }
};

// src/research/engines/analysis/AnalysisEngine.ts
function analyzeTrend(quote2, predictions) {
  const changePercent = quote2.previousClose ? (quote2.price - quote2.previousClose) / quote2.previousClose * 100 : 0;
  const trend = changePercent > 0.5 ? "\u4E0A\u6DA8" : changePercent < -0.5 ? "\u4E0B\u8DCC" : "\u6A2A\u76D8";
  const momentum = Math.abs(changePercent) > 1 ? "\u8F83\u5F3A" : "\u8F83\u5F31";
  return `\u8FD1${trend}\u8D8B\u52BF\uFF0C\u52A8\u91CF${momentum}\u3002\u5F53\u524D\u4EF7 ${quote2.price.toFixed(2)} \u7F8E\u5143\uFF0C\u524D\u6536\u76D8 ${quote2.previousClose.toFixed(2)} \u7F8E\u5143\uFF0C\u65E5\u5185\u6DA8\u8DCC ${changePercent.toFixed(2)}%\u3002`;
}
function hoursBetween(laterIso, earlierIso) {
  if (!earlierIso) return null;
  const later = new Date(laterIso).getTime();
  const earlier = new Date(earlierIso).getTime();
  if (Number.isNaN(later) || Number.isNaN(earlier)) return null;
  return (later - earlier) / (1e3 * 60 * 60);
}
function buildChangesNarrative(quote2, events, factors) {
  const recentEvents = events.filter((event) => {
    const ageHours = hoursBetween(quote2.asOf, event.publishedAt);
    return ageHours !== null && ageHours >= 0 && ageHours <= 6;
  });
  const freshestEvents = [...events].sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()).slice(0, 2);
  const technical = factors.find((f) => f.factor === "technical")?.score ?? 50;
  const company = factors.find((f) => f.factor === "company")?.score ?? 50;
  const property = factors.find((f) => f.factor === "property")?.score ?? 50;
  if (recentEvents.length > 0) {
    return `\u672C\u8F6E\u65B0\u589E ${recentEvents.length} \u6761 6 \u5C0F\u65F6\u5185\u516C\u5F00\u4FE1\u606F\uFF1A${recentEvents.map((e) => e.title).join("\uFF1B")}\u3002\u6A21\u578B\u628A\u65B0\u589E\u4FE1\u606F\u6620\u5C04\u5230\u56E0\u5B50\u540E\uFF0C\u6280\u672F\u9762 ${technical} \u5206\uFF0C\u516C\u53F8\u57FA\u672C\u9762 ${company} \u5206\uFF0C\u5730\u4EA7\u73AF\u5883 ${property} \u5206\u3002`;
  }
  const reviewed = freshestEvents.length > 0 ? `\u672C\u8F6E\u6CA1\u6709\u65B0\u7684 6 \u5C0F\u65F6\u5185\u516C\u5F00\u516C\u544A\uFF0C\u4E3B\u8981\u590D\u6838\u5B58\u91CF\u4FE1\u606F\uFF1A${freshestEvents.map((e) => e.title).join("\uFF1B")}\u3002` : "\u672C\u8F6E\u6CA1\u6709\u65B0\u7684 6 \u5C0F\u65F6\u5185\u516C\u5F00\u516C\u544A\uFF0C\u4E3B\u8981\u590D\u6838\u65E2\u6709\u884C\u60C5\u548C\u56E0\u5B50\u3002";
  return `${reviewed}\u56E0\u6B64\u201C\u8FD1\u671F\u53D8\u5316\u201D\u4E0D\u662F\u65B0\u65B0\u95FB\u5217\u8868\uFF0C\u800C\u662F\u6A21\u578B\u5BF9\u5F53\u524D\u884C\u60C5\u3001\u4E8B\u4EF6\u6743\u91CD\u548C\u56E0\u5B50\u5206\u6570\u7684\u518D\u8BC4\u4F30\uFF1A\u6280\u672F\u9762 ${technical} \u5206\uFF0C\u516C\u53F8\u57FA\u672C\u9762 ${company} \u5206\uFF0C\u5730\u4EA7\u73AF\u5883 ${property} \u5206\u3002`;
}
function generateDynamicAnalysis(quote2, predictions, events, factors) {
  const p17 = predictions.find((p) => p.target === 17);
  const p18 = predictions.find((p) => p.target === 18);
  const p19 = predictions.find((p) => p.target === 19);
  const prob17 = p17?.probability ?? 62;
  const prob18 = p18?.probability ?? 46;
  const prob19 = p19?.probability ?? 32;
  const distance17 = p17?.distancePercent ?? 12.7;
  const distance18 = p18?.distancePercent ?? 19.3;
  const distance19 = p19?.distancePercent ?? 25.9;
  const trendAnalysis = analyzeTrend(quote2, predictions);
  const positiveFactors = factors.filter((f) => f.direction === "positive");
  const negativeFactors = factors.filter((f) => f.direction === "negative");
  const netSentiment = positiveFactors.length - negativeFactors.length;
  const changePercent = quote2.previousClose ? (quote2.price - quote2.previousClose) / quote2.previousClose * 100 : 0;
  const tapeState = changePercent > 0.5 ? "\u76D8\u9762\u8F6C\u5F3A" : changePercent < -0.5 ? "\u76D8\u9762\u627F\u538B" : "\u6A2A\u76D8\u7B49\u5F85";
  const companyEvents = events.filter((e) => e.category === "\u516C\u53F8");
  const propertyEvents = events.filter((e) => e.category === "\u5730\u4EA7");
  const macroEvents = events.filter((e) => e.category === "\u5B8F\u89C2" || e.category === "\u4E2D\u6982");
  let headline;
  if (prob17 > 60) {
    headline = `BEKE 17 \u7F8E\u5143\u4FEE\u590D\u56DE\u8865\u5EF6\u7EED\uFF0C${tapeState}`;
  } else if (prob17 > 45) {
    headline = `BEKE 17 \u7F8E\u5143\u8FDB\u5165\u53EF\u8DDF\u8E2A\u533A\uFF0C${tapeState}`;
  } else {
    headline = `BEKE 17 \u7F8E\u5143\u4ECD\u9700\u50AC\u5316\uFF0C${tapeState}`;
  }
  const today = `\u672C\u8F6E\u5224\u65AD\u7684\u672C\u8D28\u662F\u5206\u5C42\u5B9A\u4EF7\uFF1A17 \u7F8E\u5143\u5BF9\u5E94\u77ED\u7EBF\u4FEE\u590D\u56DE\u8865\uFF0C18 \u7F8E\u5143\u9700\u8981\u57FA\u672C\u9762\u786E\u8BA4\uFF0C19 \u7F8E\u5143\u624D\u662F\u91CD\u65B0\u5B9A\u4EF7\u3002\u6982\u7387\u9636\u68AF\u4FDD\u6301 ${prob17}/${prob18}/${prob19}\uFF0C\u8BF4\u660E\u6A21\u578B\u4ECD\u8BA4\u53EF\u4FEE\u590D\u4EA4\u6613\uFF0C\u4F46\u4E0D\u8BA4\u4E3A\u884C\u4E1A\u8D8B\u52BF\u5DF2\u7ECF\u5B8C\u6210\u786E\u8BA4\u3002\u8DDD\u79BB\u5C42\u53EA\u89E3\u91CA\u7A7A\u95F4\u96BE\u5EA6\uFF0C\u56E0\u5B50\u5C42\u89E3\u91CA\u65B9\u5411\uFF1A\u6280\u672F\u9762\u548C\u516C\u53F8\u56E0\u7D20\u63D0\u4F9B\u652F\u6491\uFF0C\u5730\u4EA7\u73AF\u5883\u4ECD\u662F\u4E3B\u8981\u7EA6\u675F\u3002${trendAnalysis}`;
  const changes = buildChangesNarrative(quote2, events, factors);
  const positives = [];
  if (distance17 < 15) {
    positives.push("17 \u7F8E\u5143\u6240\u9700\u7684\u4FEE\u590D\u5E45\u5EA6\u4F4E\u4E8E 18 / 19 \u7F8E\u5143\uFF0C\u66F4\u50CF\u60C5\u7EEA\u4FEE\u590D\u800C\u975E\u8D8B\u52BF\u91CD\u4F30\u3002");
  }
  if (positiveFactors.some((f) => f.factor === "company")) {
    positives.push("\u516C\u53F8\u73B0\u91D1\u57FA\u7840\u3001\u56DE\u8D2D\u6388\u6743\u548C\u6210\u672C\u7EAA\u5F8B\u4ECD\u6784\u6210\u4F30\u503C\u652F\u6491\u3002");
  }
  if (positiveFactors.some((f) => f.factor === "technical")) {
    positives.push("\u6280\u672F\u9762\u663E\u793A\u77ED\u7EBF\u4F01\u7A33\u8FF9\u8C61\uFF0C\u6210\u4EA4\u91CF\u914D\u5408\u53CD\u5F39\u3002");
  }
  if (companyEvents.length > 0) {
    positives.push(`\u516C\u53F8\u8FD1\u671F\u6709 ${companyEvents.length} \u6761\u6B63\u9762\u52A8\u6001\uFF0C\u652F\u6491\u5E02\u573A\u4FE1\u5FC3\u3002`);
  }
  while (positives.length < 3) {
    positives.push(["Q1 \u6BDB\u5229\u7387\u6539\u5584\u81F3 24.1%\uFF0C\u7F13\u89E3\u5229\u6DA6\u7387\u4E0B\u6ED1\u62C5\u5FE7\u3002", "\u7BA1\u7406\u5C42\u6210\u672C\u7EAA\u5F8B\u548C\u6218\u7565\u805A\u7126\u63D0\u4F9B\u652F\u6491\u3002", "\u5E02\u573A\u60C5\u7EEA\u8FB9\u9645\u6539\u5584\uFF0C\u4E2D\u6982\u80A1\u6574\u4F53\u4F01\u7A33\u3002"][positives.length]);
  }
  const negatives = [];
  if (negativeFactors.some((f) => f.factor === "property")) {
    negatives.push("\u4E2D\u56FD\u5730\u4EA7\u9500\u552E\u548C\u4EF7\u683C\u6570\u636E\u4ECD\u504F\u5F31\uFF0C\u884C\u4E1A\u4FEE\u590D\u5C1A\u672A\u5F62\u6210\u6E05\u6670\u8D8B\u52BF\u3002");
  }
  if (negativeFactors.some((f) => f.factor === "chinaAdr")) {
    negatives.push("\u4E2D\u6982\u80A1\u6574\u4F53\u98CE\u9669\u504F\u597D\u4E0D\u7A33\u5B9A\uFF0C\u53EF\u80FD\u653E\u5927 ADR \u77ED\u7EBF\u6CE2\u52A8\u3002");
  }
  if (negativeFactors.some((f) => f.factor === "macro")) {
    negatives.push("\u5B8F\u89C2\u73AF\u5883\u5B58\u5728\u4E0D\u786E\u5B9A\u6027\uFF0C\u7F8E\u8054\u50A8\u653F\u7B56\u8DEF\u5F84\u5F71\u54CD\u6210\u957F\u80A1\u4F30\u503C\u3002");
  }
  if (propertyEvents.length > 0) {
    negatives.push(`\u5730\u4EA7\u884C\u4E1A\u6709 ${propertyEvents.length} \u6761\u76F8\u5173\u4E8B\u4EF6\uFF0C\u653F\u7B56\u6548\u679C\u4ECD\u5F85\u9A8C\u8BC1\u3002`);
  }
  while (negatives.length < 3) {
    negatives.push(["\u65B0\u623F\u4E1A\u52A1\u5F39\u6027\u53D7\u5F00\u53D1\u5546\u4FE1\u7528\u73AF\u5883\u548C\u9879\u76EE\u4F9B\u7ED9\u5F71\u54CD\u3002", "GTV \u6062\u590D\u9700\u8981\u65F6\u95F4\uFF0C\u6536\u5165\u7AEF\u4ECD\u627F\u538B\u3002", "\u5E02\u573A\u5BF9\u5730\u4EA7\u653F\u7B56\u6548\u679C\u5B58\u5728\u5206\u6B67\u3002"][negatives.length]);
  }
  const watch = [];
  if (propertyEvents.length > 0) {
    watch.push("\u56FD\u5BB6\u7EDF\u8BA1\u5C40\u623F\u5730\u4EA7\u6570\u636E\uFF0C\u5C24\u5176\u662F\u4E00\u7EBF\u53CA\u5F3A\u4E8C\u7EBF\u4E8C\u624B\u623F\u4EF7\u683C\u3002");
  }
  watch.push("\u4E0B\u4E00\u4EFD\u8D22\u62A5\u4E2D\u7684 GTV\u3001\u5229\u6DA6\u7387\u3001\u73B0\u91D1\u548C\u56DE\u8D2D\u8282\u594F\u3002");
  watch.push("KWEB / FXI \u662F\u5426\u4F01\u7A33\uFF0C\u51B3\u5B9A\u4E2D\u6982\u60C5\u7EEA\u662F\u5426\u7EE7\u7EED\u62D6\u7D2F\u3002");
  if (macroEvents.length > 0) {
    watch.push("\u7F8E\u8054\u50A8\u653F\u7B56\u4FE1\u53F7\u548C\u5229\u7387\u8D70\u52BF\u5BF9\u4F30\u503C\u7684\u5F71\u54CD\u3002");
  }
  while (watch.length < 3) {
    watch.push(["\u7BA1\u7406\u5C42\u5BF9\u4E0B\u534A\u5E74\u4E1A\u7EE9\u7684\u6307\u5F15\u3002", "\u884C\u4E1A\u7ADE\u4E89\u683C\u5C40\u53D8\u5316\u548C\u5E02\u573A\u4EFD\u989D\u8D8B\u52BF\u3002", "\u653F\u7B56\u9762\u662F\u5426\u6709\u65B0\u7684\u8D85\u9884\u671F\u5229\u597D\u3002"][watch.length]);
  }
  const targetExplanations = {
    17: "17 \u7F8E\u5143\u4EE3\u8868\u4FEE\u590D\u56DE\u8865\uFF0C\u4E0D\u662F\u8D8B\u52BF\u53CD\u8F6C\u3002\u6982\u7387\u5224\u65AD\u56F4\u7ED5\u5730\u4EA7\u6570\u636E\u4E0D\u7EE7\u7EED\u6076\u5316\u3001\u56DE\u8D2D\u548C\u6BDB\u5229\u7387\u97E7\u6027\u662F\u5426\u8DB3\u591F\u652F\u6491\u4E00\u6B21\u4FEE\u590D\u3002",
    18: "18 \u7F8E\u5143\u4EE3\u8868\u57FA\u672C\u9762\u786E\u8BA4\u3002\u6982\u7387\u5224\u65AD\u56F4\u7ED5 GTV\u3001\u5229\u6DA6\u7387\u6216\u653F\u7B56\u6548\u679C\u662F\u5426\u81F3\u5C11\u4E00\u4E2A\u65B9\u5411\u88AB\u6570\u636E\u9A8C\u8BC1\uFF0C\u540C\u65F6\u4E2D\u6982\u98CE\u9669\u504F\u597D\u4E0D\u80FD\u660E\u663E\u62D6\u7D2F\u3002",
    19: "19 \u7F8E\u5143\u4EE3\u8868\u91CD\u65B0\u5B9A\u4EF7\u3002\u6982\u7387\u5224\u65AD\u56F4\u7ED5\u5730\u4EA7\u6210\u4EA4\u548C\u623F\u4EF7\u662F\u5426\u8FDE\u7EED\u786E\u8BA4\uFF0C\u4EE5\u53CA\u5E02\u573A\u662F\u5426\u628A BEKE \u4ECE\u5730\u4EA7\u60C5\u7EEA\u80A1\u770B\u6210\u73B0\u91D1\u6D41\u548C\u5E73\u53F0\u6548\u7387\u8D44\u4EA7\u3002"
  };
  return {
    headline,
    today,
    changes,
    positives: positives.slice(0, 3),
    negatives: negatives.slice(0, 3),
    watch: watch.slice(0, 3),
    targetExplanations
  };
}
var AnalysisEngine = class {
  async generateAnalysis(quote2, predictions, events, factors, llmOrGateway) {
    const dynamicAnalysis = generateDynamicAnalysis(quote2, predictions, events, factors);
    if (!llmOrGateway) {
      return dynamicAnalysis;
    }
    try {
      if ("run" in llmOrGateway && typeof llmOrGateway.run === "function") {
        const result2 = await llmOrGateway.run({
          task: "generate_analysis",
          promptVersion: PROMPTS.generate_analysis.version,
          input: {
            quote: quote2,
            predictions,
            events: events.slice(0, 10),
            factors
          },
          outputSchema: "AnalysisOutput",
          fallback: dynamicAnalysis
        });
        return this.validateAnalysis(result2) ? result2 : dynamicAnalysis;
      }
      const provider = llmOrGateway;
      const result = await provider.complete({
        promptVersion: PROMPTS.generate_analysis.version,
        input: {
          quote: quote2,
          predictions,
          events: events.slice(0, 10),
          factors
        },
        outputSchema: "AnalysisOutput"
      });
      return this.validateAnalysis(result) ? result : dynamicAnalysis;
    } catch {
      return dynamicAnalysis;
    }
  }
  validateAnalysis(result) {
    return !!result && typeof result === "object" && "headline" in result && "today" in result && "positives" in result && Array.isArray(result.positives) && result.positives.length === 3 && "negatives" in result && Array.isArray(result.negatives) && result.negatives.length === 3 && "watch" in result && Array.isArray(result.watch) && result.watch.length === 3;
  }
};

// src/research/engines/memory/MemoryEngine.ts
var MEMORY_DECAY_RATES = {
  short: 0.9,
  mid: 0.95,
  long: 0.99,
  model: 0.999,
  company: 0.95,
  property: 0.95,
  market: 0.9,
  macro: 0.95,
  geopolitical: 0.95
};
var MEMORY_DURATIONS = {
  short: 3 * 24 * 60 * 60 * 1e3,
  mid: 45 * 24 * 60 * 60 * 1e3,
  long: 180 * 24 * 60 * 60 * 1e3,
  model: 365 * 24 * 60 * 60 * 1e3,
  company: 45 * 24 * 60 * 60 * 1e3,
  property: 45 * 24 * 60 * 60 * 1e3,
  market: 3 * 24 * 60 * 60 * 1e3,
  macro: 45 * 24 * 60 * 60 * 1e3,
  geopolitical: 45 * 24 * 60 * 60 * 1e3
};
function classifyMemoryType(event) {
  switch (event.category) {
    case "\u516C\u53F8":
      return event.importance >= 8 ? "long" : "company";
    case "\u5730\u4EA7":
      return event.importance >= 8 ? "long" : "property";
    case "\u4E2D\u6982":
      return "market";
    case "\u5B8F\u89C2":
      return "macro";
    case "\u5730\u7F18":
      return "geopolitical";
    default:
      return "short";
  }
}
function categoryToMemoryTypes(category) {
  switch (category) {
    case "\u516C\u53F8":
      return ["company", "long"];
    case "\u5730\u4EA7":
      return ["property", "long"];
    case "\u4E2D\u6982":
      return ["market"];
    case "\u5B8F\u89C2":
      return ["macro"];
    case "\u5730\u7F18":
      return ["geopolitical"];
    default:
      return ["short"];
  }
}
function relevanceMultiplier(memory, events, target) {
  let multiplier = 1;
  const currentEventIds = new Set(events.map((event) => event.id));
  const currentMemoryTypes = new Set(events.flatMap((event) => categoryToMemoryTypes(event.category)));
  if (memory.sourceEventId && currentEventIds.has(memory.sourceEventId)) {
    multiplier += 0.9;
  }
  if (currentMemoryTypes.has(memory.memoryType)) {
    multiplier += 0.35;
  }
  if (memory.content.includes(String(target))) {
    multiplier += 0.15;
  }
  return multiplier;
}
function calculateDecayScore(memoryType, createdAt, now) {
  const ageMs = new Date(now).getTime() - new Date(createdAt).getTime();
  const durationMs = MEMORY_DURATIONS[memoryType];
  const ageRatio = Math.min(1, ageMs / durationMs);
  const decayRate = MEMORY_DECAY_RATES[memoryType];
  return Math.max(0, Math.pow(decayRate, ageRatio * 100));
}
var MemoryEngine = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  retrieveRelevantMemories(input) {
    const { events, target, now } = input;
    this.repository.removeExpired(now);
    return this.repository.getAll().map((m) => ({
      ...m,
      decayScore: calculateDecayScore(m.memoryType, m.createdAt, now),
      lastUsedAt: m.lastUsedAt
    })).filter((m) => m.decayScore > 0.1).sort((a, b) => {
      const scoreA = a.importance * a.confidence * a.decayScore * relevanceMultiplier(a, events, target);
      const scoreB = b.importance * b.confidence * b.decayScore * relevanceMultiplier(b, events, target);
      return scoreB - scoreA;
    }).slice(0, 10).map((memory) => {
      const used = { ...memory, lastUsedAt: now };
      this.repository.save(used);
      return used;
    });
  }
  createMemoryCandidates(input) {
    const { events } = input;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const candidates = [];
    for (const event of events) {
      if (event.importance >= 7 && event.confidence >= 0.7) {
        const memoryType = classifyMemoryType(event);
        const durationMs = MEMORY_DURATIONS[memoryType];
        const validUntil = new Date(Date.now() + durationMs).toISOString();
        const id = `mem-${event.id}`;
        const existing = this.repository.findBySourceEventId(event.id);
        if (existing) {
          continue;
        }
        candidates.push({
          id,
          memoryType,
          content: `${event.title}: ${event.summary}`,
          sourceEventId: event.id,
          validFrom: now,
          validUntil,
          importance: event.importance,
          confidence: event.confidence,
          decayScore: 1,
          createdAt: now
        });
      }
    }
    return candidates;
  }
  addMemories(memories) {
    this.repository.saveMany(memories);
  }
  decayMemories(now) {
    this.repository.removeExpired(now);
    const memories = this.repository.getAll();
    for (const memory of memories) {
      const decayScore = calculateDecayScore(memory.memoryType, memory.createdAt, now);
      if (decayScore <= 0.01) {
        continue;
      }
      this.repository.save({ ...memory, decayScore });
    }
  }
  getMemories() {
    return this.repository.getAll();
  }
  getMemoryCount() {
    return this.repository.getAll().length;
  }
};

// src/research/repositories/InMemorySnapshotRepository.ts
var InMemorySnapshotRepository = class {
  snapshots = /* @__PURE__ */ new Map();
  latestPublishedRunId = null;
  getLatest() {
    return this.getLatestPublished();
  }
  getLatestPublished() {
    if (!this.latestPublishedRunId) return null;
    return this.snapshots.get(this.latestPublishedRunId) ?? null;
  }
  getByRunId(runId) {
    return this.snapshots.get(runId) ?? null;
  }
  getHistory(target, limit = 10) {
    const latest = this.getLatest();
    if (!latest) return [];
    const key = `p${target}`;
    return latest.history.map((h) => ({ at: h.at, probability: h[key] })).slice(-limit);
  }
  save(snapshot) {
    const published = { ...snapshot, status: "published" };
    this.snapshots.set(snapshot.runId, published);
    this.latestPublishedRunId = snapshot.runId;
  }
  saveDraft(snapshot) {
    const draft = { ...snapshot, status: "draft" };
    this.snapshots.set(snapshot.runId, draft);
    return draft;
  }
  markValidated(runId) {
    const snapshot = this.requireSnapshot(runId);
    if (snapshot.status === "rejected") {
      throw new Error(`Cannot validate rejected snapshot: ${runId}`);
    }
    const validated = { ...snapshot, status: "validated" };
    this.snapshots.set(runId, validated);
    return validated;
  }
  publish(runId) {
    const snapshot = this.requireSnapshot(runId);
    if (snapshot.status !== "validated") {
      throw new Error(`Cannot publish snapshot ${runId}: status must be validated`);
    }
    const published = { ...snapshot, status: "published" };
    this.snapshots.set(runId, published);
    this.latestPublishedRunId = runId;
    return published;
  }
  reject(runId, issues) {
    const snapshot = this.requireSnapshot(runId);
    const rejected = {
      ...snapshot,
      status: "rejected",
      audit: {
        ...snapshot.audit,
        rejectionIssues: issues.map((issue) => issue.code).join(",")
      }
    };
    this.snapshots.set(runId, rejected);
    return rejected;
  }
  requireSnapshot(runId) {
    const snapshot = this.snapshots.get(runId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${runId}`);
    }
    return snapshot;
  }
};

// src/research/repositories/MemoryRepository.ts
var InMemoryMemoryRepository = class {
  memories = /* @__PURE__ */ new Map();
  save(memory) {
    this.memories.set(memory.id, memory);
  }
  saveMany(memories) {
    for (const memory of memories) {
      this.memories.set(memory.id, memory);
    }
  }
  getById(id) {
    return this.memories.get(id) ?? null;
  }
  findBySourceEventId(eventId) {
    for (const memory of this.memories.values()) {
      if (memory.sourceEventId === eventId) {
        return memory;
      }
    }
    return null;
  }
  getAll() {
    return Array.from(this.memories.values());
  }
  getRelevant(limit = 10) {
    return Array.from(this.memories.values()).sort((a, b) => {
      const scoreA = a.importance * a.confidence * a.decayScore;
      const scoreB = b.importance * b.confidence * b.decayScore;
      return scoreB - scoreA;
    }).slice(0, limit);
  }
  removeExpired(now) {
    const nowTime = new Date(now).getTime();
    for (const [id, memory] of this.memories) {
      if (memory.validUntil && new Date(memory.validUntil).getTime() < nowTime) {
        this.memories.delete(id);
      }
    }
  }
};

// src/research/viewModel.ts
var TARGET_PROFILES = {
  17: {
    archetype: "\u4FEE\u590D\u56DE\u8865\u4F4D",
    condition: "\u5730\u4EA7\u6570\u636E\u4E0D\u518D\u6076\u5316\uFF0C\u80A1\u4EF7\u7EF4\u6301\u5728 15 \u7F8E\u5143\u9644\u8FD1\uFF0C\u56DE\u8D2D\u548C\u6BDB\u5229\u7387\u97E7\u6027\u7EE7\u7EED\u652F\u6491\u5E02\u573A\u91CD\u65B0\u8BA4\u53EF BEKE \u7684\u4FEE\u590D\u7A7A\u95F4\u3002",
    invalidation: "\u82E5\u4E8C\u624B\u623F\u4EF7\u683C\u6216\u6210\u4EA4\u7EE7\u7EED\u8D70\u5F31\uFF0C\u6216 BEKE \u8DCC\u56DE\u524D\u4E00\u8F6E\u4F4E\u4F4D\uFF0C17 \u7F8E\u5143\u4F1A\u4ECE\u4FEE\u590D\u76EE\u6807\u9000\u56DE\u89C2\u5BDF\u76EE\u6807\u3002"
  },
  18: {
    archetype: "\u57FA\u672C\u9762\u786E\u8BA4\u4F4D",
    condition: "GTV\u3001\u5229\u6DA6\u7387\u3001\u73B0\u91D1\u56DE\u62A5\u6216\u653F\u7B56\u6548\u679C\u81F3\u5C11\u51FA\u73B0\u4E00\u4E2A\u53EF\u9A8C\u8BC1\u6539\u5584\uFF0C\u4E2D\u6982\u98CE\u9669\u504F\u597D\u4E0D\u80FD\u660E\u663E\u62D6\u7D2F\u3002",
    invalidation: "\u82E5\u8D22\u62A5\u53EA\u8BC1\u660E\u6210\u672C\u97E7\u6027\u3001\u4F46\u6536\u5165\u548C GTV \u6CA1\u6709\u8DDF\u4E0A\uFF0C18 \u7F8E\u5143\u4F1A\u505C\u7559\u5728\u53CD\u5F39\u5EF6\u4F38\uFF0C\u4E0D\u4F1A\u5F62\u6210\u65B0\u4E2D\u67A2\u3002"
  },
  19: {
    archetype: "\u91CD\u65B0\u5B9A\u4EF7\u4F4D",
    condition: "\u5730\u4EA7\u6210\u4EA4\u548C\u623F\u4EF7\u8FDE\u7EED\u786E\u8BA4\uFF0C\u540C\u65F6\u5E02\u573A\u613F\u610F\u6309\u73B0\u91D1\u6D41\u548C\u5E73\u53F0\u6548\u7387\u8D44\u4EA7\u7ED9 BEKE \u4F30\u503C\u3002",
    invalidation: "\u82E5\u884C\u4E1A\u6570\u636E\u6CA1\u6709\u8FDE\u7EED\u6027\uFF0C19 \u7F8E\u5143\u66F4\u50CF\u60C5\u666F\u4EF7\u503C\uFF0C\u77ED\u7EBF\u53CD\u5F39\u5BB9\u6613\u5148\u900F\u652F\u9884\u671F\u3002"
  }
};
function buildTargetHeadline(prediction) {
  const profile = TARGET_PROFILES[prediction.target];
  if (prediction.target === 17) {
    return `${prediction.target} \u7F8E\u5143\u4EE3\u8868${profile.archetype}\uFF0C\u4E0D\u662F\u8D8B\u52BF\u53CD\u8F6C\u3002`;
  }
  if (prediction.target === 18) {
    return `${prediction.target} \u7F8E\u5143\u4EE3\u8868${profile.archetype}\uFF0C\u9700\u8981\u6570\u636E\u63A5\u529B\u3002`;
  }
  return `${prediction.target} \u7F8E\u5143\u4EE3\u8868${profile.archetype}\uFF0C\u9700\u8981\u884C\u4E1A\u62D0\u70B9\u3002`;
}
function buildTargetThesis(snapshot, prediction) {
  const support = summarizeDrivers2(prediction.positiveDrivers);
  const pressure = summarizeDrivers2(prediction.negativeDrivers);
  const previous = prediction.previousProbability;
  const previousPhrase = previous === void 0 ? "\u4E0A\u4E00\u8F6E\u6682\u65E0\u53EF\u6BD4\u8BB0\u5F55" : previous > prediction.probability ? "\u4E0A\u4E00\u8F6E\u5224\u65AD\u66F4\u4E50\u89C2" : previous < prediction.probability ? "\u4E0A\u4E00\u8F6E\u5224\u65AD\u66F4\u4FDD\u5B88" : "\u4E0A\u4E00\u8F6E\u5224\u65AD\u57FA\u672C\u6301\u5E73";
  const currentPhrase = prediction.probability >= 50 ? "\u672C\u8F6E\u4ECD\u53EF\u8DDF\u8E2A" : "\u672C\u8F6E\u4ECD\u9700\u50AC\u5316";
  if (prediction.target === 17) {
    return `${previousPhrase}\uFF0C${currentPhrase}\u3002\u5173\u952E\u4E0D\u5728\u91CD\u590D\u8BA1\u7B97\u7A7A\u95F4\uFF0C\u800C\u5728\u4F4E\u4F4D\u627F\u63A5\u662F\u5426\u7EE7\u7EED\u88AB\u516C\u5F00\u8BC1\u636E\u9A8C\u8BC1\uFF1B\u652F\u6491\u4FA7\u662F ${support}\uFF0C\u538B\u5236\u4FA7\u662F ${pressure}\u3002`;
  }
  if (prediction.target === 18) {
    return `${previousPhrase}\uFF0C${currentPhrase}\u3002\u8FD9\u4E00\u6863\u4E0D\u80FD\u53EA\u9760\u53CD\u5F39\u5EF6\u4F38\uFF0C\u4E0B\u4E00\u6B65\u8981\u770B\u5230 GTV\u3001\u5229\u6DA6\u7387\u6216\u653F\u7B56\u6548\u679C\u81F3\u5C11\u6709\u4E00\u4E2A\u65B9\u5411\u88AB\u6570\u636E\u9A8C\u8BC1\u3002`;
  }
  return `${previousPhrase}\uFF0C${currentPhrase}\u3002\u8FD9\u4E00\u6863\u4ECD\u662F\u60C5\u666F\u4EF7\u503C\uFF0C\u4E0D\u80FD\u8BC1\u660E\u8D8B\u52BF\u5DF2\u7ECF\u6210\u7ACB\uFF1B\u9700\u8981\u5730\u4EA7\u6210\u4EA4\u548C\u623F\u4EF7\u8FDE\u7EED\u786E\u8BA4\uFF0C\u5E76\u8BA9\u5E02\u573A\u63A5\u53D7 BEKE \u7684\u73B0\u91D1\u6D41\u548C\u5E73\u53F0\u6548\u7387\u53D9\u4E8B\u3002`;
}
function buildResearchBriefs(snapshot, prediction) {
  const positiveFactors = snapshot.factors.filter((factor) => factor.direction === "positive").slice(0, 2).map((factor) => factor.label).join("\u3001") || "\u4EF7\u683C\u548C\u56DE\u8D2D";
  const pressureFactors = snapshot.factors.filter((factor) => factor.direction === "negative").slice(0, 2).map((factor) => factor.label).join("\u3001") || "\u5730\u4EA7\u6216\u4E2D\u6982\u98CE\u9669";
  const stocktake = /没有新的|不是新新闻|存量信息|复核/.test(snapshot.analysis.changes) ? "\u65E0\u65B0\u589E\u516C\u544A\uFF1B\u672C\u8F6E\u662F\u5B58\u91CF\u516C\u5F00\u4FE1\u606F\u590D\u6838\uFF0C\u91CD\u70B9\u770B\u65E7\u8BC1\u636E\u662F\u5426\u4ECD\u80FD\u89E3\u91CA\u5F53\u524D\u76D8\u9762\u3002" : stripEndPunctuation(snapshot.analysis.changes);
  const essence = {
    17: `\u8FD9\u4E0D\u662F\u5927\u725B\u5E02\u5BA3\u8A00\uFF0C\u800C\u662F\u4E00\u6B21\u56DE\u5230\u5408\u7406\u533A\u95F4\u7684\u6D4B\u8BD5\u3002BEKE \u5148\u8981\u5B88\u4F4F 15 \u7F8E\u5143\u9644\u8FD1\uFF0C\u518D\u8BA9${naturalListText(positiveFactors)}\u7EE7\u7EED\u6491\u4F4F\u60C5\u7EEA\uFF1B${naturalListText(pressureFactors)}\u4E00\u653E\u5927\uFF0C\u8282\u594F\u5C31\u4F1A\u540E\u79FB\u3002`,
    18: `18 \u7F8E\u5143\u4E0D\u662F\u987A\u624B\u53CD\u5F39\u5C31\u80FD\u5230\u7684\u4E00\u6863\u3002\u5B83\u9700\u8981\u8D22\u62A5\u3001GTV\u3001\u5229\u6DA6\u7387\u6216\u653F\u7B56\u6548\u679C\u7ED9\u51FA\u4E00\u4E2A\u65B0\u7684\u786E\u8BA4\u4FE1\u53F7\u3002`,
    19: `19 \u7F8E\u5143\u662F\u4F30\u503C\u62AC\u6863\uFF0C\u4E0D\u9002\u5408\u53EA\u9760\u77ED\u7EBF\u53CD\u5F39\u4E0B\u6CE8\u3002\u53EA\u6709\u5730\u4EA7\u6210\u4EA4\u3001\u623F\u4EF7\u548C\u4E2D\u6982\u98CE\u9669\u504F\u597D\u4E00\u8D77\u8F6C\u597D\uFF0C\u5B83\u624D\u4F1A\u53D8\u5F97\u53EF\u4FE1\u3002`
  };
  const dissent = {
    17: "\u591A\u5934\u4F1A\u8BF4\uFF1A15 \u7F8E\u5143\u9644\u8FD1\u63A5\u5F97\u4F4F\uFF0C\u56DE\u8D2D\u548C\u6BDB\u5229\u7387\u8DB3\u591F\u652F\u6491\u4E00\u6B21\u4FEE\u590D\uFF1B\u7A7A\u5934\u4F1A\u8BF4\uFF1A\u6CA1\u6709\u65B0\u516C\u544A\uFF0C\u5730\u4EA7\u6570\u636E\u8FD8\u6CA1\u7ED9\u8FDE\u7EED\u8BC1\u636E\uFF0C\u8FD9\u53EF\u80FD\u53EA\u662F\u53CD\u62BD\u3002",
    18: "\u591A\u5934\u4F1A\u8BF4\uFF1A\u5982\u679C GTV \u6216\u5229\u6DA6\u7387\u6709\u4E00\u4E2A\u8F6C\u597D\uFF0C\u5E02\u573A\u4F1A\u613F\u610F\u62AC\u4E00\u6863\uFF1B\u7A7A\u5934\u4F1A\u8BF4\uFF1A\u53EA\u6709\u6210\u672C\u97E7\u6027\u8FD8\u4E0D\u591F\uFF0C\u6536\u5165\u538B\u529B\u6CA1\u89E3\u51B3\u5C31\u5F88\u96BE\u7AD9\u7A33\u3002",
    19: "\u591A\u5934\u4F1A\u8BF4\uFF1ABEKE \u7684\u73B0\u91D1\u6D41\u548C\u5E73\u53F0\u6548\u7387\u503C\u5F97\u66F4\u9AD8\u4F30\u503C\uFF1B\u7A7A\u5934\u4F1A\u8BF4\uFF1A\u884C\u4E1A\u6210\u4EA4\u548C\u623F\u4EF7\u6CA1\u6709\u540C\u6B65\u8F6C\u597D\u524D\uFF0C19 \u7F8E\u5143\u53EA\u662F\u5267\u672C\uFF0C\u4E0D\u662F\u4E3B\u7EBF\u3002"
  };
  return [
    {
      label: "\u672C\u8D28",
      body: essence[prediction.target]
    },
    {
      label: "\u5206\u6B67",
      body: dissent[prediction.target]
    },
    {
      label: "\u53D8\u5316",
      body: stocktake.replace("\u65E0\u65B0\u589E\u516C\u544A\uFF1B", "\u6CA1\u6709\u65B0\u7684\u516C\u53F8\u516C\u544A\uFF1B")
    }
  ];
}
function buildResearchNotes(snapshot, prediction) {
  const profile = TARGET_PROFILES[prediction.target];
  const factorSignal = snapshot.factors.filter((factor) => factor.direction !== "neutral").map((factor) => `${factor.label}${factor.score >= 50 ? "+" : ""}${Math.round(factor.score - 50)}`).join("\uFF0C") || "\u6682\u65E0\u7EBF\u6027\u56E0\u5B50\u7A81\u7834";
  return [
    {
      label: "\u89E6\u53D1",
      body: profile.condition
    },
    {
      label: "\u53CD\u8BC1",
      body: `\u8981\u63A8\u7FFB\u8FD9\u4E2A\u5224\u65AD\uFF1A${profile.invalidation} \u76EE\u524D\u6700\u660E\u663E\u7684\u62C9\u626F\u662F\uFF1A${factorSignal}\u3002`
    },
    {
      label: "\u6821\u9A8C",
      body: buildValidationLine(snapshot, prediction)
    }
  ];
}
function stripEndPunctuation(value) {
  return value.replace(/[。；;.\s]+$/g, "");
}
function naturalListText(value) {
  const items = value.split("\u3001").map((item) => item.trim()).filter(Boolean);
  if (items.length <= 1) return items[0] ?? value;
  if (items.length === 2) return `${items[0]}\u548C${items[1]}`;
  return `${items.slice(0, -1).join("\u3001")}\u548C${items[items.length - 1]}`;
}
function summarizeDrivers2(items) {
  const labels = items.map(toDriverLabel2).filter(Boolean);
  return labels.length > 0 ? Array.from(new Set(labels)).slice(0, 3).join("\u3001") : "\u6682\u65E0\u660E\u663E\u9879";
}
function buildValidationLine(snapshot, prediction) {
  const watchpoint = snapshot.analysis.watch[0] ?? "\u4E0B\u4E00\u7EC4\u516C\u5F00\u6570\u636E";
  const cleanWatchpoint = stripEndPunctuation(watchpoint);
  if (prediction.target === 17) {
    return `\u4E0B\u4E00\u6B21\u5148\u770B\uFF1A${cleanWatchpoint}\uFF1B\u5982\u679C 15 \u7F8E\u5143\u9644\u8FD1\u7EE7\u7EED\u6709\u4EBA\u63A5\uFF0C17 \u7F8E\u5143\u624D\u503C\u5F97\u7EE7\u7EED\u76EF\u3002`;
  }
  if (prediction.target === 18) {
    return `\u4E0B\u4E00\u6B21\u5148\u770B\uFF1A${cleanWatchpoint}\uFF1B\u6CA1\u6709\u8D22\u62A5\u6216\u884C\u4E1A\u6570\u636E\u63A5\u529B\uFF0C18 \u7F8E\u5143\u5C31\u4E0D\u8BE5\u63D0\u524D\u7B97\u4F5C\u65B0\u4E2D\u67A2\u3002`;
  }
  return `\u4E0B\u4E00\u6B21\u5148\u770B\uFF1A${cleanWatchpoint}\uFF1B\u6CA1\u6709\u8FDE\u7EED\u884C\u4E1A\u8BC1\u636E\uFF0C19 \u7F8E\u5143\u5C31\u53EA\u4FDD\u7559\u5728\u4E50\u89C2\u60C5\u666F\u91CC\u3002`;
}
function toDriverLabel2(value) {
  if (/回购|股东大会/.test(value)) return "\u56DE\u8D2D\u6388\u6743";
  if (/企稳|技术/.test(value)) return "\u4EF7\u683C\u4F01\u7A33";
  if (/收入|GTV/.test(value)) return "\u6536\u5165\u538B\u529B";
  if (/毛利率/.test(value)) return "\u6BDB\u5229\u7387\u97E7\u6027";
  if (/地产环境|房地产|住房|二手房|新房|房价/.test(value)) return "\u5730\u4EA7\u73AF\u5883";
  if (/中概|KWEB|FXI|ADR/.test(value)) return "\u4E2D\u6982\u60C5\u7EEA";
  return value.length > 14 ? `${value.slice(0, 14)}...` : value;
}

// src/research/evaluation/researchSurfaceAudit.ts
var EXPECTED_PROMPT_VERSION = PROMPTS.generate_analysis.version;
function buildFrontendSurfaceContract(snapshot, prediction) {
  const researchNotes = buildResearchNotes(snapshot, prediction);
  const researchBriefs = buildResearchBriefs(snapshot, prediction);
  return [
    {
      key: "header-question",
      label: "Header",
      role: "question",
      text: `When will BEKE go to ${prediction.target}?`
    },
    {
      key: "target-tabs",
      label: "Target tabs",
      role: "target-selector",
      text: snapshot.predictions.map((item) => `${item.target} \u7F8E\u5143`).join(" / ")
    },
    {
      key: "hero-probability",
      label: "Hero number",
      role: "probability-readout",
      text: `${prediction.probability}% ${prediction.signal}`
    },
    {
      key: "hero-headline",
      label: "Hero headline",
      role: "target-meaning",
      text: buildTargetHeadline(prediction)
    },
    {
      key: "target-thesis",
      label: "Target thesis",
      role: "target-thesis",
      text: buildTargetThesis(snapshot, prediction)
    },
    {
      key: "target-drivers",
      label: "Support pressure",
      role: "support-pressure",
      text: [
        `\u652F\u6491 ${prediction.positiveDrivers.join("\u3001") || "\u6682\u65E0\u660E\u663E\u9879"}`,
        `\u538B\u5236 ${prediction.negativeDrivers.join("\u3001") || "\u6682\u65E0\u660E\u663E\u9879"}`
      ].join(" | ")
    },
    {
      key: "horizon",
      label: "Market state",
      role: "market-state",
      text: `\u73B0\u4EF7 ${snapshot.quote.price} \u524D\u6536 ${snapshot.quote.previousClose} \u7A7A\u95F4 ${prediction.distancePercent}%`
    },
    {
      key: "near-term-forecast",
      label: "Bold one-week forecast",
      role: "bold-week-forecast",
      text: prediction.nearTermForecast ? [
        prediction.nearTermForecast.label,
        prediction.nearTermForecast.thesis
      ].join(" ") : ""
    },
    {
      key: "research-notes",
      label: "Research judgement",
      role: "research-judgement",
      text: [...researchBriefs, ...researchNotes].map((note) => `${note.label}: ${note.body}`).join("\n")
    },
    {
      key: "factor-map",
      label: "Factor balance",
      role: "factor-balance",
      text: snapshot.factors.map((factor) => `${factor.label}${factor.score}`).join(" / ")
    },
    {
      key: "drivers",
      label: "Driver sets",
      role: "driver-sets",
      text: [
        ...snapshot.analysis.positives,
        ...snapshot.analysis.negatives,
        ...snapshot.analysis.watch
      ].join("\n")
    },
    {
      key: "history",
      label: "Probability history",
      role: "probability-history",
      text: snapshot.history.slice(-10).map((point) => `${point.at}:${point.p17}/${point.p18}/${point.p19}`).join(" | ")
    },
    {
      key: "news-feed",
      label: "Source provenance",
      role: "source-provenance",
      text: snapshot.news.map((item) => `${item.publishedAt}: ${item.title} - ${item.source}`).join("\n")
    }
  ];
}
function evaluateFrontendSurface(snapshot, prediction) {
  const findings = [];
  const surfaces = buildFrontendSurfaceContract(snapshot, prediction);
  const roles = surfaces.map((surface) => surface.role);
  if (new Set(roles).size !== roles.length) {
    findings.push("frontend surface roles are not unique");
  }
  if (snapshot.promptVersion !== EXPECTED_PROMPT_VERSION) {
    findings.push(`snapshot prompt version ${snapshot.promptVersion} does not match ${EXPECTED_PROMPT_VERSION}`);
  }
  if (snapshot.history.length === 0) {
    findings.push("probability history has no observed snapshot points");
  }
  if (/当前股价|现价|距离/.test(buildTargetHeadline(prediction))) {
    findings.push("hero headline repeats market metrics");
  }
  const targetThesis = surfaces.find((surface) => surface.role === "target-thesis");
  if (targetThesis && /\d+%|现价|当前股价|差距/.test(targetThesis.text)) {
    findings.push("target thesis repeats numeric ledger language");
  }
  const forbiddenPlainUserTerms = /过去 6 小时：|审计日志|查看底层运行记录|数据与新闻源|Base|Adj|基础档位|因子影响|上下文分|模型综合/;
  const combined = surfaces.map((surface) => surface.text).join("\n");
  if (forbiddenPlainUserTerms.test(combined)) {
    findings.push("frontend contract leaks old debug or duplicate labels");
  }
  const boldForecast = surfaces.find((surface) => surface.role === "bold-week-forecast");
  if (boldForecast && !/(我判断|我会看)/.test(boldForecast.text)) {
    findings.push("bold forecast lacks a human forecast voice");
  }
  if (boldForecast && /大胆预测[:：]/.test(boldForecast.text)) {
    findings.push("bold forecast repeats its own label inside the thesis");
  }
  const researchJudgement = surfaces.find((surface) => surface.role === "research-judgement");
  if (researchJudgement && !(/分歧/.test(researchJudgement.text) && /反证/.test(researchJudgement.text) && /校验/.test(researchJudgement.text))) {
    findings.push("research judgement lacks dissent, falsification, or validation surfaces");
  }
  const nonLedgerSurfaces = surfaces.filter(
    (surface) => surface.role !== "market-state"
  );
  if (nonLedgerSurfaces.some((surface) => /当前股价\s*\d|现价\s*\d/.test(surface.text))) {
    findings.push("non-ledger surfaces repeat raw quote wording");
  }
  const normalizedBodies = nonLedgerSurfaces.map((surface) => normalizeText(surface.text)).filter((body) => body.length >= 18);
  if (new Set(normalizedBodies).size !== normalizedBodies.length) {
    findings.push("frontend surfaces contain duplicate bodies");
  }
  const scenarioTerms = ["\u4FEE\u590D\u56DE\u8865", "\u57FA\u672C\u9762\u786E\u8BA4", "\u91CD\u65B0\u5B9A\u4EF7"];
  if (scenarioTerms.some((term) => countOccurrences(combined, term) > 2)) {
    findings.push("scenario vocabulary is repeated across too many surfaces");
  }
  const targetExplanations = Object.values(snapshot.analysis.targetExplanations).map(normalizeText);
  if (new Set(targetExplanations).size !== targetExplanations.length) {
    findings.push("target explanations are not target-specific");
  }
  const score = Math.max(0, 100 - findings.length * 12);
  return {
    score,
    passed: findings.length === 0,
    findings,
    surfaces
  };
}
function evaluateSnapshotSurface(snapshot) {
  const results = snapshot.predictions.map((prediction) => evaluateFrontendSurface(snapshot, prediction));
  const findings = Array.from(new Set(results.flatMap((result) => result.findings)));
  const score = Math.min(...results.map((result) => result.score));
  return {
    score,
    passed: findings.length === 0,
    findings,
    surfaces: results[0]?.surfaces ?? []
  };
}
function normalizeText(value) {
  return value.replace(/\s+/g, "").replace(/[，。；：:,.]/g, "").toLowerCase();
}
function countOccurrences(value, phrase) {
  return value.split(phrase).length - 1;
}

// src/research/subagents/MarketSubagent.ts
var MarketSubagent = class {
  constructor(marketProvider) {
    this.marketProvider = marketProvider;
  }
  marketProvider;
  async run(input) {
    const quote2 = await this.marketProvider.fetchQuote(input.symbol);
    const history = await this.marketProvider.fetchHistory(input.symbol, input.days);
    return { quote: quote2, history };
  }
};

// src/research/subagents/NewsSubagent.ts
var NewsSubagent = class {
  constructor(newsProvider, officialProvider) {
    this.newsProvider = newsProvider;
    this.officialProvider = officialProvider;
  }
  newsProvider;
  officialProvider;
  async run(input) {
    const news = await this.newsProvider.fetch(input.query, input.sinceHours);
    const official = await this.officialProvider.fetchRecentItems(input.officialSinceHours);
    return {
      news,
      official,
      allItems: [...news, ...official]
    };
  }
};

// src/research/subagents/EventSubagent.ts
var EventSubagent = class {
  constructor(eventEngine) {
    this.eventEngine = eventEngine;
  }
  eventEngine;
  async run(input) {
    const events = await this.eventEngine.classifyEvents(input.rawItems);
    return { events };
  }
};

// src/research/subagents/MemorySubagent.ts
var MemorySubagent = class {
  constructor(memoryEngine) {
    this.memoryEngine = memoryEngine;
  }
  memoryEngine;
  async run(input) {
    const memories = this.memoryEngine.retrieveRelevantMemories({
      events: input.events,
      target: input.target,
      now: input.now
    });
    return {
      memories,
      newCandidates: []
    };
  }
};

// src/research/subagents/FactorSubagent.ts
var FactorSubagent = class {
  constructor(factorEngine) {
    this.factorEngine = factorEngine;
  }
  factorEngine;
  async run(input) {
    const factors = this.factorEngine.generateFactors(
      input.quote,
      input.history,
      input.events,
      input.memories ?? []
    );
    return { factors };
  }
};

// src/research/subagents/ProbabilitySubagent.ts
var ProbabilitySubagent = class {
  async run(input) {
    const predictions = calculateTargetPredictions({
      quote: input.quote,
      history: input.history,
      events: input.events,
      memories: input.memories,
      factors: input.factors,
      previousSnapshot: input.previousSnapshot
    });
    return { predictions };
  }
};

// src/research/subagents/ForecastSubagent.ts
var ForecastSubagent = class {
  async run(input) {
    return {
      predictions: input.predictions.map((prediction) => ({
        ...prediction,
        nearTermForecast: buildNearTermForecast({
          target: prediction.target,
          probability: prediction.probability,
          likelyWindow: prediction.likelyWindow,
          positiveDrivers: prediction.positiveDrivers,
          negativeDrivers: prediction.negativeDrivers,
          quote: input.quote,
          history: input.history,
          factors: input.factors,
          events: input.events,
          memories: input.memories,
          previousPrediction: input.previousSnapshot?.predictions.find((item) => item.target === prediction.target)
        })
      }))
    };
  }
};

// src/research/subagents/AnalysisSubagent.ts
var AnalysisSubagent = class {
  constructor(analysisEngine, llmProvider) {
    this.analysisEngine = analysisEngine;
    this.llmProvider = llmProvider;
  }
  analysisEngine;
  llmProvider;
  async run(input) {
    const analysis = await this.analysisEngine.generateAnalysis(
      input.quote,
      input.predictions,
      input.events,
      input.factors,
      this.llmProvider
    );
    return { analysis };
  }
};

// src/research/engines/riskReview.ts
var blockedTerms = [
  "\u5EFA\u8BAE\u4E70\u5165",
  "\u5EFA\u8BAE\u5356\u51FA",
  "\u5EFA\u8BAE\u6301\u6709",
  "\u6EE1\u4ED3",
  "\u91CD\u4ED3",
  "\u6284\u5E95",
  "\u6B62\u635F",
  "\u6B62\u76C8",
  "\u7A33\u8D5A",
  "\u5FC5\u6DA8",
  "\u4E00\u5B9A\u4F1A\u6DA8",
  "\u65E0\u98CE\u9669",
  "\u76EE\u6807\u4EF7\u5FC5\u8FBE",
  "\u81EA\u52A8\u4E0B\u5355",
  "\u4ED3\u4F4D\u7BA1\u7406",
  "\u5238\u5546\u63A5\u5165",
  "broker integration",
  "order placement",
  "position sizing",
  "buy",
  "sell",
  "hold"
];
function reviewBlockedTerms(text) {
  const normalized = text.toLowerCase();
  return blockedTerms.filter((term) => normalized.includes(term.toLowerCase())).map((term) => ({
    code: "BLOCKED_TERM",
    severity: "high",
    message: `\u7981\u6B62\u6295\u8D44\u5EFA\u8BAE\u8BED\u8A00: ${term}`
  }));
}
function reviewProbabilityOrdering(predictions) {
  const issues = [];
  for (let i = 1; i < predictions.length; i++) {
    if (predictions[i].probability > predictions[i - 1].probability) {
      issues.push({
        code: "PROBABILITY_ORDER",
        severity: "high",
        message: `P${predictions[i].target} (${predictions[i].probability}%) > P${predictions[i - 1].target} (${predictions[i - 1].probability}%)`
      });
    }
  }
  return issues;
}
function reviewProbabilityBounds(predictions) {
  return predictions.filter((p) => p.probability < 5 || p.probability > 95).map((p) => ({
    code: "PROBABILITY_BOUNDS",
    severity: "high",
    message: `P${p.target} \u6982\u7387 ${p.probability}% \u8D85\u51FA 5%-95% \u8303\u56F4`
  }));
}
function qualitySeverityToRisk(severity) {
  if (severity === "critical") return "high";
  if (severity === "warning") return "medium";
  return "low";
}
function reviewResearchQuality(snapshot) {
  const issues = [];
  if (!snapshot.calibration || !snapshot.quality) {
    return [
      {
        code: "MISSING_RESEARCH_QUALITY_AUDIT",
        severity: "high",
        message: "\u7F3A\u5C11\u6821\u51C6\u62A5\u544A\u6216\u7814\u7A76\u8D28\u91CF\u62A5\u544A\uFF0C\u4E0D\u80FD\u53D1\u5E03\u3002"
      }
    ];
  }
  for (const finding of snapshot.quality.findings) {
    issues.push({
      code: finding.code,
      severity: qualitySeverityToRisk(finding.severity),
      message: finding.message
    });
  }
  if (snapshot.quality.overallScore < 70) {
    issues.push({
      code: "RESEARCH_QUALITY_SCORE",
      severity: "high",
      message: `\u7814\u7A76\u8D28\u91CF ${snapshot.quality.overallScore}/100 \u4F4E\u4E8E\u53D1\u5E03\u9608\u503C\u3002`
    });
  } else if (snapshot.quality.overallScore < 85) {
    issues.push({
      code: "RESEARCH_QUALITY_SCORE",
      severity: "medium",
      message: `\u7814\u7A76\u8D28\u91CF ${snapshot.quality.overallScore}/100 \u504F\u4F4E\uFF0C\u5EFA\u8BAE\u8865\u5145\u8BC1\u636E\u3002`
    });
  }
  if (snapshot.calibration.status === "ready" && snapshot.calibration.brierScore !== null && snapshot.calibration.brierScore > 0.35) {
    issues.push({
      code: "CALIBRATION_BRIER_WEAK",
      severity: "medium",
      message: `Brier score ${snapshot.calibration.brierScore} \u504F\u9AD8\uFF0C\u9700\u8981\u590D\u6838\u6982\u7387\u6A21\u578B\u3002`
    });
  }
  return issues;
}
function reviewSnapshot(snapshot, previousSnapshot, events = []) {
  const issues = [];
  issues.push(...reviewBlockedTerms(JSON.stringify(snapshot.analysis)));
  issues.push(...reviewProbabilityOrdering(snapshot.predictions));
  issues.push(...reviewProbabilityBounds(snapshot.predictions));
  issues.push(...reviewNearTermForecasts(snapshot.predictions));
  issues.push(...reviewResearchQuality(snapshot));
  if (previousSnapshot) {
    for (const prediction of snapshot.predictions) {
      const previousPrediction = previousSnapshot.predictions.find((p) => p.target === prediction.target);
      issues.push(...reviewProbabilityJump(prediction, previousPrediction?.probability, events));
    }
  }
  if (!snapshot.analysis.headline) {
    issues.push({
      code: "MISSING_HEADLINE",
      severity: "medium",
      message: "\u7F3A\u5C11 headline"
    });
  }
  if (snapshot.analysis.positives.length !== 3) {
    issues.push({
      code: "POSITIVES_COUNT",
      severity: "medium",
      message: `\u6B63\u9762\u56E0\u7D20\u5E94\u4E3A 3 \u6761\uFF0C\u5B9E\u9645 ${snapshot.analysis.positives.length} \u6761`
    });
  }
  if (snapshot.analysis.negatives.length !== 3) {
    issues.push({
      code: "NEGATIVES_COUNT",
      severity: "medium",
      message: `\u8D1F\u9762\u56E0\u7D20\u5E94\u4E3A 3 \u6761\uFF0C\u5B9E\u9645 ${snapshot.analysis.negatives.length} \u6761`
    });
  }
  if (snapshot.analysis.watch.length !== 3) {
    issues.push({
      code: "WATCH_COUNT",
      severity: "medium",
      message: `\u89C2\u5BDF\u70B9\u5E94\u4E3A 3 \u6761\uFF0C\u5B9E\u9645 ${snapshot.analysis.watch.length} \u6761`
    });
  }
  const highSeverity = issues.filter((i) => i.severity === "high");
  return {
    approved: highSeverity.length === 0,
    issues
  };
}
function reviewProbabilityJump(prediction, previousProbability, events, normalLimit = 5, majorEventLimit = 10) {
  if (previousProbability === void 0) return [];
  const jump = Math.abs(prediction.probability - previousProbability);
  const hasMajorEvent = events.some((e) => e.importance >= 8);
  const limit = hasMajorEvent ? majorEventLimit : normalLimit;
  if (jump > limit) {
    return [
      {
        code: "PROBABILITY_JUMP",
        severity: "high",
        message: `P${prediction.target} \u6982\u7387\u8DF3\u53D8 ${jump.toFixed(1)} pct\uFF0C\u8D85\u8FC7\u9650\u5236 ${limit} pct`
      }
    ];
  }
  return [];
}
function reviewNearTermForecasts(predictions) {
  const issues = [];
  for (const prediction of predictions) {
    const forecast = prediction.nearTermForecast;
    if (!forecast) {
      issues.push({
        code: "MISSING_NEAR_TERM_FORECAST",
        severity: "high",
        message: `P${prediction.target} \u7F3A\u5C11\u4E00\u5468\u5927\u80C6\u9884\u6D4B\u7A97\u53E3`
      });
      continue;
    }
    issues.push(...reviewBlockedTerms(`${forecast.label} ${forecast.thesis} ${forecast.trigger} ${forecast.invalidation}`));
    const start = Date.parse(`${forecast.windowStart}T00:00:00Z`);
    const end = Date.parse(`${forecast.windowEnd}T00:00:00Z`);
    const spanDays = (end - start) / (24 * 60 * 60 * 1e3);
    if (!Number.isFinite(start) || !Number.isFinite(end) || spanDays !== 6) {
      issues.push({
        code: "NEAR_TERM_FORECAST_WINDOW",
        severity: "high",
        message: `P${prediction.target} \u5927\u80C6\u9884\u6D4B\u5FC5\u987B\u7CBE\u786E\u4E3A 7 \u5929\u7A97\u53E3`
      });
    }
    if (!forecast.label || !forecast.thesis || !forecast.trigger || !forecast.invalidation) {
      issues.push({
        code: "NEAR_TERM_FORECAST_COPY",
        severity: "medium",
        message: `P${prediction.target} \u5927\u80C6\u9884\u6D4B\u7F3A\u5C11\u89E3\u91CA\u3001\u89E6\u53D1\u5668\u6216\u5931\u6548\u70B9`
      });
    }
    if (forecast.modelName !== "context-weighted-week-forecast-v0.2" || typeof forecast.contextScore !== "number" || !forecast.evidenceSummary || !forecast.agentDebate) {
      issues.push({
        code: "NEAR_TERM_FORECAST_CONTEXT",
        severity: "high",
        message: `P${prediction.target} \u5927\u80C6\u9884\u6D4B\u7F3A\u5C11\u4E0A\u4E0B\u6587\u6A21\u578B\u3001\u8BC1\u636E\u6458\u8981\u6216 agent debate`
      });
    }
  }
  return issues;
}

// src/research/subagents/RiskReviewSubagent.ts
var RiskReviewSubagent = class {
  async run(input) {
    const result = reviewSnapshot(input.snapshot, input.previousSnapshot, input.events ?? []);
    return { result };
  }
};

// src/research/engines/publish/PublishEngine.ts
var PublishEngine = class {
  constructor(repository) {
    this.repository = repository;
  }
  repository;
  saveDraft(snapshot) {
    return this.repository.saveDraft(snapshot);
  }
  markValidated(runId, reviewResult) {
    if (!reviewResult.approved) {
      return this.reject(runId, reviewResult.issues);
    }
    return this.repository.markValidated(runId);
  }
  reject(runId, issues) {
    return this.repository.reject(runId, issues);
  }
  async publishValidated(runId) {
    return this.repository.publish(runId);
  }
  async publish(snapshot, reviewResult) {
    this.saveDraft(snapshot);
    if (!reviewResult.approved) {
      this.reject(snapshot.runId, reviewResult.issues);
      throw new Error(
        `Cannot publish: review failed with ${reviewResult.issues.length} issues`
      );
    }
    this.markValidated(snapshot.runId, reviewResult);
    return this.publishValidated(snapshot.runId);
  }
  getLatest() {
    return this.repository.getLatestPublished();
  }
};

// src/research/subagents/PublishSubagent.ts
var PublishSubagent = class {
  publishEngine;
  constructor(repository) {
    this.publishEngine = new PublishEngine(repository);
  }
  async run(input) {
    const published = await this.publishEngine.publish(
      input.snapshot,
      input.reviewResult
    );
    return { published };
  }
};

// raw-text:/Users/jiaqi/Documents/beke19/src/data/price/beke-us-daily-2024-07-04_2026-07-04.csv
var beke_us_daily_2024_07_04_2026_07_04_default = "Date,Open,High,Low,Close,AdjustedClose,Volume\n2024-07-05,15.31,15.42,15.21,15.34,14.751973,7219600\n2024-07-08,15.14,15.155,14.62,14.73,14.165356,7695400\n2024-07-09,14.8,15.23,14.66,15.16,14.578873,9116500\n2024-07-10,15.06,15.51,14.97,15.49,14.896222,4620100\n2024-07-11,15.75,15.945,15.32,15.32,14.732739,6722200\n2024-07-12,15.69,16.129999,15.49,15.63,15.030857,6708000\n2024-07-15,15.2,15.425,14.7,14.75,14.184589,9843700\n2024-07-16,14.84,14.95,14.67,14.8,14.232674,9796200\n2024-07-17,14.55,14.73,14.29,14.38,13.828773,9114800\n2024-07-18,14.34,14.51,14.175,14.3,13.751839,8398000\n2024-07-19,14.19,14.27,14.05,14.12,13.578739,5968800\n2024-07-22,14.43,14.56,14.15,14.32,13.771072,6493300\n2024-07-23,14.02,14.25,13.79,13.83,13.299855,11954700\n2024-07-24,13.79,13.88,13.595,13.64,13.11714,5669700\n2024-07-25,13.54,13.745,13.39,13.52,13.00174,7279800\n2024-07-26,13.66,13.9,13.575,13.79,13.261389,3464900\n2024-07-29,13.85,14.09,13.81,13.93,13.396023,4426400\n2024-07-30,13.87,13.9,13.5,13.51,12.992123,4668900\n2024-07-31,13.93,14.05,13.8,13.85,13.31909,3974800\n2024-08-01,13.76,13.83,13.39,13.4,12.886338,3362600\n2024-08-02,13.28,13.45,13.13,13.29,12.780556,5498800\n2024-08-05,12.96,13.615,12.92,13.54,13.020972,7163200\n2024-08-06,13.55,13.81,13.43,13.61,13.088288,6625700\n2024-08-07,13.73,13.84,13.2,13.23,12.722856,6333800\n2024-08-08,13.56,14.025,13.32,14,13.46334,6659000\n2024-08-09,13.94,14.06,13.78,14.03,13.492189,6145100\n2024-08-12,15.7,15.83,14.5,14.8,14.232674,11037200\n2024-08-13,14.6,14.84,14.45,14.76,14.194206,7709400\n2024-08-14,14.53,15.12,14.53,14.95,14.376923,4859000\n2024-08-15,14.95,15.415,14.915,15.17,14.58849,4466200\n2024-08-16,15.1,15.38,14.8,14.88,14.309607,3787800\n2024-08-19,14.95,15.25,14.91,15.23,14.646189,5185800\n2024-08-20,14.94,14.96,14.405,14.61,14.049955,4532700\n2024-08-21,14.56,14.925,14.4,14.77,14.203823,5510200\n2024-08-22,14.76,14.96,14.685,14.88,14.309607,3883100\n2024-08-23,14.94,15.14,14.82,15.1,14.521173,4413200\n2024-08-26,14.95,15.135,14.775,14.85,14.280757,3431600\n2024-08-27,14.87,14.93,14.33,14.53,13.973022,2788000\n2024-08-28,14.34,14.385,13.74,13.89,13.357555,5231900\n2024-08-29,14.18,14.48,14.16,14.44,13.886473,5103200\n2024-08-30,15,15.14,14.81,14.84,14.271139,7098700\n2024-09-03,14.56,14.77,14.48,14.67,14.107656,4758000\n2024-09-04,15,15.05,14.7,14.72,14.15574,2456900\n2024-09-05,14.9,15.03,14.68,14.84,14.271139,2048100\n2024-09-06,14.66,14.96,14.55,14.61,14.049955,2162700\n2024-09-09,14.42,14.575,14.25,14.52,13.963407,2297000\n2024-09-10,14.36,14.4,14.17,14.2,13.655672,3111400\n2024-09-11,14,14.15,13.81,14.11,13.569122,4390300\n2024-09-12,14.11,14.11,13.53,13.59,13.069056,6007200\n2024-09-13,13.53,13.67,13.28,13.39,12.876722,7667900\n2024-09-16,13.43,13.51,13.3,13.36,12.847872,6320800\n2024-09-17,13.47,13.88,13.41,13.78,13.251772,5990000\n2024-09-18,13.94,14.27,13.905,14.04,13.501805,5237400\n2024-09-19,14.82,15.22,14.76,15.22,14.636573,11153400\n2024-09-20,15.04,15.21,14.34,14.37,13.819156,9699700\n2024-09-23,14.59,15.52,14.55,15.45,14.857757,14478000\n2024-09-24,16.799999,16.99,16.299999,16.93,16.281023,27368400\n2024-09-25,16.08,16.49,15.63,16.35,15.723257,11968700\n2024-09-26,18.9,20.48,18.809999,19.690001,18.935226,50645600\n2024-09-27,20.040001,20.200001,19.434999,20,19.233341,22480900\n2024-09-30,22.24,22.85,19.790001,19.91,19.146791,50798700\n2024-10-01,20.23,23.41,20.209999,23.379999,22.483776,38673000\n2024-10-02,25.74,26.040001,23.51,24.57,23.62816,65370300\n2024-10-03,23.27,25.780001,23.18,25.709999,24.724461,27876900\n2024-10-04,25.200001,26.045,24.879999,25.799999,24.81101,25421800\n2024-10-07,25.889999,25.889999,22.955,24.290001,23.358894,26846400\n2024-10-08,21.719999,22.719999,21.51,22.26,21.40671,23642600\n2024-10-09,21.360001,21.719999,20.629999,21.610001,20.781626,20924100\n2024-10-10,21.67,21.879999,20.67,21.559999,20.733543,16545300\n2024-10-11,20.84,22.950001,20.84,22.41,21.550961,13800800\n2024-10-14,22.469999,23.690001,22.110001,22.309999,21.454792,14237200\n2024-10-15,21.82,22.139999,20.879999,20.950001,20.146925,15847100\n2024-10-16,21.700001,22.42,21.360001,21.93,21.089359,14851300\n2024-10-17,20.33,20.344999,18.950001,19.469999,18.723658,18198200\n2024-10-18,20.940001,21.4,20.5,21.1,20.291176,13883500\n2024-10-21,20.59,20.927999,20.08,20.530001,19.743025,8190300\n2024-10-22,20.58,21.208,20.559999,20.84,20.041143,6791000\n2024-10-23,20.91,21.16,20.51,20.65,19.858423,4147100\n2024-10-24,20.5,20.625,20.18,20.43,19.646858,7579400\n2024-10-25,20.9,21.129999,20.440001,20.780001,19.983442,6164700\n2024-10-28,21.190001,22.299999,21.15,22.08,21.23361,13272500\n2024-10-29,22.52,23.18,22.09,22.16,21.310541,14279200\n2024-10-30,21.780001,22.605,21.711,22.17,21.32016,7400900\n2024-10-31,22.389999,22.91,21.825001,21.93,21.089359,8931300\n2024-11-01,22.1,22.525,21.934999,22.09,21.243225,8327000\n2024-11-04,22.129999,22.6,21.969999,22.17,21.32016,6815000\n2024-11-05,22.530001,22.75,22.23,22.6,21.733677,4489300\n2024-11-06,22.09,22.620001,21.709999,22.49,21.627892,7702100\n2024-11-07,23.809999,24.57,23.26,23.5,22.599176,11713000\n2024-11-08,22.26,22.32,20.75,20.99,20.185392,15040100\n2024-11-11,21.219999,21.68,20.879999,21.219999,20.406574,8088300\n2024-11-12,20.57,21.139999,20.27,20.4,19.618008,9088700\n2024-11-13,21.030001,21.09,19.9,19.98,19.214108,9154500\n2024-11-14,19.34,19.57,19.08,19.360001,18.617876,8241600\n2024-11-15,19.65,19.905001,19.42,19.52,18.771742,7431500\n2024-11-18,19.889999,20.6,19.799999,20.549999,19.762257,7571900\n2024-11-19,20.379999,20.715,20.120001,20.629999,19.839191,7144300\n2024-11-20,20.34,20.76,20.055,20.23,19.454523,6814100\n2024-11-21,19.25,20.518,18.85,19.98,19.214108,11141900\n2024-11-22,19.389999,19.530001,18.92,19.4,18.656342,10879600\n2024-11-25,18.870001,19.030001,18.379999,18.4,17.694674,11681100\n2024-11-26,18.4,18.780001,18.01,18.719999,18.002407,8272400\n2024-11-27,19.219999,19.620001,19,19.01,18.281292,7305700\n2024-11-29,19.059999,19.094999,18.51,18.85,18.127424,4926400\n2024-12-02,19.08,19.309999,18.870001,19.309999,18.56979,5333500\n2024-12-03,19.389999,19.57,19.23,19.280001,18.540941,4258600\n2024-12-04,19.110001,19.120001,18.615,18.91,18.185125,5534900\n2024-12-05,18.67,19.01,18.629999,18.82,18.098574,4069100\n2024-12-06,19.139999,19.24,18.73,18.82,18.098574,5589600\n2024-12-09,21.139999,22.5,20.85,21.02,20.214243,22087800\n2024-12-10,20.08,20.844999,20,20.34,19.560308,8221000\n2024-12-11,20.290001,20.83,20.07,20.51,19.723793,5556200\n2024-12-12,19.879999,20.4,19.540001,20.09,19.319893,6623500\n2024-12-13,19.610001,19.837,18.92,19.42,18.675575,10994200\n2024-12-16,19,19.299999,18.790001,18.85,18.127424,7379600\n2024-12-17,18.700001,19.389999,18.58,19.01,18.281292,6130100\n2024-12-18,18.82,19.125,18.41,18.58,17.867775,5044700\n2024-12-19,18.620001,18.620001,18.174999,18.26,17.560041,5482200\n2024-12-20,18.07,18.559999,17.889999,18.379999,17.67544,5102300\n2024-12-23,18.15,18.469999,18.040001,18.41,17.70429,2580600\n2024-12-24,18.82,18.84,18.459999,18.48,17.771608,1952600\n2024-12-26,18.440001,18.66,18.32,18.52,17.810076,2938600\n2024-12-27,18.309999,18.59,18.129999,18.49,17.781223,3237500\n2024-12-30,18.360001,18.555,18.23,18.43,17.723524,4999800\n2024-12-31,18.43,18.775,18.219999,18.42,17.713909,3390400\n2025-01-02,18.200001,18.41,17.700001,17.860001,17.175375,4385500\n2025-01-03,17.719999,18.059999,17.51,18.030001,17.33886,3686100\n2025-01-06,18.299999,18.334,17.691,17.74,17.059973,5965600\n2025-01-07,17.5,17.57,16.75,16.99,16.338722,14520300\n2025-01-08,16.84,16.950001,16.4,16.620001,15.982907,8737400\n2025-01-10,16.219999,16.535,16.049999,16.4,15.77134,11223300\n2025-01-13,16.75,16.775,16.370001,16.379999,15.752106,6762000\n2025-01-14,16.92,17.08,16.4,16.57,15.934822,5347300\n2025-01-15,16.9,16.969999,16.559999,16.67,16.030991,2899900\n2025-01-16,16.35,16.77,16.35,16.690001,16.050224,4623000\n2025-01-17,16.65,17.41,16.65,17.1,16.444508,8488200\n2025-01-21,17.860001,17.98,16.9,16.9,16.252172,9195900\n2025-01-22,16.719999,17.139999,16.67,16.870001,16.223324,3747900\n2025-01-23,16.639999,16.700001,16.285,16.58,15.944441,7789200\n2025-01-24,17.040001,17.23,16.870001,17.110001,16.454124,8061500\n2025-01-27,17.16,17.645,16.93,17.52,16.848408,7215400\n2025-01-28,17.5,17.5,16.895,17.15,16.49259,5526400\n2025-01-29,17.43,17.6,17.200001,17.360001,16.694542,5529500\n2025-01-30,17.540001,18.9,17.49,18.32,17.617741,8930400\n2025-01-31,18.43,18.43,17.280001,17.43,16.761858,4830000\n2025-02-03,17.08,17.33,16.42,16.5,15.867507,7325400\n2025-02-04,16.98,17.790001,16.955,17.379999,16.713772,6996600\n2025-02-05,17.200001,17.4,16.92,17.200001,16.540674,8315900\n2025-02-06,17.75,18.15,17.584999,17.860001,17.175375,5745400\n2025-02-07,18.33,18.530001,17.889999,17.92,17.233074,4630500\n2025-02-10,18.459999,19.25,18.34,19.01,18.281292,8817800\n2025-02-11,18.98,19.57,18.860001,19.469999,18.723658,14586300\n2025-02-12,21.040001,21.360001,20.459999,20.52,19.733408,16440700\n2025-02-13,19.959999,20.395,19.889999,20.389999,19.608391,11401100\n2025-02-14,21.01,21.035,20.17,20.5,19.714174,8234300\n2025-02-18,20.59,20.59,19.4,19.610001,18.858292,12733000\n2025-02-19,20.6,20.620001,19.91,20.02,19.252577,9503800\n2025-02-20,20.6,21.139999,19.860001,20.219999,19.444908,8385000\n2025-02-21,20.799999,21.385,20.65,20.9,20.098843,8920300\n2025-02-24,21.24,21.309999,20.139999,20.379999,19.598774,8179100\n2025-02-25,21.120001,21.77,21.09,21.25,20.435425,11590000\n2025-02-26,23.254999,23.43,22.709999,22.870001,21.993326,19312900\n2025-02-27,23.09,23.26,22.700001,22.9,22.022177,11776600\n2025-02-28,22.32,22.709999,21.860001,22.27,21.416327,19709400\n2025-03-03,22.139999,22.35,21.76,22.110001,21.262461,8258800\n2025-03-04,22.299999,22.75,21.815001,22.32,21.464409,6855800\n2025-03-05,22.9,24.514999,22.74,24.379999,23.445442,13942300\n2025-03-06,24.35,24.99,24.17,24.459999,23.522375,11068800\n2025-03-07,24.49,24.889999,23.879999,24.26,23.330044,9185500\n2025-03-10,23.65,23.885,22.25,22.469999,21.60866,14121900\n2025-03-11,23.5,23.6,22.57,23.42,22.522243,12913500\n2025-03-12,22.299999,22.725,21.870001,22.459999,21.599041,8447900\n2025-03-13,22.139999,22.665001,21.700001,22.440001,21.579811,6701700\n2025-03-14,24.26,24.450001,23.834999,24.389999,23.455059,11068900\n2025-03-17,24.67,25.165001,24.48,25.09,24.128227,15124100\n2025-03-18,23.65,23.940001,22.205,23.27,22.377993,26154000\n2025-03-19,22.549999,22.57,21.93,22.450001,21.589426,17581400\n2025-03-20,21.34,21.99,21.280001,21.549999,20.723925,20011300\n2025-03-21,21,21.110001,20.49,20.639999,19.848808,17669500\n2025-03-24,20.870001,21.190001,20.620001,20.639999,19.848808,14891000\n2025-03-25,20.16,20.950001,20.059999,20.379999,19.598774,7007000\n2025-03-26,20.719999,21.15,20.51,20.690001,19.896893,7797400\n2025-03-27,21.42,21.68,21.129999,21.190001,20.377726,12307400\n2025-03-28,20.83,21.059999,20.395,20.59,19.800724,8301800\n2025-03-31,20,20.285,19.959999,20.09,19.319893,13854000\n2025-04-01,20.33,20.67,20.1,20.370001,19.589159,4785200\n2025-04-02,20.370001,20.549999,20.09,20.43,19.646858,6520900\n2025-04-03,20.290001,21.41,20.15,20.98,20.175774,12384600\n2025-04-04,18.99,19.77,18.674999,19.559999,18.810207,11125700\n2025-04-07,18.25,19.639999,17.67,18.290001,17.588892,15140000\n2025-04-08,18.85,19.045,17.09,17.530001,16.858025,20106900\n2025-04-09,17.65,18.540001,17.035,18.34,18.006765,15940400\n2025-04-10,18.450001,18.834999,17.945,18.08,17.75149,10659700\n2025-04-11,17.879999,18.629999,17.35,18.440001,18.10495,12417100\n2025-04-14,18.99,19.594999,18.93,19.299999,18.949322,13913400\n2025-04-15,19.139999,19.475,19.09,19.34,18.988596,5233500\n2025-04-16,18.98,19.469999,18.91,19.360001,19.008232,7098700\n2025-04-17,20.01,20.09,18.99,19.030001,18.684229,11293300\n2025-04-21,19,19.5,18.85,19.49,19.13587,7213300\n2025-04-22,19.860001,20.52,19.805,20.24,19.872242,8768400\n2025-04-23,21.15,21.709999,20.969999,21.1,20.716618,11641600\n2025-04-24,21.190001,22.25,21.110001,22.08,21.67881,8459000\n2025-04-25,21.01,21.459999,20.950001,21.4,21.011166,6270600\n2025-04-28,20.780001,21.43,20.66,21.120001,20.736254,5542200\n2025-04-29,20.92,21.15,20.66,20.73,20.353338,4738600\n2025-04-30,20.57,20.735001,20.120001,20.299999,19.931152,5422200\n2025-05-01,20.440001,20.65,20.34,20.530001,20.156975,2972600\n2025-05-02,21.15,21.26,20.695,20.790001,20.412251,3286700\n2025-05-05,20.780001,20.9,20.424999,20.83,20.451523,2963500\n2025-05-06,20.959999,20.969999,20.27,20.549999,20.176609,4982600\n2025-05-07,20.290001,20.530001,19.58,19.59,19.234053,7395100\n2025-05-08,19.43,19.455,19.139999,19.32,18.968958,5442100\n2025-05-09,19.27,19.57,19.155001,19.299999,18.949322,3062500\n2025-05-12,20.08,20.115,19.620001,19.84,19.479511,6575700\n2025-05-13,19.879999,20.389999,19.76,20,19.636604,9202300\n2025-05-14,20.139999,20.299999,19.83,20.23,19.862425,5757000\n2025-05-15,19.139999,19.48,18.799999,19.16,18.811867,10917200\n2025-05-16,19.1,19.398001,18.9,19.23,18.880594,8160900\n2025-05-19,19.08,19.15,18.715,19.049999,18.703865,6874900\n2025-05-20,18.74,18.879999,18.5,18.610001,18.27186,7458000\n2025-05-21,18.709999,18.962999,18.315001,18.360001,18.026403,4305300\n2025-05-22,18.299999,18.49,18.040001,18.32,17.987129,5040900\n2025-05-23,18.295,18.52,18.25,18.43,18.095131,6085900\n2025-05-27,18.190001,18.455,18.15,18.34,18.006765,3731200\n2025-05-28,18.48,18.690001,18.41,18.41,18.075493,4813400\n2025-05-29,18.610001,18.860001,18.549999,18.629999,18.291496,5445100\n2025-05-30,18.84,18.945,18.450001,18.459999,18.124584,17638900\n2025-06-02,18.299999,18.389999,17.959999,18,17.672943,7098800\n2025-06-03,18.219999,18.450001,18.09,18.360001,18.026403,6632600\n2025-06-04,18.59,18.934999,18.514999,18.68,18.340588,12485900\n2025-06-05,18.879999,19.059999,18.705,18.780001,18.438772,7006300\n2025-06-06,18.690001,18.879999,18.629999,18.790001,18.448589,8993900\n2025-06-09,18.85,18.99,18.76,18.84,18.497681,6176500\n2025-06-10,19,19.360001,18.945,19.280001,18.929686,15520500\n2025-06-11,19.32,19.66,19.030001,19.030001,18.684229,6989100\n2025-06-12,19.09,19.295,18.9,18.99,18.644955,11102100\n2025-06-13,19.219999,19.450001,18.27,18.469999,18.134403,47445000\n2025-06-16,19.299999,19.434999,18.950001,19.190001,18.841322,18846200\n2025-06-17,19,19.254999,18.9,18.92,18.576227,14423700\n2025-06-18,18.35,18.49,17.9,18.129999,17.800581,10550900\n2025-06-20,18.1,18.26,17.975,18,17.672943,11114300\n2025-06-23,18.030001,18.209999,17.93,18.09,17.761309,7117400\n2025-06-24,18.24,18.68,18.125,18.450001,18.114767,13832300\n2025-06-25,18.65,18.68,18.299999,18.33,17.996946,5328600\n2025-06-26,18.42,18.530001,18.195,18.440001,18.10495,4441700\n2025-06-27,18.49,18.65,18.42,18.540001,18.203133,3210300\n2025-06-30,18.23,18.27,17.639999,17.74,17.417667,10040600\n2025-07-01,17.66,17.809999,17.469999,17.76,17.437304,9472000\n2025-07-02,17.66,17.73,17.450001,17.65,17.329302,4369400\n2025-07-03,17.68,17.834999,17.6,17.67,17.34894,2811900\n2025-07-07,17.809999,18.190001,17.709999,18.049999,17.722034,7099100\n2025-07-08,18.110001,18.24,17.92,18.049999,17.722034,4325200\n2025-07-09,18.059999,18.275,17.950001,18.26,17.928219,4195500\n2025-07-10,19.200001,19.49,18.9,19.450001,19.096598,9888200\n2025-07-11,19,19,18.43,18.48,18.14422,6292400\n2025-07-14,18.780001,19.110001,18.77,19.030001,18.684229,4534200\n2025-07-15,18.959999,19.040001,18.620001,18.98,18.635136,4183500\n2025-07-16,18.76,18.82,18.264999,18.68,18.340588,3888300\n2025-07-17,18.559999,18.889999,18.530001,18.860001,18.517319,6532500\n2025-07-18,19,19.135,18.77,18.790001,18.448589,4176200\n2025-07-21,19.129999,19.280001,19,19.040001,18.694048,6227700\n2025-07-22,19.16,19.379999,18.950001,19.33,18.978777,7102000\n2025-07-23,19.68,19.68,19.434999,19.58,19.224236,3474100\n2025-07-24,19.965,20.225,19.68,19.75,19.391146,5243500\n2025-07-25,19.530001,19.639999,19.315001,19.51,19.155506,2869600\n2025-07-28,19.610001,19.860001,19.360001,19.4,19.047504,2776000\n2025-07-29,19.1,19.33,18.9,18.940001,18.595863,4735100\n2025-07-30,18.76,18.789,18.530001,18.59,18.252224,4454000\n2025-07-31,18.1,18.615,17.93,18.42,18.085312,6175700\n2025-08-01,18,18.27,18,18.200001,17.86931,4616500\n2025-08-04,18.299999,18.389999,17.719999,17.870001,17.545305,6863500\n2025-08-05,17.790001,17.84,17.459999,17.559999,17.240938,5929700\n2025-08-06,17.690001,17.745001,17.26,17.52,17.201666,7875600\n2025-08-07,17.809999,18.014999,17.549999,17.6,17.280212,6522600\n2025-08-08,18,18.030001,17.559999,17.559999,17.240938,5725500\n2025-08-11,17.66,17.92,17.52,17.719999,17.398029,4482400\n2025-08-12,17.620001,17.945,17.504999,17.92,17.594397,4164500\n2025-08-13,18.190001,18.565001,18.190001,18.379999,18.046038,4840500\n2025-08-14,18.450001,18.610001,18.184999,18.389999,18.055857,3626300\n2025-08-15,18.35,18.559999,18.32,18.33,17.996946,2808800\n2025-08-18,18.26,18.469999,17.93,18.049999,17.722034,7433000\n2025-08-19,18.24,18.299999,17.975,18,17.672943,5719200\n2025-08-20,18.290001,18.389999,18.08,18.370001,18.036221,4485900\n2025-08-21,17.940001,18.555,17.9,18.33,17.996946,5930700\n2025-08-22,18.469999,18.665001,18.299999,18.530001,18.193314,4048100\n2025-08-25,19.200001,19.290001,18.799999,18.82,18.478045,10894700\n2025-08-26,18.24,19.700001,18.059999,18.58,18.242405,12274800\n2025-08-27,17.870001,18.110001,17.700001,17.790001,17.466761,8001000\n2025-08-28,17.620001,17.82,17.445,17.51,17.191847,5281000\n2025-08-29,17.530001,17.719999,17.450001,17.58,17.260574,6226300\n2025-09-02,17.844999,18.495001,17.83,18.440001,18.10495,8504100\n2025-09-03,18.43,18.775,18.4,18.459999,18.124584,4191100\n2025-09-04,18.540001,18.65,18.4,18.559999,18.222767,3835900\n2025-09-05,18.950001,19.08,18.639999,18.99,18.644955,6296400\n2025-09-08,19.120001,19.504999,19.02,19.219999,18.870775,5448900\n2025-09-09,19.690001,20.299999,19.66,19.91,19.548239,8163700\n2025-09-10,20.08,20.135,19.709999,19.91,19.548239,5166600\n2025-09-11,20.030001,20.18,19.83,20.16,19.793695,5532900\n2025-09-12,20.17,20.33,19.82,20.07,19.705332,5681600\n2025-09-15,19.834999,19.940001,19.565001,19.690001,19.332237,5430300\n2025-09-16,19.73,20.030001,19.68,19.99,19.626785,4594000\n2025-09-17,20.370001,20.98,20.040001,20.360001,19.990063,12816500\n2025-09-18,20.110001,20.18,19.780001,20.07,19.705332,5351200\n2025-09-19,19.879999,20.025,19.74,19.74,19.381327,5390400\n2025-09-22,19.65,19.780001,19.33,19.34,18.988596,3563100\n2025-09-23,19.219999,19.290001,18.73,18.73,18.389679,4076300\n2025-09-24,19.09,19.615,19.07,19.219999,18.870775,5407800\n2025-09-25,19.040001,19.52,19.040001,19.35,18.998415,3113000\n2025-09-26,19.389999,19.575001,19.23,19.450001,19.096598,3453100\n2025-09-29,19.99,20.65,19.93,20.209999,19.842787,5831200\n2025-09-30,19.799999,19.84,18.889999,19,18.654774,10820500\n2025-10-01,19,19.360001,18.92,19.299999,18.949322,7031000\n2025-10-02,19.040001,19.202999,18.74,18.950001,18.605682,5708600\n2025-10-03,18.99,19.139999,18.639999,18.700001,18.360226,3479400\n2025-10-06,18.700001,19.049999,18.66,18.969999,18.625319,4777400\n2025-10-07,19,19.01,18.280001,18.379999,18.046038,4023000\n2025-10-08,18.290001,18.530001,18.190001,18.5,18.163858,4729900\n2025-10-09,18.540001,18.6,18.32,18.360001,18.026403,4445600\n2025-10-10,18.540001,18.735001,17.5,17.65,17.329302,8757900\n2025-10-13,18.030001,18.5,17.75,18.01,17.682762,7383200\n2025-10-14,17.959999,18.379999,17.799999,18.209999,17.879128,4934100\n2025-10-15,18.559999,18.695,18.245001,18.33,17.996946,3090100\n2025-10-16,18.34,18.52,18.049999,18.280001,17.947857,3350700\n2025-10-17,17.950001,18.355,17.9,18.27,17.938038,3159800\n2025-10-20,18.389999,18.75,18.200001,18.74,18.399498,3266700\n2025-10-21,18.309999,18.629999,18.23,18.49,18.154039,2813800\n2025-10-22,18.33,18.635,18.190001,18.450001,18.114767,2607300\n2025-10-23,18.450001,18.559999,18.309999,18.42,18.085312,3141200\n2025-10-24,18.309999,18.4,17.709999,17.85,17.525669,7405100\n2025-10-27,18.16,18.424999,17.93,17.99,17.663124,4265100\n2025-10-28,17.76,18.030001,17.559999,17.950001,17.623852,2970800\n2025-10-29,18.02,18.040001,17.674999,17.76,17.437304,2607500\n2025-10-30,17.280001,17.5,17.07,17.200001,16.88748,4767100\n2025-10-31,17,17.1,16.780001,17.049999,16.740204,4148700\n2025-11-03,16.84,17.105,16.690001,16.85,16.543839,3456800\n2025-11-04,16.379999,16.49,15.95,16.219999,15.925284,7857100\n2025-11-05,16.1,16.290001,15.84,15.86,15.571826,7423700\n2025-11-06,16.139999,16.290001,15.79,15.8,15.512917,6015600\n2025-11-07,15.66,15.66,15.385,15.6,15.316551,7541800\n2025-11-10,16.26,16.42,15.71,16.129999,15.83692,7018300\n2025-11-11,16.459999,16.879999,16.24,16.41,16.111834,7423300\n2025-11-12,16.65,16.74,16.344999,16.68,16.376928,4522400\n2025-11-13,16.940001,17.225,16.51,16.75,16.445656,6857400\n2025-11-14,16.84,17.155001,16.75,16.85,16.543839,7193700\n2025-11-17,16.719999,16.975,16.545,16.67,16.367109,4123700\n2025-11-18,16.4,16.655001,16.35,16.629999,16.327835,2786300\n2025-11-19,16.629999,16.955,16.594999,16.799999,16.494747,5427300\n2025-11-20,17.305,17.549999,17,17.02,16.710751,7342600\n2025-11-21,17.120001,17.68,17.049999,17.5,17.182028,7621500\n2025-11-24,17.309999,17.35,17.1,17.32,17.005299,3682300\n2025-11-25,17.18,17.549999,17.18,17.41,17.093664,3345700\n2025-11-26,17.35,17.530001,17.09,17.209999,16.897297,3902600\n2025-11-28,17.24,17.434999,17.15,17.23,16.916933,2856000\n2025-12-01,17.120001,17.205,16.535,16.65,16.347471,8430700\n2025-12-02,16.594999,16.73,16.469999,16.73,16.426018,3708300\n2025-12-03,16.59,16.74,16.5,16.629999,16.327835,2495900\n2025-12-04,16.65,16.91,16.629999,16.799999,16.494747,3030600\n2025-12-05,17.040001,17.299999,17,17.18,16.867844,3442900\n2025-12-08,17.190001,17.32,17.07,17.08,16.769659,2252000\n2025-12-09,16.35,16.495001,16.135,16.42,16.121651,5924800\n2025-12-10,16.98,17.15,16.91,17.02,16.710751,5477000\n2025-12-11,17.57,17.66,17.434999,17.52,17.201666,7301400\n2025-12-12,17.370001,17.465,17.205,17.280001,16.966026,3915300\n2025-12-15,17.030001,17.030001,16.49,16.6,16.298382,5192500\n2025-12-16,16.5,16.575001,16.35,16.469999,16.170742,5181100\n2025-12-17,16.43,16.73,16.290001,16.370001,16.072561,3434100\n2025-12-18,16.209999,16.34,16.01,16.129999,15.83692,2733600\n2025-12-19,16,16.110001,15.94,16,15.709283,4927100\n2025-12-22,16.02,16.278999,16.002001,16.139999,15.846739,3347400\n2025-12-23,16.219999,16.219999,15.825,15.95,15.660192,3600500\n2025-12-24,16.1,16.205,16.01,16.040001,15.748557,1776500\n2025-12-26,16.120001,16.26,16.075001,16.219999,15.925284,2584100\n2025-12-29,16.1,16.23,16.040001,16.110001,15.817285,2781400\n2025-12-30,16.219999,16.23,15.83,15.84,15.55219,3532000\n2025-12-31,15.82,15.93,15.74,15.76,15.473644,6110200\n2026-01-02,16.18,16.35,15.26,16.059999,15.768192,12004300\n2026-01-05,16.83,17.280001,16.815001,17.110001,16.799114,8957900\n2026-01-06,17.450001,17.52,17.299999,17.379999,17.064207,8198700\n2026-01-07,17.030001,17.1,16.799999,16.82,16.514383,4782600\n2026-01-08,16.860001,17.360001,16.84,17.32,17.005299,6430000\n2026-01-09,17.280001,17.280001,16.885,17.040001,16.730387,3333800\n2026-01-12,17.27,17.68,17.254999,17.66,17.339121,4901400\n2026-01-13,17.32,17.41,16.92,17.040001,16.730387,4331500\n2026-01-14,17.129999,17.555,17.110001,17.32,17.005299,2866300\n2026-01-15,17.65,17.719999,17.360001,17.549999,17.231119,5316500\n2026-01-16,17.290001,17.51,17.129999,17.43,17.1133,3226200\n2026-01-20,18,18.25,17.565001,17.610001,17.29003,7395700\n2026-01-21,18.030001,18.389999,17.98,18.17,17.839855,5076700\n2026-01-22,18.27,18.4,18.129999,18.200001,17.86931,2984800\n2026-01-23,18.23,18.355,18.184999,18.219999,17.888945,3045300\n2026-01-26,18.200001,18.219999,18.004999,18.16,17.830036,2684900\n2026-01-27,18.1,18.125,17.895,17.959999,17.633669,2059400\n2026-01-28,18.459999,18.879999,18.440001,18.700001,18.360226,5095700\n2026-01-29,19.83,19.879999,19.120001,19.34,18.988596,8236900\n2026-01-30,19,19.15,18.57,18.719999,18.37986,5998800\n2026-02-02,18.42,18.700001,18.389999,18.4,18.065676,3843500\n2026-02-03,18.129999,18.26,17.695,18,17.672943,6189700\n2026-02-04,18.610001,18.84,18.174999,18.32,17.987129,11169800\n2026-02-05,18.32,18.725,18.32,18.42,18.085312,5118800\n2026-02-06,18.360001,18.719999,18.23,18.709999,18.370041,3353100\n2026-02-09,18.719999,18.9,18.57,18.690001,18.350407,3629600\n2026-02-10,18.51,18.725,18.379999,18.48,18.14422,4891500\n2026-02-11,18.860001,19.08,18.5,18.84,18.497681,4595000\n2026-02-12,18.41,18.549999,17.450001,17.73,17.407848,8056600\n2026-02-13,17.540001,17.635,17.344999,17.549999,17.231119,3945100\n2026-02-17,17.5,17.629999,17.09,17.18,16.867844,2924500\n2026-02-18,17.280001,17.360001,17.184999,17.219999,16.907116,2419600\n2026-02-19,17.059999,17.225,16.98,17.120001,16.808933,2908100\n2026-02-20,17.049999,17.379999,16.940001,17.27,16.956207,3065000\n2026-02-23,17.23,17.32,16.84,16.889999,16.583111,4729900\n2026-02-24,16.85,17.23,16.84,17.1,16.789297,4209200\n2026-02-25,17.74,17.85,17.405001,17.620001,17.299849,8229500\n2026-02-26,16.9,16.9,16.34,16.629999,16.327835,4781000\n2026-02-27,16.35,16.59,16.35,16.450001,16.151108,2380100\n2026-03-02,16.24,16.844999,16.190001,16.83,16.524202,3439900\n2026-03-03,16.5,16.625,16.110001,16.58,16.278744,5609800\n2026-03-04,16.559999,17.09,16.559999,17.049999,16.740204,5198300\n2026-03-05,16.440001,16.549999,16.190001,16.299999,16.003832,5147400\n2026-03-06,16.299999,16.74,16.299999,16.67,16.367109,2937500\n2026-03-09,16.24,16.639999,16.219999,16.620001,16.318018,4330900\n2026-03-10,16.549999,16.915001,16.469999,16.73,16.426018,3810000\n2026-03-11,16.860001,17.205,16.860001,17.030001,16.720568,3271600\n2026-03-12,16.719999,16.905001,16.365,16.450001,16.151108,3921700\n2026-03-13,16.75,16.969999,16.645,16.73,16.426018,3347400\n2026-03-16,16.5,17.540001,16.5,16.9,16.59293,6375100\n2026-03-17,17,17.507999,16.815001,17.01,16.700932,6680400\n2026-03-18,16.82,16.83,16.440001,16.540001,16.239471,4549300\n2026-03-19,16.08,16.24,15.9,16.139999,15.846739,4613900\n2026-03-20,15.86,16.030001,15.8,15.88,15.591463,7491900\n2026-03-23,15.41,15.74,15.18,15.42,15.139821,5358400\n2026-03-24,15.3,15.635,15.28,15.44,15.159457,4050300\n2026-03-25,15.68,15.84,15.6,15.72,15.434371,3243200\n2026-03-26,15.38,15.665,15.285,15.32,15.041638,2899700\n2026-03-27,15.37,15.47,15.26,15.32,15.041638,3333900\n2026-03-30,15.1,15.29,14.97,15.01,14.737271,5166600\n2026-03-31,14.58,14.99,14.4,14.97,14.697998,5463900\n2026-04-01,14.97,15.262,14.82,14.84,14.57036,4407800\n2026-04-02,14.59,15.015,14.59,14.81,14.540905,2798900\n2026-04-06,14.85,15.15,14.81,15.09,14.815818,2144300\n2026-04-07,15.04,15.21,14.92,15.19,14.914,3346500\n2026-04-08,15.36,15.895,15.2,15.63,15.63,3957800\n2026-04-09,15.62,15.83,15.54,15.61,15.61,2467800\n2026-04-10,15.56,15.96,15.495,15.84,15.84,3690800\n2026-04-13,15.73,15.845,15.595,15.81,15.81,2535800\n2026-04-14,16.209999,16.635,16.174999,16.5,16.5,3856900\n2026-04-15,16.379999,16.43,16.155001,16.24,16.24,3387700\n2026-04-16,16.440001,16.459999,16.115,16.16,16.16,3163900\n2026-04-17,16.190001,16.440001,16,16.24,16.24,3961600\n2026-04-20,16.190001,16.495001,16.094999,16.440001,16.440001,2540700\n2026-04-21,16.33,16.4,16.030001,16.139999,16.139999,2719700\n2026-04-22,16.23,16.309999,15.94,15.99,15.99,4508000\n2026-04-23,15.82,15.92,15.59,15.8,15.8,4854200\n2026-04-24,15.9,16.219999,15.87,16.18,16.18,2918900\n2026-04-27,15.91,16.1,15.86,16.030001,16.030001,3904700\n2026-04-28,15.8,15.915,15.6,15.79,15.79,3845000\n2026-04-29,16.51,16.52,15.8,16,16,6632200\n2026-04-30,16.35,17.129999,16.27,17.129999,17.129999,6782400\n2026-05-01,17.200001,17.370001,17.014999,17.059999,17.059999,2682900\n2026-05-04,17.68,17.74,17.4,17.459999,17.459999,4174000\n2026-05-05,17.950001,18.27,17.825001,18.129999,18.129999,5959900\n2026-05-06,18.49,18.934999,18.33,18.790001,18.790001,6934200\n2026-05-07,18.450001,18.629999,18.375,18.41,18.41,3338100\n2026-05-08,18.799999,19.08,18.780001,18.870001,18.870001,5928300\n2026-05-11,18.83,19.264999,18.83,19.190001,19.190001,4949700\n2026-05-12,19.040001,19.15,18.424999,18.52,18.52,3680300\n2026-05-13,18.790001,19.764999,18.719999,19.59,19.59,7584800\n2026-05-14,19.280001,19.280001,18.844999,18.860001,18.860001,2866700\n2026-05-15,18.17,18.254999,17.82,18.17,18.17,5722800\n2026-05-18,17.6,17.825001,17.41,17.799999,17.799999,5129700\n2026-05-19,18.799999,19.299999,18.459999,18.719999,18.719999,9068200\n2026-05-20,18.110001,18.57,17.82,18.07,18.07,8204000\n2026-05-21,17.450001,17.5,16.66,16.889999,16.889999,8687400\n2026-05-22,16.110001,16.775,16.01,16.4,16.4,9270100\n2026-05-26,16.27,16.65,16.264999,16.5,16.5,7543200\n2026-05-27,16.48,16.77,16.450001,16.620001,16.620001,4460700\n2026-05-28,16.459999,16.469999,16.254999,16.360001,16.360001,3996400\n2026-05-29,16.5,16.83,16.49,16.6,16.6,3200100\n2026-06-01,16.780001,17.280001,16.700001,17.18,17.18,4545800\n2026-06-02,17.18,17.379999,17.110001,17.23,17.23,4554700\n2026-06-03,16.690001,16.955,16.594999,16.91,16.91,6038000\n2026-06-04,16.690001,16.780001,16.559999,16.620001,16.620001,5879300\n2026-06-05,16.219999,16.355,16,16.08,16.08,5556900\n2026-06-08,15.95,16.355,15.86,16.16,16.16,6205500\n2026-06-09,16.09,16.129999,15.715,15.97,15.97,5343500\n2026-06-10,15.9,16.23,15.88,16,16,4637100\n2026-06-11,16.004999,16.43,16.004999,16.4,16.4,2929600\n2026-06-12,16.799999,16.98,16.715,16.889999,16.889999,3648400\n2026-06-15,16.700001,16.790001,16.549999,16.57,16.57,3475600\n2026-06-16,16.290001,16.370001,16.065001,16.120001,16.120001,3698900\n2026-06-17,15.71,15.815,15.5,15.52,15.52,4368800\n2026-06-18,15.17,15.21,14.89,14.91,14.91,5089200\n2026-06-22,14.84,15.125,14.73,15,15,4328300\n2026-06-23,14.62,14.955,14.62,14.91,14.91,3157000\n2026-06-24,14.67,14.905,14.67,14.8,14.8,5928400\n2026-06-25,14.48,14.56,14.25,14.3,14.3,3353900\n2026-06-26,13.94,14.27,13.81,14.26,14.26,6012900\n2026-06-29,14.5,14.68,14.45,14.55,14.55,3206400\n2026-06-30,14.42,14.64,14.375,14.53,14.53,2419500\n2026-07-01,14.6,15.115,14.6,15.05,15.05,4952700\n2026-07-02,15.06,15.235,14.96,15.09,15.09,3399500\n";

// src/research/knowledge/priceKnowledgeBase.ts
var DEFAULT_METADATA = {
  symbol: "BEKE",
  source: "Yahoo Finance chart API daily OHLCV",
  sourceUrl: "https://finance.yahoo.com/quote/BEKE/history/",
  verificationSource: "KE Holdings IR Historical Price Lookup",
  verificationUrl: "https://investors.ke.com/stock-information/historical-price-lookup/",
  from: "2024-07-05",
  to: "2026-07-02",
  rowCount: 500,
  generatedAt: "2026-07-04T00:00:00.000Z"
};
var LOOKBACKS = [20, 60, 120, 252];
var TARGETS = [17, 18, 19];
var cachedKnowledgeBase = null;
function toNumber(value) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : 0;
}
function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}
function parseCsvLine(line) {
  return line.split(",").map((cell) => cell.trim());
}
function parsePriceHistoryCsv(csv) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];
  const header = parseCsvLine(lines[0]);
  const index = Object.fromEntries(header.map((name, columnIndex) => [name, columnIndex]));
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return {
      date: cells[index.Date],
      open: toNumber(cells[index.Open]),
      high: toNumber(cells[index.High]),
      low: toNumber(cells[index.Low]),
      close: toNumber(cells[index.Close]),
      adjustedClose: toNumber(cells[index.AdjustedClose]),
      volume: Math.round(toNumber(cells[index.Volume]))
    };
  }).filter(
    (point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date) && point.close > 0 && point.high >= point.low && point.volume > 0
  ).sort((a, b) => a.date.localeCompare(b.date));
}
function realizedVolatility(points) {
  if (points.length < 2) return 0;
  const returns = points.slice(1).map((point, index) => {
    const previous = points[index].close;
    return previous > 0 ? Math.log(point.close / previous) : 0;
  });
  const average = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - average) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}
function maxDrawdown(points) {
  let peak = points[0]?.close ?? 0;
  let drawdown = 0;
  for (const point of points) {
    peak = Math.max(peak, point.close);
    if (peak > 0) {
      drawdown = Math.min(drawdown, (point.close - peak) / peak * 100);
    }
  }
  return drawdown;
}
function summarizeStats(points, target) {
  const start = points[0];
  const end = points[points.length - 1];
  const high = Math.max(...points.map((point) => point.high));
  const low = Math.min(...points.map((point) => point.low));
  const averageVolume = points.reduce((sum, point) => sum + point.volume, 0) / points.length;
  return {
    startClose: round(start.close),
    endClose: round(end.close),
    returnPercent: round((end.close - start.close) / start.close * 100),
    high: round(high),
    low: round(low),
    maxDrawdownPercent: round(maxDrawdown(points)),
    realizedVolatilityPercent: round(realizedVolatility(points)),
    averageVolume: Math.round(averageVolume),
    targetDistancePercent: target ? round((target - end.close) / end.close * 100) : void 0,
    targetTouches: target ? points.filter((point) => point.high >= target).length : void 0
  };
}
function trendTag(returnPercent) {
  if (returnPercent >= 8) return "trend-up";
  if (returnPercent <= -8) return "trend-down";
  return "range-bound";
}
function volatilityTag(volatilityPercent) {
  if (volatilityPercent >= 45) return "volatility-high";
  if (volatilityPercent <= 28) return "volatility-low";
  return "volatility-normal";
}
function lookbackDocument(allPoints, lookbackDays) {
  const points = allPoints.slice(-lookbackDays);
  const stats = summarizeStats(points);
  const tags = [
    "lookback",
    `${lookbackDays}d`,
    trendTag(stats.returnPercent),
    volatilityTag(stats.realizedVolatilityPercent),
    "drawdown",
    "ohlcv"
  ];
  return {
    id: `price-lookback-${lookbackDays}d`,
    title: `BEKE ${lookbackDays} \u65E5\u4EF7\u683C\u7ED3\u6784`,
    kind: "lookback",
    lookbackDays,
    from: points[0].date,
    to: points[points.length - 1].date,
    tags,
    stats,
    content: `${lookbackDays} \u65E5 OHLCV\uFF1A\u6536\u76D8 ${stats.startClose} -> ${stats.endClose}\uFF0C\u533A\u95F4\u6536\u76CA ${stats.returnPercent}%\uFF0C\u9AD8\u4F4E ${stats.high}/${stats.low}\uFF0C\u6700\u5927\u56DE\u64A4 ${stats.maxDrawdownPercent}%\uFF0C\u5E74\u5316\u6CE2\u52A8 ${stats.realizedVolatilityPercent}%\uFF0C\u5747\u91CF ${stats.averageVolume.toLocaleString("en-US")}\u3002`
  };
}
function regimeDocument(points) {
  const stats = summarizeStats(points);
  const latest = points[points.length - 1];
  const twoYearHigh = Math.max(...points.map((point) => point.close));
  const highDate = points.find((point) => point.close === twoYearHigh)?.date ?? points[0].date;
  const drawdownFromHigh = (latest.close - twoYearHigh) / twoYearHigh * 100;
  return {
    id: "price-regime-two-year",
    title: "BEKE \u4E24\u5E74\u4EF7\u683C regime",
    kind: "regime",
    from: points[0].date,
    to: latest.date,
    tags: ["two-year", "regime", "drawdown", "volatility", "ohlcv"],
    stats,
    content: `\u4E24\u5E74\u65E5\u7EBF regime\uFF1A\u6700\u65B0\u6536\u76D8 ${latest.close}\uFF0C\u4E24\u5E74\u6536\u76D8\u9AD8\u70B9 ${round(twoYearHigh)} \u51FA\u73B0\u5728 ${highDate}\uFF0C\u5F53\u524D\u8DDD\u9AD8\u70B9 ${round(drawdownFromHigh)}%\uFF1B\u5168\u6837\u672C\u6700\u5927\u56DE\u64A4 ${stats.maxDrawdownPercent}%\uFF0C\u5E74\u5316\u6CE2\u52A8 ${stats.realizedVolatilityPercent}%\u3002`
  };
}
function targetDocument(points, target) {
  const stats = summarizeStats(points, target);
  const latest = points[points.length - 1];
  const touchPoints = points.filter((point) => point.high >= target);
  const closeAbovePoints = points.filter((point) => point.close >= target);
  const lastTouch = touchPoints[touchPoints.length - 1]?.date ?? "\u8FC7\u53BB\u4E24\u5E74\u672A\u89E6\u8FBE";
  const tags = [
    "target",
    `target-${target}`,
    "resistance",
    "touch-frequency",
    "ohlcv",
    stats.targetTouches && stats.targetTouches > 0 ? "has-touch" : "no-touch"
  ];
  return {
    id: `price-target-${target}`,
    title: `BEKE ${target} \u7F8E\u5143\u76EE\u6807\u4EF7\u8BB0\u5FC6`,
    kind: "target",
    from: points[0].date,
    to: latest.date,
    tags,
    stats,
    content: `${target} \u7F8E\u5143\u76EE\u6807\u4EF7\uFF1A\u6700\u65B0\u6536\u76D8 ${latest.close}\uFF0C\u8FD8\u5DEE ${stats.targetDistancePercent}%\uFF1B\u8FC7\u53BB\u4E24\u5E74\u65E5\u5185\u89E6\u8FBE ${touchPoints.length} \u5929\uFF0C\u6536\u76D8\u7AD9\u4E0A ${closeAbovePoints.length} \u5929\uFF0C\u6700\u8FD1\u4E00\u6B21\u65E5\u5185\u89E6\u8FBE\u4E3A ${lastTouch}\u3002`
  };
}
function buildPriceKnowledgeBase(points, metadata = DEFAULT_METADATA) {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) {
    return {
      symbol: "BEKE",
      points: sorted,
      documents: [],
      metadata: { ...metadata, rowCount: sorted.length }
    };
  }
  const documents = [
    ...LOOKBACKS.filter((lookback) => sorted.length >= lookback).map(
      (lookback) => lookbackDocument(sorted, lookback)
    ),
    regimeDocument(sorted),
    ...TARGETS.map((target) => targetDocument(sorted, target))
  ];
  return {
    symbol: "BEKE",
    points: sorted,
    documents,
    metadata: {
      ...metadata,
      from: sorted[0].date,
      to: sorted[sorted.length - 1].date,
      rowCount: sorted.length
    }
  };
}
function scoreDocument(document, input) {
  const query = input.query.toLowerCase();
  let score = 0;
  if (document.tags.includes(`target-${input.target}`)) score += 42;
  if (document.kind === "target") score += 16;
  if (document.kind === "regime") score += 14;
  if (document.lookbackDays === 20) score += 10;
  if (document.lookbackDays === 60) score += 12;
  if (document.lookbackDays === 120) score += 8;
  if (document.lookbackDays === 252) score += 8;
  if (/回撤|drawdown|修复|低位/.test(query) && document.tags.includes("drawdown")) score += 14;
  if (/波动|volatility|风险/.test(query) && document.tags.some((tag) => tag.startsWith("volatility"))) score += 12;
  if (/触达|突破|目标|target/.test(query) && document.kind === "target") score += 14;
  if (/两年|历史|regime|周期/.test(query) && document.tags.includes("two-year")) score += 13;
  if (/成交|volume|流动性/.test(query)) score += Math.min(8, document.stats.averageVolume / 1e6);
  const distance = document.stats.targetDistancePercent;
  if (distance !== void 0) {
    score += Math.max(0, 12 - Math.abs(distance));
  } else {
    const documentDistance = (input.target - document.stats.endClose) / document.stats.endClose * 100;
    score += Math.max(0, 8 - Math.abs(documentDistance) * 0.3);
  }
  score += document.stats.returnPercent > 0 ? 3 : 0;
  score += document.stats.maxDrawdownPercent < -20 ? 4 : 0;
  return round(score, 3);
}
function retrievePriceKnowledge(knowledgeBase, input) {
  const limit = input.limit ?? 4;
  const documents = knowledgeBase.documents.map((document) => ({
    ...document,
    score: scoreDocument(document, input)
  })).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit);
  return {
    query: input.query,
    target: input.target,
    documents,
    rationale: `\u4E24\u5E74 BEKE OHLCV \u77E5\u8BC6\u5E93\u547D\u4E2D ${documents.length} \u6761\uFF1A\u6309\u76EE\u6807 ${input.target} \u7F8E\u5143\u3001\u6700\u65B0\u4EF7 ${input.latestPrice}\u3001\u56DE\u64A4/\u6CE2\u52A8/\u89E6\u8FBE\u8BED\u4E49\u7EFC\u5408\u6392\u5E8F\u3002`
  };
}
function priceDocumentsToMemories(retrieval, now) {
  const validUntil = new Date(new Date(now).getTime() + 7 * 24 * 60 * 60 * 1e3).toISOString();
  return retrieval.documents.map((document, index) => ({
    id: `mem-price-rag-${document.id}`,
    memoryType: "market",
    content: `\u4E24\u5E74\u65E5\u7EBF OHLCV \u76EE\u6807\u4EF7\u8BC1\u636E ${index + 1}/${retrieval.documents.length}\uFF1A${document.title}\u3002${document.content}`,
    sourceEventId: `price-rag-${document.id}`,
    validFrom: now,
    validUntil,
    importance: Math.min(10, Math.max(6, round((document.score ?? 50) / 10, 1))),
    confidence: 0.82,
    decayScore: 1,
    createdAt: now,
    lastUsedAt: now
  }));
}
function priceKnowledgeToCloseHistory(knowledgeBase, quote2) {
  const history = knowledgeBase.points.map((point) => ({
    date: point.date,
    close: point.close
  }));
  const lastDate = history[history.length - 1]?.date;
  const quoteDate = quote2?.asOf.slice(0, 10);
  if (quote2 && quoteDate && lastDate && quoteDate > lastDate) {
    history.push({ date: quoteDate, close: quote2.price });
  }
  return history;
}
function loadBekePriceKnowledgeBase() {
  if (!cachedKnowledgeBase) {
    const points = parsePriceHistoryCsv(beke_us_daily_2024_07_04_2026_07_04_default);
    cachedKnowledgeBase = buildPriceKnowledgeBase(points, DEFAULT_METADATA);
  }
  return cachedKnowledgeBase;
}

// src/data/property/china-property-market-2026-05.json
var china_property_market_2026_05_default = {
  version: "nbs-china-property-2026-05",
  asOf: "2026-06-16",
  period: "2026-05",
  source: {
    publisher: "\u56FD\u5BB6\u7EDF\u8BA1\u5C40",
    title: "2026\u5E745\u6708\u4EFD70\u4E2A\u5927\u4E2D\u57CE\u5E02\u5546\u54C1\u4F4F\u5B85\u9500\u552E\u4EF7\u683C\u53D8\u52A8\u60C5\u51B5",
    url: "https://www.stats.gov.cn/sj/zxfb/202606/t20260616_1963946.html"
  },
  interpretationSource: {
    publisher: "\u56FD\u5BB6\u7EDF\u8BA1\u5C40",
    title: "5\u6708\u4EFD\u4E00\u4E8C\u4E09\u7EBF\u57CE\u5E02\u5546\u54C1\u4F4F\u5B85\u9500\u552E\u4EF7\u683C\u540C\u6BD4\u964D\u5E45\u603B\u4F53\u6536\u7A84",
    url: "https://www.stats.gov.cn/sj/zxfbhjd/202606/t20260616_1963945.html"
  },
  nationalSource: {
    publisher: "\u56FD\u5BB6\u7EDF\u8BA1\u5C40",
    title: "2026\u5E741\u20145\u6708\u4EFD\u5168\u56FD\u623F\u5730\u4EA7\u5E02\u573A\u57FA\u672C\u60C5\u51B5",
    url: "https://www.stats.gov.cn/sj/zxfb/202606/t20260616_1963950.html"
  },
  national: {
    newCommercialSalesAreaWanSqm: 31320,
    newCommercialSalesAreaYoY: -10.8,
    residentialSalesAreaYoY: -12.1,
    newCommercialSalesAmountYi: 29366,
    newCommercialSalesAmountYoY: -13.5,
    residentialSalesAmountYoY: -14.1,
    developmentInvestmentYi: 30356,
    developmentInvestmentYoY: -16.2,
    residentialInvestmentYi: 23426,
    residentialInvestmentYoY: -15.6
  },
  tiers: [
    {
      tier: "\u4E00\u7EBF",
      cities: ["\u5317\u4EAC", "\u4E0A\u6D77", "\u5E7F\u5DDE", "\u6DF1\u5733"],
      newHomeMoM: 0.2,
      resaleMoM: 0.4,
      newHomeYoY: -1.7,
      resaleYoY: -5.8,
      note: "\u4E00\u7EBF\u57CE\u5E02\u65B0\u623F\u548C\u4E8C\u624B\u623F\u73AF\u6BD4\u4E0A\u6DA8\uFF0C\u4F46\u4E8C\u624B\u623F\u540C\u6BD4\u4ECD\u660E\u663E\u4E0B\u8DCC\u3002"
    },
    {
      tier: "\u4E8C\u7EBF",
      cities: ["\u5929\u6D25", "\u5357\u4EAC", "\u676D\u5DDE", "\u5B81\u6CE2", "\u5408\u80A5", "\u6B66\u6C49", "\u91CD\u5E86", "\u6210\u90FD", "\u897F\u5B89", "\u9752\u5C9B", "\u90D1\u5DDE"],
      newHomeMoM: -0.1,
      resaleMoM: -0.2,
      newHomeYoY: -3.2,
      resaleYoY: -5.7,
      note: "\u4E8C\u7EBF\u57CE\u5E02\u73AF\u6BD4\u4ECD\u5C0F\u5E45\u4E0B\u964D\uFF0C\u540C\u6BD4\u964D\u5E45\u6709\u6240\u6536\u7A84\u3002"
    },
    {
      tier: "\u4E09\u7EBF",
      cities: ["\u65E0\u9521", "\u5F90\u5DDE", "\u6E29\u5DDE", "\u91D1\u534E", "\u60E0\u5DDE", "\u4E09\u4E9A"],
      newHomeMoM: -0.4,
      resaleMoM: -0.4,
      newHomeYoY: -4.2,
      resaleYoY: -6.2,
      note: "\u4E09\u7EBF\u57CE\u5E02\u73AF\u6BD4\u4E0B\u964D\u66F4\u660E\u663E\uFF0C\u662F\u884C\u4E1A beta \u7684\u4E3B\u8981\u62D6\u7D2F\u3002"
    }
  ],
  cityIndexes: [
    { city: "\u5317\u4EAC", tier: "\u4E00\u7EBF", newHomeIndexMoM: 99.8, newHomeIndexYoY: 97.9, resaleIndexMoM: 100.1, resaleIndexYoY: 93.5 },
    { city: "\u4E0A\u6D77", tier: "\u4E00\u7EBF", newHomeIndexMoM: 100.2, newHomeIndexYoY: 103.2, resaleIndexMoM: 100.6, resaleIndexYoY: 95.7 },
    { city: "\u5E7F\u5DDE", tier: "\u4E00\u7EBF", newHomeIndexMoM: 100.2, newHomeIndexYoY: 96.7, resaleIndexMoM: 100.1, resaleIndexYoY: 93 },
    { city: "\u6DF1\u5733", tier: "\u4E00\u7EBF", newHomeIndexMoM: 100.4, newHomeIndexYoY: 95.5, resaleIndexMoM: 100.6, resaleIndexYoY: 94.5 },
    { city: "\u5929\u6D25", tier: "\u4E8C\u7EBF", newHomeIndexMoM: 99.9, newHomeIndexYoY: 95.3, resaleIndexMoM: 99.6, resaleIndexYoY: 94 },
    { city: "\u5357\u4EAC", tier: "\u4E8C\u7EBF", newHomeIndexMoM: 99.6, newHomeIndexYoY: 96.4, resaleIndexMoM: 99.9, resaleIndexYoY: 93.5 },
    { city: "\u676D\u5DDE", tier: "\u4E8C\u7EBF", newHomeIndexMoM: 100.5, newHomeIndexYoY: 102, resaleIndexMoM: 100, resaleIndexYoY: 95.4 },
    { city: "\u5B81\u6CE2", tier: "\u4E8C\u7EBF", newHomeIndexMoM: 100.2, newHomeIndexYoY: 98.2, resaleIndexMoM: 100.1, resaleIndexYoY: 95.1 },
    { city: "\u5408\u80A5", tier: "\u4E8C\u7EBF", newHomeIndexMoM: 100.1, newHomeIndexYoY: 100.8, resaleIndexMoM: 100, resaleIndexYoY: 93.9 },
    { city: "\u6B66\u6C49", tier: "\u4E8C\u7EBF", newHomeIndexMoM: 100.2, newHomeIndexYoY: 96.9, resaleIndexMoM: 99.6, resaleIndexYoY: 91.2 },
    { city: "\u91CD\u5E86", tier: "\u4E8C\u7EBF", newHomeIndexMoM: 99.6, newHomeIndexYoY: 95.3, resaleIndexMoM: 100.1, resaleIndexYoY: 94.5 },
    { city: "\u6210\u90FD", tier: "\u4E8C\u7EBF", newHomeIndexMoM: 99.9, newHomeIndexYoY: 94.8, resaleIndexMoM: 99.6, resaleIndexYoY: 93.7 },
    { city: "\u897F\u5B89", tier: "\u4E8C\u7EBF", newHomeIndexMoM: 99.6, newHomeIndexYoY: 94.4, resaleIndexMoM: 99.8, resaleIndexYoY: 92.4 },
    { city: "\u9752\u5C9B", tier: "\u4E8C\u7EBF", newHomeIndexMoM: 100.3, newHomeIndexYoY: 97.3, resaleIndexMoM: 99.8, resaleIndexYoY: 93.4 },
    { city: "\u90D1\u5DDE", tier: "\u4E8C\u7EBF", newHomeIndexMoM: 99.8, newHomeIndexYoY: 94.4, resaleIndexMoM: 100.1, resaleIndexYoY: 93 }
  ]
};

// src/research/knowledge/propertyMarketKnowledgeBase.ts
var cachedKnowledgeBase2 = null;
function round2(value, digits = 1) {
  return Number(value.toFixed(digits));
}
function indexToChange(indexValue) {
  return round2(indexValue - 100, 1);
}
function citySignal(city) {
  const newMoM = indexToChange(city.newHomeIndexMoM);
  const resaleMoM = indexToChange(city.resaleIndexMoM);
  const resaleYoY = indexToChange(city.resaleIndexYoY);
  if (newMoM > 0 && resaleMoM >= 0) {
    return `${city.city} \u65B0\u623F\u73AF\u6BD4 ${newMoM > 0 ? "+" : ""}${newMoM}%\uFF0C\u4E8C\u624B\u623F\u73AF\u6BD4 ${resaleMoM >= 0 ? "+" : ""}${resaleMoM}%\uFF0C\u4F46\u4E8C\u624B\u623F\u540C\u6BD4 ${resaleYoY}% \u4ECD\u663E\u793A\u5B58\u91CF\u623F\u4EF7\u683C\u538B\u529B\u3002`;
  }
  if (newMoM >= 0 && resaleMoM < 0) {
    return `${city.city} \u65B0\u623F\u73AF\u6BD4 ${newMoM >= 0 ? "+" : ""}${newMoM}%\uFF0C\u4E8C\u624B\u623F\u73AF\u6BD4 ${resaleMoM}%\uFF0C\u8BF4\u660E\u65B0\u623F\u5F3A\u4E8E\u5B58\u91CF\u623F\uFF0C\u5E73\u53F0 beta \u8FD8\u9700\u8981\u4E8C\u624B\u623F\u6210\u4EA4\u9A8C\u8BC1\u3002`;
  }
  return `${city.city} \u65B0\u623F\u73AF\u6BD4 ${newMoM}%\uFF0C\u4E8C\u624B\u623F\u73AF\u6BD4 ${resaleMoM}%\uFF0C\u4EF7\u683C\u7AEF\u4ECD\u504F\u5F31\u3002`;
}
function tierTag(tier) {
  if (tier === "\u4E00\u7EBF") return "tier-1";
  if (tier === "\u4E8C\u7EBF") return "tier-2";
  return "tier-3";
}
function buildDocuments() {
  const data = china_property_market_2026_05_default;
  const cityIndexes = data.cityIndexes;
  const tierDocs = data.tiers.map((tier) => ({
    id: `property-tier-${tier.tier}`,
    title: `${tier.tier}\u57CE\u5E02\u4F4F\u5B85\u4EF7\u683C\u4FE1\u53F7`,
    kind: "tier",
    sourceUrl: data.interpretationSource.url,
    sourcePublisher: data.interpretationSource.publisher,
    tags: [
      "property",
      "tier",
      tier.tier,
      tierTag(tier.tier),
      "new-home",
      "resale",
      tier.resaleMoM > 0 ? "resale-mom-positive" : "resale-mom-negative",
      tier.newHomeYoY > -2 ? "new-home-yoy-resilient" : "new-home-yoy-weak"
    ],
    metrics: {
      newHomeMoM: tier.newHomeMoM,
      resaleMoM: tier.resaleMoM,
      newHomeYoY: tier.newHomeYoY,
      resaleYoY: tier.resaleYoY
    },
    content: `${tier.tier}\u57CE\u5E02\uFF1A\u65B0\u623F\u73AF\u6BD4 ${tier.newHomeMoM > 0 ? "+" : ""}${tier.newHomeMoM}%\uFF0C\u4E8C\u624B\u623F\u73AF\u6BD4 ${tier.resaleMoM > 0 ? "+" : ""}${tier.resaleMoM}%\uFF1B\u65B0\u623F\u540C\u6BD4 ${tier.newHomeYoY}%\uFF0C\u4E8C\u624B\u623F\u540C\u6BD4 ${tier.resaleYoY}%\u3002${tier.note}`
  }));
  const cityDocs = cityIndexes.map((city) => ({
    id: `property-city-${city.city}`,
    title: `${city.city}\u4F4F\u5B85\u4EF7\u683C\u6307\u6570`,
    kind: "city",
    sourceUrl: data.source.url,
    sourcePublisher: data.source.publisher,
    tags: [
      "property",
      "city",
      city.city,
      city.tier,
      tierTag(city.tier),
      "new-home",
      "resale",
      indexToChange(city.newHomeIndexMoM) >= 0 ? "new-home-mom-positive" : "new-home-mom-negative",
      indexToChange(city.resaleIndexMoM) >= 0 ? "resale-mom-positive" : "resale-mom-negative",
      indexToChange(city.resaleIndexYoY) <= -5 ? "resale-yoy-pressure" : "resale-yoy-resilient"
    ],
    metrics: {
      newHomeMoM: indexToChange(city.newHomeIndexMoM),
      newHomeYoY: indexToChange(city.newHomeIndexYoY),
      resaleMoM: indexToChange(city.resaleIndexMoM),
      resaleYoY: indexToChange(city.resaleIndexYoY)
    },
    content: citySignal(city)
  }));
  const national = data.national;
  const nationalDocs = [
    {
      id: "property-national-sales-investment",
      title: "\u5168\u56FD\u623F\u5730\u4EA7\u9500\u552E\u4E0E\u6295\u8D44\u57FA\u7EBF",
      kind: "national",
      sourceUrl: data.nationalSource.url,
      sourcePublisher: data.nationalSource.publisher,
      tags: ["property", "national", "sales", "investment", "new-home", "developer-cycle"],
      metrics: {
        salesAreaYoY: national.newCommercialSalesAreaYoY,
        residentialSalesAreaYoY: national.residentialSalesAreaYoY,
        salesAmountYoY: national.newCommercialSalesAmountYoY,
        developmentInvestmentYoY: national.developmentInvestmentYoY
      },
      content: `1-5 \u6708\u5168\u56FD\u65B0\u5EFA\u5546\u54C1\u623F\u9500\u552E\u9762\u79EF ${national.newCommercialSalesAreaWanSqm} \u4E07\u5E73\u65B9\u7C73\uFF0C\u540C\u6BD4 ${national.newCommercialSalesAreaYoY}%\uFF1B\u65B0\u5EFA\u5546\u54C1\u623F\u9500\u552E\u989D ${national.newCommercialSalesAmountYi} \u4EBF\u5143\uFF0C\u540C\u6BD4 ${national.newCommercialSalesAmountYoY}%\uFF1B\u623F\u5730\u4EA7\u5F00\u53D1\u6295\u8D44\u540C\u6BD4 ${national.developmentInvestmentYoY}%\u3002\u8FD9\u8BF4\u660E\u884C\u4E1A\u603B\u91CF\u4ECD\u6536\u7F29\uFF0CBEKE \u7684\u4FEE\u590D\u66F4\u4F9D\u8D56\u5B58\u91CF\u623F\u548C\u6838\u5FC3\u57CE\u5E02\u97E7\u6027\u3002`
    },
    {
      id: "property-beke-city-exposure",
      title: "BEKE \u5E73\u53F0 beta \u7684\u57CE\u5E02\u8BC1\u636E",
      kind: "beke-exposure",
      sourceUrl: data.source.url,
      sourcePublisher: data.source.publisher,
      tags: ["property", "beke", "city-exposure", "resale", "tier-1", "tier-2"],
      metrics: {
        trackedCities: cityIndexes.length,
        tierOneResaleMoM: data.tiers[0].resaleMoM,
        tierTwoResaleMoM: data.tiers[1].resaleMoM
      },
      content: `BEKE \u7684\u4F30\u503C\u66F4\u654F\u611F\u4E8E\u5B58\u91CF\u623F\u548C\u6838\u5FC3\u57CE\u5E02\uFF1A\u4E00\u7EBF\u4E8C\u624B\u623F\u73AF\u6BD4 +${data.tiers[0].resaleMoM}%\uFF0C\u4E0A\u6D77\u3001\u6DF1\u5733\u4E8C\u624B\u623F\u73AF\u6BD4\u5206\u522B +${indexToChange(cityIndexes.find((city) => city.city === "\u4E0A\u6D77").resaleIndexMoM)}% / +${indexToChange(cityIndexes.find((city) => city.city === "\u6DF1\u5733").resaleIndexMoM)}%\uFF1B\u4F46\u4E8C\u7EBF\u57CE\u5E02\u4E8C\u624B\u623F\u73AF\u6BD4 ${data.tiers[1].resaleMoM}%\uFF0C\u5168\u56FD\u9500\u552E\u989D\u4ECD\u540C\u6BD4 ${national.newCommercialSalesAmountYoY}%\u3002\u7ED3\u8BBA\u662F\uFF1A17 \u7F8E\u5143\u53EF\u4EE5\u770B\u4FEE\u590D\uFF0C18/19 \u7F8E\u5143\u9700\u8981\u66F4\u5E7F\u6CDB\u6210\u4EA4\u786E\u8BA4\u3002`
    }
  ];
  return [...nationalDocs, ...tierDocs, ...cityDocs];
}
function scoreDocument2(document, input) {
  const query = input.query.toLowerCase();
  let score = 0;
  if (document.kind === "beke-exposure") score += 30;
  if (document.kind === "national") score += input.target >= 18 ? 22 : 14;
  if (document.kind === "tier") score += 18;
  if (document.kind === "city") score += 10;
  if (input.target === 17 && document.tags.includes("resale-mom-positive")) score += 16;
  if (input.target === 17 && document.tags.includes("tier-1")) score += 8;
  if (input.target >= 18 && document.tags.includes("national")) score += 10;
  if (input.target >= 19 && document.tags.includes("developer-cycle")) score += 10;
  if (/二手|存量|resale|平台|beta/.test(query) && document.tags.includes("resale")) score += 16;
  if (document.kind === "beke-exposure" && /beke|平台|beta|存量/.test(query)) score += 28;
  if (/一线|核心城市|上海|深圳|北京|广州/.test(query) && (document.tags.includes("\u4E00\u7EBF") || document.tags.includes("tier-1"))) score += 12;
  if (/二线|杭州|南京|成都|武汉|重庆|西安/.test(query) && document.tags.includes("\u4E8C\u7EBF")) score += 9;
  if (/销售|成交|gtv|收入/.test(query) && (document.tags.includes("sales") || document.tags.includes("resale"))) score += 10;
  if (/投资|开发商|新房/.test(query) && (document.tags.includes("investment") || document.tags.includes("new-home"))) score += 8;
  if (/压力|风险|弱|恶化/.test(query) && (document.tags.includes("resale-yoy-pressure") || document.tags.includes("developer-cycle"))) score += 8;
  const resaleYoY = Number(document.metrics.resaleYoY ?? 0);
  if (resaleYoY < -5) score += input.target >= 18 ? 5 : 2;
  return round2(score, 3);
}
function loadChinaPropertyMarketKnowledgeBase() {
  if (!cachedKnowledgeBase2) {
    cachedKnowledgeBase2 = {
      version: china_property_market_2026_05_default.version,
      asOf: china_property_market_2026_05_default.asOf,
      period: china_property_market_2026_05_default.period,
      documents: buildDocuments(),
      cityIndexes: china_property_market_2026_05_default.cityIndexes,
      source: china_property_market_2026_05_default.source,
      interpretationSource: china_property_market_2026_05_default.interpretationSource,
      nationalSource: china_property_market_2026_05_default.nationalSource
    };
  }
  return cachedKnowledgeBase2;
}
function retrievePropertyMarketKnowledge(knowledgeBase, input) {
  const limit = input.limit ?? 5;
  const documents = knowledgeBase.documents.map((document) => ({
    ...document,
    score: scoreDocument2(document, input)
  })).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit);
  return {
    query: input.query,
    target: input.target,
    documents,
    rationale: `\u4E2D\u56FD\u5730\u4EA7\u77E5\u8BC6\u5E93\u547D\u4E2D ${documents.length} \u6761\uFF1A\u6309\u76EE\u6807 ${input.target} \u7F8E\u5143\u3001\u5B58\u91CF\u623F/\u6838\u5FC3\u57CE\u5E02/\u5168\u56FD\u9500\u552E\u6295\u8D44\u8BED\u4E49\u6392\u5E8F\u3002`
  };
}
function propertyDocumentsToMemories(retrieval, now) {
  const validUntil = new Date(new Date(now).getTime() + 14 * 24 * 60 * 60 * 1e3).toISOString();
  return retrieval.documents.map((document, index) => ({
    id: `mem-property-rag-${document.id}`,
    memoryType: "property",
    content: `\u4E2D\u56FD\u5730\u4EA7 RAG \u8BC1\u636E ${index + 1}/${retrieval.documents.length}\uFF1A${document.title}\u3002${document.content}`,
    sourceEventId: `property-rag-${document.id}`,
    validFrom: now,
    validUntil,
    importance: Math.min(10, Math.max(6.5, round2((document.score ?? 50) / 10, 1))),
    confidence: 0.88,
    decayScore: 1,
    createdAt: now,
    lastUsedAt: now
  }));
}
function propertyDocumentsToRawItems(retrieval, publishedAt) {
  return retrieval.documents.slice(0, 4).map((document) => ({
    id: `property-rag-${document.id}`,
    title: document.title,
    source: document.sourcePublisher,
    url: document.sourceUrl,
    publishedAt,
    summary: document.content,
    reliability: 0.88
  }));
}

// src/research/workflow/executeWorkflowStep.ts
var StepTimeoutError = class extends Error {
  constructor(step, timeoutMs) {
    super(`${step} step timed out after ${timeoutMs}ms`);
    this.name = "StepTimeoutError";
  }
};
function wait(delayMs) {
  if (delayMs <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
async function runWithTimeout(step, timeoutMs, run) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(run),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new StepTimeoutError(step, timeoutMs)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function executeWorkflowStep(input) {
  const now = input.now ?? Date.now;
  const startedMs = now();
  const startedAt = new Date(startedMs).toISOString();
  const maxAttempts = Math.max(1, input.maxAttempts ?? 1);
  let attempts = 0;
  let lastError;
  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const output = await runWithTimeout(input.step, input.timeoutMs, input.run);
      const finishedMs2 = now();
      return {
        step: input.step,
        status: "success",
        startedAt,
        finishedAt: new Date(finishedMs2).toISOString(),
        inputSummary: input.inputSummary,
        outputSummary: input.summarize(output),
        output,
        durationMs: Math.max(0, finishedMs2 - startedMs),
        attempts
      };
    } catch (error) {
      lastError = error;
      if (attempts < maxAttempts) await wait(input.retryDelayMs ?? 0);
    }
  }
  const finishedMs = now();
  return {
    step: input.step,
    status: "failed",
    startedAt,
    finishedAt: new Date(finishedMs).toISOString(),
    inputSummary: input.inputSummary,
    errorMessage: lastError instanceof Error ? lastError.message : String(lastError),
    durationMs: Math.max(0, finishedMs - startedMs),
    attempts,
    failureKind: lastError instanceof StepTimeoutError ? "timeout" : "error"
  };
}

// src/research/harness/runBekeHarness.ts
var globalRunSequence = 0;
var HarnessRecorder = class {
  runs = [];
  createRun(input) {
    globalRunSequence += 1;
    const run = {
      id: `run-${Date.now()}-${globalRunSequence}`,
      project: "beke-research-os",
      triggerType: input.triggerType,
      status: "created",
      inputVersion: "public-snapshot",
      modelVersion: "probability-rules-mvp-0.1",
      promptVersion: PROMPTS.generate_analysis.version,
      dataVersion: "mock-public-providers-0.1",
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      steps: []
    };
    this.runs.push(run);
    return run;
  }
  addStep(runId, step) {
    const run = this.runs.find((r) => r.id === runId);
    if (run) {
      run.steps.push(step);
      const statusMap = {
        market: "fetching_market",
        news: "fetching_news",
        event: "classifying_events",
        memory: "retrieving_memory",
        factor: "scoring_factors",
        probability: "calculating_probability",
        forecast: "forecasting_window",
        analysis: "generating_analysis",
        review: "reviewing",
        publish: "publishing"
      };
      run.status = statusMap[step.step] ?? run.status;
    }
  }
  completeRun(runId, snapshotId) {
    const run = this.runs.find((r) => r.id === runId);
    if (run) {
      run.status = "success";
      run.finishedAt = (/* @__PURE__ */ new Date()).toISOString();
      run.snapshotId = snapshotId;
    }
    return run;
  }
  failRun(runId, error) {
    const run = this.runs.find((r) => r.id === runId);
    if (run) {
      run.status = "failed";
      run.finishedAt = (/* @__PURE__ */ new Date()).toISOString();
      run.errorMessage = error instanceof Error ? error.message : String(error);
    }
    return run;
  }
  getRun(runId) {
    return this.runs.find((r) => r.id === runId) ?? null;
  }
  getRuns() {
    return [...this.runs];
  }
};
var DEFAULT_STEP_POLICIES = {
  market: { timeoutMs: 12e3, maxAttempts: 2, retryDelayMs: 150 },
  news: { timeoutMs: 12e3, maxAttempts: 2, retryDelayMs: 150 },
  event: { timeoutMs: 5e3, maxAttempts: 1, retryDelayMs: 0 },
  memory: { timeoutMs: 5e3, maxAttempts: 1, retryDelayMs: 0 },
  factor: { timeoutMs: 5e3, maxAttempts: 1, retryDelayMs: 0 },
  probability: { timeoutMs: 8e3, maxAttempts: 1, retryDelayMs: 0 },
  forecast: { timeoutMs: 8e3, maxAttempts: 1, retryDelayMs: 0 },
  analysis: { timeoutMs: 3e4, maxAttempts: 1, retryDelayMs: 0 },
  review: { timeoutMs: 8e3, maxAttempts: 1, retryDelayMs: 0 },
  publish: { timeoutMs: 5e3, maxAttempts: 1, retryDelayMs: 0 }
};
function summarizeStepOutput(step, output) {
  switch (step) {
    case "market": {
      const market = output;
      const priceKnowledgeText = market.priceKnowledge ? `\uFF0C\u4E24\u5E74\u65E5\u7EBF ${market.priceKnowledge.points.length} \u6761` : "";
      return `\u884C\u60C5 ${market.quote?.price ?? "n/a"} ${market.quote?.currency ?? ""}\uFF0C\u5386\u53F2 ${market.history?.length ?? 0} \u6761${priceKnowledgeText}`;
    }
    case "news": {
      const news = output;
      return `\u65B0\u95FB ${news.news?.length ?? 0} \u6761\uFF0C\u5B98\u65B9 ${news.official?.length ?? 0} \u6761\uFF0C\u5B8F\u89C2 ${news.macroSignals?.length ?? 0} \u6761\uFF0C\u5730\u4EA7\u77E5\u8BC6 ${news.propertyKnowledge?.documents?.length ?? 0} \u6761\uFF0C\u5408\u8BA1 ${news.allItems?.length ?? 0} \u6761`;
    }
    case "event": {
      const events = output;
      const categories = events.reduce((acc, event) => {
        acc[event.category] = (acc[event.category] ?? 0) + 1;
        return acc;
      }, {});
      return `\u4E8B\u4EF6 ${events.length} \u6761\uFF0C\u5206\u7C7B ${Object.entries(categories).map(([key, value]) => `${key}${value}`).join(" / ")}`;
    }
    case "memory": {
      const memories = output;
      const priceKnowledgeCount = memories.filter((memory) => memory.sourceEventId?.startsWith("price-rag-")).length;
      const propertyKnowledgeCount = memories.filter((memory) => memory.sourceEventId?.startsWith("property-rag-")).length;
      return `\u8BB0\u5FC6\u547D\u4E2D ${memories.length} \u6761\uFF0C\u4EF7\u683C\u77E5\u8BC6 ${priceKnowledgeCount} \u6761\uFF0C\u5730\u4EA7\u77E5\u8BC6 ${propertyKnowledgeCount} \u6761`;
    }
    case "factor": {
      const factors = output;
      return `\u56E0\u5B50 ${factors.map((factor) => `${factor.label}${Math.round(factor.score)}`).join(" / ")}`;
    }
    case "probability": {
      const predictions = output;
      return `\u6982\u7387 ${predictions.map((prediction) => `$${prediction.target}:${prediction.probability}%`).join(" / ")}`;
    }
    case "forecast": {
      const predictions = output;
      return `\u5927\u80C6\u7A97\u53E3 ${predictions.map((prediction) => `$${prediction.target}:${prediction.nearTermForecast?.label ?? "n/a"}(ctx ${prediction.nearTermForecast?.contextScore ?? "n/a"})`).join(" / ")}`;
    }
    case "analysis": {
      const analysis = output;
      return `\u5206\u6790\u5B8C\u6210\uFF0Cheadline ${analysis.headline.length} \u5B57\uFF0C\u6B63/\u8D1F/\u89C2\u5BDF ${analysis.positives.length}/${analysis.negatives.length}/${analysis.watch.length}`;
    }
    case "review": {
      const review = output;
      if (!review.approved) {
        return `\u98CE\u9669\u5BA1\u67E5\u672A\u901A\u8FC7 ${review.issues.length} \u9879`;
      }
      if (review.surfaceScore !== void 0 && review.qualityScore !== void 0) {
        return `\u98CE\u9669\u5BA1\u67E5\u901A\u8FC7\uFF0C\u7814\u7A76\u8D28\u91CF ${review.qualityScore}/100\uFF0C\u524D\u7AEF\u804C\u8D23 ${review.surfaceScore}/100`;
      }
      if (review.surfaceScore !== void 0) {
        return `\u98CE\u9669\u5BA1\u67E5\u901A\u8FC7\uFF0C\u524D\u7AEF\u804C\u8D23 ${review.surfaceScore}/100`;
      }
      return "\u98CE\u9669\u5BA1\u67E5\u901A\u8FC7";
    }
    case "publish": {
      const snapshot = output;
      return `\u53D1\u5E03\u5FEB\u7167 ${snapshot.runId}\uFF0C\u5386\u53F2 ${snapshot.history.length} \u70B9`;
    }
    default:
      return `${step} \u5B8C\u6210`;
  }
}
function formatHistoryTimestamp(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date).replace(/\//g, "-");
}
function makeStepResult(step, inputSummary, fn, policy = DEFAULT_STEP_POLICIES[step]) {
  return executeWorkflowStep({
    step,
    inputSummary,
    ...policy,
    run: fn,
    summarize: (output) => summarizeStepOutput(step, output)
  });
}
function macroSignalUrl(signal) {
  if (/美联储|利率|fed/i.test(signal.name)) {
    return "https://www.federalreserve.gov/monetarypolicy.htm";
  }
  if (/kweb|fxi|mchi|中概|adr|风险偏好/i.test(signal.name)) {
    return "https://finance.yahoo.com/quote/KWEB/";
  }
  if (/地产|房地产|房价|政策/.test(signal.name)) {
    return "https://www.stats.gov.cn/sj/zxfb/";
  }
  return "https://www.stats.gov.cn/sj/zxfb/";
}
function macroSignalSource(signal) {
  if (/美联储|利率|fed/i.test(signal.name)) return "Federal Reserve";
  if (/kweb|fxi|mchi|中概|adr|风险偏好/i.test(signal.name)) return "Yahoo Finance";
  return "\u56FD\u5BB6\u7EDF\u8BA1\u5C40";
}
function macroSignalsToRawItems(signals, publishedAt) {
  return signals.map((signal, index) => ({
    id: `macro-signal-${index}-${signal.name.replace(/\s+/g, "-")}`,
    title: signal.name,
    source: macroSignalSource(signal),
    url: macroSignalUrl(signal),
    publishedAt,
    summary: signal.rationale,
    reliability: signal.direction === "neutral" ? 0.64 : 0.72
  }));
}
async function runBekeHarness(input, context) {
  const recorder = context.recorder ?? new HarnessRecorder();
  const run = recorder.createRun(input);
  run.dataVersion = [
    `market-${context.marketProvider.name}`,
    `news-${context.newsProvider.name}`,
    `official-${context.officialProvider.name}`,
    `macro-${context.macroProvider.name}`
  ].join("+");
  const runRepository2 = context.runRepository;
  const persistRun = () => runRepository2?.save(recorder.getRun(run.id));
  persistRun();
  const repository = context.snapshotRepository ?? new InMemorySnapshotRepository();
  const memoryRepository2 = context.memoryRepository ?? new InMemoryMemoryRepository();
  const eventEngine = new EventEngine();
  const factorEngine = new FactorEngine();
  const analysisEngine = new AnalysisEngine();
  const memoryEngine = new MemoryEngine(memoryRepository2);
  const priceKnowledgeBase = context.priceKnowledgeBase ?? loadBekePriceKnowledgeBase();
  const propertyKnowledgeBase = context.propertyKnowledgeBase ?? loadChinaPropertyMarketKnowledgeBase();
  const subagents = {
    market: context.subagents?.market ?? new MarketSubagent(context.marketProvider),
    news: context.subagents?.news ?? new NewsSubagent(context.newsProvider, context.officialProvider),
    event: context.subagents?.event ?? new EventSubagent(eventEngine),
    memory: context.subagents?.memory ?? new MemorySubagent(memoryEngine),
    factor: context.subagents?.factor ?? new FactorSubagent(factorEngine),
    probability: context.subagents?.probability ?? new ProbabilitySubagent(),
    forecast: context.subagents?.forecast ?? new ForecastSubagent(),
    analysis: context.subagents?.analysis ?? new AnalysisSubagent(analysisEngine, context.llmProvider),
    review: context.subagents?.review ?? new RiskReviewSubagent(),
    publish: context.subagents?.publish ?? new PublishSubagent(repository)
  };
  const recordStep = (step) => {
    recorder.addStep(run.id, step);
    persistRun();
  };
  const runStep = (step, inputSummary, fn) => makeStepResult(step, inputSummary, fn, {
    ...DEFAULT_STEP_POLICIES[step],
    ...context.stepPolicies?.[step]
  });
  const failRun = (error) => {
    const failed = recorder.failRun(run.id, error);
    persistRun();
    return failed;
  };
  const completeRun = (snapshotId) => {
    const completed = recorder.completeRun(run.id, snapshotId);
    persistRun();
    return completed;
  };
  const runStartedAt = run.startedAt;
  memoryEngine.decayMemories(runStartedAt);
  const marketResult = await runStep("market", "\u83B7\u53D6\u884C\u60C5 + \u4E24\u5E74\u4EF7\u683C\u77E5\u8BC6\u5E93", async () => {
    const providerMarket = await subagents.market.run({ symbol: input.symbol, days: 5 });
    return {
      ...providerMarket,
      providerHistory: providerMarket.history,
      history: priceKnowledgeToCloseHistory(priceKnowledgeBase, providerMarket.quote),
      priceKnowledge: priceKnowledgeBase
    };
  });
  recordStep(marketResult);
  if (marketResult.status === "failed") {
    failRun(marketResult.errorMessage);
    return { run: recorder.getRun(run.id) };
  }
  const market = marketResult.output;
  const newsResult = await runStep("news", "\u83B7\u53D6\u65B0\u95FB + \u5B8F\u89C2\u4FE1\u53F7 + \u5730\u4EA7\u77E5\u8BC6", async () => {
    const [newsOutput, macroSignals] = await Promise.all([
      subagents.news.run({
        query: "BEKE OR KE Holdings",
        sinceHours: 24,
        officialSinceHours: 24 * 30
      }),
      context.macroProvider.fetchMacroSignals()
    ]);
    const propertyKnowledge = retrievePropertyMarketKnowledge(propertyKnowledgeBase, {
      query: "BEKE \u5730\u4EA7\u73AF\u5883 \u5B58\u91CF\u623F \u4E8C\u624B\u623F \u6838\u5FC3\u57CE\u5E02 \u5168\u56FD\u9500\u552E \u6295\u8D44",
      target: 17,
      limit: 5
    });
    const nowPublishedAt = (/* @__PURE__ */ new Date()).toISOString();
    const macroItems = macroSignalsToRawItems(macroSignals, nowPublishedAt);
    const propertyItems = propertyDocumentsToRawItems(propertyKnowledge, propertyKnowledgeBase.asOf);
    return {
      ...newsOutput,
      macroSignals,
      propertyKnowledge,
      allItems: [...newsOutput.allItems, ...macroItems, ...propertyItems]
    };
  });
  recordStep(newsResult);
  if (newsResult.status === "failed") {
    failRun(newsResult.errorMessage);
    return { run: recorder.getRun(run.id) };
  }
  const news = newsResult.output;
  const eventResult = await runStep(
    "event",
    "\u4E8B\u4EF6\u5206\u7C7B",
    () => subagents.event.run({ rawItems: news.allItems }).then((output) => output.events)
  );
  recordStep(eventResult);
  if (eventResult.status === "failed") {
    failRun(eventResult.errorMessage);
    return { run: recorder.getRun(run.id) };
  }
  const events = eventResult.output;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const priceRetrieval = retrievePriceKnowledge(priceKnowledgeBase, {
    query: [
      `${input.symbol} 17 \u7F8E\u5143\u4FEE\u590D\u56DE\u8865`,
      `\u6700\u65B0\u4EF7 ${market.quote.price}`,
      ...events.slice(0, 4).map((event) => event.title)
    ].join("\uFF1B"),
    target: 17,
    latestPrice: market.quote.price,
    limit: 4
  });
  const priceMemories = priceDocumentsToMemories(priceRetrieval, nowIso);
  const propertyRetrieval = retrievePropertyMarketKnowledge(propertyKnowledgeBase, {
    query: [
      "BEKE \u5730\u4EA7 beta \u5B58\u91CF\u623F \u57CE\u5E02\u4EF7\u683C \u5168\u56FD\u623F\u5730\u4EA7\u9500\u552E",
      `\u6700\u65B0\u4EF7 ${market.quote.price}`,
      ...events.filter((event) => event.category === "\u5730\u4EA7").slice(0, 4).map((event) => event.title)
    ].join("\uFF1B"),
    target: 17,
    limit: 5
  });
  const propertyMemories = propertyDocumentsToMemories(propertyRetrieval, nowIso);
  const memoryResult = await runStep(
    "memory",
    "\u8BB0\u5FC6\u68C0\u7D22 + \u4EF7\u683C/\u5730\u4EA7\u77E5\u8BC6\u5E93 RAG",
    () => subagents.memory.run({
      events,
      target: 17,
      now: nowIso
    }).then((output) => [...output.memories, ...priceMemories, ...propertyMemories])
  );
  recordStep(memoryResult);
  if (memoryResult.status === "failed") {
    failRun(memoryResult.errorMessage);
    return { run: recorder.getRun(run.id) };
  }
  const memories = memoryResult.output;
  const factorResult = await runStep(
    "factor",
    "\u56E0\u5B50\u8BC4\u5206",
    () => subagents.factor.run({
      quote: market.quote,
      history: market.history,
      events,
      memories
    }).then((output) => output.factors)
  );
  recordStep(factorResult);
  if (factorResult.status === "failed") {
    failRun(factorResult.errorMessage);
    return { run: recorder.getRun(run.id) };
  }
  const factors = factorResult.output;
  const previousSnapshot = repository.getLatest();
  const probabilityResult = await runStep(
    "probability",
    "\u6982\u7387\u8BA1\u7B97",
    () => subagents.probability.run({
      quote: market.quote,
      history: market.history,
      factors,
      events,
      memories,
      previousSnapshot: previousSnapshot ?? void 0
    }).then((output) => output.predictions)
  );
  recordStep(probabilityResult);
  if (probabilityResult.status === "failed") {
    failRun(probabilityResult.errorMessage);
    return { run: recorder.getRun(run.id) };
  }
  const probabilityPredictions = probabilityResult.output;
  const forecastResult = await runStep(
    "forecast",
    "\u4E00\u5468\u7A97\u53E3\u63A8\u6F14",
    () => subagents.forecast.run({
      quote: market.quote,
      history: market.history,
      events,
      memories,
      factors,
      predictions: probabilityPredictions,
      previousSnapshot: previousSnapshot ?? void 0
    }).then((output) => output.predictions)
  );
  recordStep(forecastResult);
  if (forecastResult.status === "failed") {
    failRun(forecastResult.errorMessage);
    return { run: recorder.getRun(run.id) };
  }
  const predictions = forecastResult.output;
  const analysisResult = await runStep(
    "analysis",
    "\u751F\u6210\u5206\u6790",
    () => subagents.analysis.run({
      quote: market.quote,
      predictions,
      events,
      factors
    }).then((output) => output.analysis)
  );
  recordStep(analysisResult);
  if (analysisResult.status === "failed") {
    failRun(analysisResult.errorMessage);
    return { run: recorder.getRun(run.id) };
  }
  const analysis = analysisResult.output;
  const sourceLinks = Array.from(
    new Map(
      [
        ...news.allItems.map((item) => [
          item.url,
          {
            label: item.title,
            publisher: item.source,
            url: item.url
          }
        ]),
        [
          priceKnowledgeBase.metadata.sourceUrl,
          {
            label: "BEKE two-year daily OHLCV history",
            publisher: "Yahoo Finance",
            url: priceKnowledgeBase.metadata.sourceUrl
          }
        ],
        [
          priceKnowledgeBase.metadata.verificationUrl,
          {
            label: "Historical Price Lookup",
            publisher: "KE Holdings IR",
            url: priceKnowledgeBase.metadata.verificationUrl
          }
        ]
      ]
    ).values()
  );
  const now = /* @__PURE__ */ new Date();
  const historyBase = previousSnapshot?.history ?? [];
  const history = [
    ...historyBase,
    {
      at: formatHistoryTimestamp(now),
      p17: predictions.find((p) => p.target === 17)?.probability ?? 0,
      p18: predictions.find((p) => p.target === 18)?.probability ?? 0,
      p19: predictions.find((p) => p.target === 19)?.probability ?? 0,
      note: analysis.headline
    }
  ].slice(-12);
  const snapshotBase = {
    project: "beke19",
    symbol: "BEKE",
    route: "/beke19",
    runId: `beke19-${Date.now()}`,
    inputVersion: "public-snapshot",
    modelVersion: "probability-rules-mvp-0.1",
    promptVersion: PROMPTS.generate_analysis.version,
    dataVersion: [
      `market-${market.quote.provenance?.provider ?? context.marketProvider.name}`,
      `news-${context.newsProvider.name}`,
      `official-${context.officialProvider.name}`,
      `macro-${context.macroProvider.name}`,
      `price-rag-${priceKnowledgeBase.metadata.from}_${priceKnowledgeBase.metadata.to}`,
      `property-rag-${propertyKnowledgeBase.version}`
    ].join("+"),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    nextUpdateAt: new Date(Date.now() + 6 * 60 * 60 * 1e3).toISOString(),
    quote: market.quote,
    predictions,
    analysis,
    factors,
    news: events.slice().sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()).slice(0, 10).map((e) => ({
      id: `news-${e.id}`,
      eventId: e.id,
      title: e.title,
      source: e.source,
      category: e.category,
      summary: e.summary,
      impact: e.impact,
      importance: e.importance,
      url: e.sourceUrl,
      publishedAt: e.publishedAt
    })),
    sources: sourceLinks,
    history,
    audit: {
      publishedBy: "PublishEngine",
      reviewedBy: "RiskReviewEngine",
      dataPolicy: "\u4EC5\u4F7F\u7528\u516C\u5F00\u4FE1\u606F\uFF1B\u5B9E\u65F6\u6293\u53D6\u5931\u8D25\u65F6\u4FDD\u7559\u539F\u59CB\u65F6\u95F4\u5E76\u663E\u5F0F\u964D\u7EA7\uFF0C\u4E0D\u4F2A\u9020\u5B9E\u65F6\u6027\u3002",
      providers: {
        market: market.quote.provenance?.provider ?? context.marketProvider.name,
        news: context.newsProvider.name,
        official: context.officialProvider.name,
        macro: context.macroProvider.name
      },
      dataFreshness: market.quote.provenance?.freshness ?? "delayed",
      warnings: [
        ...market.quote.provenance?.freshness === "fallback" ? [`\u884C\u60C5\u5DF2\u964D\u7EA7\uFF1A${market.quote.provenance.fallbackReason ?? "\u5B9E\u65F6\u884C\u60C5\u4E0D\u53EF\u7528"}`] : [],
        ...news.allItems.some((item) => item.retrievalMode === "curated") ? ["\u90E8\u5206\u65B0\u95FB\u4F7F\u7528\u5DF2\u53D1\u5E03\u8BC1\u636E\u5FEB\u7167\u3002"] : []
      ]
    }
  };
  const snapshot = attachResearchQuality(snapshotBase);
  const reviewResult = await runStep("review", "\u98CE\u9669\u5BA1\u67E5", () => {
    return subagents.review.run({ snapshot, previousSnapshot: previousSnapshot ?? void 0, events }).then(({ result }) => {
      const surfaceAudit = evaluateSnapshotSurface(snapshot);
      if (!result.approved) {
        throw new Error(`\u5BA1\u67E5\u5931\u8D25: ${result.issues.map((i) => i.message).join(", ")}`);
      }
      if (!surfaceAudit.passed) {
        throw new Error(`\u524D\u7AEF\u804C\u8D23\u5BA1\u67E5\u5931\u8D25: ${surfaceAudit.findings.join(", ")}`);
      }
      return { ...result, surfaceScore: surfaceAudit.score, qualityScore: snapshot.quality?.overallScore };
    });
  });
  recordStep(reviewResult);
  if (reviewResult.status === "failed") {
    failRun(reviewResult.errorMessage);
    return { run: recorder.getRun(run.id) };
  }
  const publishResult = await runStep("publish", "\u53D1\u5E03\u5FEB\u7167", () => {
    return subagents.publish.run({
      snapshot,
      reviewResult: reviewResult.output
    }).then((output) => output.published);
  });
  recordStep(publishResult);
  if (publishResult.status === "failed") {
    failRun(publishResult.errorMessage);
    return { run: recorder.getRun(run.id) };
  }
  const memoryCandidates = memoryEngine.createMemoryCandidates({ events, analysis });
  if (memoryCandidates.length > 0) {
    memoryEngine.addMemories(memoryCandidates);
  }
  completeRun(snapshot.runId);
  return {
    run: recorder.getRun(run.id),
    snapshot
  };
}

// src/research/llm/LLMGateway.ts
var LLMGateway = class {
  providers = /* @__PURE__ */ new Map();
  calls = [];
  defaultProviderName;
  constructor(defaultProviderName = "mock") {
    this.defaultProviderName = defaultProviderName;
  }
  registerProvider(provider) {
    this.providers.set(provider.name, provider);
  }
  getProvider(name) {
    const providerName = name ?? this.defaultProviderName;
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`LLM provider not found: ${providerName}`);
    }
    return provider;
  }
  async run(request) {
    const provider = this.getProvider(request.providerName);
    const startTime = Date.now();
    const callId = `llm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const result = await provider.complete({
        promptVersion: request.promptVersion,
        input: request.input,
        outputSchema: request.outputSchema
      });
      if (request.schema && !request.schema(result)) {
        const errorMessage2 = `LLM output failed schema validation: ${request.outputSchema}`;
        if (request.fallback !== void 0) {
          this.calls.push({
            id: callId,
            task: request.task,
            provider: provider.name,
            promptVersion: request.promptVersion,
            latencyMs: Date.now() - startTime,
            status: "fallback",
            errorMessage: errorMessage2,
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          });
          return request.fallback;
        }
        this.calls.push({
          id: callId,
          task: request.task,
          provider: provider.name,
          promptVersion: request.promptVersion,
          latencyMs: Date.now() - startTime,
          status: "failed",
          errorMessage: errorMessage2,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        throw new Error(errorMessage2);
      }
      this.calls.push({
        id: callId,
        task: request.task,
        provider: provider.name,
        promptVersion: request.promptVersion,
        latencyMs: Date.now() - startTime,
        status: "success",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      return result;
    } catch (error) {
      const errorMessage2 = error instanceof Error ? error.message : String(error);
      const status = request.fallback !== void 0 ? "fallback" : "failed";
      this.calls.push({
        id: callId,
        task: request.task,
        provider: provider.name,
        promptVersion: request.promptVersion,
        latencyMs: Date.now() - startTime,
        status,
        errorMessage: errorMessage2,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (request.fallback !== void 0) {
        return request.fallback;
      }
      throw error;
    }
  }
  getCalls() {
    return [...this.calls];
  }
  getCallCount() {
    return this.calls.length;
  }
};

// src/research/repositories/RunRepository.ts
var InMemoryRunRepository = class {
  runs = /* @__PURE__ */ new Map();
  latestRunId = null;
  save(run) {
    this.runs.set(run.id, cloneRun(run));
    this.latestRunId = run.id;
  }
  getById(id) {
    const run = this.runs.get(id);
    return run ? cloneRun(run) : null;
  }
  getAll() {
    return Array.from(this.runs.values()).map(cloneRun);
  }
  getLatest() {
    if (!this.latestRunId) return null;
    const run = this.runs.get(this.latestRunId);
    return run ? cloneRun(run) : null;
  }
};
function cloneRun(run) {
  return {
    ...run,
    steps: run.steps.map((step) => ({ ...step }))
  };
}

// src/research/providers/mock.ts
var CURATED_EVIDENCE = [
  {
    id: "ke-buyback-latest",
    title: "\u8D1D\u58F3-W \u7EE7\u7EED\u6267\u884C\u56DE\u8D2D\u8BA1\u5212",
    source: "\u4E1C\u65B9\u8D22\u5BCC",
    url: "https://quote.eastmoney.com/us/BEKE.html",
    publishedAt: "2026-07-03T08:00:00.000Z",
    summary: "\u516C\u5F00\u5E02\u573A\u4FE1\u606F\u663E\u793A\u8D1D\u58F3-W \u7EE7\u7EED\u56DE\u8D2D\u80A1\u4EFD\uFF0C\u56DE\u8D2D\u8282\u594F\u4ECD\u662F BEKE \u4FEE\u590D\u4EA4\u6613\u7684\u91CD\u8981\u652F\u6491\u3002",
    reliability: 0.72
  },
  {
    id: "property-policy-latest",
    title: "\u4F4F\u5EFA\u90E8\u5F3A\u8C03\u652F\u6301\u521A\u6027\u548C\u6539\u5584\u6027\u4F4F\u623F\u9700\u6C42",
    source: "\u65B0\u534E\u793E",
    url: "https://www.xinhuanet.com/",
    publishedAt: "2026-07-01T10:00:00.000Z",
    summary: "\u4F4F\u5EFA\u90E8\u4F1A\u8BAE\u5F3A\u8C03\u56E0\u57CE\u65BD\u7B56\u652F\u6301\u521A\u6027\u548C\u6539\u5584\u6027\u4F4F\u623F\u9700\u6C42\uFF0C\u4F46\u5E02\u573A\u4ECD\u9700\u8981\u6210\u4EA4\u548C\u623F\u4EF7\u6570\u636E\u9A8C\u8BC1\u3002",
    reliability: 0.75
  },
  {
    id: "ke-price-analysis",
    title: "BEKE \u80A1\u4EF7\u6280\u672F\u5206\u6790\uFF1A\u77ED\u7EBF\u4FEE\u590D\u6001\u52BF",
    source: "\u8BC1\u5238\u4E4B\u661F",
    url: "https://www.sohu.com/",
    publishedAt: "2026-07-03T06:01:00.000Z",
    summary: "BEKE \u80A1\u4EF7\u8FD1\u671F\u5448\u73B0\u4FEE\u590D\u6001\u52BF\uFF0C\u673A\u6784\u76EE\u6807\u4EF7\u5747\u503C\u9AD8\u4E8E\u73B0\u4EF7\uFF0C\u6280\u672F\u9762\u663E\u793A\u77ED\u7EBF\u4F01\u7A33\u8FF9\u8C61\u3002",
    reliability: 0.62
  },
  {
    id: "macro-fed",
    title: "\u7F8E\u8054\u50A8\u7EF4\u6301\u5229\u7387\u4E0D\u53D8\uFF0C\u5E02\u573A\u9884\u671F\u5E74\u5185\u964D\u606F\u6982\u7387\u4E0B\u964D",
    source: "\u8D22\u8054\u793E",
    url: "https://www.cls.cn/",
    publishedAt: "2026-06-19T18:00:00.000Z",
    summary: "\u7F8E\u8054\u50A8\u7EF4\u6301\u5229\u7387\u4E0D\u53D8\uFF0C\u5E02\u573A\u9884\u671F\u5E74\u5185\u964D\u606F\u6982\u7387\u4E0B\u964D\uFF0C\u5BF9\u6210\u957F\u80A1\u4F30\u503C\u6784\u6210\u538B\u529B\u3002",
    reliability: 0.65
  },
  {
    id: "china-adr-sentiment",
    title: "\u4E2D\u6982\u80A1\u677F\u5757\u5206\u5316\uFF0C\u5730\u4EA7\u79D1\u6280\u80A1\u627F\u538B",
    source: "\u8D22\u8054\u793E",
    url: "https://www.cls.cn/",
    publishedAt: "2026-07-02T18:00:00.000Z",
    summary: "\u4E2D\u6982\u80A1\u677F\u5757\u6574\u4F53\u5206\u5316\uFF0CKWEB \u6307\u6570\u5C0F\u5E45\u4E0A\u6DA8\uFF0C\u4F46\u5730\u4EA7\u79D1\u6280\u7C7B\u516C\u53F8\u666E\u904D\u627F\u538B\u3002",
    reliability: 0.6
  },
  {
    id: "ke-agm-2026",
    title: "\u8D1D\u58F3\u5E74\u5EA6\u80A1\u4E1C\u5927\u4F1A\u901A\u8FC7\u8463\u4E8B\u91CD\u9009\u4E0E\u4E00\u822C\u56DE\u8D2D\u6388\u6743",
    source: "KE Holdings IR",
    url: "https://investors.ke.com/news-releases/news-release-details/ke-holdings-inc-announces-results-annual-general-meeting-2",
    publishedAt: "2026-06-12T12:00:00Z",
    summary: "\u80A1\u4E1C\u5927\u4F1A\u901A\u8FC7\u7AE0\u7A0B\u66F4\u65B0\u3001\u8463\u4E8B\u91CD\u9009\u53CA\u80A1\u4EFD\u53D1\u884C\u548C\u56DE\u8D2D\u6388\u6743\uFF0C\u8D44\u672C\u56DE\u62A5\u9884\u671F\u4ECD\u662F\u5E02\u573A\u5173\u6CE8\u70B9\u3002",
    reliability: 0.85
  },
  {
    id: "ke-q1-2026",
    title: "\u8D1D\u58F3 Q1 2026 \u6536\u5165\u540C\u6BD4\u4E0B\u964D\uFF0C\u4F46\u6BDB\u5229\u7387\u6539\u5584",
    source: "KE Holdings IR",
    url: "https://investors.ke.com/news-releases/news-release-details/ke-holdings-inc-announces-first-quarter-2026-unaudited-financial/",
    publishedAt: "2026-05-19T12:00:00Z",
    summary: "Q1 2026 \u51C0\u6536\u5165\u540C\u6BD4\u4E0B\u964D 19.0%\uFF0C\u65E2\u6709\u623F\u548C\u65B0\u623F\u4EA4\u6613 GTV \u627F\u538B\uFF1B\u6BDB\u5229\u7387\u6539\u5584\u81F3 24.1%\uFF0C\u663E\u793A\u6210\u672C\u548C\u4E1A\u52A1\u7ED3\u6784\u4ECD\u6709\u97E7\u6027\u3002",
    reliability: 0.9
  }
].map((item) => ({ ...item, retrievalMode: "curated" }));
var MockNewsProvider = class {
  name = "MockNewsProvider";
  async fetch(_query, _sinceHours) {
    return CURATED_EVIDENCE.map((item) => ({ ...item }));
  }
};
var MockOfficialProvider = class {
  name = "MockOfficialProvider";
  async fetchRecentItems(_sinceHours) {
    return CURATED_EVIDENCE.filter((item) => item.source === "KE Holdings IR").map((item) => ({ ...item }));
  }
};
var CuratedMacroProvider = class {
  name = "CuratedMacroProvider";
  async fetchMacroSignals() {
    return [
      {
        name: "\u4E2D\u6982\u98CE\u9669\u504F\u597D",
        score: 0.2,
        direction: "neutral",
        rationale: "\u4E2D\u6982\u60C5\u7EEA\u77ED\u7EBF\u4FEE\u590D\uFF0C\u4F46\u6CE2\u52A8\u4ECD\u9AD8\u3002"
      },
      {
        name: "\u5730\u4EA7\u653F\u7B56\u89C2\u5BDF",
        score: 0.1,
        direction: "neutral",
        rationale: "\u653F\u7B56\u9884\u671F\u5B58\u5728\uFF0C\u4F46\u5C1A\u672A\u5F62\u6210\u65B0\u7684\u5F3A\u50AC\u5316\u3002"
      }
    ];
  }
};
var MockLLMProvider = class {
  name = "MockLLMProvider";
  async complete(request) {
    if (request.input === void 0 || request.input === null) {
      throw new Error("LLM request input cannot be null or undefined");
    }
    return request.input;
  }
};

// src/research/providers/TokenPlanProvider.ts
var FALLBACK_SYSTEM_PROMPT = `\u4F60\u662F\u4E00\u4E2A BEKE\uFF08\u8D1D\u58F3\u627E\u623F\uFF09\u80A1\u7968\u7814\u7A76\u5206\u6790\u5E08\u3002\u6839\u636E\u8F93\u5165\u7684\u516C\u5F00\u5E02\u573A\u6570\u636E\u751F\u6210\u4E2D\u6587 JSON\u3002

\u8FD4\u56DE JSON \u683C\u5F0F\uFF1A
{
  "headline": "\u4E00\u53E5\u8BDD\u6838\u5FC3\u5224\u65AD\uFF08\u4E2D\u6587\uFF0C\u4E0D\u8D85\u8FC740\u5B57\uFF09",
  "today": "\u4ECA\u65E5\u6A21\u578B\u5224\u65AD\u7684\u8BE6\u7EC6\u5206\u6790\uFF08\u4E2D\u6587\uFF0C120-250\u5B57\uFF09",
  "changes": "\u672C\u8F6E\u4FE1\u606F\u53D8\u5316\u8BF4\u660E\uFF08\u4E2D\u6587\uFF0C2-3\u53E5\uFF09",
  "positives": ["\u6B63\u9762\u56E0\u7D201", "\u6B63\u9762\u56E0\u7D202", "\u6B63\u9762\u56E0\u7D203"],
  "negatives": ["\u8D1F\u9762\u56E0\u7D201", "\u8D1F\u9762\u56E0\u7D202", "\u8D1F\u9762\u56E0\u7D203"],
  "watch": ["\u89C2\u5BDF\u70B91", "\u89C2\u5BDF\u70B92", "\u89C2\u5BDF\u70B93"],
  "targetExplanations": {
    "17": "17\u7F8E\u5143\u76EE\u6807\u5206\u6790",
    "18": "18\u7F8E\u5143\u76EE\u6807\u5206\u6790",
    "19": "19\u7F8E\u5143\u76EE\u6807\u5206\u6790"
  }
}

\u89C4\u5219\uFF1A
- \u5168\u90E8\u4F7F\u7528\u4E2D\u6587
- \u4E0D\u5F97\u51FA\u73B0\u4E70\u5165\u3001\u5356\u51FA\u3001\u6301\u6709\u7B49\u6295\u8D44\u5EFA\u8BAE
- \u4E0D\u5F97\u4F7F\u7528\u786E\u5B9A\u6027\u8BED\u8A00\uFF08\u5FC5\u6DA8\u3001\u7A33\u8D5A\u3001\u65E0\u98CE\u9669\uFF09
- positives \u6070\u597D3\u6761
- negatives \u6070\u597D3\u6761
- watch \u6070\u597D3\u6761`;
function systemPromptFor(request) {
  if (request.promptVersion === PROMPTS.generate_analysis.version) {
    return PROMPTS.generate_analysis.system;
  }
  return FALLBACK_SYSTEM_PROMPT;
}
function parseJsonContent(content) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("LLM returned non-JSON content");
  }
}
var TokenPlanProvider = class {
  constructor(apiKey, baseUrl = "https://token-plan-cn.xiaomimimo.com/v1") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }
  apiKey;
  baseUrl;
  name = "TokenPlanProvider";
  async complete(request) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "api-key": this.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mimo-v2.5-pro",
        messages: [
          { role: "system", content: systemPromptFor(request) },
          { role: "user", content: JSON.stringify(request.input) }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2048
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("LLM returned empty response");
    }
    return parseJsonContent(content);
  }
};

// src/research/providers/YahooFinanceProvider.ts
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function positiveNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Yahoo Finance returned invalid ${field}`);
  }
  return value;
}
var YahooFinanceProvider = class {
  name = "YahooFinanceProvider";
  fetcher;
  now;
  cacheTtlMs;
  timeoutMs;
  cache = /* @__PURE__ */ new Map();
  constructor(options = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? (() => /* @__PURE__ */ new Date());
    this.cacheTtlMs = options.cacheTtlMs ?? 6e4;
    this.timeoutMs = options.timeoutMs ?? 8e3;
  }
  getCached(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now().getTime()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }
  setCached(key, value) {
    this.cache.set(key, { value, expiresAt: this.now().getTime() + this.cacheTtlMs });
    return value;
  }
  async request(symbol, range) {
    if (symbol !== "BEKE") throw new Error(`Unsupported symbol: ${symbol}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=1d`;
      const response = await this.fetcher(url, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Yahoo Finance HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.chart?.error) {
        throw new Error(payload.chart.error.description ?? payload.chart.error.code ?? "chart error");
      }
      const result = payload.chart?.result?.[0];
      if (!result) throw new Error("Yahoo Finance response missing chart result");
      return result;
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`Yahoo Finance timed out after ${this.timeoutMs}ms`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  async fetchQuote(symbol) {
    const key = `quote:${symbol}`;
    const cached = this.getCached(key);
    if (cached) return cached;
    const result = await this.request(symbol, "1d");
    const meta = result.meta;
    const marketTime = positiveNumber(meta?.regularMarketTime, "regularMarketTime");
    const quote2 = {
      symbol: "BEKE",
      price: positiveNumber(meta?.regularMarketPrice, "regularMarketPrice"),
      previousClose: positiveNumber(meta?.chartPreviousClose, "chartPreviousClose"),
      currency: "USD",
      asOf: new Date(marketTime * 1e3).toISOString(),
      source: "Yahoo Finance",
      provenance: {
        provider: this.name,
        freshness: "delayed",
        fetchedAt: this.now().toISOString()
      }
    };
    return this.setCached(key, quote2);
  }
  async fetchHistory(symbol, days) {
    if (!Number.isInteger(days) || days <= 0) throw new Error("days must be a positive integer");
    const key = `history:${symbol}:${days}`;
    const cached = this.getCached(key);
    if (cached) return cached;
    const result = await this.request(symbol, `${days}d`);
    const timestamps = result.timestamp;
    const closes = result.indicators?.quote?.[0]?.close;
    if (!timestamps || !closes || timestamps.length !== closes.length) {
      throw new Error("Yahoo Finance response missing aligned history series");
    }
    const history = timestamps.flatMap((timestamp, index) => {
      const close = closes[index];
      if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) return [];
      return [{ date: new Date(timestamp * 1e3).toISOString().slice(0, 10), close: Number(close.toFixed(2)) }];
    });
    if (history.length === 0) throw new Error("Yahoo Finance returned empty history");
    return this.setCached(key, history);
  }
};
var StaticMarketProvider = class {
  constructor(quote2, history) {
    this.quote = quote2;
    this.history = history;
  }
  quote;
  history;
  name = "StaticMarketProvider";
  async fetchQuote(symbol) {
    if (symbol !== "BEKE") throw new Error(`Unsupported symbol: ${symbol}`);
    return { ...this.quote };
  }
  async fetchHistory(symbol, days) {
    if (symbol !== "BEKE") throw new Error(`Unsupported symbol: ${symbol}`);
    return this.history.slice(-days).map((point) => ({ ...point }));
  }
};
var FallbackMarketProvider = class {
  constructor(primary, fallback, now = () => /* @__PURE__ */ new Date()) {
    this.primary = primary;
    this.fallback = fallback;
    this.now = now;
    this.name = `FallbackMarketProvider(${primary.name}->${fallback.name})`;
  }
  primary;
  fallback;
  now;
  name;
  async fetchQuote(symbol) {
    try {
      return await this.primary.fetchQuote(symbol);
    } catch (error) {
      const quote2 = await this.fallback.fetchQuote(symbol);
      return {
        ...quote2,
        provenance: {
          provider: this.fallback.name,
          freshness: "fallback",
          fetchedAt: this.now().toISOString(),
          fallbackFrom: this.primary.name,
          fallbackReason: errorMessage(error)
        }
      };
    }
  }
  async fetchHistory(symbol, days) {
    try {
      return await this.primary.fetchHistory(symbol, days);
    } catch {
      return this.fallback.fetchHistory(symbol, days);
    }
  }
};

// src/research/providers/YahooFinanceNewsProvider.ts
function reliabilityFor(publisher) {
  if (/GlobeNewswire|Business Wire|PR Newswire/i.test(publisher)) return 0.82;
  if (/Reuters|Bloomberg|Associated Press/i.test(publisher)) return 0.86;
  return 0.68;
}
function isOfficialRelease(item) {
  return /GlobeNewswire|Business Wire|PR Newswire|KE Holdings/i.test(item.source) || /announces|results|annual general meeting|earnings/i.test(item.title);
}
function isBekeRelevant(item) {
  const tickers = item.relatedTickers ?? [];
  if (tickers.some((ticker) => ticker.toUpperCase() === "BEKE")) return true;
  return /\bBEKE\b|KE Holdings|贝壳/i.test(item.title ?? "");
}
var YahooFinanceEvidenceClient = class {
  fetcher;
  now;
  timeoutMs;
  constructor(options) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? (() => /* @__PURE__ */ new Date());
    this.timeoutMs = options.timeoutMs ?? 8e3;
  }
  async fetch(query, sinceHours) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=1&newsCount=20`;
      const response = await this.fetcher(url, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Yahoo Finance news HTTP ${response.status}`);
      const payload = await response.json();
      const cutoff = this.now().getTime() - sinceHours * 60 * 60 * 1e3;
      return (payload.news ?? []).flatMap((item) => {
        const publishedMs = (item.providerPublishTime ?? 0) * 1e3;
        if (!isBekeRelevant(item) || !item.uuid || !item.title || !item.publisher || !item.link || publishedMs < cutoff) return [];
        return [{
          id: `yahoo-news-${item.uuid}`,
          title: item.title,
          source: item.publisher,
          url: item.link,
          publishedAt: new Date(publishedMs).toISOString(),
          summary: item.title,
          reliability: reliabilityFor(item.publisher),
          retrievalMode: "live"
        }];
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`Yahoo Finance news timed out after ${this.timeoutMs}ms`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
};
var YahooFinanceNewsProvider = class {
  name = "YahooFinanceNewsProvider";
  client;
  constructor(options = {}) {
    this.client = new YahooFinanceEvidenceClient(options);
  }
  fetch(query, sinceHours) {
    return this.client.fetch(query, sinceHours);
  }
};
var YahooFinanceOfficialProvider = class {
  name = "YahooFinanceOfficialProvider";
  client;
  constructor(options = {}) {
    this.client = new YahooFinanceEvidenceClient(options);
  }
  async fetchRecentItems(sinceHours) {
    const items = await this.client.fetch("BEKE", sinceHours);
    return items.filter(isOfficialRelease);
  }
};
var FallbackNewsProvider = class {
  constructor(primary, fallback) {
    this.primary = primary;
    this.fallback = fallback;
    this.name = `FallbackNewsProvider(${primary.name}->${fallback.name})`;
  }
  primary;
  fallback;
  name;
  async fetch(query, sinceHours) {
    try {
      const items = await this.primary.fetch(query, sinceHours);
      return items.length > 0 ? items : this.fallback.fetch(query, sinceHours);
    } catch {
      return this.fallback.fetch(query, sinceHours);
    }
  }
};
var FallbackOfficialProvider = class {
  constructor(primary, fallback) {
    this.primary = primary;
    this.fallback = fallback;
    this.name = `FallbackOfficialProvider(${primary.name}->${fallback.name})`;
  }
  primary;
  fallback;
  name;
  async fetchRecentItems(sinceHours) {
    try {
      const items = await this.primary.fetchRecentItems(sinceHours);
      return items.length > 0 ? items : this.fallback.fetchRecentItems(sinceHours);
    } catch {
      return this.fallback.fetchRecentItems(sinceHours);
    }
  }
};

// src/research/runtime/createRuntimeProviders.ts
function createProductionProviders(options = {}) {
  const fallbackMarket = new StaticMarketProvider(latestSnapshot.quote, []);
  const curatedNews = new MockNewsProvider();
  const curatedOfficial = new MockOfficialProvider();
  const yahooOptions = { fetcher: options.fetcher, now: options.now };
  return {
    marketProvider: new FallbackMarketProvider(
      new YahooFinanceProvider(yahooOptions),
      fallbackMarket,
      options.now
    ),
    newsProvider: new FallbackNewsProvider(
      new YahooFinanceNewsProvider(yahooOptions),
      curatedNews
    ),
    officialProvider: new FallbackOfficialProvider(
      new YahooFinanceOfficialProvider(yahooOptions),
      curatedOfficial
    ),
    macroProvider: new CuratedMacroProvider()
  };
}

// src/server/beke19Api.ts
var snapshotRepository = null;
var memoryRepository = null;
var runRepository = null;
var runtimeCache = null;
var SNAPSHOT_CACHE_TTL_MS = 6 * 60 * 60 * 1e3;
function resetBeke19RuntimeCache() {
  runtimeCache = null;
  snapshotRepository = null;
  memoryRepository = null;
  runRepository = null;
}
function getRuntimeEnv() {
  return globalThis.process?.env ?? {};
}
function getSnapshotRepository() {
  if (!snapshotRepository) {
    snapshotRepository = new InMemorySnapshotRepository();
  }
  return snapshotRepository;
}
function getMemoryRepository() {
  if (!memoryRepository) {
    memoryRepository = new InMemoryMemoryRepository();
  }
  return memoryRepository;
}
function getRunRepository() {
  if (!runRepository) {
    runRepository = new InMemoryRunRepository();
  }
  return runRepository;
}
function fallbackRun(snapshot = latestSnapshot) {
  return {
    id: `${snapshot.runId}-server-fallback`,
    project: "beke-research-os",
    triggerType: "manual",
    status: "success",
    inputVersion: snapshot.inputVersion,
    modelVersion: snapshot.modelVersion,
    promptVersion: snapshot.promptVersion,
    dataVersion: snapshot.dataVersion,
    startedAt: snapshot.updatedAt,
    finishedAt: snapshot.updatedAt,
    snapshotId: snapshot.runId,
    steps: [
      {
        step: "publish",
        status: "success",
        startedAt: snapshot.updatedAt,
        finishedAt: snapshot.updatedAt,
        inputSummary: "\u8BFB\u53D6\u670D\u52A1\u7AEF\u9759\u6001 fallback \u5FEB\u7167",
        outputSummary: `\u5FEB\u7167 ${snapshot.runId}`
      }
    ]
  };
}
function createServerLLMGateway(env = getRuntimeEnv()) {
  const apiKey = env.LLM_API_KEY;
  const baseUrl = env.LLM_BASE_URL;
  const providerName = apiKey ? "TokenPlanProvider" : "MockLLMProvider";
  const gateway = new LLMGateway(providerName);
  if (apiKey) {
    gateway.registerProvider(new TokenPlanProvider(apiKey, baseUrl));
  }
  gateway.registerProvider(new MockLLMProvider());
  return gateway;
}
function resolveServerLLMProvider(env = getRuntimeEnv()) {
  return createServerLLMGateway(env);
}
function runtimeInfo(provider, source, providers, cacheStatus, generatedAt, expiresAtMs) {
  const env = getRuntimeEnv();
  const defaultProvider = "getProvider" in provider ? provider.getProvider().name : provider.name;
  return {
    tier: env.VERCEL ? "vercel-function" : "local-function",
    provider: defaultProvider,
    generatedAt: generatedAt.toISOString(),
    source,
    providers: {
      market: providers.marketProvider.name,
      news: providers.newsProvider.name,
      official: providers.officialProvider.name,
      macro: providers.macroProvider.name
    },
    cache: {
      status: cacheStatus,
      expiresAt: new Date(expiresAtMs).toISOString()
    }
  };
}
async function createBeke19SnapshotState(env = getRuntimeEnv(), options = {}) {
  const now = options.now?.() ?? /* @__PURE__ */ new Date();
  if (!options.forceRefresh && runtimeCache && runtimeCache.expiresAtMs > now.getTime()) {
    return {
      ...runtimeCache.payload,
      runtime: {
        ...runtimeCache.payload.runtime,
        generatedAt: now.toISOString(),
        cache: {
          status: "hit",
          expiresAt: new Date(runtimeCache.expiresAtMs).toISOString()
        }
      }
    };
  }
  const repo = getSnapshotRepository();
  const llmProvider = resolveServerLLMProvider(env);
  const providers = options.providers ?? createProductionProviders();
  const cacheStatus = options.forceRefresh ? "refresh" : "miss";
  const expiresAtMs = now.getTime() + (options.cacheTtlMs ?? SNAPSHOT_CACHE_TTL_MS);
  try {
    const result = await runBekeHarness(
      { symbol: "BEKE", triggerType: "manual" },
      {
        ...providers,
        llmProvider,
        snapshotRepository: repo,
        memoryRepository: getMemoryRepository(),
        runRepository: getRunRepository()
      }
    );
    if (result.snapshot) {
      const payload2 = {
        ok: true,
        state: {
          snapshot: result.snapshot,
          run: result.run
        },
        runtime: runtimeInfo(llmProvider, "server-harness", providers, cacheStatus, now, expiresAtMs)
      };
      runtimeCache = { payload: payload2, expiresAtMs };
      return payload2;
    }
  } catch (error) {
    console.warn("beke19 server harness failed; using fallback snapshot", error);
  }
  const payload = {
    ok: true,
    state: {
      snapshot: latestSnapshot,
      run: fallbackRun(latestSnapshot)
    },
    runtime: runtimeInfo(llmProvider, "static-fallback", providers, cacheStatus, now, expiresAtMs)
  };
  runtimeCache = { payload, expiresAtMs };
  return payload;
}
function parseAction(req) {
  const raw = req.query?.action;
  if (Array.isArray(raw)) return raw[0] ?? "snapshot";
  if (raw) return raw;
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    return url.searchParams.get("action") ?? "snapshot";
  } catch {
    return "snapshot";
  }
}
async function handleBeke19Request(req, res, options = {}) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method && req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  const action = parseAction(req);
  if (action !== "snapshot" && action !== "refresh") {
    res.status(400).json({ ok: false, error: `Unsupported action: ${action}` });
    return;
  }
  const payload = await createBeke19SnapshotState(void 0, {
    ...options,
    forceRefresh: action === "refresh" || options.forceRefresh
  });
  res.setHeader(
    "Cache-Control",
    action === "refresh" ? "no-store" : "public, s-maxage=21600, stale-while-revalidate=300"
  );
  res.status(200).json(payload);
}
export {
  createBeke19SnapshotState,
  createServerLLMGateway,
  handleBeke19Request,
  resetBeke19RuntimeCache,
  resolveServerLLMProvider
};
