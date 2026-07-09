(function () {
  'use strict';

  var screens = {
    gate: document.getElementById('screen-gate'),
    main: document.getElementById('screen-main'),
    used: document.getElementById('screen-used'),
  };
  var modalOverlay = document.getElementById('modal-overlay');
  var modalTitle = document.getElementById('modal-title');
  var modalDescription = document.getElementById('modal-description');

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle('hidden', key !== name);
    });
  }

  function showModal(title, description) {
    modalTitle.textContent = title;
    modalDescription.textContent = description;
    modalOverlay.classList.remove('hidden');
  }

  document.getElementById('modal-close').addEventListener('click', function () {
    modalOverlay.classList.add('hidden');
  });

  document.getElementById('dev-reset-btn').addEventListener('click', function () {
    fetch('/api/dev/reset-session', { method: 'POST' }).then(function () {
      window.location.reload();
    });
  });

  // ---------- Конфетти / салют ----------
  var confettiCanvas = document.getElementById('confetti-canvas');
  var ctx = confettiCanvas.getContext('2d');
  var confettiParticles = [];
  var confettiRunning = false;
  var confettiColors = ['#f7c948', '#6c4fd6', '#ff6b6b', '#4fd6a0', '#f5f1ff'];

  function resizeCanvas() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function spawnConfettiBurst(count) {
    for (var i = 0; i < count; i++) {
      confettiParticles.push({
        x: Math.random() * confettiCanvas.width,
        y: -20 - Math.random() * 100,
        vx: (Math.random() - 0.5) * 2.5,
        vy: 2 + Math.random() * 3,
        size: 5 + Math.random() * 6,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        life: 0,
      });
    }
  }

  function confettiTick() {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiParticles.forEach(function (p) {
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.life++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    });
    confettiParticles = confettiParticles.filter(function (p) {
      return p.y < confettiCanvas.height + 40;
    });

    if (confettiRunning && Math.random() < 0.4) spawnConfettiBurst(2);
    if (confettiParticles.length > 0 || confettiRunning) {
      requestAnimationFrame(confettiTick);
    }
  }

  function startCelebration(durationMs) {
    confettiRunning = true;
    spawnConfettiBurst(80);
    requestAnimationFrame(confettiTick);
    setTimeout(function () {
      confettiRunning = false;
    }, durationMs || 4000);
  }

  // ---------- Звук ----------
  var SoundEngine = (function () {
    var audioCtx = null;
    var muted = localStorage.getItem('cw_muted') === '1';

    function getCtx() {
      if (!audioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    }

    function tone(freq, startTime, duration, type, peakGain) {
      var c = getCtx();
      if (!c) return;
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(peakGain || 0.18, startTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.03);
    }

    function tick() {
      if (muted) return;
      var c = getCtx();
      if (!c) return;
      tone(920, c.currentTime, 0.045, 'square', 0.1);
    }

    function fanfare() {
      if (muted) return;
      var c = getCtx();
      if (!c) return;
      var now = c.currentTime;
      var notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach(function (freq, i) {
        tone(freq, now + i * 0.13, 0.3, 'triangle', 0.2);
      });
      tone(1318.5, now + 0.52, 0.7, 'sine', 0.16);
    }

    return {
      tick: tick,
      fanfare: fanfare,
      isMuted: function () { return muted; },
      setMuted: function (v) {
        muted = v;
        localStorage.setItem('cw_muted', v ? '1' : '0');
      },
      warmUp: getCtx,
    };
  })();

  var soundToggleBtn = document.getElementById('sound-toggle');
  function renderSoundIcon() {
    soundToggleBtn.textContent = SoundEngine.isMuted() ? '🔇' : '🔊';
  }
  renderSoundIcon();
  soundToggleBtn.addEventListener('click', function () {
    SoundEngine.setMuted(!SoundEngine.isMuted());
    renderSoundIcon();
    SoundEngine.warmUp();
  });

  // ---------- Колесо фортуны ----------
  var PRIZES = [
    { title: 'СУПЕР ПРИЗ', color: '#f7c948', textColor: '#241b3a' },
    { title: 'Powerbank', color: '#6c4fd6', textColor: '#fff' },
    { title: 'Доп. день отпуска', color: '#3b2a63', textColor: '#fff' },
    { title: 'Подарочная карта', color: '#4fd6a0', textColor: '#1a1a1a' },
    { title: 'Билеты в кино', color: '#6c4fd6', textColor: '#fff' },
    { title: 'Кофемашина', color: '#3b2a63', textColor: '#fff' },
    { title: 'Мерч компании', color: '#4fd6a0', textColor: '#1a1a1a' },
    { title: 'Шампанское', color: '#6c4fd6', textColor: '#fff' },
  ];

  var wheelCanvas = document.getElementById('wheel-canvas');
  var wctx = wheelCanvas.getContext('2d');
  var wheelRadius = wheelCanvas.width / 2;
  var segCount = PRIZES.length;
  var segDeg = 360 / segCount;

  function drawWheel() {
    var cx = wheelRadius;
    var cy = wheelRadius;
    wctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

    for (var i = 0; i < segCount; i++) {
      var startDeg = -90 - segDeg / 2 + i * segDeg;
      var endDeg = startDeg + segDeg;
      var startRad = (startDeg * Math.PI) / 180;
      var endRad = (endDeg * Math.PI) / 180;

      wctx.beginPath();
      wctx.moveTo(cx, cy);
      wctx.arc(cx, cy, wheelRadius - 4, startRad, endRad);
      wctx.closePath();
      wctx.fillStyle = PRIZES[i].color;
      wctx.fill();
      wctx.strokeStyle = 'rgba(0,0,0,0.28)';
      wctx.lineWidth = 2;
      wctx.stroke();

      var midDeg = startDeg + segDeg / 2;
      var midRad = (midDeg * Math.PI) / 180;
      wctx.save();
      wctx.translate(cx + Math.cos(midRad) * (wheelRadius * 0.6), cy + Math.sin(midRad) * (wheelRadius * 0.6));
      wctx.rotate(midRad + Math.PI / 2);
      wctx.fillStyle = PRIZES[i].textColor;
      wctx.font = 'bold 13px Segoe UI, sans-serif';
      wctx.textAlign = 'center';
      wctx.textBaseline = 'middle';
      wctx.shadowColor = 'rgba(0,0,0,0.35)';
      wctx.shadowBlur = 3;
      wrapText(PRIZES[i].title, 0, 0);
      wctx.restore();
    }

    // Глянцевый блик по всему колесу
    wctx.save();
    wctx.beginPath();
    wctx.arc(cx, cy, wheelRadius - 4, 0, Math.PI * 2);
    wctx.closePath();
    wctx.clip();
    var gloss = wctx.createRadialGradient(cx, cy * 0.55, wheelRadius * 0.1, cx, cy, wheelRadius);
    gloss.addColorStop(0, 'rgba(255,255,255,0.32)');
    gloss.addColorStop(0.55, 'rgba(255,255,255,0.06)');
    gloss.addColorStop(1, 'rgba(0,0,0,0.18)');
    wctx.fillStyle = gloss;
    wctx.fillRect(0, 0, wheelCanvas.width, wheelCanvas.height);
    wctx.restore();

    // Огоньки по кромке
    var dotCount = segCount * 3;
    for (var d = 0; d < dotCount; d++) {
      var dotDeg = (360 / dotCount) * d;
      var dotRad = (dotDeg * Math.PI) / 180;
      var dx = cx + Math.cos(dotRad) * (wheelRadius - 10);
      var dy = cy + Math.sin(dotRad) * (wheelRadius - 10);
      wctx.beginPath();
      wctx.arc(dx, dy, 3.2, 0, Math.PI * 2);
      wctx.fillStyle = d % 2 === 0 ? '#fff6da' : '#f7c948';
      wctx.fill();
    }

    // Центральная втулка
    var hub = wctx.createRadialGradient(cx - 6, cy - 8, 2, cx, cy, wheelRadius * 0.13);
    hub.addColorStop(0, '#fffdf5');
    hub.addColorStop(1, '#f0c04a');
    wctx.beginPath();
    wctx.arc(cx, cy, wheelRadius * 0.13, 0, Math.PI * 2);
    wctx.fillStyle = hub;
    wctx.fill();
    wctx.lineWidth = 2;
    wctx.strokeStyle = '#a97a12';
    wctx.stroke();
  }

  function wrapText(text, x, y) {
    var words = text.split(' ');
    var lines = [];
    var current = '';
    words.forEach(function (w) {
      var test = current ? current + ' ' + w : w;
      if (test.length > 12 && current) {
        lines.push(current);
        current = w;
      } else {
        current = test;
      }
    });
    if (current) lines.push(current);
    var lineHeight = 14;
    var startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach(function (line, idx) {
      wctx.fillText(line, x, startY + idx * lineHeight);
    });
  }

  drawWheel();

  var currentRotation = 0;
  var pointerWrap = document.querySelector('.pointer-wrap');
  var tickIntervalId = null;

  function startPointerTick() {
    if (pointerWrap) pointerWrap.classList.add('ticking');
    if (tickIntervalId) clearInterval(tickIntervalId);
    tickIntervalId = setInterval(function () {
      SoundEngine.tick();
    }, 120);
  }

  function stopPointerTick() {
    if (pointerWrap) pointerWrap.classList.remove('ticking');
    if (tickIntervalId) {
      clearInterval(tickIntervalId);
      tickIntervalId = null;
    }
  }

  // ---------- Огоньки вокруг колеса ----------
  var lightsRing = document.getElementById('lights-ring');
  var LIGHT_COUNT = 16;
  var LIGHT_RADIUS = 236;
  var LIGHT_PALETTE = ['#f7c948', '#1dc8f5', '#ff6b6b', '#6c4fd6', '#4fd6a0', '#ffffff'];
  var lightDots = [];

  for (var li = 0; li < LIGHT_COUNT; li++) {
    var dot = document.createElement('div');
    dot.className = 'light-dot';
    var ang = ((360 / LIGHT_COUNT) * li * Math.PI) / 180;
    dot.style.left = Math.cos(ang) * LIGHT_RADIUS + 'px';
    dot.style.top = Math.sin(ang) * LIGHT_RADIUS + 'px';
    lightsRing.appendChild(dot);
    lightDots.push(dot);
  }

  function setLightsIdle() {
    lightDots.forEach(function (d) {
      d.style.background = '#f7c948';
      d.style.boxShadow = '0 0 8px 2px rgba(247, 201, 72, 0.7)';
    });
  }
  setLightsIdle();

  var lightsInterval = null;
  var lightsTick = 0;

  function startLightsChase() {
    stopLightsChase();
    lightsInterval = setInterval(function () {
      lightsTick++;
      lightDots.forEach(function (d, i) {
        var color = LIGHT_PALETTE[(i + lightsTick) % LIGHT_PALETTE.length];
        d.style.background = color;
        d.style.boxShadow = '0 0 10px 3px ' + color;
      });
    }, 90);
  }

  function stopLightsChase() {
    if (lightsInterval) {
      clearInterval(lightsInterval);
      lightsInterval = null;
    }
  }

  function flashLightsCelebrate(times, onComplete) {
    stopLightsChase();
    var count = 0;
    var flashColors = ['#ffffff', '#f7c948'];
    var flashInterval = setInterval(function () {
      var color = flashColors[count % 2];
      lightDots.forEach(function (d) {
        d.style.background = color;
        d.style.boxShadow = '0 0 14px 4px ' + color;
      });
      count++;
      if (count >= times) {
        clearInterval(flashInterval);
        setLightsIdle();
        onComplete && onComplete();
      }
    }, 140);
  }

  // ---------- Вращение колеса ----------
  function runRotationPhase(target, duration, easing, onPhaseDone) {
    var finished = false;
    var fallbackTimer = setTimeout(finish, duration + 300);

    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(fallbackTimer);
      wheelCanvas.removeEventListener('transitionend', onTransitionEnd);
      onPhaseDone && onPhaseDone();
    }

    function onTransitionEnd(e) {
      if (!e || e.propertyName === 'transform') finish();
    }

    wheelCanvas.addEventListener('transitionend', onTransitionEnd);
    wheelCanvas.style.transition = 'transform ' + duration + 'ms ' + easing;
    void wheelCanvas.offsetHeight; // форсируем reflow, чтобы смена transition точно применилась до смены transform
    wheelCanvas.style.transform = 'rotate(' + target + 'deg)';
  }

  function spinToSuperPrize(onDone) {
    var spins = 6;
    var jitter = (Math.random() - 0.5) * 2 * 10; // остаёмся внутри сектора СУПЕР ПРИЗ
    var start = currentRotation;
    var finalTarget = start + spins * 360 + jitter - (start % 360);

    // Промежуточная точка: колесо почти замирает на соседнем секторе,
    // едва не доходя до границы с СУПЕР ПРИЗом — создаёт эффект "затаили дыхание"
    var teaseTarget = finalTarget - segDeg * 0.88;

    currentRotation = finalTarget;

    startPointerTick();
    startLightsChase();

    runRotationPhase(teaseTarget, 4200, 'cubic-bezier(0.1, 0.7, 0.15, 1)', function () {
      stopPointerTick();

      // Пауза "на грани" перед финальным доворотом
      setTimeout(function () {
        startPointerTick();
        runRotationPhase(finalTarget, 900, 'cubic-bezier(0.33, 0, 0.2, 1)', function () {
          stopPointerTick();
          SoundEngine.fanfare();
          flashLightsCelebrate(6, onDone);
        });
      }, 800);
    });
  }

  // ---------- Состояние / API ----------
  function api(path, options) {
    return fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options)).then(
      function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      }
    );
  }

  function renderUsedScreen(message, prize) {
    document.getElementById('used-message').textContent =
      message || 'Вы уже участвовали в этой акции. Колесо можно крутить только один раз.';
    var prizeBox = document.getElementById('used-prize');
    if (prize) {
      prizeBox.classList.remove('hidden');
      document.getElementById('used-prize-title').textContent = prize;
    } else {
      prizeBox.classList.add('hidden');
    }
    showScreen('used');
  }

  function initGateForm(config) {
    var select = document.getElementById('country-select');
    config.countries.forEach(function (country) {
      var opt = document.createElement('option');
      opt.value = country;
      opt.textContent = country;
      select.appendChild(opt);
    });
    document.getElementById('domain-hint').textContent =
      'Доступно только для почты: ' + config.allowedDomainsHint;
    document.getElementById('hero-title').innerHTML =
      'Компании ' + escapeHtml(config.companyName) + ' исполняется <span id="anniv-years">' +
      escapeHtml(config.anniversaryYears) + '</span> лет! 🎉';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // ---------- Факты о компании ----------
  var factList = [];
  var factIndex = 0;

  function renderFact() {
    var el = document.getElementById('fact-text');
    el.style.opacity = 0;
    setTimeout(function () {
      el.textContent = factList[factIndex];
      el.style.opacity = 1;
    }, 250);
  }

  function startFactsCycle(facts) {
    factList = facts && facts.length ? facts : ['Скоро здесь появится интересный факт о компании!'];
    factIndex = 0;
    document.getElementById('fact-text').textContent = factList[0];
    if (factList.length > 1) {
      setInterval(function () {
        factIndex = (factIndex + 1) % factList.length;
        renderFact();
      }, 6000);
    }
  }

  document.getElementById('gate-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('email-input').value.trim();
    var country = document.getElementById('country-select').value;
    var errorEl = document.getElementById('gate-error');
    errorEl.textContent = '';

    api('/api/register', { method: 'POST', body: JSON.stringify({ email: email, country: country }) }).then(
      function (res) {
        if (res.ok) {
          showScreen('main');
          startCelebration(5000);
        } else if (res.status === 409 && res.data.error === 'already_registered' && !res.data.spun) {
          showScreen('main');
          startCelebration(3000);
        } else if (res.status === 409) {
          renderUsedScreen(res.data.message, res.data.prize);
        } else {
          errorEl.textContent = res.data.message || 'Что-то пошло не так, попробуйте снова.';
        }
      }
    ).catch(function () {
      errorEl.textContent = 'Не удалось связаться с сервером. Попробуйте ещё раз.';
    });
  });

  document.getElementById('spin-btn').addEventListener('click', function () {
    var btn = document.getElementById('spin-btn');
    btn.disabled = true;
    SoundEngine.warmUp(); // инициализируем AudioContext в рамках пользовательского клика

    api('/api/spin', { method: 'POST' }).then(function (res) {
      if (res.ok) {
        spinToSuperPrize(function () {
          startCelebration(6000);
          showModal(res.data.prize, res.data.description);
        });
      } else if (res.status === 409) {
        renderUsedScreen(res.data.message, res.data.prize);
      } else {
        btn.disabled = false;
        alert(res.data.message || 'Не удалось прокрутить колесо, попробуйте позже.');
      }
    });
  });

  // ---------- Инициализация ----------
  Promise.all([api('/api/config'), api('/api/me')]).then(function (results) {
    var config = results[0].data;
    var me = results[1].data;

    initGateForm(config);
    startFactsCycle(config.facts);

    if (me.registered && me.spun) {
      renderUsedScreen('Вы уже участвовали в акции и прокрутили колесо.', me.prize);
    } else if (me.registered) {
      showScreen('main');
      startCelebration(4000);
    } else {
      showScreen('gate');
    }
  });
})();
