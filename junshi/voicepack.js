/*!
 * 军师 · 中文神经语音包播放器
 * ---------------------------------------------------------------
 * 把文字按字查拼音、做变调、取出预渲染的音节音频、用 Web Audio 精确拼接播放。
 * 完全不依赖系统 TTS —— iPhone 上也能听到同一个神经模型的声音。
 */
(function (global) {
  "use strict";

  const PAUSE = {
    "，": 240, "。": 460, "！": 460, "？": 460, "；": 320, "：": 280, "、": 200,
    ",": 240, ".": 460, "!": 460, "?": 460, ";": 320, ":": 280,
    "…": 380, "—": 200, "~": 200,
    "\n": 460, " ": 60, "\u3000": 60, "\t": 60
  };
  const TAIL  = 40;      // 音节之间留一点缝，避免粘连
  const GAP   = 30;      // 纯间隔

  function toneOf(s){ return s && /\d$/.test(s) ? s.slice(-1) : "5"; }
  function setTone(s, t){ return (/^\D+/.test(s) ? s.replace(/\d$/, "") : s) + t; }

  class VoicePack {
    constructor(baseUrl){
      this.base = (baseUrl || "").replace(/\/+$/, "") + "/";
      this.manifest = null;
      this.charMap = null;
      this.ctx = null;
      this.pack = null;                     // 整包二进制
      this.slices = Object.create(null);    // 音节 -> {off, len}
      this.buffers = Object.create(null);   // 音节 -> AudioBuffer
      this.pending = Object.create(null);   // 音节 -> Promise
      this.sources = [];
      this.timers = [];
      this.playing = false;
      this._token = 0;
    }

    // ---------- 加载 ----------
    // 只发两个请求：huayan.meta.json（元信息+字符表）+ huayan.pack（全部音频）
    async load(onProgress){
      if(this.manifest) return this;
      const mRes = await fetch(this.base + "huayan.meta.json", {cache: "force-cache"});
      if(!mRes.ok) throw new Error("语音包元信息拿不到（HTTP " + mRes.status + "）");
      const meta = await mRes.json();

      const map = Object.create(null);
      String(meta.chars || "").split("|").forEach(part => {
        const i = part.indexOf(":");
        if(i <= 0) return;
        const syl = part.slice(0, i);
        for(const ch of part.slice(i + 1)) map[ch] = syl;
      });
      this.charMap = map;

      if(onProgress) onProgress({stage: "meta", count: meta.count});

      const pRes = await fetch(this.base + "huayan.pack", {cache: "force-cache"});
      if(!pRes.ok) throw new Error("语音包拿不到（HTTP " + pRes.status + "）");
      const buf = await pRes.arrayBuffer();
      this._parsePack(buf);
      if(onProgress) onProgress({stage: "ready", count: this.manifest.count});
      return this;
    }

    _parsePack(buf){
      const dv = new DataView(buf);
      const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
      if(magic !== "JVPK") throw new Error("语音包格式不对（magic=" + magic + "）");
      const ver  = dv.getUint16(4, true);
      const cnt  = dv.getUint32(8, true);
      const idxLen = dv.getUint32(12, true);
      const payOff = dv.getUint32(16, true);
      if(ver !== 1) throw new Error("语音包版本不支持：" + ver);
      const idx = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, idxLen)));
      const slices = Object.create(null);
      const sylMeta = Object.create(null);
      for(const row of idx){
        slices[row[0]] = { off: payOff + row[1], len: row[2] };
        sylMeta[row[0]] = [0, ""];
      }
      this.pack = buf;
      this.slices = slices;
      this.manifest = { name: "huayan", sr: 22050, count: cnt, ext: "ogg", syl: sylMeta };
    }

    has(syl){ return !!(this.slices && this.slices[syl]); }

    // ---------- 文本 -> 音节序列 ----------
    toUnits(text){
      const out = [];
      let buf = [];
      const flush = () => {
        if(!buf.length) return;
        this._sandhi(buf).forEach(s => out.push({syl: s, gap: TAIL}));
        buf = [];
      };
      for(const ch of String(text || "")){
        if(PAUSE[ch] !== undefined){
          flush();
          if(PAUSE[ch] > 0) out.push({syl: null, gap: PAUSE[ch]});
        }else if(this.charMap[ch]){
          buf.push(this.charMap[ch]);
        }else if(/[\u3400-\u9FFF\uF900-\uFAFF]/.test(ch)){
          // 罕见字：表里没有，跳过（不硬读错音）
        }else if(/\s/.test(ch)){
          flush();
        }else{
          // 数字、字母等：留给上层处理，这里先跳过
        }
      }
      flush();
      return out;
    }

    // 三声连读 + 一/不 变调
    _sandhi(seq){
      const s = seq.slice();
      const n = s.length;
      for(let i = 0; i < n; i++){
        const base = s[i].replace(/\d$/, "");
        const nt = i + 1 < n ? toneOf(s[i + 1]) : null;
        if(base === "yi")      s[i] = nt === "4" ? "yi2" : (nt ? "yi4" : "yi1");
        else if(base === "bu") s[i] = nt === "4" ? "bu2" : "bu4";
      }
      for(let i = 0; i < n - 1; i++){
        if(toneOf(s[i]) === "3" && toneOf(s[i + 1]) === "3") s[i] = setTone(s[i], "2");
      }
      return s.filter(x => this.has(x) || true);   // 保持原样，缺音在播放时兜底
    }

    // ---------- 取音频 ----------
    _ctxOnce(){
      if(!this.ctx){
        const AC = global.AudioContext || global.webkitAudioContext;
        this.ctx = new AC();
      }
      if(this.ctx.state === "suspended") this.ctx.resume().catch(()=>{});
      return this.ctx;
    }
    // 从整包里切出这个音节的音频，解码成 AudioBuffer 并缓存
    _fetchSyl(syl){
      if(this.buffers[syl]) return Promise.resolve(this.buffers[syl]);
      if(this.pending[syl]) return this.pending[syl];
      const sl = this.slices[syl];
      if(!sl) return Promise.reject(new Error("包里没有 " + syl));
      const p = Promise.resolve()
        .then(() => {
          // slice 是零拷贝视图，直接交给解码器
          const bytes = this.pack.slice(sl.off, sl.off + sl.len);
          return new Promise((res, rej) => {
            const ctx = this._ctxOnce();
            // Safari 老版本只认回调式，所以两种都留着
            const pr = ctx.decodeAudioData(bytes, b => res(b), e => rej(e || new Error("解码失败 " + syl)));
            if(pr && typeof pr.then === "function") pr.then(res, rej);
          });
        })
        .then(b => { this.buffers[syl] = b; return b; })
        .catch(e => { delete this.pending[syl]; throw e; });
      this.pending[syl] = p;
      return p;
    }

    // 预取：把接下来要用的音节提前下下来
    async prefetch(text, limit){
      if(!this.manifest) return;
      const units = this.toUnits(text).filter(u => u.syl);
      const uniq = [];
      const seen = Object.create(null);
      for(const u of units){
        if(!seen[u.syl] && this.manifest.syl[u.syl]){ seen[u.syl] = 1; uniq.push(u.syl); }
      }
      const todo = uniq.slice(0, limit || 80);
      for(const s of todo){ try{ await this._fetchSyl(s); }catch(e){} }
    }

    // ---------- 播放 ----------
    /**
     * speak(text, {startAt, onUnit, onDone, onError, gapScale})
     * startAt: 从第几个"可发声单元"开始（用于点某句继续读）
     */
    async speak(text, opts){
      opts = opts || {};
      const ctx = this._ctxOnce();
      this.stop();
      const my = ++this._token;
      this.playing = true;

      const units = this.toUnits(text);
      let t = ctx.currentTime + 0.06;
      let started = 0;
      let startedAny = false;

      for(let i = 0; i < units.length; i++){
        if(my !== this._token) return false;          // 被打断了
        const u = units[i];
        if(!u.syl){
          t += (u.gap / 1000) * (opts.gapScale || 1);
          continue;
        }
        let buf;
        try{ buf = await this._fetchSyl(u.syl); }
        catch(e){ continue; }                          // 缺音就跳过，不中断
        if(my !== this._token) return false;

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        const at = Math.max(t, ctx.currentTime + 0.02);
        src.start(at);
        this.sources.push(src);
        t = at + buf.duration + (TAIL / 1000) * (opts.gapScale || 1);
        if(opts.onUnit) opts.onUnit({ index: i, syl: u.syl, start: started + 1, at: at });
        started++;
        startedAny = true;
      }

      const totalMs = Math.max(0, (t - ctx.currentTime) * 1000);
      return await new Promise(res => {
        const id = setTimeout(() => {
          if(my === this._token){ this.playing = false; }
          if(opts.onDone) opts.onDone({ units: started });
          res(true);
        }, Math.max(50, totalMs + 80));
        this.timers.push(id);
      });
    }

    /**
     * speakUnits(syls, {onUnit, onDone, gapScale})
     * 直接播一串已经切好的音节（上层负责和原文对齐、打高亮）
     */
    async speakUnits(syls, opts){
      opts = opts || {};
      const ctx = this._ctxOnce();
      this.stop();
      const my = ++this._token;
      this.playing = true;

      let t = ctx.currentTime + 0.05;
      let started = 0;
      const list = (syls || []).filter(x => x);

      for(let i = 0; i < list.length; i++){
        if(my !== this._token) return false;
        const syl = list[i];
        let buf;
        try{ buf = await this._fetchSyl(syl); }
        catch(e){ continue; }
        if(my !== this._token) return false;

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        const at = Math.max(t, ctx.currentTime + 0.02);
        src.start(at);
        this.sources.push(src);
        t = at + buf.duration + 0.035;               // 每字后留 35ms，避免粘连
        if(opts.onUnit) opts.onUnit(i, syl, at);
        started++;
      }

      const totalMs = Math.max(0, (t - ctx.currentTime) * 1000);
      return await new Promise(res => {
        const id = setTimeout(() => {
          if(my === this._token) this.playing = false;
          if(opts.onDone) opts.onDone({ units: started });
          res(true);
        }, Math.max(60, totalMs + 90));
        this.timers.push(id);
      });
    }

    stop(){
      this._token++;
      this.sources.forEach(s => { try{ s.stop(); }catch(e){} try{ s.disconnect(); }catch(e){} });
      this.sources = [];
      this.timers.forEach(id => clearTimeout(id));
      this.timers = [];
      this.playing = false;
    }
  }

  global.VoicePack = VoicePack;
  if(typeof module !== "undefined" && module.exports) module.exports = VoicePack;
})(typeof window !== "undefined" ? window : globalThis);
