/* ============================================================
   script.js  —  all the BEHAVIOR
   1. Show the real Pacific time on the clock
   2. Swing the pendulum, and make the cat's eyes follow it
   3. Count down to August 8th
   4. On August 8th: zeros + birthday hat + confetti
   ============================================================ */

/* ---- The time zone we count down in. Using this NAMED zone means the
        browser automatically uses PST in winter and PDT in summer, so the
        countdown is never an hour off. ---- */
const TIME_ZONE = "America/Los_Angeles";

/* ---- Grab the pieces of the page we need to control ---- */
const pendulum   = document.getElementById("pendulum");
const leftPupil  = document.getElementById("leftPupil");
const rightPupil = document.getElementById("rightPupil");
const hourHand   = document.getElementById("hourHand");
const minuteHand = document.getElementById("minuteHand");
const secondHand = document.getElementById("secondHand");
const tDays      = document.getElementById("tDays");
const tHours     = document.getElementById("tHours");
const tMins      = document.getElementById("tMins");
const tSecs      = document.getElementById("tSecs");
const caption    = document.getElementById("caption");
const catHat     = document.getElementById("catHat");
const canvas     = document.getElementById("confetti");
const ctx        = canvas.getContext("2d");

/* Where the clock hands and pendulum pivot (matches the SVG drawing) */
const CLOCK_CENTER = { x: 200, y: 160 };
const PENDULUM_PIVOT = { x: 200, y: 288 };

/* How the pendulum/eyes move */
const SWING_PERIOD = 2.6;   // seconds for one full left-right-left swing
const SWING_ANGLE  = 13;    // how far the pendulum tips, in degrees
const EYE_TRAVEL   = 16;    // how far the pupils slide left/right, in SVG units
const EYE_LOOK_UP  = 22;    // how far the pupils lift UP toward the pendulum

/* ============================================================
   STEP 1 — Build the clock's tick marks and 12/3/6/9 numbers
   (done once, when the page loads)
   ============================================================ */
(function buildClockFace() {
  const ticks = document.getElementById("clockTicks");
  const svgNS = "http://www.w3.org/2000/svg";

  for (let i = 0; i < 12; i++) {
    const angle = (i * 30) * Math.PI / 180;          // 30 degrees apart
    const sin = Math.sin(angle), cos = Math.cos(angle);
    const big = i % 3 === 0;                          // bigger tick at 12/3/6/9

    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", CLOCK_CENTER.x + sin * 104);
    line.setAttribute("y1", CLOCK_CENTER.y - cos * 104);
    line.setAttribute("x2", CLOCK_CENTER.x + sin * (big ? 86 : 94));
    line.setAttribute("y2", CLOCK_CENTER.y - cos * (big ? 86 : 94));
    line.setAttribute("stroke", "#3a2a55");
    line.setAttribute("stroke-width", big ? 6 : 3);
    line.setAttribute("stroke-linecap", "round");
    ticks.appendChild(line);
  }

  // the four main numbers
  [["12", 0, -70], ["3", 70, 6], ["6", 0, 80], ["9", -70, 6]].forEach(([num, dx, dy]) => {
    const t = document.createElementNS(svgNS, "text");
    t.setAttribute("x", CLOCK_CENTER.x + dx);
    t.setAttribute("y", CLOCK_CENTER.y + dy);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("font-family", "Orbitron, monospace");
    t.setAttribute("font-weight", "700");
    t.setAttribute("font-size", "26");
    t.setAttribute("fill", "#3a2a55");
    t.textContent = num;
    ticks.appendChild(t);
  });
})();

/* ============================================================
   TIME HELPERS — getting the real Pacific time
   ============================================================ */

/* Read the current Pacific time as plain numbers (year, month, day, h, m, s). */
function getPacificParts(epochMs) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
    hour12: false,
  });
  const parts = {};
  for (const p of formatter.formatToParts(new Date(epochMs))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  if (parts.hour === 24) parts.hour = 0;   // some browsers say 24 at midnight
  return parts;
}

/* How many milliseconds Pacific time is offset from UTC at a given moment.
   (This quietly handles daylight-saving time for us.) */
function pacificOffsetMs(epochMs) {
  const d = new Date(epochMs);
  const asUTC = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  const asPac = new Date(d.toLocaleString("en-US", { timeZone: TIME_ZONE }));
  return asUTC - asPac;
}

/* Turn a Pacific "wall clock" date (e.g. Aug 8, 00:00 Pacific) into a real
   moment in time we can subtract from "now". */
function pacificWallTimeToEpoch(year, month, day, hour, min, sec) {
  let epoch = Date.UTC(year, month - 1, day, hour, min, sec);
  // run twice so we stay correct right at a daylight-saving switch
  for (let i = 0; i < 2; i++) {
    epoch = Date.UTC(year, month - 1, day, hour, min, sec) + pacificOffsetMs(epoch);
  }
  return epoch;
}

/* The moment of the next August 8th (this year, or next year if it already passed). */
function nextBirthdayEpoch(nowMs) {
  const p = getPacificParts(nowMs);
  let year = p.year;
  const afterThisYears8th = p.month > 8 || (p.month === 8 && p.day > 8);
  if (afterThisYears8th) year += 1;
  return pacificWallTimeToEpoch(year, 8, 8, 0, 0, 0);
}

/* Is it August 8th right now (Pacific time)? */
function isBirthdayToday(nowMs) {
  const p = getPacificParts(nowMs);
  return p.month === 8 && p.day === 8;
}

/* ============================================================
   STEP 2 — The smooth animation loop:
   pendulum swing, the cat's eyes, and the moving clock hands.
   This runs ~60 times a second.
   ============================================================ */
function animate(timestampMs) {
  const seconds = timestampMs / 1000;

  // a value that smoothly goes -1 → +1 → -1 ... like a pendulum
  const phase = Math.sin((2 * Math.PI * seconds) / SWING_PERIOD);

  // swing the pendulum
  const swing = phase * SWING_ANGLE;
  pendulum.setAttribute("transform", `rotate(${swing} ${PENDULUM_PIVOT.x} ${PENDULUM_PIVOT.y})`);

  // Make BOTH eyes look UP at the pendulum, and slide to follow the bob.
  // Note: a positive swing rotates the bob to the LEFT, so the pupils must
  // shift by the OPPOSITE sign to actually point at it. (negative Y = up)
  const eyeShift = -phase * EYE_TRAVEL;
  leftPupil.setAttribute("transform", `translate(${eyeShift} ${-EYE_LOOK_UP})`);
  rightPupil.setAttribute("transform", `translate(${eyeShift} ${-EYE_LOOK_UP})`);

  // set the clock hands to the real Pacific time
  const now = Date.now();
  const t = getPacificParts(now);
  const ms = now % 1000;                                  // for a smooth second hand
  const secAngle  = (t.second + ms / 1000) * 6;           // 360 / 60
  const minAngle  = (t.minute + t.second / 60) * 6;
  const hourAngle = ((t.hour % 12) + t.minute / 60) * 30; // 360 / 12

  hourHand.setAttribute("transform",   `rotate(${hourAngle} ${CLOCK_CENTER.x} ${CLOCK_CENTER.y})`);
  minuteHand.setAttribute("transform", `rotate(${minAngle} ${CLOCK_CENTER.x} ${CLOCK_CENTER.y})`);
  secondHand.setAttribute("transform", `rotate(${secAngle} ${CLOCK_CENTER.x} ${CLOCK_CENTER.y})`);

  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

/* ============================================================
   STEP 3 — The countdown text + birthday check.
   This runs about 4 times a second (plenty for a ticking timer).
   ============================================================ */
function pad(n, width = 2) {
  return String(n).padStart(width, "0");
}

let birthdayActive = false;   // remembers whether confetti is already running

function updateCountdown() {
  const now = Date.now();

  if (isBirthdayToday(now)) {
    // 🎉 IT'S THE BIG DAY 🎉
    tDays.textContent = "000";
    tHours.textContent = "00";
    tMins.textContent = "00";
    tSecs.textContent = "00";
    caption.textContent = "🎉 HAPPY BIRTHDAY CHIANTI! 🎉";
    catHat.style.display = "block";
    document.body.classList.add("party");
    if (!birthdayActive) {
      birthdayActive = true;
      startConfetti();
    }
    return;
  }

  // Otherwise: show the time left until August 8th
  const msLeft = Math.max(0, nextBirthdayEpoch(now) - now);
  const totalSeconds = Math.floor(msLeft / 1000);
  const days    = Math.floor(totalSeconds / 86400);
  const hours   = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs    = totalSeconds % 60;

  tDays.textContent  = pad(days);
  tHours.textContent = pad(hours);
  tMins.textContent  = pad(minutes);
  tSecs.textContent  = pad(secs);
  caption.textContent = "🎂 COUNTDOWN TO CHIANTI'S BIRTHDAY 🎂";
  catHat.style.display = "none";
  document.body.classList.remove("party");
  birthdayActive = false;
}

updateCountdown();
setInterval(updateCountdown, 250);

/* ============================================================
   STEP 4 — The confetti (only used on August 8th)
   Lots of little colored squares that fall and twirl down the screen.
   ============================================================ */
let confettiPieces = [];
let confettiRunning = false;
const PARTY_COLORS = ["#ff4d9d", "#ffd34d", "#39ff14", "#6be3ff", "#b66bff", "#ff7a3d", "#ffffff"];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function startConfetti() {
  // make a big batch of confetti, scattered above the screen
  confettiPieces = [];
  for (let i = 0; i < 280; i++) {
    confettiPieces.push(makeConfettiPiece(true));
  }
  if (!confettiRunning) {
    confettiRunning = true;
    requestAnimationFrame(drawConfetti);
  }
}

// "spread" = true means start scattered everywhere (initial burst);
// otherwise the piece starts just above the top, ready to fall in.
function makeConfettiPiece(spread) {
  const i = confettiPieces.length;          // used to vary pieces without randomness gaps
  return {
    x: ((i * 73) % window.innerWidth),
    y: spread ? ((i * 137) % window.innerHeight) - window.innerHeight
              : -20 - ((i * 53) % 200),
    size: 7 + ((i * 13) % 9),
    color: PARTY_COLORS[i % PARTY_COLORS.length],
    speedY: 1.6 + ((i % 7) * 0.45),
    swayAmount: 14 + (i % 10),
    swaySpeed: 0.6 + (i % 5) * 0.25,
    spin: ((i % 12) - 6) * 0.04,
    angle: i,
    phase: i % 100,
  };
}

function drawConfetti(timestampMs) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!confettiRunning) return;

  const t = timestampMs / 1000;
  for (const p of confettiPieces) {
    // fall down, and sway gently side to side
    p.y += p.speedY;
    p.x += Math.sin(t * p.swaySpeed + p.phase) * (p.swayAmount * 0.06);
    p.angle += p.spin;

    // once it falls off the bottom, send it back to the top to fall again
    if (p.y > canvas.height + 20) {
      p.y = -20;
      p.x = (p.x + 137) % canvas.width;
    }

    // draw the little spinning square
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    ctx.restore();
  }

  requestAnimationFrame(drawConfetti);
}

/* ---- A tiny test helper ----
   August 8th is far away, so to SEE the birthday version right now,
   open the page, then in the browser's Console type:   testBirthday()
   Reload the page to go back to normal. */
window.testBirthday = function () {
  tDays.textContent = "000";
  tHours.textContent = "00";
  tMins.textContent = "00";
  tSecs.textContent = "00";
  caption.textContent = "🎉 HAPPY BIRTHDAY CHIANTI! 🎉";
  catHat.style.display = "block";
  document.body.classList.add("party");
  startConfetti();
};
