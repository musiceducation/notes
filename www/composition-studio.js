/**
 * 創作工作室 — 獨立模組，由 script.js 以 CompositionStudioFactory(deps) 建立實例。
 * 需先載入本檔，再載入 script.js（見 bootstrap-instruments.js）。
 *
 * 產品範圍（較大改版前先填清）：
 * - 目標：修 bug／新功能／GAS 與雲端備份／教學 UX — 待定
 * - 預設不移動：4/4、高音譜表、小節數與驗證規則，除非明確改規格
 * - 執行環境：本機檔案／靜態站／GAS — 待定
 *
 * 簡短稽核（hub → 創作工作室）：
 * - 入口：script.js 綁定 enterCompositionStudio → CompositionStudio.open + switchScreen
 * - 草稿：localStorage compositionStudioDraftV1；旋律經 validateMelodySequence；節奏超過上限小節數會清空節奏資料
 * - 播放／匯出：應使用 getStudioBpmFromUi() 與 STUDIO_BPM_* 一致夾住 BPM
 */
(function (global) {
    'use strict';

    global.CompositionStudioFactory = function createCompositionStudio(deps) {
        var CONFIG = deps.CONFIG;
        var MAPS = deps.MAPS;
        var getRhythmTokenDuration = deps.getRhythmTokenDuration;
        var _BEAM_TOKENS = deps.beamTokens;
        var parseRhythmTaps = deps.parseRhythmTaps;
        var _renderVexFlowBars = deps.renderVexFlowBars;
        var audio = deps.audio;
        var getState = deps.getState;
        var switchScreen = deps.switchScreen;
        var _showToast = deps.showToast;
        var gasPost = deps.gasPost;
        var renderNoteGlyph = deps.renderNoteGlyph;
        var _openLightbox = deps.openLightbox;
        var keySignatures = deps.keySignatures || [];

        var MELODY_DUR_BEATS = {
            w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25,
            wr: 4, hr: 2, qr: 1, '8r': 0.5, '16r': 0.25,
            hd: 3, qd: 1.5, '8d': 0.75, '16d': 0.375,
            hdr: 3, qdr: 1.5, '8dr': 0.75, '16dr': 0.375
        };

        /** 可調：旋律每行最多並排幾個小節（實際會依視窗寬度自動減少）。 */
        var STUDIO_MELODY_MEASURES_PER_ROW_MAX = 2;
        /** 可調：每個小節五線譜寬度（px）低於此值時改為較少小節並排或換行。 */
        var STUDIO_MELODY_MIN_STAVE_WIDTH = 120;
        /** 4/4：旋律最多小節數（與介面「最多十六小節」一致）。 */
        var STUDIO_MELODY_MAX_MEASURES = 16;
        /** 4/4：旋律總拍數上限（預設為 max 小節 × 4 拍）。 */
        var STUDIO_MELODY_MAX_BEATS = STUDIO_MELODY_MAX_MEASURES * 4;
        /** 節奏區最多小節數（與旋律上限對齊）。 */
        var STUDIO_RHYTHM_MAX_MEASURES = STUDIO_MELODY_MAX_MEASURES;
        /** BPM 滑桿與 clamp（需與 index.html #studioBpm min/max 一致，或由 ensureCompositionStudioDom 同步）。 */
        var STUDIO_BPM_MIN = 40;
        var STUDIO_BPM_MAX = 132;

        function isRestDur(d) {
            return d === 'wr' || d === 'hr' || d === 'qr' || d === '8r' || d === '16r'
                || d === 'hdr' || d === 'qdr' || d === '8dr' || d === '16dr';
        }
        function isDottedDur(d) {
            return /d(r)?$/.test(String(d || ''));
        }
        function undotDur(d) {
            return String(d || '').replace('dr', 'r').replace('d', '');
        }
        function dotDur(d) {
            var base = String(d || '');
            if (!base || isDottedDur(base)) return base;
            if (base.endsWith('r')) return base.slice(0, -1) + 'dr';
            return base + 'd';
        }
        function applyDottedModeToDur(d) {
            if (!dottedInputMode) return d;
            var dotted = dotDur(d);
            return MELODY_DUR_BEATS[dotted] != null ? dotted : d;
        }
        var STUDIO_RHYTHM_TOKENS_GROUPED = [
            {
                title: '強拍 · 完整一拍',
                tokens: [
                    { id: 'ta',    label: '四分 ta',  sub: '1 拍',   color: 'warm' },
                    { id: 'ta-a',  label: '二分 ta-a', sub: '2 拍',   color: 'warm' },
                    { id: '休',    label: '休止符',   sub: '1 拍',   color: 'cool' },
                ]
            },
            {
                title: '弱拍 · 半拍及更短',
                tokens: [
                    { id: 'ti',           label: '八分 ti',   sub: '½ 拍',  color: 'accent' },
                    { id: 'ti-ti',        label: '兩個八分',  sub: '1 拍',  color: 'accent' },
                    { id: 'ti-ti-ri',     label: '前八後十六', sub: '1 拍', color: 'accent' },
                    { id: 'ti-ri-ti',     label: '前十六後八', sub: '1 拍', color: 'accent' },
                    { id: 'ti-ri-ti-ri',  label: '四個十六分', sub: '1 拍', color: 'accent' },
                ]
            },
            {
                title: '特殊節奏 · 附點與切分',
                tokens: [
                    { id: 'ta-a-a',   label: '附點二分',  sub: '3 拍', color: 'special' },
                    { id: 'ti-ri',    label: '前附點',    sub: '1 拍', color: 'special' },
                    { id: 'ri-ti-ri', label: '小切分',    sub: '1 拍', color: 'special' },
                ]
            }
        ];

        /**
         * 內部連桿標記：這些 token 在拍點非整數位置時禁止插入，
         * 以確保連桿（Beam）永遠落在拍點邊界內。
         * 注意：「二分 ta-a」與「附點二分 ta-a-a」的 duration 為 2/3 拍，
         * 在 Kodály 教學法中不使用連桿表示，直接用符桿。
         */
        var _STUDIO_BEAM_TOKENS = new Set([
            'ti-ti', 'ti-ri-ti-ri', 'ti-ri',
            'ti-ti-ri', 'ti-ri-ti', 'ri-ti-ri'
        ]);

        var melodyNotes = [];
        var rhythmFlat = [];
        var selectedPitch = 'c/4';
        var selectedMelodyDur = 'q';
        var dottedInputMode = false;
        var activeTab = 'rhythm';
        var melodyKeySigId = 'C';
        var STUDIO_KEY_LS = 'studioMelodyKeySig';
        var STUDIO_PLAYBACK_SLACK_SEC = 0.22;
        var _studioPlaybackSession = 0;
        var _studioPlaying = false;
        var _studioActiveOscillators = [];
        var _studioPlaybackTimer = null;
        var _studioResizeTimer = null;
        var _studioRenderQueued = false;
        var _studioRenderTargetTab = '';
        var _studioMelodyBarsCacheKey = '';
        var _studioMelodyBarsCacheVal = [];
        var _studioRhythmMetricsCacheKey = '';
        var _studioRhythmMetricsCacheVal = null;
        var STUDIO_DRAFT_LS = 'compositionStudioDraftV1';
        var _studioKeybindsBound = false;
        var _studioLastRenderHash = { melody: '', rhythm: '' };
        var _studioShortcutWarned = {};
        var STUDIO_ENABLE_ADV_ENGRAVING_SHORTCUTS = false;
        var STUDIO_EXPORT_PADDING = 8;

        function vfKeyToConfigKey(vfKey) {
            var parts = String(vfKey || '').split('/');
            if (parts.length !== 2) return '';
            var n = parts[0];
            var oct = parts[1];
            return n.charAt(0).toUpperCase() + n.slice(1) + oct;
        }

        function validateMelodySequence(notes) {
            var bar = 0;
            var barCount = 0;
            for (var i = 0; i < notes.length; i++) {
                var n = notes[i];
                var b = MELODY_DUR_BEATS[n.dur];
                if (b == null || b > 4) return false;
                if (bar + b > 4 + 1e-6) {
                    if (bar > 1e-6) barCount++;
                    bar = 0;
                }
                if (bar + b > 4 + 1e-6) return false;
                bar += b;
                if (Math.abs(bar - 4) < 1e-6) {
                    barCount++;
                    bar = 0;
                }
            }
            if (bar > 1e-6) barCount++;
            if (barCount > STUDIO_MELODY_MAX_MEASURES) return false;
            var total = 0;
            for (var j = 0; j < notes.length; j++) {
                var bj = MELODY_DUR_BEATS[notes[j].dur];
                if (bj == null) return false;
                total += bj;
            }
            return total <= STUDIO_MELODY_MAX_BEATS + 1e-6;
        }

        function melodyStateKey(notes) {
            var out = [];
            for (var i = 0; i < notes.length; i++) {
                var n = notes[i] || {};
                out.push(String(n.keys || '') + '|' + String(n.dur || '') + '|' + (n.rest ? '1' : '0'));
            }
            return out.join('\u0001');
        }

        function computeRhythmMetrics(flat) {
            var out = [];
            var cur = [];
            var beats = 0;
            var complete = 0;
            for (var i = 0; i < flat.length; i++) {
                var t = flat[i];
                var d = getRhythmTokenDuration(t);
                if (beats + d > 4 + 1e-6) {
                    out.push(cur.join(' ').trim());
                    cur = [];
                    beats = 0;
                }
                cur.push(t);
                beats += d;
                if (Math.abs(beats - 4) < 1e-6) {
                    out.push(cur.join(' ').trim());
                    cur = [];
                    beats = 0;
                    complete++;
                }
            }
            if (cur.length) out.push(cur.join(' ').trim());
            return { barStrings: out, tailBeats: beats, completeBars: complete };
        }

        function rhythmMetrics(flat) {
            var key = flat.join('\u0001');
            if (flat === rhythmFlat && _studioRhythmMetricsCacheVal && _studioRhythmMetricsCacheKey === key) {
                return _studioRhythmMetricsCacheVal;
            }
            var metrics = computeRhythmMetrics(flat);
            if (flat === rhythmFlat) {
                _studioRhythmMetricsCacheKey = key;
                _studioRhythmMetricsCacheVal = metrics;
            }
            return metrics;
        }

        function melodyToBars() {
            var src = melodyNotes;
            var key = melodyStateKey(src);
            if (_studioMelodyBarsCacheKey === key) return _studioMelodyBarsCacheVal;
            var notes = melodyNotes.filter(function (n) {
                return MELODY_DUR_BEATS[n.dur] != null;
            });
            if (notes.length !== melodyNotes.length) {
                console.warn('[composition-studio] 略過 ' + (melodyNotes.length - notes.length) + ' 個未知時值音符');
            }
            var bars = [];
            var cur = [];
            var sum = 0;
            var REST_FILLERS = [
                { beats: 2, dur: 'hr' },
                { beats: 1, dur: 'qr' },
                { beats: 0.5, dur: '8r' },
                { beats: 0.25, dur: '16r' }
            ];
            function fillBarToFourBeats(bar, beatsUsed) {
                var out = bar.slice();
                var remain = Math.max(0, 4 - beatsUsed);
                while (remain > 1e-6) {
                    var chosen = null;
                    for (var fi = 0; fi < REST_FILLERS.length; fi++) {
                        if (REST_FILLERS[fi].beats <= remain + 1e-6) {
                            chosen = REST_FILLERS[fi];
                            break;
                        }
                    }
                    if (!chosen) break;
                    out.push({ keys: 'b/4', dur: chosen.dur, rest: true });
                    remain -= chosen.beats;
                }
                return out;
            }
            for (var i = 0; i < notes.length; i++) {
                var n = notes[i];
                var b = MELODY_DUR_BEATS[n.dur];
                if (sum + b > 4 + 1e-6) {
                    if (cur.length) bars.push(fillBarToFourBeats(cur, sum));
                    cur = [];
                    sum = 0;
                }
                cur.push(n);
                sum += b;
                if (Math.abs(sum - 4) < 1e-6) {
                    bars.push(cur);
                    cur = [];
                    sum = 0;
                }
            }
            if (cur.length) bars.push(fillBarToFourBeats(cur, sum));
            _studioMelodyBarsCacheKey = key;
            _studioMelodyBarsCacheVal = bars;
            return bars;
        }

        /** Split melody into bars using only user notes — no auto-filled rests (for repeat-measure UX). */
        function melodyBarsRaw() {
            var notes = melodyNotes.filter(function (n) {
                return MELODY_DUR_BEATS[n.dur] != null;
            });
            var bars = [];
            var cur = [];
            var sum = 0;
            for (var i = 0; i < notes.length; i++) {
                var n = notes[i];
                var b = MELODY_DUR_BEATS[n.dur];
                if (sum + b > 4 + 1e-6) {
                    if (cur.length) bars.push(cur);
                    cur = [];
                    sum = 0;
                }
                cur.push(n);
                sum += b;
                if (Math.abs(sum - 4) < 1e-6) {
                    bars.push(cur);
                    cur = [];
                    sum = 0;
                }
            }
            if (cur.length) bars.push(cur);
            return bars;
        }

        function flatToRhythmBarStrings(flat) {
            return rhythmMetrics(flat).barStrings.slice();
        }

        function rhythmTailBarBeats(flat) {
            return rhythmMetrics(flat).tailBeats;
        }

        function rhythmCompleteBarCount(flat) {
            return rhythmMetrics(flat).completeBars;
        }

        function canAddRhythmToken(flat, tok) {
            var d = getRhythmTokenDuration(tok);
            var barBeats = rhythmTailBarBeats(flat);
            var onBeat = Math.abs(barBeats - Math.round(barBeats)) < 0.01;
            if (barBeats + d > 4 + 1e-6) {
                if (rhythmCompleteBarCount(flat) >= 8) return false;
                barBeats = 0;
                onBeat = true;
            }
            if (barBeats + d > 4 + 1e-6) return false;
            if (!onBeat && _STUDIO_BEAM_TOKENS.has(tok)) return false;
            var next = flat.concat([tok]);
            return flatToRhythmBarStrings(next).length <= 8;
        }

        function updateRhythmStatus() {
            var el = document.getElementById('studioRhythmStatus');
            if (!el) return;
            var tail = rhythmTailBarBeats(rhythmFlat);
            var complete = rhythmCompleteBarCount(rhythmFlat);
            var tailStr = Number.isInteger(tail) ? String(tail) : String(Math.round(tail * 100) / 100);
            if (complete >= 8 && tail < 1e-6) {
                el.textContent = '已寫滿八小節（共 8 小節）';
            } else {
                el.textContent = '進行中小節：已用 ' + tailStr + ' / 4 拍 · 已完成 ' + complete + ' / 8 小節';
            }

            // Disable rhythm buttons that can't be added under current bar/beat constraints.
            var pal = document.getElementById('studioRhythmPalette');
            if (pal) {
                pal.querySelectorAll('.studio-rtok').forEach(function (btn) {
                    var tok = btn.dataset.tok;
                    if (!tok) return;
                    btn.disabled = !canAddRhythmToken(rhythmFlat, tok);
                });
            }
        }

        function chunkBarsForStudioSystems(bars, perRow) {
            var rows = [];
            var n = perRow || STUDIO_MELODY_MEASURES_PER_ROW_MAX;
            for (var i = 0; i < bars.length; i += n) {
                rows.push(bars.slice(i, i + n));
            }
            return rows;
        }

        function estimateMelodyMinStaveWidth(bars) {
            var minW = STUDIO_MELODY_MIN_STAVE_WIDTH;
            if (!bars || !bars.length) return minW;
            var densest = minW;
            for (var i = 0; i < bars.length; i++) {
                var bar = bars[i] || [];
                var noteCount = bar.length;
                var fastCount = 0;
                for (var j = 0; j < bar.length; j++) {
                    var d = bar[j] && bar[j].dur;
                    if (d === '16' || d === '16r') fastCount++;
                }
                // Dense bars (especially many 16ths) need wider stave to avoid glyph overlap/clipping.
                var need = 92 + noteCount * 11 + fastCount * 8;
                if (need > densest) densest = need;
            }
            return Math.max(minW, Math.min(340, densest));
        }

        function computeMelodyMeasuresPerRow(barCount, containerWidth, minStaveWidth) {
            var W = Math.max(containerWidth || 360, 280);
            var LEFT_PAD = 10;
            var RIGHT_PAD = 10;
            var GAP = 4;
            var avail = W - LEFT_PAD - RIGHT_PAD;
            var maxPer = Math.min(STUDIO_MELODY_MEASURES_PER_ROW_MAX, Math.max(1, barCount));
            var minW = Math.max(STUDIO_MELODY_MIN_STAVE_WIDTH, minStaveWidth || STUDIO_MELODY_MIN_STAVE_WIDTH);
            var p;
            for (p = maxPer; p >= 1; p--) {
                var staveW = (avail - GAP * (p - 1)) / p;
                if (staveW >= minW) return p;
            }
            return 1;
        }

        function renderMelody() {
            var el = document.getElementById('studioMelodyVf');
            if (!el || typeof VexFlow === 'undefined') return;
            el.innerHTML = '';
            var bars = melodyToBars();
            if (!bars.length) {
                el.innerHTML = '<p class="studio-hint" style="margin:28px 12px;text-align:center">尚無音符 · 點鋼琴鍵加入音高</p>';
                return;
            }
            var VF = VexFlow;
            var Renderer = VF.Renderer;
            var Stave = VF.Stave;
            var StaveNote = VF.StaveNote;
            var Beam = VF.Beam;
            var Fraction = VF.Fraction;
            var Voice = VF.Voice;
            var Formatter = VF.Formatter;
            var W = Math.max(el.clientWidth || 360, 280);
            var LEFT_PAD = 10;
            var RIGHT_PAD = 10;
            var GAP = 4;
            var avail = W - LEFT_PAD - RIGHT_PAD;
            var STAVE_H = 108;
            var minStaveWidth = estimateMelodyMinStaveWidth(bars);
            var perRow = computeMelodyMeasuresPerRow(bars.length, W, minStaveWidth);
            var systems = chunkBarsForStudioSystems(bars, perRow);
            var totalH = systems.length * STAVE_H + 20;
            var renderer = new Renderer(el, Renderer.Backends.SVG);
            renderer.resize(W, totalH);
            var context = renderer.getContext();
            var globalBi = 0;
            var totalMeasures = bars.length;
            var BarlineType = VF.BarlineType || (VF.Barline && VF.Barline.type);

            systems.forEach(function (rowBars, rowIdx) {
                var nInRow = rowBars.length;
                var staveW = (avail - GAP * (nInRow - 1)) / nInRow;
                var x = LEFT_PAD;
                var y = rowIdx * STAVE_H + 10;

                rowBars.forEach(function (barNotes) {
                    var stave = new Stave(x, y, staveW);
                    if (globalBi === 0) {
                        stave.addClef('treble');
                        var kSig = getMelodyKeyIdFromUi();
                        if (kSig && kSig !== 'C') {
                            try { stave.addKeySignature(kSig); } catch (ksErr) { console.warn('studio keysig', ksErr); }
                        }
                        stave.addTimeSignature('4/4');
                    }
                    if (BarlineType) {
                        try {
                            stave.setBegBarType(BarlineType.NONE);
                            var isPieceEnd = globalBi === totalMeasures - 1;
                            stave.setEndBarType(isPieceEnd ? BarlineType.END : BarlineType.SINGLE);
                        } catch (eb) { /* ignore */ }
                    }
                    stave.setContext(context).draw();

                    var vfNotes = [];
                    barNotes.forEach(function (n) {
                        var rest = n.rest === true || isRestDur(n.dur);
                        var baseDur = undotDur(n.dur);
                        var dotted = isDottedDur(n.dur);
                        var sn;
                        if (rest) {
                            sn = new StaveNote({
                                clef: 'treble',
                                keys: ['b/4'],
                                duration: baseDur
                            });
                        } else {
                            var keyStr = melodyNoteVfKey(n);
                            var midi = vfKeyToMidi(keyStr);
                            var stemDirection = (midi != null && midi >= 71) ? -1 : 1;
                            if (n.flipStem) stemDirection = stemDirection === 1 ? -1 : 1;
                            sn = new StaveNote({
                                clef: 'treble',
                                keys: [keyStr],
                                duration: baseDur,
                                stemDirection: stemDirection
                            });
                        }
                        if (dotted) {
                            try { sn.addDotToAll(); } catch (e) { /* ignore */ }
                        }
                        vfNotes.push(sn);
                    });

                    var voice = new Voice({ numBeats: 4, beatValue: 4 });
                    voice.setMode(2);
                    voice.addTickables(vfNotes);
                    var fmtW = staveW - (globalBi === 0 ? 92 : 26);
                    new Formatter().joinVoices([voice]).format([voice], Math.max(56, fmtW));
                    var beamInst = [];
                    try {
                        // Sibelius-like grouping checklist (4/4): 8+8, 16x4, mixed 8/16 with rests.
                        // Use beat groups to avoid cross-beat over-beaming.
                        beamInst = Beam.generateBeams(vfNotes, {
                            groups: [new Fraction(1, 4)],
                            beam_rests: false,
                            show_stemlets: false,
                            maintain_stem_directions: true,
                            secondary_breaks: false
                        }) || [];
                    } catch (bgErr) {
                        beamInst = [];
                    }
                    beamInst.forEach(function (bm) {
                        try {
                            if (bm.renderOptions) bm.renderOptions.beamWidth = 3.5;
                            bm.setContext(context);
                        } catch (e) { /* ignore */ }
                    });
                    voice.draw(context, stave);
                    beamInst.forEach(function (bm) {
                        try { bm.draw(); } catch (e) { /* ignore */ }
                    });

                    globalBi++;
                    x += staveW + GAP;
                });
            });
        }

        function renderRhythm() {
            var el = document.getElementById('studioRhythmVf');
            if (!el) return;
            if (!rhythmFlat.length) {
                el.innerHTML = '<p class="studio-hint" style="margin:28px 12px;text-align:center">點選節奏塊加入 · 每小節須滿 4 拍才會進入下一小節 · 最多八小節 · 每行最多兩小節</p>';
                updateRhythmStatus();
                return;
            }
            var barStrings = flatToRhythmBarStrings(rhythmFlat);
            if (typeof VexFlow !== 'undefined') {
                try {
                    _renderVexFlowBars(barStrings, el);
                } catch (e) {
                    console.warn('VexFlow rhythm render', e);
                    el.textContent = '';
                }
            }
            updateRhythmStatus();
        }

        function requestStudioRender(tab) {
            _studioRenderTargetTab = tab || activeTab;
            if (_studioRenderQueued) return;
            _studioRenderQueued = true;
            requestAnimationFrame(function () {
                _studioRenderQueued = false;
                var target = _studioRenderTargetTab || activeTab;
                // Prevent unexpected browser focus/scroll jumps when VexFlow re-renders.
                var prevScrollX = window.scrollX || window.pageXOffset || 0;
                var prevScrollY = window.scrollY || window.pageYOffset || 0;
                var scr = document.getElementById('screen-composition-studio');
                if (!scr || !scr.classList.contains('active')) return;
                if (target === 'melody') {
                    var melodyHost = document.getElementById('studioMelodyVf');
                    var melodyHash = [
                        melodyStateKey(melodyNotes),
                        getMelodyKeyIdFromUi(),
                        String(Math.max((melodyHost && melodyHost.clientWidth) || 0, 0)),
                        String(dottedInputMode ? 1 : 0),
                        scr.classList.contains('studio-demo-mode') ? '1' : '0'
                    ].join('|');
                    if (_studioLastRenderHash.melody === melodyHash) return;
                    _studioLastRenderHash.melody = melodyHash;
                    renderMelody();
                } else {
                    var rhythmHost = document.getElementById('studioRhythmVf');
                    var rhythmHash = [
                        rhythmFlat.join('\u0001'),
                        String(Math.max((rhythmHost && rhythmHost.clientWidth) || 0, 0)),
                        scr.classList.contains('studio-demo-mode') ? '1' : '0'
                    ].join('|');
                    if (_studioLastRenderHash.rhythm === rhythmHash) return;
                    _studioLastRenderHash.rhythm = rhythmHash;
                    renderRhythm();
                }
                // Restore scroll position after DOM update.
                requestAnimationFrame(function () {
                    window.scrollTo(prevScrollX, prevScrollY);
                });
            });
        }

        function invalidateRenderCache(tab) {
            if (!tab || tab === 'melody') _studioLastRenderHash.melody = '';
            if (!tab || tab === 'rhythm') _studioLastRenderHash.rhythm = '';
        }

        function updateDottedBadgeUi() {
            var badge = document.getElementById('studioDottedBadge');
            if (!badge) return;
            badge.textContent = dottedInputMode ? '附點模式：開' : '附點模式：關';
            badge.classList.toggle('is-on', !!dottedInputMode);
        }

        function notifyShortcutNoopOnce(key, text) {
            if (_studioShortcutWarned[key]) return;
            _studioShortcutWarned[key] = true;
            _showToast(text, 'warn');
        }

        function getStudioBpmFromUi() {
            var bpmEl = document.getElementById('studioBpm');
            var bpm = parseInt(bpmEl && bpmEl.value, 10) || 72;
            return Math.max(STUDIO_BPM_MIN, Math.min(STUDIO_BPM_MAX, bpm));
        }

        function saveStudioDraft() {
            try {
                var payload = {
                    tab: activeTab,
                    bpm: getStudioBpmFromUi(),
                    selectedMelodyDur: selectedMelodyDur,
                    dottedInputMode: !!dottedInputMode,
                    selectedPitch: selectedPitch,
                    melodyKeySigId: melodyKeySigId,
                    melodyNotes: melodyNotes.slice(),
                    rhythmFlat: rhythmFlat.slice(),
                    ts: Date.now()
                };
                localStorage.setItem(STUDIO_DRAFT_LS, JSON.stringify(payload));
            } catch (e) { /* ignore */ }
        }

        function normalizeLoadedMelodyNotes(notes) {
            if (!Array.isArray(notes)) return [];
            var out = [];
            for (var i = 0; i < notes.length; i++) {
                var n = notes[i] || {};
                var dur = String(n.dur || '');
                if (MELODY_DUR_BEATS[dur] == null) continue;
                var rest = !!n.rest || isRestDur(dur);
                var key = rest ? 'b/4' : String(n.keys || '');
                if (!rest && !/^[a-g](#|##|b|bb|n)?\/-?\d+$/i.test(key)) continue;
                out.push({ keys: key, dur: dur, rest: rest });
            }
            return out;
        }

        function loadStudioDraft() {
            try {
                var raw = localStorage.getItem(STUDIO_DRAFT_LS);
                if (!raw) return;
                var draft = JSON.parse(raw);
                if (!draft || typeof draft !== 'object') return;
                var loadedMelody = normalizeLoadedMelodyNotes(draft.melodyNotes);
                if (validateMelodySequence(loadedMelody)) melodyNotes = loadedMelody;
                if (Array.isArray(draft.rhythmFlat)) {
                    rhythmFlat = draft.rhythmFlat.filter(function (tok) {
                        return getRhythmTokenDuration(tok) > 0;
                    });
                    if (flatToRhythmBarStrings(rhythmFlat).length > STUDIO_RHYTHM_MAX_MEASURES) rhythmFlat = [];
                }
                if (typeof draft.selectedPitch === 'string' && draft.selectedPitch) selectedPitch = draft.selectedPitch;
                if (typeof draft.selectedMelodyDur === 'string' && MELODY_DUR_BEATS[draft.selectedMelodyDur] != null) {
                    selectedMelodyDur = draft.selectedMelodyDur;
                }
                dottedInputMode = draft.dottedInputMode === true;
                if (typeof draft.tab === 'string' && (draft.tab === 'melody' || draft.tab === 'rhythm')) activeTab = draft.tab;
                if (typeof draft.melodyKeySigId === 'string' && draft.melodyKeySigId) melodyKeySigId = draft.melodyKeySigId;

                var bpmEl = document.getElementById('studioBpm');
                var bpmVal = document.getElementById('studioBpmVal');
                var bpm = parseInt(draft.bpm, 10);
                if (bpmEl && !isNaN(bpm)) {
                    var clamped = Math.max(STUDIO_BPM_MIN, Math.min(STUDIO_BPM_MAX, bpm));
                    bpmEl.value = String(clamped);
                    if (bpmVal) bpmVal.textContent = String(clamped);
                }
                updateDottedBadgeUi();
            } catch (e) { /* ignore */ }
        }

        function scheduleMelodyTone(startTime, freqKey, durSec) {
            if (!audio.ctx || !CONFIG.NOTE_FREQUENCIES[freqKey]) return;
            var g = audio.getSfxGain();
            var osc = audio.ctx.createOscillator();
            var gain = audio.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = CONFIG.NOTE_FREQUENCIES[freqKey];
            osc.connect(gain);
            gain.connect(audio.ctx.destination);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.38 * g, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + Math.max(0.12, durSec));
            osc.start(startTime);
            osc.stop(startTime + Math.max(0.15, durSec) + 0.03);
            _studioActiveOscillators.push(osc);
        }

        function scheduleRhythmTick(startTime) {
            if (!audio.ctx) return;
            var g = audio.getSfxGain();
            var osc = audio.ctx.createOscillator();
            var gn = audio.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = 920;
            gn.gain.setValueAtTime(0.2 * g, startTime);
            gn.gain.exponentialRampToValueAtTime(0.001, startTime + 0.07);
            osc.connect(gn);
            gn.connect(audio.ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.08);
            _studioActiveOscillators.push(osc);
        }

        function setPlayButtonState(isPlaying) {
            var btn = document.getElementById('studioPlayBtn');
            if (!btn) return;
            var icon = isPlaying ? 'pause' : 'play';
            var text = isPlaying ? '播放中…' : '播放';
            btn.innerHTML = '<i data-lucide="' + icon + '"></i> ' + text;
            btn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
            if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        }

        function stopPlaybackSession(silent) {
            _studioPlaybackSession++;
            _studioPlaying = false;
            if (_studioPlaybackTimer) {
                clearTimeout(_studioPlaybackTimer);
                _studioPlaybackTimer = null;
            }
            for (var i = 0; i < _studioActiveOscillators.length; i++) {
                var osc = _studioActiveOscillators[i];
                try { osc.stop(0); } catch (e) { /* ignore */ }
                try { osc.disconnect(); } catch (e2) { /* ignore */ }
            }
            _studioActiveOscillators = [];
            setPlayButtonState(false);
            if (!silent) _showToast('已停止播放', 'success');
        }

        function beginPlaybackSession(estimatedDurationSec) {
            _studioPlaying = true;
            setPlayButtonState(true);
            if (_studioPlaybackTimer) clearTimeout(_studioPlaybackTimer);
            _studioPlaybackTimer = setTimeout(function () {
                stopPlaybackSession(true);
            }, Math.max(180, Math.round(estimatedDurationSec * 1000)));
        }

        function playPreview() {
            if (_studioPlaying) stopPlaybackSession(true);
            audio.init();
            return audio.warmUp().then(function () {
                if (!audio.ctx) {
                    _showToast('無法播放音訊', 'warn');
                    return;
                }
                var sessionId = ++_studioPlaybackSession;
                var bpm = getStudioBpmFromUi();
                var spb = 60 / bpm;
                var totalBeatsScheduled = 0;
                if (activeTab === 'melody') {
                    var bars = melodyToBars();
                    if (!bars.length) {
                        _showToast('請先加入音符', 'warn');
                        return;
                    }
                    var t = audio.ctx.currentTime + 0.1;
                    for (var bi = 0; bi < bars.length; bi++) {
                        var bar = bars[bi];
                        for (var ni = 0; ni < bar.length; ni++) {
                            var n = bar[ni];
                            var beats = MELODY_DUR_BEATS[n.dur];
                            if (beats == null) {
                                console.warn('[composition-studio] 播放略過未知時值', n.dur);
                                beats = 0;
                            }
                            var rest = n.rest === true || isRestDur(n.dur);
                            if (!rest) {
                                var ck = vfKeyToConfigKey(n.keys);
                                var noteDur = Math.max(0.15, beats * spb * 0.92);
                                if (CONFIG.NOTE_FREQUENCIES[ck]) scheduleMelodyTone(t, ck, noteDur);
                            }
                            t += beats * spb;
                            totalBeatsScheduled += beats;
                        }
                    }
                } else {
                    var barStrings = flatToRhythmBarStrings(rhythmFlat);
                    if (!barStrings.length) {
                        _showToast('請先加入節奏', 'warn');
                        return;
                    }
                    var t2 = audio.ctx.currentTime + 0.1;
                    for (var si = 0; si < barStrings.length; si++) {
                        var bs = barStrings[si];
                        var parsed = parseRhythmTaps(bs);
                        var taps = parsed.taps;
                        var totalBeats = parsed.totalBeats;
                        for (var ti = 0; ti < taps.length; ti++) {
                            scheduleRhythmTick(t2 + taps[ti] * spb);
                        }
                        t2 += (totalBeats || 4) * spb;
                        totalBeatsScheduled += (totalBeats || 4);
                    }
                }
                if (sessionId !== _studioPlaybackSession) return;
                beginPlaybackSession(totalBeatsScheduled * spb + STUDIO_PLAYBACK_SLACK_SEC);
            });
        }

        function getActiveSvg() {
            var sel = activeTab === 'melody' ? '#studioMelodyVf svg' : '#studioRhythmVf svg';
            return document.querySelector(sel);
        }

        function normalizeSvgForExport(svg) {
            if (!svg) return null;
            var clone = svg.cloneNode(true);
            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
            clone.style.maxWidth = 'none';
            clone.style.width = '';
            clone.style.height = '';
            clone.style.display = 'block';

            var vb = clone.getAttribute('viewBox');
            var width = parseFloat(clone.getAttribute('width'));
            var height = parseFloat(clone.getAttribute('height'));
            if ((!width || !height) && vb) {
                var vbp = vb.split(/\s+/).map(function (x) { return parseFloat(x); });
                if (vbp.length === 4 && !isNaN(vbp[2]) && !isNaN(vbp[3])) {
                    width = width || vbp[2];
                    height = height || vbp[3];
                }
            }
            if (!width || !height) {
                try {
                    var b = svg.getBBox();
                    width = width || Math.max(1, Math.ceil(b.width));
                    height = height || Math.max(1, Math.ceil(b.height));
                } catch (e) {
                    width = width || 800;
                    height = height || 220;
                }
            }

            var pad = STUDIO_EXPORT_PADDING;
            clone.setAttribute('width', String(width + pad * 2));
            clone.setAttribute('height', String(height + pad * 2));
            clone.setAttribute('viewBox', (-pad) + ' ' + (-pad) + ' ' + (width + pad * 2) + ' ' + (height + pad * 2));
            return clone;
        }

        function serializedActiveSvgForExport() {
            var svg = getActiveSvg();
            if (!svg) return null;
            var normalized = normalizeSvgForExport(svg);
            if (!normalized) return null;
            return new XMLSerializer().serializeToString(normalized);
        }

        function downloadSvgFile() {
            var ser = serializedActiveSvgForExport();
            if (!ser) {
                _showToast('沒有可匯出的譜面', 'warn');
                return;
            }
            var blob = new Blob([ser], { type: 'image/svg+xml;charset=utf-8' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            var tag = activeTab === 'melody' ? '旋律' : '節奏';
            a.href = url;
            a.download = '創作工作室-' + tag + '-' + Date.now() + '.svg';
            a.click();
            URL.revokeObjectURL(url);
            _showToast('已下載 SVG', 'success');
        }

        function downloadPngFile() {
            var ser = serializedActiveSvgForExport();
            if (!ser) {
                _showToast('沒有可匯出的譜面', 'warn');
                return;
            }
            var blob = new Blob([ser], { type: 'image/svg+xml' });
            var url = URL.createObjectURL(blob);
            var img = new Image();
            var tag = activeTab === 'melody' ? '旋律' : '節奏';
            img.onload = function () {
                var w = img.naturalWidth || img.width || 400;
                var h = img.naturalHeight || img.height || 200;
                var scale = Math.max(1.5, Math.min(3, 1600 / Math.max(1, w)));
                var canvas = document.createElement('canvas');
                canvas.width = w * scale;
                canvas.height = h * scale;
                var ctx = canvas.getContext('2d');
                ctx.scale(scale, scale);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
                canvas.toBlob(function (b) {
                    if (!b) {
                        _showToast('PNG 匯出失敗', 'warn');
                        return;
                    }
                    var u = URL.createObjectURL(b);
                    var a = document.createElement('a');
                    a.href = u;
                    a.download = '創作工作室-' + tag + '-' + Date.now() + '.png';
                    a.click();
                    URL.revokeObjectURL(u);
                    _showToast('已下載 PNG', 'success');
                }, 'image/png');
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                _showToast('PNG 匯出失敗', 'warn');
            };
            img.src = url;
        }

        function buildJsonPayload() {
            var bpm = getStudioBpmFromUi();
            if (activeTab === 'melody') {
                return {
                    type: 'melody',
                    bpm: bpm,
                    meter: '4/4',
                    clef: 'treble',
                    key: getMelodyKeyIdFromUi(),
                    notes: melodyNotes.map(function (n) {
                        return { keys: n.keys, dur: n.dur, rest: !!n.rest };
                    })
                };
            }
            return {
                type: 'rhythm',
                bpm: bpm,
                meter: '4/4',
                tokens: rhythmFlat.slice()
            };
        }

        function copyJson() {
            var text = JSON.stringify(buildJsonPayload(), null, 0);
            return navigator.clipboard.writeText(text).then(function () {
                _showToast('已複製到剪貼簿', 'success');
            }).catch(function () {
                _showToast('複製失敗，請手動選取', 'warn');
            });
        }

        function tryShare() {
            var payload = buildJsonPayload();
            var text = JSON.stringify(payload);
            if (navigator.share) {
                return navigator.share({
                    title: '創作工作室',
                    text: '我的音樂創作資料：\n' + text,
                    url: window.location.href
                }).catch(function (e) {
                    if (e.name !== 'AbortError') return copyJson();
                });
            }
            return copyJson();
        }

        function uploadBackup() {
            var user = getState().currentUser;
            if (!user || !user.name) {
                _showToast('請先於主頁登入', 'warn');
                return Promise.resolve();
            }
            var jsonStr = JSON.stringify(buildJsonPayload());
            var rec = {
                action: 'saveComposition',
                name: user.name,
                grade: user.grade,
                class: user.class,
                id: user.id || user.seat || '',
                tab: activeTab,
                keySig: activeTab === 'melody' ? getMelodyKeyIdFromUi() : '',
                json: jsonStr.slice(0, 48000),
                timestamp: new Date().toLocaleString('zh-TW')
            };
            if (typeof gasPost !== 'function') {
                _showToast('備份上傳未設定', 'warn');
                return Promise.resolve();
            }
            return gasPost(rec).then(function (r) {
                if (r && r.ok) _showToast('✅ 備份已寫入試算表', 'success');
                else _showToast('備份失敗：' + ((r && r.error) || '未知'), 'warn');
            }).catch(function (err) {
                console.error(err);
                _showToast('備份時發生錯誤，請稍後再試', 'warn');
            });
        }

        function setTab(tab) {
            if (tab !== activeTab && _studioPlaying) stopPlaybackSession(true);
            activeTab = tab;
            // Layout switching hooks for CSS (melody-like DAW layout)
            var screen = document.getElementById('screen-composition-studio');
            if (screen) {
                screen.classList.toggle('studio-mode-melody', tab === 'melody');
                screen.classList.toggle('studio-mode-rhythm', tab === 'rhythm');
            }
            document.querySelectorAll('.studio-tab').forEach(function (b) {
                var on = b.dataset.studioTab === tab;
                b.classList.toggle('active', on);
                b.setAttribute('aria-selected', on ? 'true' : 'false');
            });
            var pm = document.getElementById('studioPanelMelody');
            var pr = document.getElementById('studioPanelRhythm');
            if (pm) pm.style.display = tab === 'melody' ? '' : 'none';
            if (pr) pr.style.display = tab === 'rhythm' ? '' : 'none';
            var shareBtn = document.getElementById('studioShareBtn');
            if (shareBtn) shareBtn.style.display = navigator.share ? '' : 'none';
            invalidateRenderCache(tab);
            requestStudioRender(tab);
            saveStudioDraft();
            if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        }

        function undo() {
            if (activeTab === 'melody') {
                melodyNotes.pop();
                invalidateRenderCache('melody');
                requestStudioRender('melody');
            } else {
                rhythmFlat.pop();
                invalidateRenderCache('rhythm');
                requestStudioRender('rhythm');
            }
            saveStudioDraft();
        }

        function clearAll() {
            if (activeTab === 'melody') {
                melodyNotes = [];
                invalidateRenderCache('melody');
                requestStudioRender('melody');
            } else {
                rhythmFlat = [];
                invalidateRenderCache('rhythm');
                requestStudioRender('rhythm');
            }
            saveStudioDraft();
        }

        function letterOctToMidi(letter, octave) {
            var U = String(letter || '').toUpperCase().charAt(0);
            var pcMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
            var pc = pcMap[U];
            if (pc === undefined) return null;
            var o = parseInt(octave, 10);
            if (isNaN(o)) return null;
            return (o + 1) * 12 + pc;
        }

        function midiToVfKey(midi) {
            var names = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
            var pc = midi % 12;
            var oct = Math.floor(midi / 12) - 1;
            return names[pc] + '/' + oct;
        }

        /** VexFlow 音名（含 #／b）+ 八度 → MIDI；供符桿方向用 */
        function vfKeyToMidi(vfKey) {
            var raw = Array.isArray(vfKey) ? (vfKey[0] || '') : vfKey;
            var parts = String(raw || '').trim().split('/');
            if (parts.length !== 2) return null;
            var name = String(parts[0]).toLowerCase().replace(/\s/g, '');
            var oct = parseInt(parts[1], 10);
            if (isNaN(oct)) return null;
            var m = name.match(/^([a-g])(n|#|##|b|bb)?$/);
            if (!m) return null;
            var base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1]];
            if (base === undefined) return null;
            var acc = m[2] || '';
            var pc = base + (acc === '#' ? 1 : acc === '##' ? 2 : acc === 'b' ? -1 : acc === 'bb' ? -2 : acc === 'n' ? 0 : 0);
            pc = ((pc % 12) + 12) % 12;
            return (oct + 1) * 12 + pc;
        }

        function melodyNoteVfKey(n) {
            var k = n.keys;
            if (Array.isArray(k)) return k[0] || '';
            return k || '';
        }

        function getMelodyKeyIdFromUi() {
            var sel = document.getElementById('studioKeySig');
            if (sel && sel.value) return sel.value;
            return melodyKeySigId;
        }

        function vfKeyToLabel(vf) {
            var parts = String(vf || '').split('/');
            if (parts.length !== 2) return vf;
            var n = parts[0];
            return n.charAt(0).toUpperCase() + n.slice(1) + parts[1];
        }

        function durationLabelFromMdur(mdur) {
            var map = {
                w: '全音符', h: '二分音符', q: '四分音符', '8': '八分音符', '16': '十六分音符',
                wr: '全休止', hr: '二分休止', qr: '四分休止', '8r': '八分休止', '16r': '十六分休止',
                hd: '附點二分音符', qd: '附點四分音符', '8d': '附點八分音符', '16d': '附點十六分音符',
                hdr: '附點二分休止', qdr: '附點四分休止', '8dr': '附點八分休止', '16dr': '附點十六分休止'
            };
            return map[mdur] || String(mdur || '');
        }

        function updateInputHudUi() {
            var elDur = document.getElementById('studioHudDur');
            var elDot = document.getElementById('studioHudDot');
            var elPitch = document.getElementById('studioHudPitch');
            var dur = applyDottedModeToDur(selectedMelodyDur);
            if (elDur) elDur.textContent = durationLabelFromMdur(dur);
            if (elDot) elDot.textContent = dottedInputMode ? '開' : '關';
            if (elPitch) elPitch.textContent = vfKeyToLabel(selectedPitch || 'c/4');
        }

        function isWhitePitchClass(pc) {
            return [0, 2, 4, 5, 7, 9, 11].indexOf(pc) >= 0;
        }

        function isBlackPitchClass(pc) {
            return [1, 3, 6, 8, 10].indexOf(pc) >= 0;
        }

        function whiteIndexBeforeBlack(whiteMidis, blackMidi) {
            var idx = -1;
            for (var i = 0; i < whiteMidis.length; i++) {
                if (whiteMidis[i] < blackMidi) idx = i;
                else break;
            }
            return idx;
        }

        function applyPitchKeyboardSelection(host, vfkey, targetBtn) {
            host.querySelectorAll('.studio-piano-key').forEach(function (b) {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            if (targetBtn) {
                targetBtn.classList.add('active');
                targetBtn.setAttribute('aria-pressed', 'true');
            }
            selectedPitch = vfkey;
            updateInputHudUi();
        }

        function appendMelodyFromPiano(host, vfk, targetBtn) {
            applyPitchKeyboardSelection(host, vfk, targetBtn);
            var dur = applyDottedModeToDur(selectedMelodyDur);
            var rest = isRestDur(dur);
            var note = rest
                ? { keys: 'b/4', dur: dur, rest: true }
                : { keys: selectedPitch, dur: dur, rest: false };
            var next = melodyNotes.concat([note]);
            if (!validateMelodySequence(next)) {
                _showToast('無法加入：請填滿小節或已達十六小節上限', 'warn');
                return;
            }
            melodyNotes = next;
            invalidateRenderCache('melody');
            requestStudioRender('melody');
            saveStudioDraft();
            if (audio.playClick) audio.playClick('select');
        }

        function appendMelodyNote(note) {
            var next = melodyNotes.concat([note]);
            if (!validateMelodySequence(next)) {
                _showToast('無法加入：請填滿小節或已達十六小節上限', 'warn');
                return false;
            }
            melodyNotes = next;
            invalidateRenderCache('melody');
            requestStudioRender('melody');
            saveStudioDraft();
            return true;
        }

        function setSelectedMelodyDurationFromChipDur(mdur) {
            var row = document.getElementById('studioMelodyDurRow');
            if (!row) return false;
            var chip = row.querySelector('.studio-chip[data-mdur="' + mdur + '"]');
            if (!chip) return false;
            row.querySelectorAll('.studio-chip').forEach(function (c) { c.classList.remove('active'); });
            chip.classList.add('active');
            selectedMelodyDur = chip.dataset.mdur;
            updateInputHudUi();
            saveStudioDraft();
            return true;
        }

        function applyPitchByVfKey(vfKey) {
            var host = document.getElementById('studioPitchRow');
            if (!host) return false;
            var btn = host.querySelector('.studio-piano-key[data-vfkey="' + vfKey + '"]');
            if (!btn || btn.disabled || btn.classList.contains('studio-piano-key--disabled')) return false;
            applyPitchKeyboardSelection(host, vfKey, btn);
            saveStudioDraft();
            return true;
        }

        function appendMelodyByLetter(letter) {
            var parts = String(selectedPitch || 'c/4').split('/');
            var oct = parts.length > 1 ? parseInt(parts[1], 10) : 4;
            if (isNaN(oct)) oct = 4;
            var vf = String(letter || 'c').toLowerCase() + '/' + oct;
            var host = document.getElementById('studioPitchRow');
            if (!host) return;
            var btn = host.querySelector('.studio-piano-key[data-vfkey="' + vf + '"]');
            if (!btn || btn.disabled || btn.classList.contains('studio-piano-key--disabled')) {
                _showToast('此音高不在可輸入範圍', 'warn');
                return;
            }
            appendMelodyFromPiano(host, vf, btn);
        }

        function nudgeSelectedPitchBySemitone(delta) {
            var midi = vfKeyToMidi(selectedPitch);
            if (midi == null) return;
            var next = midi + delta;
            var tries = 0;
            while (tries < 24) {
                var vf = midiToVfKey(next);
                if (applyPitchByVfKey(vf)) return;
                next += delta > 0 ? 1 : -1;
                tries++;
            }
        }

        function toggleDottedInputMode() {
            dottedInputMode = !dottedInputMode;
            updateDottedBadgeUi();
            updateInputHudUi();
            _showToast(dottedInputMode ? '附點輸入：開啟' : '附點輸入：關閉', 'success');
            saveStudioDraft();
        }

        function repeatLastMeasureByTab() {
            if (activeTab === 'melody') {
                if (!melodyNotes.length) return;
                var bars = melodyBarsRaw();
                if (!bars.length) return;
                var lastBar = bars[bars.length - 1];
                for (var i = 0; i < lastBar.length; i++) {
                    var n = lastBar[i];
                    if (!appendMelodyNote({
                        keys: n.keys,
                        dur: n.dur,
                        rest: !!n.rest,
                        flipStem: !!n.flipStem
                    })) break;
                }
                return;
            }
            var barsRh = flatToRhythmBarStrings(rhythmFlat);
            if (!barsRh.length) return;
            var last = barsRh[barsRh.length - 1].trim();
            if (!last) return;
            var toks = last.split(/\s+/);
            for (var j = 0; j < toks.length; j++) {
                if (!canAddRhythmToken(rhythmFlat, toks[j])) break;
                rhythmFlat.push(toks[j]);
            }
            invalidateRenderCache('rhythm');
            requestStudioRender('rhythm');
            saveStudioDraft();
        }

        function flipLastMelodyStemDirection() {
            for (var i = melodyNotes.length - 1; i >= 0; i--) {
                var n = melodyNotes[i];
                if (!n || n.rest || isRestDur(n.dur)) continue;
                n.flipStem = !n.flipStem;
                invalidateRenderCache('melody');
                requestStudioRender('melody');
                saveStudioDraft();
                return;
            }
            _showToast('沒有可翻轉的音符', 'warn');
        }

        function repeatLastByTab() {
            if (activeTab === 'melody') {
                if (!melodyNotes.length) return;
                var last = melodyNotes[melodyNotes.length - 1];
                appendMelodyNote({ keys: last.keys, dur: last.dur, rest: !!last.rest, flipStem: !!last.flipStem });
                return;
            }
            if (!rhythmFlat.length) return;
            var tok = rhythmFlat[rhythmFlat.length - 1];
            if (!canAddRhythmToken(rhythmFlat, tok)) {
                _showToast('無法重複：目前小節放不下', 'warn');
                return;
            }
            rhythmFlat.push(tok);
            invalidateRenderCache('rhythm');
            requestStudioRender('rhythm');
            saveStudioDraft();
        }

        function populateStudioKeySelect() {
            var sel = document.getElementById('studioKeySig');
            if (!sel) return;
            if (keySignatures && keySignatures.length) {
                sel.innerHTML = keySignatures.map(function (k) {
                    return '<option value="' + k.id + '">' + k.name + '</option>';
                }).join('');
            } else {
                sel.innerHTML = '<option value="C">C大調</option>';
            }
            var saved = 'C';
            try { saved = localStorage.getItem(STUDIO_KEY_LS) || 'C'; } catch (e) { /* ignore */ }
            if (sel.querySelector('option[value="' + saved + '"]')) sel.value = saved;
            else sel.value = 'C';
            melodyKeySigId = sel.value;
        }

        function paintMelodyDurationGlyphs() {
            if (typeof renderNoteGlyph !== 'function') return;
            var row = document.getElementById('studioMelodyDurRow');
            if (!row) return;
            var OPTICAL_Y = {
                w: -0.6, h: -0.8, q: -0.2, '8': 0.2, '16': 0.5,
                wr: -0.6, hr: -0.9, qr: -0.7, '8r': -0.1, '16r': 0.2
            };
            var OPTICAL_SCALE = {
                w: 0.93, h: 0.935, q: 0.95, '8': 0.985, '16': 1.01,
                wr: 0.92, hr: 0.93, qr: 0.945, '8r': 1.0, '16r': 1.015
            };
            var specs = [
                { mdur: 'w', dur: 'w' },
                { mdur: 'h', dur: 'h' },
                { mdur: 'q', dur: 'q' },
                { mdur: '8', dur: '8' },
                { mdur: '16', dur: '16' },
                { mdur: 'wr', dur: 'wr' },
                { mdur: 'hr', dur: 'hr' },
                { mdur: 'qr', dur: 'qr' },
                { mdur: '8r', dur: '8r' },
                { mdur: '16r', dur: '16r' }
            ];
            specs.forEach(function (s) {
                var btn = row.querySelector('[data-mdur="' + s.mdur + '"]');
                if (!btn) return;
                var label = btn.getAttribute('title') || btn.textContent.trim();
                var svg = renderNoteGlyph(s.dur, false);
                if (!svg) return;
                var svgSafe = String(svg);
                if (!/xmlns\s*=/.test(svgSafe)) {
                    svgSafe = svgSafe.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
                }
                /* Inline SVG only — img+data URI fails on file:// / some Safari builds (broken icons). */
                btn.innerHTML = '<span class="studio-chip-glyph" aria-hidden="true">' + svgSafe + '</span><span class="studio-chip-sr">' + label + '</span>';
                btn.style.setProperty('--glyph-ty', (OPTICAL_Y[s.dur] || 0) + 'px');
                btn.style.setProperty('--glyph-scale', String(OPTICAL_SCALE[s.dur] || 1));
                btn.setAttribute('title', label);
            });
        }

        function buildPitchRow() {
            var host = document.getElementById('studioPitchRow');
            if (!host || !MAPS || !MAPS.treble || !MAPS.treble.length) return;

            var valid = {};
            var lo = letterOctToMidi(MAPS.treble[0].letter, MAPS.treble[0].octave);
            var hi = letterOctToMidi(MAPS.treble[MAPS.treble.length - 1].letter, MAPS.treble[MAPS.treble.length - 1].octave);
            if (lo == null || hi == null || lo > hi) return;
            var mx;
            for (mx = lo; mx <= hi; mx++) {
                var vfkx = midiToVfKey(mx);
                var ckx = vfKeyToConfigKey(vfkx);
                if (CONFIG.NOTE_FREQUENCIES && CONFIG.NOTE_FREQUENCIES[ckx]) valid[vfkx] = true;
            }

            var whiteMidis = [];
            var blackMidis = [];
            var m;
            for (m = lo; m <= hi; m++) {
                if (isWhitePitchClass(m % 12)) whiteMidis.push(m);
                else if (isBlackPitchClass(m % 12)) blackMidis.push(m);
            }

            var nW = whiteMidis.length;
            var pianoWrap = document.createElement('div');
            pianoWrap.className = 'studio-piano';
            pianoWrap.style.setProperty('--studio-piano-n-white', String(nW));

            var inner = document.createElement('div');
            inner.className = 'studio-piano-inner';

            var whitesEl = document.createElement('div');
            whitesEl.className = 'studio-piano-whites';

            var blacksEl = document.createElement('div');
            blacksEl.className = 'studio-piano-blacks';

            whiteMidis.forEach(function (wm) {
                var vfk = midiToVfKey(wm);
                var enabled = !!valid[vfk];
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'studio-piano-white studio-piano-key' + (enabled ? '' : ' studio-piano-key--disabled');
                btn.dataset.vfkey = vfk;
                btn.textContent = vfKeyToLabel(vfk);
                btn.setAttribute('aria-label', vfKeyToLabel(vfk));
                btn.setAttribute('aria-pressed', 'false');
                if (!enabled) {
                    btn.disabled = true;
                } else {
                    var onWhite = function (e) {
                        if (e && e.preventDefault) e.preventDefault();
                        btn.blur && btn.blur();
                        appendMelodyFromPiano(host, vfk, btn);
                    };
                    if (window.AudioEngine && window.AudioEngine.onInstantTap) {
                        window.AudioEngine.onInstantTap(btn, onWhite);
                    } else {
                        btn.addEventListener('click', onWhite);
                    }
                }
                whitesEl.appendChild(btn);
            });

            blackMidis.forEach(function (bm) {
                var vfk = midiToVfKey(bm);
                var enabled = !!valid[vfk];
                var wi = whiteIndexBeforeBlack(whiteMidis, bm);
                if (wi < 0) return;
                var bbtn = document.createElement('button');
                bbtn.type = 'button';
                bbtn.className = 'studio-piano-black studio-piano-key' + (enabled ? '' : ' studio-piano-key--disabled');
                bbtn.dataset.vfkey = vfk;
                bbtn.style.left = ((wi + 1) / nW) * 100 + '%';
                bbtn.setAttribute('aria-label', vfKeyToLabel(vfk) + (enabled ? '' : '（無試聽音高）'));
                bbtn.setAttribute('title', enabled ? vfKeyToLabel(vfk) : '此音高未收錄於試聽音階');
                if (!enabled) {
                    bbtn.disabled = true;
                } else {
                    var onBlack = function (e) {
                        if (e && e.preventDefault) e.preventDefault();
                        bbtn.blur && bbtn.blur();
                        appendMelodyFromPiano(host, vfk, bbtn);
                    };
                    if (window.AudioEngine && window.AudioEngine.onInstantTap) {
                        window.AudioEngine.onInstantTap(bbtn, onBlack);
                    } else {
                        bbtn.addEventListener('click', onBlack);
                    }
                }
                blacksEl.appendChild(bbtn);
            });

            inner.appendChild(whitesEl);
            inner.appendChild(blacksEl);
            pianoWrap.appendChild(inner);
            host.innerHTML = '';
            host.appendChild(pianoWrap);

            var prefer = host.querySelector('.studio-piano-key[data-vfkey="' + selectedPitch + '"]');
            var firstOk = host.querySelector('.studio-piano-key:not(.studio-piano-key--disabled)');
            var btn0 = (prefer && !prefer.disabled && !prefer.classList.contains('studio-piano-key--disabled'))
                ? prefer
                : firstOk;
            if (btn0) {
                applyPitchKeyboardSelection(host, btn0.dataset.vfkey, btn0);
            }
        }

        function getRhythmTokenGlyphSpecs(tokenId) {
            var specMap = {
                ta: [{ dur: 'q', dotted: false }],
                'ti-ti': [{ dur: '8', dotted: false }, { dur: '8', dotted: false }],
                'ta-a': [{ dur: 'h', dotted: false }],
                '休': [{ dur: 'qr', dotted: false }],
                ti: [{ dur: '8', dotted: false }],
                'ti-ri-ti-ri': [{ dur: '16', dotted: false }, { dur: '16', dotted: false }],
                'ta-a-a': [{ dur: 'h', dotted: true }],
                'ti-ri': [{ dur: '8', dotted: true }],
                'ti-ti-ri': [{ dur: '8', dotted: false }, { dur: '16', dotted: false }],
                'ti-ri-ti': [{ dur: '16', dotted: false }, { dur: '8', dotted: false }],
                'ri-ti-ri': [{ dur: '8', dotted: true }, { dur: '16', dotted: false }]
            };
            return specMap[tokenId] || null;
        }

        function renderRhythmTokenGlyphHtml(tokenId) {
            if (typeof renderNoteGlyph !== 'function') return '';
            var specs = getRhythmTokenGlyphSpecs(tokenId);
            if (!specs || !specs.length) return '';
            var glyphItems = specs.map(function (spec) {
                var svg = renderNoteGlyph(spec.dur, !!spec.dotted);
                if (!svg) return '';
                var svgSafe = String(svg);
                if (!/xmlns\s*=/.test(svgSafe)) {
                    svgSafe = svgSafe.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
                }
                return '<span class="studio-rtok-glyph-item" aria-hidden="true">' + svgSafe + '</span>';
            }).join('');
            if (!glyphItems) return '';
            return '<span class="studio-rtok-glyph-group" aria-hidden="true">' + glyphItems + '</span>';
        }

        function buildRhythmPalette() {
            var pal = document.getElementById('studioRhythmPalette');
            if (!pal) return;

            var groups = STUDIO_RHYTHM_TOKENS_GROUPED;

            // Build grouped HTML with section headers and beat-count badge.
            var html = '';
            groups.forEach(function (grp) {
                html += '<div class="studio-rtok-group">';
                html += '<div class="studio-rtok-group-title">' + grp.title + '</div>';
                html += '<div class="studio-rtok-group-grid">';
                grp.tokens.forEach(function (t) {
                    var glyphHtml = renderRhythmTokenGlyphHtml(t.id);
                    var tokenLabel = t.label + '，' + t.sub;
                    html += '<button type="button" class="studio-rtok studio-rtok--' + (t.color || 'warm') + '" data-tok="' + t.id + '" aria-label="' + tokenLabel + '" title="' + tokenLabel + '">' +
                        glyphHtml +
                        '<span class="studio-rtok-name">' + t.label + '</span>' +
                        '<span class="studio-rtok-beat-badge">' + t.sub + '</span>' +
                        '</button>';
                });
                html += '</div></div>';
            });

            pal.innerHTML = html;
            pal.querySelectorAll('.studio-rtok').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    btn.blur && btn.blur();
                    var tok = btn.dataset.tok;
                    if (!canAddRhythmToken(rhythmFlat, tok)) {
                        _showToast('此節奏放不進目前小節，或已滿八小節', 'warn');
                        if (audio.playClick) audio.playClick();
                        return;
                    }
                    rhythmFlat.push(tok);
                    requestStudioRender('rhythm');
                    saveStudioDraft();
                    if (audio.playClick) audio.playClick('select');
                });
            });
        }

        var STUDIO_DEMO_LS = 'studioDemoMode';
        var _studioDomBootstrapped = false;

        function syncStudioDemoClassFromStorage() {
            try {
                var demoOn = localStorage.getItem(STUDIO_DEMO_LS) === 'true';
                var screen = document.getElementById('screen-composition-studio');
                var btn = document.getElementById('studioDemoToggle');
                if (screen) screen.classList.toggle('studio-demo-mode', demoOn);
                if (btn) btn.setAttribute('aria-pressed', demoOn ? 'true' : 'false');
            } catch (e) { /* ignore */ }
        }

        function applyStudioDemoMode(enabled) {
            var screen = document.getElementById('screen-composition-studio');
            var btn = document.getElementById('studioDemoToggle');
            if (screen) screen.classList.toggle('studio-demo-mode', !!enabled);
            if (btn) btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
            try {
                localStorage.setItem(STUDIO_DEMO_LS, enabled ? 'true' : 'false');
            } catch (e) { /* ignore */ }
            requestStudioRender(activeTab);
            saveStudioDraft();
            if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        }

        function ensureCompositionStudioDom() {
            if (_studioDomBootstrapped) return;
            _studioDomBootstrapped = true;

            populateStudioKeySelect();
            var keySel = document.getElementById('studioKeySig');
            keySel && keySel.addEventListener('change', function () {
                melodyKeySigId = keySel.value;
                try { localStorage.setItem(STUDIO_KEY_LS, melodyKeySigId); } catch (e) { /* ignore */ }
                if (activeTab === 'melody') requestStudioRender('melody');
                saveStudioDraft();
            });

            buildPitchRow();
            paintMelodyDurationGlyphs();
            buildRhythmPalette();
            updateDottedBadgeUi();
            updateInputHudUi();

            document.getElementById('studioDemoToggle') && document.getElementById('studioDemoToggle').addEventListener('click', function () {
                var screen = document.getElementById('screen-composition-studio');
                var next = !(screen && screen.classList.contains('studio-demo-mode'));
                applyStudioDemoMode(next);
                if (audio.playClick) audio.playClick();
            });

            document.getElementById('studioBackBtn') && document.getElementById('studioBackBtn').addEventListener('click', function () {
                if (_studioPlaying) stopPlaybackSession(true);
                if (audio.playClick) audio.playClick();
                switchScreen('screen-hub');
            });

            var teachImgIdx = 0;
            var teachImgs = ['img/teach-rhythm-L1.jpg', 'img/teach-rhythm-L2.jpg'];
            var teachTitles = ['節奏圖（一）—— 基本時值', '節奏圖（二）—— 附點與切分音'];
            document.getElementById('studioTeachRhythmBtn') && document.getElementById('studioTeachRhythmBtn').addEventListener('click', function () {
                teachImgIdx = 0;
                if (_openLightbox) _openLightbox(teachImgs[0], teachTitles[0]);
            });
            var _lbEl = document.getElementById('imgLightbox');
            if (_lbEl) {
                _lbEl.addEventListener('click', function (e) {
                    if (e.target.id !== 'imgLightboxImg' && !e.target.classList.contains('img-lightbox-img')) return;
                    teachImgIdx = (teachImgIdx + 1) % teachImgs.length;
                    if (_openLightbox) _openLightbox(teachImgs[teachImgIdx], teachTitles[teachImgIdx]);
                });
            }

            document.querySelectorAll('.studio-tab').forEach(function (btn) {
                btn.addEventListener('click', function () { setTab(btn.dataset.studioTab); });
            });

            var bpmEl = document.getElementById('studioBpm');
            var bpmVal = document.getElementById('studioBpmVal');
            if (bpmEl) {
                bpmEl.min = String(STUDIO_BPM_MIN);
                bpmEl.max = String(STUDIO_BPM_MAX);
            }
            bpmEl && bpmEl.addEventListener('input', function () {
                if (bpmVal) bpmVal.textContent = bpmEl.value;
                saveStudioDraft();
            });

            var durRow = document.getElementById('studioMelodyDurRow');
            function activateMelodyDurChip(chip) {
                if (!chip || !durRow) return;
                durRow.querySelectorAll('.studio-chip').forEach(function (c) { c.classList.remove('active'); });
                chip.classList.add('active');
                selectedMelodyDur = chip.dataset.mdur;
                updateInputHudUi();
                saveStudioDraft();
            }
            durRow && durRow.querySelectorAll('.studio-chip').forEach(function (ch) {
                ch.addEventListener('click', function (e) {
                    e.preventDefault();
                    ch.blur && ch.blur();
                    activateMelodyDurChip(ch);
                });
            });

            document.getElementById('studioPlayBtn') && document.getElementById('studioPlayBtn').addEventListener('click', function () { playPreview(); });
            document.getElementById('studioUndoBtn') && document.getElementById('studioUndoBtn').addEventListener('click', function () {
                undo();
                if (audio.playClick) audio.playClick();
            });
            document.getElementById('studioClearBtn') && document.getElementById('studioClearBtn').addEventListener('click', function () {
                clearAll();
                if (audio.playClick) audio.playClick();
            });
            document.getElementById('studioSvgBtn') && document.getElementById('studioSvgBtn').addEventListener('click', function () {
                downloadSvgFile();
                if (audio.playClick) audio.playClick();
            });
            document.getElementById('studioPngBtn') && document.getElementById('studioPngBtn').addEventListener('click', function () {
                downloadPngFile();
                if (audio.playClick) audio.playClick();
            });
            document.getElementById('studioCopyJsonBtn') && document.getElementById('studioCopyJsonBtn').addEventListener('click', function () {
                copyJson();
                if (audio.playClick) audio.playClick();
            });
            document.getElementById('studioShareBtn') && document.getElementById('studioShareBtn').addEventListener('click', function () {
                tryShare();
                if (audio.playClick) audio.playClick();
            });
            document.getElementById('studioUploadBtn') && document.getElementById('studioUploadBtn').addEventListener('click', function () {
                uploadBackup();
                if (audio.playClick) audio.playClick();
            });

            window.addEventListener('resize', function () {
                var scr = document.getElementById('screen-composition-studio');
                if (!scr || !scr.classList.contains('active')) return;
                if (_studioResizeTimer) clearTimeout(_studioResizeTimer);
                _studioResizeTimer = setTimeout(function () {
                    requestStudioRender(activeTab);
                }, 120);
            });

            if (!_studioKeybindsBound) {
                _studioKeybindsBound = true;
                document.addEventListener('keydown', function (e) {
                    var scr = document.getElementById('screen-composition-studio');
                    if (!scr || !scr.classList.contains('active')) return;
                    var t = e.target;
                    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;

                    var k = e.key;
                    if (activeTab === 'melody' && (k === '4' || k === '5' || k === '3') && e.location === 3) {
                        var map = { '4': 'q', '5': 'h', '3': '8' };
                        if (setSelectedMelodyDurationFromChipDur(map[k])) e.preventDefault();
                        return;
                    }
                    if (activeTab === 'melody' && (k === '.' || e.code === 'NumpadDecimal')) {
                        toggleDottedInputMode();
                        e.preventDefault();
                        return;
                    }
                    if (activeTab === 'melody' && /^[a-gA-G]$/.test(k)) {
                        appendMelodyByLetter(k);
                        e.preventDefault();
                        return;
                    }
                    if (k === 'r' || k === 'R') {
                        if (e.shiftKey) repeatLastMeasureByTab();
                        else repeatLastByTab();
                        e.preventDefault();
                        return;
                    }
                    if (k === 'ArrowUp' || k === 'ArrowDown') {
                        if (activeTab !== 'melody') return;
                        var step = (e.metaKey || e.ctrlKey) ? 12 : 1;
                        nudgeSelectedPitchBySemitone(k === 'ArrowUp' ? step : -step);
                        e.preventDefault();
                        return;
                    }
                    if (k === 'PageUp' || k === 'PageDown') {
                        window.scrollBy({ top: k === 'PageUp' ? -180 : 180, behavior: 'smooth' });
                        e.preventDefault();
                        return;
                    }
                    if (k === 'x' || k === 'X') {
                        if (activeTab === 'melody') {
                            flipLastMelodyStemDirection();
                        } else {
                            notifyShortcutNoopOnce('x-rhythm', 'X 翻轉符桿僅適用旋律譜');
                        }
                        e.preventDefault();
                        return;
                    }
                    if (k === 's' || k === 'S') {
                        if (!STUDIO_ENABLE_ADV_ENGRAVING_SHORTCUTS) {
                            notifyShortcutNoopOnce('s', 'S 圓滑線快捷鍵目前為保守模式（未啟用）');
                        }
                        e.preventDefault();
                        return;
                    }
                    if (k === 'h' || k === 'H') {
                        if (!STUDIO_ENABLE_ADV_ENGRAVING_SHORTCUTS) {
                            notifyShortcutNoopOnce('h', 'H 漸強/漸弱快捷鍵目前為保守模式（未啟用）');
                        }
                        e.preventDefault();
                    }
                });
            }
        }

        function open() {
            ensureCompositionStudioDom();
            loadStudioDraft();
            updateDottedBadgeUi();
            updateInputHudUi();
            var keySel = document.getElementById('studioKeySig');
            if (keySel && keySel.querySelector('option[value="' + melodyKeySigId + '"]')) keySel.value = melodyKeySigId;
            var bpmEl = document.getElementById('studioBpm');
            var bpmVal = document.getElementById('studioBpmVal');
            if (bpmEl && bpmVal) bpmVal.textContent = bpmEl.value;
            var durRow = document.getElementById('studioMelodyDurRow');
            if (durRow) {
                var chip = durRow.querySelector('.studio-chip[data-mdur="' + selectedMelodyDur + '"]');
                if (chip) {
                    durRow.querySelectorAll('.studio-chip').forEach(function (c) { c.classList.remove('active'); });
                    chip.classList.add('active');
                }
            }
            var pitchHost = document.getElementById('studioPitchRow');
            if (pitchHost) {
                var prefer = pitchHost.querySelector('.studio-piano-key[data-vfkey="' + selectedPitch + '"]');
                if (prefer && !prefer.disabled && !prefer.classList.contains('studio-piano-key--disabled')) {
                    applyPitchKeyboardSelection(pitchHost, selectedPitch, prefer);
                }
            }
            setPlayButtonState(false);
            setTab(activeTab);
            requestStudioRender(activeTab);
            saveStudioDraft();
        }

        function initCompositionStudio() {
            syncStudioDemoClassFromStorage();
        }

        return { open: open, init: initCompositionStudio };
    };
})(typeof window !== 'undefined' ? window : this);
