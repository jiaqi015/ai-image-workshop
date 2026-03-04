const RUNTIME_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bAborted\b/gi, '已取消'],
  [/\bBackend\b/gi, '后端'],
  [/\bGateway\b/gi, '网关'],
  [/\bPipeline Mode\b/gi, '流水线模式'],
  [/\btimeout\b/gi, '超时'],
  [/\btimed out\b/gi, '超时'],
  [/\bnetwork error\b/gi, '网络异常'],
  [/\bfailed to fetch\b/gi, '网络请求失败'],
  [/\bservice unavailable\b/gi, '服务暂不可用'],
  [/\binternal server error\b/gi, '服务内部错误'],
  [/\bunauthorized\b/gi, '未授权'],
  [/\bforbidden\b/gi, '已拒绝'],
  [/\binvalid api key\b/gi, '密钥无效'],
  [/\bquota exceeded\b/gi, '额度不足'],
  [/\brate limits?\b/gi, '请求过快'],
  [/\bnot found\b/gi, '未找到'],
  [/\bunknown error\b/gi, '未知错误'],
  [/\bHTTP\s*(\d{3})\b/gi, '网络状态 $1'],
  [/\bstatus\s*(\d{3})\b/gi, '状态码 $1'],
  [/\bID:/g, '编号：'],
  [/\bIP:/g, 'IP：'],
];

export const localizeRuntimeText = (input: string): string => {
  let text = String(input || '').trim();
  if (!text) return '';

  for (const [pattern, replacement] of RUNTIME_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  return text.replace(/\s{2,}/g, ' ').trim();
};
