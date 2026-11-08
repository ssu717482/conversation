(function () {
  'use strict';

  var UTC8 = 8 * 3600 * 1000;
  var DAY = 86400000;
  var PAGE_LIMIT = 300;

  var state = {
    range: '7',
    from: '',
    to: '',
    keyword: '',
    status: 'all',
    all: [],
    filtered: [],
    baseTs: 0
  };

  var CHANNEL = { email: '邮件', whatsapp: 'WhatsApp', web: '网页', app: 'App', wechat: '微信' };
  var TRANSFER = { direct: '用户主动要求', passive: 'AI 无法解决后转接', none: '未转人工' };
  var TRIGGER = { user_request: '用户主动要求', ai_unresolved: 'AI 未能解决' };
  var ROLE = { user: '用户', assistant: 'AI 客服', agent: '人工客服' };

  var elTbody = document.getElementById('tbody');
  var elTotal = document.getElementById('totalCount');
  var elFooter = document.getElementById('footerNote');
  var elSearch = document.getElementById('searchInput');
  var elStatus = document.getElementById('statusSelect');
  var elCustom = document.getElementById('customRange');
  var elFrom = document.getElementById('dateFrom');
  var elTo = document.getElementById('dateTo');
  var elDialog = document.getElementById('dialogRoot');

  function pad(n) { return String(n).padStart(2, '0'); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function shifted(iso) { return new Date(new Date(iso).getTime() + UTC8); }

  function fmtDateTime(iso) {
    var d = shifted(iso);
    return d.getUTCFullYear() + '/' + (d.getUTCMonth() + 1) + '/' + d.getUTCDate() +
      ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
  }

  function fmtDate(ts) {
    var d = new Date(ts + UTC8);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  function fmtClock(iso) {
    var d = shifted(iso);
    return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
  }

  function dayStart(ts) { return Math.floor((ts + UTC8) / DAY) * DAY - UTC8; }

  function statusOf(c) {
    if (c.resolved) return 'AI已解决';
    if (c.transfer && c.transfer !== 'none') return '转人工解决';
    return '未解决';
  }

  function firstQuestion(c) {
    var msgs = c.messages || [];
    for (var i = 0; i < msgs.length; i++) if (msgs[i].role === 'user') return msgs[i].content;
    return msgs.length ? msgs[0].content : '';
  }

  function badge(st) {
    if (st === 'AI已解决') return '<span class="badge ok">AI已解决</span>';
    if (st === '转人工解决') return '<span class="badge warn">转人工解决</span>';
    return '<span class="badge bad">未解决</span>';
  }

  /* ---------- 筛选 ---------- */

  function bounds() {
    var baseDay = dayStart(state.baseTs);
    if (state.range === 'custom') {
      if (!state.from || !state.to) return null;
      var f = new Date(state.from + 'T00:00:00Z').getTime() - UTC8;
      var t = new Date(state.to + 'T00:00:00Z').getTime() - UTC8;
      if (isNaN(f) || isNaN(t)) return null;
      return [dayStart(f), dayStart(t) + DAY];
    }
    var n = parseInt(state.range, 10);
    if (n === 0) return [baseDay, baseDay + DAY];
    return [baseDay - (n - 1) * DAY, baseDay + DAY];
  }

  function apply() {
    var b = bounds();
    var kw = state.keyword.trim().toLowerCase();
    var st = state.status;
    var out = state.all.filter(function (c) {
      var ts = new Date(c.startedAt).getTime();
      if (b && (ts < b[0] || ts >= b[1])) return false;
      if (st !== 'all' && statusOf(c) !== st) return false;
      if (kw) {
        var hay = c.id.toLowerCase();
        if (hay.indexOf(kw) === -1) {
          var msgs = c.messages || [];
          var hit = false;
          for (var i = 0; i < msgs.length; i++) {
            if (String(msgs[i].content).toLowerCase().indexOf(kw) !== -1) { hit = true; break; }
          }
          if (!hit && String(c.secondaryIntent || '').toLowerCase().indexOf(kw) === -1) return false;
        }
      }
      return true;
    });
    out.sort(function (a, b2) { return new Date(b2.startedAt) - new Date(a.startedAt); });
    state.filtered = out;
    render();
  }

  /* ---------- 渲染 ---------- */

  var TD = 'p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]';

  function render() {
    var list = state.filtered.slice(0, PAGE_LIMIT);
    if (!list.length) {
      elTbody.innerHTML = '<tr class="empty-row"><td colspan="6">该条件下暂无会话记录</td></tr>';
    } else {
      elTbody.innerHTML = list.map(function (c) {
        return '<tr class="border-b transition-colors hover:bg-muted/50">' +
          '<td class="' + TD + ' whitespace-nowrap text-xs text-muted-foreground">' + fmtDateTime(c.startedAt) + '</td>' +
          '<td class="' + TD + ' font-mono text-xs">' + esc(c.id) + '</td>' +
          '<td class="' + TD + '">' + badge(statusOf(c)) + '</td>' +
          '<td class="' + TD + ' max-w-[320px] truncate" title="' + esc(firstQuestion(c)) + '">' + esc(firstQuestion(c)) + '</td>' +
          '<td class="' + TD + ' text-right text-xs">' + c.tokens + '</td>' +
          '<td class="' + TD + ' text-right"><button type="button" data-id="' + esc(c.id) + '" class="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-xs">查看</button></td>' +
          '</tr>';
      }).join('');
    }
    var total = state.filtered.length;
    elFooter.textContent = total > PAGE_LIMIT
      ? '仅显示前 ' + PAGE_LIMIT + ' 条（共 ' + total + ' 条）'
      : '共 ' + total + ' 条';
  }

  /* ---------- 详情弹窗 ---------- */

  function detailField(k, v, mono) {
    return '<div><div class="dlg-k">' + esc(k) + '</div><div class="dlg-v' + (mono ? ' font-mono' : '') + '">' + esc(v == null || v === '' ? '—' : v) + '</div></div>';
  }

  function secTitle(t) { return '<div class="dlg-sec-t">' + esc(t) + '</div>'; }

  function openDetail(id) {
    var c = null;
    for (var i = 0; i < state.all.length; i++) if (state.all[i].id === id) { c = state.all[i]; break; }
    if (!c) return;

    var st = statusOf(c);
    var dur = c.durationSec != null ? Math.floor(c.durationSec / 60) + ' 分 ' + (c.durationSec % 60) + ' 秒' : null;
    var fr = c.firstResponseMs != null ? (c.firstResponseMs / 1000).toFixed(1) + ' 秒' : null;
    var cost = c.costCny != null ? '¥' + Number(c.costCny).toFixed(4) : null;

    var html = '';
    html += '<div class="dlg-overlay" data-close="1"><div class="dlg-panel" role="dialog" aria-modal="true">';
    html += '<div class="dlg-head"><div>' +
      '<div style="font-family:ui-monospace,monospace;font-size:15px;font-weight:600">' + esc(c.id) + '</div>' +
      '<div style="margin-top:6px;display:flex;align-items:center;gap:8px">' + badge(st) +
      '<span style="font-size:12px;color:#737373">' + fmtDateTime(c.startedAt) + '</span>' +
      (c.isBadcase ? '<span class="badge bad" style="background:#f59e0b">Badcase' + (c.badcaseTag ? ' · ' + esc(c.badcaseTag) : '') + '</span>' : '') +
      '</div></div>' +
      '<button type="button" class="dlg-close" data-close="1" aria-label="关闭">×</button></div>';

    html += '<div class="dlg-body">';

    html += '<div class="dlg-grid">';
    html += detailField('会话时长', dur);
    html += detailField('首次响应', fr);
    html += detailField('渠道', CHANNEL[c.channel] || c.channel);
    html += detailField('模型', c.model, true);
    html += detailField('Tokens', c.tokens);
    html += detailField('成本', cost);
    html += detailField('CSAT', c.csat != null ? c.csat + ' 分' : '未评价');
    html += detailField('一级意图', c.problemCategory, false);
    html += detailField('二级意图', c.secondaryIntent);
    html += detailField('三级意图', c.tertiaryIntent);
    html += detailField('转人工', TRANSFER[c.transfer] || c.transfer);
    html += detailField('AI 执行状态', c.aiExecutionStatus === 'completed' ? '已完成' : (c.aiExecutionStatus || '—'));
    html += '</div>';

    if (c.transfer && c.transfer !== 'none' && c.transferTrigger) {
      html += '<div style="margin-top:10px;font-size:12px;color:#737373">转接触发原因：' + esc(TRIGGER[c.transferTrigger] || c.transferTrigger) + '</div>';
    }
    if (c.status === 'failed' && c.failureReason) {
      html += '<div style="margin-top:10px;font-size:12px;color:#b91c1c">失败原因：' + esc(c.failureReason) + (c.errorMessage ? '（' + esc(c.errorMessage) + '）' : '') + '</div>';
    }
    if (c.badcaseNote) {
      html += '<div style="margin-top:10px;font-size:12px;color:#525252">Badcase 备注：' + esc(c.badcaseNote) + '</div>';
    }

    var steps = c.aiExecutionSteps || [];
    if (steps.length) {
      html += secTitle('AI 执行链路');
      html += steps.map(function (s, idx) {
        return '<div class="step"><div class="step-top"><span>' + (idx + 1) + '. ' + esc(s.label) +
          '</span><span style="font-weight:400;color:' + (s.status === 'completed' ? '#737373' : '#b91c1c') + '">' +
          esc(s.status === 'completed' ? '完成' : s.status) + ' · ' + s.durationMs + 'ms</span></div>' +
          '<div class="step-io"><b>输入：</b>' + esc(s.input) + '\n<b>输出：</b>' + esc(s.output) + '</div></div>';
      }).join('');
    }

    var msgs = c.messages || [];
    if (msgs.length) {
      html += secTitle('对话记录');
      html += msgs.map(function (m) {
        var cls = m.role === 'user' ? 'user' : (m.role === 'agent' ? 'agent' : 'assistant');
        return '<div class="msg ' + cls + '"><div class="msg-role">' + esc(ROLE[m.role] || m.role) + '</div>' +
          '<div class="msg-bubble">' + esc(m.content) +
          '<div class="msg-ts">' + (m.ts ? fmtClock(m.ts) : '') + '</div></div></div>';
      }).join('');
    }

    html += '</div></div></div>';
    elDialog.innerHTML = html;
    document.body.style.overflow = 'hidden';
  }

  function closeDetail() {
    elDialog.innerHTML = '';
    document.body.style.overflow = '';
  }

  elDialog.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== elDialog) {
      if (t.getAttribute && t.getAttribute('data-close')) { closeDetail(); return; }
      t = t.parentNode;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDetail();
  });

  elTbody.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== elTbody) {
      if (t.getAttribute && t.getAttribute('data-id')) { openDetail(t.getAttribute('data-id')); return; }
      t = t.parentNode;
    }
  });

  /* ---------- 交互绑定 ---------- */

  document.getElementById('rangeTabs').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-range]');
    if (!btn) return;
    state.range = btn.getAttribute('data-range');
    Array.prototype.forEach.call(this.querySelectorAll('[data-range]'), function (b) {
      b.setAttribute('data-state', b === btn ? 'active' : 'inactive');
    });
    elCustom.classList.toggle('show', state.range === 'custom');
    apply();
  });

  var timer = null;
  elSearch.addEventListener('input', function () {
    var v = this.value;
    clearTimeout(timer);
    timer = setTimeout(function () { state.keyword = v; apply(); }, 120);
  });

  elStatus.addEventListener('change', function () { state.status = this.value; apply(); });

  elFrom.addEventListener('change', function () { state.from = this.value; apply(); });
  elTo.addEventListener('change', function () { state.to = this.value; apply(); });

  /* ---------- 初始化 ---------- */

  fetch('assets/conversations.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state.all = data;
      elTotal.textContent = data.length;

      var maxTs = 0, minTs = Infinity;
      data.forEach(function (c) {
        var t = new Date(c.startedAt).getTime();
        if (t > maxTs) maxTs = t;
        if (t < minTs) minTs = t;
      });
      state.baseTs = maxTs;

      elFrom.value = fmtDate(minTs);
      elTo.value = fmtDate(maxTs);
      state.from = elFrom.value;
      state.to = elTo.value;

      var qs = new URLSearchParams(location.search);
      var rq = qs.get('range');
      if (rq != null) {
        var known = Array.prototype.slice.call(document.querySelectorAll('[data-range]')).some(function (b) {
          return b.getAttribute('data-range') === rq;
        });
        if (known) {
          state.range = rq;
          Array.prototype.forEach.call(document.querySelectorAll('[data-range]'), function (b) {
            b.setAttribute('data-state', b.getAttribute('data-range') === rq ? 'active' : 'inactive');
          });
          elCustom.classList.toggle('show', rq === 'custom');
        }
      }
      if (qs.get('q')) { state.keyword = qs.get('q'); elSearch.value = state.keyword; }
      if (qs.get('status')) { state.status = qs.get('status'); elStatus.value = state.status; }

      apply();

      var deepId = qs.get('open');
      if (deepId) openDetail(deepId);
    })
    .catch(function (err) {
      elFooter.textContent = '数据加载失败：' + err.message;
    });
})();
