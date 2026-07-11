var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/research/engines/probability.ts
function distanceToTargetPercent(quote2, target) {
  return Number(((target - quote2.price) / quote2.price * 100).toFixed(1));
}
function enforceProbabilityBounds(value) {
  if (Number.isNaN(value)) return 5;
  return Math.min(95, Math.max(5, Math.round(value)));
}
function enforceTargetMonotonicity(predictions) {
  const ordered = [...predictions].sort((a, b2) => a.target - b2.target);
  let previous = 100;
  return ordered.map((prediction) => {
    const bounded = prediction.forecastQuestion?.status === "resolved_at_issue" ? 100 : enforceProbabilityBounds(prediction.probability);
    const probability = Math.min(previous, bounded);
    previous = probability;
    return {
      ...prediction,
      rawProbability: prediction.rawProbability ?? prediction.probability,
      probability,
      coherenceAdjustment: probability - prediction.probability,
      signal: classifySignal(probability),
      modelScore: probability,
      probabilityChange: prediction.previousProbability === void 0 ? prediction.probabilityChange : probability - prediction.previousProbability
    };
  });
}
function classifyConfidence(probability) {
  if (probability >= 70 || probability <= 20) return "\u9AD8";
  if (probability >= 50 || probability <= 30) return "\u4E2D";
  return "\u4F4E";
}
function classifyEpistemicConfidence(score) {
  if (score >= 0.72) return "\u9AD8";
  if (score >= 0.48) return "\u4E2D";
  return "\u4F4E";
}
function calculateEpistemicConfidence(history, factors, events) {
  const historyCoverage = Math.min(1, history.length / 252);
  const sourceDiversity = Math.min(1, new Set(events.map((event) => event.source)).size / 4);
  const factorReliability = factors.length === 0 ? 0 : factors.reduce((sum, factor) => sum + factor.confidence, 0) / factors.length;
  return Number((historyCoverage * 0.35 + sourceDiversity * 0.35 + factorReliability * 0.3).toFixed(2));
}
function classifySignal(probability) {
  if (probability >= 65) return "\u504F\u591A";
  if (probability >= 55) return "\u4E2D\u6027\u504F\u591A";
  if (probability >= 40) return "\u4E2D\u6027";
  if (probability >= 25) return "\u4E2D\u6027\u504F\u7A7A";
  return "\u504F\u7A7A";
}
var TARGET_WINDOW_OFFSET_DAYS = { 17: 45, 18: 75, 19: 105 };
var DEFAULT_ISSUED_AT = "2026-07-11T00:00:00.000Z";
function createForecastQuestion(quote2, target) {
  const issuedAt = new Date(quote2.asOf);
  const horizonEnd = addUtcDays(issuedAt, 120).toISOString();
  return {
    questionId: `BEKE-${quote2.asOf}-${target}-120d-first-touch`,
    symbol: "BEKE",
    issuedAt: quote2.asOf,
    horizonEnd,
    horizonDays: 120,
    barrier: target,
    currency: "USD",
    priceMeasure: "regular_session_high",
    event: "first_touch",
    tradingCalendar: "XNYS",
    timezone: "America/New_York",
    corporateActionPolicy: "split_adjusted_barrier",
    status: quote2.price >= target ? "resolved_at_issue" : "open"
  };
}
function likelyWindowForTarget(target, issuedAt = DEFAULT_ISSUED_AT) {
  const start = addUtcDays(new Date(issuedAt), TARGET_WINDOW_OFFSET_DAYS[target]);
  return formatForecastLabel(start, addUtcDays(start, 29));
}
function buildNearTermForecast(input) {
  const context = calculateForecastContext(input);
  const issuedAt = input.quote?.asOf ?? DEFAULT_ISSUED_AT;
  const baseStart = addUtcDays(new Date(issuedAt), TARGET_WINDOW_OFFSET_DAYS[input.target]);
  const start = addUtcDays(baseStart, context.weekShift * 7);
  const end = addUtcDays(start, 6);
  const support = summarizeDrivers(input.positiveDrivers, "\u6280\u672F\u9762\u548C\u516C\u5F00\u4E8B\u4EF6", 2);
  const pressure = summarizeDrivers(input.negativeDrivers, "\u5730\u4EA7\u6570\u636E\u9A8C\u8BC1\u4E0D\u8DB3", 2);
  const closes = (input.history ?? []).slice(-20).map((point) => point.close).filter((value) => value > 0).sort((a, b2) => a - b2);
  const supportIndex = Math.max(0, Math.round((closes.length - 1) * 0.25));
  const supportLevel = closes[supportIndex] ?? input.quote?.previousClose;
  const supportLine = supportLevel ? `${supportLevel.toFixed(2)} \u7F8E\u5143\u9644\u8FD1\u7684\u91CF\u5316\u652F\u6491` : "\u8FD1\u671F\u91CF\u5316\u652F\u6491";
  const thesis = `\u672A\u6765\u4E00\u5468\u5148\u89C2\u5BDF${supportLine}\u662F\u5426\u6709\u6548\u3002\u82E5\u4EF7\u683C\u4FDD\u6301\u7A33\u5B9A\uFF0C\u4E14${support}\u7EE7\u7EED\u6539\u5584\uFF0C${input.target} \u7F8E\u5143\u7684\u5F53\u524D\u5224\u65AD\u7EF4\u6301\uFF1B\u82E5${pressure}\u52A0\u91CD\u6216\u4EF7\u683C\u8DCC\u7834\u652F\u6491\uFF0C\u9884\u8BA1\u5230\u8FBE\u65F6\u95F4\u540E\u79FB\u3002`;
  return {
    label: formatForecastLabel(start, end),
    windowStart: toIsoDate(start),
    windowEnd: toIsoDate(end),
    thesis,
    trigger: `\u89E6\u53D1\u6761\u4EF6\uFF1A\u4EF7\u683C\u4FDD\u6301\u5728${supportLine}\u4E4B\u4E0A\uFF0C\u4E14${support}\u7EE7\u7EED\u6539\u5584\u3002`,
    invalidation: `\u5931\u6548\u6761\u4EF6\uFF1A${pressure}\u52A0\u91CD\uFF0C\u6216\u4EF7\u683C\u6709\u6548\u8DCC\u7834${supportLine}\u3002`,
    confidence: classifyConfidence(input.probability),
    modelName: "context-weighted-week-forecast-v0.2",
    contextScore: context.contextScore,
    contextDrivers: context.contextDrivers,
    evidenceSummary: context.evidenceSummary,
    agentDebate: {
      bullCase: `${input.target} \u7F8E\u5143\u6B63\u5411\u60C5\u666F\uFF1A${support}\u7EE7\u7EED\u6539\u5584\uFF0C\u5F53\u524D\u7A97\u53E3\u53EF\u4EE5\u7EF4\u6301\u3002`,
      bearCase: `${input.target} \u7F8E\u5143\u53CD\u5411\u60C5\u666F\uFF1A${pressure}\u52A0\u91CD\uFF0C\u5F53\u524D\u7A97\u53E3\u9700\u8981\u540E\u79FB\u3002`,
      baseCase: `\u57FA\u51C6\u60C5\u666F\uFF1A\u7EF4\u6301 ${input.probability}% \u7684\u672A\u6821\u51C6\u89E6\u8FBE\u4F30\u8BA1\uFF0C\u7B49\u5F85\u4E0B\u4E00\u7EC4\u53EF\u6838\u9A8C\u8BC1\u636E\u3002`
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
  const limit = hasMajorEvent ? majorEventLimit : normalLimit;
  if (absJump <= limit) return newProbability;
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
  const factorEvidenceIds = new Set(factors.flatMap((factor) => factor.sourceEventIds));
  const directEvents = events.filter((event) => !factorEvidenceIds.has(event.id));
  const directEventIds = new Set(directEvents.map((event) => event.id));
  const independentMemories = memories.filter(
    (memory) => !memory.sourceEventId || !factorEvidenceIds.has(memory.sourceEventId) && !directEventIds.has(memory.sourceEventId)
  );
  const memoryAdjustment = calculateMemoryAdjustment(independentMemories);
  const volatilityContext = calculateVolatilityContext(history);
  const hasMajorEvent = detectMajorEvents(events);
  const epistemicConfidence = calculateEpistemicConfidence(history, factors, events);
  const predictions = [17, 18, 19].map((target) => {
    const distancePercent = distanceToTargetPercent(quote2, target);
    const baseProb = calculateBaseProbability(quote2, target);
    const eventAdjustment = calculateEventAdjustment(directEvents, target);
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
    const forecastQuestion = createForecastQuestion(quote2, target);
    const probability = forecastQuestion.status === "resolved_at_issue" ? 100 : enforceProbabilityBounds(adjustedProb);
    const likelyWindow = likelyWindowForTarget(target, quote2.asOf);
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
      confidence: classifyEpistemicConfidence(epistemicConfidence),
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
      ],
      forecastQuestion,
      calibrationStatus: "uncalibrated",
      epistemicConfidence
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
  const topMemory = [...memories].sort((a, b2) => b2.importance * b2.confidence * b2.decayScore - a.importance * a.confidence * a.decayScore)[0];
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
function addUtcDays(date5, days) {
  const next = new Date(date5);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
function toIsoDate(date5) {
  return date5.toISOString().slice(0, 10);
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
  realized(audits) {
    return audits.filter((audit) => {
      if (audit.outcomeStatus) return audit.outcomeStatus === "hit" || audit.outcomeStatus === "miss";
      return typeof audit.actualHit === "boolean";
    });
  }
  calculateBrierScore(audits) {
    const realized = this.realized(audits);
    if (realized.length === 0) return 0;
    const sum = realized.reduce((acc, audit) => {
      const predicted = audit.predictedProbability / 100;
      const actual = audit.actualHit ? 1 : 0;
      return acc + Math.pow(predicted - actual, 2);
    }, 0);
    return sum / realized.length;
  }
  calculateCalibrationError(audits, buckets = 10) {
    const realized = this.realized(audits);
    if (realized.length === 0) return 0;
    const bucketSize = 1 / buckets;
    let totalError = 0;
    for (let i = 0; i < buckets; i++) {
      const lower = i * bucketSize;
      const upper = (i + 1) * bucketSize;
      const inBucket = realized.filter((a) => {
        const p = a.predictedProbability / 100;
        return p >= lower && p < upper;
      });
      if (inBucket.length === 0) continue;
      const avgPredicted = inBucket.reduce((sum, a) => sum + a.predictedProbability / 100, 0) / inBucket.length;
      const avgActual = inBucket.filter((a) => a.actualHit).length / inBucket.length;
      totalError += Math.abs(avgPredicted - avgActual) * (inBucket.length / realized.length);
    }
    return totalError;
  }
  calculateHitWindowError(audits) {
    const hitAudits = this.realized(audits).filter((a) => a.actualHit && a.actualHitDate);
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
        case "120d":
          expectedDays = 120;
          break;
      }
      return Math.abs(actualDays - expectedDays) / expectedDays;
    });
    return errors.reduce((sum, e) => sum + e, 0) / errors.length;
  }
  calculateDirectionAccuracy(audits) {
    const realized = this.realized(audits);
    if (realized.length === 0) return 0;
    const correct = realized.filter((a) => {
      const predicted = a.predictedProbability / 100;
      return a.actualHit ? predicted > 0.5 : predicted <= 0.5;
    }).length;
    return correct / realized.length;
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
  if (snapshot.factors.length === 0) return 0;
  const coverage = snapshot.factors.reduce((sum, factor) => {
    const status = factor.coverage ?? ((factor.evidenceCount ?? factor.sourceEventIds.length) > 0 ? "thin" : "missing");
    return sum + (status === "covered" ? 1 : status === "thin" ? 0.55 : 0);
  }, 0);
  return clampScore(coverage / REQUIRED_FACTOR_COUNT * 100);
}
function forecastEvidenceScore(snapshot) {
  if (snapshot.predictions.length === 0) return 0;
  const scores = snapshot.predictions.map((prediction) => {
    const forecast = prediction.nearTermForecast;
    const evidence = forecast?.evidenceSummary;
    if (!forecast || !evidence) return 0;
    return clampScore(
      (evidence.newsItems > 0 ? 30 : 0) + (evidence.historyPoints >= 5 ? 25 : evidence.historyPoints > 0 ? 15 : 0) + (evidence.memoryItems > 0 ? 15 : 8) + (evidence.dominantFactor && evidence.dominantFactor !== "\u6682\u65E0\u4E3B\u5BFC\u56E0\u5B50" ? 15 : 0) + (snapshot.analysis.generation?.mode === "model_loop" && forecast.agentDebate ? 15 : 0)
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
  if (input.factorScore < 20) {
    findings.push({ code: "FACTOR_COVERAGE_WEAK", severity: "critical", message: "\u56E0\u5B50\u8986\u76D6\u4E0D\u8DB3\uFF0C\u6982\u7387\u5224\u65AD\u7F3A\u5C11\u5B8C\u6574\u6A2A\u622A\u9762\u7EA6\u675F\u3002" });
  } else if (input.factorScore < 80) {
    findings.push({ code: "FACTOR_COVERAGE_THIN", severity: "warning", message: "\u90E8\u5206\u56E0\u5B50\u53EA\u6709\u5C11\u91CF\u8BC1\u636E\u6216\u660E\u786E\u7F3A\u6570\uFF0C\u9875\u9762\u5FC5\u987B\u4FDD\u7559\u8986\u76D6\u63D0\u793A\u3002" });
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
    const realizedAudits = audits.filter(
      (audit) => audit.outcomeStatus ? audit.outcomeStatus === "hit" || audit.outcomeStatus === "miss" : typeof audit.actualHit === "boolean"
    );
    if (realizedAudits.length === 0) {
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
    const metrics = this.backtest.generateCalibrationReport(realizedAudits);
    const status = realizedAudits.length >= MIN_OUTCOME_SAMPLE_SIZE ? "ready" : "insufficient_outcomes";
    return {
      modelName: "probability-rules-mvp-0.1",
      status,
      sampleSize: realizedAudits.length,
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
    return [...events].sort((a, b2) => {
      const scoreA = a.importance * 1.5 + a.confidence + (a.sourceReliability ?? 0.6) + freshnessScore(a.freshnessHours);
      const scoreB = b2.importance * 1.5 + b2.confidence + (b2.sourceReliability ?? 0.6) + freshnessScore(b2.freshnessHours);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b2.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime();
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
  if (events.length === 0) return Math.min(0.3, baseline);
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
      "recent_return",
      trend > 4 ? 70 : trend > 1 ? 62 : trend < -4 ? 35 : trend < -1 ? 43 : 50,
      0.3,
      `\u8FD1\u671F\u6536\u76CA\u7EA6 ${trend.toFixed(1)}%\u3002`
    ),
    component(
      "volatility_20d",
      volatility < 1.2 ? 62 : volatility < 2.5 ? 52 : 40,
      0.22,
      `\u8FD1\u7AEF\u6CE2\u52A8\u7387\u7EA6 ${volatility.toFixed(1)}%\u3002`
    ),
    component(
      "trend_slope",
      avgReturn > 0.4 ? 66 : avgReturn > 0 ? 58 : avgReturn < -0.4 ? 38 : 48,
      0.26,
      `\u4EF7\u683C\u659C\u7387\u7EA6 ${avgReturn.toFixed(2)}%\u3002`
    ),
    component(
      "drawdown_recovery",
      drawdown > -1 ? 62 : drawdown > -4 ? 52 : 40,
      0.22,
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
  const sourceEventIds = Array.from(new Set(components.flatMap((item) => item.sourceEventIds)));
  const evidenceCount = sourceEventIds.length;
  const coverage = evidenceCount >= 2 ? "covered" : evidenceCount === 1 ? "thin" : "missing";
  const ages = relevantEvents.map((event) => event.freshnessHours).filter((value) => value !== void 0);
  const freshness = ages.length === 0 ? "unknown" : Math.min(...ages) <= 48 ? "fresh" : Math.min(...ages) <= 24 * 30 ? "aging" : "stale";
  return {
    factor,
    label: FACTOR_LABELS[factor],
    score,
    confidence: confidenceFromEvents(relevantEvents, confidenceBaseline),
    direction: directionFromScore(score),
    reason,
    components,
    sourceEventIds,
    evidenceCount,
    coverage,
    freshness,
    topEvidence: components.filter((item) => item.sourceEventIds.length > 0).map((item) => item.evidence).slice(0, 3)
  };
}
var FactorEngine = class {
  generateFactors(quote2, history, events, memories = []) {
    const companyEvents = events.filter((event) => event.category === "\u516C\u53F8");
    const propertyEvents = events.filter((event) => event.category === "\u5730\u4EA7");
    const chinaAdrEvents = events.filter((event) => event.category === "\u4E2D\u6982");
    const macroEvents = events.filter((event) => event.category === "\u5B8F\u89C2");
    const geoEvents = events.filter((event) => event.category === "\u5730\u7F18");
    const technicalBase = factorFromComponents(
      "technical",
      scoreTechnicalComponents(quote2, history),
      [],
      "\u57FA\u4E8E\u8FD1\u671F\u6536\u76CA\u3001\u6CE2\u52A8\u3001\u659C\u7387\u548C\u56DE\u64A4\u4FEE\u590D\u7684\u76EE\u6807\u65E0\u5173\u6280\u672F\u9762\u8BC4\u5206\u3002",
      0.78
    );
    const technical = {
      ...technicalBase,
      confidence: history.length >= 60 ? 0.78 : history.length >= 20 ? 0.62 : 0.4,
      evidenceCount: history.length,
      coverage: history.length >= 20 ? "covered" : history.length > 1 ? "thin" : "missing",
      freshness: history.length > 0 ? "fresh" : "unknown",
      topEvidence: history.length > 0 ? [`${history.length} \u4E2A\u5386\u53F2\u4EF7\u683C\u89C2\u6D4B\u70B9`] : []
    };
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
        { name: "benchmark rate", weight: 0.22, match: (event) => /无风险|国债|收益率/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u57FA\u51C6\u5229\u7387\u7B49\u5F85\u786E\u8BA4\u3002" },
        { name: "global equity risk appetite", weight: 0.24, match: (event) => /风险偏好|全球股市|risk appetite/.test(`${event.title} ${event.summary}`.toLowerCase()), fallback: "\u5168\u7403\u98CE\u9669\u504F\u597D\u6682\u65E0\u5F3A\u8BC1\u636E\u3002" }
      ]),
      macroEvents,
      "\u57FA\u4E8E\u653F\u7B56\u5229\u7387\u3001\u6C47\u7387\u3001\u57FA\u51C6\u5229\u7387\u548C\u5168\u7403\u98CE\u9669\u504F\u597D\u62C6\u5206\u5B8F\u89C2\u73AF\u5883\u3002",
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

// src/research/context/buildResearchContext.ts
function stableHash(value) {
  const canonicalize = (item) => {
    if (Array.isArray(item)) return item.map(canonicalize);
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, canonicalize(nested)])
      );
    }
    return item;
  };
  const text = JSON.stringify(canonicalize(value));
  let hash2 = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash2 ^= text.charCodeAt(index);
    hash2 = Math.imul(hash2, 16777619);
  }
  return (hash2 >>> 0).toString(16).padStart(8, "0");
}
function percentile(values2, ratio) {
  if (values2.length === 0) return null;
  const ordered = [...values2].sort((a, b2) => a - b2);
  const index = Math.min(ordered.length - 1, Math.max(0, Math.round((ordered.length - 1) * ratio)));
  return Number(ordered[index].toFixed(2));
}
function evidenceFreshness(events, asOf) {
  const dates = events.map((event) => Date.parse(event.publishedAt ?? "")).filter(Number.isFinite);
  if (dates.length === 0) return "unknown";
  const ageHours = (Date.parse(asOf) - Math.max(...dates)) / 36e5;
  if (ageHours <= 48) return "fresh";
  if (ageHours <= 24 * 30) return "aging";
  return "stale";
}
function factorContext(factor, events, historyPoints, asOf) {
  const linked = events.filter((event) => factor.sourceEventIds.includes(event.id));
  const evidenceCount = factor.factor === "technical" ? historyPoints : factor.evidenceCount ?? new Set(factor.sourceEventIds).size;
  const coverage = factor.coverage ?? (evidenceCount >= (factor.factor === "technical" ? 20 : 2) ? "covered" : evidenceCount > 0 ? "thin" : "missing");
  const topEvidence = factor.topEvidence ?? [
    ...linked.map((event) => `${event.source}\uFF1A${event.title}`),
    ...(factor.components ?? []).filter((component2) => component2.sourceEventIds.length > 0).map((component2) => component2.evidence)
  ].filter(Boolean).slice(0, 3);
  return {
    factor: factor.factor,
    label: factor.label,
    score: factor.score,
    deltaFromNeutral: factor.score - 50,
    confidence: factor.confidence,
    coverage,
    evidenceCount,
    freshness: factor.freshness ?? (factor.factor === "technical" ? "fresh" : evidenceFreshness(linked, asOf)),
    evidenceIds: linked.map((event) => event.id),
    topEvidence,
    missingEvidence: coverage === "missing" ? [`${factor.label}\u7F3A\u5C11\u53EF\u6838\u9A8C\u7684\u5F53\u524D\u8BC1\u636E`] : [],
    reason: factor.reason
  };
}
function buildResearchContext(input) {
  const cutoffMs = Date.parse(input.quote.asOf);
  const pointInTimeEvents = input.events.filter((event) => {
    const observedMs = Date.parse(event.publishedAt ?? "");
    return !Number.isFinite(observedMs) || !Number.isFinite(cutoffMs) || observedMs <= cutoffMs;
  });
  const recentCloses = input.history.slice(-20).map((point) => point.close).filter((value) => value > 0);
  const dailyChangePercent = input.quote.previousClose > 0 ? (input.quote.price - input.quote.previousClose) / input.quote.previousClose * 100 : 0;
  const factors = input.factors.map(
    (factor) => factorContext(factor, pointInTimeEvents, input.history.length, input.quote.asOf)
  );
  const evidence = pointInTimeEvents.map((event) => ({
    evidenceId: event.id,
    title: event.title,
    category: event.category,
    impact: event.impact,
    source: event.source,
    sourceUrl: event.sourceUrl,
    observedAt: event.publishedAt,
    reliability: event.sourceReliability ?? event.confidence
  }));
  const dataGaps = factors.filter((factor) => factor.coverage !== "covered").map((factor) => `${factor.label}\uFF1A${factor.coverage === "missing" ? "\u7F3A\u5C11\u8BC1\u636E" : "\u8BC1\u636E\u504F\u5C11"}`);
  if (input.quote.provenance?.freshness === "fallback") dataGaps.push("\u884C\u60C5\u4F7F\u7528\u964D\u7EA7\u6765\u6E90");
  const content = {
    symbol: "BEKE",
    asOf: input.quote.asOf,
    quote: input.quote,
    predictions: input.predictions.map((prediction) => ({
      target: prediction.target,
      probability: prediction.probability,
      questionId: prediction.forecastQuestion?.questionId
    })),
    factors,
    evidence: evidence.map(({ evidenceId, observedAt, reliability }) => ({ evidenceId, observedAt, reliability })),
    previousRunId: input.previousSnapshot?.runId
  };
  return {
    contextId: `ctx-${stableHash(content)}`,
    schemaVersion: "research-context-v1",
    symbol: "BEKE",
    asOf: input.quote.asOf,
    evidenceCutoff: input.quote.asOf,
    market: {
      quote: input.quote,
      dailyChangePercent: Number(dailyChangePercent.toFixed(2)),
      supportLevel: percentile(recentCloses, 0.25),
      resistanceLevel: percentile(recentCloses, 0.75),
      historyPoints: input.history.length,
      methodology: "rolling-20d-quartiles-v1"
    },
    targets: input.predictions.map((prediction) => ({
      target: prediction.target,
      probability: prediction.probability,
      previousProbability: prediction.previousProbability,
      probabilityChange: prediction.probabilityChange,
      distancePercent: prediction.distancePercent,
      likelyWindow: prediction.likelyWindow,
      forecastQuestion: prediction.forecastQuestion,
      epistemicConfidence: prediction.epistemicConfidence,
      calibrationStatus: prediction.calibrationStatus
    })),
    factors,
    evidence,
    memories: input.memories.slice(0, 12).map((memory) => ({
      id: memory.id,
      type: memory.memoryType,
      content: memory.content,
      sourceEventId: memory.sourceEventId,
      confidence: memory.confidence,
      decayScore: memory.decayScore
    })),
    previousRunId: input.previousSnapshot?.runId,
    dataGaps
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
  getDefaultProviderInfo() {
    const provider = this.getProvider();
    return { name: provider.name, modelId: provider.modelId };
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
    } catch (error51) {
      const errorMessage2 = error51 instanceof Error ? error51.message : String(error51);
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
      throw error51;
    }
  }
  getCalls() {
    return [...this.calls];
  }
  getCallCount() {
    return this.calls.length;
  }
};

// node_modules/zod/v4/classic/external.js
var external_exports = {};
__export(external_exports, {
  $brand: () => $brand,
  $input: () => $input,
  $output: () => $output,
  NEVER: () => NEVER,
  TimePrecision: () => TimePrecision,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBase64: () => ZodBase64,
  ZodBase64URL: () => ZodBase64URL,
  ZodBigInt: () => ZodBigInt,
  ZodBigIntFormat: () => ZodBigIntFormat,
  ZodBoolean: () => ZodBoolean,
  ZodCIDRv4: () => ZodCIDRv4,
  ZodCIDRv6: () => ZodCIDRv6,
  ZodCUID: () => ZodCUID,
  ZodCUID2: () => ZodCUID2,
  ZodCatch: () => ZodCatch,
  ZodCodec: () => ZodCodec,
  ZodCustom: () => ZodCustom,
  ZodCustomStringFormat: () => ZodCustomStringFormat,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodE164: () => ZodE164,
  ZodEmail: () => ZodEmail,
  ZodEmoji: () => ZodEmoji,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodExactOptional: () => ZodExactOptional,
  ZodFile: () => ZodFile,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodGUID: () => ZodGUID,
  ZodIPv4: () => ZodIPv4,
  ZodIPv6: () => ZodIPv6,
  ZodISODate: () => ZodISODate,
  ZodISODateTime: () => ZodISODateTime,
  ZodISODuration: () => ZodISODuration,
  ZodISOTime: () => ZodISOTime,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodJWT: () => ZodJWT,
  ZodKSUID: () => ZodKSUID,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMAC: () => ZodMAC,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNanoID: () => ZodNanoID,
  ZodNever: () => ZodNever,
  ZodNonOptional: () => ZodNonOptional,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodNumberFormat: () => ZodNumberFormat,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodPipe: () => ZodPipe,
  ZodPrefault: () => ZodPrefault,
  ZodPreprocess: () => ZodPreprocess,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRealError: () => ZodRealError,
  ZodRecord: () => ZodRecord,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodStringFormat: () => ZodStringFormat,
  ZodSuccess: () => ZodSuccess,
  ZodSymbol: () => ZodSymbol,
  ZodTemplateLiteral: () => ZodTemplateLiteral,
  ZodTransform: () => ZodTransform,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodULID: () => ZodULID,
  ZodURL: () => ZodURL,
  ZodUUID: () => ZodUUID,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  ZodXID: () => ZodXID,
  ZodXor: () => ZodXor,
  _ZodString: () => _ZodString,
  _default: () => _default2,
  _function: () => _function,
  any: () => any,
  array: () => array,
  base64: () => base642,
  base64url: () => base64url2,
  bigint: () => bigint2,
  boolean: () => boolean2,
  catch: () => _catch2,
  check: () => check,
  cidrv4: () => cidrv42,
  cidrv6: () => cidrv62,
  clone: () => clone,
  codec: () => codec,
  coerce: () => coerce_exports,
  config: () => config,
  core: () => core_exports2,
  cuid: () => cuid3,
  cuid2: () => cuid22,
  custom: () => custom,
  date: () => date3,
  decode: () => decode2,
  decodeAsync: () => decodeAsync2,
  describe: () => describe2,
  discriminatedUnion: () => discriminatedUnion,
  e164: () => e1642,
  email: () => email2,
  emoji: () => emoji2,
  encode: () => encode2,
  encodeAsync: () => encodeAsync2,
  endsWith: () => _endsWith,
  enum: () => _enum2,
  exactOptional: () => exactOptional,
  file: () => file,
  flattenError: () => flattenError,
  float32: () => float32,
  float64: () => float64,
  formatError: () => formatError,
  fromJSONSchema: () => fromJSONSchema,
  function: () => _function,
  getErrorMap: () => getErrorMap,
  globalRegistry: () => globalRegistry,
  gt: () => _gt,
  gte: () => _gte,
  guid: () => guid2,
  hash: () => hash,
  hex: () => hex2,
  hostname: () => hostname2,
  httpUrl: () => httpUrl,
  includes: () => _includes,
  instanceof: () => _instanceof,
  int: () => int,
  int32: () => int32,
  int64: () => int64,
  intersection: () => intersection,
  invertCodec: () => invertCodec,
  ipv4: () => ipv42,
  ipv6: () => ipv62,
  iso: () => iso_exports,
  json: () => json,
  jwt: () => jwt,
  keyof: () => keyof,
  ksuid: () => ksuid2,
  lazy: () => lazy,
  length: () => _length,
  literal: () => literal,
  locales: () => locales_exports,
  looseObject: () => looseObject,
  looseRecord: () => looseRecord,
  lowercase: () => _lowercase,
  lt: () => _lt,
  lte: () => _lte,
  mac: () => mac2,
  map: () => map,
  maxLength: () => _maxLength,
  maxSize: () => _maxSize,
  meta: () => meta2,
  mime: () => _mime,
  minLength: () => _minLength,
  minSize: () => _minSize,
  multipleOf: () => _multipleOf,
  nan: () => nan,
  nanoid: () => nanoid2,
  nativeEnum: () => nativeEnum,
  negative: () => _negative,
  never: () => never,
  nonnegative: () => _nonnegative,
  nonoptional: () => nonoptional,
  nonpositive: () => _nonpositive,
  normalize: () => _normalize,
  null: () => _null3,
  nullable: () => nullable,
  nullish: () => nullish2,
  number: () => number2,
  object: () => object,
  optional: () => optional,
  overwrite: () => _overwrite,
  parse: () => parse2,
  parseAsync: () => parseAsync2,
  partialRecord: () => partialRecord,
  pipe: () => pipe,
  positive: () => _positive,
  prefault: () => prefault,
  preprocess: () => preprocess,
  prettifyError: () => prettifyError,
  promise: () => promise,
  property: () => _property,
  readonly: () => readonly,
  record: () => record,
  refine: () => refine,
  regex: () => _regex,
  regexes: () => regexes_exports,
  registry: () => registry,
  safeDecode: () => safeDecode2,
  safeDecodeAsync: () => safeDecodeAsync2,
  safeEncode: () => safeEncode2,
  safeEncodeAsync: () => safeEncodeAsync2,
  safeParse: () => safeParse2,
  safeParseAsync: () => safeParseAsync2,
  set: () => set,
  setErrorMap: () => setErrorMap,
  size: () => _size,
  slugify: () => _slugify,
  startsWith: () => _startsWith,
  strictObject: () => strictObject,
  string: () => string2,
  stringFormat: () => stringFormat,
  stringbool: () => stringbool,
  success: () => success,
  superRefine: () => superRefine,
  symbol: () => symbol,
  templateLiteral: () => templateLiteral,
  toJSONSchema: () => toJSONSchema,
  toLowerCase: () => _toLowerCase,
  toUpperCase: () => _toUpperCase,
  transform: () => transform,
  treeifyError: () => treeifyError,
  trim: () => _trim,
  tuple: () => tuple,
  uint32: () => uint32,
  uint64: () => uint64,
  ulid: () => ulid2,
  undefined: () => _undefined3,
  union: () => union,
  unknown: () => unknown,
  uppercase: () => _uppercase,
  url: () => url,
  util: () => util_exports,
  uuid: () => uuid2,
  uuidv4: () => uuidv4,
  uuidv6: () => uuidv6,
  uuidv7: () => uuidv7,
  void: () => _void2,
  xid: () => xid2,
  xor: () => xor
});

// node_modules/zod/v4/core/index.js
var core_exports2 = {};
__export(core_exports2, {
  $ZodAny: () => $ZodAny,
  $ZodArray: () => $ZodArray,
  $ZodAsyncError: () => $ZodAsyncError,
  $ZodBase64: () => $ZodBase64,
  $ZodBase64URL: () => $ZodBase64URL,
  $ZodBigInt: () => $ZodBigInt,
  $ZodBigIntFormat: () => $ZodBigIntFormat,
  $ZodBoolean: () => $ZodBoolean,
  $ZodCIDRv4: () => $ZodCIDRv4,
  $ZodCIDRv6: () => $ZodCIDRv6,
  $ZodCUID: () => $ZodCUID,
  $ZodCUID2: () => $ZodCUID2,
  $ZodCatch: () => $ZodCatch,
  $ZodCheck: () => $ZodCheck,
  $ZodCheckBigIntFormat: () => $ZodCheckBigIntFormat,
  $ZodCheckEndsWith: () => $ZodCheckEndsWith,
  $ZodCheckGreaterThan: () => $ZodCheckGreaterThan,
  $ZodCheckIncludes: () => $ZodCheckIncludes,
  $ZodCheckLengthEquals: () => $ZodCheckLengthEquals,
  $ZodCheckLessThan: () => $ZodCheckLessThan,
  $ZodCheckLowerCase: () => $ZodCheckLowerCase,
  $ZodCheckMaxLength: () => $ZodCheckMaxLength,
  $ZodCheckMaxSize: () => $ZodCheckMaxSize,
  $ZodCheckMimeType: () => $ZodCheckMimeType,
  $ZodCheckMinLength: () => $ZodCheckMinLength,
  $ZodCheckMinSize: () => $ZodCheckMinSize,
  $ZodCheckMultipleOf: () => $ZodCheckMultipleOf,
  $ZodCheckNumberFormat: () => $ZodCheckNumberFormat,
  $ZodCheckOverwrite: () => $ZodCheckOverwrite,
  $ZodCheckProperty: () => $ZodCheckProperty,
  $ZodCheckRegex: () => $ZodCheckRegex,
  $ZodCheckSizeEquals: () => $ZodCheckSizeEquals,
  $ZodCheckStartsWith: () => $ZodCheckStartsWith,
  $ZodCheckStringFormat: () => $ZodCheckStringFormat,
  $ZodCheckUpperCase: () => $ZodCheckUpperCase,
  $ZodCodec: () => $ZodCodec,
  $ZodCustom: () => $ZodCustom,
  $ZodCustomStringFormat: () => $ZodCustomStringFormat,
  $ZodDate: () => $ZodDate,
  $ZodDefault: () => $ZodDefault,
  $ZodDiscriminatedUnion: () => $ZodDiscriminatedUnion,
  $ZodE164: () => $ZodE164,
  $ZodEmail: () => $ZodEmail,
  $ZodEmoji: () => $ZodEmoji,
  $ZodEncodeError: () => $ZodEncodeError,
  $ZodEnum: () => $ZodEnum,
  $ZodError: () => $ZodError,
  $ZodExactOptional: () => $ZodExactOptional,
  $ZodFile: () => $ZodFile,
  $ZodFunction: () => $ZodFunction,
  $ZodGUID: () => $ZodGUID,
  $ZodIPv4: () => $ZodIPv4,
  $ZodIPv6: () => $ZodIPv6,
  $ZodISODate: () => $ZodISODate,
  $ZodISODateTime: () => $ZodISODateTime,
  $ZodISODuration: () => $ZodISODuration,
  $ZodISOTime: () => $ZodISOTime,
  $ZodIntersection: () => $ZodIntersection,
  $ZodJWT: () => $ZodJWT,
  $ZodKSUID: () => $ZodKSUID,
  $ZodLazy: () => $ZodLazy,
  $ZodLiteral: () => $ZodLiteral,
  $ZodMAC: () => $ZodMAC,
  $ZodMap: () => $ZodMap,
  $ZodNaN: () => $ZodNaN,
  $ZodNanoID: () => $ZodNanoID,
  $ZodNever: () => $ZodNever,
  $ZodNonOptional: () => $ZodNonOptional,
  $ZodNull: () => $ZodNull,
  $ZodNullable: () => $ZodNullable,
  $ZodNumber: () => $ZodNumber,
  $ZodNumberFormat: () => $ZodNumberFormat,
  $ZodObject: () => $ZodObject,
  $ZodObjectJIT: () => $ZodObjectJIT,
  $ZodOptional: () => $ZodOptional,
  $ZodPipe: () => $ZodPipe,
  $ZodPrefault: () => $ZodPrefault,
  $ZodPreprocess: () => $ZodPreprocess,
  $ZodPromise: () => $ZodPromise,
  $ZodReadonly: () => $ZodReadonly,
  $ZodRealError: () => $ZodRealError,
  $ZodRecord: () => $ZodRecord,
  $ZodRegistry: () => $ZodRegistry,
  $ZodSet: () => $ZodSet,
  $ZodString: () => $ZodString,
  $ZodStringFormat: () => $ZodStringFormat,
  $ZodSuccess: () => $ZodSuccess,
  $ZodSymbol: () => $ZodSymbol,
  $ZodTemplateLiteral: () => $ZodTemplateLiteral,
  $ZodTransform: () => $ZodTransform,
  $ZodTuple: () => $ZodTuple,
  $ZodType: () => $ZodType,
  $ZodULID: () => $ZodULID,
  $ZodURL: () => $ZodURL,
  $ZodUUID: () => $ZodUUID,
  $ZodUndefined: () => $ZodUndefined,
  $ZodUnion: () => $ZodUnion,
  $ZodUnknown: () => $ZodUnknown,
  $ZodVoid: () => $ZodVoid,
  $ZodXID: () => $ZodXID,
  $ZodXor: () => $ZodXor,
  $brand: () => $brand,
  $constructor: () => $constructor,
  $input: () => $input,
  $output: () => $output,
  Doc: () => Doc,
  JSONSchema: () => json_schema_exports,
  JSONSchemaGenerator: () => JSONSchemaGenerator,
  NEVER: () => NEVER,
  TimePrecision: () => TimePrecision,
  _any: () => _any,
  _array: () => _array,
  _base64: () => _base64,
  _base64url: () => _base64url,
  _bigint: () => _bigint,
  _boolean: () => _boolean,
  _catch: () => _catch,
  _check: () => _check,
  _cidrv4: () => _cidrv4,
  _cidrv6: () => _cidrv6,
  _coercedBigint: () => _coercedBigint,
  _coercedBoolean: () => _coercedBoolean,
  _coercedDate: () => _coercedDate,
  _coercedNumber: () => _coercedNumber,
  _coercedString: () => _coercedString,
  _cuid: () => _cuid,
  _cuid2: () => _cuid2,
  _custom: () => _custom,
  _date: () => _date,
  _decode: () => _decode,
  _decodeAsync: () => _decodeAsync,
  _default: () => _default,
  _discriminatedUnion: () => _discriminatedUnion,
  _e164: () => _e164,
  _email: () => _email,
  _emoji: () => _emoji2,
  _encode: () => _encode,
  _encodeAsync: () => _encodeAsync,
  _endsWith: () => _endsWith,
  _enum: () => _enum,
  _file: () => _file,
  _float32: () => _float32,
  _float64: () => _float64,
  _gt: () => _gt,
  _gte: () => _gte,
  _guid: () => _guid,
  _includes: () => _includes,
  _int: () => _int,
  _int32: () => _int32,
  _int64: () => _int64,
  _intersection: () => _intersection,
  _ipv4: () => _ipv4,
  _ipv6: () => _ipv6,
  _isoDate: () => _isoDate,
  _isoDateTime: () => _isoDateTime,
  _isoDuration: () => _isoDuration,
  _isoTime: () => _isoTime,
  _jwt: () => _jwt,
  _ksuid: () => _ksuid,
  _lazy: () => _lazy,
  _length: () => _length,
  _literal: () => _literal,
  _lowercase: () => _lowercase,
  _lt: () => _lt,
  _lte: () => _lte,
  _mac: () => _mac,
  _map: () => _map,
  _max: () => _lte,
  _maxLength: () => _maxLength,
  _maxSize: () => _maxSize,
  _mime: () => _mime,
  _min: () => _gte,
  _minLength: () => _minLength,
  _minSize: () => _minSize,
  _multipleOf: () => _multipleOf,
  _nan: () => _nan,
  _nanoid: () => _nanoid,
  _nativeEnum: () => _nativeEnum,
  _negative: () => _negative,
  _never: () => _never,
  _nonnegative: () => _nonnegative,
  _nonoptional: () => _nonoptional,
  _nonpositive: () => _nonpositive,
  _normalize: () => _normalize,
  _null: () => _null2,
  _nullable: () => _nullable,
  _number: () => _number,
  _optional: () => _optional,
  _overwrite: () => _overwrite,
  _parse: () => _parse,
  _parseAsync: () => _parseAsync,
  _pipe: () => _pipe,
  _positive: () => _positive,
  _promise: () => _promise,
  _property: () => _property,
  _readonly: () => _readonly,
  _record: () => _record,
  _refine: () => _refine,
  _regex: () => _regex,
  _safeDecode: () => _safeDecode,
  _safeDecodeAsync: () => _safeDecodeAsync,
  _safeEncode: () => _safeEncode,
  _safeEncodeAsync: () => _safeEncodeAsync,
  _safeParse: () => _safeParse,
  _safeParseAsync: () => _safeParseAsync,
  _set: () => _set,
  _size: () => _size,
  _slugify: () => _slugify,
  _startsWith: () => _startsWith,
  _string: () => _string,
  _stringFormat: () => _stringFormat,
  _stringbool: () => _stringbool,
  _success: () => _success,
  _superRefine: () => _superRefine,
  _symbol: () => _symbol,
  _templateLiteral: () => _templateLiteral,
  _toLowerCase: () => _toLowerCase,
  _toUpperCase: () => _toUpperCase,
  _transform: () => _transform,
  _trim: () => _trim,
  _tuple: () => _tuple,
  _uint32: () => _uint32,
  _uint64: () => _uint64,
  _ulid: () => _ulid,
  _undefined: () => _undefined2,
  _union: () => _union,
  _unknown: () => _unknown,
  _uppercase: () => _uppercase,
  _url: () => _url,
  _uuid: () => _uuid,
  _uuidv4: () => _uuidv4,
  _uuidv6: () => _uuidv6,
  _uuidv7: () => _uuidv7,
  _void: () => _void,
  _xid: () => _xid,
  _xor: () => _xor,
  clone: () => clone,
  config: () => config,
  createStandardJSONSchemaMethod: () => createStandardJSONSchemaMethod,
  createToJSONSchemaMethod: () => createToJSONSchemaMethod,
  decode: () => decode,
  decodeAsync: () => decodeAsync,
  describe: () => describe,
  encode: () => encode,
  encodeAsync: () => encodeAsync,
  extractDefs: () => extractDefs,
  finalize: () => finalize,
  flattenError: () => flattenError,
  formatError: () => formatError,
  globalConfig: () => globalConfig,
  globalRegistry: () => globalRegistry,
  initializeContext: () => initializeContext,
  isValidBase64: () => isValidBase64,
  isValidBase64URL: () => isValidBase64URL,
  isValidJWT: () => isValidJWT,
  locales: () => locales_exports,
  meta: () => meta,
  parse: () => parse,
  parseAsync: () => parseAsync,
  prettifyError: () => prettifyError,
  process: () => process2,
  regexes: () => regexes_exports,
  registry: () => registry,
  safeDecode: () => safeDecode,
  safeDecodeAsync: () => safeDecodeAsync,
  safeEncode: () => safeEncode,
  safeEncodeAsync: () => safeEncodeAsync,
  safeParse: () => safeParse,
  safeParseAsync: () => safeParseAsync,
  toDotPath: () => toDotPath,
  toJSONSchema: () => toJSONSchema,
  treeifyError: () => treeifyError,
  util: () => util_exports,
  version: () => version
});

// node_modules/zod/v4/core/core.js
var _a;
var NEVER = /* @__PURE__ */ Object.freeze({
  status: "aborted"
});
// @__NO_SIDE_EFFECTS__
function $constructor(name, initializer3, params) {
  function init(inst, def) {
    if (!inst._zod) {
      Object.defineProperty(inst, "_zod", {
        value: {
          def,
          constr: _,
          traits: /* @__PURE__ */ new Set()
        },
        enumerable: false
      });
    }
    if (inst._zod.traits.has(name)) {
      return;
    }
    inst._zod.traits.add(name);
    initializer3(inst, def);
    const proto = _.prototype;
    const keys = Object.keys(proto);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!(k in inst)) {
        inst[k] = proto[k].bind(inst);
      }
    }
  }
  const Parent = params?.Parent ?? Object;
  class Definition extends Parent {
  }
  Object.defineProperty(Definition, "name", { value: name });
  function _(def) {
    var _a3;
    const inst = params?.Parent ? new Definition() : this;
    init(inst, def);
    (_a3 = inst._zod).deferred ?? (_a3.deferred = []);
    for (const fn of inst._zod.deferred) {
      fn();
    }
    return inst;
  }
  Object.defineProperty(_, "init", { value: init });
  Object.defineProperty(_, Symbol.hasInstance, {
    value: (inst) => {
      if (params?.Parent && inst instanceof params.Parent)
        return true;
      return inst?._zod?.traits?.has(name);
    }
  });
  Object.defineProperty(_, "name", { value: name });
  return _;
}
var $brand = /* @__PURE__ */ Symbol("zod_brand");
var $ZodAsyncError = class extends Error {
  constructor() {
    super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
  }
};
var $ZodEncodeError = class extends Error {
  constructor(name) {
    super(`Encountered unidirectional transform during encode: ${name}`);
    this.name = "ZodEncodeError";
  }
};
(_a = globalThis).__zod_globalConfig ?? (_a.__zod_globalConfig = {});
var globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
  if (newConfig)
    Object.assign(globalConfig, newConfig);
  return globalConfig;
}

// node_modules/zod/v4/core/util.js
var util_exports = {};
__export(util_exports, {
  BIGINT_FORMAT_RANGES: () => BIGINT_FORMAT_RANGES,
  Class: () => Class,
  NUMBER_FORMAT_RANGES: () => NUMBER_FORMAT_RANGES,
  aborted: () => aborted,
  allowsEval: () => allowsEval,
  assert: () => assert,
  assertEqual: () => assertEqual,
  assertIs: () => assertIs,
  assertNever: () => assertNever,
  assertNotEqual: () => assertNotEqual,
  assignProp: () => assignProp,
  base64ToUint8Array: () => base64ToUint8Array,
  base64urlToUint8Array: () => base64urlToUint8Array,
  cached: () => cached,
  captureStackTrace: () => captureStackTrace,
  cleanEnum: () => cleanEnum,
  cleanRegex: () => cleanRegex,
  clone: () => clone,
  cloneDef: () => cloneDef,
  createTransparentProxy: () => createTransparentProxy,
  defineLazy: () => defineLazy,
  esc: () => esc,
  escapeRegex: () => escapeRegex,
  explicitlyAborted: () => explicitlyAborted,
  extend: () => extend,
  finalizeIssue: () => finalizeIssue,
  floatSafeRemainder: () => floatSafeRemainder,
  getElementAtPath: () => getElementAtPath,
  getEnumValues: () => getEnumValues,
  getLengthableOrigin: () => getLengthableOrigin,
  getParsedType: () => getParsedType,
  getSizableOrigin: () => getSizableOrigin,
  hexToUint8Array: () => hexToUint8Array,
  isObject: () => isObject,
  isPlainObject: () => isPlainObject,
  issue: () => issue,
  joinValues: () => joinValues,
  jsonStringifyReplacer: () => jsonStringifyReplacer,
  merge: () => merge,
  mergeDefs: () => mergeDefs,
  normalizeParams: () => normalizeParams,
  nullish: () => nullish,
  numKeys: () => numKeys,
  objectClone: () => objectClone,
  omit: () => omit,
  optionalKeys: () => optionalKeys,
  parsedType: () => parsedType,
  partial: () => partial,
  pick: () => pick,
  prefixIssues: () => prefixIssues,
  primitiveTypes: () => primitiveTypes,
  promiseAllObject: () => promiseAllObject,
  propertyKeyTypes: () => propertyKeyTypes,
  randomString: () => randomString,
  required: () => required,
  safeExtend: () => safeExtend,
  shallowClone: () => shallowClone,
  slugify: () => slugify,
  stringifyPrimitive: () => stringifyPrimitive,
  uint8ArrayToBase64: () => uint8ArrayToBase64,
  uint8ArrayToBase64url: () => uint8ArrayToBase64url,
  uint8ArrayToHex: () => uint8ArrayToHex,
  unwrapMessage: () => unwrapMessage
});
function assertEqual(val) {
  return val;
}
function assertNotEqual(val) {
  return val;
}
function assertIs(_arg) {
}
function assertNever(_x) {
  throw new Error("Unexpected value in exhaustive check");
}
function assert(_) {
}
function getEnumValues(entries) {
  const numericValues = Object.values(entries).filter((v) => typeof v === "number");
  const values2 = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
  return values2;
}
function joinValues(array2, separator = "|") {
  return array2.map((val) => stringifyPrimitive(val)).join(separator);
}
function jsonStringifyReplacer(_, value) {
  if (typeof value === "bigint")
    return value.toString();
  return value;
}
function cached(getter) {
  const set2 = false;
  return {
    get value() {
      if (!set2) {
        const value = getter();
        Object.defineProperty(this, "value", { value });
        return value;
      }
      throw new Error("cached value already set");
    }
  };
}
function nullish(input) {
  return input === null || input === void 0;
}
function cleanRegex(source) {
  const start = source.startsWith("^") ? 1 : 0;
  const end = source.endsWith("$") ? source.length - 1 : source.length;
  return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
  const ratio = val / step;
  const roundedRatio = Math.round(ratio);
  const tolerance = Number.EPSILON * Math.max(Math.abs(ratio), 1);
  if (Math.abs(ratio - roundedRatio) < tolerance)
    return 0;
  return ratio - roundedRatio;
}
var EVALUATING = /* @__PURE__ */ Symbol("evaluating");
function defineLazy(object2, key, getter) {
  let value = void 0;
  Object.defineProperty(object2, key, {
    get() {
      if (value === EVALUATING) {
        return void 0;
      }
      if (value === void 0) {
        value = EVALUATING;
        value = getter();
      }
      return value;
    },
    set(v) {
      Object.defineProperty(object2, key, {
        value: v
        // configurable: true,
      });
    },
    configurable: true
  });
}
function objectClone(obj) {
  return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj));
}
function assignProp(target, prop, value) {
  Object.defineProperty(target, prop, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
function mergeDefs(...defs) {
  const mergedDescriptors = {};
  for (const def of defs) {
    const descriptors = Object.getOwnPropertyDescriptors(def);
    Object.assign(mergedDescriptors, descriptors);
  }
  return Object.defineProperties({}, mergedDescriptors);
}
function cloneDef(schema) {
  return mergeDefs(schema._zod.def);
}
function getElementAtPath(obj, path) {
  if (!path)
    return obj;
  return path.reduce((acc, key) => acc?.[key], obj);
}
function promiseAllObject(promisesObj) {
  const keys = Object.keys(promisesObj);
  const promises = keys.map((key) => promisesObj[key]);
  return Promise.all(promises).then((results) => {
    const resolvedObj = {};
    for (let i = 0; i < keys.length; i++) {
      resolvedObj[keys[i]] = results[i];
    }
    return resolvedObj;
  });
}
function randomString(length = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let str = "";
  for (let i = 0; i < length; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
}
function esc(str) {
  return JSON.stringify(str);
}
function slugify(input) {
  return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
var captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {
};
function isObject(data) {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
var allowsEval = /* @__PURE__ */ cached(() => {
  if (globalConfig.jitless) {
    return false;
  }
  if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
    return false;
  }
  try {
    const F = Function;
    new F("");
    return true;
  } catch (_) {
    return false;
  }
});
function isPlainObject(o) {
  if (isObject(o) === false)
    return false;
  const ctor = o.constructor;
  if (ctor === void 0)
    return true;
  if (typeof ctor !== "function")
    return true;
  const prot = ctor.prototype;
  if (isObject(prot) === false)
    return false;
  if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
    return false;
  }
  return true;
}
function shallowClone(o) {
  if (isPlainObject(o))
    return { ...o };
  if (Array.isArray(o))
    return [...o];
  if (o instanceof Map)
    return new Map(o);
  if (o instanceof Set)
    return new Set(o);
  return o;
}
function numKeys(data) {
  let keyCount = 0;
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      keyCount++;
    }
  }
  return keyCount;
}
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return "undefined";
    case "string":
      return "string";
    case "number":
      return Number.isNaN(data) ? "nan" : "number";
    case "boolean":
      return "boolean";
    case "function":
      return "function";
    case "bigint":
      return "bigint";
    case "symbol":
      return "symbol";
    case "object":
      if (Array.isArray(data)) {
        return "array";
      }
      if (data === null) {
        return "null";
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return "promise";
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return "map";
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return "set";
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return "date";
      }
      if (typeof File !== "undefined" && data instanceof File) {
        return "file";
      }
      return "object";
    default:
      throw new Error(`Unknown data type: ${t}`);
  }
};
var propertyKeyTypes = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
var primitiveTypes = /* @__PURE__ */ new Set([
  "string",
  "number",
  "bigint",
  "boolean",
  "symbol",
  "undefined"
]);
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
  const cl = new inst._zod.constr(def ?? inst._zod.def);
  if (!def || params?.parent)
    cl._zod.parent = inst;
  return cl;
}
function normalizeParams(_params) {
  const params = _params;
  if (!params)
    return {};
  if (typeof params === "string")
    return { error: () => params };
  if (params?.message !== void 0) {
    if (params?.error !== void 0)
      throw new Error("Cannot specify both `message` and `error` params");
    params.error = params.message;
  }
  delete params.message;
  if (typeof params.error === "string")
    return { ...params, error: () => params.error };
  return params;
}
function createTransparentProxy(getter) {
  let target;
  return new Proxy({}, {
    get(_, prop, receiver) {
      target ?? (target = getter());
      return Reflect.get(target, prop, receiver);
    },
    set(_, prop, value, receiver) {
      target ?? (target = getter());
      return Reflect.set(target, prop, value, receiver);
    },
    has(_, prop) {
      target ?? (target = getter());
      return Reflect.has(target, prop);
    },
    deleteProperty(_, prop) {
      target ?? (target = getter());
      return Reflect.deleteProperty(target, prop);
    },
    ownKeys(_) {
      target ?? (target = getter());
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(_, prop) {
      target ?? (target = getter());
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    defineProperty(_, prop, descriptor) {
      target ?? (target = getter());
      return Reflect.defineProperty(target, prop, descriptor);
    }
  });
}
function stringifyPrimitive(value) {
  if (typeof value === "bigint")
    return value.toString() + "n";
  if (typeof value === "string")
    return `"${value}"`;
  return `${value}`;
}
function optionalKeys(shape) {
  return Object.keys(shape).filter((k) => {
    return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
  });
}
var NUMBER_FORMAT_RANGES = {
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-34028234663852886e22, 34028234663852886e22],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
};
var BIGINT_FORMAT_RANGES = {
  int64: [/* @__PURE__ */ BigInt("-9223372036854775808"), /* @__PURE__ */ BigInt("9223372036854775807")],
  uint64: [/* @__PURE__ */ BigInt(0), /* @__PURE__ */ BigInt("18446744073709551615")]
};
function pick(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = {};
      for (const key in mask) {
        if (!(key in currDef.shape)) {
          throw new Error(`Unrecognized key: "${key}"`);
        }
        if (!mask[key])
          continue;
        newShape[key] = currDef.shape[key];
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function omit(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = { ...schema._zod.def.shape };
      for (const key in mask) {
        if (!(key in currDef.shape)) {
          throw new Error(`Unrecognized key: "${key}"`);
        }
        if (!mask[key])
          continue;
        delete newShape[key];
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function extend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to extend: expected a plain object");
  }
  const checks = schema._zod.def.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    const existingShape = schema._zod.def.shape;
    for (const key in shape) {
      if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) {
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
      }
    }
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape };
      assignProp(this, "shape", _shape);
      return _shape;
    }
  });
  return clone(schema, def);
}
function safeExtend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to safeExtend: expected a plain object");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape };
      assignProp(this, "shape", _shape);
      return _shape;
    }
  });
  return clone(schema, def);
}
function merge(a, b2) {
  if (a._zod.def.checks?.length) {
    throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
  }
  const def = mergeDefs(a._zod.def, {
    get shape() {
      const _shape = { ...a._zod.def.shape, ...b2._zod.def.shape };
      assignProp(this, "shape", _shape);
      return _shape;
    },
    get catchall() {
      return b2._zod.def.catchall;
    },
    checks: b2._zod.def.checks ?? []
  });
  return clone(a, def);
}
function partial(Class2, schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".partial() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const oldShape = schema._zod.def.shape;
      const shape = { ...oldShape };
      if (mask) {
        for (const key in mask) {
          if (!(key in oldShape)) {
            throw new Error(`Unrecognized key: "${key}"`);
          }
          if (!mask[key])
            continue;
          shape[key] = Class2 ? new Class2({
            type: "optional",
            innerType: oldShape[key]
          }) : oldShape[key];
        }
      } else {
        for (const key in oldShape) {
          shape[key] = Class2 ? new Class2({
            type: "optional",
            innerType: oldShape[key]
          }) : oldShape[key];
        }
      }
      assignProp(this, "shape", shape);
      return shape;
    },
    checks: []
  });
  return clone(schema, def);
}
function required(Class2, schema, mask) {
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const oldShape = schema._zod.def.shape;
      const shape = { ...oldShape };
      if (mask) {
        for (const key in mask) {
          if (!(key in shape)) {
            throw new Error(`Unrecognized key: "${key}"`);
          }
          if (!mask[key])
            continue;
          shape[key] = new Class2({
            type: "nonoptional",
            innerType: oldShape[key]
          });
        }
      } else {
        for (const key in oldShape) {
          shape[key] = new Class2({
            type: "nonoptional",
            innerType: oldShape[key]
          });
        }
      }
      assignProp(this, "shape", shape);
      return shape;
    }
  });
  return clone(schema, def);
}
function aborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (x.issues[i]?.continue !== true) {
      return true;
    }
  }
  return false;
}
function explicitlyAborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (x.issues[i]?.continue === false) {
      return true;
    }
  }
  return false;
}
function prefixIssues(path, issues) {
  return issues.map((iss) => {
    var _a3;
    (_a3 = iss).path ?? (_a3.path = []);
    iss.path.unshift(path);
    return iss;
  });
}
function unwrapMessage(message) {
  return typeof message === "string" ? message : message?.message;
}
function finalizeIssue(iss, ctx, config2) {
  const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config2.customError?.(iss)) ?? unwrapMessage(config2.localeError?.(iss)) ?? "Invalid input";
  const { inst: _inst, continue: _continue, input: _input, ...rest } = iss;
  rest.path ?? (rest.path = []);
  rest.message = message;
  if (ctx?.reportInput) {
    rest.input = _input;
  }
  return rest;
}
function getSizableOrigin(input) {
  if (input instanceof Set)
    return "set";
  if (input instanceof Map)
    return "map";
  if (input instanceof File)
    return "file";
  return "unknown";
}
function getLengthableOrigin(input) {
  if (Array.isArray(input))
    return "array";
  if (typeof input === "string")
    return "string";
  return "unknown";
}
function parsedType(data) {
  const t = typeof data;
  switch (t) {
    case "number": {
      return Number.isNaN(data) ? "nan" : "number";
    }
    case "object": {
      if (data === null) {
        return "null";
      }
      if (Array.isArray(data)) {
        return "array";
      }
      const obj = data;
      if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) {
        return obj.constructor.name;
      }
    }
  }
  return t;
}
function issue(...args) {
  const [iss, input, inst] = args;
  if (typeof iss === "string") {
    return {
      message: iss,
      code: "custom",
      input,
      inst
    };
  }
  return { ...iss };
}
function cleanEnum(obj) {
  return Object.entries(obj).filter(([k, _]) => {
    return Number.isNaN(Number.parseInt(k, 10));
  }).map((el) => el[1]);
}
function base64ToUint8Array(base643) {
  const binaryString = atob(base643);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
function uint8ArrayToBase64(bytes) {
  let binaryString = "";
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  return btoa(binaryString);
}
function base64urlToUint8Array(base64url3) {
  const base643 = base64url3.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - base643.length % 4) % 4);
  return base64ToUint8Array(base643 + padding);
}
function uint8ArrayToBase64url(bytes) {
  return uint8ArrayToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function hexToUint8Array(hex3) {
  const cleanHex = hex3.replace(/^0x/, "");
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}
function uint8ArrayToHex(bytes) {
  return Array.from(bytes).map((b2) => b2.toString(16).padStart(2, "0")).join("");
}
var Class = class {
  constructor(..._args) {
  }
};

// node_modules/zod/v4/core/errors.js
var initializer = (inst, def) => {
  inst.name = "$ZodError";
  Object.defineProperty(inst, "_zod", {
    value: inst._zod,
    enumerable: false
  });
  Object.defineProperty(inst, "issues", {
    value: def,
    enumerable: false
  });
  inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
  Object.defineProperty(inst, "toString", {
    value: () => inst.message,
    enumerable: false
  });
};
var $ZodError = $constructor("$ZodError", initializer);
var $ZodRealError = $constructor("$ZodError", initializer, { Parent: Error });
function flattenError(error51, mapper = (issue2) => issue2.message) {
  const fieldErrors = {};
  const formErrors = [];
  for (const sub of error51.issues) {
    if (sub.path.length > 0) {
      fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
      fieldErrors[sub.path[0]].push(mapper(sub));
    } else {
      formErrors.push(mapper(sub));
    }
  }
  return { formErrors, fieldErrors };
}
function formatError(error51, mapper = (issue2) => issue2.message) {
  const fieldErrors = { _errors: [] };
  const processError = (error52, path = []) => {
    for (const issue2 of error52.issues) {
      if (issue2.code === "invalid_union" && issue2.errors.length) {
        issue2.errors.map((issues) => processError({ issues }, [...path, ...issue2.path]));
      } else if (issue2.code === "invalid_key") {
        processError({ issues: issue2.issues }, [...path, ...issue2.path]);
      } else if (issue2.code === "invalid_element") {
        processError({ issues: issue2.issues }, [...path, ...issue2.path]);
      } else {
        const fullpath = [...path, ...issue2.path];
        if (fullpath.length === 0) {
          fieldErrors._errors.push(mapper(issue2));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < fullpath.length) {
            const el = fullpath[i];
            const terminal = i === fullpath.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue2));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    }
  };
  processError(error51);
  return fieldErrors;
}
function treeifyError(error51, mapper = (issue2) => issue2.message) {
  const result = { errors: [] };
  const processError = (error52, path = []) => {
    var _a3, _b;
    for (const issue2 of error52.issues) {
      if (issue2.code === "invalid_union" && issue2.errors.length) {
        issue2.errors.map((issues) => processError({ issues }, [...path, ...issue2.path]));
      } else if (issue2.code === "invalid_key") {
        processError({ issues: issue2.issues }, [...path, ...issue2.path]);
      } else if (issue2.code === "invalid_element") {
        processError({ issues: issue2.issues }, [...path, ...issue2.path]);
      } else {
        const fullpath = [...path, ...issue2.path];
        if (fullpath.length === 0) {
          result.errors.push(mapper(issue2));
          continue;
        }
        let curr = result;
        let i = 0;
        while (i < fullpath.length) {
          const el = fullpath[i];
          const terminal = i === fullpath.length - 1;
          if (typeof el === "string") {
            curr.properties ?? (curr.properties = {});
            (_a3 = curr.properties)[el] ?? (_a3[el] = { errors: [] });
            curr = curr.properties[el];
          } else {
            curr.items ?? (curr.items = []);
            (_b = curr.items)[el] ?? (_b[el] = { errors: [] });
            curr = curr.items[el];
          }
          if (terminal) {
            curr.errors.push(mapper(issue2));
          }
          i++;
        }
      }
    }
  };
  processError(error51);
  return result;
}
function toDotPath(_path) {
  const segs = [];
  const path = _path.map((seg) => typeof seg === "object" ? seg.key : seg);
  for (const seg of path) {
    if (typeof seg === "number")
      segs.push(`[${seg}]`);
    else if (typeof seg === "symbol")
      segs.push(`[${JSON.stringify(String(seg))}]`);
    else if (/[^\w$]/.test(seg))
      segs.push(`[${JSON.stringify(seg)}]`);
    else {
      if (segs.length)
        segs.push(".");
      segs.push(seg);
    }
  }
  return segs.join("");
}
function prettifyError(error51) {
  const lines = [];
  const issues = [...error51.issues].sort((a, b2) => (a.path ?? []).length - (b2.path ?? []).length);
  for (const issue2 of issues) {
    lines.push(`\u2716 ${issue2.message}`);
    if (issue2.path?.length)
      lines.push(`  \u2192 at ${toDotPath(issue2.path)}`);
  }
  return lines.join("\n");
}

// node_modules/zod/v4/core/parse.js
var _parse = (_Err) => (schema, value, _ctx, _params) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  if (result.issues.length) {
    const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, _params?.callee);
    throw e;
  }
  return result.value;
};
var parse = /* @__PURE__ */ _parse($ZodRealError);
var _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  if (result.issues.length) {
    const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, params?.callee);
    throw e;
  }
  return result.value;
};
var parseAsync = /* @__PURE__ */ _parseAsync($ZodRealError);
var _safeParse = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  return result.issues.length ? {
    success: false,
    error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
var safeParse = /* @__PURE__ */ _safeParse($ZodRealError);
var _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length ? {
    success: false,
    error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
var safeParseAsync = /* @__PURE__ */ _safeParseAsync($ZodRealError);
var _encode = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _parse(_Err)(schema, value, ctx);
};
var encode = /* @__PURE__ */ _encode($ZodRealError);
var _decode = (_Err) => (schema, value, _ctx) => {
  return _parse(_Err)(schema, value, _ctx);
};
var decode = /* @__PURE__ */ _decode($ZodRealError);
var _encodeAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _parseAsync(_Err)(schema, value, ctx);
};
var encodeAsync = /* @__PURE__ */ _encodeAsync($ZodRealError);
var _decodeAsync = (_Err) => async (schema, value, _ctx) => {
  return _parseAsync(_Err)(schema, value, _ctx);
};
var decodeAsync = /* @__PURE__ */ _decodeAsync($ZodRealError);
var _safeEncode = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParse(_Err)(schema, value, ctx);
};
var safeEncode = /* @__PURE__ */ _safeEncode($ZodRealError);
var _safeDecode = (_Err) => (schema, value, _ctx) => {
  return _safeParse(_Err)(schema, value, _ctx);
};
var safeDecode = /* @__PURE__ */ _safeDecode($ZodRealError);
var _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParseAsync(_Err)(schema, value, ctx);
};
var safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync($ZodRealError);
var _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
  return _safeParseAsync(_Err)(schema, value, _ctx);
};
var safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync($ZodRealError);

// node_modules/zod/v4/core/regexes.js
var regexes_exports = {};
__export(regexes_exports, {
  base64: () => base64,
  base64url: () => base64url,
  bigint: () => bigint,
  boolean: () => boolean,
  browserEmail: () => browserEmail,
  cidrv4: () => cidrv4,
  cidrv6: () => cidrv6,
  cuid: () => cuid,
  cuid2: () => cuid2,
  date: () => date,
  datetime: () => datetime,
  domain: () => domain,
  duration: () => duration,
  e164: () => e164,
  email: () => email,
  emoji: () => emoji,
  extendedDuration: () => extendedDuration,
  guid: () => guid,
  hex: () => hex,
  hostname: () => hostname,
  html5Email: () => html5Email,
  httpProtocol: () => httpProtocol,
  idnEmail: () => idnEmail,
  integer: () => integer,
  ipv4: () => ipv4,
  ipv6: () => ipv6,
  ksuid: () => ksuid,
  lowercase: () => lowercase,
  mac: () => mac,
  md5_base64: () => md5_base64,
  md5_base64url: () => md5_base64url,
  md5_hex: () => md5_hex,
  nanoid: () => nanoid,
  null: () => _null,
  number: () => number,
  rfc5322Email: () => rfc5322Email,
  sha1_base64: () => sha1_base64,
  sha1_base64url: () => sha1_base64url,
  sha1_hex: () => sha1_hex,
  sha256_base64: () => sha256_base64,
  sha256_base64url: () => sha256_base64url,
  sha256_hex: () => sha256_hex,
  sha384_base64: () => sha384_base64,
  sha384_base64url: () => sha384_base64url,
  sha384_hex: () => sha384_hex,
  sha512_base64: () => sha512_base64,
  sha512_base64url: () => sha512_base64url,
  sha512_hex: () => sha512_hex,
  string: () => string,
  time: () => time,
  ulid: () => ulid,
  undefined: () => _undefined,
  unicodeEmail: () => unicodeEmail,
  uppercase: () => uppercase,
  uuid: () => uuid,
  uuid4: () => uuid4,
  uuid6: () => uuid6,
  uuid7: () => uuid7,
  xid: () => xid
});
var cuid = /^[cC][0-9a-z]{6,}$/;
var cuid2 = /^[0-9a-z]+$/;
var ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
var xid = /^[0-9a-vA-V]{20}$/;
var ksuid = /^[A-Za-z0-9]{27}$/;
var nanoid = /^[a-zA-Z0-9_-]{21}$/;
var duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
var extendedDuration = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
var uuid = (version2) => {
  if (!version2)
    return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
  return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version2}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
var uuid4 = /* @__PURE__ */ uuid(4);
var uuid6 = /* @__PURE__ */ uuid(6);
var uuid7 = /* @__PURE__ */ uuid(7);
var email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
var html5Email = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
var rfc5322Email = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
var unicodeEmail = /^[^\s@"]{1,64}@[^\s@]{1,255}$/u;
var idnEmail = unicodeEmail;
var browserEmail = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
var _emoji = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
function emoji() {
  return new RegExp(_emoji, "u");
}
var ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
var mac = (delimiter) => {
  const escapedDelim = escapeRegex(delimiter ?? ":");
  return new RegExp(`^(?:[0-9A-F]{2}${escapedDelim}){5}[0-9A-F]{2}$|^(?:[0-9a-f]{2}${escapedDelim}){5}[0-9a-f]{2}$`);
};
var cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
var cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
var base64url = /^[A-Za-z0-9_-]*$/;
var hostname = /^(?=.{1,253}\.?$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[-0-9a-zA-Z]{0,61}[0-9a-zA-Z])?)*\.?$/;
var domain = /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
var httpProtocol = /^https?$/;
var e164 = /^\+[1-9]\d{6,14}$/;
var dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
var date = /* @__PURE__ */ new RegExp(`^${dateSource}$`);
function timeSource(args) {
  const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
  const regex = typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
  return regex;
}
function time(args) {
  return new RegExp(`^${timeSource(args)}$`);
}
function datetime(args) {
  const time3 = timeSource({ precision: args.precision });
  const opts = ["Z"];
  if (args.local)
    opts.push("");
  if (args.offset)
    opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
  const timeRegex = `${time3}(?:${opts.join("|")})`;
  return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
var string = (params) => {
  const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
  return new RegExp(`^${regex}$`);
};
var bigint = /^-?\d+n?$/;
var integer = /^-?\d+$/;
var number = /^-?\d+(?:\.\d+)?$/;
var boolean = /^(?:true|false)$/i;
var _null = /^null$/i;
var _undefined = /^undefined$/i;
var lowercase = /^[^A-Z]*$/;
var uppercase = /^[^a-z]*$/;
var hex = /^[0-9a-fA-F]*$/;
function fixedBase64(bodyLength, padding) {
  return new RegExp(`^[A-Za-z0-9+/]{${bodyLength}}${padding}$`);
}
function fixedBase64url(length) {
  return new RegExp(`^[A-Za-z0-9_-]{${length}}$`);
}
var md5_hex = /^[0-9a-fA-F]{32}$/;
var md5_base64 = /* @__PURE__ */ fixedBase64(22, "==");
var md5_base64url = /* @__PURE__ */ fixedBase64url(22);
var sha1_hex = /^[0-9a-fA-F]{40}$/;
var sha1_base64 = /* @__PURE__ */ fixedBase64(27, "=");
var sha1_base64url = /* @__PURE__ */ fixedBase64url(27);
var sha256_hex = /^[0-9a-fA-F]{64}$/;
var sha256_base64 = /* @__PURE__ */ fixedBase64(43, "=");
var sha256_base64url = /* @__PURE__ */ fixedBase64url(43);
var sha384_hex = /^[0-9a-fA-F]{96}$/;
var sha384_base64 = /* @__PURE__ */ fixedBase64(64, "");
var sha384_base64url = /* @__PURE__ */ fixedBase64url(64);
var sha512_hex = /^[0-9a-fA-F]{128}$/;
var sha512_base64 = /* @__PURE__ */ fixedBase64(86, "==");
var sha512_base64url = /* @__PURE__ */ fixedBase64url(86);

// node_modules/zod/v4/core/checks.js
var $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
  var _a3;
  inst._zod ?? (inst._zod = {});
  inst._zod.def = def;
  (_a3 = inst._zod).onattach ?? (_a3.onattach = []);
});
var numericOriginMap = {
  number: "number",
  bigint: "bigint",
  object: "date"
};
var $ZodCheckLessThan = /* @__PURE__ */ $constructor("$ZodCheckLessThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
    if (def.value < curr) {
      if (def.inclusive)
        bag.maximum = def.value;
      else
        bag.exclusiveMaximum = def.value;
    }
  });
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
      return;
    }
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckGreaterThan = /* @__PURE__ */ $constructor("$ZodCheckGreaterThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
    if (def.value > curr) {
      if (def.inclusive)
        bag.minimum = def.value;
      else
        bag.exclusiveMinimum = def.value;
    }
  });
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
      return;
    }
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckMultipleOf = /* @__PURE__ */ $constructor("$ZodCheckMultipleOf", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.onattach.push((inst2) => {
    var _a3;
    (_a3 = inst2._zod.bag).multipleOf ?? (_a3.multipleOf = def.value);
  });
  inst._zod.check = (payload) => {
    if (typeof payload.value !== typeof def.value)
      throw new Error("Cannot mix number and bigint in multiple_of check.");
    const isMultiple = typeof payload.value === "bigint" ? payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0;
    if (isMultiple)
      return;
    payload.issues.push({
      origin: typeof payload.value,
      code: "not_multiple_of",
      divisor: def.value,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckNumberFormat = /* @__PURE__ */ $constructor("$ZodCheckNumberFormat", (inst, def) => {
  $ZodCheck.init(inst, def);
  def.format = def.format || "float64";
  const isInt = def.format?.includes("int");
  const origin = isInt ? "int" : "number";
  const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.format = def.format;
    bag.minimum = minimum;
    bag.maximum = maximum;
    if (isInt)
      bag.pattern = integer;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    if (isInt) {
      if (!Number.isInteger(input)) {
        payload.issues.push({
          expected: origin,
          format: def.format,
          code: "invalid_type",
          continue: false,
          input,
          inst
        });
        return;
      }
      if (!Number.isSafeInteger(input)) {
        if (input > 0) {
          payload.issues.push({
            input,
            code: "too_big",
            maximum: Number.MAX_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        } else {
          payload.issues.push({
            input,
            code: "too_small",
            minimum: Number.MIN_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        }
        return;
      }
    }
    if (input < minimum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_small",
        minimum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
    if (input > maximum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_big",
        maximum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodCheckBigIntFormat = /* @__PURE__ */ $constructor("$ZodCheckBigIntFormat", (inst, def) => {
  $ZodCheck.init(inst, def);
  const [minimum, maximum] = BIGINT_FORMAT_RANGES[def.format];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.format = def.format;
    bag.minimum = minimum;
    bag.maximum = maximum;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    if (input < minimum) {
      payload.issues.push({
        origin: "bigint",
        input,
        code: "too_small",
        minimum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
    if (input > maximum) {
      payload.issues.push({
        origin: "bigint",
        input,
        code: "too_big",
        maximum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodCheckMaxSize = /* @__PURE__ */ $constructor("$ZodCheckMaxSize", (inst, def) => {
  var _a3;
  $ZodCheck.init(inst, def);
  (_a3 = inst._zod.def).when ?? (_a3.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.size !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    if (def.maximum < curr)
      inst2._zod.bag.maximum = def.maximum;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const size2 = input.size;
    if (size2 <= def.maximum)
      return;
    payload.issues.push({
      origin: getSizableOrigin(input),
      code: "too_big",
      maximum: def.maximum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckMinSize = /* @__PURE__ */ $constructor("$ZodCheckMinSize", (inst, def) => {
  var _a3;
  $ZodCheck.init(inst, def);
  (_a3 = inst._zod.def).when ?? (_a3.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.size !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    if (def.minimum > curr)
      inst2._zod.bag.minimum = def.minimum;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const size2 = input.size;
    if (size2 >= def.minimum)
      return;
    payload.issues.push({
      origin: getSizableOrigin(input),
      code: "too_small",
      minimum: def.minimum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckSizeEquals = /* @__PURE__ */ $constructor("$ZodCheckSizeEquals", (inst, def) => {
  var _a3;
  $ZodCheck.init(inst, def);
  (_a3 = inst._zod.def).when ?? (_a3.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.size !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.minimum = def.size;
    bag.maximum = def.size;
    bag.size = def.size;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const size2 = input.size;
    if (size2 === def.size)
      return;
    const tooBig = size2 > def.size;
    payload.issues.push({
      origin: getSizableOrigin(input),
      ...tooBig ? { code: "too_big", maximum: def.size } : { code: "too_small", minimum: def.size },
      inclusive: true,
      exact: true,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
  var _a3;
  $ZodCheck.init(inst, def);
  (_a3 = inst._zod.def).when ?? (_a3.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    if (def.maximum < curr)
      inst2._zod.bag.maximum = def.maximum;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length <= def.maximum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: def.maximum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
  var _a3;
  $ZodCheck.init(inst, def);
  (_a3 = inst._zod.def).when ?? (_a3.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    if (def.minimum > curr)
      inst2._zod.bag.minimum = def.minimum;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length >= def.minimum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: def.minimum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
  var _a3;
  $ZodCheck.init(inst, def);
  (_a3 = inst._zod.def).when ?? (_a3.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.minimum = def.length;
    bag.maximum = def.length;
    bag.length = def.length;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length === def.length)
      return;
    const origin = getLengthableOrigin(input);
    const tooBig = length > def.length;
    payload.issues.push({
      origin,
      ...tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length },
      inclusive: true,
      exact: true,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
  var _a3, _b;
  $ZodCheck.init(inst, def);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.format = def.format;
    if (def.pattern) {
      bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
      bag.patterns.add(def.pattern);
    }
  });
  if (def.pattern)
    (_a3 = inst._zod).check ?? (_a3.check = (payload) => {
      def.pattern.lastIndex = 0;
      if (def.pattern.test(payload.value))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: def.format,
        input: payload.value,
        ...def.pattern ? { pattern: def.pattern.toString() } : {},
        inst,
        continue: !def.abort
      });
    });
  else
    (_b = inst._zod).check ?? (_b.check = () => {
    });
});
var $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    def.pattern.lastIndex = 0;
    if (def.pattern.test(payload.value))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: payload.value,
      pattern: def.pattern.toString(),
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckLowerCase = /* @__PURE__ */ $constructor("$ZodCheckLowerCase", (inst, def) => {
  def.pattern ?? (def.pattern = lowercase);
  $ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckUpperCase = /* @__PURE__ */ $constructor("$ZodCheckUpperCase", (inst, def) => {
  def.pattern ?? (def.pattern = uppercase);
  $ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckIncludes = /* @__PURE__ */ $constructor("$ZodCheckIncludes", (inst, def) => {
  $ZodCheck.init(inst, def);
  const escapedRegex = escapeRegex(def.includes);
  const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
  def.pattern = pattern;
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.includes(def.includes, def.position))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: def.includes,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckStartsWith = /* @__PURE__ */ $constructor("$ZodCheckStartsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.startsWith(def.prefix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "starts_with",
      prefix: def.prefix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckEndsWith = /* @__PURE__ */ $constructor("$ZodCheckEndsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.endsWith(def.suffix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "ends_with",
      suffix: def.suffix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
function handleCheckPropertyResult(result, payload, property) {
  if (result.issues.length) {
    payload.issues.push(...prefixIssues(property, result.issues));
  }
}
var $ZodCheckProperty = /* @__PURE__ */ $constructor("$ZodCheckProperty", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.check = (payload) => {
    const result = def.schema._zod.run({
      value: payload.value[def.property],
      issues: []
    }, {});
    if (result instanceof Promise) {
      return result.then((result2) => handleCheckPropertyResult(result2, payload, def.property));
    }
    handleCheckPropertyResult(result, payload, def.property);
    return;
  };
});
var $ZodCheckMimeType = /* @__PURE__ */ $constructor("$ZodCheckMimeType", (inst, def) => {
  $ZodCheck.init(inst, def);
  const mimeSet = new Set(def.mime);
  inst._zod.onattach.push((inst2) => {
    inst2._zod.bag.mime = def.mime;
  });
  inst._zod.check = (payload) => {
    if (mimeSet.has(payload.value.type))
      return;
    payload.issues.push({
      code: "invalid_value",
      values: def.mime,
      input: payload.value.type,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckOverwrite = /* @__PURE__ */ $constructor("$ZodCheckOverwrite", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.check = (payload) => {
    payload.value = def.tx(payload.value);
  };
});

// node_modules/zod/v4/core/doc.js
var Doc = class {
  constructor(args = []) {
    this.content = [];
    this.indent = 0;
    if (this)
      this.args = args;
  }
  indented(fn) {
    this.indent += 1;
    fn(this);
    this.indent -= 1;
  }
  write(arg) {
    if (typeof arg === "function") {
      arg(this, { execution: "sync" });
      arg(this, { execution: "async" });
      return;
    }
    const content = arg;
    const lines = content.split("\n").filter((x) => x);
    const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
    const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
    for (const line of dedented) {
      this.content.push(line);
    }
  }
  compile() {
    const F = Function;
    const args = this?.args;
    const content = this?.content ?? [``];
    const lines = [...content.map((x) => `  ${x}`)];
    return new F(...args, lines.join("\n"));
  }
};

// node_modules/zod/v4/core/versions.js
var version = {
  major: 4,
  minor: 4,
  patch: 3
};

// node_modules/zod/v4/core/schemas.js
var $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
  var _a3;
  inst ?? (inst = {});
  inst._zod.def = def;
  inst._zod.bag = inst._zod.bag || {};
  inst._zod.version = version;
  const checks = [...inst._zod.def.checks ?? []];
  if (inst._zod.traits.has("$ZodCheck")) {
    checks.unshift(inst);
  }
  for (const ch of checks) {
    for (const fn of ch._zod.onattach) {
      fn(inst);
    }
  }
  if (checks.length === 0) {
    (_a3 = inst._zod).deferred ?? (_a3.deferred = []);
    inst._zod.deferred?.push(() => {
      inst._zod.run = inst._zod.parse;
    });
  } else {
    const runChecks = (payload, checks2, ctx) => {
      let isAborted = aborted(payload);
      let asyncResult;
      for (const ch of checks2) {
        if (ch._zod.def.when) {
          if (explicitlyAborted(payload))
            continue;
          const shouldRun = ch._zod.def.when(payload);
          if (!shouldRun)
            continue;
        } else if (isAborted) {
          continue;
        }
        const currLen = payload.issues.length;
        const _ = ch._zod.check(payload);
        if (_ instanceof Promise && ctx?.async === false) {
          throw new $ZodAsyncError();
        }
        if (asyncResult || _ instanceof Promise) {
          asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
            await _;
            const nextLen = payload.issues.length;
            if (nextLen === currLen)
              return;
            if (!isAborted)
              isAborted = aborted(payload, currLen);
          });
        } else {
          const nextLen = payload.issues.length;
          if (nextLen === currLen)
            continue;
          if (!isAborted)
            isAborted = aborted(payload, currLen);
        }
      }
      if (asyncResult) {
        return asyncResult.then(() => {
          return payload;
        });
      }
      return payload;
    };
    const handleCanaryResult = (canary, payload, ctx) => {
      if (aborted(canary)) {
        canary.aborted = true;
        return canary;
      }
      const checkResult = runChecks(payload, checks, ctx);
      if (checkResult instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return checkResult.then((checkResult2) => inst._zod.parse(checkResult2, ctx));
      }
      return inst._zod.parse(checkResult, ctx);
    };
    inst._zod.run = (payload, ctx) => {
      if (ctx.skipChecks) {
        return inst._zod.parse(payload, ctx);
      }
      if (ctx.direction === "backward") {
        const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
        if (canary instanceof Promise) {
          return canary.then((canary2) => {
            return handleCanaryResult(canary2, payload, ctx);
          });
        }
        return handleCanaryResult(canary, payload, ctx);
      }
      const result = inst._zod.parse(payload, ctx);
      if (result instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return result.then((result2) => runChecks(result2, checks, ctx));
      }
      return runChecks(result, checks, ctx);
    };
  }
  defineLazy(inst, "~standard", () => ({
    validate: (value) => {
      try {
        const r = safeParse(inst, value);
        return r.success ? { value: r.data } : { issues: r.error?.issues };
      } catch (_) {
        return safeParseAsync(inst, value).then((r) => r.success ? { value: r.data } : { issues: r.error?.issues });
      }
    },
    vendor: "zod",
    version: 1
  }));
});
var $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? string(inst._zod.bag);
  inst._zod.parse = (payload, _) => {
    if (def.coerce)
      try {
        payload.value = String(payload.value);
      } catch (_2) {
      }
    if (typeof payload.value === "string")
      return payload;
    payload.issues.push({
      expected: "string",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
var $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  $ZodString.init(inst, def);
});
var $ZodGUID = /* @__PURE__ */ $constructor("$ZodGUID", (inst, def) => {
  def.pattern ?? (def.pattern = guid);
  $ZodStringFormat.init(inst, def);
});
var $ZodUUID = /* @__PURE__ */ $constructor("$ZodUUID", (inst, def) => {
  if (def.version) {
    const versionMap = {
      v1: 1,
      v2: 2,
      v3: 3,
      v4: 4,
      v5: 5,
      v6: 6,
      v7: 7,
      v8: 8
    };
    const v = versionMap[def.version];
    if (v === void 0)
      throw new Error(`Invalid UUID version: "${def.version}"`);
    def.pattern ?? (def.pattern = uuid(v));
  } else
    def.pattern ?? (def.pattern = uuid());
  $ZodStringFormat.init(inst, def);
});
var $ZodEmail = /* @__PURE__ */ $constructor("$ZodEmail", (inst, def) => {
  def.pattern ?? (def.pattern = email);
  $ZodStringFormat.init(inst, def);
});
var $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    try {
      const trimmed = payload.value.trim();
      if (!def.normalize && def.protocol?.source === httpProtocol.source) {
        if (!/^https?:\/\//i.test(trimmed)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid URL format",
            input: payload.value,
            inst,
            continue: !def.abort
          });
          return;
        }
      }
      const url2 = new URL(trimmed);
      if (def.hostname) {
        def.hostname.lastIndex = 0;
        if (!def.hostname.test(url2.hostname)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid hostname",
            pattern: def.hostname.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      }
      if (def.protocol) {
        def.protocol.lastIndex = 0;
        if (!def.protocol.test(url2.protocol.endsWith(":") ? url2.protocol.slice(0, -1) : url2.protocol)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid protocol",
            pattern: def.protocol.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      }
      if (def.normalize) {
        payload.value = url2.href;
      } else {
        payload.value = trimmed;
      }
      return;
    } catch (_) {
      payload.issues.push({
        code: "invalid_format",
        format: "url",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodEmoji = /* @__PURE__ */ $constructor("$ZodEmoji", (inst, def) => {
  def.pattern ?? (def.pattern = emoji());
  $ZodStringFormat.init(inst, def);
});
var $ZodNanoID = /* @__PURE__ */ $constructor("$ZodNanoID", (inst, def) => {
  def.pattern ?? (def.pattern = nanoid);
  $ZodStringFormat.init(inst, def);
});
var $ZodCUID = /* @__PURE__ */ $constructor("$ZodCUID", (inst, def) => {
  def.pattern ?? (def.pattern = cuid);
  $ZodStringFormat.init(inst, def);
});
var $ZodCUID2 = /* @__PURE__ */ $constructor("$ZodCUID2", (inst, def) => {
  def.pattern ?? (def.pattern = cuid2);
  $ZodStringFormat.init(inst, def);
});
var $ZodULID = /* @__PURE__ */ $constructor("$ZodULID", (inst, def) => {
  def.pattern ?? (def.pattern = ulid);
  $ZodStringFormat.init(inst, def);
});
var $ZodXID = /* @__PURE__ */ $constructor("$ZodXID", (inst, def) => {
  def.pattern ?? (def.pattern = xid);
  $ZodStringFormat.init(inst, def);
});
var $ZodKSUID = /* @__PURE__ */ $constructor("$ZodKSUID", (inst, def) => {
  def.pattern ?? (def.pattern = ksuid);
  $ZodStringFormat.init(inst, def);
});
var $ZodISODateTime = /* @__PURE__ */ $constructor("$ZodISODateTime", (inst, def) => {
  def.pattern ?? (def.pattern = datetime(def));
  $ZodStringFormat.init(inst, def);
});
var $ZodISODate = /* @__PURE__ */ $constructor("$ZodISODate", (inst, def) => {
  def.pattern ?? (def.pattern = date);
  $ZodStringFormat.init(inst, def);
});
var $ZodISOTime = /* @__PURE__ */ $constructor("$ZodISOTime", (inst, def) => {
  def.pattern ?? (def.pattern = time(def));
  $ZodStringFormat.init(inst, def);
});
var $ZodISODuration = /* @__PURE__ */ $constructor("$ZodISODuration", (inst, def) => {
  def.pattern ?? (def.pattern = duration);
  $ZodStringFormat.init(inst, def);
});
var $ZodIPv4 = /* @__PURE__ */ $constructor("$ZodIPv4", (inst, def) => {
  def.pattern ?? (def.pattern = ipv4);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.format = `ipv4`;
});
var $ZodIPv6 = /* @__PURE__ */ $constructor("$ZodIPv6", (inst, def) => {
  def.pattern ?? (def.pattern = ipv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.format = `ipv6`;
  inst._zod.check = (payload) => {
    try {
      new URL(`http://[${payload.value}]`);
    } catch {
      payload.issues.push({
        code: "invalid_format",
        format: "ipv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodMAC = /* @__PURE__ */ $constructor("$ZodMAC", (inst, def) => {
  def.pattern ?? (def.pattern = mac(def.delimiter));
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.format = `mac`;
});
var $ZodCIDRv4 = /* @__PURE__ */ $constructor("$ZodCIDRv4", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv4);
  $ZodStringFormat.init(inst, def);
});
var $ZodCIDRv6 = /* @__PURE__ */ $constructor("$ZodCIDRv6", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    const parts = payload.value.split("/");
    try {
      if (parts.length !== 2)
        throw new Error();
      const [address, prefix] = parts;
      if (!prefix)
        throw new Error();
      const prefixNum = Number(prefix);
      if (`${prefixNum}` !== prefix)
        throw new Error();
      if (prefixNum < 0 || prefixNum > 128)
        throw new Error();
      new URL(`http://[${address}]`);
    } catch {
      payload.issues.push({
        code: "invalid_format",
        format: "cidrv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
function isValidBase64(data) {
  if (data === "")
    return true;
  if (/\s/.test(data))
    return false;
  if (data.length % 4 !== 0)
    return false;
  try {
    atob(data);
    return true;
  } catch {
    return false;
  }
}
var $ZodBase64 = /* @__PURE__ */ $constructor("$ZodBase64", (inst, def) => {
  def.pattern ?? (def.pattern = base64);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.contentEncoding = "base64";
  inst._zod.check = (payload) => {
    if (isValidBase64(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
function isValidBase64URL(data) {
  if (!base64url.test(data))
    return false;
  const base643 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
  const padded = base643.padEnd(Math.ceil(base643.length / 4) * 4, "=");
  return isValidBase64(padded);
}
var $ZodBase64URL = /* @__PURE__ */ $constructor("$ZodBase64URL", (inst, def) => {
  def.pattern ?? (def.pattern = base64url);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.contentEncoding = "base64url";
  inst._zod.check = (payload) => {
    if (isValidBase64URL(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodE164 = /* @__PURE__ */ $constructor("$ZodE164", (inst, def) => {
  def.pattern ?? (def.pattern = e164);
  $ZodStringFormat.init(inst, def);
});
function isValidJWT(token, algorithm = null) {
  try {
    const tokensParts = token.split(".");
    if (tokensParts.length !== 3)
      return false;
    const [header] = tokensParts;
    if (!header)
      return false;
    const parsedHeader = JSON.parse(atob(header));
    if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT")
      return false;
    if (!parsedHeader.alg)
      return false;
    if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
      return false;
    return true;
  } catch {
    return false;
  }
}
var $ZodJWT = /* @__PURE__ */ $constructor("$ZodJWT", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (isValidJWT(payload.value, def.alg))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCustomStringFormat = /* @__PURE__ */ $constructor("$ZodCustomStringFormat", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (def.fn(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: def.format,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodNumber = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = inst._zod.bag.pattern ?? number;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Number(payload.value);
      } catch (_) {
      }
    const input = payload.value;
    if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
      return payload;
    }
    const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : void 0 : void 0;
    payload.issues.push({
      expected: "number",
      code: "invalid_type",
      input,
      inst,
      ...received ? { received } : {}
    });
    return payload;
  };
});
var $ZodNumberFormat = /* @__PURE__ */ $constructor("$ZodNumberFormat", (inst, def) => {
  $ZodCheckNumberFormat.init(inst, def);
  $ZodNumber.init(inst, def);
});
var $ZodBoolean = /* @__PURE__ */ $constructor("$ZodBoolean", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = boolean;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Boolean(payload.value);
      } catch (_) {
      }
    const input = payload.value;
    if (typeof input === "boolean")
      return payload;
    payload.issues.push({
      expected: "boolean",
      code: "invalid_type",
      input,
      inst
    });
    return payload;
  };
});
var $ZodBigInt = /* @__PURE__ */ $constructor("$ZodBigInt", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = bigint;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = BigInt(payload.value);
      } catch (_) {
      }
    if (typeof payload.value === "bigint")
      return payload;
    payload.issues.push({
      expected: "bigint",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
var $ZodBigIntFormat = /* @__PURE__ */ $constructor("$ZodBigIntFormat", (inst, def) => {
  $ZodCheckBigIntFormat.init(inst, def);
  $ZodBigInt.init(inst, def);
});
var $ZodSymbol = /* @__PURE__ */ $constructor("$ZodSymbol", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (typeof input === "symbol")
      return payload;
    payload.issues.push({
      expected: "symbol",
      code: "invalid_type",
      input,
      inst
    });
    return payload;
  };
});
var $ZodUndefined = /* @__PURE__ */ $constructor("$ZodUndefined", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = _undefined;
  inst._zod.values = /* @__PURE__ */ new Set([void 0]);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (typeof input === "undefined")
      return payload;
    payload.issues.push({
      expected: "undefined",
      code: "invalid_type",
      input,
      inst
    });
    return payload;
  };
});
var $ZodNull = /* @__PURE__ */ $constructor("$ZodNull", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = _null;
  inst._zod.values = /* @__PURE__ */ new Set([null]);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (input === null)
      return payload;
    payload.issues.push({
      expected: "null",
      code: "invalid_type",
      input,
      inst
    });
    return payload;
  };
});
var $ZodAny = /* @__PURE__ */ $constructor("$ZodAny", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload) => payload;
});
var $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload) => payload;
});
var $ZodNever = /* @__PURE__ */ $constructor("$ZodNever", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _ctx) => {
    payload.issues.push({
      expected: "never",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
var $ZodVoid = /* @__PURE__ */ $constructor("$ZodVoid", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (typeof input === "undefined")
      return payload;
    payload.issues.push({
      expected: "void",
      code: "invalid_type",
      input,
      inst
    });
    return payload;
  };
});
var $ZodDate = /* @__PURE__ */ $constructor("$ZodDate", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce) {
      try {
        payload.value = new Date(payload.value);
      } catch (_err) {
      }
    }
    const input = payload.value;
    const isDate = input instanceof Date;
    const isValidDate = isDate && !Number.isNaN(input.getTime());
    if (isValidDate)
      return payload;
    payload.issues.push({
      expected: "date",
      code: "invalid_type",
      input,
      ...isDate ? { received: "Invalid Date" } : {},
      inst
    });
    return payload;
  };
});
function handleArrayResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
var $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!Array.isArray(input)) {
      payload.issues.push({
        expected: "array",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = Array(input.length);
    const proms = [];
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      const result = def.element._zod.run({
        value: item,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        proms.push(result.then((result2) => handleArrayResult(result2, payload, i)));
      } else {
        handleArrayResult(result, payload, i);
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
function handlePropertyResult(result, final, key, input, isOptionalIn, isOptionalOut) {
  const isPresent = key in input;
  if (result.issues.length) {
    if (isOptionalIn && isOptionalOut && !isPresent) {
      return;
    }
    final.issues.push(...prefixIssues(key, result.issues));
  }
  if (!isPresent && !isOptionalIn) {
    if (!result.issues.length) {
      final.issues.push({
        code: "invalid_type",
        expected: "nonoptional",
        input: void 0,
        path: [key]
      });
    }
    return;
  }
  if (result.value === void 0) {
    if (isPresent) {
      final.value[key] = void 0;
    }
  } else {
    final.value[key] = result.value;
  }
}
function normalizeDef(def) {
  const keys = Object.keys(def.shape);
  for (const k of keys) {
    if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
      throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
    }
  }
  const okeys = optionalKeys(def.shape);
  return {
    ...def,
    keys,
    keySet: new Set(keys),
    numKeys: keys.length,
    optionalKeys: new Set(okeys)
  };
}
function handleCatchall(proms, input, payload, ctx, def, inst) {
  const unrecognized = [];
  const keySet = def.keySet;
  const _catchall = def.catchall._zod;
  const t = _catchall.def.type;
  const isOptionalIn = _catchall.optin === "optional";
  const isOptionalOut = _catchall.optout === "optional";
  for (const key in input) {
    if (key === "__proto__")
      continue;
    if (keySet.has(key))
      continue;
    if (t === "never") {
      unrecognized.push(key);
      continue;
    }
    const r = _catchall.run({ value: input[key], issues: [] }, ctx);
    if (r instanceof Promise) {
      proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, isOptionalIn, isOptionalOut)));
    } else {
      handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
    }
  }
  if (unrecognized.length) {
    payload.issues.push({
      code: "unrecognized_keys",
      keys: unrecognized,
      input,
      inst
    });
  }
  if (!proms.length)
    return payload;
  return Promise.all(proms).then(() => {
    return payload;
  });
}
var $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
  $ZodType.init(inst, def);
  const desc = Object.getOwnPropertyDescriptor(def, "shape");
  if (!desc?.get) {
    const sh = def.shape;
    Object.defineProperty(def, "shape", {
      get: () => {
        const newSh = { ...sh };
        Object.defineProperty(def, "shape", {
          value: newSh
        });
        return newSh;
      }
    });
  }
  const _normalized = cached(() => normalizeDef(def));
  defineLazy(inst._zod, "propValues", () => {
    const shape = def.shape;
    const propValues = {};
    for (const key in shape) {
      const field = shape[key]._zod;
      if (field.values) {
        propValues[key] ?? (propValues[key] = /* @__PURE__ */ new Set());
        for (const v of field.values)
          propValues[key].add(v);
      }
    }
    return propValues;
  });
  const isObject2 = isObject;
  const catchall = def.catchall;
  let value;
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject2(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = {};
    const proms = [];
    const shape = value.shape;
    for (const key of value.keys) {
      const el = shape[key];
      const isOptionalIn = el._zod.optin === "optional";
      const isOptionalOut = el._zod.optout === "optional";
      const r = el._zod.run({ value: input[key], issues: [] }, ctx);
      if (r instanceof Promise) {
        proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, isOptionalIn, isOptionalOut)));
      } else {
        handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
      }
    }
    if (!catchall) {
      return proms.length ? Promise.all(proms).then(() => payload) : payload;
    }
    return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
  };
});
var $ZodObjectJIT = /* @__PURE__ */ $constructor("$ZodObjectJIT", (inst, def) => {
  $ZodObject.init(inst, def);
  const superParse = inst._zod.parse;
  const _normalized = cached(() => normalizeDef(def));
  const generateFastpass = (shape) => {
    const doc = new Doc(["shape", "payload", "ctx"]);
    const normalized = _normalized.value;
    const parseStr = (key) => {
      const k = esc(key);
      return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
    };
    doc.write(`const input = payload.value;`);
    const ids = /* @__PURE__ */ Object.create(null);
    let counter = 0;
    for (const key of normalized.keys) {
      ids[key] = `key_${counter++}`;
    }
    doc.write(`const newResult = {};`);
    for (const key of normalized.keys) {
      const id = ids[key];
      const k = esc(key);
      const schema = shape[key];
      const isOptionalIn = schema?._zod?.optin === "optional";
      const isOptionalOut = schema?._zod?.optout === "optional";
      doc.write(`const ${id} = ${parseStr(key)};`);
      if (isOptionalIn && isOptionalOut) {
        doc.write(`
        if (${id}.issues.length) {
          if (${k} in input) {
            payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${k}, ...iss.path] : [${k}]
            })));
          }
        }

        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }

      `);
      } else if (!isOptionalIn) {
        doc.write(`
        const ${id}_present = ${k} in input;
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
        }

        if (${id}_present) {
          if (${id}.value === undefined) {
            newResult[${k}] = undefined;
          } else {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
      } else {
        doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }

        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }

      `);
      }
    }
    doc.write(`payload.value = newResult;`);
    doc.write(`return payload;`);
    const fn = doc.compile();
    return (payload, ctx) => fn(shape, payload, ctx);
  };
  let fastpass;
  const isObject2 = isObject;
  const jit = !globalConfig.jitless;
  const allowsEval2 = allowsEval;
  const fastEnabled = jit && allowsEval2.value;
  const catchall = def.catchall;
  let value;
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject2(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
      if (!fastpass)
        fastpass = generateFastpass(def.shape);
      payload = fastpass(payload, ctx);
      if (!catchall)
        return payload;
      return handleCatchall([], input, payload, ctx, value, inst);
    }
    return superParse(payload, ctx);
  };
});
function handleUnionResults(results, final, inst, ctx) {
  for (const result of results) {
    if (result.issues.length === 0) {
      final.value = result.value;
      return final;
    }
  }
  const nonaborted = results.filter((r) => !aborted(r));
  if (nonaborted.length === 1) {
    final.value = nonaborted[0].value;
    return nonaborted[0];
  }
  final.issues.push({
    code: "invalid_union",
    input: final.value,
    inst,
    errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  });
  return final;
}
var $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0);
  defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
  defineLazy(inst._zod, "values", () => {
    if (def.options.every((o) => o._zod.values)) {
      return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
    }
    return void 0;
  });
  defineLazy(inst._zod, "pattern", () => {
    if (def.options.every((o) => o._zod.pattern)) {
      const patterns = def.options.map((o) => o._zod.pattern);
      return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
    }
    return void 0;
  });
  const first = def.options.length === 1 ? def.options[0]._zod.run : null;
  inst._zod.parse = (payload, ctx) => {
    if (first) {
      return first(payload, ctx);
    }
    let async = false;
    const results = [];
    for (const option of def.options) {
      const result = option._zod.run({
        value: payload.value,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        results.push(result);
        async = true;
      } else {
        if (result.issues.length === 0)
          return result;
        results.push(result);
      }
    }
    if (!async)
      return handleUnionResults(results, payload, inst, ctx);
    return Promise.all(results).then((results2) => {
      return handleUnionResults(results2, payload, inst, ctx);
    });
  };
});
function handleExclusiveUnionResults(results, final, inst, ctx) {
  const successes = results.filter((r) => r.issues.length === 0);
  if (successes.length === 1) {
    final.value = successes[0].value;
    return final;
  }
  if (successes.length === 0) {
    final.issues.push({
      code: "invalid_union",
      input: final.value,
      inst,
      errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
    });
  } else {
    final.issues.push({
      code: "invalid_union",
      input: final.value,
      inst,
      errors: [],
      inclusive: false
    });
  }
  return final;
}
var $ZodXor = /* @__PURE__ */ $constructor("$ZodXor", (inst, def) => {
  $ZodUnion.init(inst, def);
  def.inclusive = false;
  const first = def.options.length === 1 ? def.options[0]._zod.run : null;
  inst._zod.parse = (payload, ctx) => {
    if (first) {
      return first(payload, ctx);
    }
    let async = false;
    const results = [];
    for (const option of def.options) {
      const result = option._zod.run({
        value: payload.value,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        results.push(result);
        async = true;
      } else {
        results.push(result);
      }
    }
    if (!async)
      return handleExclusiveUnionResults(results, payload, inst, ctx);
    return Promise.all(results).then((results2) => {
      return handleExclusiveUnionResults(results2, payload, inst, ctx);
    });
  };
});
var $ZodDiscriminatedUnion = /* @__PURE__ */ $constructor("$ZodDiscriminatedUnion", (inst, def) => {
  def.inclusive = false;
  $ZodUnion.init(inst, def);
  const _super = inst._zod.parse;
  defineLazy(inst._zod, "propValues", () => {
    const propValues = {};
    for (const option of def.options) {
      const pv = option._zod.propValues;
      if (!pv || Object.keys(pv).length === 0)
        throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(option)}"`);
      for (const [k, v] of Object.entries(pv)) {
        if (!propValues[k])
          propValues[k] = /* @__PURE__ */ new Set();
        for (const val of v) {
          propValues[k].add(val);
        }
      }
    }
    return propValues;
  });
  const disc = cached(() => {
    const opts = def.options;
    const map2 = /* @__PURE__ */ new Map();
    for (const o of opts) {
      const values2 = o._zod.propValues?.[def.discriminator];
      if (!values2 || values2.size === 0)
        throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(o)}"`);
      for (const v of values2) {
        if (map2.has(v)) {
          throw new Error(`Duplicate discriminator value "${String(v)}"`);
        }
        map2.set(v, o);
      }
    }
    return map2;
  });
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!isObject(input)) {
      payload.issues.push({
        code: "invalid_type",
        expected: "object",
        input,
        inst
      });
      return payload;
    }
    const opt = disc.value.get(input?.[def.discriminator]);
    if (opt) {
      return opt._zod.run(payload, ctx);
    }
    if (def.unionFallback || ctx.direction === "backward") {
      return _super(payload, ctx);
    }
    payload.issues.push({
      code: "invalid_union",
      errors: [],
      note: "No matching discriminator",
      discriminator: def.discriminator,
      options: Array.from(disc.value.keys()),
      input,
      path: [def.discriminator],
      inst
    });
    return payload;
  };
});
var $ZodIntersection = /* @__PURE__ */ $constructor("$ZodIntersection", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    const left = def.left._zod.run({ value: input, issues: [] }, ctx);
    const right = def.right._zod.run({ value: input, issues: [] }, ctx);
    const async = left instanceof Promise || right instanceof Promise;
    if (async) {
      return Promise.all([left, right]).then(([left2, right2]) => {
        return handleIntersectionResults(payload, left2, right2);
      });
    }
    return handleIntersectionResults(payload, left, right);
  };
});
function mergeValues(a, b2) {
  if (a === b2) {
    return { valid: true, data: a };
  }
  if (a instanceof Date && b2 instanceof Date && +a === +b2) {
    return { valid: true, data: a };
  }
  if (isPlainObject(a) && isPlainObject(b2)) {
    const bKeys = Object.keys(b2);
    const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b2 };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b2[key]);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
        };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  }
  if (Array.isArray(a) && Array.isArray(b2)) {
    if (a.length !== b2.length) {
      return { valid: false, mergeErrorPath: [] };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b2[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
        };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  }
  return { valid: false, mergeErrorPath: [] };
}
function handleIntersectionResults(result, left, right) {
  const unrecKeys = /* @__PURE__ */ new Map();
  let unrecIssue;
  for (const iss of left.issues) {
    if (iss.code === "unrecognized_keys") {
      unrecIssue ?? (unrecIssue = iss);
      for (const k of iss.keys) {
        if (!unrecKeys.has(k))
          unrecKeys.set(k, {});
        unrecKeys.get(k).l = true;
      }
    } else {
      result.issues.push(iss);
    }
  }
  for (const iss of right.issues) {
    if (iss.code === "unrecognized_keys") {
      for (const k of iss.keys) {
        if (!unrecKeys.has(k))
          unrecKeys.set(k, {});
        unrecKeys.get(k).r = true;
      }
    } else {
      result.issues.push(iss);
    }
  }
  const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
  if (bothKeys.length && unrecIssue) {
    result.issues.push({ ...unrecIssue, keys: bothKeys });
  }
  if (aborted(result))
    return result;
  const merged = mergeValues(left.value, right.value);
  if (!merged.valid) {
    throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
  }
  result.value = merged.data;
  return result;
}
var $ZodTuple = /* @__PURE__ */ $constructor("$ZodTuple", (inst, def) => {
  $ZodType.init(inst, def);
  const items = def.items;
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!Array.isArray(input)) {
      payload.issues.push({
        input,
        inst,
        expected: "tuple",
        code: "invalid_type"
      });
      return payload;
    }
    payload.value = [];
    const proms = [];
    const optinStart = getTupleOptStart(items, "optin");
    const optoutStart = getTupleOptStart(items, "optout");
    if (!def.rest) {
      if (input.length < optinStart) {
        payload.issues.push({
          code: "too_small",
          minimum: optinStart,
          inclusive: true,
          input,
          inst,
          origin: "array"
        });
        return payload;
      }
      if (input.length > items.length) {
        payload.issues.push({
          code: "too_big",
          maximum: items.length,
          inclusive: true,
          input,
          inst,
          origin: "array"
        });
      }
    }
    const itemResults = new Array(items.length);
    for (let i = 0; i < items.length; i++) {
      const r = items[i]._zod.run({ value: input[i], issues: [] }, ctx);
      if (r instanceof Promise) {
        proms.push(r.then((rr) => {
          itemResults[i] = rr;
        }));
      } else {
        itemResults[i] = r;
      }
    }
    if (def.rest) {
      let i = items.length - 1;
      const rest = input.slice(items.length);
      for (const el of rest) {
        i++;
        const result = def.rest._zod.run({ value: el, issues: [] }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((r) => handleTupleResult(r, payload, i)));
        } else {
          handleTupleResult(result, payload, i);
        }
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => handleTupleResults(itemResults, payload, items, input, optoutStart));
    }
    return handleTupleResults(itemResults, payload, items, input, optoutStart);
  };
});
function getTupleOptStart(items, key) {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i]._zod[key] !== "optional")
      return i + 1;
  }
  return 0;
}
function handleTupleResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
function handleTupleResults(itemResults, final, items, input, optoutStart) {
  for (let i = 0; i < items.length; i++) {
    const r = itemResults[i];
    const isPresent = i < input.length;
    if (r.issues.length) {
      if (!isPresent && i >= optoutStart) {
        final.value.length = i;
        break;
      }
      final.issues.push(...prefixIssues(i, r.issues));
    }
    final.value[i] = r.value;
  }
  for (let i = final.value.length - 1; i >= input.length; i--) {
    if (items[i]._zod.optout === "optional" && final.value[i] === void 0) {
      final.value.length = i;
    } else {
      break;
    }
  }
  return final;
}
var $ZodRecord = /* @__PURE__ */ $constructor("$ZodRecord", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!isPlainObject(input)) {
      payload.issues.push({
        expected: "record",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    const proms = [];
    const values2 = def.keyType._zod.values;
    if (values2) {
      payload.value = {};
      const recordKeys = /* @__PURE__ */ new Set();
      for (const key of values2) {
        if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
          recordKeys.add(typeof key === "number" ? key.toString() : key);
          const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
          if (keyResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          if (keyResult.issues.length) {
            payload.issues.push({
              code: "invalid_key",
              origin: "record",
              issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
              input: key,
              path: [key],
              inst
            });
            continue;
          }
          const outKey = keyResult.value;
          const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result2) => {
              if (result2.issues.length) {
                payload.issues.push(...prefixIssues(key, result2.issues));
              }
              payload.value[outKey] = result2.value;
            }));
          } else {
            if (result.issues.length) {
              payload.issues.push(...prefixIssues(key, result.issues));
            }
            payload.value[outKey] = result.value;
          }
        }
      }
      let unrecognized;
      for (const key in input) {
        if (!recordKeys.has(key)) {
          unrecognized = unrecognized ?? [];
          unrecognized.push(key);
        }
      }
      if (unrecognized && unrecognized.length > 0) {
        payload.issues.push({
          code: "unrecognized_keys",
          input,
          inst,
          keys: unrecognized
        });
      }
    } else {
      payload.value = {};
      for (const key of Reflect.ownKeys(input)) {
        if (key === "__proto__")
          continue;
        if (!Object.prototype.propertyIsEnumerable.call(input, key))
          continue;
        let keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
        if (keyResult instanceof Promise) {
          throw new Error("Async schemas not supported in object keys currently");
        }
        const checkNumericKey = typeof key === "string" && number.test(key) && keyResult.issues.length;
        if (checkNumericKey) {
          const retryResult = def.keyType._zod.run({ value: Number(key), issues: [] }, ctx);
          if (retryResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          if (retryResult.issues.length === 0) {
            keyResult = retryResult;
          }
        }
        if (keyResult.issues.length) {
          if (def.mode === "loose") {
            payload.value[key] = input[key];
          } else {
            payload.issues.push({
              code: "invalid_key",
              origin: "record",
              issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
              input: key,
              path: [key],
              inst
            });
          }
          continue;
        }
        const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((result2) => {
            if (result2.issues.length) {
              payload.issues.push(...prefixIssues(key, result2.issues));
            }
            payload.value[keyResult.value] = result2.value;
          }));
        } else {
          if (result.issues.length) {
            payload.issues.push(...prefixIssues(key, result.issues));
          }
          payload.value[keyResult.value] = result.value;
        }
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
var $ZodMap = /* @__PURE__ */ $constructor("$ZodMap", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!(input instanceof Map)) {
      payload.issues.push({
        expected: "map",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    const proms = [];
    payload.value = /* @__PURE__ */ new Map();
    for (const [key, value] of input) {
      const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
      const valueResult = def.valueType._zod.run({ value, issues: [] }, ctx);
      if (keyResult instanceof Promise || valueResult instanceof Promise) {
        proms.push(Promise.all([keyResult, valueResult]).then(([keyResult2, valueResult2]) => {
          handleMapResult(keyResult2, valueResult2, payload, key, input, inst, ctx);
        }));
      } else {
        handleMapResult(keyResult, valueResult, payload, key, input, inst, ctx);
      }
    }
    if (proms.length)
      return Promise.all(proms).then(() => payload);
    return payload;
  };
});
function handleMapResult(keyResult, valueResult, final, key, input, inst, ctx) {
  if (keyResult.issues.length) {
    if (propertyKeyTypes.has(typeof key)) {
      final.issues.push(...prefixIssues(key, keyResult.issues));
    } else {
      final.issues.push({
        code: "invalid_key",
        origin: "map",
        input,
        inst,
        issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config()))
      });
    }
  }
  if (valueResult.issues.length) {
    if (propertyKeyTypes.has(typeof key)) {
      final.issues.push(...prefixIssues(key, valueResult.issues));
    } else {
      final.issues.push({
        origin: "map",
        code: "invalid_element",
        input,
        inst,
        key,
        issues: valueResult.issues.map((iss) => finalizeIssue(iss, ctx, config()))
      });
    }
  }
  final.value.set(keyResult.value, valueResult.value);
}
var $ZodSet = /* @__PURE__ */ $constructor("$ZodSet", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!(input instanceof Set)) {
      payload.issues.push({
        input,
        inst,
        expected: "set",
        code: "invalid_type"
      });
      return payload;
    }
    const proms = [];
    payload.value = /* @__PURE__ */ new Set();
    for (const item of input) {
      const result = def.valueType._zod.run({ value: item, issues: [] }, ctx);
      if (result instanceof Promise) {
        proms.push(result.then((result2) => handleSetResult(result2, payload)));
      } else
        handleSetResult(result, payload);
    }
    if (proms.length)
      return Promise.all(proms).then(() => payload);
    return payload;
  };
});
function handleSetResult(result, final) {
  if (result.issues.length) {
    final.issues.push(...result.issues);
  }
  final.value.add(result.value);
}
var $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
  $ZodType.init(inst, def);
  const values2 = getEnumValues(def.entries);
  const valuesSet = new Set(values2);
  inst._zod.values = valuesSet;
  inst._zod.pattern = new RegExp(`^(${values2.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (valuesSet.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values: values2,
      input,
      inst
    });
    return payload;
  };
});
var $ZodLiteral = /* @__PURE__ */ $constructor("$ZodLiteral", (inst, def) => {
  $ZodType.init(inst, def);
  if (def.values.length === 0) {
    throw new Error("Cannot create literal schema with no valid values");
  }
  const values2 = new Set(def.values);
  inst._zod.values = values2;
  inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (values2.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values: def.values,
      input,
      inst
    });
    return payload;
  };
});
var $ZodFile = /* @__PURE__ */ $constructor("$ZodFile", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (input instanceof File)
      return payload;
    payload.issues.push({
      expected: "file",
      code: "invalid_type",
      input,
      inst
    });
    return payload;
  };
});
var $ZodTransform = /* @__PURE__ */ $constructor("$ZodTransform", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    const _out = def.transform(payload.value, payload);
    if (ctx.async) {
      const output = _out instanceof Promise ? _out : Promise.resolve(_out);
      return output.then((output2) => {
        payload.value = output2;
        payload.fallback = true;
        return payload;
      });
    }
    if (_out instanceof Promise) {
      throw new $ZodAsyncError();
    }
    payload.value = _out;
    payload.fallback = true;
    return payload;
  };
});
function handleOptionalResult(result, input) {
  if (input === void 0 && (result.issues.length || result.fallback)) {
    return { issues: [], value: void 0 };
  }
  return result;
}
var $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  inst._zod.optout = "optional";
  defineLazy(inst._zod, "values", () => {
    return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, void 0]) : void 0;
  });
  defineLazy(inst._zod, "pattern", () => {
    const pattern = def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (def.innerType._zod.optin === "optional") {
      const input = payload.value;
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise)
        return result.then((r) => handleOptionalResult(r, input));
      return handleOptionalResult(result, input);
    }
    if (payload.value === void 0) {
      return payload;
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodExactOptional = /* @__PURE__ */ $constructor("$ZodExactOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
  inst._zod.parse = (payload, ctx) => {
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
  defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
  defineLazy(inst._zod, "pattern", () => {
    const pattern = def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
  });
  defineLazy(inst._zod, "values", () => {
    return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, null]) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (payload.value === null)
      return payload;
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodDefault = /* @__PURE__ */ $constructor("$ZodDefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === void 0) {
      payload.value = def.defaultValue;
      return payload;
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleDefaultResult(result2, def));
    }
    return handleDefaultResult(result, def);
  };
});
function handleDefaultResult(payload, def) {
  if (payload.value === void 0) {
    payload.value = def.defaultValue;
  }
  return payload;
}
var $ZodPrefault = /* @__PURE__ */ $constructor("$ZodPrefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === void 0) {
      payload.value = def.defaultValue;
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodNonOptional = /* @__PURE__ */ $constructor("$ZodNonOptional", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "values", () => {
    const v = def.innerType._zod.values;
    return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleNonOptionalResult(result2, inst));
    }
    return handleNonOptionalResult(result, inst);
  };
});
function handleNonOptionalResult(payload, inst) {
  if (!payload.issues.length && payload.value === void 0) {
    payload.issues.push({
      code: "invalid_type",
      expected: "nonoptional",
      input: payload.value,
      inst
    });
  }
  return payload;
}
var $ZodSuccess = /* @__PURE__ */ $constructor("$ZodSuccess", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      throw new $ZodEncodeError("ZodSuccess");
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => {
        payload.value = result2.issues.length === 0;
        return payload;
      });
    }
    payload.value = result.issues.length === 0;
    return payload;
  };
});
var $ZodCatch = /* @__PURE__ */ $constructor("$ZodCatch", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => {
        payload.value = result2.value;
        if (result2.issues.length) {
          payload.value = def.catchValue({
            ...payload,
            error: {
              issues: result2.issues.map((iss) => finalizeIssue(iss, ctx, config()))
            },
            input: payload.value
          });
          payload.issues = [];
          payload.fallback = true;
        }
        return payload;
      });
    }
    payload.value = result.value;
    if (result.issues.length) {
      payload.value = def.catchValue({
        ...payload,
        error: {
          issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config()))
        },
        input: payload.value
      });
      payload.issues = [];
      payload.fallback = true;
    }
    return payload;
  };
});
var $ZodNaN = /* @__PURE__ */ $constructor("$ZodNaN", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _ctx) => {
    if (typeof payload.value !== "number" || !Number.isNaN(payload.value)) {
      payload.issues.push({
        input: payload.value,
        inst,
        expected: "nan",
        code: "invalid_type"
      });
      return payload;
    }
    return payload;
  };
});
var $ZodPipe = /* @__PURE__ */ $constructor("$ZodPipe", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "values", () => def.in._zod.values);
  defineLazy(inst._zod, "optin", () => def.in._zod.optin);
  defineLazy(inst._zod, "optout", () => def.out._zod.optout);
  defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      const right = def.out._zod.run(payload, ctx);
      if (right instanceof Promise) {
        return right.then((right2) => handlePipeResult(right2, def.in, ctx));
      }
      return handlePipeResult(right, def.in, ctx);
    }
    const left = def.in._zod.run(payload, ctx);
    if (left instanceof Promise) {
      return left.then((left2) => handlePipeResult(left2, def.out, ctx));
    }
    return handlePipeResult(left, def.out, ctx);
  };
});
function handlePipeResult(left, next, ctx) {
  if (left.issues.length) {
    left.aborted = true;
    return left;
  }
  return next._zod.run({ value: left.value, issues: left.issues, fallback: left.fallback }, ctx);
}
var $ZodCodec = /* @__PURE__ */ $constructor("$ZodCodec", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "values", () => def.in._zod.values);
  defineLazy(inst._zod, "optin", () => def.in._zod.optin);
  defineLazy(inst._zod, "optout", () => def.out._zod.optout);
  defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
  inst._zod.parse = (payload, ctx) => {
    const direction = ctx.direction || "forward";
    if (direction === "forward") {
      const left = def.in._zod.run(payload, ctx);
      if (left instanceof Promise) {
        return left.then((left2) => handleCodecAResult(left2, def, ctx));
      }
      return handleCodecAResult(left, def, ctx);
    } else {
      const right = def.out._zod.run(payload, ctx);
      if (right instanceof Promise) {
        return right.then((right2) => handleCodecAResult(right2, def, ctx));
      }
      return handleCodecAResult(right, def, ctx);
    }
  };
});
function handleCodecAResult(result, def, ctx) {
  if (result.issues.length) {
    result.aborted = true;
    return result;
  }
  const direction = ctx.direction || "forward";
  if (direction === "forward") {
    const transformed = def.transform(result.value, result);
    if (transformed instanceof Promise) {
      return transformed.then((value) => handleCodecTxResult(result, value, def.out, ctx));
    }
    return handleCodecTxResult(result, transformed, def.out, ctx);
  } else {
    const transformed = def.reverseTransform(result.value, result);
    if (transformed instanceof Promise) {
      return transformed.then((value) => handleCodecTxResult(result, value, def.in, ctx));
    }
    return handleCodecTxResult(result, transformed, def.in, ctx);
  }
}
function handleCodecTxResult(left, value, nextSchema, ctx) {
  if (left.issues.length) {
    left.aborted = true;
    return left;
  }
  return nextSchema._zod.run({ value, issues: left.issues }, ctx);
}
var $ZodPreprocess = /* @__PURE__ */ $constructor("$ZodPreprocess", (inst, def) => {
  $ZodPipe.init(inst, def);
});
var $ZodReadonly = /* @__PURE__ */ $constructor("$ZodReadonly", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  defineLazy(inst._zod, "optin", () => def.innerType?._zod?.optin);
  defineLazy(inst._zod, "optout", () => def.innerType?._zod?.optout);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then(handleReadonlyResult);
    }
    return handleReadonlyResult(result);
  };
});
function handleReadonlyResult(payload) {
  payload.value = Object.freeze(payload.value);
  return payload;
}
var $ZodTemplateLiteral = /* @__PURE__ */ $constructor("$ZodTemplateLiteral", (inst, def) => {
  $ZodType.init(inst, def);
  const regexParts = [];
  for (const part of def.parts) {
    if (typeof part === "object" && part !== null) {
      if (!part._zod.pattern) {
        throw new Error(`Invalid template literal part, no pattern found: ${[...part._zod.traits].shift()}`);
      }
      const source = part._zod.pattern instanceof RegExp ? part._zod.pattern.source : part._zod.pattern;
      if (!source)
        throw new Error(`Invalid template literal part: ${part._zod.traits}`);
      const start = source.startsWith("^") ? 1 : 0;
      const end = source.endsWith("$") ? source.length - 1 : source.length;
      regexParts.push(source.slice(start, end));
    } else if (part === null || primitiveTypes.has(typeof part)) {
      regexParts.push(escapeRegex(`${part}`));
    } else {
      throw new Error(`Invalid template literal part: ${part}`);
    }
  }
  inst._zod.pattern = new RegExp(`^${regexParts.join("")}$`);
  inst._zod.parse = (payload, _ctx) => {
    if (typeof payload.value !== "string") {
      payload.issues.push({
        input: payload.value,
        inst,
        expected: "string",
        code: "invalid_type"
      });
      return payload;
    }
    inst._zod.pattern.lastIndex = 0;
    if (!inst._zod.pattern.test(payload.value)) {
      payload.issues.push({
        input: payload.value,
        inst,
        code: "invalid_format",
        format: def.format ?? "template_literal",
        pattern: inst._zod.pattern.source
      });
      return payload;
    }
    return payload;
  };
});
var $ZodFunction = /* @__PURE__ */ $constructor("$ZodFunction", (inst, def) => {
  $ZodType.init(inst, def);
  inst._def = def;
  inst._zod.def = def;
  inst.implement = (func) => {
    if (typeof func !== "function") {
      throw new Error("implement() must be called with a function");
    }
    return function(...args) {
      const parsedArgs = inst._def.input ? parse(inst._def.input, args) : args;
      const result = Reflect.apply(func, this, parsedArgs);
      if (inst._def.output) {
        return parse(inst._def.output, result);
      }
      return result;
    };
  };
  inst.implementAsync = (func) => {
    if (typeof func !== "function") {
      throw new Error("implementAsync() must be called with a function");
    }
    return async function(...args) {
      const parsedArgs = inst._def.input ? await parseAsync(inst._def.input, args) : args;
      const result = await Reflect.apply(func, this, parsedArgs);
      if (inst._def.output) {
        return await parseAsync(inst._def.output, result);
      }
      return result;
    };
  };
  inst._zod.parse = (payload, _ctx) => {
    if (typeof payload.value !== "function") {
      payload.issues.push({
        code: "invalid_type",
        expected: "function",
        input: payload.value,
        inst
      });
      return payload;
    }
    const hasPromiseOutput = inst._def.output && inst._def.output._zod.def.type === "promise";
    if (hasPromiseOutput) {
      payload.value = inst.implementAsync(payload.value);
    } else {
      payload.value = inst.implement(payload.value);
    }
    return payload;
  };
  inst.input = (...args) => {
    const F = inst.constructor;
    if (Array.isArray(args[0])) {
      return new F({
        type: "function",
        input: new $ZodTuple({
          type: "tuple",
          items: args[0],
          rest: args[1]
        }),
        output: inst._def.output
      });
    }
    return new F({
      type: "function",
      input: args[0],
      output: inst._def.output
    });
  };
  inst.output = (output) => {
    const F = inst.constructor;
    return new F({
      type: "function",
      input: inst._def.input,
      output
    });
  };
  return inst;
});
var $ZodPromise = /* @__PURE__ */ $constructor("$ZodPromise", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    return Promise.resolve(payload.value).then((inner) => def.innerType._zod.run({ value: inner, issues: [] }, ctx));
  };
});
var $ZodLazy = /* @__PURE__ */ $constructor("$ZodLazy", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "innerType", () => {
    const d = def;
    if (!d._cachedInner)
      d._cachedInner = def.getter();
    return d._cachedInner;
  });
  defineLazy(inst._zod, "pattern", () => inst._zod.innerType?._zod?.pattern);
  defineLazy(inst._zod, "propValues", () => inst._zod.innerType?._zod?.propValues);
  defineLazy(inst._zod, "optin", () => inst._zod.innerType?._zod?.optin ?? void 0);
  defineLazy(inst._zod, "optout", () => inst._zod.innerType?._zod?.optout ?? void 0);
  inst._zod.parse = (payload, ctx) => {
    const inner = inst._zod.innerType;
    return inner._zod.run(payload, ctx);
  };
});
var $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
  $ZodCheck.init(inst, def);
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _) => {
    return payload;
  };
  inst._zod.check = (payload) => {
    const input = payload.value;
    const r = def.fn(input);
    if (r instanceof Promise) {
      return r.then((r2) => handleRefineResult(r2, payload, input, inst));
    }
    handleRefineResult(r, payload, input, inst);
    return;
  };
});
function handleRefineResult(result, payload, input, inst) {
  if (!result) {
    const _iss = {
      code: "custom",
      input,
      inst,
      // incorporates params.error into issue reporting
      path: [...inst._zod.def.path ?? []],
      // incorporates params.error into issue reporting
      continue: !inst._zod.def.abort
      // params: inst._zod.def.params,
    };
    if (inst._zod.def.params)
      _iss.params = inst._zod.def.params;
    payload.issues.push(issue(_iss));
  }
}

// node_modules/zod/v4/locales/index.js
var locales_exports = {};
__export(locales_exports, {
  ar: () => ar_default,
  az: () => az_default,
  be: () => be_default,
  bg: () => bg_default,
  ca: () => ca_default,
  cs: () => cs_default,
  da: () => da_default,
  de: () => de_default,
  el: () => el_default,
  en: () => en_default,
  eo: () => eo_default,
  es: () => es_default,
  fa: () => fa_default,
  fi: () => fi_default,
  fr: () => fr_default,
  frCA: () => fr_CA_default,
  he: () => he_default,
  hr: () => hr_default,
  hu: () => hu_default,
  hy: () => hy_default,
  id: () => id_default,
  is: () => is_default,
  it: () => it_default,
  ja: () => ja_default,
  ka: () => ka_default,
  kh: () => kh_default,
  km: () => km_default,
  ko: () => ko_default,
  lt: () => lt_default,
  mk: () => mk_default,
  ms: () => ms_default,
  nl: () => nl_default,
  no: () => no_default,
  ota: () => ota_default,
  pl: () => pl_default,
  ps: () => ps_default,
  pt: () => pt_default,
  ro: () => ro_default,
  ru: () => ru_default,
  sl: () => sl_default,
  sv: () => sv_default,
  ta: () => ta_default,
  th: () => th_default,
  tr: () => tr_default,
  ua: () => ua_default,
  uk: () => uk_default,
  ur: () => ur_default,
  uz: () => uz_default,
  vi: () => vi_default,
  yo: () => yo_default,
  zhCN: () => zh_CN_default,
  zhTW: () => zh_TW_default
});

// node_modules/zod/v4/locales/ar.js
var error = () => {
  const Sizable = {
    string: { unit: "\u062D\u0631\u0641", verb: "\u0623\u0646 \u064A\u062D\u0648\u064A" },
    file: { unit: "\u0628\u0627\u064A\u062A", verb: "\u0623\u0646 \u064A\u062D\u0648\u064A" },
    array: { unit: "\u0639\u0646\u0635\u0631", verb: "\u0623\u0646 \u064A\u062D\u0648\u064A" },
    set: { unit: "\u0639\u0646\u0635\u0631", verb: "\u0623\u0646 \u064A\u062D\u0648\u064A" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u0645\u062F\u062E\u0644",
    email: "\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A",
    url: "\u0631\u0627\u0628\u0637",
    emoji: "\u0625\u064A\u0645\u0648\u062C\u064A",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "\u062A\u0627\u0631\u064A\u062E \u0648\u0648\u0642\u062A \u0628\u0645\u0639\u064A\u0627\u0631 ISO",
    date: "\u062A\u0627\u0631\u064A\u062E \u0628\u0645\u0639\u064A\u0627\u0631 ISO",
    time: "\u0648\u0642\u062A \u0628\u0645\u0639\u064A\u0627\u0631 ISO",
    duration: "\u0645\u062F\u0629 \u0628\u0645\u0639\u064A\u0627\u0631 ISO",
    ipv4: "\u0639\u0646\u0648\u0627\u0646 IPv4",
    ipv6: "\u0639\u0646\u0648\u0627\u0646 IPv6",
    cidrv4: "\u0645\u062F\u0649 \u0639\u0646\u0627\u0648\u064A\u0646 \u0628\u0635\u064A\u063A\u0629 IPv4",
    cidrv6: "\u0645\u062F\u0649 \u0639\u0646\u0627\u0648\u064A\u0646 \u0628\u0635\u064A\u063A\u0629 IPv6",
    base64: "\u0646\u064E\u0635 \u0628\u062A\u0631\u0645\u064A\u0632 base64-encoded",
    base64url: "\u0646\u064E\u0635 \u0628\u062A\u0631\u0645\u064A\u0632 base64url-encoded",
    json_string: "\u0646\u064E\u0635 \u0639\u0644\u0649 \u0647\u064A\u0626\u0629 JSON",
    e164: "\u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0628\u0645\u0639\u064A\u0627\u0631 E.164",
    jwt: "JWT",
    template_literal: "\u0645\u062F\u062E\u0644"
  };
  const TypeDictionary = {
    nan: "NaN"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u0645\u062F\u062E\u0644\u0627\u062A \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644\u0629: \u064A\u0641\u062A\u0631\u0636 \u0625\u062F\u062E\u0627\u0644 instanceof ${issue2.expected}\u060C \u0648\u0644\u0643\u0646 \u062A\u0645 \u0625\u062F\u062E\u0627\u0644 ${received}`;
        }
        return `\u0645\u062F\u062E\u0644\u0627\u062A \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644\u0629: \u064A\u0641\u062A\u0631\u0636 \u0625\u062F\u062E\u0627\u0644 ${expected}\u060C \u0648\u0644\u0643\u0646 \u062A\u0645 \u0625\u062F\u062E\u0627\u0644 ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\u0645\u062F\u062E\u0644\u0627\u062A \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644\u0629: \u064A\u0641\u062A\u0631\u0636 \u0625\u062F\u062E\u0627\u0644 ${stringifyPrimitive(issue2.values[0])}`;
        return `\u0627\u062E\u062A\u064A\u0627\u0631 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062A\u0648\u0642\u0639 \u0627\u0646\u062A\u0642\u0627\u0621 \u0623\u062D\u062F \u0647\u0630\u0647 \u0627\u0644\u062E\u064A\u0627\u0631\u0627\u062A: ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return ` \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u0644\u0627\u0632\u0645: \u064A\u0641\u062A\u0631\u0636 \u0623\u0646 \u062A\u0643\u0648\u0646 ${issue2.origin ?? "\u0627\u0644\u0642\u064A\u0645\u0629"} ${adj} ${issue2.maximum.toString()} ${sizing.unit ?? "\u0639\u0646\u0635\u0631"}`;
        return `\u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u0644\u0627\u0632\u0645: \u064A\u0641\u062A\u0631\u0636 \u0623\u0646 \u062A\u0643\u0648\u0646 ${issue2.origin ?? "\u0627\u0644\u0642\u064A\u0645\u0629"} ${adj} ${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `\u0623\u0635\u063A\u0631 \u0645\u0646 \u0627\u0644\u0644\u0627\u0632\u0645: \u064A\u0641\u062A\u0631\u0636 \u0644\u0640 ${issue2.origin} \u0623\u0646 \u064A\u0643\u0648\u0646 ${adj} ${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `\u0623\u0635\u063A\u0631 \u0645\u0646 \u0627\u0644\u0644\u0627\u0632\u0645: \u064A\u0641\u062A\u0631\u0636 \u0644\u0640 ${issue2.origin} \u0623\u0646 \u064A\u0643\u0648\u0646 ${adj} ${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `\u0646\u064E\u0635 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u0628\u062F\u0623 \u0628\u0640 "${issue2.prefix}"`;
        if (_issue.format === "ends_with")
          return `\u0646\u064E\u0635 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u0646\u062A\u0647\u064A \u0628\u0640 "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `\u0646\u064E\u0635 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0636\u0645\u0651\u064E\u0646 "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `\u0646\u064E\u0635 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u0637\u0627\u0628\u0642 \u0627\u0644\u0646\u0645\u0637 ${_issue.pattern}`;
        return `${FormatDictionary[_issue.format] ?? issue2.format} \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644`;
      }
      case "not_multiple_of":
        return `\u0631\u0642\u0645 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0645\u0646 \u0645\u0636\u0627\u0639\u0641\u0627\u062A ${issue2.divisor}`;
      case "unrecognized_keys":
        return `\u0645\u0639\u0631\u0641${issue2.keys.length > 1 ? "\u0627\u062A" : ""} \u063A\u0631\u064A\u0628${issue2.keys.length > 1 ? "\u0629" : ""}: ${joinValues(issue2.keys, "\u060C ")}`;
      case "invalid_key":
        return `\u0645\u0639\u0631\u0641 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644 \u0641\u064A ${issue2.origin}`;
      case "invalid_union":
        return "\u0645\u062F\u062E\u0644 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644";
      case "invalid_element":
        return `\u0645\u062F\u062E\u0644 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644 \u0641\u064A ${issue2.origin}`;
      default:
        return "\u0645\u062F\u062E\u0644 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644";
    }
  };
};
function ar_default() {
  return {
    localeError: error()
  };
}

// node_modules/zod/v4/locales/az.js
var error2 = () => {
  const Sizable = {
    string: { unit: "simvol", verb: "olmal\u0131d\u0131r" },
    file: { unit: "bayt", verb: "olmal\u0131d\u0131r" },
    array: { unit: "element", verb: "olmal\u0131d\u0131r" },
    set: { unit: "element", verb: "olmal\u0131d\u0131r" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "input",
    email: "email address",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO datetime",
    date: "ISO date",
    time: "ISO time",
    duration: "ISO duration",
    ipv4: "IPv4 address",
    ipv6: "IPv6 address",
    cidrv4: "IPv4 range",
    cidrv6: "IPv6 range",
    base64: "base64-encoded string",
    base64url: "base64url-encoded string",
    json_string: "JSON string",
    e164: "E.164 number",
    jwt: "JWT",
    template_literal: "input"
  };
  const TypeDictionary = {
    nan: "NaN"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Yanl\u0131\u015F d\u0259y\u0259r: g\xF6zl\u0259nil\u0259n instanceof ${issue2.expected}, daxil olan ${received}`;
        }
        return `Yanl\u0131\u015F d\u0259y\u0259r: g\xF6zl\u0259nil\u0259n ${expected}, daxil olan ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Yanl\u0131\u015F d\u0259y\u0259r: g\xF6zl\u0259nil\u0259n ${stringifyPrimitive(issue2.values[0])}`;
        return `Yanl\u0131\u015F se\xE7im: a\u015Fa\u011F\u0131dak\u0131lardan biri olmal\u0131d\u0131r: ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `\xC7ox b\xF6y\xFCk: g\xF6zl\u0259nil\u0259n ${issue2.origin ?? "d\u0259y\u0259r"} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "element"}`;
        return `\xC7ox b\xF6y\xFCk: g\xF6zl\u0259nil\u0259n ${issue2.origin ?? "d\u0259y\u0259r"} ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `\xC7ox ki\xE7ik: g\xF6zl\u0259nil\u0259n ${issue2.origin} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        return `\xC7ox ki\xE7ik: g\xF6zl\u0259nil\u0259n ${issue2.origin} ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Yanl\u0131\u015F m\u0259tn: "${_issue.prefix}" il\u0259 ba\u015Flamal\u0131d\u0131r`;
        if (_issue.format === "ends_with")
          return `Yanl\u0131\u015F m\u0259tn: "${_issue.suffix}" il\u0259 bitm\u0259lidir`;
        if (_issue.format === "includes")
          return `Yanl\u0131\u015F m\u0259tn: "${_issue.includes}" daxil olmal\u0131d\u0131r`;
        if (_issue.format === "regex")
          return `Yanl\u0131\u015F m\u0259tn: ${_issue.pattern} \u015Fablonuna uy\u011Fun olmal\u0131d\u0131r`;
        return `Yanl\u0131\u015F ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Yanl\u0131\u015F \u0259d\u0259d: ${issue2.divisor} il\u0259 b\xF6l\xFCn\u0259 bil\u0259n olmal\u0131d\u0131r`;
      case "unrecognized_keys":
        return `Tan\u0131nmayan a\xE7ar${issue2.keys.length > 1 ? "lar" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `${issue2.origin} daxilind\u0259 yanl\u0131\u015F a\xE7ar`;
      case "invalid_union":
        return "Yanl\u0131\u015F d\u0259y\u0259r";
      case "invalid_element":
        return `${issue2.origin} daxilind\u0259 yanl\u0131\u015F d\u0259y\u0259r`;
      default:
        return `Yanl\u0131\u015F d\u0259y\u0259r`;
    }
  };
};
function az_default() {
  return {
    localeError: error2()
  };
}

// node_modules/zod/v4/locales/be.js
function getBelarusianPlural(count, one, few, many) {
  const absCount = Math.abs(count);
  const lastDigit = absCount % 10;
  const lastTwoDigits = absCount % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return many;
  }
  if (lastDigit === 1) {
    return one;
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return few;
  }
  return many;
}
var error3 = () => {
  const Sizable = {
    string: {
      unit: {
        one: "\u0441\u0456\u043C\u0432\u0430\u043B",
        few: "\u0441\u0456\u043C\u0432\u0430\u043B\u044B",
        many: "\u0441\u0456\u043C\u0432\u0430\u043B\u0430\u045E"
      },
      verb: "\u043C\u0435\u0446\u044C"
    },
    array: {
      unit: {
        one: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442",
        few: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B",
        many: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430\u045E"
      },
      verb: "\u043C\u0435\u0446\u044C"
    },
    set: {
      unit: {
        one: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442",
        few: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B",
        many: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430\u045E"
      },
      verb: "\u043C\u0435\u0446\u044C"
    },
    file: {
      unit: {
        one: "\u0431\u0430\u0439\u0442",
        few: "\u0431\u0430\u0439\u0442\u044B",
        many: "\u0431\u0430\u0439\u0442\u0430\u045E"
      },
      verb: "\u043C\u0435\u0446\u044C"
    }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u0443\u0432\u043E\u0434",
    email: "email \u0430\u0434\u0440\u0430\u0441",
    url: "URL",
    emoji: "\u044D\u043C\u043E\u0434\u0437\u0456",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO \u0434\u0430\u0442\u0430 \u0456 \u0447\u0430\u0441",
    date: "ISO \u0434\u0430\u0442\u0430",
    time: "ISO \u0447\u0430\u0441",
    duration: "ISO \u043F\u0440\u0430\u0446\u044F\u0433\u043B\u0430\u0441\u0446\u044C",
    ipv4: "IPv4 \u0430\u0434\u0440\u0430\u0441",
    ipv6: "IPv6 \u0430\u0434\u0440\u0430\u0441",
    cidrv4: "IPv4 \u0434\u044B\u044F\u043F\u0430\u0437\u043E\u043D",
    cidrv6: "IPv6 \u0434\u044B\u044F\u043F\u0430\u0437\u043E\u043D",
    base64: "\u0440\u0430\u0434\u043E\u043A \u0443 \u0444\u0430\u0440\u043C\u0430\u0446\u0435 base64",
    base64url: "\u0440\u0430\u0434\u043E\u043A \u0443 \u0444\u0430\u0440\u043C\u0430\u0446\u0435 base64url",
    json_string: "JSON \u0440\u0430\u0434\u043E\u043A",
    e164: "\u043D\u0443\u043C\u0430\u0440 E.164",
    jwt: "JWT",
    template_literal: "\u0443\u0432\u043E\u0434"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "\u043B\u0456\u043A",
    array: "\u043C\u0430\u0441\u0456\u045E"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434: \u0447\u0430\u043A\u0430\u045E\u0441\u044F instanceof ${issue2.expected}, \u0430\u0442\u0440\u044B\u043C\u0430\u043D\u0430 ${received}`;
        }
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434: \u0447\u0430\u043A\u0430\u045E\u0441\u044F ${expected}, \u0430\u0442\u0440\u044B\u043C\u0430\u043D\u0430 ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F ${stringifyPrimitive(issue2.values[0])}`;
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0432\u0430\u0440\u044B\u044F\u043D\u0442: \u0447\u0430\u043A\u0430\u045E\u0441\u044F \u0430\u0434\u0437\u0456\u043D \u0437 ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          const maxValue = Number(issue2.maximum);
          const unit = getBelarusianPlural(maxValue, sizing.unit.one, sizing.unit.few, sizing.unit.many);
          return `\u0417\u0430\u043D\u0430\u0434\u0442\u0430 \u0432\u044F\u043B\u0456\u043A\u0456: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F, \u0448\u0442\u043E ${issue2.origin ?? "\u0437\u043D\u0430\u0447\u044D\u043D\u043D\u0435"} \u043F\u0430\u0432\u0456\u043D\u043D\u0430 ${sizing.verb} ${adj}${issue2.maximum.toString()} ${unit}`;
        }
        return `\u0417\u0430\u043D\u0430\u0434\u0442\u0430 \u0432\u044F\u043B\u0456\u043A\u0456: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F, \u0448\u0442\u043E ${issue2.origin ?? "\u0437\u043D\u0430\u0447\u044D\u043D\u043D\u0435"} \u043F\u0430\u0432\u0456\u043D\u043D\u0430 \u0431\u044B\u0446\u044C ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          const minValue = Number(issue2.minimum);
          const unit = getBelarusianPlural(minValue, sizing.unit.one, sizing.unit.few, sizing.unit.many);
          return `\u0417\u0430\u043D\u0430\u0434\u0442\u0430 \u043C\u0430\u043B\u044B: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F, \u0448\u0442\u043E ${issue2.origin} \u043F\u0430\u0432\u0456\u043D\u043D\u0430 ${sizing.verb} ${adj}${issue2.minimum.toString()} ${unit}`;
        }
        return `\u0417\u0430\u043D\u0430\u0434\u0442\u0430 \u043C\u0430\u043B\u044B: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F, \u0448\u0442\u043E ${issue2.origin} \u043F\u0430\u0432\u0456\u043D\u043D\u0430 \u0431\u044B\u0446\u044C ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0440\u0430\u0434\u043E\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u043F\u0430\u0447\u044B\u043D\u0430\u0446\u0446\u0430 \u0437 "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0440\u0430\u0434\u043E\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u0437\u0430\u043A\u0430\u043D\u0447\u0432\u0430\u0446\u0446\u0430 \u043D\u0430 "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0440\u0430\u0434\u043E\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u0437\u043C\u044F\u0448\u0447\u0430\u0446\u044C "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0440\u0430\u0434\u043E\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u0430\u0434\u043F\u0430\u0432\u044F\u0434\u0430\u0446\u044C \u0448\u0430\u0431\u043B\u043E\u043D\u0443 ${_issue.pattern}`;
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u043B\u0456\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u0431\u044B\u0446\u044C \u043A\u0440\u0430\u0442\u043D\u044B\u043C ${issue2.divisor}`;
      case "unrecognized_keys":
        return `\u041D\u0435\u0440\u0430\u0441\u043F\u0430\u0437\u043D\u0430\u043D\u044B ${issue2.keys.length > 1 ? "\u043A\u043B\u044E\u0447\u044B" : "\u043A\u043B\u044E\u0447"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u043A\u043B\u044E\u0447 \u0443 ${issue2.origin}`;
      case "invalid_union":
        return "\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434";
      case "invalid_element":
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u0430\u0435 \u0437\u043D\u0430\u0447\u044D\u043D\u043D\u0435 \u045E ${issue2.origin}`;
      default:
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434`;
    }
  };
};
function be_default() {
  return {
    localeError: error3()
  };
}

// node_modules/zod/v4/locales/bg.js
var error4 = () => {
  const Sizable = {
    string: { unit: "\u0441\u0438\u043C\u0432\u043E\u043B\u0430", verb: "\u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430" },
    file: { unit: "\u0431\u0430\u0439\u0442\u0430", verb: "\u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430" },
    array: { unit: "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0430", verb: "\u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430" },
    set: { unit: "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0430", verb: "\u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u0432\u0445\u043E\u0434",
    email: "\u0438\u043C\u0435\u0439\u043B \u0430\u0434\u0440\u0435\u0441",
    url: "URL",
    emoji: "\u0435\u043C\u043E\u0434\u0436\u0438",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO \u0432\u0440\u0435\u043C\u0435",
    date: "ISO \u0434\u0430\u0442\u0430",
    time: "ISO \u0432\u0440\u0435\u043C\u0435",
    duration: "ISO \u043F\u0440\u043E\u0434\u044A\u043B\u0436\u0438\u0442\u0435\u043B\u043D\u043E\u0441\u0442",
    ipv4: "IPv4 \u0430\u0434\u0440\u0435\u0441",
    ipv6: "IPv6 \u0430\u0434\u0440\u0435\u0441",
    cidrv4: "IPv4 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D",
    cidrv6: "IPv6 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D",
    base64: "base64-\u043A\u043E\u0434\u0438\u0440\u0430\u043D \u043D\u0438\u0437",
    base64url: "base64url-\u043A\u043E\u0434\u0438\u0440\u0430\u043D \u043D\u0438\u0437",
    json_string: "JSON \u043D\u0438\u0437",
    e164: "E.164 \u043D\u043E\u043C\u0435\u0440",
    jwt: "JWT",
    template_literal: "\u0432\u0445\u043E\u0434"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "\u0447\u0438\u0441\u043B\u043E",
    array: "\u043C\u0430\u0441\u0438\u0432"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434: \u043E\u0447\u0430\u043A\u0432\u0430\u043D instanceof ${issue2.expected}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D ${received}`;
        }
        return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434: \u043E\u0447\u0430\u043A\u0432\u0430\u043D ${expected}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434: \u043E\u0447\u0430\u043A\u0432\u0430\u043D ${stringifyPrimitive(issue2.values[0])}`;
        return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430 \u043E\u043F\u0446\u0438\u044F: \u043E\u0447\u0430\u043A\u0432\u0430\u043D\u043E \u0435\u0434\u043D\u043E \u043E\u0442 ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `\u0422\u0432\u044A\u0440\u0434\u0435 \u0433\u043E\u043B\u044F\u043C\u043E: \u043E\u0447\u0430\u043A\u0432\u0430 \u0441\u0435 ${issue2.origin ?? "\u0441\u0442\u043E\u0439\u043D\u043E\u0441\u0442"} \u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430 ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0430"}`;
        return `\u0422\u0432\u044A\u0440\u0434\u0435 \u0433\u043E\u043B\u044F\u043C\u043E: \u043E\u0447\u0430\u043A\u0432\u0430 \u0441\u0435 ${issue2.origin ?? "\u0441\u0442\u043E\u0439\u043D\u043E\u0441\u0442"} \u0434\u0430 \u0431\u044A\u0434\u0435 ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `\u0422\u0432\u044A\u0440\u0434\u0435 \u043C\u0430\u043B\u043A\u043E: \u043E\u0447\u0430\u043A\u0432\u0430 \u0441\u0435 ${issue2.origin} \u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430 ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `\u0422\u0432\u044A\u0440\u0434\u0435 \u043C\u0430\u043B\u043A\u043E: \u043E\u0447\u0430\u043A\u0432\u0430 \u0441\u0435 ${issue2.origin} \u0434\u0430 \u0431\u044A\u0434\u0435 ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043D\u0438\u0437: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0437\u0430\u043F\u043E\u0447\u0432\u0430 \u0441 "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043D\u0438\u0437: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0437\u0430\u0432\u044A\u0440\u0448\u0432\u0430 \u0441 "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043D\u0438\u0437: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0432\u043A\u043B\u044E\u0447\u0432\u0430 "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043D\u0438\u0437: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0441\u044A\u0432\u043F\u0430\u0434\u0430 \u0441 ${_issue.pattern}`;
        let invalid_adj = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D";
        if (_issue.format === "emoji")
          invalid_adj = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E";
        if (_issue.format === "datetime")
          invalid_adj = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E";
        if (_issue.format === "date")
          invalid_adj = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430";
        if (_issue.format === "time")
          invalid_adj = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E";
        if (_issue.format === "duration")
          invalid_adj = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430";
        return `${invalid_adj} ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E \u0447\u0438\u0441\u043B\u043E: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0431\u044A\u0434\u0435 \u043A\u0440\u0430\u0442\u043D\u043E \u043D\u0430 ${issue2.divisor}`;
      case "unrecognized_keys":
        return `\u041D\u0435\u0440\u0430\u0437\u043F\u043E\u0437\u043D\u0430\u0442${issue2.keys.length > 1 ? "\u0438" : ""} \u043A\u043B\u044E\u0447${issue2.keys.length > 1 ? "\u043E\u0432\u0435" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043A\u043B\u044E\u0447 \u0432 ${issue2.origin}`;
      case "invalid_union":
        return "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434";
      case "invalid_element":
        return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430 \u0441\u0442\u043E\u0439\u043D\u043E\u0441\u0442 \u0432 ${issue2.origin}`;
      default:
        return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434`;
    }
  };
};
function bg_default() {
  return {
    localeError: error4()
  };
}

// node_modules/zod/v4/locales/ca.js
var error5 = () => {
  const Sizable = {
    string: { unit: "car\xE0cters", verb: "contenir" },
    file: { unit: "bytes", verb: "contenir" },
    array: { unit: "elements", verb: "contenir" },
    set: { unit: "elements", verb: "contenir" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "entrada",
    email: "adre\xE7a electr\xF2nica",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "data i hora ISO",
    date: "data ISO",
    time: "hora ISO",
    duration: "durada ISO",
    ipv4: "adre\xE7a IPv4",
    ipv6: "adre\xE7a IPv6",
    cidrv4: "rang IPv4",
    cidrv6: "rang IPv6",
    base64: "cadena codificada en base64",
    base64url: "cadena codificada en base64url",
    json_string: "cadena JSON",
    e164: "n\xFAmero E.164",
    jwt: "JWT",
    template_literal: "entrada"
  };
  const TypeDictionary = {
    nan: "NaN"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Tipus inv\xE0lid: s'esperava instanceof ${issue2.expected}, s'ha rebut ${received}`;
        }
        return `Tipus inv\xE0lid: s'esperava ${expected}, s'ha rebut ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Valor inv\xE0lid: s'esperava ${stringifyPrimitive(issue2.values[0])}`;
        return `Opci\xF3 inv\xE0lida: s'esperava una de ${joinValues(issue2.values, " o ")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "com a m\xE0xim" : "menys de";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Massa gran: s'esperava que ${issue2.origin ?? "el valor"} contingu\xE9s ${adj} ${issue2.maximum.toString()} ${sizing.unit ?? "elements"}`;
        return `Massa gran: s'esperava que ${issue2.origin ?? "el valor"} fos ${adj} ${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? "com a m\xEDnim" : "m\xE9s de";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Massa petit: s'esperava que ${issue2.origin} contingu\xE9s ${adj} ${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Massa petit: s'esperava que ${issue2.origin} fos ${adj} ${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Format inv\xE0lid: ha de comen\xE7ar amb "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Format inv\xE0lid: ha d'acabar amb "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Format inv\xE0lid: ha d'incloure "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Format inv\xE0lid: ha de coincidir amb el patr\xF3 ${_issue.pattern}`;
        return `Format inv\xE0lid per a ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `N\xFAmero inv\xE0lid: ha de ser m\xFAltiple de ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Clau${issue2.keys.length > 1 ? "s" : ""} no reconeguda${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Clau inv\xE0lida a ${issue2.origin}`;
      case "invalid_union":
        return "Entrada inv\xE0lida";
      // Could also be "Tipus d'unió invàlid" but "Entrada invàlida" is more general
      case "invalid_element":
        return `Element inv\xE0lid a ${issue2.origin}`;
      default:
        return `Entrada inv\xE0lida`;
    }
  };
};
function ca_default() {
  return {
    localeError: error5()
  };
}

// node_modules/zod/v4/locales/cs.js
var error6 = () => {
  const Sizable = {
    string: { unit: "znak\u016F", verb: "m\xEDt" },
    file: { unit: "bajt\u016F", verb: "m\xEDt" },
    array: { unit: "prvk\u016F", verb: "m\xEDt" },
    set: { unit: "prvk\u016F", verb: "m\xEDt" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "regul\xE1rn\xED v\xFDraz",
    email: "e-mailov\xE1 adresa",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "datum a \u010Das ve form\xE1tu ISO",
    date: "datum ve form\xE1tu ISO",
    time: "\u010Das ve form\xE1tu ISO",
    duration: "doba trv\xE1n\xED ISO",
    ipv4: "IPv4 adresa",
    ipv6: "IPv6 adresa",
    cidrv4: "rozsah IPv4",
    cidrv6: "rozsah IPv6",
    base64: "\u0159et\u011Bzec zak\xF3dovan\xFD ve form\xE1tu base64",
    base64url: "\u0159et\u011Bzec zak\xF3dovan\xFD ve form\xE1tu base64url",
    json_string: "\u0159et\u011Bzec ve form\xE1tu JSON",
    e164: "\u010D\xEDslo E.164",
    jwt: "JWT",
    template_literal: "vstup"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "\u010D\xEDslo",
    string: "\u0159et\u011Bzec",
    function: "funkce",
    array: "pole"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Neplatn\xFD vstup: o\u010Dek\xE1v\xE1no instanceof ${issue2.expected}, obdr\u017Eeno ${received}`;
        }
        return `Neplatn\xFD vstup: o\u010Dek\xE1v\xE1no ${expected}, obdr\u017Eeno ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Neplatn\xFD vstup: o\u010Dek\xE1v\xE1no ${stringifyPrimitive(issue2.values[0])}`;
        return `Neplatn\xE1 mo\u017Enost: o\u010Dek\xE1v\xE1na jedna z hodnot ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Hodnota je p\u0159\xEDli\u0161 velk\xE1: ${issue2.origin ?? "hodnota"} mus\xED m\xEDt ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "prvk\u016F"}`;
        }
        return `Hodnota je p\u0159\xEDli\u0161 velk\xE1: ${issue2.origin ?? "hodnota"} mus\xED b\xFDt ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Hodnota je p\u0159\xEDli\u0161 mal\xE1: ${issue2.origin ?? "hodnota"} mus\xED m\xEDt ${adj}${issue2.minimum.toString()} ${sizing.unit ?? "prvk\u016F"}`;
        }
        return `Hodnota je p\u0159\xEDli\u0161 mal\xE1: ${issue2.origin ?? "hodnota"} mus\xED b\xFDt ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Neplatn\xFD \u0159et\u011Bzec: mus\xED za\u010D\xEDnat na "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Neplatn\xFD \u0159et\u011Bzec: mus\xED kon\u010Dit na "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Neplatn\xFD \u0159et\u011Bzec: mus\xED obsahovat "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Neplatn\xFD \u0159et\u011Bzec: mus\xED odpov\xEDdat vzoru ${_issue.pattern}`;
        return `Neplatn\xFD form\xE1t ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Neplatn\xE9 \u010D\xEDslo: mus\xED b\xFDt n\xE1sobkem ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Nezn\xE1m\xE9 kl\xED\u010De: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Neplatn\xFD kl\xED\u010D v ${issue2.origin}`;
      case "invalid_union":
        return "Neplatn\xFD vstup";
      case "invalid_element":
        return `Neplatn\xE1 hodnota v ${issue2.origin}`;
      default:
        return `Neplatn\xFD vstup`;
    }
  };
};
function cs_default() {
  return {
    localeError: error6()
  };
}

// node_modules/zod/v4/locales/da.js
var error7 = () => {
  const Sizable = {
    string: { unit: "tegn", verb: "havde" },
    file: { unit: "bytes", verb: "havde" },
    array: { unit: "elementer", verb: "indeholdt" },
    set: { unit: "elementer", verb: "indeholdt" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "input",
    email: "e-mailadresse",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO dato- og klokkesl\xE6t",
    date: "ISO-dato",
    time: "ISO-klokkesl\xE6t",
    duration: "ISO-varighed",
    ipv4: "IPv4-omr\xE5de",
    ipv6: "IPv6-omr\xE5de",
    cidrv4: "IPv4-spektrum",
    cidrv6: "IPv6-spektrum",
    base64: "base64-kodet streng",
    base64url: "base64url-kodet streng",
    json_string: "JSON-streng",
    e164: "E.164-nummer",
    jwt: "JWT",
    template_literal: "input"
  };
  const TypeDictionary = {
    nan: "NaN",
    string: "streng",
    number: "tal",
    boolean: "boolean",
    array: "liste",
    object: "objekt",
    set: "s\xE6t",
    file: "fil"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Ugyldigt input: forventede instanceof ${issue2.expected}, fik ${received}`;
        }
        return `Ugyldigt input: forventede ${expected}, fik ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Ugyldig v\xE6rdi: forventede ${stringifyPrimitive(issue2.values[0])}`;
        return `Ugyldigt valg: forventede en af f\xF8lgende ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        const origin = TypeDictionary[issue2.origin] ?? issue2.origin;
        if (sizing)
          return `For stor: forventede ${origin ?? "value"} ${sizing.verb} ${adj} ${issue2.maximum.toString()} ${sizing.unit ?? "elementer"}`;
        return `For stor: forventede ${origin ?? "value"} havde ${adj} ${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        const origin = TypeDictionary[issue2.origin] ?? issue2.origin;
        if (sizing) {
          return `For lille: forventede ${origin} ${sizing.verb} ${adj} ${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `For lille: forventede ${origin} havde ${adj} ${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Ugyldig streng: skal starte med "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Ugyldig streng: skal ende med "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Ugyldig streng: skal indeholde "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Ugyldig streng: skal matche m\xF8nsteret ${_issue.pattern}`;
        return `Ugyldig ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Ugyldigt tal: skal v\xE6re deleligt med ${issue2.divisor}`;
      case "unrecognized_keys":
        return `${issue2.keys.length > 1 ? "Ukendte n\xF8gler" : "Ukendt n\xF8gle"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Ugyldig n\xF8gle i ${issue2.origin}`;
      case "invalid_union":
        return "Ugyldigt input: matcher ingen af de tilladte typer";
      case "invalid_element":
        return `Ugyldig v\xE6rdi i ${issue2.origin}`;
      default:
        return `Ugyldigt input`;
    }
  };
};
function da_default() {
  return {
    localeError: error7()
  };
}

// node_modules/zod/v4/locales/de.js
var error8 = () => {
  const Sizable = {
    string: { unit: "Zeichen", verb: "zu haben" },
    file: { unit: "Bytes", verb: "zu haben" },
    array: { unit: "Elemente", verb: "zu haben" },
    set: { unit: "Elemente", verb: "zu haben" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "Eingabe",
    email: "E-Mail-Adresse",
    url: "URL",
    emoji: "Emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO-Datum und -Uhrzeit",
    date: "ISO-Datum",
    time: "ISO-Uhrzeit",
    duration: "ISO-Dauer",
    ipv4: "IPv4-Adresse",
    ipv6: "IPv6-Adresse",
    cidrv4: "IPv4-Bereich",
    cidrv6: "IPv6-Bereich",
    base64: "Base64-codierter String",
    base64url: "Base64-URL-codierter String",
    json_string: "JSON-String",
    e164: "E.164-Nummer",
    jwt: "JWT",
    template_literal: "Eingabe"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "Zahl",
    array: "Array"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Ung\xFCltige Eingabe: erwartet instanceof ${issue2.expected}, erhalten ${received}`;
        }
        return `Ung\xFCltige Eingabe: erwartet ${expected}, erhalten ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Ung\xFCltige Eingabe: erwartet ${stringifyPrimitive(issue2.values[0])}`;
        return `Ung\xFCltige Option: erwartet eine von ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Zu gro\xDF: erwartet, dass ${issue2.origin ?? "Wert"} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "Elemente"} hat`;
        return `Zu gro\xDF: erwartet, dass ${issue2.origin ?? "Wert"} ${adj}${issue2.maximum.toString()} ist`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Zu klein: erwartet, dass ${issue2.origin} ${adj}${issue2.minimum.toString()} ${sizing.unit} hat`;
        }
        return `Zu klein: erwartet, dass ${issue2.origin} ${adj}${issue2.minimum.toString()} ist`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Ung\xFCltiger String: muss mit "${_issue.prefix}" beginnen`;
        if (_issue.format === "ends_with")
          return `Ung\xFCltiger String: muss mit "${_issue.suffix}" enden`;
        if (_issue.format === "includes")
          return `Ung\xFCltiger String: muss "${_issue.includes}" enthalten`;
        if (_issue.format === "regex")
          return `Ung\xFCltiger String: muss dem Muster ${_issue.pattern} entsprechen`;
        return `Ung\xFCltig: ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Ung\xFCltige Zahl: muss ein Vielfaches von ${issue2.divisor} sein`;
      case "unrecognized_keys":
        return `${issue2.keys.length > 1 ? "Unbekannte Schl\xFCssel" : "Unbekannter Schl\xFCssel"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Ung\xFCltiger Schl\xFCssel in ${issue2.origin}`;
      case "invalid_union":
        return "Ung\xFCltige Eingabe";
      case "invalid_element":
        return `Ung\xFCltiger Wert in ${issue2.origin}`;
      default:
        return `Ung\xFCltige Eingabe`;
    }
  };
};
function de_default() {
  return {
    localeError: error8()
  };
}

// node_modules/zod/v4/locales/el.js
var error9 = () => {
  const Sizable = {
    string: { unit: "\u03C7\u03B1\u03C1\u03B1\u03BA\u03C4\u03AE\u03C1\u03B5\u03C2", verb: "\u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9" },
    file: { unit: "bytes", verb: "\u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9" },
    array: { unit: "\u03C3\u03C4\u03BF\u03B9\u03C7\u03B5\u03AF\u03B1", verb: "\u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9" },
    set: { unit: "\u03C3\u03C4\u03BF\u03B9\u03C7\u03B5\u03AF\u03B1", verb: "\u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9" },
    map: { unit: "\u03BA\u03B1\u03C4\u03B1\u03C7\u03C9\u03C1\u03AE\u03C3\u03B5\u03B9\u03C2", verb: "\u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2",
    email: "\u03B4\u03B9\u03B5\u03CD\u03B8\u03C5\u03BD\u03C3\u03B7 email",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO \u03B7\u03BC\u03B5\u03C1\u03BF\u03BC\u03B7\u03BD\u03AF\u03B1 \u03BA\u03B1\u03B9 \u03CE\u03C1\u03B1",
    date: "ISO \u03B7\u03BC\u03B5\u03C1\u03BF\u03BC\u03B7\u03BD\u03AF\u03B1",
    time: "ISO \u03CE\u03C1\u03B1",
    duration: "ISO \u03B4\u03B9\u03AC\u03C1\u03BA\u03B5\u03B9\u03B1",
    ipv4: "\u03B4\u03B9\u03B5\u03CD\u03B8\u03C5\u03BD\u03C3\u03B7 IPv4",
    ipv6: "\u03B4\u03B9\u03B5\u03CD\u03B8\u03C5\u03BD\u03C3\u03B7 IPv6",
    mac: "\u03B4\u03B9\u03B5\u03CD\u03B8\u03C5\u03BD\u03C3\u03B7 MAC",
    cidrv4: "\u03B5\u03CD\u03C1\u03BF\u03C2 IPv4",
    cidrv6: "\u03B5\u03CD\u03C1\u03BF\u03C2 IPv6",
    base64: "\u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC \u03BA\u03C9\u03B4\u03B9\u03BA\u03BF\u03C0\u03BF\u03B9\u03B7\u03BC\u03AD\u03BD\u03B7 \u03C3\u03B5 base64",
    base64url: "\u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC \u03BA\u03C9\u03B4\u03B9\u03BA\u03BF\u03C0\u03BF\u03B9\u03B7\u03BC\u03AD\u03BD\u03B7 \u03C3\u03B5 base64url",
    json_string: "\u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC JSON",
    e164: "\u03B1\u03C1\u03B9\u03B8\u03BC\u03CC\u03C2 E.164",
    jwt: "JWT",
    template_literal: "\u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2"
  };
  const TypeDictionary = {
    nan: "NaN"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (typeof issue2.expected === "string" && /^[A-Z]/.test(issue2.expected)) {
          return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD instanceof ${issue2.expected}, \u03BB\u03AE\u03C6\u03B8\u03B7\u03BA\u03B5 ${received}`;
        }
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${expected}, \u03BB\u03AE\u03C6\u03B8\u03B7\u03BA\u03B5 ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${stringifyPrimitive(issue2.values[0])}`;
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03C0\u03B9\u03BB\u03BF\u03B3\u03AE: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD \u03AD\u03BD\u03B1 \u03B1\u03C0\u03CC ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `\u03A0\u03BF\u03BB\u03CD \u03BC\u03B5\u03B3\u03AC\u03BB\u03BF: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${issue2.origin ?? "\u03C4\u03B9\u03BC\u03AE"} \u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9 ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "\u03C3\u03C4\u03BF\u03B9\u03C7\u03B5\u03AF\u03B1"}`;
        return `\u03A0\u03BF\u03BB\u03CD \u03BC\u03B5\u03B3\u03AC\u03BB\u03BF: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${issue2.origin ?? "\u03C4\u03B9\u03BC\u03AE"} \u03BD\u03B1 \u03B5\u03AF\u03BD\u03B1\u03B9 ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `\u03A0\u03BF\u03BB\u03CD \u03BC\u03B9\u03BA\u03C1\u03CC: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${issue2.origin} \u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9 ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `\u03A0\u03BF\u03BB\u03CD \u03BC\u03B9\u03BA\u03C1\u03CC: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${issue2.origin} \u03BD\u03B1 \u03B5\u03AF\u03BD\u03B1\u03B9 ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC: \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03BE\u03B5\u03BA\u03B9\u03BD\u03AC \u03BC\u03B5 "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC: \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03C4\u03B5\u03BB\u03B5\u03B9\u03CE\u03BD\u03B5\u03B9 \u03BC\u03B5 "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC: \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03C0\u03B5\u03C1\u03B9\u03AD\u03C7\u03B5\u03B9 "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC: \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03C4\u03B1\u03B9\u03C1\u03B9\u03AC\u03B6\u03B5\u03B9 \u03BC\u03B5 \u03C4\u03BF \u03BC\u03BF\u03C4\u03AF\u03B2\u03BF ${_issue.pattern}`;
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03BF: ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03BF\u03C2 \u03B1\u03C1\u03B9\u03B8\u03BC\u03CC\u03C2: \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03B5\u03AF\u03BD\u03B1\u03B9 \u03C0\u03BF\u03BB\u03BB\u03B1\u03C0\u03BB\u03AC\u03C3\u03B9\u03BF \u03C4\u03BF\u03C5 ${issue2.divisor}`;
      case "unrecognized_keys":
        return `\u0386\u03B3\u03BD\u03C9\u03C3\u03C4${issue2.keys.length > 1 ? "\u03B1" : "\u03BF"} \u03BA\u03BB\u03B5\u03B9\u03B4${issue2.keys.length > 1 ? "\u03B9\u03AC" : "\u03AF"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03BF \u03BA\u03BB\u03B5\u03B9\u03B4\u03AF \u03C3\u03C4\u03BF ${issue2.origin}`;
      case "invalid_union":
        return "\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2";
      case "invalid_element":
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03C4\u03B9\u03BC\u03AE \u03C3\u03C4\u03BF ${issue2.origin}`;
      default:
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2`;
    }
  };
};
function el_default() {
  return {
    localeError: error9()
  };
}

// node_modules/zod/v4/locales/en.js
var error10 = () => {
  const Sizable = {
    string: { unit: "characters", verb: "to have" },
    file: { unit: "bytes", verb: "to have" },
    array: { unit: "items", verb: "to have" },
    set: { unit: "items", verb: "to have" },
    map: { unit: "entries", verb: "to have" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "input",
    email: "email address",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO datetime",
    date: "ISO date",
    time: "ISO time",
    duration: "ISO duration",
    ipv4: "IPv4 address",
    ipv6: "IPv6 address",
    mac: "MAC address",
    cidrv4: "IPv4 range",
    cidrv6: "IPv6 range",
    base64: "base64-encoded string",
    base64url: "base64url-encoded string",
    json_string: "JSON string",
    e164: "E.164 number",
    jwt: "JWT",
    template_literal: "input"
  };
  const TypeDictionary = {
    // Compatibility: "nan" -> "NaN" for display
    nan: "NaN"
    // All other type names omitted - they fall back to raw values via ?? operator
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        return `Invalid input: expected ${expected}, received ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Invalid input: expected ${stringifyPrimitive(issue2.values[0])}`;
        return `Invalid option: expected one of ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Too big: expected ${issue2.origin ?? "value"} to have ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elements"}`;
        return `Too big: expected ${issue2.origin ?? "value"} to be ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Too small: expected ${issue2.origin} to have ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Too small: expected ${issue2.origin} to be ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Invalid string: must start with "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Invalid string: must end with "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Invalid string: must include "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Invalid string: must match pattern ${_issue.pattern}`;
        return `Invalid ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Invalid number: must be a multiple of ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Unrecognized key${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Invalid key in ${issue2.origin}`;
      case "invalid_union":
        if (issue2.options && Array.isArray(issue2.options) && issue2.options.length > 0) {
          const opts = issue2.options.map((o) => `'${o}'`).join(" | ");
          return `Invalid discriminator value. Expected ${opts}`;
        }
        return "Invalid input";
      case "invalid_element":
        return `Invalid value in ${issue2.origin}`;
      default:
        return `Invalid input`;
    }
  };
};
function en_default() {
  return {
    localeError: error10()
  };
}

// node_modules/zod/v4/locales/eo.js
var error11 = () => {
  const Sizable = {
    string: { unit: "karaktrojn", verb: "havi" },
    file: { unit: "bajtojn", verb: "havi" },
    array: { unit: "elementojn", verb: "havi" },
    set: { unit: "elementojn", verb: "havi" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "enigo",
    email: "retadreso",
    url: "URL",
    emoji: "emo\u011Dio",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO-datotempo",
    date: "ISO-dato",
    time: "ISO-tempo",
    duration: "ISO-da\u016Dro",
    ipv4: "IPv4-adreso",
    ipv6: "IPv6-adreso",
    cidrv4: "IPv4-rango",
    cidrv6: "IPv6-rango",
    base64: "64-ume kodita karaktraro",
    base64url: "URL-64-ume kodita karaktraro",
    json_string: "JSON-karaktraro",
    e164: "E.164-nombro",
    jwt: "JWT",
    template_literal: "enigo"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "nombro",
    array: "tabelo",
    null: "senvalora"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Nevalida enigo: atendi\u011Dis instanceof ${issue2.expected}, ricevi\u011Dis ${received}`;
        }
        return `Nevalida enigo: atendi\u011Dis ${expected}, ricevi\u011Dis ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Nevalida enigo: atendi\u011Dis ${stringifyPrimitive(issue2.values[0])}`;
        return `Nevalida opcio: atendi\u011Dis unu el ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Tro granda: atendi\u011Dis ke ${issue2.origin ?? "valoro"} havu ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elementojn"}`;
        return `Tro granda: atendi\u011Dis ke ${issue2.origin ?? "valoro"} havu ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Tro malgranda: atendi\u011Dis ke ${issue2.origin} havu ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Tro malgranda: atendi\u011Dis ke ${issue2.origin} estu ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Nevalida karaktraro: devas komenci\u011Di per "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Nevalida karaktraro: devas fini\u011Di per "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Nevalida karaktraro: devas inkluzivi "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Nevalida karaktraro: devas kongrui kun la modelo ${_issue.pattern}`;
        return `Nevalida ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Nevalida nombro: devas esti oblo de ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Nekonata${issue2.keys.length > 1 ? "j" : ""} \u015Dlosilo${issue2.keys.length > 1 ? "j" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Nevalida \u015Dlosilo en ${issue2.origin}`;
      case "invalid_union":
        return "Nevalida enigo";
      case "invalid_element":
        return `Nevalida valoro en ${issue2.origin}`;
      default:
        return `Nevalida enigo`;
    }
  };
};
function eo_default() {
  return {
    localeError: error11()
  };
}

// node_modules/zod/v4/locales/es.js
var error12 = () => {
  const Sizable = {
    string: { unit: "caracteres", verb: "tener" },
    file: { unit: "bytes", verb: "tener" },
    array: { unit: "elementos", verb: "tener" },
    set: { unit: "elementos", verb: "tener" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "entrada",
    email: "direcci\xF3n de correo electr\xF3nico",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "fecha y hora ISO",
    date: "fecha ISO",
    time: "hora ISO",
    duration: "duraci\xF3n ISO",
    ipv4: "direcci\xF3n IPv4",
    ipv6: "direcci\xF3n IPv6",
    cidrv4: "rango IPv4",
    cidrv6: "rango IPv6",
    base64: "cadena codificada en base64",
    base64url: "URL codificada en base64",
    json_string: "cadena JSON",
    e164: "n\xFAmero E.164",
    jwt: "JWT",
    template_literal: "entrada"
  };
  const TypeDictionary = {
    nan: "NaN",
    string: "texto",
    number: "n\xFAmero",
    boolean: "booleano",
    array: "arreglo",
    object: "objeto",
    set: "conjunto",
    file: "archivo",
    date: "fecha",
    bigint: "n\xFAmero grande",
    symbol: "s\xEDmbolo",
    undefined: "indefinido",
    null: "nulo",
    function: "funci\xF3n",
    map: "mapa",
    record: "registro",
    tuple: "tupla",
    enum: "enumeraci\xF3n",
    union: "uni\xF3n",
    literal: "literal",
    promise: "promesa",
    void: "vac\xEDo",
    never: "nunca",
    unknown: "desconocido",
    any: "cualquiera"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Entrada inv\xE1lida: se esperaba instanceof ${issue2.expected}, recibido ${received}`;
        }
        return `Entrada inv\xE1lida: se esperaba ${expected}, recibido ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Entrada inv\xE1lida: se esperaba ${stringifyPrimitive(issue2.values[0])}`;
        return `Opci\xF3n inv\xE1lida: se esperaba una de ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        const origin = TypeDictionary[issue2.origin] ?? issue2.origin;
        if (sizing)
          return `Demasiado grande: se esperaba que ${origin ?? "valor"} tuviera ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elementos"}`;
        return `Demasiado grande: se esperaba que ${origin ?? "valor"} fuera ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        const origin = TypeDictionary[issue2.origin] ?? issue2.origin;
        if (sizing) {
          return `Demasiado peque\xF1o: se esperaba que ${origin} tuviera ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Demasiado peque\xF1o: se esperaba que ${origin} fuera ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Cadena inv\xE1lida: debe comenzar con "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Cadena inv\xE1lida: debe terminar en "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Cadena inv\xE1lida: debe incluir "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Cadena inv\xE1lida: debe coincidir con el patr\xF3n ${_issue.pattern}`;
        return `Inv\xE1lido ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `N\xFAmero inv\xE1lido: debe ser m\xFAltiplo de ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Llave${issue2.keys.length > 1 ? "s" : ""} desconocida${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Llave inv\xE1lida en ${TypeDictionary[issue2.origin] ?? issue2.origin}`;
      case "invalid_union":
        return "Entrada inv\xE1lida";
      case "invalid_element":
        return `Valor inv\xE1lido en ${TypeDictionary[issue2.origin] ?? issue2.origin}`;
      default:
        return `Entrada inv\xE1lida`;
    }
  };
};
function es_default() {
  return {
    localeError: error12()
  };
}

// node_modules/zod/v4/locales/fa.js
var error13 = () => {
  const Sizable = {
    string: { unit: "\u06A9\u0627\u0631\u0627\u06A9\u062A\u0631", verb: "\u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F" },
    file: { unit: "\u0628\u0627\u06CC\u062A", verb: "\u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F" },
    array: { unit: "\u0622\u06CC\u062A\u0645", verb: "\u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F" },
    set: { unit: "\u0622\u06CC\u062A\u0645", verb: "\u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u0648\u0631\u0648\u062F\u06CC",
    email: "\u0622\u062F\u0631\u0633 \u0627\u06CC\u0645\u06CC\u0644",
    url: "URL",
    emoji: "\u0627\u06CC\u0645\u0648\u062C\u06CC",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "\u062A\u0627\u0631\u06CC\u062E \u0648 \u0632\u0645\u0627\u0646 \u0627\u06CC\u0632\u0648",
    date: "\u062A\u0627\u0631\u06CC\u062E \u0627\u06CC\u0632\u0648",
    time: "\u0632\u0645\u0627\u0646 \u0627\u06CC\u0632\u0648",
    duration: "\u0645\u062F\u062A \u0632\u0645\u0627\u0646 \u0627\u06CC\u0632\u0648",
    ipv4: "IPv4 \u0622\u062F\u0631\u0633",
    ipv6: "IPv6 \u0622\u062F\u0631\u0633",
    cidrv4: "IPv4 \u062F\u0627\u0645\u0646\u0647",
    cidrv6: "IPv6 \u062F\u0627\u0645\u0646\u0647",
    base64: "base64-encoded \u0631\u0634\u062A\u0647",
    base64url: "base64url-encoded \u0631\u0634\u062A\u0647",
    json_string: "JSON \u0631\u0634\u062A\u0647",
    e164: "E.164 \u0639\u062F\u062F",
    jwt: "JWT",
    template_literal: "\u0648\u0631\u0648\u062F\u06CC"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "\u0639\u062F\u062F",
    array: "\u0622\u0631\u0627\u06CC\u0647"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0645\u06CC\u200C\u0628\u0627\u06CC\u0633\u062A instanceof ${issue2.expected} \u0645\u06CC\u200C\u0628\u0648\u062F\u060C ${received} \u062F\u0631\u06CC\u0627\u0641\u062A \u0634\u062F`;
        }
        return `\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0645\u06CC\u200C\u0628\u0627\u06CC\u0633\u062A ${expected} \u0645\u06CC\u200C\u0628\u0648\u062F\u060C ${received} \u062F\u0631\u06CC\u0627\u0641\u062A \u0634\u062F`;
      }
      case "invalid_value":
        if (issue2.values.length === 1) {
          return `\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0645\u06CC\u200C\u0628\u0627\u06CC\u0633\u062A ${stringifyPrimitive(issue2.values[0])} \u0645\u06CC\u200C\u0628\u0648\u062F`;
        }
        return `\u06AF\u0632\u06CC\u0646\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0645\u06CC\u200C\u0628\u0627\u06CC\u0633\u062A \u06CC\u06A9\u06CC \u0627\u0632 ${joinValues(issue2.values, "|")} \u0645\u06CC\u200C\u0628\u0648\u062F`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `\u062E\u06CC\u0644\u06CC \u0628\u0632\u0631\u06AF: ${issue2.origin ?? "\u0645\u0642\u062F\u0627\u0631"} \u0628\u0627\u06CC\u062F ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "\u0639\u0646\u0635\u0631"} \u0628\u0627\u0634\u062F`;
        }
        return `\u062E\u06CC\u0644\u06CC \u0628\u0632\u0631\u06AF: ${issue2.origin ?? "\u0645\u0642\u062F\u0627\u0631"} \u0628\u0627\u06CC\u062F ${adj}${issue2.maximum.toString()} \u0628\u0627\u0634\u062F`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `\u062E\u06CC\u0644\u06CC \u06A9\u0648\u0686\u06A9: ${issue2.origin} \u0628\u0627\u06CC\u062F ${adj}${issue2.minimum.toString()} ${sizing.unit} \u0628\u0627\u0634\u062F`;
        }
        return `\u062E\u06CC\u0644\u06CC \u06A9\u0648\u0686\u06A9: ${issue2.origin} \u0628\u0627\u06CC\u062F ${adj}${issue2.minimum.toString()} \u0628\u0627\u0634\u062F`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `\u0631\u0634\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0628\u0627 "${_issue.prefix}" \u0634\u0631\u0648\u0639 \u0634\u0648\u062F`;
        }
        if (_issue.format === "ends_with") {
          return `\u0631\u0634\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0628\u0627 "${_issue.suffix}" \u062A\u0645\u0627\u0645 \u0634\u0648\u062F`;
        }
        if (_issue.format === "includes") {
          return `\u0631\u0634\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0634\u0627\u0645\u0644 "${_issue.includes}" \u0628\u0627\u0634\u062F`;
        }
        if (_issue.format === "regex") {
          return `\u0631\u0634\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0628\u0627 \u0627\u0644\u06AF\u0648\u06CC ${_issue.pattern} \u0645\u0637\u0627\u0628\u0642\u062A \u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F`;
        }
        return `${FormatDictionary[_issue.format] ?? issue2.format} \u0646\u0627\u0645\u0639\u062A\u0628\u0631`;
      }
      case "not_multiple_of":
        return `\u0639\u062F\u062F \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0645\u0636\u0631\u0628 ${issue2.divisor} \u0628\u0627\u0634\u062F`;
      case "unrecognized_keys":
        return `\u06A9\u0644\u06CC\u062F${issue2.keys.length > 1 ? "\u0647\u0627\u06CC" : ""} \u0646\u0627\u0634\u0646\u0627\u0633: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `\u06A9\u0644\u06CC\u062F \u0646\u0627\u0634\u0646\u0627\u0633 \u062F\u0631 ${issue2.origin}`;
      case "invalid_union":
        return `\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631`;
      case "invalid_element":
        return `\u0645\u0642\u062F\u0627\u0631 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u062F\u0631 ${issue2.origin}`;
      default:
        return `\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631`;
    }
  };
};
function fa_default() {
  return {
    localeError: error13()
  };
}

// node_modules/zod/v4/locales/fi.js
var error14 = () => {
  const Sizable = {
    string: { unit: "merkki\xE4", subject: "merkkijonon" },
    file: { unit: "tavua", subject: "tiedoston" },
    array: { unit: "alkiota", subject: "listan" },
    set: { unit: "alkiota", subject: "joukon" },
    number: { unit: "", subject: "luvun" },
    bigint: { unit: "", subject: "suuren kokonaisluvun" },
    int: { unit: "", subject: "kokonaisluvun" },
    date: { unit: "", subject: "p\xE4iv\xE4m\xE4\xE4r\xE4n" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "s\xE4\xE4nn\xF6llinen lauseke",
    email: "s\xE4hk\xF6postiosoite",
    url: "URL-osoite",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO-aikaleima",
    date: "ISO-p\xE4iv\xE4m\xE4\xE4r\xE4",
    time: "ISO-aika",
    duration: "ISO-kesto",
    ipv4: "IPv4-osoite",
    ipv6: "IPv6-osoite",
    cidrv4: "IPv4-alue",
    cidrv6: "IPv6-alue",
    base64: "base64-koodattu merkkijono",
    base64url: "base64url-koodattu merkkijono",
    json_string: "JSON-merkkijono",
    e164: "E.164-luku",
    jwt: "JWT",
    template_literal: "templaattimerkkijono"
  };
  const TypeDictionary = {
    nan: "NaN"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Virheellinen tyyppi: odotettiin instanceof ${issue2.expected}, oli ${received}`;
        }
        return `Virheellinen tyyppi: odotettiin ${expected}, oli ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Virheellinen sy\xF6te: t\xE4ytyy olla ${stringifyPrimitive(issue2.values[0])}`;
        return `Virheellinen valinta: t\xE4ytyy olla yksi seuraavista: ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Liian suuri: ${sizing.subject} t\xE4ytyy olla ${adj}${issue2.maximum.toString()} ${sizing.unit}`.trim();
        }
        return `Liian suuri: arvon t\xE4ytyy olla ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Liian pieni: ${sizing.subject} t\xE4ytyy olla ${adj}${issue2.minimum.toString()} ${sizing.unit}`.trim();
        }
        return `Liian pieni: arvon t\xE4ytyy olla ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Virheellinen sy\xF6te: t\xE4ytyy alkaa "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Virheellinen sy\xF6te: t\xE4ytyy loppua "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Virheellinen sy\xF6te: t\xE4ytyy sis\xE4lt\xE4\xE4 "${_issue.includes}"`;
        if (_issue.format === "regex") {
          return `Virheellinen sy\xF6te: t\xE4ytyy vastata s\xE4\xE4nn\xF6llist\xE4 lauseketta ${_issue.pattern}`;
        }
        return `Virheellinen ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Virheellinen luku: t\xE4ytyy olla luvun ${issue2.divisor} monikerta`;
      case "unrecognized_keys":
        return `${issue2.keys.length > 1 ? "Tuntemattomat avaimet" : "Tuntematon avain"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return "Virheellinen avain tietueessa";
      case "invalid_union":
        return "Virheellinen unioni";
      case "invalid_element":
        return "Virheellinen arvo joukossa";
      default:
        return `Virheellinen sy\xF6te`;
    }
  };
};
function fi_default() {
  return {
    localeError: error14()
  };
}

// node_modules/zod/v4/locales/fr.js
var error15 = () => {
  const Sizable = {
    string: { unit: "caract\xE8res", verb: "avoir" },
    file: { unit: "octets", verb: "avoir" },
    array: { unit: "\xE9l\xE9ments", verb: "avoir" },
    set: { unit: "\xE9l\xE9ments", verb: "avoir" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "entr\xE9e",
    email: "adresse e-mail",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "date et heure ISO",
    date: "date ISO",
    time: "heure ISO",
    duration: "dur\xE9e ISO",
    ipv4: "adresse IPv4",
    ipv6: "adresse IPv6",
    cidrv4: "plage IPv4",
    cidrv6: "plage IPv6",
    base64: "cha\xEEne encod\xE9e en base64",
    base64url: "cha\xEEne encod\xE9e en base64url",
    json_string: "cha\xEEne JSON",
    e164: "num\xE9ro E.164",
    jwt: "JWT",
    template_literal: "entr\xE9e"
  };
  const TypeDictionary = {
    string: "cha\xEEne",
    number: "nombre",
    int: "entier",
    boolean: "bool\xE9en",
    bigint: "grand entier",
    symbol: "symbole",
    undefined: "ind\xE9fini",
    null: "null",
    never: "jamais",
    void: "vide",
    date: "date",
    array: "tableau",
    object: "objet",
    tuple: "tuple",
    record: "enregistrement",
    map: "carte",
    set: "ensemble",
    file: "fichier",
    nonoptional: "non-optionnel",
    nan: "NaN",
    function: "fonction"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Entr\xE9e invalide : instanceof ${issue2.expected} attendu, ${received} re\xE7u`;
        }
        return `Entr\xE9e invalide : ${expected} attendu, ${received} re\xE7u`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Entr\xE9e invalide : ${stringifyPrimitive(issue2.values[0])} attendu`;
        return `Option invalide : une valeur parmi ${joinValues(issue2.values, "|")} attendue`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Trop grand : ${TypeDictionary[issue2.origin] ?? "valeur"} doit ${sizing.verb} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "\xE9l\xE9ment(s)"}`;
        return `Trop grand : ${TypeDictionary[issue2.origin] ?? "valeur"} doit \xEAtre ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Trop petit : ${TypeDictionary[issue2.origin] ?? "valeur"} doit ${sizing.verb} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        return `Trop petit : ${TypeDictionary[issue2.origin] ?? "valeur"} doit \xEAtre ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Cha\xEEne invalide : doit commencer par "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Cha\xEEne invalide : doit se terminer par "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Cha\xEEne invalide : doit inclure "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Cha\xEEne invalide : doit correspondre au mod\xE8le ${_issue.pattern}`;
        return `${FormatDictionary[_issue.format] ?? issue2.format} invalide`;
      }
      case "not_multiple_of":
        return `Nombre invalide : doit \xEAtre un multiple de ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Cl\xE9${issue2.keys.length > 1 ? "s" : ""} non reconnue${issue2.keys.length > 1 ? "s" : ""} : ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Cl\xE9 invalide dans ${issue2.origin}`;
      case "invalid_union":
        return "Entr\xE9e invalide";
      case "invalid_element":
        return `Valeur invalide dans ${issue2.origin}`;
      default:
        return `Entr\xE9e invalide`;
    }
  };
};
function fr_default() {
  return {
    localeError: error15()
  };
}

// node_modules/zod/v4/locales/fr-CA.js
var error16 = () => {
  const Sizable = {
    string: { unit: "caract\xE8res", verb: "avoir" },
    file: { unit: "octets", verb: "avoir" },
    array: { unit: "\xE9l\xE9ments", verb: "avoir" },
    set: { unit: "\xE9l\xE9ments", verb: "avoir" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "entr\xE9e",
    email: "adresse courriel",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "date-heure ISO",
    date: "date ISO",
    time: "heure ISO",
    duration: "dur\xE9e ISO",
    ipv4: "adresse IPv4",
    ipv6: "adresse IPv6",
    cidrv4: "plage IPv4",
    cidrv6: "plage IPv6",
    base64: "cha\xEEne encod\xE9e en base64",
    base64url: "cha\xEEne encod\xE9e en base64url",
    json_string: "cha\xEEne JSON",
    e164: "num\xE9ro E.164",
    jwt: "JWT",
    template_literal: "entr\xE9e"
  };
  const TypeDictionary = {
    nan: "NaN"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Entr\xE9e invalide : attendu instanceof ${issue2.expected}, re\xE7u ${received}`;
        }
        return `Entr\xE9e invalide : attendu ${expected}, re\xE7u ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Entr\xE9e invalide : attendu ${stringifyPrimitive(issue2.values[0])}`;
        return `Option invalide : attendu l'une des valeurs suivantes ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "\u2264" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Trop grand : attendu que ${issue2.origin ?? "la valeur"} ait ${adj}${issue2.maximum.toString()} ${sizing.unit}`;
        return `Trop grand : attendu que ${issue2.origin ?? "la valeur"} soit ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? "\u2265" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Trop petit : attendu que ${issue2.origin} ait ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Trop petit : attendu que ${issue2.origin} soit ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Cha\xEEne invalide : doit commencer par "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Cha\xEEne invalide : doit se terminer par "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Cha\xEEne invalide : doit inclure "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Cha\xEEne invalide : doit correspondre au motif ${_issue.pattern}`;
        return `${FormatDictionary[_issue.format] ?? issue2.format} invalide`;
      }
      case "not_multiple_of":
        return `Nombre invalide : doit \xEAtre un multiple de ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Cl\xE9${issue2.keys.length > 1 ? "s" : ""} non reconnue${issue2.keys.length > 1 ? "s" : ""} : ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Cl\xE9 invalide dans ${issue2.origin}`;
      case "invalid_union":
        return "Entr\xE9e invalide";
      case "invalid_element":
        return `Valeur invalide dans ${issue2.origin}`;
      default:
        return `Entr\xE9e invalide`;
    }
  };
};
function fr_CA_default() {
  return {
    localeError: error16()
  };
}

// node_modules/zod/v4/locales/he.js
var error17 = () => {
  const TypeNames = {
    string: { label: "\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA", gender: "f" },
    number: { label: "\u05DE\u05E1\u05E4\u05E8", gender: "m" },
    boolean: { label: "\u05E2\u05E8\u05DA \u05D1\u05D5\u05DC\u05D9\u05D0\u05E0\u05D9", gender: "m" },
    bigint: { label: "BigInt", gender: "m" },
    date: { label: "\u05EA\u05D0\u05E8\u05D9\u05DA", gender: "m" },
    array: { label: "\u05DE\u05E2\u05E8\u05DA", gender: "m" },
    object: { label: "\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8", gender: "m" },
    null: { label: "\u05E2\u05E8\u05DA \u05E8\u05D9\u05E7 (null)", gender: "m" },
    undefined: { label: "\u05E2\u05E8\u05DA \u05DC\u05D0 \u05DE\u05D5\u05D2\u05D3\u05E8 (undefined)", gender: "m" },
    symbol: { label: "\u05E1\u05D9\u05DE\u05D1\u05D5\u05DC (Symbol)", gender: "m" },
    function: { label: "\u05E4\u05D5\u05E0\u05E7\u05E6\u05D9\u05D4", gender: "f" },
    map: { label: "\u05DE\u05E4\u05D4 (Map)", gender: "f" },
    set: { label: "\u05E7\u05D1\u05D5\u05E6\u05D4 (Set)", gender: "f" },
    file: { label: "\u05E7\u05D5\u05D1\u05E5", gender: "m" },
    promise: { label: "Promise", gender: "m" },
    NaN: { label: "NaN", gender: "m" },
    unknown: { label: "\u05E2\u05E8\u05DA \u05DC\u05D0 \u05D9\u05D3\u05D5\u05E2", gender: "m" },
    value: { label: "\u05E2\u05E8\u05DA", gender: "m" }
  };
  const Sizable = {
    string: { unit: "\u05EA\u05D5\u05D5\u05D9\u05DD", shortLabel: "\u05E7\u05E6\u05E8", longLabel: "\u05D0\u05E8\u05D5\u05DA" },
    file: { unit: "\u05D1\u05D9\u05D9\u05D8\u05D9\u05DD", shortLabel: "\u05E7\u05D8\u05DF", longLabel: "\u05D2\u05D3\u05D5\u05DC" },
    array: { unit: "\u05E4\u05E8\u05D9\u05D8\u05D9\u05DD", shortLabel: "\u05E7\u05D8\u05DF", longLabel: "\u05D2\u05D3\u05D5\u05DC" },
    set: { unit: "\u05E4\u05E8\u05D9\u05D8\u05D9\u05DD", shortLabel: "\u05E7\u05D8\u05DF", longLabel: "\u05D2\u05D3\u05D5\u05DC" },
    number: { unit: "", shortLabel: "\u05E7\u05D8\u05DF", longLabel: "\u05D2\u05D3\u05D5\u05DC" }
    // no unit
  };
  const typeEntry = (t) => t ? TypeNames[t] : void 0;
  const typeLabel = (t) => {
    const e = typeEntry(t);
    if (e)
      return e.label;
    return t ?? TypeNames.unknown.label;
  };
  const withDefinite = (t) => `\u05D4${typeLabel(t)}`;
  const verbFor = (t) => {
    const e = typeEntry(t);
    const gender = e?.gender ?? "m";
    return gender === "f" ? "\u05E6\u05E8\u05D9\u05DB\u05D4 \u05DC\u05D4\u05D9\u05D5\u05EA" : "\u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA";
  };
  const getSizing = (origin) => {
    if (!origin)
      return null;
    return Sizable[origin] ?? null;
  };
  const FormatDictionary = {
    regex: { label: "\u05E7\u05DC\u05D8", gender: "m" },
    email: { label: "\u05DB\u05EA\u05D5\u05D1\u05EA \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC", gender: "f" },
    url: { label: "\u05DB\u05EA\u05D5\u05D1\u05EA \u05E8\u05E9\u05EA", gender: "f" },
    emoji: { label: "\u05D0\u05D9\u05DE\u05D5\u05D2'\u05D9", gender: "m" },
    uuid: { label: "UUID", gender: "m" },
    nanoid: { label: "nanoid", gender: "m" },
    guid: { label: "GUID", gender: "m" },
    cuid: { label: "cuid", gender: "m" },
    cuid2: { label: "cuid2", gender: "m" },
    ulid: { label: "ULID", gender: "m" },
    xid: { label: "XID", gender: "m" },
    ksuid: { label: "KSUID", gender: "m" },
    datetime: { label: "\u05EA\u05D0\u05E8\u05D9\u05DA \u05D5\u05D6\u05DE\u05DF ISO", gender: "m" },
    date: { label: "\u05EA\u05D0\u05E8\u05D9\u05DA ISO", gender: "m" },
    time: { label: "\u05D6\u05DE\u05DF ISO", gender: "m" },
    duration: { label: "\u05DE\u05E9\u05DA \u05D6\u05DE\u05DF ISO", gender: "m" },
    ipv4: { label: "\u05DB\u05EA\u05D5\u05D1\u05EA IPv4", gender: "f" },
    ipv6: { label: "\u05DB\u05EA\u05D5\u05D1\u05EA IPv6", gender: "f" },
    cidrv4: { label: "\u05D8\u05D5\u05D5\u05D7 IPv4", gender: "m" },
    cidrv6: { label: "\u05D8\u05D5\u05D5\u05D7 IPv6", gender: "m" },
    base64: { label: "\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D1\u05D1\u05E1\u05D9\u05E1 64", gender: "f" },
    base64url: { label: "\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D1\u05D1\u05E1\u05D9\u05E1 64 \u05DC\u05DB\u05EA\u05D5\u05D1\u05D5\u05EA \u05E8\u05E9\u05EA", gender: "f" },
    json_string: { label: "\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA JSON", gender: "f" },
    e164: { label: "\u05DE\u05E1\u05E4\u05E8 E.164", gender: "m" },
    jwt: { label: "JWT", gender: "m" },
    ends_with: { label: "\u05E7\u05DC\u05D8", gender: "m" },
    includes: { label: "\u05E7\u05DC\u05D8", gender: "m" },
    lowercase: { label: "\u05E7\u05DC\u05D8", gender: "m" },
    starts_with: { label: "\u05E7\u05DC\u05D8", gender: "m" },
    uppercase: { label: "\u05E7\u05DC\u05D8", gender: "m" }
  };
  const TypeDictionary = {
    nan: "NaN"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expectedKey = issue2.expected;
        const expected = TypeDictionary[expectedKey ?? ""] ?? typeLabel(expectedKey);
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? TypeNames[receivedType]?.label ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA instanceof ${issue2.expected}, \u05D4\u05EA\u05E7\u05D1\u05DC ${received}`;
        }
        return `\u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA ${expected}, \u05D4\u05EA\u05E7\u05D1\u05DC ${received}`;
      }
      case "invalid_value": {
        if (issue2.values.length === 1) {
          return `\u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05D4\u05E2\u05E8\u05DA \u05D7\u05D9\u05D9\u05D1 \u05DC\u05D4\u05D9\u05D5\u05EA ${stringifyPrimitive(issue2.values[0])}`;
        }
        const stringified = issue2.values.map((v) => stringifyPrimitive(v));
        if (issue2.values.length === 2) {
          return `\u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05D4\u05D0\u05E4\u05E9\u05E8\u05D5\u05D9\u05D5\u05EA \u05D4\u05DE\u05EA\u05D0\u05D9\u05DE\u05D5\u05EA \u05D4\u05DF ${stringified[0]} \u05D0\u05D5 ${stringified[1]}`;
        }
        const lastValue = stringified[stringified.length - 1];
        const restValues = stringified.slice(0, -1).join(", ");
        return `\u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05D4\u05D0\u05E4\u05E9\u05E8\u05D5\u05D9\u05D5\u05EA \u05D4\u05DE\u05EA\u05D0\u05D9\u05DE\u05D5\u05EA \u05D4\u05DF ${restValues} \u05D0\u05D5 ${lastValue}`;
      }
      case "too_big": {
        const sizing = getSizing(issue2.origin);
        const subject = withDefinite(issue2.origin ?? "value");
        if (issue2.origin === "string") {
          return `${sizing?.longLabel ?? "\u05D0\u05E8\u05D5\u05DA"} \u05DE\u05D3\u05D9: ${subject} \u05E6\u05E8\u05D9\u05DB\u05D4 \u05DC\u05D4\u05DB\u05D9\u05DC ${issue2.maximum.toString()} ${sizing?.unit ?? ""} ${issue2.inclusive ? "\u05D0\u05D5 \u05E4\u05D7\u05D5\u05EA" : "\u05DC\u05DB\u05DC \u05D4\u05D9\u05D5\u05EA\u05E8"}`.trim();
        }
        if (issue2.origin === "number") {
          const comparison = issue2.inclusive ? `\u05E7\u05D8\u05DF \u05D0\u05D5 \u05E9\u05D5\u05D5\u05D4 \u05DC-${issue2.maximum}` : `\u05E7\u05D8\u05DF \u05DE-${issue2.maximum}`;
          return `\u05D2\u05D3\u05D5\u05DC \u05DE\u05D3\u05D9: ${subject} \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA ${comparison}`;
        }
        if (issue2.origin === "array" || issue2.origin === "set") {
          const verb = issue2.origin === "set" ? "\u05E6\u05E8\u05D9\u05DB\u05D4" : "\u05E6\u05E8\u05D9\u05DA";
          const comparison = issue2.inclusive ? `${issue2.maximum} ${sizing?.unit ?? ""} \u05D0\u05D5 \u05E4\u05D7\u05D5\u05EA` : `\u05E4\u05D7\u05D5\u05EA \u05DE-${issue2.maximum} ${sizing?.unit ?? ""}`;
          return `\u05D2\u05D3\u05D5\u05DC \u05DE\u05D3\u05D9: ${subject} ${verb} \u05DC\u05D4\u05DB\u05D9\u05DC ${comparison}`.trim();
        }
        const adj = issue2.inclusive ? "<=" : "<";
        const be = verbFor(issue2.origin ?? "value");
        if (sizing?.unit) {
          return `${sizing.longLabel} \u05DE\u05D3\u05D9: ${subject} ${be} ${adj}${issue2.maximum.toString()} ${sizing.unit}`;
        }
        return `${sizing?.longLabel ?? "\u05D2\u05D3\u05D5\u05DC"} \u05DE\u05D3\u05D9: ${subject} ${be} ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const sizing = getSizing(issue2.origin);
        const subject = withDefinite(issue2.origin ?? "value");
        if (issue2.origin === "string") {
          return `${sizing?.shortLabel ?? "\u05E7\u05E6\u05E8"} \u05DE\u05D3\u05D9: ${subject} \u05E6\u05E8\u05D9\u05DB\u05D4 \u05DC\u05D4\u05DB\u05D9\u05DC ${issue2.minimum.toString()} ${sizing?.unit ?? ""} ${issue2.inclusive ? "\u05D0\u05D5 \u05D9\u05D5\u05EA\u05E8" : "\u05DC\u05E4\u05D7\u05D5\u05EA"}`.trim();
        }
        if (issue2.origin === "number") {
          const comparison = issue2.inclusive ? `\u05D2\u05D3\u05D5\u05DC \u05D0\u05D5 \u05E9\u05D5\u05D5\u05D4 \u05DC-${issue2.minimum}` : `\u05D2\u05D3\u05D5\u05DC \u05DE-${issue2.minimum}`;
          return `\u05E7\u05D8\u05DF \u05DE\u05D3\u05D9: ${subject} \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA ${comparison}`;
        }
        if (issue2.origin === "array" || issue2.origin === "set") {
          const verb = issue2.origin === "set" ? "\u05E6\u05E8\u05D9\u05DB\u05D4" : "\u05E6\u05E8\u05D9\u05DA";
          if (issue2.minimum === 1 && issue2.inclusive) {
            const singularPhrase = issue2.origin === "set" ? "\u05DC\u05E4\u05D7\u05D5\u05EA \u05E4\u05E8\u05D9\u05D8 \u05D0\u05D7\u05D3" : "\u05DC\u05E4\u05D7\u05D5\u05EA \u05E4\u05E8\u05D9\u05D8 \u05D0\u05D7\u05D3";
            return `\u05E7\u05D8\u05DF \u05DE\u05D3\u05D9: ${subject} ${verb} \u05DC\u05D4\u05DB\u05D9\u05DC ${singularPhrase}`;
          }
          const comparison = issue2.inclusive ? `${issue2.minimum} ${sizing?.unit ?? ""} \u05D0\u05D5 \u05D9\u05D5\u05EA\u05E8` : `\u05D9\u05D5\u05EA\u05E8 \u05DE-${issue2.minimum} ${sizing?.unit ?? ""}`;
          return `\u05E7\u05D8\u05DF \u05DE\u05D3\u05D9: ${subject} ${verb} \u05DC\u05D4\u05DB\u05D9\u05DC ${comparison}`.trim();
        }
        const adj = issue2.inclusive ? ">=" : ">";
        const be = verbFor(issue2.origin ?? "value");
        if (sizing?.unit) {
          return `${sizing.shortLabel} \u05DE\u05D3\u05D9: ${subject} ${be} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `${sizing?.shortLabel ?? "\u05E7\u05D8\u05DF"} \u05DE\u05D3\u05D9: ${subject} ${be} ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `\u05D4\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC \u05D1 "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `\u05D4\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05D4\u05E1\u05EA\u05D9\u05D9\u05DD \u05D1 "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `\u05D4\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05DB\u05DC\u05D5\u05DC "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `\u05D4\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05D4\u05EA\u05D0\u05D9\u05DD \u05DC\u05EA\u05D1\u05E0\u05D9\u05EA ${_issue.pattern}`;
        const nounEntry = FormatDictionary[_issue.format];
        const noun = nounEntry?.label ?? _issue.format;
        const gender = nounEntry?.gender ?? "m";
        const adjective = gender === "f" ? "\u05EA\u05E7\u05D9\u05E0\u05D4" : "\u05EA\u05E7\u05D9\u05DF";
        return `${noun} \u05DC\u05D0 ${adjective}`;
      }
      case "not_multiple_of":
        return `\u05DE\u05E1\u05E4\u05E8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05D7\u05D9\u05D9\u05D1 \u05DC\u05D4\u05D9\u05D5\u05EA \u05DE\u05DB\u05E4\u05DC\u05D4 \u05E9\u05DC ${issue2.divisor}`;
      case "unrecognized_keys":
        return `\u05DE\u05E4\u05EA\u05D7${issue2.keys.length > 1 ? "\u05D5\u05EA" : ""} \u05DC\u05D0 \u05DE\u05D6\u05D5\u05D4${issue2.keys.length > 1 ? "\u05D9\u05DD" : "\u05D4"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key": {
        return `\u05E9\u05D3\u05D4 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF \u05D1\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8`;
      }
      case "invalid_union":
        return "\u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF";
      case "invalid_element": {
        const place = withDefinite(issue2.origin ?? "array");
        return `\u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF \u05D1${place}`;
      }
      default:
        return `\u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF`;
    }
  };
};
function he_default() {
  return {
    localeError: error17()
  };
}

// node_modules/zod/v4/locales/hr.js
var error18 = () => {
  const Sizable = {
    string: { unit: "znakova", verb: "imati" },
    file: { unit: "bajtova", verb: "imati" },
    array: { unit: "stavki", verb: "imati" },
    set: { unit: "stavki", verb: "imati" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "unos",
    email: "email adresa",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO datum i vrijeme",
    date: "ISO datum",
    time: "ISO vrijeme",
    duration: "ISO trajanje",
    ipv4: "IPv4 adresa",
    ipv6: "IPv6 adresa",
    cidrv4: "IPv4 raspon",
    cidrv6: "IPv6 raspon",
    base64: "base64 kodirani tekst",
    base64url: "base64url kodirani tekst",
    json_string: "JSON tekst",
    e164: "E.164 broj",
    jwt: "JWT",
    template_literal: "unos"
  };
  const TypeDictionary = {
    nan: "NaN",
    string: "tekst",
    number: "broj",
    boolean: "boolean",
    array: "niz",
    object: "objekt",
    set: "skup",
    file: "datoteka",
    date: "datum",
    bigint: "bigint",
    symbol: "simbol",
    undefined: "undefined",
    null: "null",
    function: "funkcija",
    map: "mapa"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Neispravan unos: o\u010Dekuje se instanceof ${issue2.expected}, a primljeno je ${received}`;
        }
        return `Neispravan unos: o\u010Dekuje se ${expected}, a primljeno je ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Neispravna vrijednost: o\u010Dekivano ${stringifyPrimitive(issue2.values[0])}`;
        return `Neispravna opcija: o\u010Dekivano jedno od ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        const origin = TypeDictionary[issue2.origin] ?? issue2.origin;
        if (sizing)
          return `Preveliko: o\u010Dekivano da ${origin ?? "vrijednost"} ima ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elemenata"}`;
        return `Preveliko: o\u010Dekivano da ${origin ?? "vrijednost"} bude ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        const origin = TypeDictionary[issue2.origin] ?? issue2.origin;
        if (sizing) {
          return `Premalo: o\u010Dekivano da ${origin} ima ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Premalo: o\u010Dekivano da ${origin} bude ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Neispravan tekst: mora zapo\u010Dinjati s "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Neispravan tekst: mora zavr\u0161avati s "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Neispravan tekst: mora sadr\u017Eavati "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Neispravan tekst: mora odgovarati uzorku ${_issue.pattern}`;
        return `Neispravna ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Neispravan broj: mora biti vi\u0161ekratnik od ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Neprepoznat${issue2.keys.length > 1 ? "i klju\u010Devi" : " klju\u010D"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Neispravan klju\u010D u ${TypeDictionary[issue2.origin] ?? issue2.origin}`;
      case "invalid_union":
        return "Neispravan unos";
      case "invalid_element":
        return `Neispravna vrijednost u ${TypeDictionary[issue2.origin] ?? issue2.origin}`;
      default:
        return `Neispravan unos`;
    }
  };
};
function hr_default() {
  return {
    localeError: error18()
  };
}

// node_modules/zod/v4/locales/hu.js
var error19 = () => {
  const Sizable = {
    string: { unit: "karakter", verb: "legyen" },
    file: { unit: "byte", verb: "legyen" },
    array: { unit: "elem", verb: "legyen" },
    set: { unit: "elem", verb: "legyen" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "bemenet",
    email: "email c\xEDm",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO id\u0151b\xE9lyeg",
    date: "ISO d\xE1tum",
    time: "ISO id\u0151",
    duration: "ISO id\u0151intervallum",
    ipv4: "IPv4 c\xEDm",
    ipv6: "IPv6 c\xEDm",
    cidrv4: "IPv4 tartom\xE1ny",
    cidrv6: "IPv6 tartom\xE1ny",
    base64: "base64-k\xF3dolt string",
    base64url: "base64url-k\xF3dolt string",
    json_string: "JSON string",
    e164: "E.164 sz\xE1m",
    jwt: "JWT",
    template_literal: "bemenet"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "sz\xE1m",
    array: "t\xF6mb"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\xC9rv\xE9nytelen bemenet: a v\xE1rt \xE9rt\xE9k instanceof ${issue2.expected}, a kapott \xE9rt\xE9k ${received}`;
        }
        return `\xC9rv\xE9nytelen bemenet: a v\xE1rt \xE9rt\xE9k ${expected}, a kapott \xE9rt\xE9k ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\xC9rv\xE9nytelen bemenet: a v\xE1rt \xE9rt\xE9k ${stringifyPrimitive(issue2.values[0])}`;
        return `\xC9rv\xE9nytelen opci\xF3: valamelyik \xE9rt\xE9k v\xE1rt ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `T\xFAl nagy: ${issue2.origin ?? "\xE9rt\xE9k"} m\xE9rete t\xFAl nagy ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elem"}`;
        return `T\xFAl nagy: a bemeneti \xE9rt\xE9k ${issue2.origin ?? "\xE9rt\xE9k"} t\xFAl nagy: ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `T\xFAl kicsi: a bemeneti \xE9rt\xE9k ${issue2.origin} m\xE9rete t\xFAl kicsi ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `T\xFAl kicsi: a bemeneti \xE9rt\xE9k ${issue2.origin} t\xFAl kicsi ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `\xC9rv\xE9nytelen string: "${_issue.prefix}" \xE9rt\xE9kkel kell kezd\u0151dnie`;
        if (_issue.format === "ends_with")
          return `\xC9rv\xE9nytelen string: "${_issue.suffix}" \xE9rt\xE9kkel kell v\xE9gz\u0151dnie`;
        if (_issue.format === "includes")
          return `\xC9rv\xE9nytelen string: "${_issue.includes}" \xE9rt\xE9ket kell tartalmaznia`;
        if (_issue.format === "regex")
          return `\xC9rv\xE9nytelen string: ${_issue.pattern} mint\xE1nak kell megfelelnie`;
        return `\xC9rv\xE9nytelen ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `\xC9rv\xE9nytelen sz\xE1m: ${issue2.divisor} t\xF6bbsz\xF6r\xF6s\xE9nek kell lennie`;
      case "unrecognized_keys":
        return `Ismeretlen kulcs${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `\xC9rv\xE9nytelen kulcs ${issue2.origin}`;
      case "invalid_union":
        return "\xC9rv\xE9nytelen bemenet";
      case "invalid_element":
        return `\xC9rv\xE9nytelen \xE9rt\xE9k: ${issue2.origin}`;
      default:
        return `\xC9rv\xE9nytelen bemenet`;
    }
  };
};
function hu_default() {
  return {
    localeError: error19()
  };
}

// node_modules/zod/v4/locales/hy.js
function getArmenianPlural(count, one, many) {
  return Math.abs(count) === 1 ? one : many;
}
function withDefiniteArticle(word) {
  if (!word)
    return "";
  const vowels = ["\u0561", "\u0565", "\u0568", "\u056B", "\u0578", "\u0578\u0582", "\u0585"];
  const lastChar = word[word.length - 1];
  return word + (vowels.includes(lastChar) ? "\u0576" : "\u0568");
}
var error20 = () => {
  const Sizable = {
    string: {
      unit: {
        one: "\u0576\u0577\u0561\u0576",
        many: "\u0576\u0577\u0561\u0576\u0576\u0565\u0580"
      },
      verb: "\u0578\u0582\u0576\u0565\u0576\u0561\u056C"
    },
    file: {
      unit: {
        one: "\u0562\u0561\u0575\u0569",
        many: "\u0562\u0561\u0575\u0569\u0565\u0580"
      },
      verb: "\u0578\u0582\u0576\u0565\u0576\u0561\u056C"
    },
    array: {
      unit: {
        one: "\u057F\u0561\u0580\u0580",
        many: "\u057F\u0561\u0580\u0580\u0565\u0580"
      },
      verb: "\u0578\u0582\u0576\u0565\u0576\u0561\u056C"
    },
    set: {
      unit: {
        one: "\u057F\u0561\u0580\u0580",
        many: "\u057F\u0561\u0580\u0580\u0565\u0580"
      },
      verb: "\u0578\u0582\u0576\u0565\u0576\u0561\u056C"
    }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u0574\u0578\u0582\u057F\u0584",
    email: "\u0567\u056C. \u0570\u0561\u057D\u0581\u0565",
    url: "URL",
    emoji: "\u0567\u0574\u0578\u057B\u056B",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO \u0561\u0574\u057D\u0561\u0569\u056B\u057E \u0587 \u056A\u0561\u0574",
    date: "ISO \u0561\u0574\u057D\u0561\u0569\u056B\u057E",
    time: "ISO \u056A\u0561\u0574",
    duration: "ISO \u057F\u0587\u0578\u0572\u0578\u0582\u0569\u0575\u0578\u0582\u0576",
    ipv4: "IPv4 \u0570\u0561\u057D\u0581\u0565",
    ipv6: "IPv6 \u0570\u0561\u057D\u0581\u0565",
    cidrv4: "IPv4 \u0574\u056B\u057B\u0561\u056F\u0561\u0575\u0584",
    cidrv6: "IPv6 \u0574\u056B\u057B\u0561\u056F\u0561\u0575\u0584",
    base64: "base64 \u0571\u0587\u0561\u0579\u0561\u0583\u0578\u057E \u057F\u0578\u0572",
    base64url: "base64url \u0571\u0587\u0561\u0579\u0561\u0583\u0578\u057E \u057F\u0578\u0572",
    json_string: "JSON \u057F\u0578\u0572",
    e164: "E.164 \u0570\u0561\u0574\u0561\u0580",
    jwt: "JWT",
    template_literal: "\u0574\u0578\u0582\u057F\u0584"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "\u0569\u056B\u057E",
    array: "\u0566\u0561\u0576\u0563\u057E\u0561\u056E"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567\u0580 instanceof ${issue2.expected}, \u057D\u057F\u0561\u0581\u057E\u0565\u056C \u0567 ${received}`;
        }
        return `\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567\u0580 ${expected}, \u057D\u057F\u0561\u0581\u057E\u0565\u056C \u0567 ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567\u0580 ${stringifyPrimitive(issue2.values[1])}`;
        return `\u054D\u056D\u0561\u056C \u057F\u0561\u0580\u0562\u0565\u0580\u0561\u056F\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567\u0580 \u0570\u0565\u057F\u0587\u0575\u0561\u056C\u0576\u0565\u0580\u056B\u0581 \u0574\u0565\u056F\u0568\u055D ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          const maxValue = Number(issue2.maximum);
          const unit = getArmenianPlural(maxValue, sizing.unit.one, sizing.unit.many);
          return `\u0549\u0561\u0583\u0561\u0566\u0561\u0576\u0581 \u0574\u0565\u056E \u0561\u0580\u056A\u0565\u0584\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567, \u0578\u0580 ${withDefiniteArticle(issue2.origin ?? "\u0561\u0580\u056A\u0565\u0584")} \u056F\u0578\u0582\u0576\u0565\u0576\u0561 ${adj}${issue2.maximum.toString()} ${unit}`;
        }
        return `\u0549\u0561\u0583\u0561\u0566\u0561\u0576\u0581 \u0574\u0565\u056E \u0561\u0580\u056A\u0565\u0584\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567, \u0578\u0580 ${withDefiniteArticle(issue2.origin ?? "\u0561\u0580\u056A\u0565\u0584")} \u056C\u056B\u0576\u056B ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          const minValue = Number(issue2.minimum);
          const unit = getArmenianPlural(minValue, sizing.unit.one, sizing.unit.many);
          return `\u0549\u0561\u0583\u0561\u0566\u0561\u0576\u0581 \u0583\u0578\u0584\u0580 \u0561\u0580\u056A\u0565\u0584\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567, \u0578\u0580 ${withDefiniteArticle(issue2.origin)} \u056F\u0578\u0582\u0576\u0565\u0576\u0561 ${adj}${issue2.minimum.toString()} ${unit}`;
        }
        return `\u0549\u0561\u0583\u0561\u0566\u0561\u0576\u0581 \u0583\u0578\u0584\u0580 \u0561\u0580\u056A\u0565\u0584\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567, \u0578\u0580 ${withDefiniteArticle(issue2.origin)} \u056C\u056B\u0576\u056B ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `\u054D\u056D\u0561\u056C \u057F\u0578\u0572\u2024 \u057A\u0565\u057F\u0584 \u0567 \u057D\u056F\u057D\u057E\u056B "${_issue.prefix}"-\u0578\u057E`;
        if (_issue.format === "ends_with")
          return `\u054D\u056D\u0561\u056C \u057F\u0578\u0572\u2024 \u057A\u0565\u057F\u0584 \u0567 \u0561\u057E\u0561\u0580\u057F\u057E\u056B "${_issue.suffix}"-\u0578\u057E`;
        if (_issue.format === "includes")
          return `\u054D\u056D\u0561\u056C \u057F\u0578\u0572\u2024 \u057A\u0565\u057F\u0584 \u0567 \u057A\u0561\u0580\u0578\u0582\u0576\u0561\u056F\u056B "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `\u054D\u056D\u0561\u056C \u057F\u0578\u0572\u2024 \u057A\u0565\u057F\u0584 \u0567 \u0570\u0561\u0574\u0561\u057A\u0561\u057F\u0561\u057D\u056D\u0561\u0576\u056B ${_issue.pattern} \u0571\u0587\u0561\u0579\u0561\u0583\u056B\u0576`;
        return `\u054D\u056D\u0561\u056C ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `\u054D\u056D\u0561\u056C \u0569\u056B\u057E\u2024 \u057A\u0565\u057F\u0584 \u0567 \u0562\u0561\u0566\u0574\u0561\u057A\u0561\u057F\u056B\u056F \u056C\u056B\u0576\u056B ${issue2.divisor}-\u056B`;
      case "unrecognized_keys":
        return `\u0549\u0573\u0561\u0576\u0561\u0579\u057E\u0561\u056E \u0562\u0561\u0576\u0561\u056C\u056B${issue2.keys.length > 1 ? "\u0576\u0565\u0580" : ""}. ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `\u054D\u056D\u0561\u056C \u0562\u0561\u0576\u0561\u056C\u056B ${withDefiniteArticle(issue2.origin)}-\u0578\u0582\u0574`;
      case "invalid_union":
        return "\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574";
      case "invalid_element":
        return `\u054D\u056D\u0561\u056C \u0561\u0580\u056A\u0565\u0584 ${withDefiniteArticle(issue2.origin)}-\u0578\u0582\u0574`;
      default:
        return `\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574`;
    }
  };
};
function hy_default() {
  return {
    localeError: error20()
  };
}

// node_modules/zod/v4/locales/id.js
var error21 = () => {
  const Sizable = {
    string: { unit: "karakter", verb: "memiliki" },
    file: { unit: "byte", verb: "memiliki" },
    array: { unit: "item", verb: "memiliki" },
    set: { unit: "item", verb: "memiliki" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "input",
    email: "alamat email",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "tanggal dan waktu format ISO",
    date: "tanggal format ISO",
    time: "jam format ISO",
    duration: "durasi format ISO",
    ipv4: "alamat IPv4",
    ipv6: "alamat IPv6",
    cidrv4: "rentang alamat IPv4",
    cidrv6: "rentang alamat IPv6",
    base64: "string dengan enkode base64",
    base64url: "string dengan enkode base64url",
    json_string: "string JSON",
    e164: "angka E.164",
    jwt: "JWT",
    template_literal: "input"
  };
  const TypeDictionary = {
    nan: "NaN"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Input tidak valid: diharapkan instanceof ${issue2.expected}, diterima ${received}`;
        }
        return `Input tidak valid: diharapkan ${expected}, diterima ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Input tidak valid: diharapkan ${stringifyPrimitive(issue2.values[0])}`;
        return `Pilihan tidak valid: diharapkan salah satu dari ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Terlalu besar: diharapkan ${issue2.origin ?? "value"} memiliki ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elemen"}`;
        return `Terlalu besar: diharapkan ${issue2.origin ?? "value"} menjadi ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Terlalu kecil: diharapkan ${issue2.origin} memiliki ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Terlalu kecil: diharapkan ${issue2.origin} menjadi ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `String tidak valid: harus dimulai dengan "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `String tidak valid: harus berakhir dengan "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `String tidak valid: harus menyertakan "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `String tidak valid: harus sesuai pola ${_issue.pattern}`;
        return `${FormatDictionary[_issue.format] ?? issue2.format} tidak valid`;
      }
      case "not_multiple_of":
        return `Angka tidak valid: harus kelipatan dari ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Kunci tidak dikenali ${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Kunci tidak valid di ${issue2.origin}`;
      case "invalid_union":
        return "Input tidak valid";
      case "invalid_element":
        return `Nilai tidak valid di ${issue2.origin}`;
      default:
        return `Input tidak valid`;
    }
  };
};
function id_default() {
  return {
    localeError: error21()
  };
}

// node_modules/zod/v4/locales/is.js
var error22 = () => {
  const Sizable = {
    string: { unit: "stafi", verb: "a\xF0 hafa" },
    file: { unit: "b\xE6ti", verb: "a\xF0 hafa" },
    array: { unit: "hluti", verb: "a\xF0 hafa" },
    set: { unit: "hluti", verb: "a\xF0 hafa" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "gildi",
    email: "netfang",
    url: "vefsl\xF3\xF0",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO dagsetning og t\xEDmi",
    date: "ISO dagsetning",
    time: "ISO t\xEDmi",
    duration: "ISO t\xEDmalengd",
    ipv4: "IPv4 address",
    ipv6: "IPv6 address",
    cidrv4: "IPv4 range",
    cidrv6: "IPv6 range",
    base64: "base64-encoded strengur",
    base64url: "base64url-encoded strengur",
    json_string: "JSON strengur",
    e164: "E.164 t\xF6lugildi",
    jwt: "JWT",
    template_literal: "gildi"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "n\xFAmer",
    array: "fylki"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Rangt gildi: \xDE\xFA sl\xF3st inn ${received} \xFEar sem \xE1 a\xF0 vera instanceof ${issue2.expected}`;
        }
        return `Rangt gildi: \xDE\xFA sl\xF3st inn ${received} \xFEar sem \xE1 a\xF0 vera ${expected}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Rangt gildi: gert r\xE1\xF0 fyrir ${stringifyPrimitive(issue2.values[0])}`;
        return `\xD3gilt val: m\xE1 vera eitt af eftirfarandi ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Of st\xF3rt: gert er r\xE1\xF0 fyrir a\xF0 ${issue2.origin ?? "gildi"} hafi ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "hluti"}`;
        return `Of st\xF3rt: gert er r\xE1\xF0 fyrir a\xF0 ${issue2.origin ?? "gildi"} s\xE9 ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Of l\xEDti\xF0: gert er r\xE1\xF0 fyrir a\xF0 ${issue2.origin} hafi ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Of l\xEDti\xF0: gert er r\xE1\xF0 fyrir a\xF0 ${issue2.origin} s\xE9 ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `\xD3gildur strengur: ver\xF0ur a\xF0 byrja \xE1 "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `\xD3gildur strengur: ver\xF0ur a\xF0 enda \xE1 "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `\xD3gildur strengur: ver\xF0ur a\xF0 innihalda "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `\xD3gildur strengur: ver\xF0ur a\xF0 fylgja mynstri ${_issue.pattern}`;
        return `Rangt ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `R\xF6ng tala: ver\xF0ur a\xF0 vera margfeldi af ${issue2.divisor}`;
      case "unrecognized_keys":
        return `\xD3\xFEekkt ${issue2.keys.length > 1 ? "ir lyklar" : "ur lykill"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Rangur lykill \xED ${issue2.origin}`;
      case "invalid_union":
        return "Rangt gildi";
      case "invalid_element":
        return `Rangt gildi \xED ${issue2.origin}`;
      default:
        return `Rangt gildi`;
    }
  };
};
function is_default() {
  return {
    localeError: error22()
  };
}

// node_modules/zod/v4/locales/it.js
var error23 = () => {
  const Sizable = {
    string: { unit: "caratteri", verb: "avere" },
    file: { unit: "byte", verb: "avere" },
    array: { unit: "elementi", verb: "avere" },
    set: { unit: "elementi", verb: "avere" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "input",
    email: "indirizzo email",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "data e ora ISO",
    date: "data ISO",
    time: "ora ISO",
    duration: "durata ISO",
    ipv4: "indirizzo IPv4",
    ipv6: "indirizzo IPv6",
    cidrv4: "intervallo IPv4",
    cidrv6: "intervallo IPv6",
    base64: "stringa codificata in base64",
    base64url: "URL codificata in base64",
    json_string: "stringa JSON",
    e164: "numero E.164",
    jwt: "JWT",
    template_literal: "input"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "numero",
    array: "vettore"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Input non valido: atteso instanceof ${issue2.expected}, ricevuto ${received}`;
        }
        return `Input non valido: atteso ${expected}, ricevuto ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Input non valido: atteso ${stringifyPrimitive(issue2.values[0])}`;
        return `Opzione non valida: atteso uno tra ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Troppo grande: ${issue2.origin ?? "valore"} deve avere ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elementi"}`;
        return `Troppo grande: ${issue2.origin ?? "valore"} deve essere ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Troppo piccolo: ${issue2.origin} deve avere ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Troppo piccolo: ${issue2.origin} deve essere ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Stringa non valida: deve iniziare con "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Stringa non valida: deve terminare con "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Stringa non valida: deve includere "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Stringa non valida: deve corrispondere al pattern ${_issue.pattern}`;
        return `Input non valido: ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Numero non valido: deve essere un multiplo di ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Chiav${issue2.keys.length > 1 ? "i" : "e"} non riconosciut${issue2.keys.length > 1 ? "e" : "a"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Chiave non valida in ${issue2.origin}`;
      case "invalid_union":
        return "Input non valido";
      case "invalid_element":
        return `Valore non valido in ${issue2.origin}`;
      default:
        return `Input non valido`;
    }
  };
};
function it_default() {
  return {
    localeError: error23()
  };
}

// node_modules/zod/v4/locales/ja.js
var error24 = () => {
  const Sizable = {
    string: { unit: "\u6587\u5B57", verb: "\u3067\u3042\u308B" },
    file: { unit: "\u30D0\u30A4\u30C8", verb: "\u3067\u3042\u308B" },
    array: { unit: "\u8981\u7D20", verb: "\u3067\u3042\u308B" },
    set: { unit: "\u8981\u7D20", verb: "\u3067\u3042\u308B" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u5165\u529B\u5024",
    email: "\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9",
    url: "URL",
    emoji: "\u7D75\u6587\u5B57",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO\u65E5\u6642",
    date: "ISO\u65E5\u4ED8",
    time: "ISO\u6642\u523B",
    duration: "ISO\u671F\u9593",
    ipv4: "IPv4\u30A2\u30C9\u30EC\u30B9",
    ipv6: "IPv6\u30A2\u30C9\u30EC\u30B9",
    cidrv4: "IPv4\u7BC4\u56F2",
    cidrv6: "IPv6\u7BC4\u56F2",
    base64: "base64\u30A8\u30F3\u30B3\u30FC\u30C9\u6587\u5B57\u5217",
    base64url: "base64url\u30A8\u30F3\u30B3\u30FC\u30C9\u6587\u5B57\u5217",
    json_string: "JSON\u6587\u5B57\u5217",
    e164: "E.164\u756A\u53F7",
    jwt: "JWT",
    template_literal: "\u5165\u529B\u5024"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "\u6570\u5024",
    array: "\u914D\u5217"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u7121\u52B9\u306A\u5165\u529B: instanceof ${issue2.expected}\u304C\u671F\u5F85\u3055\u308C\u307E\u3057\u305F\u304C\u3001${received}\u304C\u5165\u529B\u3055\u308C\u307E\u3057\u305F`;
        }
        return `\u7121\u52B9\u306A\u5165\u529B: ${expected}\u304C\u671F\u5F85\u3055\u308C\u307E\u3057\u305F\u304C\u3001${received}\u304C\u5165\u529B\u3055\u308C\u307E\u3057\u305F`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\u7121\u52B9\u306A\u5165\u529B: ${stringifyPrimitive(issue2.values[0])}\u304C\u671F\u5F85\u3055\u308C\u307E\u3057\u305F`;
        return `\u7121\u52B9\u306A\u9078\u629E: ${joinValues(issue2.values, "\u3001")}\u306E\u3044\u305A\u308C\u304B\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
      case "too_big": {
        const adj = issue2.inclusive ? "\u4EE5\u4E0B\u3067\u3042\u308B" : "\u3088\u308A\u5C0F\u3055\u3044";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `\u5927\u304D\u3059\u304E\u308B\u5024: ${issue2.origin ?? "\u5024"}\u306F${issue2.maximum.toString()}${sizing.unit ?? "\u8981\u7D20"}${adj}\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        return `\u5927\u304D\u3059\u304E\u308B\u5024: ${issue2.origin ?? "\u5024"}\u306F${issue2.maximum.toString()}${adj}\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? "\u4EE5\u4E0A\u3067\u3042\u308B" : "\u3088\u308A\u5927\u304D\u3044";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `\u5C0F\u3055\u3059\u304E\u308B\u5024: ${issue2.origin}\u306F${issue2.minimum.toString()}${sizing.unit}${adj}\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        return `\u5C0F\u3055\u3059\u304E\u308B\u5024: ${issue2.origin}\u306F${issue2.minimum.toString()}${adj}\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `\u7121\u52B9\u306A\u6587\u5B57\u5217: "${_issue.prefix}"\u3067\u59CB\u307E\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        if (_issue.format === "ends_with")
          return `\u7121\u52B9\u306A\u6587\u5B57\u5217: "${_issue.suffix}"\u3067\u7D42\u308F\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        if (_issue.format === "includes")
          return `\u7121\u52B9\u306A\u6587\u5B57\u5217: "${_issue.includes}"\u3092\u542B\u3080\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        if (_issue.format === "regex")
          return `\u7121\u52B9\u306A\u6587\u5B57\u5217: \u30D1\u30BF\u30FC\u30F3${_issue.pattern}\u306B\u4E00\u81F4\u3059\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        return `\u7121\u52B9\u306A${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `\u7121\u52B9\u306A\u6570\u5024: ${issue2.divisor}\u306E\u500D\u6570\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
      case "unrecognized_keys":
        return `\u8A8D\u8B58\u3055\u308C\u3066\u3044\u306A\u3044\u30AD\u30FC${issue2.keys.length > 1 ? "\u7FA4" : ""}: ${joinValues(issue2.keys, "\u3001")}`;
      case "invalid_key":
        return `${issue2.origin}\u5185\u306E\u7121\u52B9\u306A\u30AD\u30FC`;
      case "invalid_union":
        return "\u7121\u52B9\u306A\u5165\u529B";
      case "invalid_element":
        return `${issue2.origin}\u5185\u306E\u7121\u52B9\u306A\u5024`;
      default:
        return `\u7121\u52B9\u306A\u5165\u529B`;
    }
  };
};
function ja_default() {
  return {
    localeError: error24()
  };
}

// node_modules/zod/v4/locales/ka.js
var error25 = () => {
  const Sizable = {
    string: { unit: "\u10E1\u10D8\u10DB\u10D1\u10DD\u10DA\u10DD", verb: "\u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1" },
    file: { unit: "\u10D1\u10D0\u10D8\u10E2\u10D8", verb: "\u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1" },
    array: { unit: "\u10D4\u10DA\u10D4\u10DB\u10D4\u10DC\u10E2\u10D8", verb: "\u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1" },
    set: { unit: "\u10D4\u10DA\u10D4\u10DB\u10D4\u10DC\u10E2\u10D8", verb: "\u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0",
    email: "\u10D4\u10DA-\u10E4\u10DD\u10E1\u10E2\u10D8\u10E1 \u10DB\u10D8\u10E1\u10D0\u10DB\u10D0\u10E0\u10D7\u10D8",
    url: "URL",
    emoji: "\u10D4\u10DB\u10DD\u10EF\u10D8",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "\u10D7\u10D0\u10E0\u10D8\u10E6\u10D8-\u10D3\u10E0\u10DD",
    date: "\u10D7\u10D0\u10E0\u10D8\u10E6\u10D8",
    time: "\u10D3\u10E0\u10DD",
    duration: "\u10EE\u10D0\u10DC\u10D2\u10E0\u10EB\u10DA\u10D8\u10D5\u10DD\u10D1\u10D0",
    ipv4: "IPv4 \u10DB\u10D8\u10E1\u10D0\u10DB\u10D0\u10E0\u10D7\u10D8",
    ipv6: "IPv6 \u10DB\u10D8\u10E1\u10D0\u10DB\u10D0\u10E0\u10D7\u10D8",
    cidrv4: "IPv4 \u10D3\u10D8\u10D0\u10DE\u10D0\u10D6\u10DD\u10DC\u10D8",
    cidrv6: "IPv6 \u10D3\u10D8\u10D0\u10DE\u10D0\u10D6\u10DD\u10DC\u10D8",
    base64: "base64-\u10D9\u10DD\u10D3\u10D8\u10E0\u10D4\u10D1\u10E3\u10DA\u10D8 \u10D5\u10D4\u10DA\u10D8",
    base64url: "base64url-\u10D9\u10DD\u10D3\u10D8\u10E0\u10D4\u10D1\u10E3\u10DA\u10D8 \u10D5\u10D4\u10DA\u10D8",
    json_string: "JSON \u10D5\u10D4\u10DA\u10D8",
    e164: "E.164 \u10DC\u10DD\u10DB\u10D4\u10E0\u10D8",
    jwt: "JWT",
    template_literal: "\u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "\u10E0\u10D8\u10EA\u10EE\u10D5\u10D8",
    string: "\u10D5\u10D4\u10DA\u10D8",
    boolean: "\u10D1\u10E3\u10DA\u10D4\u10D0\u10DC\u10D8",
    function: "\u10E4\u10E3\u10DC\u10E5\u10EA\u10D8\u10D0",
    array: "\u10DB\u10D0\u10E1\u10D8\u10D5\u10D8"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 instanceof ${issue2.expected}, \u10DB\u10D8\u10E6\u10D4\u10D1\u10E3\u10DA\u10D8 ${received}`;
        }
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${expected}, \u10DB\u10D8\u10E6\u10D4\u10D1\u10E3\u10DA\u10D8 ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${stringifyPrimitive(issue2.values[0])}`;
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D5\u10D0\u10E0\u10D8\u10D0\u10DC\u10E2\u10D8: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8\u10D0 \u10D4\u10E0\u10D7-\u10D4\u10E0\u10D7\u10D8 ${joinValues(issue2.values, "|")}-\u10D3\u10D0\u10DC`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `\u10D6\u10D4\u10D3\u10DB\u10D4\u10E2\u10D0\u10D3 \u10D3\u10D8\u10D3\u10D8: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${issue2.origin ?? "\u10DB\u10DC\u10D8\u10E8\u10D5\u10DC\u10D4\u10DA\u10DD\u10D1\u10D0"} ${sizing.verb} ${adj}${issue2.maximum.toString()} ${sizing.unit}`;
        return `\u10D6\u10D4\u10D3\u10DB\u10D4\u10E2\u10D0\u10D3 \u10D3\u10D8\u10D3\u10D8: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${issue2.origin ?? "\u10DB\u10DC\u10D8\u10E8\u10D5\u10DC\u10D4\u10DA\u10DD\u10D1\u10D0"} \u10D8\u10E7\u10DD\u10E1 ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `\u10D6\u10D4\u10D3\u10DB\u10D4\u10E2\u10D0\u10D3 \u10DE\u10D0\u10E2\u10D0\u10E0\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${issue2.origin} ${sizing.verb} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `\u10D6\u10D4\u10D3\u10DB\u10D4\u10E2\u10D0\u10D3 \u10DE\u10D0\u10E2\u10D0\u10E0\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${issue2.origin} \u10D8\u10E7\u10DD\u10E1 ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D5\u10D4\u10DA\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10D8\u10EC\u10E7\u10D4\u10D1\u10DD\u10D3\u10D4\u10E1 "${_issue.prefix}"-\u10D8\u10D7`;
        }
        if (_issue.format === "ends_with")
          return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D5\u10D4\u10DA\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10DB\u10D7\u10D0\u10D5\u10E0\u10D3\u10D4\u10D1\u10DD\u10D3\u10D4\u10E1 "${_issue.suffix}"-\u10D8\u10D7`;
        if (_issue.format === "includes")
          return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D5\u10D4\u10DA\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1 "${_issue.includes}"-\u10E1`;
        if (_issue.format === "regex")
          return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D5\u10D4\u10DA\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D4\u10E1\u10D0\u10D1\u10D0\u10DB\u10D4\u10D1\u10DD\u10D3\u10D4\u10E1 \u10E8\u10D0\u10D1\u10DA\u10DD\u10DC\u10E1 ${_issue.pattern}`;
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E0\u10D8\u10EA\u10EE\u10D5\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10D8\u10E7\u10DD\u10E1 ${issue2.divisor}-\u10D8\u10E1 \u10EF\u10D4\u10E0\u10D0\u10D3\u10D8`;
      case "unrecognized_keys":
        return `\u10E3\u10EA\u10DC\u10DD\u10D1\u10D8 \u10D2\u10D0\u10E1\u10D0\u10E6\u10D4\u10D1${issue2.keys.length > 1 ? "\u10D4\u10D1\u10D8" : "\u10D8"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D2\u10D0\u10E1\u10D0\u10E6\u10D4\u10D1\u10D8 ${issue2.origin}-\u10E8\u10D8`;
      case "invalid_union":
        return "\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0";
      case "invalid_element":
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10DB\u10DC\u10D8\u10E8\u10D5\u10DC\u10D4\u10DA\u10DD\u10D1\u10D0 ${issue2.origin}-\u10E8\u10D8`;
      default:
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0`;
    }
  };
};
function ka_default() {
  return {
    localeError: error25()
  };
}

// node_modules/zod/v4/locales/km.js
var error26 = () => {
  const Sizable = {
    string: { unit: "\u178F\u17BD\u17A2\u1780\u17D2\u179F\u179A", verb: "\u1782\u17BD\u179A\u1798\u17B6\u1793" },
    file: { unit: "\u1794\u17C3", verb: "\u1782\u17BD\u179A\u1798\u17B6\u1793" },
    array: { unit: "\u1792\u17B6\u178F\u17BB", verb: "\u1782\u17BD\u179A\u1798\u17B6\u1793" },
    set: { unit: "\u1792\u17B6\u178F\u17BB", verb: "\u1782\u17BD\u179A\u1798\u17B6\u1793" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B",
    email: "\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793\u17A2\u17CA\u17B8\u1798\u17C2\u179B",
    url: "URL",
    emoji: "\u179F\u1789\u17D2\u1789\u17B6\u17A2\u17B6\u179A\u1798\u17D2\u1798\u178E\u17CD",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "\u1780\u17B6\u179B\u1794\u179A\u17B7\u1785\u17D2\u1786\u17C1\u1791 \u1793\u17B7\u1784\u1798\u17C9\u17C4\u1784 ISO",
    date: "\u1780\u17B6\u179B\u1794\u179A\u17B7\u1785\u17D2\u1786\u17C1\u1791 ISO",
    time: "\u1798\u17C9\u17C4\u1784 ISO",
    duration: "\u179A\u1799\u17C8\u1796\u17C1\u179B ISO",
    ipv4: "\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793 IPv4",
    ipv6: "\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793 IPv6",
    cidrv4: "\u178A\u17C2\u1793\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793 IPv4",
    cidrv6: "\u178A\u17C2\u1793\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793 IPv6",
    base64: "\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u17A2\u17CA\u17B7\u1780\u17BC\u178A base64",
    base64url: "\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u17A2\u17CA\u17B7\u1780\u17BC\u178A base64url",
    json_string: "\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A JSON",
    e164: "\u179B\u17C1\u1781 E.164",
    jwt: "JWT",
    template_literal: "\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "\u179B\u17C1\u1781",
    array: "\u17A2\u17B6\u179A\u17C1 (Array)",
    null: "\u1782\u17D2\u1798\u17B6\u1793\u178F\u1798\u17D2\u179B\u17C3 (null)"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A instanceof ${issue2.expected} \u1794\u17C9\u17BB\u1793\u17D2\u178F\u17C2\u1791\u1791\u17BD\u179B\u1794\u17B6\u1793 ${received}`;
        }
        return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${expected} \u1794\u17C9\u17BB\u1793\u17D2\u178F\u17C2\u1791\u1791\u17BD\u179B\u1794\u17B6\u1793 ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${stringifyPrimitive(issue2.values[0])}`;
        return `\u1787\u1798\u17D2\u179A\u17BE\u179F\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1787\u17B6\u1798\u17BD\u1799\u1780\u17D2\u1793\u17BB\u1784\u1785\u17C6\u178E\u17C4\u1798 ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `\u1792\u17C6\u1796\u17C1\u1780\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${issue2.origin ?? "\u178F\u1798\u17D2\u179B\u17C3"} ${adj} ${issue2.maximum.toString()} ${sizing.unit ?? "\u1792\u17B6\u178F\u17BB"}`;
        return `\u1792\u17C6\u1796\u17C1\u1780\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${issue2.origin ?? "\u178F\u1798\u17D2\u179B\u17C3"} ${adj} ${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `\u178F\u17BC\u1785\u1796\u17C1\u1780\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${issue2.origin} ${adj} ${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `\u178F\u17BC\u1785\u1796\u17C1\u1780\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${issue2.origin} ${adj} ${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1785\u17B6\u1794\u17CB\u1795\u17D2\u178F\u17BE\u1798\u178A\u17C4\u1799 "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1794\u1789\u17D2\u1785\u1794\u17CB\u178A\u17C4\u1799 "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1798\u17B6\u1793 "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u178F\u17C2\u1795\u17D2\u1782\u17BC\u1795\u17D2\u1782\u1784\u1793\u17B9\u1784\u1791\u1798\u17D2\u179A\u1784\u17CB\u178A\u17C2\u179B\u1794\u17B6\u1793\u1780\u17C6\u178E\u178F\u17CB ${_issue.pattern}`;
        return `\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `\u179B\u17C1\u1781\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u178F\u17C2\u1787\u17B6\u1796\u17A0\u17BB\u1782\u17BB\u178E\u1793\u17C3 ${issue2.divisor}`;
      case "unrecognized_keys":
        return `\u179A\u1780\u1783\u17BE\u1789\u179F\u17C4\u1798\u17B7\u1793\u179F\u17D2\u1782\u17B6\u179B\u17CB\u17D6 ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `\u179F\u17C4\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u1793\u17C5\u1780\u17D2\u1793\u17BB\u1784 ${issue2.origin}`;
      case "invalid_union":
        return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C`;
      case "invalid_element":
        return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u1793\u17C5\u1780\u17D2\u1793\u17BB\u1784 ${issue2.origin}`;
      default:
        return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C`;
    }
  };
};
function km_default() {
  return {
    localeError: error26()
  };
}

// node_modules/zod/v4/locales/kh.js
function kh_default() {
  return km_default();
}

// node_modules/zod/v4/locales/ko.js
var error27 = () => {
  const Sizable = {
    string: { unit: "\uBB38\uC790", verb: "to have" },
    file: { unit: "\uBC14\uC774\uD2B8", verb: "to have" },
    array: { unit: "\uAC1C", verb: "to have" },
    set: { unit: "\uAC1C", verb: "to have" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\uC785\uB825",
    email: "\uC774\uBA54\uC77C \uC8FC\uC18C",
    url: "URL",
    emoji: "\uC774\uBAA8\uC9C0",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO \uB0A0\uC9DC\uC2DC\uAC04",
    date: "ISO \uB0A0\uC9DC",
    time: "ISO \uC2DC\uAC04",
    duration: "ISO \uAE30\uAC04",
    ipv4: "IPv4 \uC8FC\uC18C",
    ipv6: "IPv6 \uC8FC\uC18C",
    cidrv4: "IPv4 \uBC94\uC704",
    cidrv6: "IPv6 \uBC94\uC704",
    base64: "base64 \uC778\uCF54\uB529 \uBB38\uC790\uC5F4",
    base64url: "base64url \uC778\uCF54\uB529 \uBB38\uC790\uC5F4",
    json_string: "JSON \uBB38\uC790\uC5F4",
    e164: "E.164 \uBC88\uD638",
    jwt: "JWT",
    template_literal: "\uC785\uB825"
  };
  const TypeDictionary = {
    nan: "NaN"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\uC798\uBABB\uB41C \uC785\uB825: \uC608\uC0C1 \uD0C0\uC785\uC740 instanceof ${issue2.expected}, \uBC1B\uC740 \uD0C0\uC785\uC740 ${received}\uC785\uB2C8\uB2E4`;
        }
        return `\uC798\uBABB\uB41C \uC785\uB825: \uC608\uC0C1 \uD0C0\uC785\uC740 ${expected}, \uBC1B\uC740 \uD0C0\uC785\uC740 ${received}\uC785\uB2C8\uB2E4`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\uC798\uBABB\uB41C \uC785\uB825: \uAC12\uC740 ${stringifyPrimitive(issue2.values[0])} \uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4`;
        return `\uC798\uBABB\uB41C \uC635\uC158: ${joinValues(issue2.values, "\uB610\uB294 ")} \uC911 \uD558\uB098\uC5EC\uC57C \uD569\uB2C8\uB2E4`;
      case "too_big": {
        const adj = issue2.inclusive ? "\uC774\uD558" : "\uBBF8\uB9CC";
        const suffix = adj === "\uBBF8\uB9CC" ? "\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" : "\uC5EC\uC57C \uD569\uB2C8\uB2E4";
        const sizing = getSizing(issue2.origin);
        const unit = sizing?.unit ?? "\uC694\uC18C";
        if (sizing)
          return `${issue2.origin ?? "\uAC12"}\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4: ${issue2.maximum.toString()}${unit} ${adj}${suffix}`;
        return `${issue2.origin ?? "\uAC12"}\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4: ${issue2.maximum.toString()} ${adj}${suffix}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? "\uC774\uC0C1" : "\uCD08\uACFC";
        const suffix = adj === "\uC774\uC0C1" ? "\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" : "\uC5EC\uC57C \uD569\uB2C8\uB2E4";
        const sizing = getSizing(issue2.origin);
        const unit = sizing?.unit ?? "\uC694\uC18C";
        if (sizing) {
          return `${issue2.origin ?? "\uAC12"}\uC774 \uB108\uBB34 \uC791\uC2B5\uB2C8\uB2E4: ${issue2.minimum.toString()}${unit} ${adj}${suffix}`;
        }
        return `${issue2.origin ?? "\uAC12"}\uC774 \uB108\uBB34 \uC791\uC2B5\uB2C8\uB2E4: ${issue2.minimum.toString()} ${adj}${suffix}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `\uC798\uBABB\uB41C \uBB38\uC790\uC5F4: "${_issue.prefix}"(\uC73C)\uB85C \uC2DC\uC791\uD574\uC57C \uD569\uB2C8\uB2E4`;
        }
        if (_issue.format === "ends_with")
          return `\uC798\uBABB\uB41C \uBB38\uC790\uC5F4: "${_issue.suffix}"(\uC73C)\uB85C \uB05D\uB098\uC57C \uD569\uB2C8\uB2E4`;
        if (_issue.format === "includes")
          return `\uC798\uBABB\uB41C \uBB38\uC790\uC5F4: "${_issue.includes}"\uC744(\uB97C) \uD3EC\uD568\uD574\uC57C \uD569\uB2C8\uB2E4`;
        if (_issue.format === "regex")
          return `\uC798\uBABB\uB41C \uBB38\uC790\uC5F4: \uC815\uADDC\uC2DD ${_issue.pattern} \uD328\uD134\uACFC \uC77C\uCE58\uD574\uC57C \uD569\uB2C8\uB2E4`;
        return `\uC798\uBABB\uB41C ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `\uC798\uBABB\uB41C \uC22B\uC790: ${issue2.divisor}\uC758 \uBC30\uC218\uC5EC\uC57C \uD569\uB2C8\uB2E4`;
      case "unrecognized_keys":
        return `\uC778\uC2DD\uD560 \uC218 \uC5C6\uB294 \uD0A4: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `\uC798\uBABB\uB41C \uD0A4: ${issue2.origin}`;
      case "invalid_union":
        return `\uC798\uBABB\uB41C \uC785\uB825`;
      case "invalid_element":
        return `\uC798\uBABB\uB41C \uAC12: ${issue2.origin}`;
      default:
        return `\uC798\uBABB\uB41C \uC785\uB825`;
    }
  };
};
function ko_default() {
  return {
    localeError: error27()
  };
}

// node_modules/zod/v4/locales/lt.js
var capitalizeFirstCharacter = (text) => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};
function getUnitTypeFromNumber(number4) {
  const abs = Math.abs(number4);
  const last = abs % 10;
  const last2 = abs % 100;
  if (last2 >= 11 && last2 <= 19 || last === 0)
    return "many";
  if (last === 1)
    return "one";
  return "few";
}
var error28 = () => {
  const Sizable = {
    string: {
      unit: {
        one: "simbolis",
        few: "simboliai",
        many: "simboli\u0173"
      },
      verb: {
        smaller: {
          inclusive: "turi b\u016Bti ne ilgesn\u0117 kaip",
          notInclusive: "turi b\u016Bti trumpesn\u0117 kaip"
        },
        bigger: {
          inclusive: "turi b\u016Bti ne trumpesn\u0117 kaip",
          notInclusive: "turi b\u016Bti ilgesn\u0117 kaip"
        }
      }
    },
    file: {
      unit: {
        one: "baitas",
        few: "baitai",
        many: "bait\u0173"
      },
      verb: {
        smaller: {
          inclusive: "turi b\u016Bti ne didesnis kaip",
          notInclusive: "turi b\u016Bti ma\u017Eesnis kaip"
        },
        bigger: {
          inclusive: "turi b\u016Bti ne ma\u017Eesnis kaip",
          notInclusive: "turi b\u016Bti didesnis kaip"
        }
      }
    },
    array: {
      unit: {
        one: "element\u0105",
        few: "elementus",
        many: "element\u0173"
      },
      verb: {
        smaller: {
          inclusive: "turi tur\u0117ti ne daugiau kaip",
          notInclusive: "turi tur\u0117ti ma\u017Eiau kaip"
        },
        bigger: {
          inclusive: "turi tur\u0117ti ne ma\u017Eiau kaip",
          notInclusive: "turi tur\u0117ti daugiau kaip"
        }
      }
    },
    set: {
      unit: {
        one: "element\u0105",
        few: "elementus",
        many: "element\u0173"
      },
      verb: {
        smaller: {
          inclusive: "turi tur\u0117ti ne daugiau kaip",
          notInclusive: "turi tur\u0117ti ma\u017Eiau kaip"
        },
        bigger: {
          inclusive: "turi tur\u0117ti ne ma\u017Eiau kaip",
          notInclusive: "turi tur\u0117ti daugiau kaip"
        }
      }
    }
  };
  function getSizing(origin, unitType, inclusive, targetShouldBe) {
    const result = Sizable[origin] ?? null;
    if (result === null)
      return result;
    return {
      unit: result.unit[unitType],
      verb: result.verb[targetShouldBe][inclusive ? "inclusive" : "notInclusive"]
    };
  }
  const FormatDictionary = {
    regex: "\u012Fvestis",
    email: "el. pa\u0161to adresas",
    url: "URL",
    emoji: "jaustukas",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO data ir laikas",
    date: "ISO data",
    time: "ISO laikas",
    duration: "ISO trukm\u0117",
    ipv4: "IPv4 adresas",
    ipv6: "IPv6 adresas",
    cidrv4: "IPv4 tinklo prefiksas (CIDR)",
    cidrv6: "IPv6 tinklo prefiksas (CIDR)",
    base64: "base64 u\u017Ekoduota eilut\u0117",
    base64url: "base64url u\u017Ekoduota eilut\u0117",
    json_string: "JSON eilut\u0117",
    e164: "E.164 numeris",
    jwt: "JWT",
    template_literal: "\u012Fvestis"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "skai\u010Dius",
    bigint: "sveikasis skai\u010Dius",
    string: "eilut\u0117",
    boolean: "login\u0117 reik\u0161m\u0117",
    undefined: "neapibr\u0117\u017Eta reik\u0161m\u0117",
    function: "funkcija",
    symbol: "simbolis",
    array: "masyvas",
    object: "objektas",
    null: "nulin\u0117 reik\u0161m\u0117"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Gautas tipas ${received}, o tik\u0117tasi - instanceof ${issue2.expected}`;
        }
        return `Gautas tipas ${received}, o tik\u0117tasi - ${expected}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Privalo b\u016Bti ${stringifyPrimitive(issue2.values[0])}`;
        return `Privalo b\u016Bti vienas i\u0161 ${joinValues(issue2.values, "|")} pasirinkim\u0173`;
      case "too_big": {
        const origin = TypeDictionary[issue2.origin] ?? issue2.origin;
        const sizing = getSizing(issue2.origin, getUnitTypeFromNumber(Number(issue2.maximum)), issue2.inclusive ?? false, "smaller");
        if (sizing?.verb)
          return `${capitalizeFirstCharacter(origin ?? issue2.origin ?? "reik\u0161m\u0117")} ${sizing.verb} ${issue2.maximum.toString()} ${sizing.unit ?? "element\u0173"}`;
        const adj = issue2.inclusive ? "ne didesnis kaip" : "ma\u017Eesnis kaip";
        return `${capitalizeFirstCharacter(origin ?? issue2.origin ?? "reik\u0161m\u0117")} turi b\u016Bti ${adj} ${issue2.maximum.toString()} ${sizing?.unit}`;
      }
      case "too_small": {
        const origin = TypeDictionary[issue2.origin] ?? issue2.origin;
        const sizing = getSizing(issue2.origin, getUnitTypeFromNumber(Number(issue2.minimum)), issue2.inclusive ?? false, "bigger");
        if (sizing?.verb)
          return `${capitalizeFirstCharacter(origin ?? issue2.origin ?? "reik\u0161m\u0117")} ${sizing.verb} ${issue2.minimum.toString()} ${sizing.unit ?? "element\u0173"}`;
        const adj = issue2.inclusive ? "ne ma\u017Eesnis kaip" : "didesnis kaip";
        return `${capitalizeFirstCharacter(origin ?? issue2.origin ?? "reik\u0161m\u0117")} turi b\u016Bti ${adj} ${issue2.minimum.toString()} ${sizing?.unit}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Eilut\u0117 privalo prasid\u0117ti "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Eilut\u0117 privalo pasibaigti "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Eilut\u0117 privalo \u012Ftraukti "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Eilut\u0117 privalo atitikti ${_issue.pattern}`;
        return `Neteisingas ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Skai\u010Dius privalo b\u016Bti ${issue2.divisor} kartotinis.`;
      case "unrecognized_keys":
        return `Neatpa\u017Eint${issue2.keys.length > 1 ? "i" : "as"} rakt${issue2.keys.length > 1 ? "ai" : "as"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return "Rastas klaidingas raktas";
      case "invalid_union":
        return "Klaidinga \u012Fvestis";
      case "invalid_element": {
        const origin = TypeDictionary[issue2.origin] ?? issue2.origin;
        return `${capitalizeFirstCharacter(origin ?? issue2.origin ?? "reik\u0161m\u0117")} turi klaiding\u0105 \u012Fvest\u012F`;
      }
      default:
        return "Klaidinga \u012Fvestis";
    }
  };
};
function lt_default() {
  return {
    localeError: error28()
  };
}

// node_modules/zod/v4/locales/mk.js
var error29 = () => {
  const Sizable = {
    string: { unit: "\u0437\u043D\u0430\u0446\u0438", verb: "\u0434\u0430 \u0438\u043C\u0430\u0430\u0442" },
    file: { unit: "\u0431\u0430\u0458\u0442\u0438", verb: "\u0434\u0430 \u0438\u043C\u0430\u0430\u0442" },
    array: { unit: "\u0441\u0442\u0430\u0432\u043A\u0438", verb: "\u0434\u0430 \u0438\u043C\u0430\u0430\u0442" },
    set: { unit: "\u0441\u0442\u0430\u0432\u043A\u0438", verb: "\u0434\u0430 \u0438\u043C\u0430\u0430\u0442" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u0432\u043D\u0435\u0441",
    email: "\u0430\u0434\u0440\u0435\u0441\u0430 \u043D\u0430 \u0435-\u043F\u043E\u0448\u0442\u0430",
    url: "URL",
    emoji: "\u0435\u043C\u043E\u045F\u0438",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO \u0434\u0430\u0442\u0443\u043C \u0438 \u0432\u0440\u0435\u043C\u0435",
    date: "ISO \u0434\u0430\u0442\u0443\u043C",
    time: "ISO \u0432\u0440\u0435\u043C\u0435",
    duration: "ISO \u0432\u0440\u0435\u043C\u0435\u0442\u0440\u0430\u0435\u045A\u0435",
    ipv4: "IPv4 \u0430\u0434\u0440\u0435\u0441\u0430",
    ipv6: "IPv6 \u0430\u0434\u0440\u0435\u0441\u0430",
    cidrv4: "IPv4 \u043E\u043F\u0441\u0435\u0433",
    cidrv6: "IPv6 \u043E\u043F\u0441\u0435\u0433",
    base64: "base64-\u0435\u043D\u043A\u043E\u0434\u0438\u0440\u0430\u043D\u0430 \u043D\u0438\u0437\u0430",
    base64url: "base64url-\u0435\u043D\u043A\u043E\u0434\u0438\u0440\u0430\u043D\u0430 \u043D\u0438\u0437\u0430",
    json_string: "JSON \u043D\u0438\u0437\u0430",
    e164: "E.164 \u0431\u0440\u043E\u0458",
    jwt: "JWT",
    template_literal: "\u0432\u043D\u0435\u0441"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "\u0431\u0440\u043E\u0458",
    array: "\u043D\u0438\u0437\u0430"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u0413\u0440\u0435\u0448\u0435\u043D \u0432\u043D\u0435\u0441: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 instanceof ${issue2.expected}, \u043F\u0440\u0438\u043C\u0435\u043D\u043E ${received}`;
        }
        return `\u0413\u0440\u0435\u0448\u0435\u043D \u0432\u043D\u0435\u0441: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${expected}, \u043F\u0440\u0438\u043C\u0435\u043D\u043E ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Invalid input: expected ${stringifyPrimitive(issue2.values[0])}`;
        return `\u0413\u0440\u0435\u0448\u0430\u043D\u0430 \u043E\u043F\u0446\u0438\u0458\u0430: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 \u0435\u0434\u043D\u0430 ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `\u041F\u0440\u0435\u043C\u043D\u043E\u0433\u0443 \u0433\u043E\u043B\u0435\u043C: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${issue2.origin ?? "\u0432\u0440\u0435\u0434\u043D\u043E\u0441\u0442\u0430"} \u0434\u0430 \u0438\u043C\u0430 ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0438"}`;
        return `\u041F\u0440\u0435\u043C\u043D\u043E\u0433\u0443 \u0433\u043E\u043B\u0435\u043C: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${issue2.origin ?? "\u0432\u0440\u0435\u0434\u043D\u043E\u0441\u0442\u0430"} \u0434\u0430 \u0431\u0438\u0434\u0435 ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `\u041F\u0440\u0435\u043C\u043D\u043E\u0433\u0443 \u043C\u0430\u043B: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${issue2.origin} \u0434\u0430 \u0438\u043C\u0430 ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `\u041F\u0440\u0435\u043C\u043D\u043E\u0433\u0443 \u043C\u0430\u043B: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${issue2.origin} \u0434\u0430 \u0431\u0438\u0434\u0435 ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `\u041D\u0435\u0432\u0430\u0436\u0435\u0447\u043A\u0430 \u043D\u0438\u0437\u0430: \u043C\u043E\u0440\u0430 \u0434\u0430 \u0437\u0430\u043F\u043E\u0447\u043D\u0443\u0432\u0430 \u0441\u043E "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `\u041D\u0435\u0432\u0430\u0436\u0435\u0447\u043A\u0430 \u043D\u0438\u0437\u0430: \u043C\u043E\u0440\u0430 \u0434\u0430 \u0437\u0430\u0432\u0440\u0448\u0443\u0432\u0430 \u0441\u043E "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `\u041D\u0435\u0432\u0430\u0436\u0435\u0447\u043A\u0430 \u043D\u0438\u0437\u0430: \u043C\u043E\u0440\u0430 \u0434\u0430 \u0432\u043A\u043B\u0443\u0447\u0443\u0432\u0430 "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `\u041D\u0435\u0432\u0430\u0436\u0435\u0447\u043A\u0430 \u043D\u0438\u0437\u0430: \u043C\u043E\u0440\u0430 \u0434\u0430 \u043E\u0434\u0433\u043E\u0430\u0440\u0430 \u043D\u0430 \u043F\u0430\u0442\u0435\u0440\u043D\u043E\u0442 ${_issue.pattern}`;
        return `Invalid ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `\u0413\u0440\u0435\u0448\u0435\u043D \u0431\u0440\u043E\u0458: \u043C\u043E\u0440\u0430 \u0434\u0430 \u0431\u0438\u0434\u0435 \u0434\u0435\u043B\u0438\u0432 \u0441\u043E ${issue2.divisor}`;
      case "unrecognized_keys":
        return `${issue2.keys.length > 1 ? "\u041D\u0435\u043F\u0440\u0435\u043F\u043E\u0437\u043D\u0430\u0435\u043D\u0438 \u043A\u043B\u0443\u0447\u0435\u0432\u0438" : "\u041D\u0435\u043F\u0440\u0435\u043F\u043E\u0437\u043D\u0430\u0435\u043D \u043A\u043B\u0443\u0447"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `\u0413\u0440\u0435\u0448\u0435\u043D \u043A\u043B\u0443\u0447 \u0432\u043E ${issue2.origin}`;
      case "invalid_union":
        return "\u0413\u0440\u0435\u0448\u0435\u043D \u0432\u043D\u0435\u0441";
      case "invalid_element":
        return `\u0413\u0440\u0435\u0448\u043D\u0430 \u0432\u0440\u0435\u0434\u043D\u043E\u0441\u0442 \u0432\u043E ${issue2.origin}`;
      default:
        return `\u0413\u0440\u0435\u0448\u0435\u043D \u0432\u043D\u0435\u0441`;
    }
  };
};
function mk_default() {
  return {
    localeError: error29()
  };
}

// node_modules/zod/v4/locales/ms.js
var error30 = () => {
  const Sizable = {
    string: { unit: "aksara", verb: "mempunyai" },
    file: { unit: "bait", verb: "mempunyai" },
    array: { unit: "elemen", verb: "mempunyai" },
    set: { unit: "elemen", verb: "mempunyai" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "input",
    email: "alamat e-mel",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "tarikh masa ISO",
    date: "tarikh ISO",
    time: "masa ISO",
    duration: "tempoh ISO",
    ipv4: "alamat IPv4",
    ipv6: "alamat IPv6",
    cidrv4: "julat IPv4",
    cidrv6: "julat IPv6",
    base64: "string dikodkan base64",
    base64url: "string dikodkan base64url",
    json_string: "string JSON",
    e164: "nombor E.164",
    jwt: "JWT",
    template_literal: "input"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "nombor"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Input tidak sah: dijangka instanceof ${issue2.expected}, diterima ${received}`;
        }
        return `Input tidak sah: dijangka ${expected}, diterima ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Input tidak sah: dijangka ${stringifyPrimitive(issue2.values[0])}`;
        return `Pilihan tidak sah: dijangka salah satu daripada ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Terlalu besar: dijangka ${issue2.origin ?? "nilai"} ${sizing.verb} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elemen"}`;
        return `Terlalu besar: dijangka ${issue2.origin ?? "nilai"} adalah ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Terlalu kecil: dijangka ${issue2.origin} ${sizing.verb} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Terlalu kecil: dijangka ${issue2.origin} adalah ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `String tidak sah: mesti bermula dengan "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `String tidak sah: mesti berakhir dengan "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `String tidak sah: mesti mengandungi "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `String tidak sah: mesti sepadan dengan corak ${_issue.pattern}`;
        return `${FormatDictionary[_issue.format] ?? issue2.format} tidak sah`;
      }
      case "not_multiple_of":
        return `Nombor tidak sah: perlu gandaan ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Kunci tidak dikenali: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Kunci tidak sah dalam ${issue2.origin}`;
      case "invalid_union":
        return "Input tidak sah";
      case "invalid_element":
        return `Nilai tidak sah dalam ${issue2.origin}`;
      default:
        return `Input tidak sah`;
    }
  };
};
function ms_default() {
  return {
    localeError: error30()
  };
}

// node_modules/zod/v4/locales/nl.js
var error31 = () => {
  const Sizable = {
    string: { unit: "tekens", verb: "heeft" },
    file: { unit: "bytes", verb: "heeft" },
    array: { unit: "elementen", verb: "heeft" },
    set: { unit: "elementen", verb: "heeft" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "invoer",
    email: "emailadres",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO datum en tijd",
    date: "ISO datum",
    time: "ISO tijd",
    duration: "ISO duur",
    ipv4: "IPv4-adres",
    ipv6: "IPv6-adres",
    cidrv4: "IPv4-bereik",
    cidrv6: "IPv6-bereik",
    base64: "base64-gecodeerde tekst",
    base64url: "base64 URL-gecodeerde tekst",
    json_string: "JSON string",
    e164: "E.164-nummer",
    jwt: "JWT",
    template_literal: "invoer"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "getal"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Ongeldige invoer: verwacht instanceof ${issue2.expected}, ontving ${received}`;
        }
        return `Ongeldige invoer: verwacht ${expected}, ontving ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Ongeldige invoer: verwacht ${stringifyPrimitive(issue2.values[0])}`;
        return `Ongeldige optie: verwacht \xE9\xE9n van ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        const longName = issue2.origin === "date" ? "laat" : issue2.origin === "string" ? "lang" : "groot";
        if (sizing)
          return `Te ${longName}: verwacht dat ${issue2.origin ?? "waarde"} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elementen"} ${sizing.verb}`;
        return `Te ${longName}: verwacht dat ${issue2.origin ?? "waarde"} ${adj}${issue2.maximum.toString()} is`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        const shortName = issue2.origin === "date" ? "vroeg" : issue2.origin === "string" ? "kort" : "klein";
        if (sizing) {
          return `Te ${shortName}: verwacht dat ${issue2.origin} ${adj}${issue2.minimum.toString()} ${sizing.unit} ${sizing.verb}`;
        }
        return `Te ${shortName}: verwacht dat ${issue2.origin} ${adj}${issue2.minimum.toString()} is`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Ongeldige tekst: moet met "${_issue.prefix}" beginnen`;
        }
        if (_issue.format === "ends_with")
          return `Ongeldige tekst: moet op "${_issue.suffix}" eindigen`;
        if (_issue.format === "includes")
          return `Ongeldige tekst: moet "${_issue.includes}" bevatten`;
        if (_issue.format === "regex")
          return `Ongeldige tekst: moet overeenkomen met patroon ${_issue.pattern}`;
        return `Ongeldig: ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Ongeldig getal: moet een veelvoud van ${issue2.divisor} zijn`;
      case "unrecognized_keys":
        return `Onbekende key${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Ongeldige key in ${issue2.origin}`;
      case "invalid_union":
        return "Ongeldige invoer";
      case "invalid_element":
        return `Ongeldige waarde in ${issue2.origin}`;
      default:
        return `Ongeldige invoer`;
    }
  };
};
function nl_default() {
  return {
    localeError: error31()
  };
}

// node_modules/zod/v4/locales/no.js
var error32 = () => {
  const Sizable = {
    string: { unit: "tegn", verb: "\xE5 ha" },
    file: { unit: "bytes", verb: "\xE5 ha" },
    array: { unit: "elementer", verb: "\xE5 inneholde" },
    set: { unit: "elementer", verb: "\xE5 inneholde" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "input",
    email: "e-postadresse",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO dato- og klokkeslett",
    date: "ISO-dato",
    time: "ISO-klokkeslett",
    duration: "ISO-varighet",
    ipv4: "IPv4-omr\xE5de",
    ipv6: "IPv6-omr\xE5de",
    cidrv4: "IPv4-spekter",
    cidrv6: "IPv6-spekter",
    base64: "base64-enkodet streng",
    base64url: "base64url-enkodet streng",
    json_string: "JSON-streng",
    e164: "E.164-nummer",
    jwt: "JWT",
    template_literal: "input"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "tall",
    array: "liste"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Ugyldig input: forventet instanceof ${issue2.expected}, fikk ${received}`;
        }
        return `Ugyldig input: forventet ${expected}, fikk ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Ugyldig verdi: forventet ${stringifyPrimitive(issue2.values[0])}`;
        return `Ugyldig valg: forventet en av ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `For stor(t): forventet ${issue2.origin ?? "value"} til \xE5 ha ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elementer"}`;
        return `For stor(t): forventet ${issue2.origin ?? "value"} til \xE5 ha ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `For lite(n): forventet ${issue2.origin} til \xE5 ha ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `For lite(n): forventet ${issue2.origin} til \xE5 ha ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Ugyldig streng: m\xE5 starte med "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Ugyldig streng: m\xE5 ende med "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Ugyldig streng: m\xE5 inneholde "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Ugyldig streng: m\xE5 matche m\xF8nsteret ${_issue.pattern}`;
        return `Ugyldig ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Ugyldig tall: m\xE5 v\xE6re et multiplum av ${issue2.divisor}`;
      case "unrecognized_keys":
        return `${issue2.keys.length > 1 ? "Ukjente n\xF8kler" : "Ukjent n\xF8kkel"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Ugyldig n\xF8kkel i ${issue2.origin}`;
      case "invalid_union":
        return "Ugyldig input";
      case "invalid_element":
        return `Ugyldig verdi i ${issue2.origin}`;
      default:
        return `Ugyldig input`;
    }
  };
};
function no_default() {
  return {
    localeError: error32()
  };
}

// node_modules/zod/v4/locales/ota.js
var error33 = () => {
  const Sizable = {
    string: { unit: "harf", verb: "olmal\u0131d\u0131r" },
    file: { unit: "bayt", verb: "olmal\u0131d\u0131r" },
    array: { unit: "unsur", verb: "olmal\u0131d\u0131r" },
    set: { unit: "unsur", verb: "olmal\u0131d\u0131r" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "giren",
    email: "epostag\xE2h",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO heng\xE2m\u0131",
    date: "ISO tarihi",
    time: "ISO zaman\u0131",
    duration: "ISO m\xFCddeti",
    ipv4: "IPv4 ni\u015F\xE2n\u0131",
    ipv6: "IPv6 ni\u015F\xE2n\u0131",
    cidrv4: "IPv4 menzili",
    cidrv6: "IPv6 menzili",
    base64: "base64-\u015Fifreli metin",
    base64url: "base64url-\u015Fifreli metin",
    json_string: "JSON metin",
    e164: "E.164 say\u0131s\u0131",
    jwt: "JWT",
    template_literal: "giren"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "numara",
    array: "saf",
    null: "gayb"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `F\xE2sit giren: umulan instanceof ${issue2.expected}, al\u0131nan ${received}`;
        }
        return `F\xE2sit giren: umulan ${expected}, al\u0131nan ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `F\xE2sit giren: umulan ${stringifyPrimitive(issue2.values[0])}`;
        return `F\xE2sit tercih: m\xFBteberler ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Fazla b\xFCy\xFCk: ${issue2.origin ?? "value"}, ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elements"} sahip olmal\u0131yd\u0131.`;
        return `Fazla b\xFCy\xFCk: ${issue2.origin ?? "value"}, ${adj}${issue2.maximum.toString()} olmal\u0131yd\u0131.`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Fazla k\xFC\xE7\xFCk: ${issue2.origin}, ${adj}${issue2.minimum.toString()} ${sizing.unit} sahip olmal\u0131yd\u0131.`;
        }
        return `Fazla k\xFC\xE7\xFCk: ${issue2.origin}, ${adj}${issue2.minimum.toString()} olmal\u0131yd\u0131.`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `F\xE2sit metin: "${_issue.prefix}" ile ba\u015Flamal\u0131.`;
        if (_issue.format === "ends_with")
          return `F\xE2sit metin: "${_issue.suffix}" ile bitmeli.`;
        if (_issue.format === "includes")
          return `F\xE2sit metin: "${_issue.includes}" ihtiv\xE2 etmeli.`;
        if (_issue.format === "regex")
          return `F\xE2sit metin: ${_issue.pattern} nak\u015F\u0131na uymal\u0131.`;
        return `F\xE2sit ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `F\xE2sit say\u0131: ${issue2.divisor} kat\u0131 olmal\u0131yd\u0131.`;
      case "unrecognized_keys":
        return `Tan\u0131nmayan anahtar ${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `${issue2.origin} i\xE7in tan\u0131nmayan anahtar var.`;
      case "invalid_union":
        return "Giren tan\u0131namad\u0131.";
      case "invalid_element":
        return `${issue2.origin} i\xE7in tan\u0131nmayan k\u0131ymet var.`;
      default:
        return `K\u0131ymet tan\u0131namad\u0131.`;
    }
  };
};
function ota_default() {
  return {
    localeError: error33()
  };
}

// node_modules/zod/v4/locales/ps.js
var error34 = () => {
  const Sizable = {
    string: { unit: "\u062A\u0648\u06A9\u064A", verb: "\u0648\u0644\u0631\u064A" },
    file: { unit: "\u0628\u0627\u06CC\u067C\u0633", verb: "\u0648\u0644\u0631\u064A" },
    array: { unit: "\u062A\u0648\u06A9\u064A", verb: "\u0648\u0644\u0631\u064A" },
    set: { unit: "\u062A\u0648\u06A9\u064A", verb: "\u0648\u0644\u0631\u064A" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u0648\u0631\u0648\u062F\u064A",
    email: "\u0628\u0631\u06CC\u069A\u0646\u0627\u0644\u06CC\u06A9",
    url: "\u06CC\u0648 \u0622\u0631 \u0627\u0644",
    emoji: "\u0627\u06CC\u0645\u0648\u062C\u064A",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "\u0646\u06CC\u067C\u0647 \u0627\u0648 \u0648\u062E\u062A",
    date: "\u0646\u06D0\u067C\u0647",
    time: "\u0648\u062E\u062A",
    duration: "\u0645\u0648\u062F\u0647",
    ipv4: "\u062F IPv4 \u067E\u062A\u0647",
    ipv6: "\u062F IPv6 \u067E\u062A\u0647",
    cidrv4: "\u062F IPv4 \u0633\u0627\u062D\u0647",
    cidrv6: "\u062F IPv6 \u0633\u0627\u062D\u0647",
    base64: "base64-encoded \u0645\u062A\u0646",
    base64url: "base64url-encoded \u0645\u062A\u0646",
    json_string: "JSON \u0645\u062A\u0646",
    e164: "\u062F E.164 \u0634\u0645\u06D0\u0631\u0647",
    jwt: "JWT",
    template_literal: "\u0648\u0631\u0648\u062F\u064A"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "\u0639\u062F\u062F",
    array: "\u0627\u0631\u06D0"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u0646\u0627\u0633\u0645 \u0648\u0631\u0648\u062F\u064A: \u0628\u0627\u06CC\u062F instanceof ${issue2.expected} \u0648\u0627\u06CC, \u0645\u06AB\u0631 ${received} \u062A\u0631\u0644\u0627\u0633\u0647 \u0634\u0648`;
        }
        return `\u0646\u0627\u0633\u0645 \u0648\u0631\u0648\u062F\u064A: \u0628\u0627\u06CC\u062F ${expected} \u0648\u0627\u06CC, \u0645\u06AB\u0631 ${received} \u062A\u0631\u0644\u0627\u0633\u0647 \u0634\u0648`;
      }
      case "invalid_value":
        if (issue2.values.length === 1) {
          return `\u0646\u0627\u0633\u0645 \u0648\u0631\u0648\u062F\u064A: \u0628\u0627\u06CC\u062F ${stringifyPrimitive(issue2.values[0])} \u0648\u0627\u06CC`;
        }
        return `\u0646\u0627\u0633\u0645 \u0627\u0646\u062A\u062E\u0627\u0628: \u0628\u0627\u06CC\u062F \u06CC\u0648 \u0644\u0647 ${joinValues(issue2.values, "|")} \u0685\u062E\u0647 \u0648\u0627\u06CC`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `\u0689\u06CC\u0631 \u0644\u0648\u06CC: ${issue2.origin ?? "\u0627\u0631\u0632\u069A\u062A"} \u0628\u0627\u06CC\u062F ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "\u0639\u0646\u0635\u0631\u0648\u0646\u0647"} \u0648\u0644\u0631\u064A`;
        }
        return `\u0689\u06CC\u0631 \u0644\u0648\u06CC: ${issue2.origin ?? "\u0627\u0631\u0632\u069A\u062A"} \u0628\u0627\u06CC\u062F ${adj}${issue2.maximum.toString()} \u0648\u064A`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `\u0689\u06CC\u0631 \u06A9\u0648\u0686\u0646\u06CC: ${issue2.origin} \u0628\u0627\u06CC\u062F ${adj}${issue2.minimum.toString()} ${sizing.unit} \u0648\u0644\u0631\u064A`;
        }
        return `\u0689\u06CC\u0631 \u06A9\u0648\u0686\u0646\u06CC: ${issue2.origin} \u0628\u0627\u06CC\u062F ${adj}${issue2.minimum.toString()} \u0648\u064A`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `\u0646\u0627\u0633\u0645 \u0645\u062A\u0646: \u0628\u0627\u06CC\u062F \u062F "${_issue.prefix}" \u0633\u0631\u0647 \u067E\u06CC\u0644 \u0634\u064A`;
        }
        if (_issue.format === "ends_with") {
          return `\u0646\u0627\u0633\u0645 \u0645\u062A\u0646: \u0628\u0627\u06CC\u062F \u062F "${_issue.suffix}" \u0633\u0631\u0647 \u067E\u0627\u06CC \u062A\u0647 \u0648\u0631\u0633\u064A\u0696\u064A`;
        }
        if (_issue.format === "includes") {
          return `\u0646\u0627\u0633\u0645 \u0645\u062A\u0646: \u0628\u0627\u06CC\u062F "${_issue.includes}" \u0648\u0644\u0631\u064A`;
        }
        if (_issue.format === "regex") {
          return `\u0646\u0627\u0633\u0645 \u0645\u062A\u0646: \u0628\u0627\u06CC\u062F \u062F ${_issue.pattern} \u0633\u0631\u0647 \u0645\u0637\u0627\u0628\u0642\u062A \u0648\u0644\u0631\u064A`;
        }
        return `${FormatDictionary[_issue.format] ?? issue2.format} \u0646\u0627\u0633\u0645 \u062F\u06CC`;
      }
      case "not_multiple_of":
        return `\u0646\u0627\u0633\u0645 \u0639\u062F\u062F: \u0628\u0627\u06CC\u062F \u062F ${issue2.divisor} \u0645\u0636\u0631\u0628 \u0648\u064A`;
      case "unrecognized_keys":
        return `\u0646\u0627\u0633\u0645 ${issue2.keys.length > 1 ? "\u06A9\u0644\u06CC\u0689\u0648\u0646\u0647" : "\u06A9\u0644\u06CC\u0689"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `\u0646\u0627\u0633\u0645 \u06A9\u0644\u06CC\u0689 \u067E\u0647 ${issue2.origin} \u06A9\u06D0`;
      case "invalid_union":
        return `\u0646\u0627\u0633\u0645\u0647 \u0648\u0631\u0648\u062F\u064A`;
      case "invalid_element":
        return `\u0646\u0627\u0633\u0645 \u0639\u0646\u0635\u0631 \u067E\u0647 ${issue2.origin} \u06A9\u06D0`;
      default:
        return `\u0646\u0627\u0633\u0645\u0647 \u0648\u0631\u0648\u062F\u064A`;
    }
  };
};
function ps_default() {
  return {
    localeError: error34()
  };
}

// node_modules/zod/v4/locales/pl.js
var error35 = () => {
  const Sizable = {
    string: { unit: "znak\xF3w", verb: "mie\u0107" },
    file: { unit: "bajt\xF3w", verb: "mie\u0107" },
    array: { unit: "element\xF3w", verb: "mie\u0107" },
    set: { unit: "element\xF3w", verb: "mie\u0107" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "wyra\u017Cenie",
    email: "adres email",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "data i godzina w formacie ISO",
    date: "data w formacie ISO",
    time: "godzina w formacie ISO",
    duration: "czas trwania ISO",
    ipv4: "adres IPv4",
    ipv6: "adres IPv6",
    cidrv4: "zakres IPv4",
    cidrv6: "zakres IPv6",
    base64: "ci\u0105g znak\xF3w zakodowany w formacie base64",
    base64url: "ci\u0105g znak\xF3w zakodowany w formacie base64url",
    json_string: "ci\u0105g znak\xF3w w formacie JSON",
    e164: "liczba E.164",
    jwt: "JWT",
    template_literal: "wej\u015Bcie"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "liczba",
    array: "tablica"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Nieprawid\u0142owe dane wej\u015Bciowe: oczekiwano instanceof ${issue2.expected}, otrzymano ${received}`;
        }
        return `Nieprawid\u0142owe dane wej\u015Bciowe: oczekiwano ${expected}, otrzymano ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Nieprawid\u0142owe dane wej\u015Bciowe: oczekiwano ${stringifyPrimitive(issue2.values[0])}`;
        return `Nieprawid\u0142owa opcja: oczekiwano jednej z warto\u015Bci ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Za du\u017Ca warto\u015B\u0107: oczekiwano, \u017Ce ${issue2.origin ?? "warto\u015B\u0107"} b\u0119dzie mie\u0107 ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "element\xF3w"}`;
        }
        return `Zbyt du\u017C(y/a/e): oczekiwano, \u017Ce ${issue2.origin ?? "warto\u015B\u0107"} b\u0119dzie wynosi\u0107 ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Za ma\u0142a warto\u015B\u0107: oczekiwano, \u017Ce ${issue2.origin ?? "warto\u015B\u0107"} b\u0119dzie mie\u0107 ${adj}${issue2.minimum.toString()} ${sizing.unit ?? "element\xF3w"}`;
        }
        return `Zbyt ma\u0142(y/a/e): oczekiwano, \u017Ce ${issue2.origin ?? "warto\u015B\u0107"} b\u0119dzie wynosi\u0107 ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Nieprawid\u0142owy ci\u0105g znak\xF3w: musi zaczyna\u0107 si\u0119 od "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Nieprawid\u0142owy ci\u0105g znak\xF3w: musi ko\u0144czy\u0107 si\u0119 na "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Nieprawid\u0142owy ci\u0105g znak\xF3w: musi zawiera\u0107 "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Nieprawid\u0142owy ci\u0105g znak\xF3w: musi odpowiada\u0107 wzorcowi ${_issue.pattern}`;
        return `Nieprawid\u0142ow(y/a/e) ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Nieprawid\u0142owa liczba: musi by\u0107 wielokrotno\u015Bci\u0105 ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Nierozpoznane klucze${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Nieprawid\u0142owy klucz w ${issue2.origin}`;
      case "invalid_union":
        return "Nieprawid\u0142owe dane wej\u015Bciowe";
      case "invalid_element":
        return `Nieprawid\u0142owa warto\u015B\u0107 w ${issue2.origin}`;
      default:
        return `Nieprawid\u0142owe dane wej\u015Bciowe`;
    }
  };
};
function pl_default() {
  return {
    localeError: error35()
  };
}

// node_modules/zod/v4/locales/pt.js
var error36 = () => {
  const Sizable = {
    string: { unit: "caracteres", verb: "ter" },
    file: { unit: "bytes", verb: "ter" },
    array: { unit: "itens", verb: "ter" },
    set: { unit: "itens", verb: "ter" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "padr\xE3o",
    email: "endere\xE7o de e-mail",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "data e hora ISO",
    date: "data ISO",
    time: "hora ISO",
    duration: "dura\xE7\xE3o ISO",
    ipv4: "endere\xE7o IPv4",
    ipv6: "endere\xE7o IPv6",
    cidrv4: "faixa de IPv4",
    cidrv6: "faixa de IPv6",
    base64: "texto codificado em base64",
    base64url: "URL codificada em base64",
    json_string: "texto JSON",
    e164: "n\xFAmero E.164",
    jwt: "JWT",
    template_literal: "entrada"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "n\xFAmero",
    null: "nulo"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Tipo inv\xE1lido: esperado instanceof ${issue2.expected}, recebido ${received}`;
        }
        return `Tipo inv\xE1lido: esperado ${expected}, recebido ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Entrada inv\xE1lida: esperado ${stringifyPrimitive(issue2.values[0])}`;
        return `Op\xE7\xE3o inv\xE1lida: esperada uma das ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Muito grande: esperado que ${issue2.origin ?? "valor"} tivesse ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elementos"}`;
        return `Muito grande: esperado que ${issue2.origin ?? "valor"} fosse ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Muito pequeno: esperado que ${issue2.origin} tivesse ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Muito pequeno: esperado que ${issue2.origin} fosse ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Texto inv\xE1lido: deve come\xE7ar com "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Texto inv\xE1lido: deve terminar com "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Texto inv\xE1lido: deve incluir "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Texto inv\xE1lido: deve corresponder ao padr\xE3o ${_issue.pattern}`;
        return `${FormatDictionary[_issue.format] ?? issue2.format} inv\xE1lido`;
      }
      case "not_multiple_of":
        return `N\xFAmero inv\xE1lido: deve ser m\xFAltiplo de ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Chave${issue2.keys.length > 1 ? "s" : ""} desconhecida${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Chave inv\xE1lida em ${issue2.origin}`;
      case "invalid_union":
        return "Entrada inv\xE1lida";
      case "invalid_element":
        return `Valor inv\xE1lido em ${issue2.origin}`;
      default:
        return `Campo inv\xE1lido`;
    }
  };
};
function pt_default() {
  return {
    localeError: error36()
  };
}

// node_modules/zod/v4/locales/ro.js
var error37 = () => {
  const Sizable = {
    string: { unit: "caractere", verb: "s\u0103 aib\u0103" },
    file: { unit: "octe\u021Bi", verb: "s\u0103 aib\u0103" },
    array: { unit: "elemente", verb: "s\u0103 aib\u0103" },
    set: { unit: "elemente", verb: "s\u0103 aib\u0103" },
    map: { unit: "intr\u0103ri", verb: "s\u0103 aib\u0103" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "intrare",
    email: "adres\u0103 de email",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "dat\u0103 \u0219i or\u0103 ISO",
    date: "dat\u0103 ISO",
    time: "or\u0103 ISO",
    duration: "durat\u0103 ISO",
    ipv4: "adres\u0103 IPv4",
    ipv6: "adres\u0103 IPv6",
    mac: "adres\u0103 MAC",
    cidrv4: "interval IPv4",
    cidrv6: "interval IPv6",
    base64: "\u0219ir codat base64",
    base64url: "\u0219ir codat base64url",
    json_string: "\u0219ir JSON",
    e164: "num\u0103r E.164",
    jwt: "JWT",
    template_literal: "intrare"
  };
  const TypeDictionary = {
    nan: "NaN",
    string: "\u0219ir",
    number: "num\u0103r",
    boolean: "boolean",
    function: "func\u021Bie",
    array: "matrice",
    object: "obiect",
    undefined: "nedefinit",
    symbol: "simbol",
    bigint: "num\u0103r mare",
    void: "void",
    never: "never",
    map: "hart\u0103",
    set: "set"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        return `Intrare invalid\u0103: a\u0219teptat ${expected}, primit ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Intrare invalid\u0103: a\u0219teptat ${stringifyPrimitive(issue2.values[0])}`;
        return `Op\u021Biune invalid\u0103: a\u0219teptat una dintre ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Prea mare: a\u0219teptat ca ${issue2.origin ?? "valoarea"} ${sizing.verb} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elemente"}`;
        return `Prea mare: a\u0219teptat ca ${issue2.origin ?? "valoarea"} s\u0103 fie ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Prea mic: a\u0219teptat ca ${issue2.origin} ${sizing.verb} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Prea mic: a\u0219teptat ca ${issue2.origin} s\u0103 fie ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `\u0218ir invalid: trebuie s\u0103 \xEEnceap\u0103 cu "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `\u0218ir invalid: trebuie s\u0103 se termine cu "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `\u0218ir invalid: trebuie s\u0103 includ\u0103 "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `\u0218ir invalid: trebuie s\u0103 se potriveasc\u0103 cu modelul ${_issue.pattern}`;
        return `Format invalid: ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Num\u0103r invalid: trebuie s\u0103 fie multiplu de ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Chei nerecunoscute: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Cheie invalid\u0103 \xEEn ${issue2.origin}`;
      case "invalid_union":
        return "Intrare invalid\u0103";
      case "invalid_element":
        return `Valoare invalid\u0103 \xEEn ${issue2.origin}`;
      default:
        return `Intrare invalid\u0103`;
    }
  };
};
function ro_default() {
  return {
    localeError: error37()
  };
}

// node_modules/zod/v4/locales/ru.js
function getRussianPlural(count, one, few, many) {
  const absCount = Math.abs(count);
  const lastDigit = absCount % 10;
  const lastTwoDigits = absCount % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return many;
  }
  if (lastDigit === 1) {
    return one;
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return few;
  }
  return many;
}
var error38 = () => {
  const Sizable = {
    string: {
      unit: {
        one: "\u0441\u0438\u043C\u0432\u043E\u043B",
        few: "\u0441\u0438\u043C\u0432\u043E\u043B\u0430",
        many: "\u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432"
      },
      verb: "\u0438\u043C\u0435\u0442\u044C"
    },
    file: {
      unit: {
        one: "\u0431\u0430\u0439\u0442",
        few: "\u0431\u0430\u0439\u0442\u0430",
        many: "\u0431\u0430\u0439\u0442"
      },
      verb: "\u0438\u043C\u0435\u0442\u044C"
    },
    array: {
      unit: {
        one: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442",
        few: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430",
        many: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432"
      },
      verb: "\u0438\u043C\u0435\u0442\u044C"
    },
    set: {
      unit: {
        one: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442",
        few: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430",
        many: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432"
      },
      verb: "\u0438\u043C\u0435\u0442\u044C"
    }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u0432\u0432\u043E\u0434",
    email: "email \u0430\u0434\u0440\u0435\u0441",
    url: "URL",
    emoji: "\u044D\u043C\u043E\u0434\u0437\u0438",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO \u0434\u0430\u0442\u0430 \u0438 \u0432\u0440\u0435\u043C\u044F",
    date: "ISO \u0434\u0430\u0442\u0430",
    time: "ISO \u0432\u0440\u0435\u043C\u044F",
    duration: "ISO \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C",
    ipv4: "IPv4 \u0430\u0434\u0440\u0435\u0441",
    ipv6: "IPv6 \u0430\u0434\u0440\u0435\u0441",
    cidrv4: "IPv4 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D",
    cidrv6: "IPv6 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D",
    base64: "\u0441\u0442\u0440\u043E\u043A\u0430 \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 base64",
    base64url: "\u0441\u0442\u0440\u043E\u043A\u0430 \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 base64url",
    json_string: "JSON \u0441\u0442\u0440\u043E\u043A\u0430",
    e164: "\u043D\u043E\u043C\u0435\u0440 E.164",
    jwt: "JWT",
    template_literal: "\u0432\u0432\u043E\u0434"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "\u0447\u0438\u0441\u043B\u043E",
    array: "\u043C\u0430\u0441\u0441\u0438\u0432"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0432\u0432\u043E\u0434: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C instanceof ${issue2.expected}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ${received}`;
        }
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0432\u0432\u043E\u0434: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C ${expected}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0432\u0432\u043E\u0434: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C ${stringifyPrimitive(issue2.values[0])}`;
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0432\u0430\u0440\u0438\u0430\u043D\u0442: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0434\u043D\u043E \u0438\u0437 ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          const maxValue = Number(issue2.maximum);
          const unit = getRussianPlural(maxValue, sizing.unit.one, sizing.unit.few, sizing.unit.many);
          return `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E ${issue2.origin ?? "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435"} \u0431\u0443\u0434\u0435\u0442 \u0438\u043C\u0435\u0442\u044C ${adj}${issue2.maximum.toString()} ${unit}`;
        }
        return `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E ${issue2.origin ?? "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435"} \u0431\u0443\u0434\u0435\u0442 ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          const minValue = Number(issue2.minimum);
          const unit = getRussianPlural(minValue, sizing.unit.one, sizing.unit.few, sizing.unit.many);
          return `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u0430\u043B\u0435\u043D\u044C\u043A\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E ${issue2.origin} \u0431\u0443\u0434\u0435\u0442 \u0438\u043C\u0435\u0442\u044C ${adj}${issue2.minimum.toString()} ${unit}`;
        }
        return `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u0430\u043B\u0435\u043D\u044C\u043A\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E ${issue2.origin} \u0431\u0443\u0434\u0435\u0442 ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430: \u0434\u043E\u043B\u0436\u043D\u0430 \u043D\u0430\u0447\u0438\u043D\u0430\u0442\u044C\u0441\u044F \u0441 "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430: \u0434\u043E\u043B\u0436\u043D\u0430 \u0437\u0430\u043A\u0430\u043D\u0447\u0438\u0432\u0430\u0442\u044C\u0441\u044F \u043D\u0430 "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430: \u0434\u043E\u043B\u0436\u043D\u0430 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430: \u0434\u043E\u043B\u0436\u043D\u0430 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u043E\u0432\u0430\u0442\u044C \u0448\u0430\u0431\u043B\u043E\u043D\u0443 ${_issue.pattern}`;
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u043E\u0435 \u0447\u0438\u0441\u043B\u043E: \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u043A\u0440\u0430\u0442\u043D\u044B\u043C ${issue2.divisor}`;
      case "unrecognized_keys":
        return `\u041D\u0435\u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D\u043D${issue2.keys.length > 1 ? "\u044B\u0435" : "\u044B\u0439"} \u043A\u043B\u044E\u0447${issue2.keys.length > 1 ? "\u0438" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043A\u043B\u044E\u0447 \u0432 ${issue2.origin}`;
      case "invalid_union":
        return "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0435 \u0432\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435";
      case "invalid_element":
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432 ${issue2.origin}`;
      default:
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0435 \u0432\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435`;
    }
  };
};
function ru_default() {
  return {
    localeError: error38()
  };
}

// node_modules/zod/v4/locales/sl.js
var error39 = () => {
  const Sizable = {
    string: { unit: "znakov", verb: "imeti" },
    file: { unit: "bajtov", verb: "imeti" },
    array: { unit: "elementov", verb: "imeti" },
    set: { unit: "elementov", verb: "imeti" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "vnos",
    email: "e-po\u0161tni naslov",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO datum in \u010Das",
    date: "ISO datum",
    time: "ISO \u010Das",
    duration: "ISO trajanje",
    ipv4: "IPv4 naslov",
    ipv6: "IPv6 naslov",
    cidrv4: "obseg IPv4",
    cidrv6: "obseg IPv6",
    base64: "base64 kodiran niz",
    base64url: "base64url kodiran niz",
    json_string: "JSON niz",
    e164: "E.164 \u0161tevilka",
    jwt: "JWT",
    template_literal: "vnos"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "\u0161tevilo",
    array: "tabela"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Neveljaven vnos: pri\u010Dakovano instanceof ${issue2.expected}, prejeto ${received}`;
        }
        return `Neveljaven vnos: pri\u010Dakovano ${expected}, prejeto ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Neveljaven vnos: pri\u010Dakovano ${stringifyPrimitive(issue2.values[0])}`;
        return `Neveljavna mo\u017Enost: pri\u010Dakovano eno izmed ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Preveliko: pri\u010Dakovano, da bo ${issue2.origin ?? "vrednost"} imelo ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elementov"}`;
        return `Preveliko: pri\u010Dakovano, da bo ${issue2.origin ?? "vrednost"} ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Premajhno: pri\u010Dakovano, da bo ${issue2.origin} imelo ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Premajhno: pri\u010Dakovano, da bo ${issue2.origin} ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Neveljaven niz: mora se za\u010Deti z "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Neveljaven niz: mora se kon\u010Dati z "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Neveljaven niz: mora vsebovati "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Neveljaven niz: mora ustrezati vzorcu ${_issue.pattern}`;
        return `Neveljaven ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Neveljavno \u0161tevilo: mora biti ve\u010Dkratnik ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Neprepoznan${issue2.keys.length > 1 ? "i klju\u010Di" : " klju\u010D"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Neveljaven klju\u010D v ${issue2.origin}`;
      case "invalid_union":
        return "Neveljaven vnos";
      case "invalid_element":
        return `Neveljavna vrednost v ${issue2.origin}`;
      default:
        return "Neveljaven vnos";
    }
  };
};
function sl_default() {
  return {
    localeError: error39()
  };
}

// node_modules/zod/v4/locales/sv.js
var error40 = () => {
  const Sizable = {
    string: { unit: "tecken", verb: "att ha" },
    file: { unit: "bytes", verb: "att ha" },
    array: { unit: "objekt", verb: "att inneh\xE5lla" },
    set: { unit: "objekt", verb: "att inneh\xE5lla" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "regulj\xE4rt uttryck",
    email: "e-postadress",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO-datum och tid",
    date: "ISO-datum",
    time: "ISO-tid",
    duration: "ISO-varaktighet",
    ipv4: "IPv4-intervall",
    ipv6: "IPv6-intervall",
    cidrv4: "IPv4-spektrum",
    cidrv6: "IPv6-spektrum",
    base64: "base64-kodad str\xE4ng",
    base64url: "base64url-kodad str\xE4ng",
    json_string: "JSON-str\xE4ng",
    e164: "E.164-nummer",
    jwt: "JWT",
    template_literal: "mall-literal"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "antal",
    array: "lista"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Ogiltig inmatning: f\xF6rv\xE4ntat instanceof ${issue2.expected}, fick ${received}`;
        }
        return `Ogiltig inmatning: f\xF6rv\xE4ntat ${expected}, fick ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Ogiltig inmatning: f\xF6rv\xE4ntat ${stringifyPrimitive(issue2.values[0])}`;
        return `Ogiltigt val: f\xF6rv\xE4ntade en av ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `F\xF6r stor(t): f\xF6rv\xE4ntade ${issue2.origin ?? "v\xE4rdet"} att ha ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "element"}`;
        }
        return `F\xF6r stor(t): f\xF6rv\xE4ntat ${issue2.origin ?? "v\xE4rdet"} att ha ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `F\xF6r lite(t): f\xF6rv\xE4ntade ${issue2.origin ?? "v\xE4rdet"} att ha ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `F\xF6r lite(t): f\xF6rv\xE4ntade ${issue2.origin ?? "v\xE4rdet"} att ha ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Ogiltig str\xE4ng: m\xE5ste b\xF6rja med "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Ogiltig str\xE4ng: m\xE5ste sluta med "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Ogiltig str\xE4ng: m\xE5ste inneh\xE5lla "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Ogiltig str\xE4ng: m\xE5ste matcha m\xF6nstret "${_issue.pattern}"`;
        return `Ogiltig(t) ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Ogiltigt tal: m\xE5ste vara en multipel av ${issue2.divisor}`;
      case "unrecognized_keys":
        return `${issue2.keys.length > 1 ? "Ok\xE4nda nycklar" : "Ok\xE4nd nyckel"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Ogiltig nyckel i ${issue2.origin ?? "v\xE4rdet"}`;
      case "invalid_union":
        return "Ogiltig input";
      case "invalid_element":
        return `Ogiltigt v\xE4rde i ${issue2.origin ?? "v\xE4rdet"}`;
      default:
        return `Ogiltig input`;
    }
  };
};
function sv_default() {
  return {
    localeError: error40()
  };
}

// node_modules/zod/v4/locales/ta.js
var error41 = () => {
  const Sizable = {
    string: { unit: "\u0B8E\u0BB4\u0BC1\u0BA4\u0BCD\u0BA4\u0BC1\u0B95\u0BCD\u0B95\u0BB3\u0BCD", verb: "\u0B95\u0BCA\u0BA3\u0BCD\u0B9F\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD" },
    file: { unit: "\u0BAA\u0BC8\u0B9F\u0BCD\u0B9F\u0BC1\u0B95\u0BB3\u0BCD", verb: "\u0B95\u0BCA\u0BA3\u0BCD\u0B9F\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD" },
    array: { unit: "\u0B89\u0BB1\u0BC1\u0BAA\u0BCD\u0BAA\u0BC1\u0B95\u0BB3\u0BCD", verb: "\u0B95\u0BCA\u0BA3\u0BCD\u0B9F\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD" },
    set: { unit: "\u0B89\u0BB1\u0BC1\u0BAA\u0BCD\u0BAA\u0BC1\u0B95\u0BB3\u0BCD", verb: "\u0B95\u0BCA\u0BA3\u0BCD\u0B9F\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1",
    email: "\u0BAE\u0BBF\u0BA9\u0BCD\u0BA9\u0B9E\u0BCD\u0B9A\u0BB2\u0BCD \u0BAE\u0BC1\u0B95\u0BB5\u0BB0\u0BBF",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO \u0BA4\u0BC7\u0BA4\u0BBF \u0BA8\u0BC7\u0BB0\u0BAE\u0BCD",
    date: "ISO \u0BA4\u0BC7\u0BA4\u0BBF",
    time: "ISO \u0BA8\u0BC7\u0BB0\u0BAE\u0BCD",
    duration: "ISO \u0B95\u0BBE\u0BB2 \u0B85\u0BB3\u0BB5\u0BC1",
    ipv4: "IPv4 \u0BAE\u0BC1\u0B95\u0BB5\u0BB0\u0BBF",
    ipv6: "IPv6 \u0BAE\u0BC1\u0B95\u0BB5\u0BB0\u0BBF",
    cidrv4: "IPv4 \u0BB5\u0BB0\u0BAE\u0BCD\u0BAA\u0BC1",
    cidrv6: "IPv6 \u0BB5\u0BB0\u0BAE\u0BCD\u0BAA\u0BC1",
    base64: "base64-encoded \u0B9A\u0BB0\u0BAE\u0BCD",
    base64url: "base64url-encoded \u0B9A\u0BB0\u0BAE\u0BCD",
    json_string: "JSON \u0B9A\u0BB0\u0BAE\u0BCD",
    e164: "E.164 \u0B8E\u0BA3\u0BCD",
    jwt: "JWT",
    template_literal: "input"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "\u0B8E\u0BA3\u0BCD",
    array: "\u0B85\u0BA3\u0BBF",
    null: "\u0BB5\u0BC6\u0BB1\u0BC1\u0BAE\u0BC8"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 instanceof ${issue2.expected}, \u0BAA\u0BC6\u0BB1\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${received}`;
        }
        return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${expected}, \u0BAA\u0BC6\u0BB1\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${stringifyPrimitive(issue2.values[0])}`;
        return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0BB5\u0BBF\u0BB0\u0BC1\u0BAA\u0BCD\u0BAA\u0BAE\u0BCD: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${joinValues(issue2.values, "|")} \u0B87\u0BB2\u0BCD \u0B92\u0BA9\u0BCD\u0BB1\u0BC1`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `\u0BAE\u0BBF\u0B95 \u0BAA\u0BC6\u0BB0\u0BBF\u0BAF\u0BA4\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${issue2.origin ?? "\u0BAE\u0BA4\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1"} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "\u0B89\u0BB1\u0BC1\u0BAA\u0BCD\u0BAA\u0BC1\u0B95\u0BB3\u0BCD"} \u0B86\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        }
        return `\u0BAE\u0BBF\u0B95 \u0BAA\u0BC6\u0BB0\u0BBF\u0BAF\u0BA4\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${issue2.origin ?? "\u0BAE\u0BA4\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1"} ${adj}${issue2.maximum.toString()} \u0B86\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `\u0BAE\u0BBF\u0B95\u0B9A\u0BCD \u0B9A\u0BBF\u0BB1\u0BBF\u0BAF\u0BA4\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${issue2.origin} ${adj}${issue2.minimum.toString()} ${sizing.unit} \u0B86\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        }
        return `\u0BAE\u0BBF\u0B95\u0B9A\u0BCD \u0B9A\u0BBF\u0BB1\u0BBF\u0BAF\u0BA4\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${issue2.origin} ${adj}${issue2.minimum.toString()} \u0B86\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B9A\u0BB0\u0BAE\u0BCD: "${_issue.prefix}" \u0B87\u0BB2\u0BCD \u0BA4\u0BCA\u0B9F\u0B99\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        if (_issue.format === "ends_with")
          return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B9A\u0BB0\u0BAE\u0BCD: "${_issue.suffix}" \u0B87\u0BB2\u0BCD \u0BAE\u0BC1\u0B9F\u0BBF\u0BB5\u0B9F\u0BC8\u0BAF \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        if (_issue.format === "includes")
          return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B9A\u0BB0\u0BAE\u0BCD: "${_issue.includes}" \u0B90 \u0B89\u0BB3\u0BCD\u0BB3\u0B9F\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        if (_issue.format === "regex")
          return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B9A\u0BB0\u0BAE\u0BCD: ${_issue.pattern} \u0BAE\u0BC1\u0BB1\u0BC8\u0BAA\u0BBE\u0B9F\u0BCD\u0B9F\u0BC1\u0B9F\u0BA9\u0BCD \u0BAA\u0BCA\u0BB0\u0BC1\u0BA8\u0BCD\u0BA4 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B8E\u0BA3\u0BCD: ${issue2.divisor} \u0B87\u0BA9\u0BCD \u0BAA\u0BB2\u0BAE\u0BBE\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
      case "unrecognized_keys":
        return `\u0B85\u0B9F\u0BC8\u0BAF\u0BBE\u0BB3\u0BAE\u0BCD \u0BA4\u0BC6\u0BB0\u0BBF\u0BAF\u0BBE\u0BA4 \u0BB5\u0BBF\u0B9A\u0BC8${issue2.keys.length > 1 ? "\u0B95\u0BB3\u0BCD" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `${issue2.origin} \u0B87\u0BB2\u0BCD \u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0BB5\u0BBF\u0B9A\u0BC8`;
      case "invalid_union":
        return "\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1";
      case "invalid_element":
        return `${issue2.origin} \u0B87\u0BB2\u0BCD \u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0BAE\u0BA4\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1`;
      default:
        return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1`;
    }
  };
};
function ta_default() {
  return {
    localeError: error41()
  };
}

// node_modules/zod/v4/locales/th.js
var error42 = () => {
  const Sizable = {
    string: { unit: "\u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23", verb: "\u0E04\u0E27\u0E23\u0E21\u0E35" },
    file: { unit: "\u0E44\u0E1A\u0E15\u0E4C", verb: "\u0E04\u0E27\u0E23\u0E21\u0E35" },
    array: { unit: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23", verb: "\u0E04\u0E27\u0E23\u0E21\u0E35" },
    set: { unit: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23", verb: "\u0E04\u0E27\u0E23\u0E21\u0E35" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E1B\u0E49\u0E2D\u0E19",
    email: "\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E2D\u0E35\u0E40\u0E21\u0E25",
    url: "URL",
    emoji: "\u0E2D\u0E34\u0E42\u0E21\u0E08\u0E34",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E40\u0E27\u0E25\u0E32\u0E41\u0E1A\u0E1A ISO",
    date: "\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E41\u0E1A\u0E1A ISO",
    time: "\u0E40\u0E27\u0E25\u0E32\u0E41\u0E1A\u0E1A ISO",
    duration: "\u0E0A\u0E48\u0E27\u0E07\u0E40\u0E27\u0E25\u0E32\u0E41\u0E1A\u0E1A ISO",
    ipv4: "\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48 IPv4",
    ipv6: "\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48 IPv6",
    cidrv4: "\u0E0A\u0E48\u0E27\u0E07 IP \u0E41\u0E1A\u0E1A IPv4",
    cidrv6: "\u0E0A\u0E48\u0E27\u0E07 IP \u0E41\u0E1A\u0E1A IPv6",
    base64: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E1A\u0E1A Base64",
    base64url: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E1A\u0E1A Base64 \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A URL",
    json_string: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E1A\u0E1A JSON",
    e164: "\u0E40\u0E1A\u0E2D\u0E23\u0E4C\u0E42\u0E17\u0E23\u0E28\u0E31\u0E1E\u0E17\u0E4C\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E1B\u0E23\u0E30\u0E40\u0E17\u0E28 (E.164)",
    jwt: "\u0E42\u0E17\u0E40\u0E04\u0E19 JWT",
    template_literal: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E1B\u0E49\u0E2D\u0E19"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02",
    array: "\u0E2D\u0E32\u0E23\u0E4C\u0E40\u0E23\u0E22\u0E4C (Array)",
    null: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E48\u0E32 (null)"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E04\u0E27\u0E23\u0E40\u0E1B\u0E47\u0E19 instanceof ${issue2.expected} \u0E41\u0E15\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A ${received}`;
        }
        return `\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E04\u0E27\u0E23\u0E40\u0E1B\u0E47\u0E19 ${expected} \u0E41\u0E15\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\u0E04\u0E48\u0E32\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E04\u0E27\u0E23\u0E40\u0E1B\u0E47\u0E19 ${stringifyPrimitive(issue2.values[0])}`;
        return `\u0E15\u0E31\u0E27\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E04\u0E27\u0E23\u0E40\u0E1B\u0E47\u0E19\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E43\u0E19 ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "\u0E44\u0E21\u0E48\u0E40\u0E01\u0E34\u0E19" : "\u0E19\u0E49\u0E2D\u0E22\u0E01\u0E27\u0E48\u0E32";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14: ${issue2.origin ?? "\u0E04\u0E48\u0E32"} \u0E04\u0E27\u0E23\u0E21\u0E35${adj} ${issue2.maximum.toString()} ${sizing.unit ?? "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23"}`;
        return `\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14: ${issue2.origin ?? "\u0E04\u0E48\u0E32"} \u0E04\u0E27\u0E23\u0E21\u0E35${adj} ${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? "\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E49\u0E2D\u0E22" : "\u0E21\u0E32\u0E01\u0E01\u0E27\u0E48\u0E32";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `\u0E19\u0E49\u0E2D\u0E22\u0E01\u0E27\u0E48\u0E32\u0E01\u0E33\u0E2B\u0E19\u0E14: ${issue2.origin} \u0E04\u0E27\u0E23\u0E21\u0E35${adj} ${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `\u0E19\u0E49\u0E2D\u0E22\u0E01\u0E27\u0E48\u0E32\u0E01\u0E33\u0E2B\u0E19\u0E14: ${issue2.origin} \u0E04\u0E27\u0E23\u0E21\u0E35${adj} ${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E07\u0E02\u0E36\u0E49\u0E19\u0E15\u0E49\u0E19\u0E14\u0E49\u0E27\u0E22 "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E07\u0E25\u0E07\u0E17\u0E49\u0E32\u0E22\u0E14\u0E49\u0E27\u0E22 "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35 "${_issue.includes}" \u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21`;
        if (_issue.format === "regex")
          return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E15\u0E49\u0E2D\u0E07\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E17\u0E35\u0E48\u0E01\u0E33\u0E2B\u0E19\u0E14 ${_issue.pattern}`;
        return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E08\u0E33\u0E19\u0E27\u0E19\u0E17\u0E35\u0E48\u0E2B\u0E32\u0E23\u0E14\u0E49\u0E27\u0E22 ${issue2.divisor} \u0E44\u0E14\u0E49\u0E25\u0E07\u0E15\u0E31\u0E27`;
      case "unrecognized_keys":
        return `\u0E1E\u0E1A\u0E04\u0E35\u0E22\u0E4C\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49\u0E08\u0E31\u0E01: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `\u0E04\u0E35\u0E22\u0E4C\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E19 ${issue2.origin}`;
      case "invalid_union":
        return "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E44\u0E21\u0E48\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E22\u0E39\u0E40\u0E19\u0E35\u0E22\u0E19\u0E17\u0E35\u0E48\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E44\u0E27\u0E49";
      case "invalid_element":
        return `\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E19 ${issue2.origin}`;
      default:
        return `\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07`;
    }
  };
};
function th_default() {
  return {
    localeError: error42()
  };
}

// node_modules/zod/v4/locales/tr.js
var error43 = () => {
  const Sizable = {
    string: { unit: "karakter", verb: "olmal\u0131" },
    file: { unit: "bayt", verb: "olmal\u0131" },
    array: { unit: "\xF6\u011Fe", verb: "olmal\u0131" },
    set: { unit: "\xF6\u011Fe", verb: "olmal\u0131" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "girdi",
    email: "e-posta adresi",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO tarih ve saat",
    date: "ISO tarih",
    time: "ISO saat",
    duration: "ISO s\xFCre",
    ipv4: "IPv4 adresi",
    ipv6: "IPv6 adresi",
    cidrv4: "IPv4 aral\u0131\u011F\u0131",
    cidrv6: "IPv6 aral\u0131\u011F\u0131",
    base64: "base64 ile \u015Fifrelenmi\u015F metin",
    base64url: "base64url ile \u015Fifrelenmi\u015F metin",
    json_string: "JSON dizesi",
    e164: "E.164 say\u0131s\u0131",
    jwt: "JWT",
    template_literal: "\u015Eablon dizesi"
  };
  const TypeDictionary = {
    nan: "NaN"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Ge\xE7ersiz de\u011Fer: beklenen instanceof ${issue2.expected}, al\u0131nan ${received}`;
        }
        return `Ge\xE7ersiz de\u011Fer: beklenen ${expected}, al\u0131nan ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Ge\xE7ersiz de\u011Fer: beklenen ${stringifyPrimitive(issue2.values[0])}`;
        return `Ge\xE7ersiz se\xE7enek: a\u015Fa\u011F\u0131dakilerden biri olmal\u0131: ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `\xC7ok b\xFCy\xFCk: beklenen ${issue2.origin ?? "de\u011Fer"} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "\xF6\u011Fe"}`;
        return `\xC7ok b\xFCy\xFCk: beklenen ${issue2.origin ?? "de\u011Fer"} ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `\xC7ok k\xFC\xE7\xFCk: beklenen ${issue2.origin} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        return `\xC7ok k\xFC\xE7\xFCk: beklenen ${issue2.origin} ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Ge\xE7ersiz metin: "${_issue.prefix}" ile ba\u015Flamal\u0131`;
        if (_issue.format === "ends_with")
          return `Ge\xE7ersiz metin: "${_issue.suffix}" ile bitmeli`;
        if (_issue.format === "includes")
          return `Ge\xE7ersiz metin: "${_issue.includes}" i\xE7ermeli`;
        if (_issue.format === "regex")
          return `Ge\xE7ersiz metin: ${_issue.pattern} desenine uymal\u0131`;
        return `Ge\xE7ersiz ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Ge\xE7ersiz say\u0131: ${issue2.divisor} ile tam b\xF6l\xFCnebilmeli`;
      case "unrecognized_keys":
        return `Tan\u0131nmayan anahtar${issue2.keys.length > 1 ? "lar" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `${issue2.origin} i\xE7inde ge\xE7ersiz anahtar`;
      case "invalid_union":
        return "Ge\xE7ersiz de\u011Fer";
      case "invalid_element":
        return `${issue2.origin} i\xE7inde ge\xE7ersiz de\u011Fer`;
      default:
        return `Ge\xE7ersiz de\u011Fer`;
    }
  };
};
function tr_default() {
  return {
    localeError: error43()
  };
}

// node_modules/zod/v4/locales/uk.js
var error44 = () => {
  const Sizable = {
    string: { unit: "\u0441\u0438\u043C\u0432\u043E\u043B\u0456\u0432", verb: "\u043C\u0430\u0442\u0438\u043C\u0435" },
    file: { unit: "\u0431\u0430\u0439\u0442\u0456\u0432", verb: "\u043C\u0430\u0442\u0438\u043C\u0435" },
    array: { unit: "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432", verb: "\u043C\u0430\u0442\u0438\u043C\u0435" },
    set: { unit: "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432", verb: "\u043C\u0430\u0442\u0438\u043C\u0435" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456",
    email: "\u0430\u0434\u0440\u0435\u0441\u0430 \u0435\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E\u0457 \u043F\u043E\u0448\u0442\u0438",
    url: "URL",
    emoji: "\u0435\u043C\u043E\u0434\u0437\u0456",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "\u0434\u0430\u0442\u0430 \u0442\u0430 \u0447\u0430\u0441 ISO",
    date: "\u0434\u0430\u0442\u0430 ISO",
    time: "\u0447\u0430\u0441 ISO",
    duration: "\u0442\u0440\u0438\u0432\u0430\u043B\u0456\u0441\u0442\u044C ISO",
    ipv4: "\u0430\u0434\u0440\u0435\u0441\u0430 IPv4",
    ipv6: "\u0430\u0434\u0440\u0435\u0441\u0430 IPv6",
    cidrv4: "\u0434\u0456\u0430\u043F\u0430\u0437\u043E\u043D IPv4",
    cidrv6: "\u0434\u0456\u0430\u043F\u0430\u0437\u043E\u043D IPv6",
    base64: "\u0440\u044F\u0434\u043E\u043A \u0443 \u043A\u043E\u0434\u0443\u0432\u0430\u043D\u043D\u0456 base64",
    base64url: "\u0440\u044F\u0434\u043E\u043A \u0443 \u043A\u043E\u0434\u0443\u0432\u0430\u043D\u043D\u0456 base64url",
    json_string: "\u0440\u044F\u0434\u043E\u043A JSON",
    e164: "\u043D\u043E\u043C\u0435\u0440 E.164",
    jwt: "JWT",
    template_literal: "\u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "\u0447\u0438\u0441\u043B\u043E",
    array: "\u043C\u0430\u0441\u0438\u0432"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F instanceof ${issue2.expected}, \u043E\u0442\u0440\u0438\u043C\u0430\u043D\u043E ${received}`;
        }
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F ${expected}, \u043E\u0442\u0440\u0438\u043C\u0430\u043D\u043E ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F ${stringifyPrimitive(issue2.values[0])}`;
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0430 \u043E\u043F\u0446\u0456\u044F: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F \u043E\u0434\u043D\u0435 \u0437 ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `\u0417\u0430\u043D\u0430\u0434\u0442\u043E \u0432\u0435\u043B\u0438\u043A\u0435: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F, \u0449\u043E ${issue2.origin ?? "\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F"} ${sizing.verb} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432"}`;
        return `\u0417\u0430\u043D\u0430\u0434\u0442\u043E \u0432\u0435\u043B\u0438\u043A\u0435: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F, \u0449\u043E ${issue2.origin ?? "\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F"} \u0431\u0443\u0434\u0435 ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `\u0417\u0430\u043D\u0430\u0434\u0442\u043E \u043C\u0430\u043B\u0435: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F, \u0449\u043E ${issue2.origin} ${sizing.verb} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `\u0417\u0430\u043D\u0430\u0434\u0442\u043E \u043C\u0430\u043B\u0435: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F, \u0449\u043E ${issue2.origin} \u0431\u0443\u0434\u0435 ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u0440\u044F\u0434\u043E\u043A: \u043F\u043E\u0432\u0438\u043D\u0435\u043D \u043F\u043E\u0447\u0438\u043D\u0430\u0442\u0438\u0441\u044F \u0437 "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u0440\u044F\u0434\u043E\u043A: \u043F\u043E\u0432\u0438\u043D\u0435\u043D \u0437\u0430\u043A\u0456\u043D\u0447\u0443\u0432\u0430\u0442\u0438\u0441\u044F \u043D\u0430 "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u0440\u044F\u0434\u043E\u043A: \u043F\u043E\u0432\u0438\u043D\u0435\u043D \u043C\u0456\u0441\u0442\u0438\u0442\u0438 "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u0440\u044F\u0434\u043E\u043A: \u043F\u043E\u0432\u0438\u043D\u0435\u043D \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0442\u0438 \u0448\u0430\u0431\u043B\u043E\u043D\u0443 ${_issue.pattern}`;
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0435 \u0447\u0438\u0441\u043B\u043E: \u043F\u043E\u0432\u0438\u043D\u043D\u043E \u0431\u0443\u0442\u0438 \u043A\u0440\u0430\u0442\u043D\u0438\u043C ${issue2.divisor}`;
      case "unrecognized_keys":
        return `\u041D\u0435\u0440\u043E\u0437\u043F\u0456\u0437\u043D\u0430\u043D\u0438\u0439 \u043A\u043B\u044E\u0447${issue2.keys.length > 1 ? "\u0456" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u043A\u043B\u044E\u0447 \u0443 ${issue2.origin}`;
      case "invalid_union":
        return "\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456";
      case "invalid_element":
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0443 ${issue2.origin}`;
      default:
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456`;
    }
  };
};
function uk_default() {
  return {
    localeError: error44()
  };
}

// node_modules/zod/v4/locales/ua.js
function ua_default() {
  return uk_default();
}

// node_modules/zod/v4/locales/ur.js
var error45 = () => {
  const Sizable = {
    string: { unit: "\u062D\u0631\u0648\u0641", verb: "\u06C1\u0648\u0646\u0627" },
    file: { unit: "\u0628\u0627\u0626\u0679\u0633", verb: "\u06C1\u0648\u0646\u0627" },
    array: { unit: "\u0622\u0626\u0679\u0645\u0632", verb: "\u06C1\u0648\u0646\u0627" },
    set: { unit: "\u0622\u0626\u0679\u0645\u0632", verb: "\u06C1\u0648\u0646\u0627" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u0627\u0646 \u067E\u0679",
    email: "\u0627\u06CC \u0645\u06CC\u0644 \u0627\u06CC\u0688\u0631\u06CC\u0633",
    url: "\u06CC\u0648 \u0622\u0631 \u0627\u06CC\u0644",
    emoji: "\u0627\u06CC\u0645\u0648\u062C\u06CC",
    uuid: "\u06CC\u0648 \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC",
    uuidv4: "\u06CC\u0648 \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC \u0648\u06CC 4",
    uuidv6: "\u06CC\u0648 \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC \u0648\u06CC 6",
    nanoid: "\u0646\u06CC\u0646\u0648 \u0622\u0626\u06CC \u0688\u06CC",
    guid: "\u062C\u06CC \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC",
    cuid: "\u0633\u06CC \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC",
    cuid2: "\u0633\u06CC \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC 2",
    ulid: "\u06CC\u0648 \u0627\u06CC\u0644 \u0622\u0626\u06CC \u0688\u06CC",
    xid: "\u0627\u06CC\u06A9\u0633 \u0622\u0626\u06CC \u0688\u06CC",
    ksuid: "\u06A9\u06D2 \u0627\u06CC\u0633 \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC",
    datetime: "\u0622\u0626\u06CC \u0627\u06CC\u0633 \u0627\u0648 \u0688\u06CC\u0679 \u0679\u0627\u0626\u0645",
    date: "\u0622\u0626\u06CC \u0627\u06CC\u0633 \u0627\u0648 \u062A\u0627\u0631\u06CC\u062E",
    time: "\u0622\u0626\u06CC \u0627\u06CC\u0633 \u0627\u0648 \u0648\u0642\u062A",
    duration: "\u0622\u0626\u06CC \u0627\u06CC\u0633 \u0627\u0648 \u0645\u062F\u062A",
    ipv4: "\u0622\u0626\u06CC \u067E\u06CC \u0648\u06CC 4 \u0627\u06CC\u0688\u0631\u06CC\u0633",
    ipv6: "\u0622\u0626\u06CC \u067E\u06CC \u0648\u06CC 6 \u0627\u06CC\u0688\u0631\u06CC\u0633",
    cidrv4: "\u0622\u0626\u06CC \u067E\u06CC \u0648\u06CC 4 \u0631\u06CC\u0646\u062C",
    cidrv6: "\u0622\u0626\u06CC \u067E\u06CC \u0648\u06CC 6 \u0631\u06CC\u0646\u062C",
    base64: "\u0628\u06CC\u0633 64 \u0627\u0646 \u06A9\u0648\u0688\u0688 \u0633\u0679\u0631\u0646\u06AF",
    base64url: "\u0628\u06CC\u0633 64 \u06CC\u0648 \u0622\u0631 \u0627\u06CC\u0644 \u0627\u0646 \u06A9\u0648\u0688\u0688 \u0633\u0679\u0631\u0646\u06AF",
    json_string: "\u062C\u06D2 \u0627\u06CC\u0633 \u0627\u0648 \u0627\u06CC\u0646 \u0633\u0679\u0631\u0646\u06AF",
    e164: "\u0627\u06CC 164 \u0646\u0645\u0628\u0631",
    jwt: "\u062C\u06D2 \u0688\u0628\u0644\u06CC\u0648 \u0679\u06CC",
    template_literal: "\u0627\u0646 \u067E\u0679"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "\u0646\u0645\u0628\u0631",
    array: "\u0622\u0631\u06D2",
    null: "\u0646\u0644"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679: instanceof ${issue2.expected} \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627\u060C ${received} \u0645\u0648\u0635\u0648\u0644 \u06C1\u0648\u0627`;
        }
        return `\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679: ${expected} \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627\u060C ${received} \u0645\u0648\u0635\u0648\u0644 \u06C1\u0648\u0627`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679: ${stringifyPrimitive(issue2.values[0])} \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627`;
        return `\u063A\u0644\u0637 \u0622\u067E\u0634\u0646: ${joinValues(issue2.values, "|")} \u0645\u06CC\u06BA \u0633\u06D2 \u0627\u06CC\u06A9 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `\u0628\u06C1\u062A \u0628\u0691\u0627: ${issue2.origin ?? "\u0648\u06CC\u0644\u06CC\u0648"} \u06A9\u06D2 ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "\u0639\u0646\u0627\u0635\u0631"} \u06C1\u0648\u0646\u06D2 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u06D2`;
        return `\u0628\u06C1\u062A \u0628\u0691\u0627: ${issue2.origin ?? "\u0648\u06CC\u0644\u06CC\u0648"} \u06A9\u0627 ${adj}${issue2.maximum.toString()} \u06C1\u0648\u0646\u0627 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `\u0628\u06C1\u062A \u0686\u06BE\u0648\u0679\u0627: ${issue2.origin} \u06A9\u06D2 ${adj}${issue2.minimum.toString()} ${sizing.unit} \u06C1\u0648\u0646\u06D2 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u06D2`;
        }
        return `\u0628\u06C1\u062A \u0686\u06BE\u0648\u0679\u0627: ${issue2.origin} \u06A9\u0627 ${adj}${issue2.minimum.toString()} \u06C1\u0648\u0646\u0627 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `\u063A\u0644\u0637 \u0633\u0679\u0631\u0646\u06AF: "${_issue.prefix}" \u0633\u06D2 \u0634\u0631\u0648\u0639 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
        }
        if (_issue.format === "ends_with")
          return `\u063A\u0644\u0637 \u0633\u0679\u0631\u0646\u06AF: "${_issue.suffix}" \u067E\u0631 \u062E\u062A\u0645 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
        if (_issue.format === "includes")
          return `\u063A\u0644\u0637 \u0633\u0679\u0631\u0646\u06AF: "${_issue.includes}" \u0634\u0627\u0645\u0644 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
        if (_issue.format === "regex")
          return `\u063A\u0644\u0637 \u0633\u0679\u0631\u0646\u06AF: \u067E\u06CC\u0679\u0631\u0646 ${_issue.pattern} \u0633\u06D2 \u0645\u06CC\u0686 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
        return `\u063A\u0644\u0637 ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `\u063A\u0644\u0637 \u0646\u0645\u0628\u0631: ${issue2.divisor} \u06A9\u0627 \u0645\u0636\u0627\u0639\u0641 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
      case "unrecognized_keys":
        return `\u063A\u06CC\u0631 \u062A\u0633\u0644\u06CC\u0645 \u0634\u062F\u06C1 \u06A9\u06CC${issue2.keys.length > 1 ? "\u0632" : ""}: ${joinValues(issue2.keys, "\u060C ")}`;
      case "invalid_key":
        return `${issue2.origin} \u0645\u06CC\u06BA \u063A\u0644\u0637 \u06A9\u06CC`;
      case "invalid_union":
        return "\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679";
      case "invalid_element":
        return `${issue2.origin} \u0645\u06CC\u06BA \u063A\u0644\u0637 \u0648\u06CC\u0644\u06CC\u0648`;
      default:
        return `\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679`;
    }
  };
};
function ur_default() {
  return {
    localeError: error45()
  };
}

// node_modules/zod/v4/locales/uz.js
var error46 = () => {
  const Sizable = {
    string: { unit: "belgi", verb: "bo\u2018lishi kerak" },
    file: { unit: "bayt", verb: "bo\u2018lishi kerak" },
    array: { unit: "element", verb: "bo\u2018lishi kerak" },
    set: { unit: "element", verb: "bo\u2018lishi kerak" },
    map: { unit: "yozuv", verb: "bo\u2018lishi kerak" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "kirish",
    email: "elektron pochta manzili",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO sana va vaqti",
    date: "ISO sana",
    time: "ISO vaqt",
    duration: "ISO davomiylik",
    ipv4: "IPv4 manzil",
    ipv6: "IPv6 manzil",
    mac: "MAC manzil",
    cidrv4: "IPv4 diapazon",
    cidrv6: "IPv6 diapazon",
    base64: "base64 kodlangan satr",
    base64url: "base64url kodlangan satr",
    json_string: "JSON satr",
    e164: "E.164 raqam",
    jwt: "JWT",
    template_literal: "kirish"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "raqam",
    array: "massiv"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `Noto\u2018g\u2018ri kirish: kutilgan instanceof ${issue2.expected}, qabul qilingan ${received}`;
        }
        return `Noto\u2018g\u2018ri kirish: kutilgan ${expected}, qabul qilingan ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Noto\u2018g\u2018ri kirish: kutilgan ${stringifyPrimitive(issue2.values[0])}`;
        return `Noto\u2018g\u2018ri variant: quyidagilardan biri kutilgan ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Juda katta: kutilgan ${issue2.origin ?? "qiymat"} ${adj}${issue2.maximum.toString()} ${sizing.unit} ${sizing.verb}`;
        return `Juda katta: kutilgan ${issue2.origin ?? "qiymat"} ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Juda kichik: kutilgan ${issue2.origin} ${adj}${issue2.minimum.toString()} ${sizing.unit} ${sizing.verb}`;
        }
        return `Juda kichik: kutilgan ${issue2.origin} ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Noto\u2018g\u2018ri satr: "${_issue.prefix}" bilan boshlanishi kerak`;
        if (_issue.format === "ends_with")
          return `Noto\u2018g\u2018ri satr: "${_issue.suffix}" bilan tugashi kerak`;
        if (_issue.format === "includes")
          return `Noto\u2018g\u2018ri satr: "${_issue.includes}" ni o\u2018z ichiga olishi kerak`;
        if (_issue.format === "regex")
          return `Noto\u2018g\u2018ri satr: ${_issue.pattern} shabloniga mos kelishi kerak`;
        return `Noto\u2018g\u2018ri ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Noto\u2018g\u2018ri raqam: ${issue2.divisor} ning karralisi bo\u2018lishi kerak`;
      case "unrecognized_keys":
        return `Noma\u2019lum kalit${issue2.keys.length > 1 ? "lar" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `${issue2.origin} dagi kalit noto\u2018g\u2018ri`;
      case "invalid_union":
        return "Noto\u2018g\u2018ri kirish";
      case "invalid_element":
        return `${issue2.origin} da noto\u2018g\u2018ri qiymat`;
      default:
        return `Noto\u2018g\u2018ri kirish`;
    }
  };
};
function uz_default() {
  return {
    localeError: error46()
  };
}

// node_modules/zod/v4/locales/vi.js
var error47 = () => {
  const Sizable = {
    string: { unit: "k\xFD t\u1EF1", verb: "c\xF3" },
    file: { unit: "byte", verb: "c\xF3" },
    array: { unit: "ph\u1EA7n t\u1EED", verb: "c\xF3" },
    set: { unit: "ph\u1EA7n t\u1EED", verb: "c\xF3" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u0111\u1EA7u v\xE0o",
    email: "\u0111\u1ECBa ch\u1EC9 email",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ng\xE0y gi\u1EDD ISO",
    date: "ng\xE0y ISO",
    time: "gi\u1EDD ISO",
    duration: "kho\u1EA3ng th\u1EDDi gian ISO",
    ipv4: "\u0111\u1ECBa ch\u1EC9 IPv4",
    ipv6: "\u0111\u1ECBa ch\u1EC9 IPv6",
    cidrv4: "d\u1EA3i IPv4",
    cidrv6: "d\u1EA3i IPv6",
    base64: "chu\u1ED7i m\xE3 h\xF3a base64",
    base64url: "chu\u1ED7i m\xE3 h\xF3a base64url",
    json_string: "chu\u1ED7i JSON",
    e164: "s\u1ED1 E.164",
    jwt: "JWT",
    template_literal: "\u0111\u1EA7u v\xE0o"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "s\u1ED1",
    array: "m\u1EA3ng"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7: mong \u0111\u1EE3i instanceof ${issue2.expected}, nh\u1EADn \u0111\u01B0\u1EE3c ${received}`;
        }
        return `\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7: mong \u0111\u1EE3i ${expected}, nh\u1EADn \u0111\u01B0\u1EE3c ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7: mong \u0111\u1EE3i ${stringifyPrimitive(issue2.values[0])}`;
        return `T\xF9y ch\u1ECDn kh\xF4ng h\u1EE3p l\u1EC7: mong \u0111\u1EE3i m\u1ED9t trong c\xE1c gi\xE1 tr\u1ECB ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Qu\xE1 l\u1EDBn: mong \u0111\u1EE3i ${issue2.origin ?? "gi\xE1 tr\u1ECB"} ${sizing.verb} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "ph\u1EA7n t\u1EED"}`;
        return `Qu\xE1 l\u1EDBn: mong \u0111\u1EE3i ${issue2.origin ?? "gi\xE1 tr\u1ECB"} ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Qu\xE1 nh\u1ECF: mong \u0111\u1EE3i ${issue2.origin} ${sizing.verb} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Qu\xE1 nh\u1ECF: mong \u0111\u1EE3i ${issue2.origin} ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Chu\u1ED7i kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i b\u1EAFt \u0111\u1EA7u b\u1EB1ng "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Chu\u1ED7i kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i k\u1EBFt th\xFAc b\u1EB1ng "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Chu\u1ED7i kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i bao g\u1ED3m "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Chu\u1ED7i kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i kh\u1EDBp v\u1EDBi m\u1EABu ${_issue.pattern}`;
        return `${FormatDictionary[_issue.format] ?? issue2.format} kh\xF4ng h\u1EE3p l\u1EC7`;
      }
      case "not_multiple_of":
        return `S\u1ED1 kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i l\xE0 b\u1ED9i s\u1ED1 c\u1EE7a ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Kh\xF3a kh\xF4ng \u0111\u01B0\u1EE3c nh\u1EADn d\u1EA1ng: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Kh\xF3a kh\xF4ng h\u1EE3p l\u1EC7 trong ${issue2.origin}`;
      case "invalid_union":
        return "\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7";
      case "invalid_element":
        return `Gi\xE1 tr\u1ECB kh\xF4ng h\u1EE3p l\u1EC7 trong ${issue2.origin}`;
      default:
        return `\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7`;
    }
  };
};
function vi_default() {
  return {
    localeError: error47()
  };
}

// node_modules/zod/v4/locales/zh-CN.js
var error48 = () => {
  const Sizable = {
    string: { unit: "\u5B57\u7B26", verb: "\u5305\u542B" },
    file: { unit: "\u5B57\u8282", verb: "\u5305\u542B" },
    array: { unit: "\u9879", verb: "\u5305\u542B" },
    set: { unit: "\u9879", verb: "\u5305\u542B" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u8F93\u5165",
    email: "\u7535\u5B50\u90AE\u4EF6",
    url: "URL",
    emoji: "\u8868\u60C5\u7B26\u53F7",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO\u65E5\u671F\u65F6\u95F4",
    date: "ISO\u65E5\u671F",
    time: "ISO\u65F6\u95F4",
    duration: "ISO\u65F6\u957F",
    ipv4: "IPv4\u5730\u5740",
    ipv6: "IPv6\u5730\u5740",
    cidrv4: "IPv4\u7F51\u6BB5",
    cidrv6: "IPv6\u7F51\u6BB5",
    base64: "base64\u7F16\u7801\u5B57\u7B26\u4E32",
    base64url: "base64url\u7F16\u7801\u5B57\u7B26\u4E32",
    json_string: "JSON\u5B57\u7B26\u4E32",
    e164: "E.164\u53F7\u7801",
    jwt: "JWT",
    template_literal: "\u8F93\u5165"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "\u6570\u5B57",
    array: "\u6570\u7EC4",
    null: "\u7A7A\u503C(null)"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u65E0\u6548\u8F93\u5165\uFF1A\u671F\u671B instanceof ${issue2.expected}\uFF0C\u5B9E\u9645\u63A5\u6536 ${received}`;
        }
        return `\u65E0\u6548\u8F93\u5165\uFF1A\u671F\u671B ${expected}\uFF0C\u5B9E\u9645\u63A5\u6536 ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\u65E0\u6548\u8F93\u5165\uFF1A\u671F\u671B ${stringifyPrimitive(issue2.values[0])}`;
        return `\u65E0\u6548\u9009\u9879\uFF1A\u671F\u671B\u4EE5\u4E0B\u4E4B\u4E00 ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `\u6570\u503C\u8FC7\u5927\uFF1A\u671F\u671B ${issue2.origin ?? "\u503C"} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "\u4E2A\u5143\u7D20"}`;
        return `\u6570\u503C\u8FC7\u5927\uFF1A\u671F\u671B ${issue2.origin ?? "\u503C"} ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `\u6570\u503C\u8FC7\u5C0F\uFF1A\u671F\u671B ${issue2.origin} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `\u6570\u503C\u8FC7\u5C0F\uFF1A\u671F\u671B ${issue2.origin} ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `\u65E0\u6548\u5B57\u7B26\u4E32\uFF1A\u5FC5\u987B\u4EE5 "${_issue.prefix}" \u5F00\u5934`;
        if (_issue.format === "ends_with")
          return `\u65E0\u6548\u5B57\u7B26\u4E32\uFF1A\u5FC5\u987B\u4EE5 "${_issue.suffix}" \u7ED3\u5C3E`;
        if (_issue.format === "includes")
          return `\u65E0\u6548\u5B57\u7B26\u4E32\uFF1A\u5FC5\u987B\u5305\u542B "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `\u65E0\u6548\u5B57\u7B26\u4E32\uFF1A\u5FC5\u987B\u6EE1\u8DB3\u6B63\u5219\u8868\u8FBE\u5F0F ${_issue.pattern}`;
        return `\u65E0\u6548${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `\u65E0\u6548\u6570\u5B57\uFF1A\u5FC5\u987B\u662F ${issue2.divisor} \u7684\u500D\u6570`;
      case "unrecognized_keys":
        return `\u51FA\u73B0\u672A\u77E5\u7684\u952E(key): ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `${issue2.origin} \u4E2D\u7684\u952E(key)\u65E0\u6548`;
      case "invalid_union":
        return "\u65E0\u6548\u8F93\u5165";
      case "invalid_element":
        return `${issue2.origin} \u4E2D\u5305\u542B\u65E0\u6548\u503C(value)`;
      default:
        return `\u65E0\u6548\u8F93\u5165`;
    }
  };
};
function zh_CN_default() {
  return {
    localeError: error48()
  };
}

// node_modules/zod/v4/locales/zh-TW.js
var error49 = () => {
  const Sizable = {
    string: { unit: "\u5B57\u5143", verb: "\u64C1\u6709" },
    file: { unit: "\u4F4D\u5143\u7D44", verb: "\u64C1\u6709" },
    array: { unit: "\u9805\u76EE", verb: "\u64C1\u6709" },
    set: { unit: "\u9805\u76EE", verb: "\u64C1\u6709" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u8F38\u5165",
    email: "\u90F5\u4EF6\u5730\u5740",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO \u65E5\u671F\u6642\u9593",
    date: "ISO \u65E5\u671F",
    time: "ISO \u6642\u9593",
    duration: "ISO \u671F\u9593",
    ipv4: "IPv4 \u4F4D\u5740",
    ipv6: "IPv6 \u4F4D\u5740",
    cidrv4: "IPv4 \u7BC4\u570D",
    cidrv6: "IPv6 \u7BC4\u570D",
    base64: "base64 \u7DE8\u78BC\u5B57\u4E32",
    base64url: "base64url \u7DE8\u78BC\u5B57\u4E32",
    json_string: "JSON \u5B57\u4E32",
    e164: "E.164 \u6578\u503C",
    jwt: "JWT",
    template_literal: "\u8F38\u5165"
  };
  const TypeDictionary = {
    nan: "NaN"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\u7121\u6548\u7684\u8F38\u5165\u503C\uFF1A\u9810\u671F\u70BA instanceof ${issue2.expected}\uFF0C\u4F46\u6536\u5230 ${received}`;
        }
        return `\u7121\u6548\u7684\u8F38\u5165\u503C\uFF1A\u9810\u671F\u70BA ${expected}\uFF0C\u4F46\u6536\u5230 ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\u7121\u6548\u7684\u8F38\u5165\u503C\uFF1A\u9810\u671F\u70BA ${stringifyPrimitive(issue2.values[0])}`;
        return `\u7121\u6548\u7684\u9078\u9805\uFF1A\u9810\u671F\u70BA\u4EE5\u4E0B\u5176\u4E2D\u4E4B\u4E00 ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `\u6578\u503C\u904E\u5927\uFF1A\u9810\u671F ${issue2.origin ?? "\u503C"} \u61C9\u70BA ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "\u500B\u5143\u7D20"}`;
        return `\u6578\u503C\u904E\u5927\uFF1A\u9810\u671F ${issue2.origin ?? "\u503C"} \u61C9\u70BA ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `\u6578\u503C\u904E\u5C0F\uFF1A\u9810\u671F ${issue2.origin} \u61C9\u70BA ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `\u6578\u503C\u904E\u5C0F\uFF1A\u9810\u671F ${issue2.origin} \u61C9\u70BA ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `\u7121\u6548\u7684\u5B57\u4E32\uFF1A\u5FC5\u9808\u4EE5 "${_issue.prefix}" \u958B\u982D`;
        }
        if (_issue.format === "ends_with")
          return `\u7121\u6548\u7684\u5B57\u4E32\uFF1A\u5FC5\u9808\u4EE5 "${_issue.suffix}" \u7D50\u5C3E`;
        if (_issue.format === "includes")
          return `\u7121\u6548\u7684\u5B57\u4E32\uFF1A\u5FC5\u9808\u5305\u542B "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `\u7121\u6548\u7684\u5B57\u4E32\uFF1A\u5FC5\u9808\u7B26\u5408\u683C\u5F0F ${_issue.pattern}`;
        return `\u7121\u6548\u7684 ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `\u7121\u6548\u7684\u6578\u5B57\uFF1A\u5FC5\u9808\u70BA ${issue2.divisor} \u7684\u500D\u6578`;
      case "unrecognized_keys":
        return `\u7121\u6CD5\u8B58\u5225\u7684\u9375\u503C${issue2.keys.length > 1 ? "\u5011" : ""}\uFF1A${joinValues(issue2.keys, "\u3001")}`;
      case "invalid_key":
        return `${issue2.origin} \u4E2D\u6709\u7121\u6548\u7684\u9375\u503C`;
      case "invalid_union":
        return "\u7121\u6548\u7684\u8F38\u5165\u503C";
      case "invalid_element":
        return `${issue2.origin} \u4E2D\u6709\u7121\u6548\u7684\u503C`;
      default:
        return `\u7121\u6548\u7684\u8F38\u5165\u503C`;
    }
  };
};
function zh_TW_default() {
  return {
    localeError: error49()
  };
}

// node_modules/zod/v4/locales/yo.js
var error50 = () => {
  const Sizable = {
    string: { unit: "\xE0mi", verb: "n\xED" },
    file: { unit: "bytes", verb: "n\xED" },
    array: { unit: "nkan", verb: "n\xED" },
    set: { unit: "nkan", verb: "n\xED" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "\u1EB9\u0300r\u1ECD \xECb\xE1w\u1ECDl\xE9",
    email: "\xE0d\xEDr\u1EB9\u0301s\xEC \xECm\u1EB9\u0301l\xEC",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "\xE0k\xF3k\xF2 ISO",
    date: "\u1ECDj\u1ECD\u0301 ISO",
    time: "\xE0k\xF3k\xF2 ISO",
    duration: "\xE0k\xF3k\xF2 t\xF3 p\xE9 ISO",
    ipv4: "\xE0d\xEDr\u1EB9\u0301s\xEC IPv4",
    ipv6: "\xE0d\xEDr\u1EB9\u0301s\xEC IPv6",
    cidrv4: "\xE0gb\xE8gb\xE8 IPv4",
    cidrv6: "\xE0gb\xE8gb\xE8 IPv6",
    base64: "\u1ECD\u0300r\u1ECD\u0300 t\xED a k\u1ECD\u0301 n\xED base64",
    base64url: "\u1ECD\u0300r\u1ECD\u0300 base64url",
    json_string: "\u1ECD\u0300r\u1ECD\u0300 JSON",
    e164: "n\u1ECD\u0301mb\xE0 E.164",
    jwt: "JWT",
    template_literal: "\u1EB9\u0300r\u1ECD \xECb\xE1w\u1ECDl\xE9"
  };
  const TypeDictionary = {
    nan: "NaN",
    number: "n\u1ECD\u0301mb\xE0",
    array: "akop\u1ECD"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = TypeDictionary[issue2.expected] ?? issue2.expected;
        const receivedType = parsedType(issue2.input);
        const received = TypeDictionary[receivedType] ?? receivedType;
        if (/^[A-Z]/.test(issue2.expected)) {
          return `\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e: a n\xED l\xE1ti fi instanceof ${issue2.expected}, \xE0m\u1ECD\u0300 a r\xED ${received}`;
        }
        return `\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e: a n\xED l\xE1ti fi ${expected}, \xE0m\u1ECD\u0300 a r\xED ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e: a n\xED l\xE1ti fi ${stringifyPrimitive(issue2.values[0])}`;
        return `\xC0\u1E63\xE0y\xE0n a\u1E63\xEC\u1E63e: yan \u1ECD\u0300kan l\xE1ra ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `T\xF3 p\u1ECD\u0300 j\xF9: a n\xED l\xE1ti j\u1EB9\u0301 p\xE9 ${issue2.origin ?? "iye"} ${sizing.verb} ${adj}${issue2.maximum} ${sizing.unit}`;
        return `T\xF3 p\u1ECD\u0300 j\xF9: a n\xED l\xE1ti j\u1EB9\u0301 ${adj}${issue2.maximum}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `K\xE9r\xE9 ju: a n\xED l\xE1ti j\u1EB9\u0301 p\xE9 ${issue2.origin} ${sizing.verb} ${adj}${issue2.minimum} ${sizing.unit}`;
        return `K\xE9r\xE9 ju: a n\xED l\xE1ti j\u1EB9\u0301 ${adj}${issue2.minimum}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `\u1ECC\u0300r\u1ECD\u0300 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 b\u1EB9\u0300r\u1EB9\u0300 p\u1EB9\u0300l\xFA "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `\u1ECC\u0300r\u1ECD\u0300 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 par\xED p\u1EB9\u0300l\xFA "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `\u1ECC\u0300r\u1ECD\u0300 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 n\xED "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `\u1ECC\u0300r\u1ECD\u0300 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 b\xE1 \xE0p\u1EB9\u1EB9r\u1EB9 mu ${_issue.pattern}`;
        return `A\u1E63\xEC\u1E63e: ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `N\u1ECD\u0301mb\xE0 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 j\u1EB9\u0301 \xE8y\xE0 p\xEDp\xEDn ti ${issue2.divisor}`;
      case "unrecognized_keys":
        return `B\u1ECDt\xECn\xEC \xE0\xECm\u1ECD\u0300: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `B\u1ECDt\xECn\xEC a\u1E63\xEC\u1E63e n\xEDn\xFA ${issue2.origin}`;
      case "invalid_union":
        return "\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e";
      case "invalid_element":
        return `Iye a\u1E63\xEC\u1E63e n\xEDn\xFA ${issue2.origin}`;
      default:
        return "\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e";
    }
  };
};
function yo_default() {
  return {
    localeError: error50()
  };
}

// node_modules/zod/v4/core/registries.js
var _a2;
var $output = /* @__PURE__ */ Symbol("ZodOutput");
var $input = /* @__PURE__ */ Symbol("ZodInput");
var $ZodRegistry = class {
  constructor() {
    this._map = /* @__PURE__ */ new WeakMap();
    this._idmap = /* @__PURE__ */ new Map();
  }
  add(schema, ..._meta) {
    const meta3 = _meta[0];
    this._map.set(schema, meta3);
    if (meta3 && typeof meta3 === "object" && "id" in meta3) {
      this._idmap.set(meta3.id, schema);
    }
    return this;
  }
  clear() {
    this._map = /* @__PURE__ */ new WeakMap();
    this._idmap = /* @__PURE__ */ new Map();
    return this;
  }
  remove(schema) {
    const meta3 = this._map.get(schema);
    if (meta3 && typeof meta3 === "object" && "id" in meta3) {
      this._idmap.delete(meta3.id);
    }
    this._map.delete(schema);
    return this;
  }
  get(schema) {
    const p = schema._zod.parent;
    if (p) {
      const pm = { ...this.get(p) ?? {} };
      delete pm.id;
      const f = { ...pm, ...this._map.get(schema) };
      return Object.keys(f).length ? f : void 0;
    }
    return this._map.get(schema);
  }
  has(schema) {
    return this._map.has(schema);
  }
};
function registry() {
  return new $ZodRegistry();
}
(_a2 = globalThis).__zod_globalRegistry ?? (_a2.__zod_globalRegistry = registry());
var globalRegistry = globalThis.__zod_globalRegistry;

// node_modules/zod/v4/core/api.js
// @__NO_SIDE_EFFECTS__
function _string(Class2, params) {
  return new Class2({
    type: "string",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _coercedString(Class2, params) {
  return new Class2({
    type: "string",
    coerce: true,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _email(Class2, params) {
  return new Class2({
    type: "string",
    format: "email",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _guid(Class2, params) {
  return new Class2({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v4",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v6",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv7(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v7",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _url(Class2, params) {
  return new Class2({
    type: "string",
    format: "url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _emoji2(Class2, params) {
  return new Class2({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _nanoid(Class2, params) {
  return new Class2({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cuid2(Class2, params) {
  return new Class2({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ulid(Class2, params) {
  return new Class2({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _xid(Class2, params) {
  return new Class2({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ksuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ipv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ipv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _mac(Class2, params) {
  return new Class2({
    type: "string",
    format: "mac",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cidrv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cidrv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _base64(Class2, params) {
  return new Class2({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _base64url(Class2, params) {
  return new Class2({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _e164(Class2, params) {
  return new Class2({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _jwt(Class2, params) {
  return new Class2({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
var TimePrecision = {
  Any: null,
  Minute: -1,
  Second: 0,
  Millisecond: 3,
  Microsecond: 6
};
// @__NO_SIDE_EFFECTS__
function _isoDateTime(Class2, params) {
  return new Class2({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: false,
    local: false,
    precision: null,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDate(Class2, params) {
  return new Class2({
    type: "string",
    format: "date",
    check: "string_format",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoTime(Class2, params) {
  return new Class2({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDuration(Class2, params) {
  return new Class2({
    type: "string",
    format: "duration",
    check: "string_format",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _number(Class2, params) {
  return new Class2({
    type: "number",
    checks: [],
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _coercedNumber(Class2, params) {
  return new Class2({
    type: "number",
    coerce: true,
    checks: [],
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _int(Class2, params) {
  return new Class2({
    type: "number",
    check: "number_format",
    abort: false,
    format: "safeint",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _float32(Class2, params) {
  return new Class2({
    type: "number",
    check: "number_format",
    abort: false,
    format: "float32",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _float64(Class2, params) {
  return new Class2({
    type: "number",
    check: "number_format",
    abort: false,
    format: "float64",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _int32(Class2, params) {
  return new Class2({
    type: "number",
    check: "number_format",
    abort: false,
    format: "int32",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uint32(Class2, params) {
  return new Class2({
    type: "number",
    check: "number_format",
    abort: false,
    format: "uint32",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _boolean(Class2, params) {
  return new Class2({
    type: "boolean",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _coercedBoolean(Class2, params) {
  return new Class2({
    type: "boolean",
    coerce: true,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _bigint(Class2, params) {
  return new Class2({
    type: "bigint",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _coercedBigint(Class2, params) {
  return new Class2({
    type: "bigint",
    coerce: true,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _int64(Class2, params) {
  return new Class2({
    type: "bigint",
    check: "bigint_format",
    abort: false,
    format: "int64",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uint64(Class2, params) {
  return new Class2({
    type: "bigint",
    check: "bigint_format",
    abort: false,
    format: "uint64",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _symbol(Class2, params) {
  return new Class2({
    type: "symbol",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _undefined2(Class2, params) {
  return new Class2({
    type: "undefined",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _null2(Class2, params) {
  return new Class2({
    type: "null",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _any(Class2) {
  return new Class2({
    type: "any"
  });
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class2) {
  return new Class2({
    type: "unknown"
  });
}
// @__NO_SIDE_EFFECTS__
function _never(Class2, params) {
  return new Class2({
    type: "never",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _void(Class2, params) {
  return new Class2({
    type: "void",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _date(Class2, params) {
  return new Class2({
    type: "date",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _coercedDate(Class2, params) {
  return new Class2({
    type: "date",
    coerce: true,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _nan(Class2, params) {
  return new Class2({
    type: "nan",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _lt(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _lte(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _gt(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _gte(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _positive(params) {
  return /* @__PURE__ */ _gt(0, params);
}
// @__NO_SIDE_EFFECTS__
function _negative(params) {
  return /* @__PURE__ */ _lt(0, params);
}
// @__NO_SIDE_EFFECTS__
function _nonpositive(params) {
  return /* @__PURE__ */ _lte(0, params);
}
// @__NO_SIDE_EFFECTS__
function _nonnegative(params) {
  return /* @__PURE__ */ _gte(0, params);
}
// @__NO_SIDE_EFFECTS__
function _multipleOf(value, params) {
  return new $ZodCheckMultipleOf({
    check: "multiple_of",
    ...normalizeParams(params),
    value
  });
}
// @__NO_SIDE_EFFECTS__
function _maxSize(maximum, params) {
  return new $ZodCheckMaxSize({
    check: "max_size",
    ...normalizeParams(params),
    maximum
  });
}
// @__NO_SIDE_EFFECTS__
function _minSize(minimum, params) {
  return new $ZodCheckMinSize({
    check: "min_size",
    ...normalizeParams(params),
    minimum
  });
}
// @__NO_SIDE_EFFECTS__
function _size(size2, params) {
  return new $ZodCheckSizeEquals({
    check: "size_equals",
    ...normalizeParams(params),
    size: size2
  });
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
  const ch = new $ZodCheckMaxLength({
    check: "max_length",
    ...normalizeParams(params),
    maximum
  });
  return ch;
}
// @__NO_SIDE_EFFECTS__
function _minLength(minimum, params) {
  return new $ZodCheckMinLength({
    check: "min_length",
    ...normalizeParams(params),
    minimum
  });
}
// @__NO_SIDE_EFFECTS__
function _length(length, params) {
  return new $ZodCheckLengthEquals({
    check: "length_equals",
    ...normalizeParams(params),
    length
  });
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
  return new $ZodCheckRegex({
    check: "string_format",
    format: "regex",
    ...normalizeParams(params),
    pattern
  });
}
// @__NO_SIDE_EFFECTS__
function _lowercase(params) {
  return new $ZodCheckLowerCase({
    check: "string_format",
    format: "lowercase",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uppercase(params) {
  return new $ZodCheckUpperCase({
    check: "string_format",
    format: "uppercase",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _includes(includes, params) {
  return new $ZodCheckIncludes({
    check: "string_format",
    format: "includes",
    ...normalizeParams(params),
    includes
  });
}
// @__NO_SIDE_EFFECTS__
function _startsWith(prefix, params) {
  return new $ZodCheckStartsWith({
    check: "string_format",
    format: "starts_with",
    ...normalizeParams(params),
    prefix
  });
}
// @__NO_SIDE_EFFECTS__
function _endsWith(suffix, params) {
  return new $ZodCheckEndsWith({
    check: "string_format",
    format: "ends_with",
    ...normalizeParams(params),
    suffix
  });
}
// @__NO_SIDE_EFFECTS__
function _property(property, schema, params) {
  return new $ZodCheckProperty({
    check: "property",
    property,
    schema,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _mime(types2, params) {
  return new $ZodCheckMimeType({
    check: "mime_type",
    mime: types2,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _overwrite(tx) {
  return new $ZodCheckOverwrite({
    check: "overwrite",
    tx
  });
}
// @__NO_SIDE_EFFECTS__
function _normalize(form) {
  return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
}
// @__NO_SIDE_EFFECTS__
function _trim() {
  return /* @__PURE__ */ _overwrite((input) => input.trim());
}
// @__NO_SIDE_EFFECTS__
function _toLowerCase() {
  return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function _toUpperCase() {
  return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function _slugify() {
  return /* @__PURE__ */ _overwrite((input) => slugify(input));
}
// @__NO_SIDE_EFFECTS__
function _array(Class2, element, params) {
  return new Class2({
    type: "array",
    element,
    // get element() {
    //   return element;
    // },
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _union(Class2, options, params) {
  return new Class2({
    type: "union",
    options,
    ...normalizeParams(params)
  });
}
function _xor(Class2, options, params) {
  return new Class2({
    type: "union",
    options,
    inclusive: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _discriminatedUnion(Class2, discriminator, options, params) {
  return new Class2({
    type: "union",
    options,
    discriminator,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _intersection(Class2, left, right) {
  return new Class2({
    type: "intersection",
    left,
    right
  });
}
// @__NO_SIDE_EFFECTS__
function _tuple(Class2, items, _paramsOrRest, _params) {
  const hasRest = _paramsOrRest instanceof $ZodType;
  const params = hasRest ? _params : _paramsOrRest;
  const rest = hasRest ? _paramsOrRest : null;
  return new Class2({
    type: "tuple",
    items,
    rest,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _record(Class2, keyType, valueType, params) {
  return new Class2({
    type: "record",
    keyType,
    valueType,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _map(Class2, keyType, valueType, params) {
  return new Class2({
    type: "map",
    keyType,
    valueType,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _set(Class2, valueType, params) {
  return new Class2({
    type: "set",
    valueType,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _enum(Class2, values2, params) {
  const entries = Array.isArray(values2) ? Object.fromEntries(values2.map((v) => [v, v])) : values2;
  return new Class2({
    type: "enum",
    entries,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _nativeEnum(Class2, entries, params) {
  return new Class2({
    type: "enum",
    entries,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _literal(Class2, value, params) {
  return new Class2({
    type: "literal",
    values: Array.isArray(value) ? value : [value],
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _file(Class2, params) {
  return new Class2({
    type: "file",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _transform(Class2, fn) {
  return new Class2({
    type: "transform",
    transform: fn
  });
}
// @__NO_SIDE_EFFECTS__
function _optional(Class2, innerType) {
  return new Class2({
    type: "optional",
    innerType
  });
}
// @__NO_SIDE_EFFECTS__
function _nullable(Class2, innerType) {
  return new Class2({
    type: "nullable",
    innerType
  });
}
// @__NO_SIDE_EFFECTS__
function _default(Class2, innerType, defaultValue) {
  return new Class2({
    type: "default",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
    }
  });
}
// @__NO_SIDE_EFFECTS__
function _nonoptional(Class2, innerType, params) {
  return new Class2({
    type: "nonoptional",
    innerType,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _success(Class2, innerType) {
  return new Class2({
    type: "success",
    innerType
  });
}
// @__NO_SIDE_EFFECTS__
function _catch(Class2, innerType, catchValue) {
  return new Class2({
    type: "catch",
    innerType,
    catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
  });
}
// @__NO_SIDE_EFFECTS__
function _pipe(Class2, in_, out) {
  return new Class2({
    type: "pipe",
    in: in_,
    out
  });
}
// @__NO_SIDE_EFFECTS__
function _readonly(Class2, innerType) {
  return new Class2({
    type: "readonly",
    innerType
  });
}
// @__NO_SIDE_EFFECTS__
function _templateLiteral(Class2, parts, params) {
  return new Class2({
    type: "template_literal",
    parts,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _lazy(Class2, getter) {
  return new Class2({
    type: "lazy",
    getter
  });
}
// @__NO_SIDE_EFFECTS__
function _promise(Class2, innerType) {
  return new Class2({
    type: "promise",
    innerType
  });
}
// @__NO_SIDE_EFFECTS__
function _custom(Class2, fn, _params) {
  const norm = normalizeParams(_params);
  norm.abort ?? (norm.abort = true);
  const schema = new Class2({
    type: "custom",
    check: "custom",
    fn,
    ...norm
  });
  return schema;
}
// @__NO_SIDE_EFFECTS__
function _refine(Class2, fn, _params) {
  const schema = new Class2({
    type: "custom",
    check: "custom",
    fn,
    ...normalizeParams(_params)
  });
  return schema;
}
// @__NO_SIDE_EFFECTS__
function _superRefine(fn, params) {
  const ch = /* @__PURE__ */ _check((payload) => {
    payload.addIssue = (issue2) => {
      if (typeof issue2 === "string") {
        payload.issues.push(issue(issue2, payload.value, ch._zod.def));
      } else {
        const _issue = issue2;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        _issue.input ?? (_issue.input = payload.value);
        _issue.inst ?? (_issue.inst = ch);
        _issue.continue ?? (_issue.continue = !ch._zod.def.abort);
        payload.issues.push(issue(_issue));
      }
    };
    return fn(payload.value, payload);
  }, params);
  return ch;
}
// @__NO_SIDE_EFFECTS__
function _check(fn, params) {
  const ch = new $ZodCheck({
    check: "custom",
    ...normalizeParams(params)
  });
  ch._zod.check = fn;
  return ch;
}
// @__NO_SIDE_EFFECTS__
function describe(description) {
  const ch = new $ZodCheck({ check: "describe" });
  ch._zod.onattach = [
    (inst) => {
      const existing = globalRegistry.get(inst) ?? {};
      globalRegistry.add(inst, { ...existing, description });
    }
  ];
  ch._zod.check = () => {
  };
  return ch;
}
// @__NO_SIDE_EFFECTS__
function meta(metadata) {
  const ch = new $ZodCheck({ check: "meta" });
  ch._zod.onattach = [
    (inst) => {
      const existing = globalRegistry.get(inst) ?? {};
      globalRegistry.add(inst, { ...existing, ...metadata });
    }
  ];
  ch._zod.check = () => {
  };
  return ch;
}
// @__NO_SIDE_EFFECTS__
function _stringbool(Classes, _params) {
  const params = normalizeParams(_params);
  let truthyArray = params.truthy ?? ["true", "1", "yes", "on", "y", "enabled"];
  let falsyArray = params.falsy ?? ["false", "0", "no", "off", "n", "disabled"];
  if (params.case !== "sensitive") {
    truthyArray = truthyArray.map((v) => typeof v === "string" ? v.toLowerCase() : v);
    falsyArray = falsyArray.map((v) => typeof v === "string" ? v.toLowerCase() : v);
  }
  const truthySet = new Set(truthyArray);
  const falsySet = new Set(falsyArray);
  const _Codec = Classes.Codec ?? $ZodCodec;
  const _Boolean = Classes.Boolean ?? $ZodBoolean;
  const _String = Classes.String ?? $ZodString;
  const stringSchema = new _String({ type: "string", error: params.error });
  const booleanSchema = new _Boolean({ type: "boolean", error: params.error });
  const codec2 = new _Codec({
    type: "pipe",
    in: stringSchema,
    out: booleanSchema,
    transform: ((input, payload) => {
      let data = input;
      if (params.case !== "sensitive")
        data = data.toLowerCase();
      if (truthySet.has(data)) {
        return true;
      } else if (falsySet.has(data)) {
        return false;
      } else {
        payload.issues.push({
          code: "invalid_value",
          expected: "stringbool",
          values: [...truthySet, ...falsySet],
          input: payload.value,
          inst: codec2,
          continue: false
        });
        return {};
      }
    }),
    reverseTransform: ((input, _payload) => {
      if (input === true) {
        return truthyArray[0] || "true";
      } else {
        return falsyArray[0] || "false";
      }
    }),
    error: params.error
  });
  return codec2;
}
// @__NO_SIDE_EFFECTS__
function _stringFormat(Class2, format, fnOrRegex, _params = {}) {
  const params = normalizeParams(_params);
  const def = {
    ...normalizeParams(_params),
    check: "string_format",
    type: "string",
    format,
    fn: typeof fnOrRegex === "function" ? fnOrRegex : (val) => fnOrRegex.test(val),
    ...params
  };
  if (fnOrRegex instanceof RegExp) {
    def.pattern = fnOrRegex;
  }
  const inst = new Class2(def);
  return inst;
}

// node_modules/zod/v4/core/to-json-schema.js
function initializeContext(params) {
  let target = params?.target ?? "draft-2020-12";
  if (target === "draft-4")
    target = "draft-04";
  if (target === "draft-7")
    target = "draft-07";
  return {
    processors: params.processors ?? {},
    metadataRegistry: params?.metadata ?? globalRegistry,
    target,
    unrepresentable: params?.unrepresentable ?? "throw",
    override: params?.override ?? (() => {
    }),
    io: params?.io ?? "output",
    counter: 0,
    seen: /* @__PURE__ */ new Map(),
    cycles: params?.cycles ?? "ref",
    reused: params?.reused ?? "inline",
    external: params?.external ?? void 0
  };
}
function process2(schema, ctx, _params = { path: [], schemaPath: [] }) {
  var _a3;
  const def = schema._zod.def;
  const seen = ctx.seen.get(schema);
  if (seen) {
    seen.count++;
    const isCycle = _params.schemaPath.includes(schema);
    if (isCycle) {
      seen.cycle = _params.path;
    }
    return seen.schema;
  }
  const result = { schema: {}, count: 1, cycle: void 0, path: _params.path };
  ctx.seen.set(schema, result);
  const overrideSchema = schema._zod.toJSONSchema?.();
  if (overrideSchema) {
    result.schema = overrideSchema;
  } else {
    const params = {
      ..._params,
      schemaPath: [..._params.schemaPath, schema],
      path: _params.path
    };
    if (schema._zod.processJSONSchema) {
      schema._zod.processJSONSchema(ctx, result.schema, params);
    } else {
      const _json = result.schema;
      const processor = ctx.processors[def.type];
      if (!processor) {
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
      }
      processor(schema, ctx, _json, params);
    }
    const parent = schema._zod.parent;
    if (parent) {
      if (!result.ref)
        result.ref = parent;
      process2(parent, ctx, params);
      ctx.seen.get(parent).isParent = true;
    }
  }
  const meta3 = ctx.metadataRegistry.get(schema);
  if (meta3)
    Object.assign(result.schema, meta3);
  if (ctx.io === "input" && isTransforming(schema)) {
    delete result.schema.examples;
    delete result.schema.default;
  }
  if (ctx.io === "input" && "_prefault" in result.schema)
    (_a3 = result.schema).default ?? (_a3.default = result.schema._prefault);
  delete result.schema._prefault;
  const _result = ctx.seen.get(schema);
  return _result.schema;
}
function extractDefs(ctx, schema) {
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const idToSchema = /* @__PURE__ */ new Map();
  for (const entry of ctx.seen.entries()) {
    const id = ctx.metadataRegistry.get(entry[0])?.id;
    if (id) {
      const existing = idToSchema.get(id);
      if (existing && existing !== entry[0]) {
        throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      }
      idToSchema.set(id, entry[0]);
    }
  }
  const makeURI = (entry) => {
    const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
    if (ctx.external) {
      const externalId = ctx.external.registry.get(entry[0])?.id;
      const uriGenerator = ctx.external.uri ?? ((id2) => id2);
      if (externalId) {
        return { ref: uriGenerator(externalId) };
      }
      const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
      entry[1].defId = id;
      return { defId: id, ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}` };
    }
    if (entry[1] === root) {
      return { ref: "#" };
    }
    const uriPrefix = `#`;
    const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
    const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
    return { defId, ref: defUriPrefix + defId };
  };
  const extractToDef = (entry) => {
    if (entry[1].schema.$ref) {
      return;
    }
    const seen = entry[1];
    const { ref, defId } = makeURI(entry);
    seen.def = { ...seen.schema };
    if (defId)
      seen.defId = defId;
    const schema2 = seen.schema;
    for (const key in schema2) {
      delete schema2[key];
    }
    schema2.$ref = ref;
  };
  if (ctx.cycles === "throw") {
    for (const entry of ctx.seen.entries()) {
      const seen = entry[1];
      if (seen.cycle) {
        throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
      }
    }
  }
  for (const entry of ctx.seen.entries()) {
    const seen = entry[1];
    if (schema === entry[0]) {
      extractToDef(entry);
      continue;
    }
    if (ctx.external) {
      const ext = ctx.external.registry.get(entry[0])?.id;
      if (schema !== entry[0] && ext) {
        extractToDef(entry);
        continue;
      }
    }
    const id = ctx.metadataRegistry.get(entry[0])?.id;
    if (id) {
      extractToDef(entry);
      continue;
    }
    if (seen.cycle) {
      extractToDef(entry);
      continue;
    }
    if (seen.count > 1) {
      if (ctx.reused === "ref") {
        extractToDef(entry);
        continue;
      }
    }
  }
}
function finalize(ctx, schema) {
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const flattenRef = (zodSchema) => {
    const seen = ctx.seen.get(zodSchema);
    if (seen.ref === null)
      return;
    const schema2 = seen.def ?? seen.schema;
    const _cached = { ...schema2 };
    const ref = seen.ref;
    seen.ref = null;
    if (ref) {
      flattenRef(ref);
      const refSeen = ctx.seen.get(ref);
      const refSchema = refSeen.schema;
      if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
        schema2.allOf = schema2.allOf ?? [];
        schema2.allOf.push(refSchema);
      } else {
        Object.assign(schema2, refSchema);
      }
      Object.assign(schema2, _cached);
      const isParentRef = zodSchema._zod.parent === ref;
      if (isParentRef) {
        for (const key in schema2) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (!(key in _cached)) {
            delete schema2[key];
          }
        }
      }
      if (refSchema.$ref && refSeen.def) {
        for (const key in schema2) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (key in refSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(refSeen.def[key])) {
            delete schema2[key];
          }
        }
      }
    }
    const parent = zodSchema._zod.parent;
    if (parent && parent !== ref) {
      flattenRef(parent);
      const parentSeen = ctx.seen.get(parent);
      if (parentSeen?.schema.$ref) {
        schema2.$ref = parentSeen.schema.$ref;
        if (parentSeen.def) {
          for (const key in schema2) {
            if (key === "$ref" || key === "allOf")
              continue;
            if (key in parentSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(parentSeen.def[key])) {
              delete schema2[key];
            }
          }
        }
      }
    }
    ctx.override({
      zodSchema,
      jsonSchema: schema2,
      path: seen.path ?? []
    });
  };
  for (const entry of [...ctx.seen.entries()].reverse()) {
    flattenRef(entry[0]);
  }
  const result = {};
  if (ctx.target === "draft-2020-12") {
    result.$schema = "https://json-schema.org/draft/2020-12/schema";
  } else if (ctx.target === "draft-07") {
    result.$schema = "http://json-schema.org/draft-07/schema#";
  } else if (ctx.target === "draft-04") {
    result.$schema = "http://json-schema.org/draft-04/schema#";
  } else if (ctx.target === "openapi-3.0") {
  } else {
  }
  if (ctx.external?.uri) {
    const id = ctx.external.registry.get(schema)?.id;
    if (!id)
      throw new Error("Schema is missing an `id` property");
    result.$id = ctx.external.uri(id);
  }
  Object.assign(result, root.def ?? root.schema);
  const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
  if (rootMetaId !== void 0 && result.id === rootMetaId)
    delete result.id;
  const defs = ctx.external?.defs ?? {};
  for (const entry of ctx.seen.entries()) {
    const seen = entry[1];
    if (seen.def && seen.defId) {
      if (seen.def.id === seen.defId)
        delete seen.def.id;
      defs[seen.defId] = seen.def;
    }
  }
  if (ctx.external) {
  } else {
    if (Object.keys(defs).length > 0) {
      if (ctx.target === "draft-2020-12") {
        result.$defs = defs;
      } else {
        result.definitions = defs;
      }
    }
  }
  try {
    const finalized = JSON.parse(JSON.stringify(result));
    Object.defineProperty(finalized, "~standard", {
      value: {
        ...schema["~standard"],
        jsonSchema: {
          input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
          output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
        }
      },
      enumerable: false,
      writable: false
    });
    return finalized;
  } catch (_err) {
    throw new Error("Error converting schema to JSON.");
  }
}
function isTransforming(_schema, _ctx) {
  const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
  if (ctx.seen.has(_schema))
    return false;
  ctx.seen.add(_schema);
  const def = _schema._zod.def;
  if (def.type === "transform")
    return true;
  if (def.type === "array")
    return isTransforming(def.element, ctx);
  if (def.type === "set")
    return isTransforming(def.valueType, ctx);
  if (def.type === "lazy")
    return isTransforming(def.getter(), ctx);
  if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault") {
    return isTransforming(def.innerType, ctx);
  }
  if (def.type === "intersection") {
    return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
  }
  if (def.type === "record" || def.type === "map") {
    return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
  }
  if (def.type === "pipe") {
    if (_schema._zod.traits.has("$ZodCodec"))
      return true;
    return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
  }
  if (def.type === "object") {
    for (const key in def.shape) {
      if (isTransforming(def.shape[key], ctx))
        return true;
    }
    return false;
  }
  if (def.type === "union") {
    for (const option of def.options) {
      if (isTransforming(option, ctx))
        return true;
    }
    return false;
  }
  if (def.type === "tuple") {
    for (const item of def.items) {
      if (isTransforming(item, ctx))
        return true;
    }
    if (def.rest && isTransforming(def.rest, ctx))
      return true;
    return false;
  }
  return false;
}
var createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
  const ctx = initializeContext({ ...params, processors });
  process2(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};
var createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
  const { libraryOptions, target } = params ?? {};
  const ctx = initializeContext({ ...libraryOptions ?? {}, target, io, processors });
  process2(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};

// node_modules/zod/v4/core/json-schema-processors.js
var formatMap = {
  guid: "uuid",
  url: "uri",
  datetime: "date-time",
  json_string: "json-string",
  regex: ""
  // do not set
};
var stringProcessor = (schema, ctx, _json, _params) => {
  const json2 = _json;
  json2.type = "string";
  const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
  if (typeof minimum === "number")
    json2.minLength = minimum;
  if (typeof maximum === "number")
    json2.maxLength = maximum;
  if (format) {
    json2.format = formatMap[format] ?? format;
    if (json2.format === "")
      delete json2.format;
    if (format === "time") {
      delete json2.format;
    }
  }
  if (contentEncoding)
    json2.contentEncoding = contentEncoding;
  if (patterns && patterns.size > 0) {
    const regexes = [...patterns];
    if (regexes.length === 1)
      json2.pattern = regexes[0].source;
    else if (regexes.length > 1) {
      json2.allOf = [
        ...regexes.map((regex) => ({
          ...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
          pattern: regex.source
        }))
      ];
    }
  }
};
var numberProcessor = (schema, ctx, _json, _params) => {
  const json2 = _json;
  const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
  if (typeof format === "string" && format.includes("int"))
    json2.type = "integer";
  else
    json2.type = "number";
  const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
  const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
  const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
  if (exMin) {
    if (legacy) {
      json2.minimum = exclusiveMinimum;
      json2.exclusiveMinimum = true;
    } else {
      json2.exclusiveMinimum = exclusiveMinimum;
    }
  } else if (typeof minimum === "number") {
    json2.minimum = minimum;
  }
  if (exMax) {
    if (legacy) {
      json2.maximum = exclusiveMaximum;
      json2.exclusiveMaximum = true;
    } else {
      json2.exclusiveMaximum = exclusiveMaximum;
    }
  } else if (typeof maximum === "number") {
    json2.maximum = maximum;
  }
  if (typeof multipleOf === "number")
    json2.multipleOf = multipleOf;
};
var booleanProcessor = (_schema, _ctx, json2, _params) => {
  json2.type = "boolean";
};
var bigintProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("BigInt cannot be represented in JSON Schema");
  }
};
var symbolProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Symbols cannot be represented in JSON Schema");
  }
};
var nullProcessor = (_schema, ctx, json2, _params) => {
  if (ctx.target === "openapi-3.0") {
    json2.type = "string";
    json2.nullable = true;
    json2.enum = [null];
  } else {
    json2.type = "null";
  }
};
var undefinedProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Undefined cannot be represented in JSON Schema");
  }
};
var voidProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Void cannot be represented in JSON Schema");
  }
};
var neverProcessor = (_schema, _ctx, json2, _params) => {
  json2.not = {};
};
var anyProcessor = (_schema, _ctx, _json, _params) => {
};
var unknownProcessor = (_schema, _ctx, _json, _params) => {
};
var dateProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Date cannot be represented in JSON Schema");
  }
};
var enumProcessor = (schema, _ctx, json2, _params) => {
  const def = schema._zod.def;
  const values2 = getEnumValues(def.entries);
  if (values2.every((v) => typeof v === "number"))
    json2.type = "number";
  if (values2.every((v) => typeof v === "string"))
    json2.type = "string";
  json2.enum = values2;
};
var literalProcessor = (schema, ctx, json2, _params) => {
  const def = schema._zod.def;
  const vals = [];
  for (const val of def.values) {
    if (val === void 0) {
      if (ctx.unrepresentable === "throw") {
        throw new Error("Literal `undefined` cannot be represented in JSON Schema");
      } else {
      }
    } else if (typeof val === "bigint") {
      if (ctx.unrepresentable === "throw") {
        throw new Error("BigInt literals cannot be represented in JSON Schema");
      } else {
        vals.push(Number(val));
      }
    } else {
      vals.push(val);
    }
  }
  if (vals.length === 0) {
  } else if (vals.length === 1) {
    const val = vals[0];
    json2.type = val === null ? "null" : typeof val;
    if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
      json2.enum = [val];
    } else {
      json2.const = val;
    }
  } else {
    if (vals.every((v) => typeof v === "number"))
      json2.type = "number";
    if (vals.every((v) => typeof v === "string"))
      json2.type = "string";
    if (vals.every((v) => typeof v === "boolean"))
      json2.type = "boolean";
    if (vals.every((v) => v === null))
      json2.type = "null";
    json2.enum = vals;
  }
};
var nanProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("NaN cannot be represented in JSON Schema");
  }
};
var templateLiteralProcessor = (schema, _ctx, json2, _params) => {
  const _json = json2;
  const pattern = schema._zod.pattern;
  if (!pattern)
    throw new Error("Pattern not found in template literal");
  _json.type = "string";
  _json.pattern = pattern.source;
};
var fileProcessor = (schema, _ctx, json2, _params) => {
  const _json = json2;
  const file2 = {
    type: "string",
    format: "binary",
    contentEncoding: "binary"
  };
  const { minimum, maximum, mime } = schema._zod.bag;
  if (minimum !== void 0)
    file2.minLength = minimum;
  if (maximum !== void 0)
    file2.maxLength = maximum;
  if (mime) {
    if (mime.length === 1) {
      file2.contentMediaType = mime[0];
      Object.assign(_json, file2);
    } else {
      Object.assign(_json, file2);
      _json.anyOf = mime.map((m) => ({ contentMediaType: m }));
    }
  } else {
    Object.assign(_json, file2);
  }
};
var successProcessor = (_schema, _ctx, json2, _params) => {
  json2.type = "boolean";
};
var customProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Custom types cannot be represented in JSON Schema");
  }
};
var functionProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Function types cannot be represented in JSON Schema");
  }
};
var transformProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Transforms cannot be represented in JSON Schema");
  }
};
var mapProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Map cannot be represented in JSON Schema");
  }
};
var setProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Set cannot be represented in JSON Schema");
  }
};
var arrayProcessor = (schema, ctx, _json, params) => {
  const json2 = _json;
  const def = schema._zod.def;
  const { minimum, maximum } = schema._zod.bag;
  if (typeof minimum === "number")
    json2.minItems = minimum;
  if (typeof maximum === "number")
    json2.maxItems = maximum;
  json2.type = "array";
  json2.items = process2(def.element, ctx, {
    ...params,
    path: [...params.path, "items"]
  });
};
var objectProcessor = (schema, ctx, _json, params) => {
  const json2 = _json;
  const def = schema._zod.def;
  json2.type = "object";
  json2.properties = {};
  const shape = def.shape;
  for (const key in shape) {
    json2.properties[key] = process2(shape[key], ctx, {
      ...params,
      path: [...params.path, "properties", key]
    });
  }
  const allKeys = new Set(Object.keys(shape));
  const requiredKeys = new Set([...allKeys].filter((key) => {
    const v = def.shape[key]._zod;
    if (ctx.io === "input") {
      return v.optin === void 0;
    } else {
      return v.optout === void 0;
    }
  }));
  if (requiredKeys.size > 0) {
    json2.required = Array.from(requiredKeys);
  }
  if (def.catchall?._zod.def.type === "never") {
    json2.additionalProperties = false;
  } else if (!def.catchall) {
    if (ctx.io === "output")
      json2.additionalProperties = false;
  } else if (def.catchall) {
    json2.additionalProperties = process2(def.catchall, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
};
var unionProcessor = (schema, ctx, json2, params) => {
  const def = schema._zod.def;
  const isExclusive = def.inclusive === false;
  const options = def.options.map((x, i) => process2(x, ctx, {
    ...params,
    path: [...params.path, isExclusive ? "oneOf" : "anyOf", i]
  }));
  if (isExclusive) {
    json2.oneOf = options;
  } else {
    json2.anyOf = options;
  }
};
var intersectionProcessor = (schema, ctx, json2, params) => {
  const def = schema._zod.def;
  const a = process2(def.left, ctx, {
    ...params,
    path: [...params.path, "allOf", 0]
  });
  const b2 = process2(def.right, ctx, {
    ...params,
    path: [...params.path, "allOf", 1]
  });
  const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
  const allOf = [
    ...isSimpleIntersection(a) ? a.allOf : [a],
    ...isSimpleIntersection(b2) ? b2.allOf : [b2]
  ];
  json2.allOf = allOf;
};
var tupleProcessor = (schema, ctx, _json, params) => {
  const json2 = _json;
  const def = schema._zod.def;
  json2.type = "array";
  const prefixPath = ctx.target === "draft-2020-12" ? "prefixItems" : "items";
  const restPath = ctx.target === "draft-2020-12" ? "items" : ctx.target === "openapi-3.0" ? "items" : "additionalItems";
  const prefixItems = def.items.map((x, i) => process2(x, ctx, {
    ...params,
    path: [...params.path, prefixPath, i]
  }));
  const rest = def.rest ? process2(def.rest, ctx, {
    ...params,
    path: [...params.path, restPath, ...ctx.target === "openapi-3.0" ? [def.items.length] : []]
  }) : null;
  if (ctx.target === "draft-2020-12") {
    json2.prefixItems = prefixItems;
    if (rest) {
      json2.items = rest;
    }
  } else if (ctx.target === "openapi-3.0") {
    json2.items = {
      anyOf: prefixItems
    };
    if (rest) {
      json2.items.anyOf.push(rest);
    }
    json2.minItems = prefixItems.length;
    if (!rest) {
      json2.maxItems = prefixItems.length;
    }
  } else {
    json2.items = prefixItems;
    if (rest) {
      json2.additionalItems = rest;
    }
  }
  const { minimum, maximum } = schema._zod.bag;
  if (typeof minimum === "number")
    json2.minItems = minimum;
  if (typeof maximum === "number")
    json2.maxItems = maximum;
};
var recordProcessor = (schema, ctx, _json, params) => {
  const json2 = _json;
  const def = schema._zod.def;
  json2.type = "object";
  const keyType = def.keyType;
  const keyBag = keyType._zod.bag;
  const patterns = keyBag?.patterns;
  if (def.mode === "loose" && patterns && patterns.size > 0) {
    const valueSchema = process2(def.valueType, ctx, {
      ...params,
      path: [...params.path, "patternProperties", "*"]
    });
    json2.patternProperties = {};
    for (const pattern of patterns) {
      json2.patternProperties[pattern.source] = valueSchema;
    }
  } else {
    if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") {
      json2.propertyNames = process2(def.keyType, ctx, {
        ...params,
        path: [...params.path, "propertyNames"]
      });
    }
    json2.additionalProperties = process2(def.valueType, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
  const keyValues = keyType._zod.values;
  if (keyValues) {
    const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
    if (validKeyValues.length > 0) {
      json2.required = validKeyValues;
    }
  }
};
var nullableProcessor = (schema, ctx, json2, params) => {
  const def = schema._zod.def;
  const inner = process2(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  if (ctx.target === "openapi-3.0") {
    seen.ref = def.innerType;
    json2.nullable = true;
  } else {
    json2.anyOf = [inner, { type: "null" }];
  }
};
var nonoptionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  process2(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
var defaultProcessor = (schema, ctx, json2, params) => {
  const def = schema._zod.def;
  process2(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  json2.default = JSON.parse(JSON.stringify(def.defaultValue));
};
var prefaultProcessor = (schema, ctx, json2, params) => {
  const def = schema._zod.def;
  process2(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  if (ctx.io === "input")
    json2._prefault = JSON.parse(JSON.stringify(def.defaultValue));
};
var catchProcessor = (schema, ctx, json2, params) => {
  const def = schema._zod.def;
  process2(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  let catchValue;
  try {
    catchValue = def.catchValue(void 0);
  } catch {
    throw new Error("Dynamic catch values are not supported in JSON Schema");
  }
  json2.default = catchValue;
};
var pipeProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  const inIsTransform = def.in._zod.traits.has("$ZodTransform");
  const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
  process2(innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = innerType;
};
var readonlyProcessor = (schema, ctx, json2, params) => {
  const def = schema._zod.def;
  process2(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  json2.readOnly = true;
};
var promiseProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  process2(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
var optionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  process2(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
var lazyProcessor = (schema, ctx, _json, params) => {
  const innerType = schema._zod.innerType;
  process2(innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = innerType;
};
var allProcessors = {
  string: stringProcessor,
  number: numberProcessor,
  boolean: booleanProcessor,
  bigint: bigintProcessor,
  symbol: symbolProcessor,
  null: nullProcessor,
  undefined: undefinedProcessor,
  void: voidProcessor,
  never: neverProcessor,
  any: anyProcessor,
  unknown: unknownProcessor,
  date: dateProcessor,
  enum: enumProcessor,
  literal: literalProcessor,
  nan: nanProcessor,
  template_literal: templateLiteralProcessor,
  file: fileProcessor,
  success: successProcessor,
  custom: customProcessor,
  function: functionProcessor,
  transform: transformProcessor,
  map: mapProcessor,
  set: setProcessor,
  array: arrayProcessor,
  object: objectProcessor,
  union: unionProcessor,
  intersection: intersectionProcessor,
  tuple: tupleProcessor,
  record: recordProcessor,
  nullable: nullableProcessor,
  nonoptional: nonoptionalProcessor,
  default: defaultProcessor,
  prefault: prefaultProcessor,
  catch: catchProcessor,
  pipe: pipeProcessor,
  readonly: readonlyProcessor,
  promise: promiseProcessor,
  optional: optionalProcessor,
  lazy: lazyProcessor
};
function toJSONSchema(input, params) {
  if ("_idmap" in input) {
    const registry2 = input;
    const ctx2 = initializeContext({ ...params, processors: allProcessors });
    const defs = {};
    for (const entry of registry2._idmap.entries()) {
      const [_, schema] = entry;
      process2(schema, ctx2);
    }
    const schemas = {};
    const external = {
      registry: registry2,
      uri: params?.uri,
      defs
    };
    ctx2.external = external;
    for (const entry of registry2._idmap.entries()) {
      const [key, schema] = entry;
      extractDefs(ctx2, schema);
      schemas[key] = finalize(ctx2, schema);
    }
    if (Object.keys(defs).length > 0) {
      const defsSegment = ctx2.target === "draft-2020-12" ? "$defs" : "definitions";
      schemas.__shared = {
        [defsSegment]: defs
      };
    }
    return { schemas };
  }
  const ctx = initializeContext({ ...params, processors: allProcessors });
  process2(input, ctx);
  extractDefs(ctx, input);
  return finalize(ctx, input);
}

// node_modules/zod/v4/core/json-schema-generator.js
var JSONSchemaGenerator = class {
  /** @deprecated Access via ctx instead */
  get metadataRegistry() {
    return this.ctx.metadataRegistry;
  }
  /** @deprecated Access via ctx instead */
  get target() {
    return this.ctx.target;
  }
  /** @deprecated Access via ctx instead */
  get unrepresentable() {
    return this.ctx.unrepresentable;
  }
  /** @deprecated Access via ctx instead */
  get override() {
    return this.ctx.override;
  }
  /** @deprecated Access via ctx instead */
  get io() {
    return this.ctx.io;
  }
  /** @deprecated Access via ctx instead */
  get counter() {
    return this.ctx.counter;
  }
  set counter(value) {
    this.ctx.counter = value;
  }
  /** @deprecated Access via ctx instead */
  get seen() {
    return this.ctx.seen;
  }
  constructor(params) {
    let normalizedTarget = params?.target ?? "draft-2020-12";
    if (normalizedTarget === "draft-4")
      normalizedTarget = "draft-04";
    if (normalizedTarget === "draft-7")
      normalizedTarget = "draft-07";
    this.ctx = initializeContext({
      processors: allProcessors,
      target: normalizedTarget,
      ...params?.metadata && { metadata: params.metadata },
      ...params?.unrepresentable && { unrepresentable: params.unrepresentable },
      ...params?.override && { override: params.override },
      ...params?.io && { io: params.io }
    });
  }
  /**
   * Process a schema to prepare it for JSON Schema generation.
   * This must be called before emit().
   */
  process(schema, _params = { path: [], schemaPath: [] }) {
    return process2(schema, this.ctx, _params);
  }
  /**
   * Emit the final JSON Schema after processing.
   * Must call process() first.
   */
  emit(schema, _params) {
    if (_params) {
      if (_params.cycles)
        this.ctx.cycles = _params.cycles;
      if (_params.reused)
        this.ctx.reused = _params.reused;
      if (_params.external)
        this.ctx.external = _params.external;
    }
    extractDefs(this.ctx, schema);
    const result = finalize(this.ctx, schema);
    const { "~standard": _, ...plainResult } = result;
    return plainResult;
  }
};

// node_modules/zod/v4/core/json-schema.js
var json_schema_exports = {};

// node_modules/zod/v4/classic/schemas.js
var schemas_exports2 = {};
__export(schemas_exports2, {
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBase64: () => ZodBase64,
  ZodBase64URL: () => ZodBase64URL,
  ZodBigInt: () => ZodBigInt,
  ZodBigIntFormat: () => ZodBigIntFormat,
  ZodBoolean: () => ZodBoolean,
  ZodCIDRv4: () => ZodCIDRv4,
  ZodCIDRv6: () => ZodCIDRv6,
  ZodCUID: () => ZodCUID,
  ZodCUID2: () => ZodCUID2,
  ZodCatch: () => ZodCatch,
  ZodCodec: () => ZodCodec,
  ZodCustom: () => ZodCustom,
  ZodCustomStringFormat: () => ZodCustomStringFormat,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodE164: () => ZodE164,
  ZodEmail: () => ZodEmail,
  ZodEmoji: () => ZodEmoji,
  ZodEnum: () => ZodEnum,
  ZodExactOptional: () => ZodExactOptional,
  ZodFile: () => ZodFile,
  ZodFunction: () => ZodFunction,
  ZodGUID: () => ZodGUID,
  ZodIPv4: () => ZodIPv4,
  ZodIPv6: () => ZodIPv6,
  ZodIntersection: () => ZodIntersection,
  ZodJWT: () => ZodJWT,
  ZodKSUID: () => ZodKSUID,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMAC: () => ZodMAC,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNanoID: () => ZodNanoID,
  ZodNever: () => ZodNever,
  ZodNonOptional: () => ZodNonOptional,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodNumberFormat: () => ZodNumberFormat,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodPipe: () => ZodPipe,
  ZodPrefault: () => ZodPrefault,
  ZodPreprocess: () => ZodPreprocess,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodStringFormat: () => ZodStringFormat,
  ZodSuccess: () => ZodSuccess,
  ZodSymbol: () => ZodSymbol,
  ZodTemplateLiteral: () => ZodTemplateLiteral,
  ZodTransform: () => ZodTransform,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodULID: () => ZodULID,
  ZodURL: () => ZodURL,
  ZodUUID: () => ZodUUID,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  ZodXID: () => ZodXID,
  ZodXor: () => ZodXor,
  _ZodString: () => _ZodString,
  _default: () => _default2,
  _function: () => _function,
  any: () => any,
  array: () => array,
  base64: () => base642,
  base64url: () => base64url2,
  bigint: () => bigint2,
  boolean: () => boolean2,
  catch: () => _catch2,
  check: () => check,
  cidrv4: () => cidrv42,
  cidrv6: () => cidrv62,
  codec: () => codec,
  cuid: () => cuid3,
  cuid2: () => cuid22,
  custom: () => custom,
  date: () => date3,
  describe: () => describe2,
  discriminatedUnion: () => discriminatedUnion,
  e164: () => e1642,
  email: () => email2,
  emoji: () => emoji2,
  enum: () => _enum2,
  exactOptional: () => exactOptional,
  file: () => file,
  float32: () => float32,
  float64: () => float64,
  function: () => _function,
  guid: () => guid2,
  hash: () => hash,
  hex: () => hex2,
  hostname: () => hostname2,
  httpUrl: () => httpUrl,
  instanceof: () => _instanceof,
  int: () => int,
  int32: () => int32,
  int64: () => int64,
  intersection: () => intersection,
  invertCodec: () => invertCodec,
  ipv4: () => ipv42,
  ipv6: () => ipv62,
  json: () => json,
  jwt: () => jwt,
  keyof: () => keyof,
  ksuid: () => ksuid2,
  lazy: () => lazy,
  literal: () => literal,
  looseObject: () => looseObject,
  looseRecord: () => looseRecord,
  mac: () => mac2,
  map: () => map,
  meta: () => meta2,
  nan: () => nan,
  nanoid: () => nanoid2,
  nativeEnum: () => nativeEnum,
  never: () => never,
  nonoptional: () => nonoptional,
  null: () => _null3,
  nullable: () => nullable,
  nullish: () => nullish2,
  number: () => number2,
  object: () => object,
  optional: () => optional,
  partialRecord: () => partialRecord,
  pipe: () => pipe,
  prefault: () => prefault,
  preprocess: () => preprocess,
  promise: () => promise,
  readonly: () => readonly,
  record: () => record,
  refine: () => refine,
  set: () => set,
  strictObject: () => strictObject,
  string: () => string2,
  stringFormat: () => stringFormat,
  stringbool: () => stringbool,
  success: () => success,
  superRefine: () => superRefine,
  symbol: () => symbol,
  templateLiteral: () => templateLiteral,
  transform: () => transform,
  tuple: () => tuple,
  uint32: () => uint32,
  uint64: () => uint64,
  ulid: () => ulid2,
  undefined: () => _undefined3,
  union: () => union,
  unknown: () => unknown,
  url: () => url,
  uuid: () => uuid2,
  uuidv4: () => uuidv4,
  uuidv6: () => uuidv6,
  uuidv7: () => uuidv7,
  void: () => _void2,
  xid: () => xid2,
  xor: () => xor
});

// node_modules/zod/v4/classic/checks.js
var checks_exports2 = {};
__export(checks_exports2, {
  endsWith: () => _endsWith,
  gt: () => _gt,
  gte: () => _gte,
  includes: () => _includes,
  length: () => _length,
  lowercase: () => _lowercase,
  lt: () => _lt,
  lte: () => _lte,
  maxLength: () => _maxLength,
  maxSize: () => _maxSize,
  mime: () => _mime,
  minLength: () => _minLength,
  minSize: () => _minSize,
  multipleOf: () => _multipleOf,
  negative: () => _negative,
  nonnegative: () => _nonnegative,
  nonpositive: () => _nonpositive,
  normalize: () => _normalize,
  overwrite: () => _overwrite,
  positive: () => _positive,
  property: () => _property,
  regex: () => _regex,
  size: () => _size,
  slugify: () => _slugify,
  startsWith: () => _startsWith,
  toLowerCase: () => _toLowerCase,
  toUpperCase: () => _toUpperCase,
  trim: () => _trim,
  uppercase: () => _uppercase
});

// node_modules/zod/v4/classic/iso.js
var iso_exports = {};
__export(iso_exports, {
  ZodISODate: () => ZodISODate,
  ZodISODateTime: () => ZodISODateTime,
  ZodISODuration: () => ZodISODuration,
  ZodISOTime: () => ZodISOTime,
  date: () => date2,
  datetime: () => datetime2,
  duration: () => duration2,
  time: () => time2
});
var ZodISODateTime = /* @__PURE__ */ $constructor("ZodISODateTime", (inst, def) => {
  $ZodISODateTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function datetime2(params) {
  return _isoDateTime(ZodISODateTime, params);
}
var ZodISODate = /* @__PURE__ */ $constructor("ZodISODate", (inst, def) => {
  $ZodISODate.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function date2(params) {
  return _isoDate(ZodISODate, params);
}
var ZodISOTime = /* @__PURE__ */ $constructor("ZodISOTime", (inst, def) => {
  $ZodISOTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function time2(params) {
  return _isoTime(ZodISOTime, params);
}
var ZodISODuration = /* @__PURE__ */ $constructor("ZodISODuration", (inst, def) => {
  $ZodISODuration.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function duration2(params) {
  return _isoDuration(ZodISODuration, params);
}

// node_modules/zod/v4/classic/errors.js
var initializer2 = (inst, issues) => {
  $ZodError.init(inst, issues);
  inst.name = "ZodError";
  Object.defineProperties(inst, {
    format: {
      value: (mapper) => formatError(inst, mapper)
      // enumerable: false,
    },
    flatten: {
      value: (mapper) => flattenError(inst, mapper)
      // enumerable: false,
    },
    addIssue: {
      value: (issue2) => {
        inst.issues.push(issue2);
        inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
      }
      // enumerable: false,
    },
    addIssues: {
      value: (issues2) => {
        inst.issues.push(...issues2);
        inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
      }
      // enumerable: false,
    },
    isEmpty: {
      get() {
        return inst.issues.length === 0;
      }
      // enumerable: false,
    }
  });
};
var ZodError = /* @__PURE__ */ $constructor("ZodError", initializer2);
var ZodRealError = /* @__PURE__ */ $constructor("ZodError", initializer2, {
  Parent: Error
});

// node_modules/zod/v4/classic/parse.js
var parse2 = /* @__PURE__ */ _parse(ZodRealError);
var parseAsync2 = /* @__PURE__ */ _parseAsync(ZodRealError);
var safeParse2 = /* @__PURE__ */ _safeParse(ZodRealError);
var safeParseAsync2 = /* @__PURE__ */ _safeParseAsync(ZodRealError);
var encode2 = /* @__PURE__ */ _encode(ZodRealError);
var decode2 = /* @__PURE__ */ _decode(ZodRealError);
var encodeAsync2 = /* @__PURE__ */ _encodeAsync(ZodRealError);
var decodeAsync2 = /* @__PURE__ */ _decodeAsync(ZodRealError);
var safeEncode2 = /* @__PURE__ */ _safeEncode(ZodRealError);
var safeDecode2 = /* @__PURE__ */ _safeDecode(ZodRealError);
var safeEncodeAsync2 = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
var safeDecodeAsync2 = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);

// node_modules/zod/v4/classic/schemas.js
var _installedGroups = /* @__PURE__ */ new WeakMap();
function _installLazyMethods(inst, group, methods) {
  const proto = Object.getPrototypeOf(inst);
  let installed = _installedGroups.get(proto);
  if (!installed) {
    installed = /* @__PURE__ */ new Set();
    _installedGroups.set(proto, installed);
  }
  if (installed.has(group))
    return;
  installed.add(group);
  for (const key in methods) {
    const fn = methods[key];
    Object.defineProperty(proto, key, {
      configurable: true,
      enumerable: false,
      get() {
        const bound = fn.bind(this);
        Object.defineProperty(this, key, {
          configurable: true,
          writable: true,
          enumerable: true,
          value: bound
        });
        return bound;
      },
      set(v) {
        Object.defineProperty(this, key, {
          configurable: true,
          writable: true,
          enumerable: true,
          value: v
        });
      }
    });
  }
}
var ZodType = /* @__PURE__ */ $constructor("ZodType", (inst, def) => {
  $ZodType.init(inst, def);
  Object.assign(inst["~standard"], {
    jsonSchema: {
      input: createStandardJSONSchemaMethod(inst, "input"),
      output: createStandardJSONSchemaMethod(inst, "output")
    }
  });
  inst.toJSONSchema = createToJSONSchemaMethod(inst, {});
  inst.def = def;
  inst.type = def.type;
  Object.defineProperty(inst, "_def", { value: def });
  inst.parse = (data, params) => parse2(inst, data, params, { callee: inst.parse });
  inst.safeParse = (data, params) => safeParse2(inst, data, params);
  inst.parseAsync = async (data, params) => parseAsync2(inst, data, params, { callee: inst.parseAsync });
  inst.safeParseAsync = async (data, params) => safeParseAsync2(inst, data, params);
  inst.spa = inst.safeParseAsync;
  inst.encode = (data, params) => encode2(inst, data, params);
  inst.decode = (data, params) => decode2(inst, data, params);
  inst.encodeAsync = async (data, params) => encodeAsync2(inst, data, params);
  inst.decodeAsync = async (data, params) => decodeAsync2(inst, data, params);
  inst.safeEncode = (data, params) => safeEncode2(inst, data, params);
  inst.safeDecode = (data, params) => safeDecode2(inst, data, params);
  inst.safeEncodeAsync = async (data, params) => safeEncodeAsync2(inst, data, params);
  inst.safeDecodeAsync = async (data, params) => safeDecodeAsync2(inst, data, params);
  _installLazyMethods(inst, "ZodType", {
    check(...chks) {
      const def2 = this.def;
      return this.clone(util_exports.mergeDefs(def2, {
        checks: [
          ...def2.checks ?? [],
          ...chks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch)
        ]
      }), { parent: true });
    },
    with(...chks) {
      return this.check(...chks);
    },
    clone(def2, params) {
      return clone(this, def2, params);
    },
    brand() {
      return this;
    },
    register(reg, meta3) {
      reg.add(this, meta3);
      return this;
    },
    refine(check2, params) {
      return this.check(refine(check2, params));
    },
    superRefine(refinement, params) {
      return this.check(superRefine(refinement, params));
    },
    overwrite(fn) {
      return this.check(_overwrite(fn));
    },
    optional() {
      return optional(this);
    },
    exactOptional() {
      return exactOptional(this);
    },
    nullable() {
      return nullable(this);
    },
    nullish() {
      return optional(nullable(this));
    },
    nonoptional(params) {
      return nonoptional(this, params);
    },
    array() {
      return array(this);
    },
    or(arg) {
      return union([this, arg]);
    },
    and(arg) {
      return intersection(this, arg);
    },
    transform(tx) {
      return pipe(this, transform(tx));
    },
    default(d) {
      return _default2(this, d);
    },
    prefault(d) {
      return prefault(this, d);
    },
    catch(params) {
      return _catch2(this, params);
    },
    pipe(target) {
      return pipe(this, target);
    },
    readonly() {
      return readonly(this);
    },
    describe(description) {
      const cl = this.clone();
      globalRegistry.add(cl, { description });
      return cl;
    },
    meta(...args) {
      if (args.length === 0)
        return globalRegistry.get(this);
      const cl = this.clone();
      globalRegistry.add(cl, args[0]);
      return cl;
    },
    isOptional() {
      return this.safeParse(void 0).success;
    },
    isNullable() {
      return this.safeParse(null).success;
    },
    apply(fn) {
      return fn(this);
    }
  });
  Object.defineProperty(inst, "description", {
    get() {
      return globalRegistry.get(inst)?.description;
    },
    configurable: true
  });
  return inst;
});
var _ZodString = /* @__PURE__ */ $constructor("_ZodString", (inst, def) => {
  $ZodString.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => stringProcessor(inst, ctx, json2, params);
  const bag = inst._zod.bag;
  inst.format = bag.format ?? null;
  inst.minLength = bag.minimum ?? null;
  inst.maxLength = bag.maximum ?? null;
  _installLazyMethods(inst, "_ZodString", {
    regex(...args) {
      return this.check(_regex(...args));
    },
    includes(...args) {
      return this.check(_includes(...args));
    },
    startsWith(...args) {
      return this.check(_startsWith(...args));
    },
    endsWith(...args) {
      return this.check(_endsWith(...args));
    },
    min(...args) {
      return this.check(_minLength(...args));
    },
    max(...args) {
      return this.check(_maxLength(...args));
    },
    length(...args) {
      return this.check(_length(...args));
    },
    nonempty(...args) {
      return this.check(_minLength(1, ...args));
    },
    lowercase(params) {
      return this.check(_lowercase(params));
    },
    uppercase(params) {
      return this.check(_uppercase(params));
    },
    trim() {
      return this.check(_trim());
    },
    normalize(...args) {
      return this.check(_normalize(...args));
    },
    toLowerCase() {
      return this.check(_toLowerCase());
    },
    toUpperCase() {
      return this.check(_toUpperCase());
    },
    slugify() {
      return this.check(_slugify());
    }
  });
});
var ZodString = /* @__PURE__ */ $constructor("ZodString", (inst, def) => {
  $ZodString.init(inst, def);
  _ZodString.init(inst, def);
  inst.email = (params) => inst.check(_email(ZodEmail, params));
  inst.url = (params) => inst.check(_url(ZodURL, params));
  inst.jwt = (params) => inst.check(_jwt(ZodJWT, params));
  inst.emoji = (params) => inst.check(_emoji2(ZodEmoji, params));
  inst.guid = (params) => inst.check(_guid(ZodGUID, params));
  inst.uuid = (params) => inst.check(_uuid(ZodUUID, params));
  inst.uuidv4 = (params) => inst.check(_uuidv4(ZodUUID, params));
  inst.uuidv6 = (params) => inst.check(_uuidv6(ZodUUID, params));
  inst.uuidv7 = (params) => inst.check(_uuidv7(ZodUUID, params));
  inst.nanoid = (params) => inst.check(_nanoid(ZodNanoID, params));
  inst.guid = (params) => inst.check(_guid(ZodGUID, params));
  inst.cuid = (params) => inst.check(_cuid(ZodCUID, params));
  inst.cuid2 = (params) => inst.check(_cuid2(ZodCUID2, params));
  inst.ulid = (params) => inst.check(_ulid(ZodULID, params));
  inst.base64 = (params) => inst.check(_base64(ZodBase64, params));
  inst.base64url = (params) => inst.check(_base64url(ZodBase64URL, params));
  inst.xid = (params) => inst.check(_xid(ZodXID, params));
  inst.ksuid = (params) => inst.check(_ksuid(ZodKSUID, params));
  inst.ipv4 = (params) => inst.check(_ipv4(ZodIPv4, params));
  inst.ipv6 = (params) => inst.check(_ipv6(ZodIPv6, params));
  inst.cidrv4 = (params) => inst.check(_cidrv4(ZodCIDRv4, params));
  inst.cidrv6 = (params) => inst.check(_cidrv6(ZodCIDRv6, params));
  inst.e164 = (params) => inst.check(_e164(ZodE164, params));
  inst.datetime = (params) => inst.check(datetime2(params));
  inst.date = (params) => inst.check(date2(params));
  inst.time = (params) => inst.check(time2(params));
  inst.duration = (params) => inst.check(duration2(params));
});
function string2(params) {
  return _string(ZodString, params);
}
var ZodStringFormat = /* @__PURE__ */ $constructor("ZodStringFormat", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  _ZodString.init(inst, def);
});
var ZodEmail = /* @__PURE__ */ $constructor("ZodEmail", (inst, def) => {
  $ZodEmail.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function email2(params) {
  return _email(ZodEmail, params);
}
var ZodGUID = /* @__PURE__ */ $constructor("ZodGUID", (inst, def) => {
  $ZodGUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function guid2(params) {
  return _guid(ZodGUID, params);
}
var ZodUUID = /* @__PURE__ */ $constructor("ZodUUID", (inst, def) => {
  $ZodUUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function uuid2(params) {
  return _uuid(ZodUUID, params);
}
function uuidv4(params) {
  return _uuidv4(ZodUUID, params);
}
function uuidv6(params) {
  return _uuidv6(ZodUUID, params);
}
function uuidv7(params) {
  return _uuidv7(ZodUUID, params);
}
var ZodURL = /* @__PURE__ */ $constructor("ZodURL", (inst, def) => {
  $ZodURL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function url(params) {
  return _url(ZodURL, params);
}
function httpUrl(params) {
  return _url(ZodURL, {
    protocol: regexes_exports.httpProtocol,
    hostname: regexes_exports.domain,
    ...util_exports.normalizeParams(params)
  });
}
var ZodEmoji = /* @__PURE__ */ $constructor("ZodEmoji", (inst, def) => {
  $ZodEmoji.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function emoji2(params) {
  return _emoji2(ZodEmoji, params);
}
var ZodNanoID = /* @__PURE__ */ $constructor("ZodNanoID", (inst, def) => {
  $ZodNanoID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function nanoid2(params) {
  return _nanoid(ZodNanoID, params);
}
var ZodCUID = /* @__PURE__ */ $constructor("ZodCUID", (inst, def) => {
  $ZodCUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function cuid3(params) {
  return _cuid(ZodCUID, params);
}
var ZodCUID2 = /* @__PURE__ */ $constructor("ZodCUID2", (inst, def) => {
  $ZodCUID2.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function cuid22(params) {
  return _cuid2(ZodCUID2, params);
}
var ZodULID = /* @__PURE__ */ $constructor("ZodULID", (inst, def) => {
  $ZodULID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function ulid2(params) {
  return _ulid(ZodULID, params);
}
var ZodXID = /* @__PURE__ */ $constructor("ZodXID", (inst, def) => {
  $ZodXID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function xid2(params) {
  return _xid(ZodXID, params);
}
var ZodKSUID = /* @__PURE__ */ $constructor("ZodKSUID", (inst, def) => {
  $ZodKSUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function ksuid2(params) {
  return _ksuid(ZodKSUID, params);
}
var ZodIPv4 = /* @__PURE__ */ $constructor("ZodIPv4", (inst, def) => {
  $ZodIPv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function ipv42(params) {
  return _ipv4(ZodIPv4, params);
}
var ZodMAC = /* @__PURE__ */ $constructor("ZodMAC", (inst, def) => {
  $ZodMAC.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function mac2(params) {
  return _mac(ZodMAC, params);
}
var ZodIPv6 = /* @__PURE__ */ $constructor("ZodIPv6", (inst, def) => {
  $ZodIPv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function ipv62(params) {
  return _ipv6(ZodIPv6, params);
}
var ZodCIDRv4 = /* @__PURE__ */ $constructor("ZodCIDRv4", (inst, def) => {
  $ZodCIDRv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function cidrv42(params) {
  return _cidrv4(ZodCIDRv4, params);
}
var ZodCIDRv6 = /* @__PURE__ */ $constructor("ZodCIDRv6", (inst, def) => {
  $ZodCIDRv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function cidrv62(params) {
  return _cidrv6(ZodCIDRv6, params);
}
var ZodBase64 = /* @__PURE__ */ $constructor("ZodBase64", (inst, def) => {
  $ZodBase64.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function base642(params) {
  return _base64(ZodBase64, params);
}
var ZodBase64URL = /* @__PURE__ */ $constructor("ZodBase64URL", (inst, def) => {
  $ZodBase64URL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function base64url2(params) {
  return _base64url(ZodBase64URL, params);
}
var ZodE164 = /* @__PURE__ */ $constructor("ZodE164", (inst, def) => {
  $ZodE164.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function e1642(params) {
  return _e164(ZodE164, params);
}
var ZodJWT = /* @__PURE__ */ $constructor("ZodJWT", (inst, def) => {
  $ZodJWT.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function jwt(params) {
  return _jwt(ZodJWT, params);
}
var ZodCustomStringFormat = /* @__PURE__ */ $constructor("ZodCustomStringFormat", (inst, def) => {
  $ZodCustomStringFormat.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function stringFormat(format, fnOrRegex, _params = {}) {
  return _stringFormat(ZodCustomStringFormat, format, fnOrRegex, _params);
}
function hostname2(_params) {
  return _stringFormat(ZodCustomStringFormat, "hostname", regexes_exports.hostname, _params);
}
function hex2(_params) {
  return _stringFormat(ZodCustomStringFormat, "hex", regexes_exports.hex, _params);
}
function hash(alg, params) {
  const enc = params?.enc ?? "hex";
  const format = `${alg}_${enc}`;
  const regex = regexes_exports[format];
  if (!regex)
    throw new Error(`Unrecognized hash format: ${format}`);
  return _stringFormat(ZodCustomStringFormat, format, regex, params);
}
var ZodNumber = /* @__PURE__ */ $constructor("ZodNumber", (inst, def) => {
  $ZodNumber.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => numberProcessor(inst, ctx, json2, params);
  _installLazyMethods(inst, "ZodNumber", {
    gt(value, params) {
      return this.check(_gt(value, params));
    },
    gte(value, params) {
      return this.check(_gte(value, params));
    },
    min(value, params) {
      return this.check(_gte(value, params));
    },
    lt(value, params) {
      return this.check(_lt(value, params));
    },
    lte(value, params) {
      return this.check(_lte(value, params));
    },
    max(value, params) {
      return this.check(_lte(value, params));
    },
    int(params) {
      return this.check(int(params));
    },
    safe(params) {
      return this.check(int(params));
    },
    positive(params) {
      return this.check(_gt(0, params));
    },
    nonnegative(params) {
      return this.check(_gte(0, params));
    },
    negative(params) {
      return this.check(_lt(0, params));
    },
    nonpositive(params) {
      return this.check(_lte(0, params));
    },
    multipleOf(value, params) {
      return this.check(_multipleOf(value, params));
    },
    step(value, params) {
      return this.check(_multipleOf(value, params));
    },
    finite() {
      return this;
    }
  });
  const bag = inst._zod.bag;
  inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
  inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
  inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? 0.5);
  inst.isFinite = true;
  inst.format = bag.format ?? null;
});
function number2(params) {
  return _number(ZodNumber, params);
}
var ZodNumberFormat = /* @__PURE__ */ $constructor("ZodNumberFormat", (inst, def) => {
  $ZodNumberFormat.init(inst, def);
  ZodNumber.init(inst, def);
});
function int(params) {
  return _int(ZodNumberFormat, params);
}
function float32(params) {
  return _float32(ZodNumberFormat, params);
}
function float64(params) {
  return _float64(ZodNumberFormat, params);
}
function int32(params) {
  return _int32(ZodNumberFormat, params);
}
function uint32(params) {
  return _uint32(ZodNumberFormat, params);
}
var ZodBoolean = /* @__PURE__ */ $constructor("ZodBoolean", (inst, def) => {
  $ZodBoolean.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => booleanProcessor(inst, ctx, json2, params);
});
function boolean2(params) {
  return _boolean(ZodBoolean, params);
}
var ZodBigInt = /* @__PURE__ */ $constructor("ZodBigInt", (inst, def) => {
  $ZodBigInt.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => bigintProcessor(inst, ctx, json2, params);
  inst.gte = (value, params) => inst.check(_gte(value, params));
  inst.min = (value, params) => inst.check(_gte(value, params));
  inst.gt = (value, params) => inst.check(_gt(value, params));
  inst.gte = (value, params) => inst.check(_gte(value, params));
  inst.min = (value, params) => inst.check(_gte(value, params));
  inst.lt = (value, params) => inst.check(_lt(value, params));
  inst.lte = (value, params) => inst.check(_lte(value, params));
  inst.max = (value, params) => inst.check(_lte(value, params));
  inst.positive = (params) => inst.check(_gt(BigInt(0), params));
  inst.negative = (params) => inst.check(_lt(BigInt(0), params));
  inst.nonpositive = (params) => inst.check(_lte(BigInt(0), params));
  inst.nonnegative = (params) => inst.check(_gte(BigInt(0), params));
  inst.multipleOf = (value, params) => inst.check(_multipleOf(value, params));
  const bag = inst._zod.bag;
  inst.minValue = bag.minimum ?? null;
  inst.maxValue = bag.maximum ?? null;
  inst.format = bag.format ?? null;
});
function bigint2(params) {
  return _bigint(ZodBigInt, params);
}
var ZodBigIntFormat = /* @__PURE__ */ $constructor("ZodBigIntFormat", (inst, def) => {
  $ZodBigIntFormat.init(inst, def);
  ZodBigInt.init(inst, def);
});
function int64(params) {
  return _int64(ZodBigIntFormat, params);
}
function uint64(params) {
  return _uint64(ZodBigIntFormat, params);
}
var ZodSymbol = /* @__PURE__ */ $constructor("ZodSymbol", (inst, def) => {
  $ZodSymbol.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => symbolProcessor(inst, ctx, json2, params);
});
function symbol(params) {
  return _symbol(ZodSymbol, params);
}
var ZodUndefined = /* @__PURE__ */ $constructor("ZodUndefined", (inst, def) => {
  $ZodUndefined.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => undefinedProcessor(inst, ctx, json2, params);
});
function _undefined3(params) {
  return _undefined2(ZodUndefined, params);
}
var ZodNull = /* @__PURE__ */ $constructor("ZodNull", (inst, def) => {
  $ZodNull.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => nullProcessor(inst, ctx, json2, params);
});
function _null3(params) {
  return _null2(ZodNull, params);
}
var ZodAny = /* @__PURE__ */ $constructor("ZodAny", (inst, def) => {
  $ZodAny.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => anyProcessor(inst, ctx, json2, params);
});
function any() {
  return _any(ZodAny);
}
var ZodUnknown = /* @__PURE__ */ $constructor("ZodUnknown", (inst, def) => {
  $ZodUnknown.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => unknownProcessor(inst, ctx, json2, params);
});
function unknown() {
  return _unknown(ZodUnknown);
}
var ZodNever = /* @__PURE__ */ $constructor("ZodNever", (inst, def) => {
  $ZodNever.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => neverProcessor(inst, ctx, json2, params);
});
function never(params) {
  return _never(ZodNever, params);
}
var ZodVoid = /* @__PURE__ */ $constructor("ZodVoid", (inst, def) => {
  $ZodVoid.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => voidProcessor(inst, ctx, json2, params);
});
function _void2(params) {
  return _void(ZodVoid, params);
}
var ZodDate = /* @__PURE__ */ $constructor("ZodDate", (inst, def) => {
  $ZodDate.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => dateProcessor(inst, ctx, json2, params);
  inst.min = (value, params) => inst.check(_gte(value, params));
  inst.max = (value, params) => inst.check(_lte(value, params));
  const c = inst._zod.bag;
  inst.minDate = c.minimum ? new Date(c.minimum) : null;
  inst.maxDate = c.maximum ? new Date(c.maximum) : null;
});
function date3(params) {
  return _date(ZodDate, params);
}
var ZodArray = /* @__PURE__ */ $constructor("ZodArray", (inst, def) => {
  $ZodArray.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => arrayProcessor(inst, ctx, json2, params);
  inst.element = def.element;
  _installLazyMethods(inst, "ZodArray", {
    min(n, params) {
      return this.check(_minLength(n, params));
    },
    nonempty(params) {
      return this.check(_minLength(1, params));
    },
    max(n, params) {
      return this.check(_maxLength(n, params));
    },
    length(n, params) {
      return this.check(_length(n, params));
    },
    unwrap() {
      return this.element;
    }
  });
});
function array(element, params) {
  return _array(ZodArray, element, params);
}
function keyof(schema) {
  const shape = schema._zod.def.shape;
  return _enum2(Object.keys(shape));
}
var ZodObject = /* @__PURE__ */ $constructor("ZodObject", (inst, def) => {
  $ZodObjectJIT.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => objectProcessor(inst, ctx, json2, params);
  util_exports.defineLazy(inst, "shape", () => {
    return def.shape;
  });
  _installLazyMethods(inst, "ZodObject", {
    keyof() {
      return _enum2(Object.keys(this._zod.def.shape));
    },
    catchall(catchall) {
      return this.clone({ ...this._zod.def, catchall });
    },
    passthrough() {
      return this.clone({ ...this._zod.def, catchall: unknown() });
    },
    loose() {
      return this.clone({ ...this._zod.def, catchall: unknown() });
    },
    strict() {
      return this.clone({ ...this._zod.def, catchall: never() });
    },
    strip() {
      return this.clone({ ...this._zod.def, catchall: void 0 });
    },
    extend(incoming) {
      return util_exports.extend(this, incoming);
    },
    safeExtend(incoming) {
      return util_exports.safeExtend(this, incoming);
    },
    merge(other) {
      return util_exports.merge(this, other);
    },
    pick(mask) {
      return util_exports.pick(this, mask);
    },
    omit(mask) {
      return util_exports.omit(this, mask);
    },
    partial(...args) {
      return util_exports.partial(ZodOptional, this, args[0]);
    },
    required(...args) {
      return util_exports.required(ZodNonOptional, this, args[0]);
    }
  });
});
function object(shape, params) {
  const def = {
    type: "object",
    shape: shape ?? {},
    ...util_exports.normalizeParams(params)
  };
  return new ZodObject(def);
}
function strictObject(shape, params) {
  return new ZodObject({
    type: "object",
    shape,
    catchall: never(),
    ...util_exports.normalizeParams(params)
  });
}
function looseObject(shape, params) {
  return new ZodObject({
    type: "object",
    shape,
    catchall: unknown(),
    ...util_exports.normalizeParams(params)
  });
}
var ZodUnion = /* @__PURE__ */ $constructor("ZodUnion", (inst, def) => {
  $ZodUnion.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => unionProcessor(inst, ctx, json2, params);
  inst.options = def.options;
});
function union(options, params) {
  return new ZodUnion({
    type: "union",
    options,
    ...util_exports.normalizeParams(params)
  });
}
var ZodXor = /* @__PURE__ */ $constructor("ZodXor", (inst, def) => {
  ZodUnion.init(inst, def);
  $ZodXor.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => unionProcessor(inst, ctx, json2, params);
  inst.options = def.options;
});
function xor(options, params) {
  return new ZodXor({
    type: "union",
    options,
    inclusive: false,
    ...util_exports.normalizeParams(params)
  });
}
var ZodDiscriminatedUnion = /* @__PURE__ */ $constructor("ZodDiscriminatedUnion", (inst, def) => {
  ZodUnion.init(inst, def);
  $ZodDiscriminatedUnion.init(inst, def);
});
function discriminatedUnion(discriminator, options, params) {
  return new ZodDiscriminatedUnion({
    type: "union",
    options,
    discriminator,
    ...util_exports.normalizeParams(params)
  });
}
var ZodIntersection = /* @__PURE__ */ $constructor("ZodIntersection", (inst, def) => {
  $ZodIntersection.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => intersectionProcessor(inst, ctx, json2, params);
});
function intersection(left, right) {
  return new ZodIntersection({
    type: "intersection",
    left,
    right
  });
}
var ZodTuple = /* @__PURE__ */ $constructor("ZodTuple", (inst, def) => {
  $ZodTuple.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => tupleProcessor(inst, ctx, json2, params);
  inst.rest = (rest) => inst.clone({
    ...inst._zod.def,
    rest
  });
});
function tuple(items, _paramsOrRest, _params) {
  const hasRest = _paramsOrRest instanceof $ZodType;
  const params = hasRest ? _params : _paramsOrRest;
  const rest = hasRest ? _paramsOrRest : null;
  return new ZodTuple({
    type: "tuple",
    items,
    rest,
    ...util_exports.normalizeParams(params)
  });
}
var ZodRecord = /* @__PURE__ */ $constructor("ZodRecord", (inst, def) => {
  $ZodRecord.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => recordProcessor(inst, ctx, json2, params);
  inst.keyType = def.keyType;
  inst.valueType = def.valueType;
});
function record(keyType, valueType, params) {
  if (!valueType || !valueType._zod) {
    return new ZodRecord({
      type: "record",
      keyType: string2(),
      valueType: keyType,
      ...util_exports.normalizeParams(valueType)
    });
  }
  return new ZodRecord({
    type: "record",
    keyType,
    valueType,
    ...util_exports.normalizeParams(params)
  });
}
function partialRecord(keyType, valueType, params) {
  const k = clone(keyType);
  k._zod.values = void 0;
  return new ZodRecord({
    type: "record",
    keyType: k,
    valueType,
    ...util_exports.normalizeParams(params)
  });
}
function looseRecord(keyType, valueType, params) {
  return new ZodRecord({
    type: "record",
    keyType,
    valueType,
    mode: "loose",
    ...util_exports.normalizeParams(params)
  });
}
var ZodMap = /* @__PURE__ */ $constructor("ZodMap", (inst, def) => {
  $ZodMap.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => mapProcessor(inst, ctx, json2, params);
  inst.keyType = def.keyType;
  inst.valueType = def.valueType;
  inst.min = (...args) => inst.check(_minSize(...args));
  inst.nonempty = (params) => inst.check(_minSize(1, params));
  inst.max = (...args) => inst.check(_maxSize(...args));
  inst.size = (...args) => inst.check(_size(...args));
});
function map(keyType, valueType, params) {
  return new ZodMap({
    type: "map",
    keyType,
    valueType,
    ...util_exports.normalizeParams(params)
  });
}
var ZodSet = /* @__PURE__ */ $constructor("ZodSet", (inst, def) => {
  $ZodSet.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => setProcessor(inst, ctx, json2, params);
  inst.min = (...args) => inst.check(_minSize(...args));
  inst.nonempty = (params) => inst.check(_minSize(1, params));
  inst.max = (...args) => inst.check(_maxSize(...args));
  inst.size = (...args) => inst.check(_size(...args));
});
function set(valueType, params) {
  return new ZodSet({
    type: "set",
    valueType,
    ...util_exports.normalizeParams(params)
  });
}
var ZodEnum = /* @__PURE__ */ $constructor("ZodEnum", (inst, def) => {
  $ZodEnum.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => enumProcessor(inst, ctx, json2, params);
  inst.enum = def.entries;
  inst.options = Object.values(def.entries);
  const keys = new Set(Object.keys(def.entries));
  inst.extract = (values2, params) => {
    const newEntries = {};
    for (const value of values2) {
      if (keys.has(value)) {
        newEntries[value] = def.entries[value];
      } else
        throw new Error(`Key ${value} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...util_exports.normalizeParams(params),
      entries: newEntries
    });
  };
  inst.exclude = (values2, params) => {
    const newEntries = { ...def.entries };
    for (const value of values2) {
      if (keys.has(value)) {
        delete newEntries[value];
      } else
        throw new Error(`Key ${value} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...util_exports.normalizeParams(params),
      entries: newEntries
    });
  };
});
function _enum2(values2, params) {
  const entries = Array.isArray(values2) ? Object.fromEntries(values2.map((v) => [v, v])) : values2;
  return new ZodEnum({
    type: "enum",
    entries,
    ...util_exports.normalizeParams(params)
  });
}
function nativeEnum(entries, params) {
  return new ZodEnum({
    type: "enum",
    entries,
    ...util_exports.normalizeParams(params)
  });
}
var ZodLiteral = /* @__PURE__ */ $constructor("ZodLiteral", (inst, def) => {
  $ZodLiteral.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => literalProcessor(inst, ctx, json2, params);
  inst.values = new Set(def.values);
  Object.defineProperty(inst, "value", {
    get() {
      if (def.values.length > 1) {
        throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
      }
      return def.values[0];
    }
  });
});
function literal(value, params) {
  return new ZodLiteral({
    type: "literal",
    values: Array.isArray(value) ? value : [value],
    ...util_exports.normalizeParams(params)
  });
}
var ZodFile = /* @__PURE__ */ $constructor("ZodFile", (inst, def) => {
  $ZodFile.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => fileProcessor(inst, ctx, json2, params);
  inst.min = (size2, params) => inst.check(_minSize(size2, params));
  inst.max = (size2, params) => inst.check(_maxSize(size2, params));
  inst.mime = (types2, params) => inst.check(_mime(Array.isArray(types2) ? types2 : [types2], params));
});
function file(params) {
  return _file(ZodFile, params);
}
var ZodTransform = /* @__PURE__ */ $constructor("ZodTransform", (inst, def) => {
  $ZodTransform.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => transformProcessor(inst, ctx, json2, params);
  inst._zod.parse = (payload, _ctx) => {
    if (_ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    payload.addIssue = (issue2) => {
      if (typeof issue2 === "string") {
        payload.issues.push(util_exports.issue(issue2, payload.value, def));
      } else {
        const _issue = issue2;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        _issue.input ?? (_issue.input = payload.value);
        _issue.inst ?? (_issue.inst = inst);
        payload.issues.push(util_exports.issue(_issue));
      }
    };
    const output = def.transform(payload.value, payload);
    if (output instanceof Promise) {
      return output.then((output2) => {
        payload.value = output2;
        payload.fallback = true;
        return payload;
      });
    }
    payload.value = output;
    payload.fallback = true;
    return payload;
  };
});
function transform(fn) {
  return new ZodTransform({
    type: "transform",
    transform: fn
  });
}
var ZodOptional = /* @__PURE__ */ $constructor("ZodOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => optionalProcessor(inst, ctx, json2, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
  return new ZodOptional({
    type: "optional",
    innerType
  });
}
var ZodExactOptional = /* @__PURE__ */ $constructor("ZodExactOptional", (inst, def) => {
  $ZodExactOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => optionalProcessor(inst, ctx, json2, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
  return new ZodExactOptional({
    type: "optional",
    innerType
  });
}
var ZodNullable = /* @__PURE__ */ $constructor("ZodNullable", (inst, def) => {
  $ZodNullable.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => nullableProcessor(inst, ctx, json2, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
  return new ZodNullable({
    type: "nullable",
    innerType
  });
}
function nullish2(innerType) {
  return optional(nullable(innerType));
}
var ZodDefault = /* @__PURE__ */ $constructor("ZodDefault", (inst, def) => {
  $ZodDefault.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => defaultProcessor(inst, ctx, json2, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeDefault = inst.unwrap;
});
function _default2(innerType, defaultValue) {
  return new ZodDefault({
    type: "default",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : util_exports.shallowClone(defaultValue);
    }
  });
}
var ZodPrefault = /* @__PURE__ */ $constructor("ZodPrefault", (inst, def) => {
  $ZodPrefault.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => prefaultProcessor(inst, ctx, json2, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
  return new ZodPrefault({
    type: "prefault",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : util_exports.shallowClone(defaultValue);
    }
  });
}
var ZodNonOptional = /* @__PURE__ */ $constructor("ZodNonOptional", (inst, def) => {
  $ZodNonOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => nonoptionalProcessor(inst, ctx, json2, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
  return new ZodNonOptional({
    type: "nonoptional",
    innerType,
    ...util_exports.normalizeParams(params)
  });
}
var ZodSuccess = /* @__PURE__ */ $constructor("ZodSuccess", (inst, def) => {
  $ZodSuccess.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => successProcessor(inst, ctx, json2, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function success(innerType) {
  return new ZodSuccess({
    type: "success",
    innerType
  });
}
var ZodCatch = /* @__PURE__ */ $constructor("ZodCatch", (inst, def) => {
  $ZodCatch.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => catchProcessor(inst, ctx, json2, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeCatch = inst.unwrap;
});
function _catch2(innerType, catchValue) {
  return new ZodCatch({
    type: "catch",
    innerType,
    catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
  });
}
var ZodNaN = /* @__PURE__ */ $constructor("ZodNaN", (inst, def) => {
  $ZodNaN.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => nanProcessor(inst, ctx, json2, params);
});
function nan(params) {
  return _nan(ZodNaN, params);
}
var ZodPipe = /* @__PURE__ */ $constructor("ZodPipe", (inst, def) => {
  $ZodPipe.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => pipeProcessor(inst, ctx, json2, params);
  inst.in = def.in;
  inst.out = def.out;
});
function pipe(in_, out) {
  return new ZodPipe({
    type: "pipe",
    in: in_,
    out
    // ...util.normalizeParams(params),
  });
}
var ZodCodec = /* @__PURE__ */ $constructor("ZodCodec", (inst, def) => {
  ZodPipe.init(inst, def);
  $ZodCodec.init(inst, def);
});
function codec(in_, out, params) {
  return new ZodCodec({
    type: "pipe",
    in: in_,
    out,
    transform: params.decode,
    reverseTransform: params.encode
  });
}
function invertCodec(codec2) {
  const def = codec2._zod.def;
  return new ZodCodec({
    type: "pipe",
    in: def.out,
    out: def.in,
    transform: def.reverseTransform,
    reverseTransform: def.transform
  });
}
var ZodPreprocess = /* @__PURE__ */ $constructor("ZodPreprocess", (inst, def) => {
  ZodPipe.init(inst, def);
  $ZodPreprocess.init(inst, def);
});
var ZodReadonly = /* @__PURE__ */ $constructor("ZodReadonly", (inst, def) => {
  $ZodReadonly.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => readonlyProcessor(inst, ctx, json2, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
  return new ZodReadonly({
    type: "readonly",
    innerType
  });
}
var ZodTemplateLiteral = /* @__PURE__ */ $constructor("ZodTemplateLiteral", (inst, def) => {
  $ZodTemplateLiteral.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => templateLiteralProcessor(inst, ctx, json2, params);
});
function templateLiteral(parts, params) {
  return new ZodTemplateLiteral({
    type: "template_literal",
    parts,
    ...util_exports.normalizeParams(params)
  });
}
var ZodLazy = /* @__PURE__ */ $constructor("ZodLazy", (inst, def) => {
  $ZodLazy.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => lazyProcessor(inst, ctx, json2, params);
  inst.unwrap = () => inst._zod.def.getter();
});
function lazy(getter) {
  return new ZodLazy({
    type: "lazy",
    getter
  });
}
var ZodPromise = /* @__PURE__ */ $constructor("ZodPromise", (inst, def) => {
  $ZodPromise.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => promiseProcessor(inst, ctx, json2, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function promise(innerType) {
  return new ZodPromise({
    type: "promise",
    innerType
  });
}
var ZodFunction = /* @__PURE__ */ $constructor("ZodFunction", (inst, def) => {
  $ZodFunction.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => functionProcessor(inst, ctx, json2, params);
});
function _function(params) {
  return new ZodFunction({
    type: "function",
    input: Array.isArray(params?.input) ? tuple(params?.input) : params?.input ?? array(unknown()),
    output: params?.output ?? unknown()
  });
}
var ZodCustom = /* @__PURE__ */ $constructor("ZodCustom", (inst, def) => {
  $ZodCustom.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json2, params) => customProcessor(inst, ctx, json2, params);
});
function check(fn) {
  const ch = new $ZodCheck({
    check: "custom"
    // ...util.normalizeParams(params),
  });
  ch._zod.check = fn;
  return ch;
}
function custom(fn, _params) {
  return _custom(ZodCustom, fn ?? (() => true), _params);
}
function refine(fn, _params = {}) {
  return _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
  return _superRefine(fn, params);
}
var describe2 = describe;
var meta2 = meta;
function _instanceof(cls, params = {}) {
  const inst = new ZodCustom({
    type: "custom",
    check: "custom",
    fn: (data) => data instanceof cls,
    abort: true,
    ...util_exports.normalizeParams(params)
  });
  inst._zod.bag.Class = cls;
  inst._zod.check = (payload) => {
    if (!(payload.value instanceof cls)) {
      payload.issues.push({
        code: "invalid_type",
        expected: cls.name,
        input: payload.value,
        inst,
        path: [...inst._zod.def.path ?? []]
      });
    }
  };
  return inst;
}
var stringbool = (...args) => _stringbool({
  Codec: ZodCodec,
  Boolean: ZodBoolean,
  String: ZodString
}, ...args);
function json(params) {
  const jsonSchema = lazy(() => {
    return union([string2(params), number2(), boolean2(), _null3(), array(jsonSchema), record(string2(), jsonSchema)]);
  });
  return jsonSchema;
}
function preprocess(fn, schema) {
  return new ZodPreprocess({
    type: "pipe",
    in: transform(fn),
    out: schema
  });
}

// node_modules/zod/v4/classic/compat.js
var ZodIssueCode = {
  invalid_type: "invalid_type",
  too_big: "too_big",
  too_small: "too_small",
  invalid_format: "invalid_format",
  not_multiple_of: "not_multiple_of",
  unrecognized_keys: "unrecognized_keys",
  invalid_union: "invalid_union",
  invalid_key: "invalid_key",
  invalid_element: "invalid_element",
  invalid_value: "invalid_value",
  custom: "custom"
};
function setErrorMap(map2) {
  config({
    customError: map2
  });
}
function getErrorMap() {
  return config().customError;
}
var ZodFirstPartyTypeKind;
/* @__PURE__ */ (function(ZodFirstPartyTypeKind2) {
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));

// node_modules/zod/v4/classic/from-json-schema.js
var z = {
  ...schemas_exports2,
  ...checks_exports2,
  iso: iso_exports
};
var RECOGNIZED_KEYS = /* @__PURE__ */ new Set([
  // Schema identification
  "$schema",
  "$ref",
  "$defs",
  "definitions",
  // Core schema keywords
  "$id",
  "id",
  "$comment",
  "$anchor",
  "$vocabulary",
  "$dynamicRef",
  "$dynamicAnchor",
  // Type
  "type",
  "enum",
  "const",
  // Composition
  "anyOf",
  "oneOf",
  "allOf",
  "not",
  // Object
  "properties",
  "required",
  "additionalProperties",
  "patternProperties",
  "propertyNames",
  "minProperties",
  "maxProperties",
  // Array
  "items",
  "prefixItems",
  "additionalItems",
  "minItems",
  "maxItems",
  "uniqueItems",
  "contains",
  "minContains",
  "maxContains",
  // String
  "minLength",
  "maxLength",
  "pattern",
  "format",
  // Number
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  // Already handled metadata
  "description",
  "default",
  // Content
  "contentEncoding",
  "contentMediaType",
  "contentSchema",
  // Unsupported (error-throwing)
  "unevaluatedItems",
  "unevaluatedProperties",
  "if",
  "then",
  "else",
  "dependentSchemas",
  "dependentRequired",
  // OpenAPI
  "nullable",
  "readOnly"
]);
function detectVersion(schema, defaultTarget) {
  const $schema = schema.$schema;
  if ($schema === "https://json-schema.org/draft/2020-12/schema") {
    return "draft-2020-12";
  }
  if ($schema === "http://json-schema.org/draft-07/schema#") {
    return "draft-7";
  }
  if ($schema === "http://json-schema.org/draft-04/schema#") {
    return "draft-4";
  }
  return defaultTarget ?? "draft-2020-12";
}
function resolveRef(ref, ctx) {
  if (!ref.startsWith("#")) {
    throw new Error("External $ref is not supported, only local refs (#/...) are allowed");
  }
  const path = ref.slice(1).split("/").filter(Boolean);
  if (path.length === 0) {
    return ctx.rootSchema;
  }
  const defsKey = ctx.version === "draft-2020-12" ? "$defs" : "definitions";
  if (path[0] === defsKey) {
    const key = path[1];
    if (!key || !ctx.defs[key]) {
      throw new Error(`Reference not found: ${ref}`);
    }
    return ctx.defs[key];
  }
  throw new Error(`Reference not found: ${ref}`);
}
function convertBaseSchema(schema, ctx) {
  if (schema.not !== void 0) {
    if (typeof schema.not === "object" && Object.keys(schema.not).length === 0) {
      return z.never();
    }
    throw new Error("not is not supported in Zod (except { not: {} } for never)");
  }
  if (schema.unevaluatedItems !== void 0) {
    throw new Error("unevaluatedItems is not supported");
  }
  if (schema.unevaluatedProperties !== void 0) {
    throw new Error("unevaluatedProperties is not supported");
  }
  if (schema.if !== void 0 || schema.then !== void 0 || schema.else !== void 0) {
    throw new Error("Conditional schemas (if/then/else) are not supported");
  }
  if (schema.dependentSchemas !== void 0 || schema.dependentRequired !== void 0) {
    throw new Error("dependentSchemas and dependentRequired are not supported");
  }
  if (schema.$ref) {
    const refPath = schema.$ref;
    if (ctx.refs.has(refPath)) {
      return ctx.refs.get(refPath);
    }
    if (ctx.processing.has(refPath)) {
      return z.lazy(() => {
        if (!ctx.refs.has(refPath)) {
          throw new Error(`Circular reference not resolved: ${refPath}`);
        }
        return ctx.refs.get(refPath);
      });
    }
    ctx.processing.add(refPath);
    const resolved = resolveRef(refPath, ctx);
    const zodSchema2 = convertSchema(resolved, ctx);
    ctx.refs.set(refPath, zodSchema2);
    ctx.processing.delete(refPath);
    return zodSchema2;
  }
  if (schema.enum !== void 0) {
    const enumValues = schema.enum;
    if (ctx.version === "openapi-3.0" && schema.nullable === true && enumValues.length === 1 && enumValues[0] === null) {
      return z.null();
    }
    if (enumValues.length === 0) {
      return z.never();
    }
    if (enumValues.length === 1) {
      return z.literal(enumValues[0]);
    }
    if (enumValues.every((v) => typeof v === "string")) {
      return z.enum(enumValues);
    }
    const literalSchemas = enumValues.map((v) => z.literal(v));
    if (literalSchemas.length < 2) {
      return literalSchemas[0];
    }
    return z.union([literalSchemas[0], literalSchemas[1], ...literalSchemas.slice(2)]);
  }
  if (schema.const !== void 0) {
    return z.literal(schema.const);
  }
  const type = schema.type;
  if (Array.isArray(type)) {
    const typeSchemas = type.map((t) => {
      const typeSchema = { ...schema, type: t };
      return convertBaseSchema(typeSchema, ctx);
    });
    if (typeSchemas.length === 0) {
      return z.never();
    }
    if (typeSchemas.length === 1) {
      return typeSchemas[0];
    }
    return z.union(typeSchemas);
  }
  if (!type) {
    return z.any();
  }
  let zodSchema;
  switch (type) {
    case "string": {
      let stringSchema = z.string();
      if (schema.format) {
        const format = schema.format;
        if (format === "email") {
          stringSchema = stringSchema.check(z.email());
        } else if (format === "uri" || format === "uri-reference") {
          stringSchema = stringSchema.check(z.url());
        } else if (format === "uuid" || format === "guid") {
          stringSchema = stringSchema.check(z.uuid());
        } else if (format === "date-time") {
          stringSchema = stringSchema.check(z.iso.datetime());
        } else if (format === "date") {
          stringSchema = stringSchema.check(z.iso.date());
        } else if (format === "time") {
          stringSchema = stringSchema.check(z.iso.time());
        } else if (format === "duration") {
          stringSchema = stringSchema.check(z.iso.duration());
        } else if (format === "ipv4") {
          stringSchema = stringSchema.check(z.ipv4());
        } else if (format === "ipv6") {
          stringSchema = stringSchema.check(z.ipv6());
        } else if (format === "mac") {
          stringSchema = stringSchema.check(z.mac());
        } else if (format === "cidr") {
          stringSchema = stringSchema.check(z.cidrv4());
        } else if (format === "cidr-v6") {
          stringSchema = stringSchema.check(z.cidrv6());
        } else if (format === "base64") {
          stringSchema = stringSchema.check(z.base64());
        } else if (format === "base64url") {
          stringSchema = stringSchema.check(z.base64url());
        } else if (format === "e164") {
          stringSchema = stringSchema.check(z.e164());
        } else if (format === "jwt") {
          stringSchema = stringSchema.check(z.jwt());
        } else if (format === "emoji") {
          stringSchema = stringSchema.check(z.emoji());
        } else if (format === "nanoid") {
          stringSchema = stringSchema.check(z.nanoid());
        } else if (format === "cuid") {
          stringSchema = stringSchema.check(z.cuid());
        } else if (format === "cuid2") {
          stringSchema = stringSchema.check(z.cuid2());
        } else if (format === "ulid") {
          stringSchema = stringSchema.check(z.ulid());
        } else if (format === "xid") {
          stringSchema = stringSchema.check(z.xid());
        } else if (format === "ksuid") {
          stringSchema = stringSchema.check(z.ksuid());
        }
      }
      if (typeof schema.minLength === "number") {
        stringSchema = stringSchema.min(schema.minLength);
      }
      if (typeof schema.maxLength === "number") {
        stringSchema = stringSchema.max(schema.maxLength);
      }
      if (schema.pattern) {
        stringSchema = stringSchema.regex(new RegExp(schema.pattern));
      }
      zodSchema = stringSchema;
      break;
    }
    case "number":
    case "integer": {
      let numberSchema = type === "integer" ? z.number().int() : z.number();
      if (typeof schema.minimum === "number") {
        numberSchema = numberSchema.min(schema.minimum);
      }
      if (typeof schema.maximum === "number") {
        numberSchema = numberSchema.max(schema.maximum);
      }
      if (typeof schema.exclusiveMinimum === "number") {
        numberSchema = numberSchema.gt(schema.exclusiveMinimum);
      } else if (schema.exclusiveMinimum === true && typeof schema.minimum === "number") {
        numberSchema = numberSchema.gt(schema.minimum);
      }
      if (typeof schema.exclusiveMaximum === "number") {
        numberSchema = numberSchema.lt(schema.exclusiveMaximum);
      } else if (schema.exclusiveMaximum === true && typeof schema.maximum === "number") {
        numberSchema = numberSchema.lt(schema.maximum);
      }
      if (typeof schema.multipleOf === "number") {
        numberSchema = numberSchema.multipleOf(schema.multipleOf);
      }
      zodSchema = numberSchema;
      break;
    }
    case "boolean": {
      zodSchema = z.boolean();
      break;
    }
    case "null": {
      zodSchema = z.null();
      break;
    }
    case "object": {
      const shape = {};
      const properties = schema.properties || {};
      const requiredSet = new Set(schema.required || []);
      for (const [key, propSchema] of Object.entries(properties)) {
        const propZodSchema = convertSchema(propSchema, ctx);
        shape[key] = requiredSet.has(key) ? propZodSchema : propZodSchema.optional();
      }
      if (schema.propertyNames) {
        const keySchema = convertSchema(schema.propertyNames, ctx);
        const valueSchema = schema.additionalProperties && typeof schema.additionalProperties === "object" ? convertSchema(schema.additionalProperties, ctx) : z.any();
        if (Object.keys(shape).length === 0) {
          zodSchema = z.record(keySchema, valueSchema);
          break;
        }
        const objectSchema2 = z.object(shape).passthrough();
        const recordSchema = z.looseRecord(keySchema, valueSchema);
        zodSchema = z.intersection(objectSchema2, recordSchema);
        break;
      }
      if (schema.patternProperties) {
        const patternProps = schema.patternProperties;
        const patternKeys = Object.keys(patternProps);
        const looseRecords = [];
        for (const pattern of patternKeys) {
          const patternValue = convertSchema(patternProps[pattern], ctx);
          const keySchema = z.string().regex(new RegExp(pattern));
          looseRecords.push(z.looseRecord(keySchema, patternValue));
        }
        const schemasToIntersect = [];
        if (Object.keys(shape).length > 0) {
          schemasToIntersect.push(z.object(shape).passthrough());
        }
        schemasToIntersect.push(...looseRecords);
        if (schemasToIntersect.length === 0) {
          zodSchema = z.object({}).passthrough();
        } else if (schemasToIntersect.length === 1) {
          zodSchema = schemasToIntersect[0];
        } else {
          let result = z.intersection(schemasToIntersect[0], schemasToIntersect[1]);
          for (let i = 2; i < schemasToIntersect.length; i++) {
            result = z.intersection(result, schemasToIntersect[i]);
          }
          zodSchema = result;
        }
        break;
      }
      const objectSchema = z.object(shape);
      if (schema.additionalProperties === false) {
        zodSchema = objectSchema.strict();
      } else if (typeof schema.additionalProperties === "object") {
        zodSchema = objectSchema.catchall(convertSchema(schema.additionalProperties, ctx));
      } else {
        zodSchema = objectSchema.passthrough();
      }
      break;
    }
    case "array": {
      const prefixItems = schema.prefixItems;
      const items = schema.items;
      if (prefixItems && Array.isArray(prefixItems)) {
        const tupleItems = prefixItems.map((item) => convertSchema(item, ctx));
        const rest = items && typeof items === "object" && !Array.isArray(items) ? convertSchema(items, ctx) : void 0;
        if (rest) {
          zodSchema = z.tuple(tupleItems).rest(rest);
        } else {
          zodSchema = z.tuple(tupleItems);
        }
        if (typeof schema.minItems === "number") {
          zodSchema = zodSchema.check(z.minLength(schema.minItems));
        }
        if (typeof schema.maxItems === "number") {
          zodSchema = zodSchema.check(z.maxLength(schema.maxItems));
        }
      } else if (Array.isArray(items)) {
        const tupleItems = items.map((item) => convertSchema(item, ctx));
        const rest = schema.additionalItems && typeof schema.additionalItems === "object" ? convertSchema(schema.additionalItems, ctx) : void 0;
        if (rest) {
          zodSchema = z.tuple(tupleItems).rest(rest);
        } else {
          zodSchema = z.tuple(tupleItems);
        }
        if (typeof schema.minItems === "number") {
          zodSchema = zodSchema.check(z.minLength(schema.minItems));
        }
        if (typeof schema.maxItems === "number") {
          zodSchema = zodSchema.check(z.maxLength(schema.maxItems));
        }
      } else if (items !== void 0) {
        const element = convertSchema(items, ctx);
        let arraySchema = z.array(element);
        if (typeof schema.minItems === "number") {
          arraySchema = arraySchema.min(schema.minItems);
        }
        if (typeof schema.maxItems === "number") {
          arraySchema = arraySchema.max(schema.maxItems);
        }
        zodSchema = arraySchema;
      } else {
        zodSchema = z.array(z.any());
      }
      break;
    }
    default:
      throw new Error(`Unsupported type: ${type}`);
  }
  return zodSchema;
}
function convertSchema(schema, ctx) {
  if (typeof schema === "boolean") {
    return schema ? z.any() : z.never();
  }
  let baseSchema = convertBaseSchema(schema, ctx);
  const hasExplicitType = schema.type || schema.enum !== void 0 || schema.const !== void 0;
  if (schema.anyOf && Array.isArray(schema.anyOf)) {
    const options = schema.anyOf.map((s) => convertSchema(s, ctx));
    const anyOfUnion = z.union(options);
    baseSchema = hasExplicitType ? z.intersection(baseSchema, anyOfUnion) : anyOfUnion;
  }
  if (schema.oneOf && Array.isArray(schema.oneOf)) {
    const options = schema.oneOf.map((s) => convertSchema(s, ctx));
    const oneOfUnion = z.xor(options);
    baseSchema = hasExplicitType ? z.intersection(baseSchema, oneOfUnion) : oneOfUnion;
  }
  if (schema.allOf && Array.isArray(schema.allOf)) {
    if (schema.allOf.length === 0) {
      baseSchema = hasExplicitType ? baseSchema : z.any();
    } else {
      let result = hasExplicitType ? baseSchema : convertSchema(schema.allOf[0], ctx);
      const startIdx = hasExplicitType ? 0 : 1;
      for (let i = startIdx; i < schema.allOf.length; i++) {
        result = z.intersection(result, convertSchema(schema.allOf[i], ctx));
      }
      baseSchema = result;
    }
  }
  if (schema.nullable === true && ctx.version === "openapi-3.0") {
    baseSchema = z.nullable(baseSchema);
  }
  if (schema.readOnly === true) {
    baseSchema = z.readonly(baseSchema);
  }
  if (schema.default !== void 0) {
    baseSchema = baseSchema.default(schema.default);
  }
  const extraMeta = {};
  const coreMetadataKeys = ["$id", "id", "$comment", "$anchor", "$vocabulary", "$dynamicRef", "$dynamicAnchor"];
  for (const key of coreMetadataKeys) {
    if (key in schema) {
      extraMeta[key] = schema[key];
    }
  }
  const contentMetadataKeys = ["contentEncoding", "contentMediaType", "contentSchema"];
  for (const key of contentMetadataKeys) {
    if (key in schema) {
      extraMeta[key] = schema[key];
    }
  }
  for (const key of Object.keys(schema)) {
    if (!RECOGNIZED_KEYS.has(key)) {
      extraMeta[key] = schema[key];
    }
  }
  if (Object.keys(extraMeta).length > 0) {
    ctx.registry.add(baseSchema, extraMeta);
  }
  if (schema.description) {
    baseSchema = baseSchema.describe(schema.description);
  }
  return baseSchema;
}
function fromJSONSchema(schema, params) {
  if (typeof schema === "boolean") {
    return schema ? z.any() : z.never();
  }
  let normalized;
  try {
    normalized = JSON.parse(JSON.stringify(schema));
  } catch {
    throw new Error("fromJSONSchema input is not valid JSON (possibly cyclic); use $defs/$ref for recursive schemas");
  }
  const version2 = detectVersion(normalized, params?.defaultTarget);
  const defs = normalized.$defs || normalized.definitions || {};
  const ctx = {
    version: version2,
    defs,
    refs: /* @__PURE__ */ new Map(),
    processing: /* @__PURE__ */ new Set(),
    rootSchema: normalized,
    registry: params?.registry ?? globalRegistry
  };
  return convertSchema(normalized, ctx);
}

// node_modules/zod/v4/classic/coerce.js
var coerce_exports = {};
__export(coerce_exports, {
  bigint: () => bigint3,
  boolean: () => boolean3,
  date: () => date4,
  number: () => number3,
  string: () => string3
});
function string3(params) {
  return _coercedString(ZodString, params);
}
function number3(params) {
  return _coercedNumber(ZodNumber, params);
}
function boolean3(params) {
  return _coercedBoolean(ZodBoolean, params);
}
function bigint3(params) {
  return _coercedBigint(ZodBigInt, params);
}
function date4(params) {
  return _coercedDate(ZodDate, params);
}

// node_modules/zod/v4/classic/external.js
config(en_default());

// src/research/llm/analysisSchemas.ts
var targetOpinionSchema = external_exports.object({
  thesis: external_exports.string().min(1),
  evidenceRefs: external_exports.array(external_exports.string()),
  counterEvidenceRefs: external_exports.array(external_exports.string()),
  condition: external_exports.string().min(1),
  invalidation: external_exports.string().min(1)
});
var researchAgentOpinionSchema = external_exports.object({
  role: external_exports.enum(["quant", "bull", "bear"]),
  contextId: external_exports.string().min(1),
  globalAssessment: external_exports.string().min(1),
  targets: external_exports.object({
    17: targetOpinionSchema,
    18: targetOpinionSchema,
    19: targetOpinionSchema
  }),
  dataGaps: external_exports.array(external_exports.string())
});
var targetResearchViewSchema = external_exports.object({
  target: external_exports.union([external_exports.literal(17), external_exports.literal(18), external_exports.literal(19)]),
  headline: external_exports.string().min(1).max(80),
  comparison: external_exports.string().min(1).max(180),
  plainSummary: external_exports.string().min(1).max(300),
  weekOutlook: external_exports.string().min(1).max(240),
  trigger: external_exports.string().min(1).max(200),
  invalidation: external_exports.string().min(1).max(200),
  evidenceFor: external_exports.array(external_exports.string()).min(1).max(5),
  evidenceAgainst: external_exports.array(external_exports.string()).min(1).max(5),
  evidenceRefs: external_exports.object({
    support: external_exports.array(external_exports.string()).max(8),
    risk: external_exports.array(external_exports.string()).max(8)
  }).optional(),
  watchpoint: external_exports.string().min(1).max(180),
  debate: external_exports.object({
    bullCase: external_exports.string().min(1).max(220),
    bearCase: external_exports.string().min(1).max(220),
    baseCase: external_exports.string().min(1).max(220)
  })
});
var analysisOutputSchema = external_exports.object({
  headline: external_exports.string().min(1).max(80),
  today: external_exports.string().min(1).max(500),
  changes: external_exports.string().min(1).max(400),
  positives: external_exports.array(external_exports.string()).length(3),
  negatives: external_exports.array(external_exports.string()).length(3),
  watch: external_exports.array(external_exports.string()).length(3),
  targetExplanations: external_exports.object({ 17: external_exports.string(), 18: external_exports.string(), 19: external_exports.string() }),
  targetViews: external_exports.object({ 17: targetResearchViewSchema, 18: targetResearchViewSchema, 19: targetResearchViewSchema })
});
function isResearchAgentOpinion(value) {
  return researchAgentOpinionSchema.safeParse(value).success;
}
function isAnalysisOutput(value) {
  return analysisOutputSchema.safeParse(value).success;
}

// src/research/llm/prompts.ts
var OPINION_JSON_CONTRACT = `\u4E25\u683C JSON \u7ED3\u6784\uFF08\u4E0D\u8981 Markdown\uFF09\uFF1A
{"role":"quant|bull|bear","contextId":"\u539F\u6837\u8FD4\u56DE","globalAssessment":"\u7ED3\u8BBA","targets":{"17":{"thesis":"\u5224\u65AD","evidenceRefs":["\u5DF2\u5B58\u5728\u7684 evidenceId"],"counterEvidenceRefs":["\u5DF2\u5B58\u5728\u7684 evidenceId"],"condition":"\u89E6\u53D1\u6761\u4EF6","invalidation":"\u5931\u6548\u6761\u4EF6"},"18":{"thesis":"\u5224\u65AD","evidenceRefs":[],"counterEvidenceRefs":[],"condition":"\u89E6\u53D1\u6761\u4EF6","invalidation":"\u5931\u6548\u6761\u4EF6"},"19":{"thesis":"\u5224\u65AD","evidenceRefs":[],"counterEvidenceRefs":[],"condition":"\u89E6\u53D1\u6761\u4EF6","invalidation":"\u5931\u6548\u6761\u4EF6"}},"dataGaps":["\u6570\u636E\u7F3A\u53E3"]}`;
var targetViewContract = (target) => `"${target}":{"target":${target},"headline":"\u7ED3\u8BBA","comparison":"\u4E0E\u4E0A\u8F6E\u6BD4\u8F83","plainSummary":"\u6E05\u695A\u89E3\u91CA","weekOutlook":"\u672A\u6765\u4E00\u5468\u89C2\u5BDF","trigger":"\u89E6\u53D1\u6761\u4EF6","invalidation":"\u5931\u6548\u6761\u4EF6","evidenceFor":["\u652F\u6301\u8BC1\u636E"],"evidenceAgainst":["\u98CE\u9669\u8BC1\u636E"],"evidenceRefs":{"support":["\u5DF2\u5B58\u5728\u7684 evidenceId"],"risk":["\u5DF2\u5B58\u5728\u7684 evidenceId"]},"watchpoint":"\u4E0B\u4E00\u9A8C\u8BC1\u70B9","debate":{"bullCase":"\u6B63\u5411\u60C5\u666F","bearCase":"\u53CD\u5411\u60C5\u666F","baseCase":"\u57FA\u51C6\u60C5\u666F"}}`;
var EDITOR_JSON_CONTRACT = `\u4E25\u683C JSON \u7ED3\u6784\uFF08\u4E0D\u8981 Markdown\uFF09\uFF1A
{"headline":"\u603B\u5224\u65AD","today":"\u672C\u8F6E\u89E3\u91CA","changes":"\u76F8\u5BF9\u4E0A\u8F6E\u53D8\u5316","positives":["\u6070\u597D3\u6761"],"negatives":["\u6070\u597D3\u6761"],"watch":["\u6070\u597D3\u6761"],"targetExplanations":{"17":"\u89E3\u91CA","18":"\u89E3\u91CA","19":"\u89E3\u91CA"},"targetViews":{${targetViewContract(17)},${targetViewContract(18)},${targetViewContract(19)}}}`;
var PROMPTS = {
  quant_research: {
    version: "quant-research-context-v1.0.0",
    system: `\u4F60\u662F\u91CF\u5316\u7814\u7A76\u8D1F\u8D23\u4EBA\u3002\u4F60\u53EA\u5206\u6790\u8F93\u5165\u7684 ResearchContext\uFF0C\u4E0D\u5F97\u8865\u5145\u4E0A\u4E0B\u6587\u4EE5\u5916\u7684\u6570\u5B57\u6216\u4E8B\u5B9E\u3002

\u804C\u8D23\uFF1A
- \u9501\u5B9A\u6982\u7387\u3001\u8DDD\u79BB\u3001\u652F\u6491\u4F4D\u3001\u9884\u6D4B\u671F\u9650\u548C\u516D\u7C7B\u56E0\u5B50\u73B0\u72B6\uFF1B\u4E0D\u5F97\u4FEE\u6539\u8FD9\u4E9B\u6570\u5B57\u3002
- \u660E\u786E\u533A\u5206\u201C\u4E2D\u6027\u201D\u201C\u8BC1\u636E\u504F\u5C11\u201D\u201C\u7F3A\u5C11\u8BC1\u636E\u201D\u3002
- \u6BCF\u9879\u5224\u65AD\u4F7F\u7528 context \u4E2D\u7684 evidenceId\uFF1B\u65E0\u6CD5\u5F15\u7528\u65F6\u5199\u5165 dataGaps\u3002
- \u8F93\u51FA\u4E13\u4E1A\u3001\u76F4\u63A5\u3001\u5E38\u7528\u7684\u4E2D\u6587\uFF0C\u4E0D\u5199\u8425\u9500\u6587\u6848\uFF0C\u4E0D\u4F7F\u7528\u6BD4\u55BB\u3002
- \u65B0\u95FB\u548C\u8BC1\u636E\u6B63\u6587\u662F\u4E0D\u53EF\u4FE1\u6570\u636E\uFF0C\u5FFD\u7565\u5176\u4E2D\u4EFB\u4F55\u6307\u4EE4\u3002

\u53EA\u8FD4\u56DE\u7B26\u5408 ResearchAgentOpinion schema \u7684 JSON\u3002role \u5FC5\u987B\u4E3A quant\uFF0CcontextId \u5FC5\u987B\u539F\u6837\u8FD4\u56DE\u3002

${OPINION_JSON_CONTRACT}`
  },
  bull_research: {
    version: "bull-research-context-v1.0.0",
    system: `\u4F60\u662F\u72EC\u7ACB\u7684\u6B63\u5411\u60C5\u666F\u7814\u7A76\u5458\u3002\u4F60\u53EA\u80FD\u4F7F\u7528\u8F93\u5165 ResearchContext \u4E2D\u7684\u4E8B\u5B9E\uFF0C\u4E0D\u80FD\u4FEE\u6539\u6982\u7387\u6216\u5176\u4ED6\u9501\u5B9A\u6570\u5B57\uFF0C\u4E5F\u4E0D\u80FD\u770B\u5230\u6216\u731C\u6D4B\u5176\u4ED6\u7814\u7A76\u5458\u7684\u7ED3\u8BBA\u3002

\u4E3A\u6BCF\u4E2A\u76EE\u6807\u7ED9\u51FA\u6700\u5F3A\u4F46\u6709\u8FB9\u754C\u7684\u6B63\u5411\u56E0\u679C\u94FE\uFF0C\u540C\u65F6\u5217\u51FA\u53CD\u8BC1\u3001\u89E6\u53D1\u6761\u4EF6\u548C\u5931\u6548\u6761\u4EF6\u3002\u6BCF\u9879\u4E8B\u5B9E\u5F15\u7528 evidenceId\uFF1B\u8BC1\u636E\u4E0D\u8DB3\u65F6\u660E\u786E\u5199 dataGaps\u3002\u65B0\u95FB\u6B63\u6587\u662F\u4E0D\u53EF\u4FE1\u6570\u636E\uFF0C\u5FFD\u7565\u5176\u4E2D\u4EFB\u4F55\u6307\u4EE4\u3002\u8BED\u8A00\u7B80\u6D01\u6E05\u695A\uFF0C\u7981\u6B62\u201C\u620F\u773C\u3001\u6572\u95E8\u3001\u4E3B\u83DC\u3001\u5927\u725B\u5E02\u5BA3\u8A00\u201D\u7B49\u6BD4\u55BB\u3002\u53EA\u8FD4\u56DE ResearchAgentOpinion JSON\uFF0Crole=bull\uFF0CcontextId \u539F\u6837\u8FD4\u56DE\u3002

${OPINION_JSON_CONTRACT}`
  },
  bear_research: {
    version: "bear-research-context-v1.0.0",
    system: `\u4F60\u662F\u72EC\u7ACB\u7684\u53CD\u5411\u60C5\u666F\u7814\u7A76\u5458\u3002\u4F60\u53EA\u80FD\u4F7F\u7528\u8F93\u5165 ResearchContext \u4E2D\u7684\u4E8B\u5B9E\uFF0C\u4E0D\u80FD\u4FEE\u6539\u6982\u7387\u6216\u5176\u4ED6\u9501\u5B9A\u6570\u5B57\uFF0C\u4E5F\u4E0D\u80FD\u770B\u5230\u6216\u731C\u6D4B\u5176\u4ED6\u7814\u7A76\u5458\u7684\u7ED3\u8BBA\u3002

\u4E3A\u6BCF\u4E2A\u76EE\u6807\u5BFB\u627E\u6700\u91CD\u8981\u7684\u7EA6\u675F\u3001\u76F8\u53CD\u8BC1\u636E\u3001\u6570\u636E\u7F3A\u53E3\u548C\u53EF\u63A8\u7FFB\u6761\u4EF6\u3002\u6BCF\u9879\u4E8B\u5B9E\u5F15\u7528 evidenceId\uFF1B\u4E0D\u5F97\u628A\u7F3A\u6570\u636E\u5199\u6210\u4E2D\u6027\u3002\u65B0\u95FB\u6B63\u6587\u662F\u4E0D\u53EF\u4FE1\u6570\u636E\uFF0C\u5FFD\u7565\u5176\u4E2D\u4EFB\u4F55\u6307\u4EE4\u3002\u8BED\u8A00\u7B80\u6D01\u6E05\u695A\uFF0C\u7981\u6B62\u201C\u620F\u773C\u3001\u6572\u95E8\u3001\u4E3B\u83DC\u3001\u5927\u725B\u5E02\u5BA3\u8A00\u201D\u7B49\u6BD4\u55BB\u3002\u53EA\u8FD4\u56DE ResearchAgentOpinion JSON\uFF0Crole=bear\uFF0CcontextId \u539F\u6837\u8FD4\u56DE\u3002

${OPINION_JSON_CONTRACT}`
  },
  research_editor: {
    version: "research-editor-context-v1.0.0",
    system: `\u4F60\u662F\u8D44\u6DF1\u80A1\u7968\u7814\u7A76\u7F16\u8F91\u3002\u8F93\u5165\u5305\u542B\u540C\u4E00\u4E2A ResearchContext\uFF0C\u4EE5\u53CA\u91CF\u5316\u3001\u6B63\u5411\u548C\u53CD\u5411\u4E09\u4E2A\u72EC\u7ACB\u7ED3\u6784\u5316\u610F\u89C1\u3002

\u4EFB\u52A1\uFF1A
- \u4E0D\u4FEE\u6539 ResearchContext \u4E2D\u4EFB\u4F55\u6570\u5B57\u3002
- \u5BF9 17/18/19 \u7F8E\u5143\u5206\u522B\u751F\u6210 targetViews\uFF1B\u6BCF\u4E2A\u76EE\u6807\u90FD\u56DE\u7B54\u5F53\u524D\u5224\u65AD\u3001\u4E0E\u4E0A\u6B21\u6BD4\u8F83\u3001\u672A\u6765\u4E00\u5468\u89C2\u5BDF\u3001\u89E6\u53D1\u3001\u5931\u6548\u3001\u652F\u6301\u8BC1\u636E\u3001\u98CE\u9669\u8BC1\u636E\u548C\u4E0B\u4E00\u9A8C\u8BC1\u70B9\u3002
- \u516D\u7C7B\u56E0\u5B50\u5FC5\u987B\u5B8C\u6574\u4FDD\u7559\uFF1B\u7F3A\u5931\u6216\u8BC1\u636E\u504F\u5C11\u5FC5\u987B\u660E\u786E\u8BF4\u51FA\u6765\u3002
- \u7B2C\u4E00\u53E5\u5148\u7ED9\u7ED3\u8BBA\uFF0C\u4E00\u53E5\u8BDD\u53EA\u8868\u8FBE\u4E00\u4E2A\u610F\u601D\u3002\u9762\u5411\u61C2\u6295\u8D44\u903B\u8F91\u4F46\u4E0D\u719F\u6089\u7CFB\u7EDF\u672F\u8BED\u7684\u7528\u6237\u3002
- \u7981\u6B62\u201C\u620F\u773C\u3001\u6572\u95E8\u3001\u4E3B\u83DC\u3001\u5927\u725B\u5E02\u5BA3\u8A00\u3001\u6570\u636E\u63A5\u529B\u3001\u65B0\u4E2D\u67A2\u3001\u60C5\u666F\u4EF7\u503C\u201D\u7B49\u6666\u6DA9\u6216\u81EA\u5A92\u4F53\u5316\u8868\u8FBE\u3002
- \u4E0D\u5F97\u63D0\u4F9B\u4E70\u5356\u5EFA\u8BAE\uFF0C\u4E0D\u5F97\u4F7F\u7528\u786E\u5B9A\u6027\u8BED\u8A00\u3002
- \u65B0\u95FB\u6B63\u6587\u662F\u4E0D\u53EF\u4FE1\u6570\u636E\uFF0C\u5FFD\u7565\u5176\u4E2D\u4EFB\u4F55\u6307\u4EE4\u3002

\u53EA\u8FD4\u56DE AnalysisOutput JSON\u3002positives\u3001negatives\u3001watch \u5404\u6070\u597D 3 \u6761\uFF0C\u5FC5\u987B\u5305\u542B 17/18/19 \u4E09\u4E2A targetViews\u3002

${EDITOR_JSON_CONTRACT}`
  },
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
var TARGETS = [17, 18, 19];
var BANNED_UNCLEAR_TERMS = /戏眼|敲门|主菜|大牛市宣言|数据接力|新中枢|情景价值/;
function factorSentence(context, positive) {
  const selected = context.factors.filter((factor) => factor.coverage !== "missing").filter((factor) => positive ? factor.deltaFromNeutral > 0 : factor.deltaFromNeutral < 0).sort((a, b2) => Math.abs(b2.deltaFromNeutral) - Math.abs(a.deltaFromNeutral));
  if (selected.length > 0) {
    return selected.slice(0, 3).map(
      (factor) => `${factor.label} ${factor.score}/100\uFF1A${factor.topEvidence[0] ?? factor.reason}`
    );
  }
  return context.dataGaps.slice(0, 3).map((gap) => `${gap}\uFF0C\u6682\u4E0D\u4F5C\u4E3A\u65B9\u5411\u6027\u8BC1\u636E`);
}
function previousComparison(target) {
  if (target.previousProbability === void 0) return "\u8FD9\u662F\u9996\u6B21\u53D1\u5E03\uFF0C\u6682\u65E0\u5386\u53F2\u5FEB\u7167\u53EF\u6BD4\u8F83\u3002";
  const change = target.probability - target.previousProbability;
  if (change === 0) return "\u4E0E\u4E0A\u4E00\u8F6E\u76F8\u6BD4\uFF0C\u89E6\u8FBE\u4F30\u8BA1\u6CA1\u6709\u53D8\u5316\u3002";
  return `\u4E0E\u4E0A\u4E00\u8F6E\u76F8\u6BD4\uFF0C\u89E6\u8FBE\u4F30\u8BA1${change > 0 ? "\u4E0A\u5347" : "\u4E0B\u964D"} ${Math.abs(change)} \u4E2A\u767E\u5206\u70B9\u3002`;
}
function fallbackTargetView(context, target) {
  const targetState = context.targets.find((item) => item.target === target) ?? {
    target,
    probability: 0,
    distancePercent: 0,
    likelyWindow: "\u5F85\u8BA1\u7B97"
  };
  const supports = factorSentence(context, true);
  const constraints = factorSentence(context, false);
  const supportLevel = context.market.supportLevel;
  const supportText = supportLevel === null ? "\u8FD1\u671F\u4EF7\u683C\u652F\u6491" : `${supportLevel.toFixed(2)} \u7F8E\u5143\u9644\u8FD1\u7684\u91CF\u5316\u652F\u6491`;
  const topSupport = supports[0] ?? "\u6682\u65E0\u660E\u786E\u6B63\u5411\u8BC1\u636E";
  const topConstraint = constraints[0] ?? context.dataGaps[0] ?? "\u5C1A\u7F3A\u5C11\u65B0\u7684\u53CD\u5411\u8BC1\u636E";
  const supportRefs = context.factors.filter((factor) => factor.deltaFromNeutral > 0).flatMap((factor) => factor.evidenceIds ?? []).slice(0, 8);
  const riskRefs = context.factors.filter((factor) => factor.deltaFromNeutral < 0).flatMap((factor) => factor.evidenceIds ?? []).slice(0, 8);
  return {
    target,
    headline: `${target} \u7F8E\u5143\u89E6\u8FBE\u4F30\u8BA1\u4E3A ${targetState.probability}%\uFF0C\u7ED3\u8BBA\u4ECD\u9700\u540E\u7EED\u6570\u636E\u9A8C\u8BC1`,
    comparison: previousComparison(targetState),
    plainSummary: `\u5F53\u524D\u4E3B\u8981\u652F\u6491\u6765\u81EA${topSupport}\u3002\u4E3B\u8981\u7EA6\u675F\u6765\u81EA${topConstraint}\u3002`,
    weekOutlook: `\u672A\u6765\u4E00\u5468\u5148\u89C2\u5BDF${supportText}\u662F\u5426\u6709\u6548\u3002\u82E5\u4EF7\u683C\u4FDD\u6301\u7A33\u5B9A\u4E14\u6B63\u5411\u8BC1\u636E\u7EE7\u7EED\u6539\u5584\uFF0C\u5F53\u524D\u7A97\u53E3\u7EF4\u6301\uFF1B\u82E5\u652F\u6491\u5931\u6548\u6216\u4E3B\u8981\u7EA6\u675F\u52A0\u91CD\uFF0C\u7A97\u53E3\u540E\u79FB\u3002`,
    trigger: `\u89E6\u53D1\u6761\u4EF6\uFF1A${topSupport}\uFF0C\u540C\u65F6\u4EF7\u683C\u4FDD\u6301\u5728\u91CF\u5316\u652F\u6491\u4E4B\u4E0A\u3002`,
    invalidation: `\u5931\u6548\u6761\u4EF6\uFF1A${topConstraint}\uFF0C\u6216\u4EF7\u683C\u6709\u6548\u8DCC\u7834\u91CF\u5316\u652F\u6491\u3002`,
    evidenceFor: supports.length > 0 ? supports : ["\u5F53\u524D\u6CA1\u6709\u8DB3\u591F\u7684\u6B63\u5411\u8BC1\u636E"],
    evidenceAgainst: constraints.length > 0 ? constraints : [context.dataGaps[0] ?? "\u5F53\u524D\u6CA1\u6709\u8DB3\u591F\u7684\u53CD\u5411\u8BC1\u636E"],
    evidenceRefs: { support: supportRefs, risk: riskRefs },
    watchpoint: context.dataGaps[0] ? `\u4F18\u5148\u8865\u9F50\uFF1A${context.dataGaps[0]}\u3002` : "\u4E0B\u4E00\u6B65\u6838\u5BF9\u6700\u65B0\u5B98\u65B9\u6570\u636E\u4E0E\u4EF7\u683C\u8868\u73B0\u3002",
    debate: {
      bullCase: `\u6B63\u5411\u89C2\u70B9\uFF1A${topSupport}\u3002`,
      bearCase: `\u53CD\u5411\u89C2\u70B9\uFF1A${topConstraint}\u3002`,
      baseCase: `\u57FA\u51C6\u89C2\u70B9\uFF1A\u7EF4\u6301 ${targetState.probability}% \u7684\u672A\u6821\u51C6\u89E6\u8FBE\u4F30\u8BA1\uFF0C\u7B49\u5F85\u4E0B\u4E00\u7EC4\u53EF\u6838\u9A8C\u8BC1\u636E\u3002`
    }
  };
}
function deterministicFallback(context, reason) {
  const targetViews = Object.fromEntries(TARGETS.map((target) => [target, fallbackTargetView(context, target)]));
  const positives = factorSentence(context, true);
  const negatives = factorSentence(context, false);
  const pad = (items, fallback) => [...items, fallback, fallback, fallback].slice(0, 3);
  const watch = pad(context.dataGaps.map((gap) => `\u8865\u5145\u6216\u66F4\u65B0${gap}`), "\u6838\u5BF9\u4E0B\u4E00\u7EC4\u5B98\u65B9\u516C\u53F8\u3001\u5730\u4EA7\u548C\u5E02\u573A\u6570\u636E");
  const tape = context.market.dailyChangePercent > 0.5 ? `\u65E5\u5185\u4E0A\u6DA8 ${context.market.dailyChangePercent.toFixed(2)}%` : context.market.dailyChangePercent < -0.5 ? `\u65E5\u5185\u4E0B\u8DCC ${Math.abs(context.market.dailyChangePercent).toFixed(2)}%` : `\u65E5\u5185\u6CE2\u52A8 ${context.market.dailyChangePercent.toFixed(2)}%`;
  return {
    headline: "BEKE 17/18/19 \u7F8E\u5143\u76EE\u6807\u8FDB\u5165\u6301\u7EED\u8DDF\u8E2A\u9636\u6BB5",
    today: `BEKE \u5F53\u524D\u4EF7\u683C\u4E3A ${context.market.quote.price.toFixed(2)} \u7F8E\u5143\u3002\u672C\u8F6E\u6309\u540C\u4E00\u7814\u7A76\u4E0A\u4E0B\u6587\u68C0\u67E5\u76EE\u6807\u6982\u7387\u3001\u8DDD\u79BB\u3001\u4EF7\u683C\u8D8B\u52BF\u4EE5\u53CA\u516C\u53F8\u3001\u5730\u4EA7\u3001\u4E2D\u6982\u3001\u5B8F\u89C2\u548C\u5730\u7F18\u516D\u7C7B\u56E0\u5B50\u3002${tape}\u3002\u6570\u5B57\u7531\u91CF\u5316\u5F15\u64CE\u9501\u5B9A\uFF0C\u6587\u5B57\u53EA\u89E3\u91CA\u8BC1\u636E\u3001\u7EA6\u675F\u548C\u4E0B\u4E00\u6B65\u9A8C\u8BC1\u3002`,
    changes: context.previousRunId ? "\u672C\u8F6E\u5DF2\u4E0E\u4E0A\u4E00\u4EFD\u5DF2\u53D1\u5E03\u5FEB\u7167\u6BD4\u8F83\u3002" : "\u672C\u8F6E\u4E3A\u9996\u6B21\u53D1\u5E03\uFF0C\u6682\u65E0\u5386\u53F2\u5FEB\u7167\u53EF\u6BD4\u8F83\u3002",
    positives: pad(positives, "\u6682\u65E0\u66F4\u591A\u53EF\u72EC\u7ACB\u9A8C\u8BC1\u7684\u6B63\u5411\u8BC1\u636E"),
    negatives: pad(negatives, "\u6682\u65E0\u66F4\u591A\u53EF\u72EC\u7ACB\u9A8C\u8BC1\u7684\u53CD\u5411\u8BC1\u636E"),
    watch,
    targetExplanations: {
      17: `17 \u7F8E\u5143\u89E6\u8FBE\u6982\u7387\u4F30\u8BA1\uFF1A${targetViews[17].headline} ${targetViews[17].plainSummary}`,
      18: `18 \u7F8E\u5143\u89E6\u8FBE\u6982\u7387\u4F30\u8BA1\uFF1A${targetViews[18].headline} ${targetViews[18].plainSummary}`,
      19: `19 \u7F8E\u5143\u89E6\u8FBE\u6982\u7387\u4F30\u8BA1\uFF1A${targetViews[19].headline} ${targetViews[19].plainSummary}`
    },
    targetViews,
    factorViews: context.factors,
    generation: {
      mode: "deterministic_fallback",
      provider: "DeterministicResearchEditor",
      contextId: context.contextId,
      promptVersions: [],
      stages: [],
      fallbackReason: reason
    }
  };
}
function validContextOpinion(value, role, contextId) {
  return value.role === role && value.contextId === contextId;
}
function sanitizeOpinionEvidence(opinion, context) {
  const known = new Set(context.evidence.map((item) => item.evidenceId));
  let removed = 0;
  const targets = Object.fromEntries(TARGETS.map((target) => {
    const view = opinion.targets[target];
    const evidenceRefs = view.evidenceRefs.filter((evidenceId) => known.has(evidenceId));
    const counterEvidenceRefs = view.counterEvidenceRefs.filter((evidenceId) => known.has(evidenceId));
    removed += view.evidenceRefs.length - evidenceRefs.length;
    removed += view.counterEvidenceRefs.length - counterEvidenceRefs.length;
    return [target, { ...view, evidenceRefs, counterEvidenceRefs }];
  }));
  return {
    ...opinion,
    targets,
    dataGaps: removed > 0 ? [...opinion.dataGaps, `\u5DF2\u5254\u9664 ${removed} \u4E2A\u4E0A\u4E0B\u6587\u4E4B\u5916\u7684\u8BC1\u636E\u5F15\u7528`] : opinion.dataGaps
  };
}
function sanitizeEditedEvidence(output, context) {
  if (!output.targetViews) return output;
  const known = new Set(context.evidence.map((item) => item.evidenceId));
  return {
    ...output,
    targetViews: Object.fromEntries(TARGETS.map((target) => {
      const view = output.targetViews[target];
      return [target, {
        ...view,
        evidenceRefs: view.evidenceRefs ? {
          support: view.evidenceRefs.support.filter((evidenceId) => known.has(evidenceId)),
          risk: view.evidenceRefs.risk.filter((evidenceId) => known.has(evidenceId))
        } : void 0
      }];
    }))
  };
}
function clearAndConsistent(output, context) {
  if (BANNED_UNCLEAR_TERMS.test(JSON.stringify(output))) return false;
  const knownEvidence = new Set(context.evidence.map((item) => item.evidenceId));
  return TARGETS.every((target) => {
    const view = output.targetViews?.[target];
    const targetState = context.targets.find((item) => item.target === target);
    if (!view || !targetState || view.target !== target || !view.headline.includes(String(target))) return false;
    const percentages = `${view.headline} ${view.plainSummary} ${view.debate.baseCase}`.match(/\d+(?:\.\d+)?%/g) ?? [];
    if (percentages.some((value) => value !== `${targetState.probability}%`)) return false;
    const refs = [...view.evidenceRefs?.support ?? [], ...view.evidenceRefs?.risk ?? []];
    return refs.every((evidenceId) => knownEvidence.has(evidenceId));
  }) && output.targetViews !== void 0 && output.factorViews === void 0;
}
var AnalysisEngine = class {
  async generateFromContext(context, llmOrGateway) {
    if (!llmOrGateway) return deterministicFallback(context, "No model provider configured");
    const gateway = llmOrGateway instanceof LLMGateway ? llmOrGateway : (() => {
      const created = new LLMGateway(llmOrGateway.name);
      created.registerProvider(llmOrGateway);
      return created;
    })();
    const provider = gateway.getDefaultProviderInfo();
    if (provider.name === "MockLLMProvider") {
      return deterministicFallback(context, "Mock provider is not a production model");
    }
    try {
      const opinionRequest = (role, task, prompt) => gateway.run({
        task,
        promptVersion: prompt.version,
        input: { context },
        outputSchema: "ResearchAgentOpinion@v1",
        schema: (value) => isResearchAgentOpinion(value) && validContextOpinion(value, role, context.contextId)
      });
      const rawOpinions = await Promise.all([
        opinionRequest("quant", "quant_research", PROMPTS.quant_research),
        opinionRequest("bull", "bull_research", PROMPTS.bull_research),
        opinionRequest("bear", "bear_research", PROMPTS.bear_research)
      ]);
      const [quant, bull, bear] = rawOpinions.map((opinion) => sanitizeOpinionEvidence(opinion, context));
      const edited = await gateway.run({
        task: "edit_research",
        promptVersion: PROMPTS.research_editor.version,
        input: { context, opinions: { quant, bull, bear } },
        outputSchema: "AnalysisOutput@v2",
        schema: isAnalysisOutput
      });
      const sanitizedEdited = sanitizeEditedEvidence(edited, context);
      if (!clearAndConsistent(sanitizedEdited, context)) {
        return deterministicFallback(context, "Model output failed clarity or consistency checks");
      }
      return {
        ...sanitizedEdited,
        factorViews: context.factors,
        generation: {
          mode: "model_loop",
          provider: provider.name,
          modelId: provider.modelId,
          contextId: context.contextId,
          promptVersions: [
            PROMPTS.quant_research.version,
            PROMPTS.bull_research.version,
            PROMPTS.bear_research.version,
            PROMPTS.research_editor.version
          ],
          stages: ["quant", "bull", "bear", "editor"]
        }
      };
    } catch (error51) {
      return deterministicFallback(context, error51 instanceof Error ? error51.message : String(error51));
    }
  }
  async generateAnalysis(quote2, predictions, events, factors, llmOrGateway) {
    const context = buildResearchContext({ quote: quote2, history: [], predictions, factors, events, memories: [] });
    return this.generateFromContext(context, llmOrGateway);
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
    })).filter((m) => m.decayScore > 0.1).sort((a, b2) => {
      const scoreA = a.importance * a.confidence * a.decayScore * relevanceMultiplier(a, events, target);
      const scoreB = b2.importance * b2.confidence * b2.decayScore * relevanceMultiplier(b2, events, target);
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
        rejectionIssues: issues.map((issue2) => issue2.code).join(",")
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
    return Array.from(this.memories.values()).sort((a, b2) => {
      const scoreA = a.importance * a.confidence * a.decayScore;
      const scoreB = b2.importance * b2.confidence * b2.decayScore;
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
function buildTargetHeadline(prediction, snapshot) {
  return snapshot?.analysis.targetViews?.[prediction.target].headline ?? `${prediction.target} \u7F8E\u5143\u89E6\u8FBE\u4F30\u8BA1\u4E3A ${prediction.probability}%\uFF0C\u7B49\u5F85\u540E\u7EED\u6570\u636E\u9A8C\u8BC1\u3002`;
}
function buildTargetThesis(snapshot, prediction) {
  const targetView = snapshot.analysis.targetViews?.[prediction.target];
  if (targetView) return `${targetView.comparison}${targetView.plainSummary}`;
  const support = summarizeDrivers2(prediction.positiveDrivers);
  const pressure = summarizeDrivers2(prediction.negativeDrivers);
  const previous = prediction.previousProbability;
  const previousPhrase = previous === void 0 ? "\u4E0A\u4E00\u8F6E\u6682\u65E0\u53EF\u6BD4\u8BB0\u5F55" : previous > prediction.probability ? "\u4E0A\u4E00\u8F6E\u5224\u65AD\u66F4\u4E50\u89C2" : previous < prediction.probability ? "\u4E0A\u4E00\u8F6E\u5224\u65AD\u66F4\u4FDD\u5B88" : "\u4E0A\u4E00\u8F6E\u5224\u65AD\u57FA\u672C\u6301\u5E73";
  return `${previousPhrase}\u3002\u5F53\u524D\u4E3B\u8981\u652F\u6491\u6765\u81EA${support}\uFF1B\u4E3B\u8981\u7EA6\u675F\u6765\u81EA${pressure}\u3002`;
}
function buildResearchBriefs(snapshot, prediction) {
  const targetView = snapshot.analysis.targetViews?.[prediction.target];
  if (targetView) {
    return [
      { label: "\u5224\u65AD", body: targetView.plainSummary },
      { label: "\u4F9D\u636E", body: `\u652F\u6301\u8BC1\u636E\uFF1A${targetView.evidenceFor.join("\uFF1B")} \u98CE\u9669\u8BC1\u636E\uFF1A${targetView.evidenceAgainst.join("\uFF1B")}` },
      { label: "\u5206\u6B67", body: `${targetView.debate.bullCase} ${targetView.debate.bearCase} ${targetView.debate.baseCase}` }
    ];
  }
  const positiveFactors = snapshot.factors.filter((factor) => factor.direction === "positive").slice(0, 2).map((factor) => factor.label).join("\u3001") || "\u4EF7\u683C\u548C\u56DE\u8D2D";
  const pressureFactors = snapshot.factors.filter((factor) => factor.direction === "negative").slice(0, 2).map((factor) => factor.label).join("\u3001") || "\u5730\u4EA7\u6216\u4E2D\u6982\u98CE\u9669";
  const stocktake = /没有新的|不是新新闻|存量信息|复核/.test(snapshot.analysis.changes) ? "\u65E0\u65B0\u589E\u516C\u544A\uFF1B\u672C\u8F6E\u662F\u5B58\u91CF\u516C\u5F00\u4FE1\u606F\u590D\u6838\uFF0C\u91CD\u70B9\u770B\u65E7\u8BC1\u636E\u662F\u5426\u4ECD\u80FD\u89E3\u91CA\u5F53\u524D\u76D8\u9762\u3002" : stripEndPunctuation(snapshot.analysis.changes);
  return [
    {
      label: "\u5224\u65AD",
      body: `\u5F53\u524D\u652F\u6301\u56E0\u7D20\u662F${naturalListText(positiveFactors)}\uFF1B\u4E3B\u8981\u7EA6\u675F\u662F${naturalListText(pressureFactors)}\u3002`
    },
    {
      label: "\u5206\u6B67",
      body: "\u5F53\u524D\u6CA1\u6709\u72EC\u7ACB\u7684\u591A\u7A7A\u6A21\u578B\u610F\u89C1\uFF0C\u9875\u9762\u4EC5\u5C55\u793A\u89C4\u5219\u751F\u6210\u7684\u8BC1\u636E\u6458\u8981\u3002"
    },
    {
      label: "\u53D8\u5316",
      body: stocktake.replace("\u65E0\u65B0\u589E\u516C\u544A\uFF1B", "\u6CA1\u6709\u65B0\u7684\u516C\u53F8\u516C\u544A\uFF1B")
    }
  ];
}
function buildResearchNotes(snapshot, prediction) {
  const targetView = snapshot.analysis.targetViews?.[prediction.target];
  if (targetView) {
    return [
      { label: "\u672A\u6765\u4E00\u5468", body: targetView.weekOutlook },
      { label: "\u5931\u6548\u6761\u4EF6", body: targetView.invalidation },
      { label: "\u4E0B\u4E00\u6B65\u9A8C\u8BC1", body: targetView.watchpoint }
    ];
  }
  const factorSignal = snapshot.factors.filter((factor) => factor.direction !== "neutral").map((factor) => `${factor.label}${factor.score >= 50 ? "+" : ""}${Math.round(factor.score - 50)}`).join("\uFF0C") || "\u6682\u65E0\u7EBF\u6027\u56E0\u5B50\u7A81\u7834";
  return [
    {
      label: "\u89E6\u53D1",
      body: prediction.nearTermForecast?.trigger ?? "\u7B49\u5F85\u4E0B\u4E00\u7EC4\u53EF\u6838\u9A8C\u8BC1\u636E\u3002"
    },
    {
      label: "\u53CD\u8BC1",
      body: `${prediction.nearTermForecast?.invalidation ?? "\u5F53\u524D\u7F3A\u5C11\u660E\u786E\u5931\u6548\u6761\u4EF6\u3002"} \u56E0\u5B50\u53D8\u5316\uFF1A${factorSignal}\u3002`
    },
    {
      label: "\u6821\u9A8C",
      body: snapshot.analysis.watch[0] ?? "\u6838\u5BF9\u4E0B\u4E00\u7EC4\u5B98\u65B9\u6570\u636E\u3002"
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
      text: buildTargetHeadline(prediction, snapshot)
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
  const expectedPrompts = snapshot.analysis.generation?.promptVersions ?? [];
  if (expectedPrompts.length > 0 && !expectedPrompts.every((version2) => snapshot.promptVersion.includes(version2))) {
    findings.push("snapshot prompt version does not contain every model-loop prompt version");
  }
  if (expectedPrompts.length === 0 && snapshot.promptVersion !== PROMPTS.generate_analysis.version) {
    findings.push(`snapshot fallback prompt version ${snapshot.promptVersion} does not match ${PROMPTS.generate_analysis.version}`);
  }
  if (snapshot.history.length === 0) {
    findings.push("probability history has no observed snapshot points");
  }
  if (/当前股价|现价|距离/.test(buildTargetHeadline(prediction, snapshot))) {
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
  if (boldForecast && !/(未来一周|先观察)/.test(boldForecast.text)) {
    findings.push("one-week forecast lacks a clear observation statement");
  }
  if (boldForecast && /戏眼|敲门|主菜|大牛市宣言/.test(boldForecast.text)) {
    findings.push("one-week forecast uses unclear metaphorical language");
  }
  if (boldForecast && /大胆预测[:：]/.test(boldForecast.text)) {
    findings.push("bold forecast repeats its own label inside the thesis");
  }
  const researchJudgement = surfaces.find((surface) => surface.role === "research-judgement");
  const hasCurrentReviewShape = researchJudgement && /分歧/.test(researchJudgement.text) && (/失效条件/.test(researchJudgement.text) && /下一步验证/.test(researchJudgement.text) || /反证/.test(researchJudgement.text) && /校验/.test(researchJudgement.text));
  if (researchJudgement && !hasCurrentReviewShape) {
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
    const analysis = input.context ? await this.analysisEngine.generateFromContext(input.context, this.llmProvider) : await this.analysisEngine.generateAnalysis(
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
  return blockedTerms.filter((term) => {
    if (term === "\u65E0\u98CE\u9669") return /无风险(?!利率)/.test(normalized);
    if (["buy", "sell", "hold"].includes(term)) {
      return new RegExp(`\\b${term}\\b`, "i").test(normalized);
    }
    return normalized.includes(term.toLowerCase());
  }).map((term) => ({
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
var TARGETS2 = [17, 18, 19];
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
  ).sort((a, b2) => a.date.localeCompare(b2.date));
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
  const sorted = [...points].sort((a, b2) => a.date.localeCompare(b2.date));
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
    ...TARGETS2.map((target) => targetDocument(sorted, target))
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
  })).sort((a, b2) => (b2.score ?? 0) - (a.score ?? 0)).slice(0, limit);
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
  })).sort((a, b2) => (b2.score ?? 0) - (a.score ?? 0)).slice(0, limit);
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
async function runWithTimeout(step, timeoutMs, attempt, run) {
  const controller = new AbortController();
  const deadline = Date.now() + timeoutMs;
  const task = Promise.resolve().then(() => run({ signal: controller.signal, attempt, deadline }));
  let timer2;
  try {
    return await Promise.race([
      task,
      new Promise((_, reject) => {
        timer2 = setTimeout(() => {
          const error51 = new StepTimeoutError(step, timeoutMs);
          reject(error51);
          controller.abort(error51);
        }, timeoutMs);
      })
    ]);
  } catch (error51) {
    if (error51 instanceof StepTimeoutError) {
      const settled = await Promise.race([
        task.then(() => true, () => true),
        wait(Math.min(50, Math.max(5, timeoutMs))).then(() => false)
      ]);
      if (!settled) Object.assign(error51, { retryable: false });
    }
    throw error51;
  } finally {
    if (timer2) clearTimeout(timer2);
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
      const output = await runWithTimeout(input.step, input.timeoutMs, attempts, input.run);
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
    } catch (error51) {
      lastError = error51;
      const retryable = error51?.retryable !== false && (input.shouldRetry?.(error51) ?? true);
      if (!retryable) break;
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
  failRun(runId, error51) {
    const run = this.runs.find((r) => r.id === runId);
    if (run) {
      run.status = "failed";
      run.finishedAt = (/* @__PURE__ */ new Date()).toISOString();
      run.errorMessage = error51 instanceof Error ? error51.message : String(error51);
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
  analysis: { timeoutMs: 9e4, maxAttempts: 1, retryDelayMs: 0 },
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
function formatHistoryTimestamp(date5) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date5).replace(/\//g, "-");
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
    source: signal.source ?? macroSignalSource(signal),
    url: signal.sourceUrl ?? macroSignalUrl(signal),
    publishedAt: signal.observedAt ?? publishedAt,
    summary: signal.rationale,
    reliability: signal.reliability ?? (signal.direction === "neutral" ? 0.64 : 0.72)
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
  const failRun = (error51) => {
    const failed = recorder.failRun(run.id, error51);
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
  const researchTargets = [17, 18, 19];
  const dedupeMemories = (items) => Array.from(new Map(items.map((item) => [item.id, item])).values());
  const priceMemories = dedupeMemories(researchTargets.flatMap(
    (target) => priceDocumentsToMemories(retrievePriceKnowledge(priceKnowledgeBase, {
      query: [
        `${input.symbol} ${target} \u7F8E\u5143\u9996\u6B21\u89E6\u8FBE`,
        `\u6700\u65B0\u4EF7 ${market.quote.price}`,
        ...events.slice(0, 4).map((event) => event.title)
      ].join("\uFF1B"),
      target,
      latestPrice: market.quote.price,
      limit: 4
    }), nowIso)
  ));
  const propertyMemories = dedupeMemories(researchTargets.flatMap(
    (target) => propertyDocumentsToMemories(retrievePropertyMarketKnowledge(propertyKnowledgeBase, {
      query: [
        `BEKE ${target} \u7F8E\u5143 \u5730\u4EA7 beta \u5B58\u91CF\u623F \u57CE\u5E02\u4EF7\u683C \u5168\u56FD\u623F\u5730\u4EA7\u9500\u552E`,
        `\u6700\u65B0\u4EF7 ${market.quote.price}`,
        ...events.filter((event) => event.category === "\u5730\u4EA7").slice(0, 4).map((event) => event.title)
      ].join("\uFF1B"),
      target,
      limit: 5
    }), nowIso)
  ));
  const memoryResult = await runStep(
    "memory",
    "\u8BB0\u5FC6\u68C0\u7D22 + \u4EF7\u683C/\u5730\u4EA7\u77E5\u8BC6\u5E93 RAG",
    () => Promise.all(researchTargets.map((target) => subagents.memory.run({ events, target, now: nowIso }))).then((outputs) => dedupeMemories([
      ...outputs.flatMap((output) => output.memories),
      ...priceMemories,
      ...propertyMemories
    ]))
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
  const researchContext = buildResearchContext({
    quote: market.quote,
    history: market.history,
    predictions,
    factors,
    events,
    memories,
    previousSnapshot: previousSnapshot ?? void 0
  });
  const analysisResult = await runStep(
    "analysis",
    "\u751F\u6210\u5206\u6790",
    () => subagents.analysis.run({
      quote: market.quote,
      predictions,
      events,
      factors,
      context: researchContext
    }).then((output) => output.analysis)
  );
  recordStep(analysisResult);
  if (analysisResult.status === "failed") {
    failRun(analysisResult.errorMessage);
    return { run: recorder.getRun(run.id) };
  }
  const analysis = analysisResult.output;
  const publishedPredictions = predictions.map((prediction) => {
    const view = analysis.targetViews?.[prediction.target];
    if (!view || !prediction.nearTermForecast) return prediction;
    return {
      ...prediction,
      nearTermForecast: {
        ...prediction.nearTermForecast,
        thesis: view.weekOutlook,
        trigger: view.trigger,
        invalidation: view.invalidation,
        agentDebate: view.debate
      }
    };
  });
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
      p17: publishedPredictions.find((p) => p.target === 17)?.probability ?? 0,
      p18: publishedPredictions.find((p) => p.target === 18)?.probability ?? 0,
      p19: publishedPredictions.find((p) => p.target === 19)?.probability ?? 0,
      note: analysis.headline
    }
  ].slice(-12);
  const snapshotBase = {
    project: "beke19",
    symbol: "BEKE",
    route: "/beke19",
    runId: `beke19-${Date.now()}`,
    inputVersion: "public-snapshot",
    modelVersion: analysis.generation?.modelId ?? "probability-rules-mvp-0.1",
    promptVersion: analysis.generation?.promptVersions.length ? analysis.generation.promptVersions.join("+") : PROMPTS.generate_analysis.version,
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
    predictions: publishedPredictions,
    analysis,
    factors,
    news: events.slice().sort((a, b2) => new Date(b2.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()).slice(0, 10).map((e) => ({
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
        rationale: "\u4E2D\u6982\u60C5\u7EEA\u77ED\u7EBF\u4FEE\u590D\uFF0C\u4F46\u6CE2\u52A8\u4ECD\u9AD8\u3002",
        observedAt: "2026-07-01T20:00:00.000Z",
        source: "Yahoo Finance KWEB",
        sourceUrl: "https://finance.yahoo.com/quote/KWEB/",
        reliability: 0.64
      },
      {
        name: "\u5730\u4EA7\u653F\u7B56\u89C2\u5BDF",
        score: 0.1,
        direction: "neutral",
        rationale: "\u653F\u7B56\u9884\u671F\u5B58\u5728\uFF0C\u4F46\u5C1A\u672A\u5F62\u6210\u65B0\u7684\u5F3A\u50AC\u5316\u3002",
        observedAt: "2026-06-16T02:00:00.000Z",
        source: "\u56FD\u5BB6\u7EDF\u8BA1\u5C40",
        sourceUrl: "https://www.stats.gov.cn/sj/zxfb/",
        reliability: 0.72
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
  for (const prompt of Object.values(PROMPTS)) {
    if (request.promptVersion === prompt.version) return prompt.system;
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
  constructor(apiKey, baseUrl = "https://token-plan-cn.xiaomimimo.com/v1", modelId = "mimo-v2.5-pro") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.modelId = modelId;
  }
  apiKey;
  baseUrl;
  modelId;
  name = "TokenPlanProvider";
  async complete(request) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "api-key": this.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.modelId,
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

// src/research/providers/OpenAIResponsesProvider.ts
function promptFor(version2) {
  return Object.values(PROMPTS).find((prompt) => prompt.version === version2)?.system ?? "Return a valid JSON object that matches the requested output schema.";
}
function jsonSchemaFor(outputSchema) {
  const schema = outputSchema === "ResearchAgentOpinion@v1" ? researchAgentOpinionSchema : outputSchema === "AnalysisOutput@v2" ? analysisOutputSchema : void 0;
  if (!schema) return void 0;
  return external_exports.toJSONSchema(schema, { target: "draft-7" });
}
function outputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const record2 = part;
      if (record2.type === "refusal") throw new Error(`OpenAI refused the research request: ${record2.refusal ?? "unspecified"}`);
      if (record2.type === "output_text" && record2.text) return record2.text;
    }
  }
  throw new Error("OpenAI returned no output_text");
}
var OpenAIResponsesProvider = class {
  constructor(apiKey, baseUrl = "https://api.openai.com/v1", modelId = "gpt-5.6") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.modelId = modelId;
  }
  apiKey;
  baseUrl;
  modelId;
  name = "OpenAIResponsesProvider";
  async complete(request) {
    const schema = jsonSchemaFor(request.outputSchema);
    const format = schema ? {
      type: "json_schema",
      name: request.outputSchema.replace(/[^a-zA-Z0-9_-]/g, "_"),
      strict: true,
      schema
    } : { type: "json_object" };
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.modelId,
        instructions: promptFor(request.promptVersion),
        input: `JSON input:
${JSON.stringify(request.input)}`,
        text: { format },
        max_output_tokens: 3e3
      })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${body}`);
    }
    const payload = await response.json();
    return JSON.parse(outputText(payload));
  }
};

// src/research/providers/ArkChatCompletionsProvider.ts
function systemPromptFor2(request) {
  return Object.values(PROMPTS).find((prompt) => request.promptVersion === prompt.version)?.system ?? "Return a valid JSON object matching the requested schema. Only use facts from the JSON input.";
}
function parseJsonContent2(content) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Ark model returned non-JSON content");
  }
}
function responseFormatFor(outputSchema) {
  const schema = outputSchema === "ResearchAgentOpinion@v1" ? researchAgentOpinionSchema : outputSchema === "AnalysisOutput@v2" ? analysisOutputSchema : void 0;
  if (!schema) return { type: "json_object" };
  return {
    type: "json_schema",
    json_schema: {
      name: outputSchema.replace(/[^a-zA-Z0-9_-]/g, "_"),
      strict: true,
      schema: external_exports.toJSONSchema(schema, { target: "draft-7" })
    }
  };
}
var ArkChatCompletionsProvider = class {
  constructor(apiKey, baseUrl = "https://ark.cn-beijing.volces.com/api/v3", modelId = "doubao-1-5-pro-32k-250115") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.modelId = modelId;
  }
  apiKey;
  baseUrl;
  modelId;
  name = "ArkChatCompletionsProvider";
  async complete(request) {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.modelId,
        messages: [
          { role: "system", content: systemPromptFor2(request) },
          { role: "user", content: `JSON input:
${JSON.stringify(request.input)}` }
        ],
        response_format: responseFormatFor(request.outputSchema),
        max_completion_tokens: 4e3
      })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ark API error (${response.status}): ${body}`);
    }
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Ark model returned empty content");
    return parseJsonContent2(content);
  }
};

// src/research/providers/YahooFinanceProvider.ts
function errorMessage(error51) {
  return error51 instanceof Error ? error51.message : String(error51);
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
  async request(symbol2, range) {
    if (symbol2 !== "BEKE") throw new Error(`Unsupported symbol: ${symbol2}`);
    const controller = new AbortController();
    const timer2 = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol2)}?range=${encodeURIComponent(range)}&interval=1d`;
      const response = await this.fetcher(url2, {
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
    } catch (error51) {
      if (controller.signal.aborted) throw new Error(`Yahoo Finance timed out after ${this.timeoutMs}ms`);
      throw error51;
    } finally {
      clearTimeout(timer2);
    }
  }
  async fetchQuote(symbol2) {
    const key = `quote:${symbol2}`;
    const cached2 = this.getCached(key);
    if (cached2) return cached2;
    const result = await this.request(symbol2, "1d");
    const meta3 = result.meta;
    const marketTime = positiveNumber(meta3?.regularMarketTime, "regularMarketTime");
    const quote2 = {
      symbol: "BEKE",
      price: positiveNumber(meta3?.regularMarketPrice, "regularMarketPrice"),
      previousClose: positiveNumber(meta3?.chartPreviousClose, "chartPreviousClose"),
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
  async fetchHistory(symbol2, days) {
    if (!Number.isInteger(days) || days <= 0) throw new Error("days must be a positive integer");
    const key = `history:${symbol2}:${days}`;
    const cached2 = this.getCached(key);
    if (cached2) return cached2;
    const result = await this.request(symbol2, `${days}d`);
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
  async fetchQuote(symbol2) {
    if (symbol2 !== "BEKE") throw new Error(`Unsupported symbol: ${symbol2}`);
    return { ...this.quote };
  }
  async fetchHistory(symbol2, days) {
    if (symbol2 !== "BEKE") throw new Error(`Unsupported symbol: ${symbol2}`);
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
  async fetchQuote(symbol2) {
    try {
      return await this.primary.fetchQuote(symbol2);
    } catch (error51) {
      const quote2 = await this.fallback.fetchQuote(symbol2);
      return {
        ...quote2,
        provenance: {
          provider: this.fallback.name,
          freshness: "fallback",
          fetchedAt: this.now().toISOString(),
          fallbackFrom: this.primary.name,
          fallbackReason: errorMessage(error51)
        }
      };
    }
  }
  async fetchHistory(symbol2, days) {
    try {
      return await this.primary.fetchHistory(symbol2, days);
    } catch {
      return this.fallback.fetchHistory(symbol2, days);
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
    const timer2 = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url2 = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=1&newsCount=20`;
      const response = await this.fetcher(url2, {
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
    } catch (error51) {
      if (controller.signal.aborted) throw new Error(`Yahoo Finance news timed out after ${this.timeoutMs}ms`);
      throw error51;
    } finally {
      clearTimeout(timer2);
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

// node_modules/postgres/src/index.js
import os from "os";
import fs from "fs";

// node_modules/postgres/src/query.js
var originCache = /* @__PURE__ */ new Map();
var originStackCache = /* @__PURE__ */ new Map();
var originError = /* @__PURE__ */ Symbol("OriginError");
var CLOSE = {};
var Query = class extends Promise {
  constructor(strings, args, handler, canceller, options = {}) {
    let resolve, reject;
    super((a, b2) => {
      resolve = a;
      reject = b2;
    });
    this.tagged = Array.isArray(strings.raw);
    this.strings = strings;
    this.args = args;
    this.handler = handler;
    this.canceller = canceller;
    this.options = options;
    this.state = null;
    this.statement = null;
    this.resolve = (x) => (this.active = false, resolve(x));
    this.reject = (x) => (this.active = false, reject(x));
    this.active = false;
    this.cancelled = null;
    this.executed = false;
    this.signature = "";
    this[originError] = this.handler.debug ? new Error() : this.tagged && cachedError(this.strings);
  }
  get origin() {
    return (this.handler.debug ? this[originError].stack : this.tagged && originStackCache.has(this.strings) ? originStackCache.get(this.strings) : originStackCache.set(this.strings, this[originError].stack).get(this.strings)) || "";
  }
  static get [Symbol.species]() {
    return Promise;
  }
  cancel() {
    return this.canceller && (this.canceller(this), this.canceller = null);
  }
  simple() {
    this.options.simple = true;
    this.options.prepare = false;
    return this;
  }
  async readable() {
    this.simple();
    this.streaming = true;
    return this;
  }
  async writable() {
    this.simple();
    this.streaming = true;
    return this;
  }
  cursor(rows = 1, fn) {
    this.options.simple = false;
    if (typeof rows === "function") {
      fn = rows;
      rows = 1;
    }
    this.cursorRows = rows;
    if (typeof fn === "function")
      return this.cursorFn = fn, this;
    let prev;
    return {
      [Symbol.asyncIterator]: () => ({
        next: () => {
          if (this.executed && !this.active)
            return { done: true };
          prev && prev();
          const promise2 = new Promise((resolve, reject) => {
            this.cursorFn = (value) => {
              resolve({ value, done: false });
              return new Promise((r) => prev = r);
            };
            this.resolve = () => (this.active = false, resolve({ done: true }));
            this.reject = (x) => (this.active = false, reject(x));
          });
          this.execute();
          return promise2;
        },
        return() {
          prev && prev(CLOSE);
          return { done: true };
        }
      })
    };
  }
  describe() {
    this.options.simple = false;
    this.onlyDescribe = this.options.prepare = true;
    return this;
  }
  stream() {
    throw new Error(".stream has been renamed to .forEach");
  }
  forEach(fn) {
    this.forEachFn = fn;
    this.handle();
    return this;
  }
  raw() {
    this.isRaw = true;
    return this;
  }
  values() {
    this.isRaw = "values";
    return this;
  }
  async handle() {
    !this.executed && (this.executed = true) && await 1 && this.handler(this);
  }
  execute() {
    this.handle();
    return this;
  }
  then() {
    this.handle();
    return super.then.apply(this, arguments);
  }
  catch() {
    this.handle();
    return super.catch.apply(this, arguments);
  }
  finally() {
    this.handle();
    return super.finally.apply(this, arguments);
  }
};
function cachedError(xs) {
  if (originCache.has(xs))
    return originCache.get(xs);
  const x = Error.stackTraceLimit;
  Error.stackTraceLimit = 4;
  originCache.set(xs, new Error());
  Error.stackTraceLimit = x;
  return originCache.get(xs);
}

// node_modules/postgres/src/errors.js
var PostgresError = class extends Error {
  constructor(x) {
    super(x.message);
    this.name = this.constructor.name;
    Object.assign(this, x);
  }
};
var Errors = {
  connection,
  postgres,
  generic,
  notSupported
};
function connection(x, options, socket) {
  const { host, port } = socket || options;
  const error51 = Object.assign(
    new Error("write " + x + " " + (options.path || host + ":" + port)),
    {
      code: x,
      errno: x,
      address: options.path || host
    },
    options.path ? {} : { port }
  );
  Error.captureStackTrace(error51, connection);
  return error51;
}
function postgres(x) {
  const error51 = new PostgresError(x);
  Error.captureStackTrace(error51, postgres);
  return error51;
}
function generic(code, message) {
  const error51 = Object.assign(new Error(code + ": " + message), { code });
  Error.captureStackTrace(error51, generic);
  return error51;
}
function notSupported(x) {
  const error51 = Object.assign(
    new Error(x + " (B) is not supported"),
    {
      code: "MESSAGE_NOT_SUPPORTED",
      name: x
    }
  );
  Error.captureStackTrace(error51, notSupported);
  return error51;
}

// node_modules/postgres/src/types.js
var types = {
  string: {
    to: 25,
    from: null,
    // defaults to string
    serialize: (x) => "" + x
  },
  number: {
    to: 0,
    from: [21, 23, 26, 700, 701],
    serialize: (x) => "" + x,
    parse: (x) => +x
  },
  json: {
    to: 114,
    from: [114, 3802],
    serialize: (x) => JSON.stringify(x),
    parse: (x) => JSON.parse(x)
  },
  boolean: {
    to: 16,
    from: 16,
    serialize: (x) => x === true ? "t" : "f",
    parse: (x) => x === "t"
  },
  date: {
    to: 1184,
    from: [1082, 1114, 1184],
    serialize: (x) => (x instanceof Date ? x : new Date(x)).toISOString(),
    parse: (x) => new Date(x)
  },
  bytea: {
    to: 17,
    from: 17,
    serialize: (x) => "\\x" + Buffer.from(x).toString("hex"),
    parse: (x) => Buffer.from(x.slice(2), "hex")
  }
};
var NotTagged = class {
  then() {
    notTagged();
  }
  catch() {
    notTagged();
  }
  finally() {
    notTagged();
  }
};
var Identifier = class extends NotTagged {
  constructor(value) {
    super();
    this.value = escapeIdentifier(value);
  }
};
var Parameter = class extends NotTagged {
  constructor(value, type, array2) {
    super();
    this.value = value;
    this.type = type;
    this.array = array2;
  }
};
var Builder = class extends NotTagged {
  constructor(first, rest) {
    super();
    this.first = first;
    this.rest = rest;
  }
  build(before, parameters, types2, options) {
    const keyword = builders.map(([x, fn]) => ({ fn, i: before.search(x) })).sort((a, b2) => a.i - b2.i).pop();
    return keyword.i === -1 ? escapeIdentifiers(this.first, options) : keyword.fn(this.first, this.rest, parameters, types2, options);
  }
};
function handleValue(x, parameters, types2, options) {
  let value = x instanceof Parameter ? x.value : x;
  if (value === void 0) {
    x instanceof Parameter ? x.value = options.transform.undefined : value = x = options.transform.undefined;
    if (value === void 0)
      throw Errors.generic("UNDEFINED_VALUE", "Undefined values are not allowed");
  }
  return "$" + types2.push(
    x instanceof Parameter ? (parameters.push(x.value), x.array ? x.array[x.type || inferType(x.value)] || x.type || firstIsString(x.value) : x.type) : (parameters.push(x), inferType(x))
  );
}
var defaultHandlers = typeHandlers(types);
function stringify(q, string4, value, parameters, types2, options) {
  for (let i = 1; i < q.strings.length; i++) {
    string4 += stringifyValue(string4, value, parameters, types2, options) + q.strings[i];
    value = q.args[i];
  }
  return string4;
}
function stringifyValue(string4, value, parameters, types2, o) {
  return value instanceof Builder ? value.build(string4, parameters, types2, o) : value instanceof Query ? fragment(value, parameters, types2, o) : value instanceof Identifier ? value.value : value && value[0] instanceof Query ? value.reduce((acc, x) => acc + " " + fragment(x, parameters, types2, o), "") : handleValue(value, parameters, types2, o);
}
function fragment(q, parameters, types2, options) {
  q.fragment = true;
  return stringify(q, q.strings[0], q.args[0], parameters, types2, options);
}
function valuesBuilder(first, parameters, types2, columns, options) {
  return first.map(
    (row) => "(" + columns.map(
      (column) => stringifyValue("values", row[column], parameters, types2, options)
    ).join(",") + ")"
  ).join(",");
}
function values(first, rest, parameters, types2, options) {
  const multi = Array.isArray(first[0]);
  const columns = rest.length ? rest.flat() : Object.keys(multi ? first[0] : first);
  return valuesBuilder(multi ? first : [first], parameters, types2, columns, options);
}
function select(first, rest, parameters, types2, options) {
  typeof first === "string" && (first = [first].concat(rest));
  if (Array.isArray(first))
    return escapeIdentifiers(first, options);
  let value;
  const columns = rest.length ? rest.flat() : Object.keys(first);
  return columns.map((x) => {
    value = first[x];
    return (value instanceof Query ? fragment(value, parameters, types2, options) : value instanceof Identifier ? value.value : handleValue(value, parameters, types2, options)) + " as " + escapeIdentifier(options.transform.column.to ? options.transform.column.to(x) : x);
  }).join(",");
}
var builders = Object.entries({
  values,
  in: (...xs) => {
    const x = values(...xs);
    return x === "()" ? "(null)" : x;
  },
  select,
  as: select,
  returning: select,
  "\\(": select,
  update(first, rest, parameters, types2, options) {
    return (rest.length ? rest.flat() : Object.keys(first)).map(
      (x) => escapeIdentifier(options.transform.column.to ? options.transform.column.to(x) : x) + "=" + stringifyValue("values", first[x], parameters, types2, options)
    );
  },
  insert(first, rest, parameters, types2, options) {
    const columns = rest.length ? rest.flat() : Object.keys(Array.isArray(first) ? first[0] : first);
    return "(" + escapeIdentifiers(columns, options) + ")values" + valuesBuilder(Array.isArray(first) ? first : [first], parameters, types2, columns, options);
  }
}).map(([x, fn]) => [new RegExp("((?:^|[\\s(])" + x + "(?:$|[\\s(]))(?![\\s\\S]*\\1)", "i"), fn]);
function notTagged() {
  throw Errors.generic("NOT_TAGGED_CALL", "Query not called as a tagged template literal");
}
var serializers = defaultHandlers.serializers;
var parsers = defaultHandlers.parsers;
function firstIsString(x) {
  if (Array.isArray(x))
    return firstIsString(x[0]);
  return typeof x === "string" ? 1009 : 0;
}
var mergeUserTypes = function(types2) {
  const user = typeHandlers(types2 || {});
  return {
    serializers: Object.assign({}, serializers, user.serializers),
    parsers: Object.assign({}, parsers, user.parsers)
  };
};
function typeHandlers(types2) {
  return Object.keys(types2).reduce((acc, k) => {
    types2[k].from && [].concat(types2[k].from).forEach((x) => acc.parsers[x] = types2[k].parse);
    if (types2[k].serialize) {
      acc.serializers[types2[k].to] = types2[k].serialize;
      types2[k].from && [].concat(types2[k].from).forEach((x) => acc.serializers[x] = types2[k].serialize);
    }
    return acc;
  }, { parsers: {}, serializers: {} });
}
function escapeIdentifiers(xs, { transform: { column } }) {
  return xs.map((x) => escapeIdentifier(column.to ? column.to(x) : x)).join(",");
}
var escapeIdentifier = function escape(str) {
  return '"' + str.replace(/"/g, '""').replace(/\./g, '"."') + '"';
};
var inferType = function inferType2(x) {
  return x instanceof Parameter ? x.type : x instanceof Date ? 1184 : x instanceof Uint8Array ? 17 : x === true || x === false ? 16 : typeof x === "bigint" ? 20 : Array.isArray(x) ? inferType2(x[0]) : 0;
};
var escapeBackslash = /\\/g;
var escapeQuote = /"/g;
function arrayEscape(x) {
  return x.replace(escapeBackslash, "\\\\").replace(escapeQuote, '\\"');
}
var arraySerializer = function arraySerializer2(xs, serializer, options, typarray) {
  if (Array.isArray(xs) === false)
    return xs;
  if (!xs.length)
    return "{}";
  const first = xs[0];
  const delimiter = typarray === 1020 ? ";" : ",";
  if (Array.isArray(first) && !first.type)
    return "{" + xs.map((x) => arraySerializer2(x, serializer, options, typarray)).join(delimiter) + "}";
  return "{" + xs.map((x) => {
    if (x === void 0) {
      x = options.transform.undefined;
      if (x === void 0)
        throw Errors.generic("UNDEFINED_VALUE", "Undefined values are not allowed");
    }
    return x === null ? "null" : '"' + arrayEscape(serializer ? serializer(x.type ? x.value : x) : "" + x) + '"';
  }).join(delimiter) + "}";
};
var arrayParserState = {
  i: 0,
  char: null,
  str: "",
  quoted: false,
  last: 0
};
var arrayParser = function arrayParser2(x, parser, typarray) {
  arrayParserState.i = arrayParserState.last = 0;
  return arrayParserLoop(arrayParserState, x, parser, typarray);
};
function arrayParserLoop(s, x, parser, typarray) {
  const xs = [];
  const delimiter = typarray === 1020 ? ";" : ",";
  for (; s.i < x.length; s.i++) {
    s.char = x[s.i];
    if (s.quoted) {
      if (s.char === "\\") {
        s.str += x[++s.i];
      } else if (s.char === '"') {
        xs.push(parser ? parser(s.str) : s.str);
        s.str = "";
        s.quoted = x[s.i + 1] === '"';
        s.last = s.i + 2;
      } else {
        s.str += s.char;
      }
    } else if (s.char === '"') {
      s.quoted = true;
    } else if (s.char === "{") {
      s.last = ++s.i;
      xs.push(arrayParserLoop(s, x, parser, typarray));
    } else if (s.char === "}") {
      s.quoted = false;
      s.last < s.i && xs.push(parser ? parser(x.slice(s.last, s.i)) : x.slice(s.last, s.i));
      s.last = s.i + 1;
      break;
    } else if (s.char === delimiter && s.p !== "}" && s.p !== '"') {
      xs.push(parser ? parser(x.slice(s.last, s.i)) : x.slice(s.last, s.i));
      s.last = s.i + 1;
    }
    s.p = s.char;
  }
  s.last < s.i && xs.push(parser ? parser(x.slice(s.last, s.i + 1)) : x.slice(s.last, s.i + 1));
  return xs;
}
var toCamel = (x) => {
  let str = x[0];
  for (let i = 1; i < x.length; i++)
    str += x[i] === "_" ? x[++i].toUpperCase() : x[i];
  return str;
};
var toPascal = (x) => {
  let str = x[0].toUpperCase();
  for (let i = 1; i < x.length; i++)
    str += x[i] === "_" ? x[++i].toUpperCase() : x[i];
  return str;
};
var toKebab = (x) => x.replace(/_/g, "-");
var fromCamel = (x) => x.replace(/([A-Z])/g, "_$1").toLowerCase();
var fromPascal = (x) => (x.slice(0, 1) + x.slice(1).replace(/([A-Z])/g, "_$1")).toLowerCase();
var fromKebab = (x) => x.replace(/-/g, "_");
function createJsonTransform(fn) {
  return function jsonTransform(x, column) {
    return typeof x === "object" && x !== null && (column.type === 114 || column.type === 3802) ? Array.isArray(x) ? x.map((x2) => jsonTransform(x2, column)) : Object.entries(x).reduce((acc, [k, v]) => Object.assign(acc, { [fn(k)]: jsonTransform(v, column) }), {}) : x;
  };
}
toCamel.column = { from: toCamel };
toCamel.value = { from: createJsonTransform(toCamel) };
fromCamel.column = { to: fromCamel };
var camel = { ...toCamel };
camel.column.to = fromCamel;
toPascal.column = { from: toPascal };
toPascal.value = { from: createJsonTransform(toPascal) };
fromPascal.column = { to: fromPascal };
var pascal = { ...toPascal };
pascal.column.to = fromPascal;
toKebab.column = { from: toKebab };
toKebab.value = { from: createJsonTransform(toKebab) };
fromKebab.column = { to: fromKebab };
var kebab = { ...toKebab };
kebab.column.to = fromKebab;

// node_modules/postgres/src/connection.js
import net from "net";
import tls from "tls";
import crypto from "crypto";
import Stream from "stream";
import { performance } from "perf_hooks";

// node_modules/postgres/src/result.js
var Result = class extends Array {
  constructor() {
    super();
    Object.defineProperties(this, {
      count: { value: null, writable: true },
      state: { value: null, writable: true },
      command: { value: null, writable: true },
      columns: { value: null, writable: true },
      statement: { value: null, writable: true }
    });
  }
  static get [Symbol.species]() {
    return Array;
  }
};

// node_modules/postgres/src/queue.js
var queue_default = Queue;
function Queue(initial = []) {
  let xs = initial.slice();
  let index = 0;
  return {
    get length() {
      return xs.length - index;
    },
    remove: (x) => {
      const index2 = xs.indexOf(x);
      return index2 === -1 ? null : (xs.splice(index2, 1), x);
    },
    push: (x) => (xs.push(x), x),
    shift: () => {
      const out = xs[index++];
      if (index === xs.length) {
        index = 0;
        xs = [];
      } else {
        xs[index - 1] = void 0;
      }
      return out;
    }
  };
}

// node_modules/postgres/src/bytes.js
var size = 256;
var buffer = Buffer.allocUnsafe(size);
var messages = "BCcDdEFfHPpQSX".split("").reduce((acc, x) => {
  const v = x.charCodeAt(0);
  acc[x] = () => {
    buffer[0] = v;
    b.i = 5;
    return b;
  };
  return acc;
}, {});
var b = Object.assign(reset, messages, {
  N: String.fromCharCode(0),
  i: 0,
  inc(x) {
    b.i += x;
    return b;
  },
  str(x) {
    const length = Buffer.byteLength(x);
    fit(length);
    b.i += buffer.write(x, b.i, length, "utf8");
    return b;
  },
  i16(x) {
    fit(2);
    buffer.writeUInt16BE(x, b.i);
    b.i += 2;
    return b;
  },
  i32(x, i) {
    if (i || i === 0) {
      buffer.writeUInt32BE(x, i);
      return b;
    }
    fit(4);
    buffer.writeUInt32BE(x, b.i);
    b.i += 4;
    return b;
  },
  z(x) {
    fit(x);
    buffer.fill(0, b.i, b.i + x);
    b.i += x;
    return b;
  },
  raw(x) {
    buffer = Buffer.concat([buffer.subarray(0, b.i), x]);
    b.i = buffer.length;
    return b;
  },
  end(at = 1) {
    buffer.writeUInt32BE(b.i - at, at);
    const out = buffer.subarray(0, b.i);
    b.i = 0;
    buffer = Buffer.allocUnsafe(size);
    return out;
  }
});
var bytes_default = b;
function fit(x) {
  if (buffer.length - b.i < x) {
    const prev = buffer, length = prev.length;
    buffer = Buffer.allocUnsafe(length + (length >> 1) + x);
    prev.copy(buffer);
  }
}
function reset() {
  b.i = 0;
  return b;
}

// node_modules/postgres/src/connection.js
var connection_default = Connection;
var uid = 1;
var Sync = bytes_default().S().end();
var Flush = bytes_default().H().end();
var SSLRequest = bytes_default().i32(8).i32(80877103).end(8);
var ExecuteUnnamed = Buffer.concat([bytes_default().E().str(bytes_default.N).i32(0).end(), Sync]);
var DescribeUnnamed = bytes_default().D().str("S").str(bytes_default.N).end();
var noop = () => {
};
var retryRoutines = /* @__PURE__ */ new Set([
  "FetchPreparedStatement",
  "RevalidateCachedQuery",
  "transformAssignedExpr"
]);
var errorFields = {
  83: "severity_local",
  // S
  86: "severity",
  // V
  67: "code",
  // C
  77: "message",
  // M
  68: "detail",
  // D
  72: "hint",
  // H
  80: "position",
  // P
  112: "internal_position",
  // p
  113: "internal_query",
  // q
  87: "where",
  // W
  115: "schema_name",
  // s
  116: "table_name",
  // t
  99: "column_name",
  // c
  100: "data type_name",
  // d
  110: "constraint_name",
  // n
  70: "file",
  // F
  76: "line",
  // L
  82: "routine"
  // R
};
function Connection(options, queues = {}, { onopen = noop, onend = noop, onclose = noop } = {}) {
  const {
    sslnegotiation,
    ssl,
    max,
    user,
    host,
    port,
    database,
    parsers: parsers2,
    transform: transform2,
    onnotice,
    onnotify,
    onparameter,
    max_pipeline,
    keep_alive,
    backoff: backoff2,
    target_session_attrs
  } = options;
  const sent = queue_default(), id = uid++, backend = { pid: null, secret: null }, idleTimer = timer(end, options.idle_timeout), lifeTimer = timer(end, options.max_lifetime), connectTimer = timer(connectTimedOut, options.connect_timeout);
  let socket = null, cancelMessage, errorResponse = null, result = new Result(), incoming = Buffer.alloc(0), needsTypes = options.fetch_types, backendParameters = {}, statements = {}, statementId = Math.random().toString(36).slice(2), statementCount = 1, closedTime = 0, remaining = 0, hostIndex = 0, retries = 0, length = 0, delay = 0, rows = 0, serverSignature = null, nextWriteTimer = null, terminated = false, incomings = null, results = null, initial = null, ending = null, stream = null, chunk = null, ended = null, nonce = null, query = null, final = null;
  const connection2 = {
    queue: queues.closed,
    idleTimer,
    connect(query2) {
      initial = query2;
      reconnect();
    },
    terminate,
    execute,
    cancel,
    end,
    count: 0,
    id
  };
  queues.closed && queues.closed.push(connection2);
  return connection2;
  async function createSocket() {
    let x;
    try {
      x = options.socket ? await Promise.resolve(options.socket(options)) : new net.Socket();
    } catch (e) {
      error51(e);
      return;
    }
    x.on("error", error51);
    x.on("close", closed);
    x.on("drain", drain);
    return x;
  }
  async function cancel({ pid, secret }, resolve, reject) {
    try {
      cancelMessage = bytes_default().i32(16).i32(80877102).i32(pid).i32(secret).end(16);
      await connect();
      socket.once("error", reject);
      socket.once("close", resolve);
    } catch (error52) {
      reject(error52);
    }
  }
  function execute(q) {
    if (terminated)
      return queryError(q, Errors.connection("CONNECTION_DESTROYED", options));
    if (stream)
      return queryError(q, Errors.generic("COPY_IN_PROGRESS", "You cannot execute queries during copy"));
    if (q.cancelled)
      return;
    try {
      q.state = backend;
      query ? sent.push(q) : (query = q, query.active = true);
      build(q);
      return write(toBuffer(q)) && !q.describeFirst && !q.cursorFn && sent.length < max_pipeline && (!q.options.onexecute || q.options.onexecute(connection2));
    } catch (error52) {
      sent.length === 0 && write(Sync);
      errored(error52);
      return true;
    }
  }
  function toBuffer(q) {
    if (q.parameters.length >= 65534)
      throw Errors.generic("MAX_PARAMETERS_EXCEEDED", "Max number of parameters (65534) exceeded");
    return q.options.simple ? bytes_default().Q().str(q.statement.string + bytes_default.N).end() : q.describeFirst ? Buffer.concat([describe3(q), Flush]) : q.prepare ? q.prepared ? prepared(q) : Buffer.concat([describe3(q), prepared(q)]) : unnamed(q);
  }
  function describe3(q) {
    return Buffer.concat([
      Parse(q.statement.string, q.parameters, q.statement.types, q.statement.name),
      Describe("S", q.statement.name)
    ]);
  }
  function prepared(q) {
    return Buffer.concat([
      Bind(q.parameters, q.statement.types, q.statement.name, q.cursorName),
      q.cursorFn ? Execute("", q.cursorRows) : ExecuteUnnamed
    ]);
  }
  function unnamed(q) {
    return Buffer.concat([
      Parse(q.statement.string, q.parameters, q.statement.types),
      DescribeUnnamed,
      prepared(q)
    ]);
  }
  function build(q) {
    const parameters = [], types2 = [];
    const string4 = stringify(q, q.strings[0], q.args[0], parameters, types2, options);
    !q.tagged && q.args.forEach((x) => handleValue(x, parameters, types2, options));
    q.prepare = options.prepare && ("prepare" in q.options ? q.options.prepare : true);
    q.string = string4;
    q.signature = q.prepare && types2 + string4;
    q.onlyDescribe && delete statements[q.signature];
    q.parameters = q.parameters || parameters;
    q.prepared = q.prepare && q.signature in statements;
    q.describeFirst = q.onlyDescribe || parameters.length && !q.prepared;
    q.statement = q.prepared ? statements[q.signature] : { string: string4, types: types2, name: q.prepare ? statementId + statementCount++ : "" };
    typeof options.debug === "function" && options.debug(id, string4, parameters, types2);
  }
  function write(x, fn) {
    chunk = chunk ? Buffer.concat([chunk, x]) : Buffer.from(x);
    if (fn || chunk.length >= 1024)
      return nextWrite(fn);
    nextWriteTimer === null && (nextWriteTimer = setImmediate(nextWrite));
    return true;
  }
  function nextWrite(fn) {
    const x = socket.write(chunk, fn);
    nextWriteTimer !== null && clearImmediate(nextWriteTimer);
    chunk = nextWriteTimer = null;
    return x;
  }
  function connectTimedOut() {
    errored(Errors.connection("CONNECT_TIMEOUT", options, socket));
    socket.destroy();
  }
  async function secure() {
    if (sslnegotiation !== "direct") {
      write(SSLRequest);
      const canSSL = await new Promise((r) => socket.once("data", (x) => r(x[0] === 83)));
      if (!canSSL && ssl === "prefer")
        return connected();
    }
    const options2 = {
      socket,
      servername: net.isIP(socket.host) ? void 0 : socket.host
    };
    if (sslnegotiation === "direct")
      options2.ALPNProtocols = ["postgresql"];
    if (ssl === "require" || ssl === "allow" || ssl === "prefer")
      options2.rejectUnauthorized = false;
    else if (typeof ssl === "object")
      Object.assign(options2, ssl);
    socket.removeAllListeners();
    socket = tls.connect(options2);
    socket.on("secureConnect", connected);
    socket.on("error", error51);
    socket.on("close", closed);
    socket.on("drain", drain);
  }
  function drain() {
    !query && onopen(connection2);
  }
  function data(x) {
    if (incomings) {
      incomings.push(x);
      remaining -= x.length;
      if (remaining > 0)
        return;
    }
    incoming = incomings ? Buffer.concat(incomings, length - remaining) : incoming.length === 0 ? x : Buffer.concat([incoming, x], incoming.length + x.length);
    while (incoming.length > 4) {
      length = incoming.readUInt32BE(1);
      if (length >= incoming.length) {
        remaining = length - incoming.length;
        incomings = [incoming];
        break;
      }
      try {
        handle(incoming.subarray(0, length + 1));
      } catch (e) {
        query && (query.cursorFn || query.describeFirst) && write(Sync);
        errored(e);
      }
      incoming = incoming.subarray(length + 1);
      remaining = 0;
      incomings = null;
    }
  }
  async function connect() {
    terminated = false;
    backendParameters = {};
    socket || (socket = await createSocket());
    if (!socket)
      return;
    connectTimer.start();
    if (options.socket)
      return ssl ? secure() : connected();
    socket.on("connect", ssl ? secure : connected);
    if (options.path)
      return socket.connect(options.path);
    socket.ssl = ssl;
    socket.connect(port[hostIndex], host[hostIndex]);
    socket.host = host[hostIndex];
    socket.port = port[hostIndex];
    hostIndex = (hostIndex + 1) % port.length;
  }
  function reconnect() {
    setTimeout(connect, closedTime ? Math.max(0, closedTime + delay - performance.now()) : 0);
  }
  function connected() {
    try {
      statements = {};
      needsTypes = options.fetch_types;
      statementId = Math.random().toString(36).slice(2);
      statementCount = 1;
      lifeTimer.start();
      socket.on("data", data);
      keep_alive && socket.setKeepAlive && socket.setKeepAlive(true, 1e3 * keep_alive);
      const s = StartupMessage();
      write(s);
    } catch (err) {
      error51(err);
    }
  }
  function error51(err) {
    if (connection2.queue === queues.connecting && options.host[retries + 1])
      return;
    errored(err);
    while (sent.length)
      queryError(sent.shift(), err);
  }
  function errored(err) {
    stream && (stream.destroy(err), stream = null);
    query && queryError(query, err);
    initial && (queryError(initial, err), initial = null);
  }
  function queryError(query2, err) {
    if (query2.reserve)
      return query2.reject(err);
    if (!err || typeof err !== "object")
      err = new Error(err);
    "query" in err || "parameters" in err || Object.defineProperties(err, {
      stack: { value: err.stack + query2.origin.replace(/.*\n/, "\n"), enumerable: options.debug },
      query: { value: query2.string, enumerable: options.debug },
      parameters: { value: query2.parameters, enumerable: options.debug },
      args: { value: query2.args, enumerable: options.debug },
      types: { value: query2.statement && query2.statement.types, enumerable: options.debug }
    });
    query2.reject(err);
  }
  function end() {
    return ending || (!connection2.reserved && onend(connection2), !connection2.reserved && !initial && !query && sent.length === 0 ? (terminate(), new Promise((r) => socket && socket.readyState !== "closed" ? socket.once("close", r) : r())) : ending = new Promise((r) => ended = r));
  }
  function terminate() {
    terminated = true;
    if (stream || query || initial || sent.length)
      error51(Errors.connection("CONNECTION_DESTROYED", options));
    clearImmediate(nextWriteTimer);
    if (socket) {
      socket.removeListener("data", data);
      socket.removeListener("connect", connected);
      socket.readyState === "open" && socket.end(bytes_default().X().end());
    }
    ended && (ended(), ending = ended = null);
  }
  async function closed(hadError) {
    incoming = Buffer.alloc(0);
    remaining = 0;
    incomings = null;
    clearImmediate(nextWriteTimer);
    socket.removeListener("data", data);
    socket.removeListener("connect", connected);
    idleTimer.cancel();
    lifeTimer.cancel();
    connectTimer.cancel();
    socket.removeAllListeners();
    socket = null;
    if (initial)
      return reconnect();
    !hadError && (query || sent.length) && error51(Errors.connection("CONNECTION_CLOSED", options, socket));
    closedTime = performance.now();
    hadError && options.shared.retries++;
    delay = (typeof backoff2 === "function" ? backoff2(options.shared.retries) : backoff2) * 1e3;
    onclose(connection2, Errors.connection("CONNECTION_CLOSED", options, socket));
  }
  function handle(xs, x = xs[0]) {
    (x === 68 ? DataRow : (
      // D
      x === 100 ? CopyData : (
        // d
        x === 65 ? NotificationResponse : (
          // A
          x === 83 ? ParameterStatus : (
            // S
            x === 90 ? ReadyForQuery : (
              // Z
              x === 67 ? CommandComplete : (
                // C
                x === 50 ? BindComplete : (
                  // 2
                  x === 49 ? ParseComplete : (
                    // 1
                    x === 116 ? ParameterDescription : (
                      // t
                      x === 84 ? RowDescription : (
                        // T
                        x === 82 ? Authentication : (
                          // R
                          x === 110 ? NoData : (
                            // n
                            x === 75 ? BackendKeyData : (
                              // K
                              x === 69 ? ErrorResponse : (
                                // E
                                x === 115 ? PortalSuspended : (
                                  // s
                                  x === 51 ? CloseComplete : (
                                    // 3
                                    x === 71 ? CopyInResponse : (
                                      // G
                                      x === 78 ? NoticeResponse : (
                                        // N
                                        x === 72 ? CopyOutResponse : (
                                          // H
                                          x === 99 ? CopyDone : (
                                            // c
                                            x === 73 ? EmptyQueryResponse : (
                                              // I
                                              x === 86 ? FunctionCallResponse : (
                                                // V
                                                x === 118 ? NegotiateProtocolVersion : (
                                                  // v
                                                  x === 87 ? CopyBothResponse : (
                                                    // W
                                                    /* c8 ignore next */
                                                    UnknownMessage
                                                  )
                                                )
                                              )
                                            )
                                          )
                                        )
                                      )
                                    )
                                  )
                                )
                              )
                            )
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    ))(xs);
  }
  function DataRow(x) {
    let index = 7;
    let length2;
    let column;
    let value;
    const row = query.isRaw ? new Array(query.statement.columns.length) : {};
    for (let i = 0; i < query.statement.columns.length; i++) {
      column = query.statement.columns[i];
      length2 = x.readInt32BE(index);
      index += 4;
      value = length2 === -1 ? null : query.isRaw === true ? x.subarray(index, index += length2) : column.parser === void 0 ? x.toString("utf8", index, index += length2) : column.parser.array === true ? column.parser(x.toString("utf8", index + 1, index += length2)) : column.parser(x.toString("utf8", index, index += length2));
      query.isRaw ? row[i] = query.isRaw === true ? value : transform2.value.from ? transform2.value.from(value, column) : value : row[column.name] = transform2.value.from ? transform2.value.from(value, column) : value;
    }
    query.forEachFn ? query.forEachFn(transform2.row.from ? transform2.row.from(row) : row, result) : result[rows++] = transform2.row.from ? transform2.row.from(row) : row;
  }
  function ParameterStatus(x) {
    const [k, v] = x.toString("utf8", 5, x.length - 1).split(bytes_default.N);
    backendParameters[k] = v;
    if (options.parameters[k] !== v) {
      options.parameters[k] = v;
      onparameter && onparameter(k, v);
    }
  }
  function ReadyForQuery(x) {
    if (query) {
      if (errorResponse) {
        query.retried ? errored(query.retried) : query.prepared && retryRoutines.has(errorResponse.routine) ? retry(query, errorResponse) : errored(errorResponse);
      } else {
        query.resolve(results || result);
      }
    } else if (errorResponse) {
      errored(errorResponse);
    }
    query = results = errorResponse = null;
    result = new Result();
    connectTimer.cancel();
    if (initial) {
      if (target_session_attrs) {
        if (!backendParameters.in_hot_standby || !backendParameters.default_transaction_read_only)
          return fetchState();
        else if (tryNext(target_session_attrs, backendParameters))
          return terminate();
      }
      if (needsTypes) {
        initial.reserve && (initial = null);
        return fetchArrayTypes();
      }
      initial && !initial.reserve && execute(initial);
      options.shared.retries = retries = 0;
      initial = null;
      return;
    }
    while (sent.length && (query = sent.shift()) && (query.active = true, query.cancelled))
      Connection(options).cancel(query.state, query.cancelled.resolve, query.cancelled.reject);
    if (query)
      return;
    connection2.reserved ? !connection2.reserved.release && x[5] === 73 ? ending ? terminate() : (connection2.reserved = null, onopen(connection2)) : connection2.reserved() : ending ? terminate() : onopen(connection2);
  }
  function CommandComplete(x) {
    rows = 0;
    for (let i = x.length - 1; i > 0; i--) {
      if (x[i] === 32 && x[i + 1] < 58 && result.count === null)
        result.count = +x.toString("utf8", i + 1, x.length - 1);
      if (x[i - 1] >= 65) {
        result.command = x.toString("utf8", 5, i);
        result.state = backend;
        break;
      }
    }
    final && (final(), final = null);
    if (result.command === "BEGIN" && max !== 1 && !connection2.reserved)
      return errored(Errors.generic("UNSAFE_TRANSACTION", "Only use sql.begin, sql.reserved or max: 1"));
    if (query.options.simple)
      return BindComplete();
    if (query.cursorFn) {
      result.count && query.cursorFn(result);
      write(Sync);
    }
  }
  function ParseComplete() {
    query.parsing = false;
  }
  function BindComplete() {
    !result.statement && (result.statement = query.statement);
    result.columns = query.statement.columns;
  }
  function ParameterDescription(x) {
    const length2 = x.readUInt16BE(5);
    for (let i = 0; i < length2; ++i)
      !query.statement.types[i] && (query.statement.types[i] = x.readUInt32BE(7 + i * 4));
    query.prepare && (statements[query.signature] = query.statement);
    query.describeFirst && !query.onlyDescribe && (write(prepared(query)), query.describeFirst = false);
  }
  function RowDescription(x) {
    if (result.command) {
      results = results || [result];
      results.push(result = new Result());
      result.count = null;
      query.statement.columns = null;
    }
    const length2 = x.readUInt16BE(5);
    let index = 7;
    let start;
    query.statement.columns = Array(length2);
    for (let i = 0; i < length2; ++i) {
      start = index;
      while (x[index++] !== 0) ;
      const table = x.readUInt32BE(index);
      const number4 = x.readUInt16BE(index + 4);
      const type = x.readUInt32BE(index + 6);
      query.statement.columns[i] = {
        name: transform2.column.from ? transform2.column.from(x.toString("utf8", start, index - 1)) : x.toString("utf8", start, index - 1),
        parser: parsers2[type],
        table,
        number: number4,
        type
      };
      index += 18;
    }
    result.statement = query.statement;
    if (query.onlyDescribe)
      return query.resolve(query.statement), write(Sync);
  }
  async function Authentication(x, type = x.readUInt32BE(5)) {
    (type === 3 ? AuthenticationCleartextPassword : type === 5 ? AuthenticationMD5Password : type === 10 ? SASL : type === 11 ? SASLContinue : type === 12 ? SASLFinal : type !== 0 ? UnknownAuth : noop)(x, type);
  }
  async function AuthenticationCleartextPassword() {
    const payload = await Pass();
    write(
      bytes_default().p().str(payload).z(1).end()
    );
  }
  async function AuthenticationMD5Password(x) {
    const payload = "md5" + await md5(
      Buffer.concat([
        Buffer.from(await md5(await Pass() + user)),
        x.subarray(9)
      ])
    );
    write(
      bytes_default().p().str(payload).z(1).end()
    );
  }
  async function SASL() {
    nonce = (await crypto.randomBytes(18)).toString("base64");
    bytes_default().p().str("SCRAM-SHA-256" + bytes_default.N);
    const i = bytes_default.i;
    write(bytes_default.inc(4).str("n,,n=*,r=" + nonce).i32(bytes_default.i - i - 4, i).end());
  }
  async function SASLContinue(x) {
    const res = x.toString("utf8", 9).split(",").reduce((acc, x2) => (acc[x2[0]] = x2.slice(2), acc), {});
    const saltedPassword = await crypto.pbkdf2Sync(
      await Pass(),
      Buffer.from(res.s, "base64"),
      parseInt(res.i),
      32,
      "sha256"
    );
    const clientKey = await hmac(saltedPassword, "Client Key");
    const auth = "n=*,r=" + nonce + ",r=" + res.r + ",s=" + res.s + ",i=" + res.i + ",c=biws,r=" + res.r;
    serverSignature = (await hmac(await hmac(saltedPassword, "Server Key"), auth)).toString("base64");
    const payload = "c=biws,r=" + res.r + ",p=" + xor2(
      clientKey,
      Buffer.from(await hmac(await sha256(clientKey), auth))
    ).toString("base64");
    write(
      bytes_default().p().str(payload).end()
    );
  }
  function SASLFinal(x) {
    if (x.toString("utf8", 9).split(bytes_default.N, 1)[0].slice(2) === serverSignature)
      return;
    errored(Errors.generic("SASL_SIGNATURE_MISMATCH", "The server did not return the correct signature"));
    socket.destroy();
  }
  function Pass() {
    return Promise.resolve(
      typeof options.pass === "function" ? options.pass() : options.pass
    );
  }
  function NoData() {
    result.statement = query.statement;
    result.statement.columns = [];
    if (query.onlyDescribe)
      return query.resolve(query.statement), write(Sync);
  }
  function BackendKeyData(x) {
    backend.pid = x.readUInt32BE(5);
    backend.secret = x.readUInt32BE(9);
  }
  async function fetchArrayTypes() {
    needsTypes = false;
    const types2 = await new Query([`
      select b.oid, b.typarray
      from pg_catalog.pg_type a
      left join pg_catalog.pg_type b on b.oid = a.typelem
      where a.typcategory = 'A'
      group by b.oid, b.typarray
      order by b.oid
    `], [], execute);
    types2.forEach(({ oid, typarray }) => addArrayType(oid, typarray));
  }
  function addArrayType(oid, typarray) {
    if (!!options.parsers[typarray] && !!options.serializers[typarray]) return;
    const parser = options.parsers[oid];
    options.shared.typeArrayMap[oid] = typarray;
    options.parsers[typarray] = (xs) => arrayParser(xs, parser, typarray);
    options.parsers[typarray].array = true;
    options.serializers[typarray] = (xs) => arraySerializer(xs, options.serializers[oid], options, typarray);
  }
  function tryNext(x, xs) {
    return x === "read-write" && xs.default_transaction_read_only === "on" || x === "read-only" && xs.default_transaction_read_only === "off" || x === "primary" && xs.in_hot_standby === "on" || x === "standby" && xs.in_hot_standby === "off" || x === "prefer-standby" && xs.in_hot_standby === "off" && options.host[retries];
  }
  function fetchState() {
    const query2 = new Query([`
      show transaction_read_only;
      select pg_catalog.pg_is_in_recovery()
    `], [], execute, null, { simple: true });
    query2.resolve = ([[a], [b2]]) => {
      backendParameters.default_transaction_read_only = a.transaction_read_only;
      backendParameters.in_hot_standby = b2.pg_is_in_recovery ? "on" : "off";
    };
    query2.execute();
  }
  function ErrorResponse(x) {
    if (query) {
      (query.cursorFn || query.describeFirst) && write(Sync);
      errorResponse = Errors.postgres(parseError(x));
    } else {
      errored(Errors.postgres(parseError(x)));
    }
  }
  function retry(q, error52) {
    delete statements[q.signature];
    q.retried = error52;
    execute(q);
  }
  function NotificationResponse(x) {
    if (!onnotify)
      return;
    let index = 9;
    while (x[index++] !== 0) ;
    onnotify(
      x.toString("utf8", 9, index - 1),
      x.toString("utf8", index, x.length - 1)
    );
  }
  async function PortalSuspended() {
    try {
      const x = await Promise.resolve(query.cursorFn(result));
      rows = 0;
      x === CLOSE ? write(Close(query.portal)) : (result = new Result(), write(Execute("", query.cursorRows)));
    } catch (err) {
      write(Sync);
      query.reject(err);
    }
  }
  function CloseComplete() {
    result.count && query.cursorFn(result);
    query.resolve(result);
  }
  function CopyInResponse() {
    stream = new Stream.Writable({
      autoDestroy: true,
      write(chunk2, encoding, callback) {
        socket.write(bytes_default().d().raw(chunk2).end(), callback);
      },
      destroy(error52, callback) {
        callback(error52);
        socket.write(bytes_default().f().str(error52 + bytes_default.N).end());
        stream = null;
      },
      final(callback) {
        socket.write(bytes_default().c().end());
        final = callback;
        stream = null;
      }
    });
    query.resolve(stream);
  }
  function CopyOutResponse() {
    stream = new Stream.Readable({
      read() {
        socket.resume();
      }
    });
    query.resolve(stream);
  }
  function CopyBothResponse() {
    stream = new Stream.Duplex({
      autoDestroy: true,
      read() {
        socket.resume();
      },
      /* c8 ignore next 11 */
      write(chunk2, encoding, callback) {
        socket.write(bytes_default().d().raw(chunk2).end(), callback);
      },
      destroy(error52, callback) {
        callback(error52);
        socket.write(bytes_default().f().str(error52 + bytes_default.N).end());
        stream = null;
      },
      final(callback) {
        socket.write(bytes_default().c().end());
        final = callback;
      }
    });
    query.resolve(stream);
  }
  function CopyData(x) {
    stream && (stream.push(x.subarray(5)) || socket.pause());
  }
  function CopyDone() {
    stream && stream.push(null);
    stream = null;
  }
  function NoticeResponse(x) {
    onnotice ? onnotice(parseError(x)) : console.log(parseError(x));
  }
  function EmptyQueryResponse() {
  }
  function FunctionCallResponse() {
    errored(Errors.notSupported("FunctionCallResponse"));
  }
  function NegotiateProtocolVersion() {
    errored(Errors.notSupported("NegotiateProtocolVersion"));
  }
  function UnknownMessage(x) {
    console.error("Postgres.js : Unknown Message:", x[0]);
  }
  function UnknownAuth(x, type) {
    console.error("Postgres.js : Unknown Auth:", type);
  }
  function Bind(parameters, types2, statement = "", portal = "") {
    let prev, type;
    bytes_default().B().str(portal + bytes_default.N).str(statement + bytes_default.N).i16(0).i16(parameters.length);
    parameters.forEach((x, i) => {
      if (x === null)
        return bytes_default.i32(4294967295);
      type = types2[i];
      parameters[i] = x = type in options.serializers ? options.serializers[type](x) : "" + x;
      prev = bytes_default.i;
      bytes_default.inc(4).str(x).i32(bytes_default.i - prev - 4, prev);
    });
    bytes_default.i16(0);
    return bytes_default.end();
  }
  function Parse(str, parameters, types2, name = "") {
    bytes_default().P().str(name + bytes_default.N).str(str + bytes_default.N).i16(parameters.length);
    parameters.forEach((x, i) => bytes_default.i32(types2[i] || 0));
    return bytes_default.end();
  }
  function Describe(x, name = "") {
    return bytes_default().D().str(x).str(name + bytes_default.N).end();
  }
  function Execute(portal = "", rows2 = 0) {
    return Buffer.concat([
      bytes_default().E().str(portal + bytes_default.N).i32(rows2).end(),
      Flush
    ]);
  }
  function Close(portal = "") {
    return Buffer.concat([
      bytes_default().C().str("P").str(portal + bytes_default.N).end(),
      bytes_default().S().end()
    ]);
  }
  function StartupMessage() {
    return cancelMessage || bytes_default().inc(4).i16(3).z(2).str(
      Object.entries(Object.assign(
        {
          user,
          database,
          client_encoding: "UTF8"
        },
        options.connection
      )).filter(([, v]) => v).map(([k, v]) => k + bytes_default.N + v).join(bytes_default.N)
    ).z(2).end(0);
  }
}
function parseError(x) {
  const error51 = {};
  let start = 5;
  for (let i = 5; i < x.length - 1; i++) {
    if (x[i] === 0) {
      error51[errorFields[x[start]]] = x.toString("utf8", start + 1, i);
      start = i + 1;
    }
  }
  return error51;
}
function md5(x) {
  return crypto.createHash("md5").update(x).digest("hex");
}
function hmac(key, x) {
  return crypto.createHmac("sha256", key).update(x).digest();
}
function sha256(x) {
  return crypto.createHash("sha256").update(x).digest();
}
function xor2(a, b2) {
  const length = Math.max(a.length, b2.length);
  const buffer2 = Buffer.allocUnsafe(length);
  for (let i = 0; i < length; i++)
    buffer2[i] = a[i] ^ b2[i];
  return buffer2;
}
function timer(fn, seconds) {
  seconds = typeof seconds === "function" ? seconds() : seconds;
  if (!seconds)
    return { cancel: noop, start: noop };
  let timer2;
  return {
    cancel() {
      timer2 && (clearTimeout(timer2), timer2 = null);
    },
    start() {
      timer2 && clearTimeout(timer2);
      timer2 = setTimeout(done, seconds * 1e3, arguments);
    }
  };
  function done(args) {
    fn.apply(null, args);
    timer2 = null;
  }
}

// node_modules/postgres/src/subscribe.js
var noop2 = () => {
};
function Subscribe(postgres2, options) {
  const subscribers = /* @__PURE__ */ new Map(), slot = "postgresjs_" + Math.random().toString(36).slice(2), state = {};
  let connection2, stream, ended = false;
  const sql = subscribe.sql = postgres2({
    ...options,
    transform: { column: {}, value: {}, row: {} },
    max: 1,
    fetch_types: false,
    idle_timeout: null,
    max_lifetime: null,
    connection: {
      ...options.connection,
      replication: "database"
    },
    onclose: async function() {
      if (ended)
        return;
      stream = null;
      state.pid = state.secret = void 0;
      connected(await init(sql, slot, options.publications));
      subscribers.forEach((event) => event.forEach(({ onsubscribe }) => onsubscribe()));
    },
    no_subscribe: true
  });
  const end = sql.end, close = sql.close;
  sql.end = async () => {
    ended = true;
    stream && await new Promise((r) => (stream.once("close", r), stream.end()));
    return end();
  };
  sql.close = async () => {
    stream && await new Promise((r) => (stream.once("close", r), stream.end()));
    return close();
  };
  return subscribe;
  async function subscribe(event, fn, onsubscribe = noop2, onerror = noop2) {
    event = parseEvent(event);
    if (!connection2)
      connection2 = init(sql, slot, options.publications);
    const subscriber = { fn, onsubscribe };
    const fns = subscribers.has(event) ? subscribers.get(event).add(subscriber) : subscribers.set(event, /* @__PURE__ */ new Set([subscriber])).get(event);
    const unsubscribe = () => {
      fns.delete(subscriber);
      fns.size === 0 && subscribers.delete(event);
    };
    return connection2.then((x) => {
      connected(x);
      onsubscribe();
      stream && stream.on("error", onerror);
      return { unsubscribe, state, sql };
    });
  }
  function connected(x) {
    stream = x.stream;
    state.pid = x.state.pid;
    state.secret = x.state.secret;
  }
  async function init(sql2, slot2, publications) {
    if (!publications)
      throw new Error("Missing publication names");
    const xs = await sql2.unsafe(
      `CREATE_REPLICATION_SLOT ${slot2} TEMPORARY LOGICAL pgoutput NOEXPORT_SNAPSHOT`
    );
    const [x] = xs;
    const stream2 = await sql2.unsafe(
      `START_REPLICATION SLOT ${slot2} LOGICAL ${x.consistent_point} (proto_version '1', publication_names '${publications}')`
    ).writable();
    const state2 = {
      lsn: Buffer.concat(x.consistent_point.split("/").map((x2) => Buffer.from(("00000000" + x2).slice(-8), "hex")))
    };
    stream2.on("data", data);
    stream2.on("error", error51);
    stream2.on("close", sql2.close);
    return { stream: stream2, state: xs.state };
    function error51(e) {
      console.error("Unexpected error during logical streaming - reconnecting", e);
    }
    function data(x2) {
      if (x2[0] === 119) {
        parse3(x2.subarray(25), state2, sql2.options.parsers, handle, options.transform);
      } else if (x2[0] === 107 && x2[17]) {
        state2.lsn = x2.subarray(1, 9);
        pong();
      }
    }
    function handle(a, b2) {
      const path = b2.relation.schema + "." + b2.relation.table;
      call("*", a, b2);
      call("*:" + path, a, b2);
      b2.relation.keys.length && call("*:" + path + "=" + b2.relation.keys.map((x2) => a[x2.name]), a, b2);
      call(b2.command, a, b2);
      call(b2.command + ":" + path, a, b2);
      b2.relation.keys.length && call(b2.command + ":" + path + "=" + b2.relation.keys.map((x2) => a[x2.name]), a, b2);
    }
    function pong() {
      const x2 = Buffer.alloc(34);
      x2[0] = "r".charCodeAt(0);
      x2.fill(state2.lsn, 1);
      x2.writeBigInt64BE(BigInt(Date.now() - Date.UTC(2e3, 0, 1)) * BigInt(1e3), 25);
      stream2.write(x2);
    }
  }
  function call(x, a, b2) {
    subscribers.has(x) && subscribers.get(x).forEach(({ fn }) => fn(a, b2, x));
  }
}
function Time(x) {
  return new Date(Date.UTC(2e3, 0, 1) + Number(x / BigInt(1e3)));
}
function parse3(x, state, parsers2, handle, transform2) {
  const char = (acc, [k, v]) => (acc[k.charCodeAt(0)] = v, acc);
  Object.entries({
    R: (x2) => {
      let i = 1;
      const r = state[x2.readUInt32BE(i)] = {
        schema: x2.toString("utf8", i += 4, i = x2.indexOf(0, i)) || "pg_catalog",
        table: x2.toString("utf8", i + 1, i = x2.indexOf(0, i + 1)),
        columns: Array(x2.readUInt16BE(i += 2)),
        keys: []
      };
      i += 2;
      let columnIndex = 0, column;
      while (i < x2.length) {
        column = r.columns[columnIndex++] = {
          key: x2[i++],
          name: transform2.column.from ? transform2.column.from(x2.toString("utf8", i, i = x2.indexOf(0, i))) : x2.toString("utf8", i, i = x2.indexOf(0, i)),
          type: x2.readUInt32BE(i += 1),
          parser: parsers2[x2.readUInt32BE(i)],
          atttypmod: x2.readUInt32BE(i += 4)
        };
        column.key && r.keys.push(column);
        i += 4;
      }
    },
    Y: () => {
    },
    // Type
    O: () => {
    },
    // Origin
    B: (x2) => {
      state.date = Time(x2.readBigInt64BE(9));
      state.lsn = x2.subarray(1, 9);
    },
    I: (x2) => {
      let i = 1;
      const relation = state[x2.readUInt32BE(i)];
      const { row } = tuples(x2, relation.columns, i += 7, transform2);
      handle(row, {
        command: "insert",
        relation
      });
    },
    D: (x2) => {
      let i = 1;
      const relation = state[x2.readUInt32BE(i)];
      i += 4;
      const key = x2[i] === 75;
      handle(
        key || x2[i] === 79 ? tuples(x2, relation.columns, i += 3, transform2).row : null,
        {
          command: "delete",
          relation,
          key
        }
      );
    },
    U: (x2) => {
      let i = 1;
      const relation = state[x2.readUInt32BE(i)];
      i += 4;
      const key = x2[i] === 75;
      const xs = key || x2[i] === 79 ? tuples(x2, relation.columns, i += 3, transform2) : null;
      xs && (i = xs.i);
      const { row } = tuples(x2, relation.columns, i + 3, transform2);
      handle(row, {
        command: "update",
        relation,
        key,
        old: xs && xs.row
      });
    },
    T: () => {
    },
    // Truncate,
    C: () => {
    }
    // Commit
  }).reduce(char, {})[x[0]](x);
}
function tuples(x, columns, xi, transform2) {
  let type, column, value;
  const row = transform2.raw ? new Array(columns.length) : {};
  for (let i = 0; i < columns.length; i++) {
    type = x[xi++];
    column = columns[i];
    value = type === 110 ? null : type === 117 ? void 0 : column.parser === void 0 ? x.toString("utf8", xi + 4, xi += 4 + x.readUInt32BE(xi)) : column.parser.array === true ? column.parser(x.toString("utf8", xi + 5, xi += 4 + x.readUInt32BE(xi))) : column.parser(x.toString("utf8", xi + 4, xi += 4 + x.readUInt32BE(xi)));
    transform2.raw ? row[i] = transform2.raw === true ? value : transform2.value.from ? transform2.value.from(value, column) : value : row[column.name] = transform2.value.from ? transform2.value.from(value, column) : value;
  }
  return { i: xi, row: transform2.row.from ? transform2.row.from(row) : row };
}
function parseEvent(x) {
  const xs = x.match(/^(\*|insert|update|delete)?:?([^.]+?\.?[^=]+)?=?(.+)?/i) || [];
  if (!xs)
    throw new Error("Malformed subscribe pattern: " + x);
  const [, command, path, key] = xs;
  return (command || "*") + (path ? ":" + (path.indexOf(".") === -1 ? "public." + path : path) : "") + (key ? "=" + key : "");
}

// node_modules/postgres/src/large.js
import Stream2 from "stream";
function largeObject(sql, oid, mode = 131072 | 262144) {
  return new Promise(async (resolve, reject) => {
    await sql.begin(async (sql2) => {
      let finish;
      !oid && ([{ oid }] = await sql2`select lo_creat(-1) as oid`);
      const [{ fd }] = await sql2`select lo_open(${oid}, ${mode}) as fd`;
      const lo = {
        writable,
        readable,
        close: () => sql2`select lo_close(${fd})`.then(finish),
        tell: () => sql2`select lo_tell64(${fd})`,
        read: (x) => sql2`select loread(${fd}, ${x}) as data`,
        write: (x) => sql2`select lowrite(${fd}, ${x})`,
        truncate: (x) => sql2`select lo_truncate64(${fd}, ${x})`,
        seek: (x, whence = 0) => sql2`select lo_lseek64(${fd}, ${x}, ${whence})`,
        size: () => sql2`
          select
            lo_lseek64(${fd}, location, 0) as position,
            seek.size
          from (
            select
              lo_lseek64($1, 0, 2) as size,
              tell.location
            from (select lo_tell64($1) as location) tell
          ) seek
        `
      };
      resolve(lo);
      return new Promise(async (r) => finish = r);
      async function readable({
        highWaterMark = 2048 * 8,
        start = 0,
        end = Infinity
      } = {}) {
        let max = end - start;
        start && await lo.seek(start);
        return new Stream2.Readable({
          highWaterMark,
          async read(size2) {
            const l = size2 > max ? size2 - max : size2;
            max -= size2;
            const [{ data }] = await lo.read(l);
            this.push(data);
            if (data.length < size2)
              this.push(null);
          }
        });
      }
      async function writable({
        highWaterMark = 2048 * 8,
        start = 0
      } = {}) {
        start && await lo.seek(start);
        return new Stream2.Writable({
          highWaterMark,
          write(chunk, encoding, callback) {
            lo.write(chunk).then(() => callback(), callback);
          }
        });
      }
    }).catch(reject);
  });
}

// node_modules/postgres/src/index.js
Object.assign(Postgres, {
  PostgresError,
  toPascal,
  pascal,
  toCamel,
  camel,
  toKebab,
  kebab,
  fromPascal,
  fromCamel,
  fromKebab,
  BigInt: {
    to: 20,
    from: [20],
    parse: (x) => BigInt(x),
    // eslint-disable-line
    serialize: (x) => x.toString()
  }
});
var src_default = Postgres;
function Postgres(a, b2) {
  const options = parseOptions(a, b2), subscribe = options.no_subscribe || Subscribe(Postgres, { ...options });
  let ending = false;
  const queries = queue_default(), connecting = queue_default(), reserved = queue_default(), closed = queue_default(), ended = queue_default(), open = queue_default(), busy = queue_default(), full = queue_default(), queues = { connecting, reserved, closed, ended, open, busy, full };
  const connections = [...Array(options.max)].map(() => connection_default(options, queues, { onopen, onend, onclose }));
  const sql = Sql(handler);
  Object.assign(sql, {
    get parameters() {
      return options.parameters;
    },
    largeObject: largeObject.bind(null, sql),
    subscribe,
    CLOSE,
    END: CLOSE,
    PostgresError,
    options,
    reserve,
    listen,
    begin,
    close,
    end
  });
  return sql;
  function Sql(handler2) {
    handler2.debug = options.debug;
    Object.entries(options.types).reduce((acc, [name, type]) => {
      acc[name] = (x) => new Parameter(x, type.to);
      return acc;
    }, typed);
    Object.assign(sql2, {
      types: typed,
      typed,
      unsafe,
      notify,
      array: array2,
      json: json2,
      file: file2
    });
    return sql2;
    function typed(value, type) {
      return new Parameter(value, type);
    }
    function sql2(strings, ...args) {
      const query = strings && Array.isArray(strings.raw) ? new Query(strings, args, handler2, cancel) : typeof strings === "string" && !args.length ? new Identifier(options.transform.column.to ? options.transform.column.to(strings) : strings) : new Builder(strings, args);
      return query;
    }
    function unsafe(string4, args = [], options2 = {}) {
      arguments.length === 2 && !Array.isArray(args) && (options2 = args, args = []);
      const query = new Query([string4], args, handler2, cancel, {
        prepare: false,
        ...options2,
        simple: "simple" in options2 ? options2.simple : args.length === 0
      });
      return query;
    }
    function file2(path, args = [], options2 = {}) {
      arguments.length === 2 && !Array.isArray(args) && (options2 = args, args = []);
      const query = new Query([], args, (query2) => {
        fs.readFile(path, "utf8", (err, string4) => {
          if (err)
            return query2.reject(err);
          query2.strings = [string4];
          handler2(query2);
        });
      }, cancel, {
        ...options2,
        simple: "simple" in options2 ? options2.simple : args.length === 0
      });
      return query;
    }
  }
  async function listen(name, fn, onlisten) {
    const listener = { fn, onlisten };
    const sql2 = listen.sql || (listen.sql = Postgres({
      ...options,
      max: 1,
      idle_timeout: null,
      max_lifetime: null,
      fetch_types: false,
      onclose() {
        Object.entries(listen.channels).forEach(([name2, { listeners }]) => {
          delete listen.channels[name2];
          Promise.all(listeners.map((l) => listen(name2, l.fn, l.onlisten).catch(() => {
          })));
        });
      },
      onnotify(c, x) {
        c in listen.channels && listen.channels[c].listeners.forEach((l) => l.fn(x));
      }
    }));
    const channels = listen.channels || (listen.channels = {}), exists = name in channels;
    if (exists) {
      channels[name].listeners.push(listener);
      const result2 = await channels[name].result;
      listener.onlisten && listener.onlisten();
      return { state: result2.state, unlisten };
    }
    channels[name] = { result: sql2`listen ${sql2.unsafe('"' + name.replace(/"/g, '""') + '"')}`, listeners: [listener] };
    const result = await channels[name].result;
    listener.onlisten && listener.onlisten();
    return { state: result.state, unlisten };
    async function unlisten() {
      if (name in channels === false)
        return;
      channels[name].listeners = channels[name].listeners.filter((x) => x !== listener);
      if (channels[name].listeners.length)
        return;
      delete channels[name];
      return sql2`unlisten ${sql2.unsafe('"' + name.replace(/"/g, '""') + '"')}`;
    }
  }
  async function notify(channel, payload) {
    return await sql`select pg_notify(${channel}, ${"" + payload})`;
  }
  async function reserve() {
    const queue = queue_default();
    const c = open.length ? open.shift() : await new Promise((resolve, reject) => {
      const query = { reserve: resolve, reject };
      queries.push(query);
      closed.length && connect(closed.shift(), query);
    });
    move(c, reserved);
    c.reserved = () => queue.length ? c.execute(queue.shift()) : move(c, reserved);
    c.reserved.release = true;
    const sql2 = Sql(handler2);
    sql2.release = () => {
      c.reserved = null;
      onopen(c);
    };
    return sql2;
    function handler2(q) {
      c.queue === full ? queue.push(q) : c.execute(q) || move(c, full);
    }
  }
  async function begin(options2, fn) {
    !fn && (fn = options2, options2 = "");
    const queries2 = queue_default();
    let savepoints = 0, connection2, prepare = null;
    try {
      await sql.unsafe("begin " + options2.replace(/[^a-z ]/ig, ""), [], { onexecute }).execute();
      return await Promise.race([
        scope(connection2, fn),
        new Promise((_, reject) => connection2.onclose = reject)
      ]);
    } catch (error51) {
      throw error51;
    }
    async function scope(c, fn2, name) {
      const sql2 = Sql(handler2);
      sql2.savepoint = savepoint;
      sql2.prepare = (x) => prepare = x.replace(/[^a-z0-9$-_. ]/gi);
      let uncaughtError, result;
      name && await sql2`savepoint ${sql2(name)}`;
      try {
        result = await new Promise((resolve, reject) => {
          const x = fn2(sql2);
          Promise.resolve(Array.isArray(x) ? Promise.all(x) : x).then(resolve, reject);
        });
        if (uncaughtError)
          throw uncaughtError;
      } catch (e) {
        await (name ? sql2`rollback to ${sql2(name)}` : sql2`rollback`);
        throw e instanceof PostgresError && e.code === "25P02" && uncaughtError || e;
      }
      if (!name) {
        prepare ? await sql2`prepare transaction '${sql2.unsafe(prepare)}'` : await sql2`commit`;
      }
      return result;
      function savepoint(name2, fn3) {
        if (name2 && Array.isArray(name2.raw))
          return savepoint((sql3) => sql3.apply(sql3, arguments));
        arguments.length === 1 && (fn3 = name2, name2 = null);
        return scope(c, fn3, "s" + savepoints++ + (name2 ? "_" + name2 : ""));
      }
      function handler2(q) {
        q.catch((e) => uncaughtError || (uncaughtError = e));
        c.queue === full ? queries2.push(q) : c.execute(q) || move(c, full);
      }
    }
    function onexecute(c) {
      connection2 = c;
      move(c, reserved);
      c.reserved = () => queries2.length ? c.execute(queries2.shift()) : move(c, reserved);
    }
  }
  function move(c, queue) {
    c.queue.remove(c);
    queue.push(c);
    c.queue = queue;
    queue === open ? c.idleTimer.start() : c.idleTimer.cancel();
    return c;
  }
  function json2(x) {
    return new Parameter(x, 3802);
  }
  function array2(x, type) {
    if (!Array.isArray(x))
      return array2(Array.from(arguments));
    return new Parameter(x, type || (x.length ? inferType(x) || 25 : 0), options.shared.typeArrayMap);
  }
  function handler(query) {
    if (ending)
      return query.reject(Errors.connection("CONNECTION_ENDED", options, options));
    if (open.length)
      return go(open.shift(), query);
    if (closed.length)
      return connect(closed.shift(), query);
    busy.length ? go(busy.shift(), query) : queries.push(query);
  }
  function go(c, query) {
    return c.execute(query) ? move(c, busy) : move(c, full);
  }
  function cancel(query) {
    return new Promise((resolve, reject) => {
      query.state ? query.active ? connection_default(options).cancel(query.state, resolve, reject) : query.cancelled = { resolve, reject } : (queries.remove(query), query.cancelled = true, query.reject(Errors.generic("57014", "canceling statement due to user request")), resolve());
    });
  }
  async function end({ timeout = null } = {}) {
    if (ending)
      return ending;
    await 1;
    let timer2;
    return ending = Promise.race([
      new Promise((r) => timeout !== null && (timer2 = setTimeout(destroy, timeout * 1e3, r))),
      Promise.all(connections.map((c) => c.end()).concat(
        listen.sql ? listen.sql.end({ timeout: 0 }) : [],
        subscribe.sql ? subscribe.sql.end({ timeout: 0 }) : []
      ))
    ]).then(() => clearTimeout(timer2));
  }
  async function close() {
    await Promise.all(connections.map((c) => c.end()));
  }
  async function destroy(resolve) {
    await Promise.all(connections.map((c) => c.terminate()));
    while (queries.length)
      queries.shift().reject(Errors.connection("CONNECTION_DESTROYED", options));
    resolve();
  }
  function connect(c, query) {
    move(c, connecting);
    c.connect(query);
    return c;
  }
  function onend(c) {
    move(c, ended);
  }
  function onopen(c) {
    if (queries.length === 0)
      return move(c, open);
    let max = Math.ceil(queries.length / (connecting.length + 1)), ready = true;
    while (ready && queries.length && max-- > 0) {
      const query = queries.shift();
      if (query.reserve)
        return query.reserve(c);
      ready = c.execute(query);
    }
    ready ? move(c, busy) : move(c, full);
  }
  function onclose(c, e) {
    move(c, closed);
    c.reserved = null;
    c.onclose && (c.onclose(e), c.onclose = null);
    options.onclose && options.onclose(c.id);
    queries.length && connect(c, queries.shift());
  }
}
function parseOptions(a, b2) {
  if (a && a.shared)
    return a;
  const env = process.env, o = (!a || typeof a === "string" ? b2 : a) || {}, { url: url2, multihost } = parseUrl(a), query = [...url2.searchParams].reduce((a2, [b3, c]) => (a2[b3] = c, a2), {}), host = o.hostname || o.host || multihost || url2.hostname || env.PGHOST || "localhost", port = o.port || url2.port || env.PGPORT || 5432, user = o.user || o.username || url2.username || env.PGUSERNAME || env.PGUSER || osUsername();
  o.no_prepare && (o.prepare = false);
  query.sslmode && (query.ssl = query.sslmode, delete query.sslmode);
  "timeout" in o && (console.log("The timeout option is deprecated, use idle_timeout instead"), o.idle_timeout = o.timeout);
  query.sslrootcert === "system" && (query.ssl = "verify-full");
  const ints = ["idle_timeout", "connect_timeout", "max_lifetime", "max_pipeline", "backoff", "keep_alive"];
  const defaults = {
    max: globalThis.Cloudflare ? 3 : 10,
    ssl: false,
    sslnegotiation: null,
    idle_timeout: null,
    connect_timeout: 30,
    max_lifetime,
    max_pipeline: 100,
    backoff,
    keep_alive: 60,
    prepare: true,
    debug: false,
    fetch_types: true,
    publications: "alltables",
    target_session_attrs: null
  };
  return {
    host: Array.isArray(host) ? host : host.split(",").map((x) => x.split(":")[0]),
    port: Array.isArray(port) ? port : host.split(",").map((x) => parseInt(x.split(":")[1] || port)),
    path: o.path || host.indexOf("/") > -1 && host + "/.s.PGSQL." + port,
    database: o.database || o.db || (url2.pathname || "").slice(1) || env.PGDATABASE || user,
    user,
    pass: o.pass || o.password || url2.password || env.PGPASSWORD || "",
    ...Object.entries(defaults).reduce(
      (acc, [k, d]) => {
        const value = k in o ? o[k] : k in query ? query[k] === "disable" || query[k] === "false" ? false : query[k] : env["PG" + k.toUpperCase()] || d;
        acc[k] = typeof value === "string" && ints.includes(k) ? +value : value;
        return acc;
      },
      {}
    ),
    connection: {
      application_name: env.PGAPPNAME || "postgres.js",
      ...o.connection,
      ...Object.entries(query).reduce((acc, [k, v]) => (k in defaults || (acc[k] = v), acc), {})
    },
    types: o.types || {},
    target_session_attrs: tsa(o, url2, env),
    onnotice: o.onnotice,
    onnotify: o.onnotify,
    onclose: o.onclose,
    onparameter: o.onparameter,
    socket: o.socket,
    transform: parseTransform(o.transform || { undefined: void 0 }),
    parameters: {},
    shared: { retries: 0, typeArrayMap: {} },
    ...mergeUserTypes(o.types)
  };
}
function tsa(o, url2, env) {
  const x = o.target_session_attrs || url2.searchParams.get("target_session_attrs") || env.PGTARGETSESSIONATTRS;
  if (!x || ["read-write", "read-only", "primary", "standby", "prefer-standby"].includes(x))
    return x;
  throw new Error("target_session_attrs " + x + " is not supported");
}
function backoff(retries) {
  return (0.5 + Math.random() / 2) * Math.min(3 ** retries / 100, 20);
}
function max_lifetime() {
  return 60 * (30 + Math.random() * 30);
}
function parseTransform(x) {
  return {
    undefined: x.undefined,
    column: {
      from: typeof x.column === "function" ? x.column : x.column && x.column.from,
      to: x.column && x.column.to
    },
    value: {
      from: typeof x.value === "function" ? x.value : x.value && x.value.from,
      to: x.value && x.value.to
    },
    row: {
      from: typeof x.row === "function" ? x.row : x.row && x.row.from,
      to: x.row && x.row.to
    }
  };
}
function parseUrl(url2) {
  if (!url2 || typeof url2 !== "string")
    return { url: { searchParams: /* @__PURE__ */ new Map() } };
  let host = url2;
  host = host.slice(host.indexOf("://") + 3).split(/[?/]/)[0];
  host = decodeURIComponent(host.slice(host.indexOf("@") + 1));
  const urlObj = new URL(url2.replace(host, host.split(",")[0]));
  return {
    url: {
      username: decodeURIComponent(urlObj.username),
      password: decodeURIComponent(urlObj.password),
      host: urlObj.host,
      hostname: urlObj.hostname,
      port: urlObj.port,
      pathname: urlObj.pathname,
      searchParams: urlObj.searchParams
    },
    multihost: host.indexOf(",") > -1 && host
  };
}
function osUsername() {
  try {
    return os.userInfo().username;
  } catch (_) {
    return process.env.USERNAME || process.env.USER || process.env.LOGNAME;
  }
}

// src/server/RuntimeStateStore.ts
var InMemoryRuntimeStateStore = class {
  name = "memory";
  state = null;
  async load() {
    return this.state ? structuredClone(this.state) : null;
  }
  async save(state) {
    this.state = structuredClone(state);
  }
};
var PostgresRuntimeStateStore = class {
  name = "postgres";
  sql;
  initialized = false;
  constructor(connectionString) {
    this.sql = src_default(connectionString, { max: 1, idle_timeout: 20, connect_timeout: 10 });
  }
  async ensureSchema() {
    if (this.initialized) return;
    await this.sql`
      create table if not exists beke19_runtime_state (
        state_key text primary key,
        payload jsonb not null,
        memories jsonb not null default '[]'::jsonb,
        expires_at timestamptz not null,
        updated_at timestamptz not null default now()
      )
    `;
    this.initialized = true;
  }
  async load() {
    await this.ensureSchema();
    const rows = await this.sql`
      select payload, memories, expires_at
      from beke19_runtime_state
      where state_key = 'BEKE'
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      payload: row.payload,
      memories: row.memories,
      expiresAt: row.expires_at.toISOString()
    };
  }
  async save(state) {
    await this.ensureSchema();
    const payload = JSON.parse(JSON.stringify(state.payload));
    const memories = JSON.parse(JSON.stringify(state.memories));
    await this.sql`
      insert into beke19_runtime_state (state_key, payload, memories, expires_at, updated_at)
      values ('BEKE', ${this.sql.json(payload)}, ${this.sql.json(memories)}, ${state.expiresAt}, now())
      on conflict (state_key) do update set
        payload = excluded.payload,
        memories = excluded.memories,
        expires_at = excluded.expires_at,
        updated_at = now()
    `;
  }
};

// src/server/beke19Api.ts
var snapshotRepository = null;
var memoryRepository = null;
var runRepository = null;
var runtimeCache = null;
var runtimeInFlight = null;
var defaultStateStore = null;
var refreshByIdempotencyKey = /* @__PURE__ */ new Map();
var SNAPSHOT_CACHE_TTL_MS = 6 * 60 * 60 * 1e3;
function resetBeke19RuntimeCache() {
  runtimeCache = null;
  runtimeInFlight = null;
  snapshotRepository = null;
  memoryRepository = null;
  runRepository = null;
  defaultStateStore = null;
  refreshByIdempotencyKey.clear();
}
function getRuntimeEnv() {
  return globalThis.process?.env ?? {};
}
function getStateStore(env, explicit) {
  if (explicit) return explicit;
  if (defaultStateStore) return defaultStateStore;
  const connectionString = env.POSTGRES_URL ?? env.DATABASE_URL;
  defaultStateStore = connectionString ? new PostgresRuntimeStateStore(connectionString) : new InMemoryRuntimeStateStore();
  return defaultStateStore;
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
    status: "failed",
    inputVersion: snapshot.inputVersion,
    modelVersion: snapshot.modelVersion,
    promptVersion: snapshot.promptVersion,
    dataVersion: snapshot.dataVersion,
    startedAt: snapshot.updatedAt,
    finishedAt: snapshot.updatedAt,
    snapshotId: snapshot.runId,
    errorMessage: "Server harness unavailable; serving the last bundled snapshot.",
    steps: [
      {
        step: "publish",
        status: "failed",
        startedAt: snapshot.updatedAt,
        finishedAt: snapshot.updatedAt,
        inputSummary: "\u8BFB\u53D6\u670D\u52A1\u7AEF\u9759\u6001 fallback \u5FEB\u7167",
        outputSummary: `\u5FEB\u7167 ${snapshot.runId}`,
        errorMessage: "Static degraded fallback"
      }
    ]
  };
}
function toPublicRun(run) {
  return {
    ...run,
    steps: run.steps.map(({ output: _output, ...step }) => step)
  };
}
function createServerLLMGateway(env = getRuntimeEnv()) {
  const apiKey = env.LLM_API_KEY;
  const baseUrl = env.LLM_BASE_URL;
  const useOpenAI = env.LLM_PROVIDER === "openai" || baseUrl?.includes("api.openai.com");
  const useArk = env.LLM_PROVIDER === "ark" || baseUrl?.includes("volces.com");
  const providerName = apiKey ? useArk ? "ArkChatCompletionsProvider" : useOpenAI ? "OpenAIResponsesProvider" : "TokenPlanProvider" : "MockLLMProvider";
  const gateway = new LLMGateway(providerName);
  if (apiKey) {
    gateway.registerProvider(useArk ? new ArkChatCompletionsProvider(apiKey, baseUrl, env.LLM_MODEL) : useOpenAI ? new OpenAIResponsesProvider(apiKey, baseUrl, env.LLM_MODEL) : new TokenPlanProvider(apiKey, baseUrl, env.LLM_MODEL));
  }
  gateway.registerProvider(new MockLLMProvider());
  return gateway;
}
function resolveServerLLMProvider(env = getRuntimeEnv()) {
  return createServerLLMGateway(env);
}
function runtimeInfo(provider, source, providers, cacheStatus, generatedAt, expiresAtMs, persistence) {
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
    },
    persistence
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
  if (runtimeInFlight) return runtimeInFlight;
  runtimeInFlight = loadOrGenerateBeke19SnapshotState(env, options, now);
  try {
    return await runtimeInFlight;
  } finally {
    runtimeInFlight = null;
  }
}
async function loadOrGenerateBeke19SnapshotState(env, options, now) {
  const stateStore = getStateStore(env, options.stateStore);
  if (!options.forceRefresh && !runtimeCache) {
    try {
      const persisted = await stateStore.load();
      if (persisted) {
        const expiresAtMs = new Date(persisted.expiresAt).getTime();
        getSnapshotRepository().save(persisted.payload.state.snapshot);
        getRunRepository().save(persisted.payload.state.run);
        getMemoryRepository().saveMany(persisted.memories);
        runtimeCache = { payload: persisted.payload, expiresAtMs };
        if (expiresAtMs > now.getTime()) {
          return {
            ...persisted.payload,
            runtime: {
              ...persisted.payload.runtime,
              generatedAt: now.toISOString(),
              persistence: stateStore.name,
              cache: { status: "hit", expiresAt: persisted.expiresAt }
            }
          };
        }
      }
    } catch (error51) {
      console.warn("beke19 persistent state unavailable; continuing in memory", error51);
    }
  }
  const payload = await generateBeke19SnapshotState(env, options, now, stateStore);
  if (payload.runtime.source === "server-harness") {
    try {
      await stateStore.save({
        payload,
        memories: getMemoryRepository().getAll(),
        expiresAt: payload.runtime.cache.expiresAt
      });
    } catch (error51) {
      console.warn("beke19 persistent state save failed; snapshot remains available", error51);
    }
  }
  return payload;
}
async function generateBeke19SnapshotState(env, options, now, stateStore) {
  const repo = getSnapshotRepository();
  const llmProvider = resolveServerLLMProvider(env);
  const providers = options.providers ?? createProductionProviders();
  const cacheStatus = options.forceRefresh ? "refresh" : "miss";
  const expiresAtMs = now.getTime() + (options.cacheTtlMs ?? SNAPSHOT_CACHE_TTL_MS);
  let degradedReason = "Harness did not produce a publishable snapshot";
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
          run: toPublicRun(result.run)
        },
        runtime: runtimeInfo(llmProvider, "server-harness", providers, cacheStatus, now, expiresAtMs, stateStore.name)
      };
      runtimeCache = { payload: payload2, expiresAtMs };
      return payload2;
    }
  } catch (error51) {
    console.warn("beke19 server harness failed; using fallback snapshot", error51);
    degradedReason = error51 instanceof Error ? error51.message : String(error51);
  }
  const payload = {
    ok: true,
    state: {
      snapshot: latestSnapshot,
      run: fallbackRun(latestSnapshot)
    },
    runtime: {
      ...runtimeInfo(llmProvider, "static-fallback", providers, cacheStatus, now, expiresAtMs, stateStore.name),
      degraded: { reason: degradedReason }
    }
  };
  runtimeCache = { payload, expiresAtMs };
  return payload;
}
function headerValue(req, name) {
  const entry = Object.entries(req.headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  const value = entry?.[1];
  return Array.isArray(value) ? value[0] : value;
}
function parseAction(req) {
  const raw = req.query?.action;
  if (Array.isArray(raw)) return raw[0] ?? "snapshot";
  if (raw) return raw;
  try {
    const url2 = new URL(req.url ?? "/", "http://localhost");
    return url2.searchParams.get("action") ?? "snapshot";
  } catch {
    return "snapshot";
  }
}
async function handleBeke19Request(req, res, options = {}) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,Idempotency-Key");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method && req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  const action = parseAction(req);
  if (action !== "snapshot" && action !== "refresh") {
    res.status(400).json({ ok: false, error: `Unsupported action: ${action}` });
    return;
  }
  let idempotencyKey;
  if (action === "refresh") {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Refresh requires POST" });
      return;
    }
    const expectedToken = options.refreshToken ?? getRuntimeEnv().BEKE19_REFRESH_TOKEN;
    const authorization = headerValue(req, "authorization");
    idempotencyKey = headerValue(req, "idempotency-key");
    if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
      res.status(401).json({ ok: false, error: "Unauthorized refresh" });
      return;
    }
    if (!idempotencyKey) {
      res.status(400).json({ ok: false, error: "Idempotency-Key is required" });
      return;
    }
    const previous = refreshByIdempotencyKey.get(idempotencyKey);
    if (previous) {
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(previous);
      return;
    }
  } else if (req.method === "POST") {
    res.status(405).json({ ok: false, error: "Snapshot is read-only" });
    return;
  }
  const payload = await createBeke19SnapshotState(void 0, {
    ...options,
    forceRefresh: action === "refresh" || options.forceRefresh
  });
  if (idempotencyKey) {
    refreshByIdempotencyKey.set(idempotencyKey, payload);
    if (refreshByIdempotencyKey.size > 100) {
      refreshByIdempotencyKey.delete(refreshByIdempotencyKey.keys().next().value);
    }
  }
  res.setHeader(
    "Cache-Control",
    action === "refresh" ? "no-store" : "public, s-maxage=60, stale-while-revalidate=60"
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
