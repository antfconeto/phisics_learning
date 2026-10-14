const cnv = document.getElementById("cnv");
const ctx = cnv.getContext("2d");

const screen = {
    width: cnv.width,
    height: cnv.height,
};

let mousePosition = {
    x:0,
    y:0
}

const mouse = {
    pressed: false,
    inside: false,
    i: 0,
    j: 0,
    lastI: -1,
    lastJ: -1,
};

const pulse = {
    amplitude: 40,
    radius: 4,         // raio do "morrinho" gaussiano, em células
    dragAmplitude: 12, // pulsos menores ao arrastar o mouse
};

const look = {
    stepsPerFrame: 2,
    colorScale: 6,     // deslocamento que já aparece como crista/vale "cheio"
    lightStrength: 0.15,
};

// anéis decorativos que acompanham a frente de onda de cada clique
const rings = [];

const mesh = {
    width: 200,
    height: 200,
    cellWidth: 3,
    cellHeight: 3,
    displacement: [],
    displacementOld: [],
    displacementNew: [],
    c: 0.3,
    dt: 1,
    dx: 1,
    maxDisplacement: 150,
    step: 0,
};

// Define the initial displacement of the mesh

function defineStartDisplacement() {
    const centerX = mesh.width / 2;
    const centerY = mesh.height / 2;
    const radius = pulse.radius;

    // pulso gaussiano: um ponto único gera ruído quadriculado na malha
    mesh.displacement = Array.from({ length: mesh.height + 1 }, (_, y) =>
        Array.from({ length: mesh.width + 1 }, (_, x) => {
            const distance2 = (x - centerX) ** 2 + (y - centerY) ** 2;

            return pulse.amplitude * Math.exp(-distance2 / (2 * radius ** 2));
        }),
    );

    mesh.step = 0;
}

// cores da água: vale escuro → repouso → crista clara
const palette = {
    trough: [2, 6, 23],
    rest: [10, 37, 82],
    crest: [125, 211, 252],
};

function mix(a, b, t) {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
    ];
}

function displacementColor(d, slope) {
    // tanh suaviza: ondas pequenas aparecem, ondas grandes não estouram a cor
    const v = Math.tanh(d / look.colorScale);
    let color = v >= 0
        ? mix(palette.rest, palette.crest, v)
        : mix(palette.rest, palette.trough, -v);

    // luz vindo de cima à esquerda: encostas viradas para ela ficam mais claras
    const light = Math.max(-1, Math.min(1, slope * look.lightStrength));
    const shade = 1 + 0.6 * light;
    const specular = 255 * Math.max(0, light) ** 3;

    return [
        Math.min(255, color[0] * shade + specular),
        Math.min(255, color[1] * shade + specular),
        Math.min(255, color[2] * shade + specular),
    ];
}

// canvas auxiliar do tamanho da malha: cada pixel é uma célula
const buffer = document.createElement("canvas");
buffer.width = mesh.width + 1;
buffer.height = mesh.height + 1;
const bufferCtx = buffer.getContext("2d");
const image = bufferCtx.createImageData(buffer.width, buffer.height);
function meshLeft() {
    return Math.round(
        screen.width / 2 - (mesh.displacement[0].length * mesh.cellWidth) / 2,
    );
}

function meshTop() {
    return 110;
}

function drawMesh() {
    const d = mesh.displacement;
    const rows = d.length;
    const cols = d[0].length;
    const data = image.data;

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            // inclinação na direção da luz (de cima à esquerda)
            const left = d[i][Math.max(0, j - 1)];
            const right = d[i][Math.min(cols - 1, j + 1)];
            const up = d[Math.max(0, i - 1)][j];
            const down = d[Math.min(rows - 1, i + 1)][j];
            const slope = (left - right) + (up - down);

            const [r, g, b] = displacementColor(d[i][j], slope);
            const k = (i * cols + j) * 4;
            data[k] = r;
            data[k + 1] = g;
            data[k + 2] = b;
            data[k + 3] = 255;
        }
    }
    bufferCtx.putImageData(image, 0, 0);

    const width = cols * mesh.cellWidth;
    const height = rows * mesh.cellHeight;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(buffer, meshLeft(), meshTop(), width, height);

    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(meshLeft(), meshTop(), width, height);
}

function drawRings() {
    const width = mesh.displacement[0].length * mesh.cellWidth;
    const height = mesh.displacement.length * mesh.cellHeight;
    // a frente de onda anda c células por passo
    const speed = mesh.c * (mesh.dt / mesh.dx) * mesh.cellWidth * look.stepsPerFrame;

    ctx.save();
    ctx.beginPath();
    ctx.rect(meshLeft(), meshTop(), width, height);
    ctx.clip();

    for (let k = rings.length - 1; k >= 0; k--) {
        const ring = rings[k];
        ring.radius += speed;
        ring.alpha *= 0.92;

        if (ring.alpha < 0.02) {
            rings.splice(k, 1);
            continue;
        }

        ctx.strokeStyle = `rgba(224, 242, 254, ${ring.alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
}

// Functions for updating the mesh displacement and drawing the scene

function courantNumber() {
    return (mesh.c * mesh.dt) / mesh.dx;
}

function calculateInitialWave() {
    for (let i = 1; i < mesh.displacement.length - 1; i++) {
        for (let j = 1; j < mesh.displacement[0].length - 1; j++) {
            mesh.displacementNew[i][j] = mesh.displacement[i][j] + ((courantNumber() ** 2) / 2) * (
                mesh.displacement[i+1][j] +
                mesh.displacement[i-1][j] +
                mesh.displacement[i][j+1] +
                mesh.displacement[i][j-1] -
                4 * mesh.displacement[i][j]
            );
        }
    }
}

function lossEnergy(){
    return 0.996
}

function calculateNextWave() {
    for (let i = 1; i < mesh.displacement.length - 1; i++) {
        for (let j = 1; j < mesh.displacement[0].length - 1; j++) {
            mesh.displacementNew[i][j] = ((2 * mesh.displacement[i][j]) - mesh.displacementOld[i][j] + ((courantNumber() ** 2) * (
                mesh.displacement[i+1][j] +
                mesh.displacement[i-1][j] +
                mesh.displacement[i][j+1] +
                mesh.displacement[i][j-1] -
                4 * mesh.displacement[i][j]
            ))) * lossEnergy();    
        }
    }
}

function update() {
    if (mesh.step === 0) {
        mesh.displacementOld = mesh.displacement.map(row => [...row]);
        mesh.displacementNew = mesh.displacement.map(row => [...row]);
        calculateInitialWave();
    } else {
        mesh.displacementOld = mesh.displacement.map(row => [...row]);
        mesh.displacement = mesh.displacementNew.map(row => [...row]);
        calculateNextWave();
    }

    mesh.step++;
}

// energia discreta: cinética (∂u/∂t)² + potencial c²|∇u|², somadas na malha.
// Só cai por causa do amortecimento γ; as bordas fixas refletem sem perder.
function totalEnergy() {
    const u = mesh.displacement;
    const uOld = mesh.displacementOld;
    const c2 = mesh.c ** 2;
    let sum = 0;

    for (let i = 0; i < u.length - 1; i++) {
        for (let j = 0; j < u[0].length - 1; j++) {
            const velocity = (u[i][j] - uOld[i][j]) / mesh.dt;
            const gradX = (u[i][j + 1] - u[i][j]) / mesh.dx;
            const gradY = (u[i + 1][j] - u[i][j]) / mesh.dx;
            sum += 0.5 * (velocity ** 2 + c2 * (gradX ** 2 + gradY ** 2));
        }
    }
    return sum;
}

function drawFormulas() {
    const left = meshLeft();
    const right = screen.width - left;

    ctx.fillStyle = "black";
    ctx.textBaseline = "alphabetic";

    ctx.textAlign = "left";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("Ondas 2D", left, 28);

    ctx.textAlign = "right";
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#666";
    ctx.fillText("bordas fixas · com amortecimento", right, 28);

    ctx.fillStyle = "black";
    ctx.font = "italic 15px serif";
    ctx.textAlign = "left";
    ctx.fillText("∂²u/∂t² = c² · ∇²u", left, 52);
    ctx.textAlign = "right";
    ctx.fillText("C = c · Δt / Δx", right, 52);

    ctx.textAlign = "left";
    ctx.fillText(
        "uᵢ,ⱼⁿ⁺¹ = γ · [2uᵢ,ⱼⁿ − uᵢ,ⱼⁿ⁻¹ + C² · (uᵢ₊₁,ⱼ + uᵢ₋₁,ⱼ + uᵢ,ⱼ₊₁ + uᵢ,ⱼ₋₁ − 4uᵢ,ⱼ)]",
        left, 74
    );

    ctx.font = "11px monospace";
    ctx.fillStyle = "#666";
    ctx.fillText(
        `C = ${courantNumber().toFixed(2)} (estável se C ≤ 1/√2)   γ = ${lossEnergy()}`,
        left, 96
    );
    ctx.textAlign = "right";
    ctx.fillText(`n = ${mesh.step}   E = ${totalEnergy().toFixed(0)}`, right, 96);
}

function drawLegend() {
    const left = meshLeft();
    const width = mesh.displacement[0].length * mesh.cellWidth;
    const top = meshTop() + mesh.displacement.length * mesh.cellHeight + 14;

    // mesma escala de cores da malha (sem a iluminação), de vale a crista
    const gradient = ctx.createLinearGradient(left, 0, left + width, 0);
    for (let s = 0; s <= 1; s += 0.125) {
        const [r, g, b] = displacementColor((s * 2 - 1) * look.colorScale * 2, 0);
        gradient.addColorStop(s, `rgb(${r}, ${g}, ${b})`);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(left, top, width, 8);

    ctx.fillStyle = "#666";
    ctx.font = "11px sans-serif";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText("vale (u < 0)", left, top + 12);
    ctx.textAlign = "right";
    ctx.fillText("crista (u > 0)", left + width, top + 12);

    ctx.textAlign = "center";
    if (mouse.inside) {
        const u = mesh.displacement[mouse.i][mouse.j];
        const velocity = (u - mesh.displacementOld[mouse.i][mouse.j]) / mesh.dt;
        ctx.font = "11px monospace";
        ctx.fillText(
            `u(${mouse.j}, ${mouse.i}) = ${u.toFixed(2)}   ∂u/∂t = ${velocity.toFixed(2)}`,
            left + width / 2, top + 12
        );
    } else {
        ctx.fillText("clique e arraste para criar ondas", left + width / 2, top + 12);
    }
}

function draw() {
    ctx.clearRect(0, 0, screen.width, screen.height);
    drawFormulas();
    drawMesh();
    drawRings();
    drawLegend();
}

function loop() {
    for (let s = 0; s < look.stepsPerFrame; s++) update();
    draw();
    requestAnimationFrame(loop);
}

// soma um "morrinho" gaussiano em repouso: entra igual no passo atual e no
// próximo (displacementNew vira o atual no update), então nasce sem velocidade
function addBump(centerI, centerJ, amplitude) {
    const rows = mesh.displacement.length;
    const cols = mesh.displacement[0].length;
    const reach = pulse.radius * 3;

    for (let i = Math.max(1, centerI - reach); i <= Math.min(rows - 2, centerI + reach); i++) {
        for (let j = Math.max(1, centerJ - reach); j <= Math.min(cols - 2, centerJ + reach); j++) {
            const distance2 = (i - centerI) ** 2 + (j - centerJ) ** 2;
            const bump = amplitude * Math.exp(-distance2 / (2 * pulse.radius ** 2));
            mesh.displacement[i][j] += bump;
            mesh.displacementNew[i][j] += bump;
        }
    }
}

function addWave(event, amplitude) {
    const rect = cnv.getBoundingClientRect();
    const canvasX = (event.clientX - rect.left) * (cnv.width / rect.width);
    const canvasY = (event.clientY - rect.top) * (cnv.height / rect.height);
    const x = canvasX - meshLeft();
    const y = canvasY - meshTop();

    const j = Math.floor(x / mesh.cellWidth);
    const i = Math.floor(y / mesh.cellHeight);

    if (i < 1 || j < 1 || i >= mesh.displacement.length - 1 || j >= mesh.displacement[0].length - 1) return false;

    addBump(i, j, amplitude);
    mouse.lastI = i;
    mouse.lastJ = j;
    return { x: canvasX, y: canvasY };
}

cnv.addEventListener("mousedown", (event) => {
    mouse.pressed = true;
    const hit = addWave(event, pulse.amplitude);
    if (hit) rings.push({ x: hit.x, y: hit.y, radius: pulse.radius * mesh.cellWidth, alpha: 0.6 });
});

cnv.addEventListener("mousemove", (event) => {
    const rect = cnv.getBoundingClientRect();
    const j = Math.floor(((event.clientX - rect.left) * (cnv.width / rect.width) - meshLeft()) / mesh.cellWidth);
    const i = Math.floor(((event.clientY - rect.top) * (cnv.height / rect.height) - meshTop()) / mesh.cellHeight);

    mouse.i = i;
    mouse.j = j;
    mouse.inside = i >= 0 && j >= 0
        && i < mesh.displacement.length && j < mesh.displacement[0].length;

    if (!mouse.pressed) return;

    // ao arrastar, só solta um pulso novo depois de andar algumas células
    if (Math.hypot(i - mouse.lastI, j - mouse.lastJ) < pulse.radius) return;

    addWave(event, pulse.dragAmplitude);
});
cnv.addEventListener("mouseleave", () => mouse.inside = false);

window.addEventListener("mouseup", () => mouse.pressed = false);
defineStartDisplacement();
loop();
