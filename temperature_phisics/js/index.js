
const cnv = document.getElementById("cnv");
const ctx = cnv.getContext("2d");

const screen = {
    width: cnv.width,
    height: cnv.height
};

const pipe = {
    width: 200,
    height: 60,
    cellWidth: 2,
    temperature: [],
    alpha: 0.1,
    dt: 1,
    dx: 1,
    maxTemperature: 150,
    step: 0
};

const arrows = {
    spacing: 20,      // de quantas em quantas células desenhar uma seta
    gradientSpan: 4,  // vizinhança usada para estimar dT/dx
    maxLength: 18,
    scale: 6          // pixels por unidade de fluxo
};

function defineInitialTemperature() {
    pipe.temperature = Array.from(
        { length: pipe.width + 1 },
        (_, x) => x > 40 && x < 80 ? pipe.maxTemperature : 10
    );
    pipe.step = 0;
}

function update() {
    const old = pipe.temperature;
    const next = old.slice();

    const r = pipe.alpha * pipe.dt / (pipe.dx ** 2);

 
    for (let i = 1; i < old.length - 1; i++) {
        next[i] = old[i] + r * (
            old[i + 1] - 2 * old[i] + old[i - 1]
        );
    }

    pipe.temperature = next;
    pipe.step++;
}

function temperatureColor(t) {
    const hue = (1 - t / pipe.maxTemperature) * 240;
    return `hsl(${hue}, 100%, 50%)`;
}

function pipeLeft() {
    return screen.width / 2 - (pipe.temperature.length * pipe.cellWidth) / 2;
}

function pipeTop() {
    return 300;
}

function cellCenterX(i) {
    return pipeLeft() + i * pipe.cellWidth + pipe.cellWidth / 2;
}

function drawFormulas() {
    const r = pipe.alpha * pipe.dt / (pipe.dx ** 2);

    ctx.fillStyle = "black";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.font = "bold 16px sans-serif";
    ctx.fillText("Equação do calor (1D)", 20, 30);

    ctx.font = "italic 18px serif";
    ctx.fillText("∂T/∂t = α · ∂²T/∂x²", 40, 60);

    ctx.font = "bold 16px sans-serif";
    ctx.fillText("Diferenças finitas (explícito)", 20, 95);

    ctx.font = "italic 18px serif";
    ctx.fillText("Tᵢⁿ⁺¹ = Tᵢⁿ + r · (Tᵢ₊₁ⁿ − 2Tᵢⁿ + Tᵢ₋₁ⁿ)", 40, 125);
    ctx.fillText("r = α · Δt / Δx²", 40, 152);

    ctx.font = "bold 16px sans-serif";
    ctx.fillText("Fluxo de calor (Lei de Fourier)", 20, 187);

    ctx.font = "italic 18px serif";
    ctx.fillText("q = −k · ∂T/∂x", 40, 215);

    ctx.font = "13px monospace";
    ctx.fillStyle = "#444";
    ctx.fillText(
        `α = ${pipe.alpha}   Δt = ${pipe.dt}   Δx = ${pipe.dx}   r = ${r.toFixed(2)}   n = ${pipe.step}`,
        20, 245
    );
}

function drawPipe() {
    for (let i = 0; i < pipe.temperature.length; i++) {
        ctx.fillStyle = temperatureColor(pipe.temperature[i]);
        ctx.fillRect(
            pipeLeft() + i * pipe.cellWidth,
            pipeTop(),
            pipe.cellWidth,
            pipe.height
        );
    }

    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(
        pipeLeft(),
        pipeTop(),
        pipe.temperature.length * pipe.cellWidth,
        pipe.height
    );
}

function drawArrow(x1, y, x2, color) {
    const dir = Math.sign(x2 - x1);
    const head = 6;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2 - dir * head, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y);
    ctx.lineTo(x2 - dir * head, y - head / 1.5);
    ctx.lineTo(x2 - dir * head, y + head / 1.5);
    ctx.closePath();
    ctx.fill();
}

function drawTemperatureArrows() {
    const T = pipe.temperature;
    const top = pipeTop();
    const bottom = top + pipe.height;

    ctx.textAlign = "center";
    ctx.font = "11px monospace";

    for (let i = arrows.spacing / 2; i < T.length; i += arrows.spacing) {
        const x = cellCenterX(i);
        const t = T[i];

        // seta indicando o ponto onde a temperatura é lida
        ctx.fillStyle = "black";
        ctx.textBaseline = "bottom";
        ctx.fillText(`${t.toFixed(0)}°`, x, top - 14);
        drawVerticalMarker(x, top - 12, top - 2);

        // fluxo de calor: q ∝ −dT/dx (vai do quente para o frio)
        const a = Math.max(0, i - arrows.gradientSpan);
        const b = Math.min(T.length - 1, i + arrows.gradientSpan);
        const gradient = (T[b] - T[a]) / ((b - a) * pipe.dx);
        const flux = -gradient;

        let length = flux * arrows.scale;
        length = Math.max(-arrows.maxLength, Math.min(arrows.maxLength, length));

        const y = bottom + 20;
        if (Math.abs(length) > 1.5) {
            drawArrow(x - length / 2, y, x + length / 2, temperatureColor(t));
        } else {
            ctx.fillStyle = "#999";
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = "#444";
        ctx.textBaseline = "top";
        ctx.fillText(flux.toFixed(1), x, y + 10);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#444";
    ctx.fillText("setas: direção e intensidade do fluxo de calor q = −dT/dx", 20, bottom + 50);
}

function drawVerticalMarker(x, y1, y2) {
    ctx.strokeStyle = "black";
    ctx.fillStyle = "black";
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2 - 4);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y2);
    ctx.lineTo(x - 3, y2 - 4);
    ctx.lineTo(x + 3, y2 - 4);
    ctx.closePath();
    ctx.fill();
}

function drawProfile() {
    const T = pipe.temperature;
    const top = 440;
    const height = 130;
    const left = pipeLeft();
    const width = T.length * pipe.cellWidth;

    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, width, height);

    ctx.fillStyle = "#444";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("T(x)", left, top - 4);

    ctx.strokeStyle = "black";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < T.length; i++) {
        const x = cellCenterX(i);
        const y = top + height - (T[i] / pipe.maxTemperature) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}

function draw() {
    ctx.clearRect(0, 0, screen.width, screen.height);

    drawFormulas();
    drawPipe();
    drawTemperatureArrows();
    drawProfile();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

defineInitialTemperature();
loop();
