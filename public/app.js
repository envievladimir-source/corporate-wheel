(function () {
  'use strict';

  var screens = {
    gate: document.getElementById('screen-gate'),
    main: document.getElementById('screen-main'),
    used: document.getElementById('screen-used'),
  };
  var balloonsEl = document.getElementById('balloons');

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle('hidden', key !== name);
    });
    balloonsEl.classList.toggle('hidden', name !== 'main');
    // Колесо (і, отже, ширина для розрахунку кільця вогників) видиме лише на
    // екрані main — перераховуємо позиції вогників саме в момент його показу.
    if (name === 'main') buildLights();
  }

  document.getElementById('dev-reset-btn').addEventListener('click', function () {
    fetch('/api/dev/reset-session', { method: 'POST' }).then(function () {
      window.location.reload();
    });
  });

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

  // ---------- Конфетті ----------
  var confettiCanvas = document.getElementById('confetti-canvas');
  var cctx = confettiCanvas.getContext('2d');
  var CONFETTI_COLORS = ['#00A0FA', '#66C6FC', '#0B0D12', '#FFD166', '#ffffff'];

  function resizeConfettiCanvas() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeConfettiCanvas);
  resizeConfettiCanvas();

  function launchConfetti() {
    var parts = [];
    for (var i = 0; i < 180; i++) {
      parts.push({
        x: Math.random() * confettiCanvas.width,
        y: -20 - Math.random() * confettiCanvas.height * 0.5,
        w: 6 + Math.random() * 8,
        h: 10 + Math.random() * 10,
        vy: 2.5 + Math.random() * 3.5,
        vx: -1.5 + Math.random() * 3,
        rot: Math.random() * Math.PI,
        vr: -0.1 + Math.random() * 0.2,
        c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      });
    }
    var start = performance.now();
    function tick(now) {
      cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      var alive = false;
      parts.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y < confettiCanvas.height + 30) alive = true;
        cctx.save();
        cctx.translate(p.x, p.y);
        cctx.rotate(p.rot);
        cctx.fillStyle = p.c;
        cctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        cctx.restore();
      });
      if (alive && now - start < 6000) {
        requestAnimationFrame(tick);
      } else {
        cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      }
    }
    requestAnimationFrame(tick);
  }

  // ---------- Колесо ----------
  var PRIZE_LABELS = ['МЕРЧ EVOPLAY', 'ПІЦА-ПАТІ', 'СТІКЕРПАК', 'КАВА З CEO', 'ОБІЙМИ HR', 'ВИХІДНИЙ', 'ЩЕ РАЗ'];
  var segCount = 8;
  var segDeg = 360 / segCount;

  var wheelDisc = document.getElementById('wheel-disc');
  var wheelSectorsEl = document.getElementById('wheel-sectors');
  var wheelOuter = document.querySelector('.wheel-outer');
  var pointerEl = document.querySelector('.pointer');

  function renderSectors(jackpotTitle) {
    var names = [jackpotTitle].concat(PRIZE_LABELS);
    wheelSectorsEl.innerHTML = '';
    names.forEach(function (name, i) {
      var deg = i * segDeg + segDeg / 2;
      var sector = document.createElement('div');
      sector.className = 'wheel-sector' + (i === 0 ? ' jackpot' : '');
      sector.style.transform = 'rotate(' + deg + 'deg)';
      var span = document.createElement('span');
      span.textContent = name;
      sector.appendChild(span);
      wheelSectorsEl.appendChild(sector);
    });
  }

  // ---------- Огоньки вокруг колеса ----------
  var lightsRing = document.getElementById('lights-ring');
  var LIGHT_COUNT = 20;
  var LIGHT_PALETTE = ['#FFD166', '#00A0FA', '#66C6FC', '#0B0D12', '#33B4FB', '#ffffff'];
  var lightDots = [];

  function buildLights() {
    lightsRing.innerHTML = '';
    lightDots = [];
    var radius = wheelOuter.offsetWidth / 2 + 16;
    for (var li = 0; li < LIGHT_COUNT; li++) {
      var dot = document.createElement('div');
      dot.className = 'light-dot';
      var ang = ((360 / LIGHT_COUNT) * li * Math.PI) / 180;
      dot.style.left = Math.cos(ang) * radius + 'px';
      dot.style.top = Math.sin(ang) * radius + 'px';
      lightsRing.appendChild(dot);
      lightDots.push(dot);
    }
  }
  window.addEventListener('resize', buildLights);

  function setLightsIdle() {
    lightDots.forEach(function (d) {
      d.style.background = '#FFD166';
      d.style.boxShadow = '0 0 8px 2px rgba(255, 209, 102, 0.7)';
    });
  }

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
    var flashColors = ['#ffffff', '#FFD166'];
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

  // ---------- Тіканя указателя ----------
  var tickIntervalId = null;
  function startPointerTick() {
    pointerEl.classList.add('ticking');
    if (tickIntervalId) clearInterval(tickIntervalId);
    tickIntervalId = setInterval(function () { SoundEngine.tick(); }, 120);
  }
  function stopPointerTick() {
    pointerEl.classList.remove('ticking');
    if (tickIntervalId) {
      clearInterval(tickIntervalId);
      tickIntervalId = null;
    }
  }

  // ---------- Обертання колеса ----------
  var currentRotation = 0;

  function runRotationPhase(target, duration, easing, onPhaseDone) {
    var finished = false;
    var fallbackTimer = setTimeout(finish, duration + 300);

    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(fallbackTimer);
      wheelDisc.removeEventListener('transitionend', onTransitionEnd);
      onPhaseDone && onPhaseDone();
    }

    function onTransitionEnd(e) {
      if (!e || e.propertyName === 'transform') finish();
    }

    wheelDisc.addEventListener('transitionend', onTransitionEnd);
    wheelDisc.style.transition = 'transform ' + duration + 'ms ' + easing;
    void wheelDisc.offsetHeight; // форсуємо reflow, щоб зміна transition точно застосувалась до зміни transform
    wheelDisc.style.transform = 'rotate(' + target + 'deg)';
  }

  function spinToJackpot(onDone) {
    var spins = 6;
    var jitter = (Math.random() * 24) - 12; // лишаємось у межах сектору ДЖЕКПОТ (±22.5°)
    // Джекпот-сектор займає 0–45°; щоб його центр (22.5°) опинився під покажчиком (0° згори),
    // потрібно повернути колесо на -22.5° (з урахуванням повних обертів для ефекту).
    var finalTarget = 360 * spins - 22.5 + jitter;
    var teaseTarget = finalTarget - segDeg * 0.88;

    currentRotation = finalTarget;

    startPointerTick();
    startLightsChase();

    runRotationPhase(teaseTarget, 4200, 'cubic-bezier(0.12, 0.6, 0.08, 1)', function () {
      stopPointerTick();

      // Пауза "на межі" перед фінальним доворотом
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

  function setWheelInstant(deg) {
    wheelDisc.style.transition = 'none';
    wheelDisc.style.transform = 'rotate(' + deg + 'deg)';
    currentRotation = deg;
  }

  // ---------- Хвиля в заголовку ----------
  function renderWaveWord(word) {
    var el = document.getElementById('wave-word');
    el.innerHTML = '';
    word.split('').forEach(function (ch, i) {
      var span = document.createElement('span');
      span.textContent = ch;
      span.style.animationDelay = (i * 0.08) + 's';
      el.appendChild(span);
    });
  }

  // ---------- Факти ----------
  function renderFacts(config) {
    var grid = document.getElementById('facts-grid');
    grid.innerHTML = '';

    var yearsCard = document.createElement('div');
    yearsCard.className = 'fact-card dark';
    yearsCard.innerHTML =
      '<p class="fact-num">' + escapeHtml(config.anniversaryYears) + '</p>' +
      '<p class="fact-label">Років на ринку</p>' +
      '<p class="fact-text">Від першої гри до глобальної команди.</p>';
    grid.appendChild(yearsCard);

    var facts = (config.facts && config.facts.length ? config.facts : []).slice(0, 3);
    while (facts.length < 3) facts.push(null);

    facts.forEach(function (fact) {
      var card = document.createElement('div');
      card.className = 'fact-card';
      if (fact) {
        card.innerHTML =
          '<p class="fact-num">✦</p>' +
          '<p class="fact-text" style="font-size:14px; color:#3d454c; font-weight:600; margin-top:10px;">' +
          escapeHtml(fact) + '</p>';
      } else {
        card.innerHTML =
          '<p class="fact-num">···</p>' +
          '<p class="fact-label">Факт</p>' +
          '<p class="fact-text">Місце для цифри та історії — оновимо разом.</p>';
      }
      grid.appendChild(card);
    });
  }

  // ---------- Стан / API ----------
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
      message || 'Ти вже брав участь в акції. Колесо крутиться лише один раз.';
    var prizeBox = document.getElementById('used-prize');
    if (prize) {
      prizeBox.classList.remove('hidden');
      document.getElementById('used-prize-title').textContent = prize;
    } else {
      prizeBox.classList.add('hidden');
    }
    showScreen('used');
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function initContent(config) {
    var select = document.getElementById('country-select');
    config.countries.forEach(function (country) {
      var opt = document.createElement('option');
      opt.value = country;
      opt.textContent = country;
      select.appendChild(opt);
    });
    document.getElementById('domain-hint').textContent =
      'Доступно лише для пошти: ' + config.allowedDomainsHint;

    document.getElementById('anniv-pill-text').textContent = 'Нам ' + config.anniversaryYears + ' років';
    document.getElementById('hero-subtitle').textContent =
      config.anniversaryYears + ' років гри, драйву та перемог';
    document.getElementById('facts-subtitle').textContent =
      config.anniversaryYears + ' років — це багато історій. Ось декілька з них.';
    document.title = (config.companyName || 'Evoplay') + ' — ' + config.anniversaryYears + ' років';

    renderWaveWord((config.companyName || 'EVOPLAY').toUpperCase() + '!');
    renderSectors(config.superPrizeTitle || 'ДЖЕКПОТ');
    renderFacts(config);
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
        } else if (res.status === 409 && res.data.error === 'already_registered' && !res.data.spun) {
          showScreen('main');
        } else if (res.status === 409) {
          renderUsedScreen(res.data.message, res.data.prize);
        } else {
          errorEl.textContent = res.data.message || 'Щось пішло не так, спробуй ще раз.';
        }
      }
    ).catch(function () {
      errorEl.textContent = 'Не вдалося зв’язатися з сервером. Спробуй ще раз.';
    });
  });

  document.getElementById('spin-btn').addEventListener('click', function () {
    var btn = document.getElementById('spin-btn');
    btn.disabled = true;
    document.getElementById('spinning-text').classList.remove('hidden');
    SoundEngine.warmUp(); // ініціалізуємо AudioContext у межах кліку користувача

    api('/api/spin', { method: 'POST' }).then(function (res) {
      if (res.ok) {
        spinToJackpot(function () {
          launchConfetti();
          btn.classList.add('hidden');
          document.getElementById('spinning-text').classList.add('hidden');
          document.getElementById('result-prize').textContent = res.data.prize;
          document.getElementById('result-desc').textContent = res.data.description;
          document.getElementById('result-card').classList.remove('hidden');
        });
      } else if (res.status === 409) {
        document.getElementById('spinning-text').classList.add('hidden');
        renderUsedScreen(res.data.message, res.data.prize);
      } else {
        btn.disabled = false;
        document.getElementById('spinning-text').classList.add('hidden');
        alert(res.data.message || 'Не вдалося прокрутити колесо, спробуй пізніше.');
      }
    });
  });

  // ---------- Ініціалізація ----------
  Promise.all([api('/api/config'), api('/api/me')]).then(function (results) {
    var config = results[0].data;
    var me = results[1].data;

    initContent(config);

    if (me.registered && me.spun) {
      setWheelInstant(-segDeg / 2);
      renderUsedScreen('Ти вже брав участь в акції і прокрутив колесо.', me.prize);
    } else if (me.registered) {
      showScreen('main');
    } else {
      showScreen('gate');
    }
  });
})();
