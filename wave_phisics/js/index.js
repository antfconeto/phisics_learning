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
    overObstacle: null,
};

const obstacleDrag = {
    target: null,
    offsetI: 0,
    offsetJ: 0,
};

const obstacleSettings = {
    radius: 8,      // raio de um obstáculo novo, em células
    minRadius: 3,
    maxRadius: 40,
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
    obstacle: [],
    obstacles: [],
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

// cores das pedras (obstáculos): contrastam com o azul da água
const rock = {
    light: [231, 216, 181],
    base: [168, 142, 101],
    dark: [92, 74, 50],
};

function rgb(color) {
    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

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

            // células de obstáculo já na cor da pedra, para a borda suavizada não ficar azul
            const [r, g, b] = mesh.obstacle[i][j] ? rock.base : displacementColor(d[i][j], slope);
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

// Obstacles: a list of circles ({ i, j, radius }, in cells) and a grid
// (mesh.obstacle) rebuilt from that list, used by the wave update

function markObstacle(obstacle) {
    const { i: x, j: y, radius } = obstacle;

    for (let i = x - radius; i <= x + radius; i++) {
        for (let j = y - radius; j <= y + radius; j++) {
            if (i < 1 || j < 1 || i >= mesh.height || j >= mesh.width) continue;
            if ((i - x) ** 2 + (j - y) ** 2 <= radius ** 2) {
                mesh.obstacle[i][j] = true;
                mesh.displacement[i][j] = 0;
                if (mesh.displacementOld[i]) mesh.displacementOld[i][j] = 0;
                if (mesh.displacementNew[i]) mesh.displacementNew[i][j] = 0;
            }
        }
    }
}

function rebuildObstacles() {
    mesh.obstacle = Array.from({ length: mesh.height + 1 }, () =>
        Array(mesh.width + 1).fill(false),
    );
    mesh.obstacles.forEach(markObstacle);
}

function addObstacle(i, j, radius) {
    const obstacle = { i, j, radius };
    mesh.obstacles.push(obstacle);
    markObstacle(obstacle);
    return obstacle;
}

function removeObstacle(obstacle) {
    mesh.obstacles.splice(mesh.obstacles.indexOf(obstacle), 1);
    rebuildObstacles();
}

// the obstacle under cell (i, j); the last one added wins when they overlap
function obstacleAt(i, j) {
    for (let k = mesh.obstacles.length - 1; k >= 0; k--) {
        const o = mesh.obstacles[k];
        if ((i - o.i) ** 2 + (j - o.j) ** 2 <= o.radius ** 2) return o;
    }
    return null;
}

function defineObstacles() {
    mesh.obstacles = [];
    rebuildObstacles();

    addObstacle(60, 60, 8);
    addObstacle(140, 130, 12);
}

function drawObstacles() {
    for (const o of mesh.obstacles) {
        const x = meshLeft() + (o.j + 0.5) * mesh.cellWidth;
        const y = meshTop() + (o.i + 0.5) * mesh.cellHeight;
        const r = (o.radius + 0.5) * mesh.cellWidth;

        // pedra iluminada de cima à esquerda, como a água
        const stone = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
        stone.addColorStop(0, rgb(rock.light));
        stone.addColorStop(0.7, rgb(rock.base));
        stone.addColorStop(1, rgb(rock.dark));

        ctx.fillStyle = stone;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // espuma onde a água encosta na pedra
        ctx.strokeStyle = "rgba(224, 242, 254, 0.35)";
        ctx.lineWidth = 2;
        ctx.stroke();

        if (o === obstacleDrag.target || o === mouse.overObstacle) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.arc(x, y, r + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

// Functions for updating the mesh displacement and drawing the scene

function courantNumber() {
    return (mesh.c * mesh.dt) / mesh.dx;
}

function calculateInitialWave() {
    for (let i = 1; i < mesh.displacement.length - 1; i++) {
        for (let j = 1; j < mesh.displacement[0].length - 1; j++) {
            if (mesh.obstacle[i][j]) {
                mesh.displacementNew[i][j] = 0;
                continue;
            }

            mesh.displacementNew[i][j] =
                mesh.displacement[i][j] +
                (courantNumber() ** 2 / 2) *
                    (mesh.displacement[i + 1][j] +
                        mesh.displacement[i - 1][j] +
                        mesh.displacement[i][j + 1] +
                        mesh.displacement[i][j - 1] -
                        4 * mesh.displacement[i][j]);
        }
    }
}

function lossEnergy(){
    return 0.996
}

function calculateNextWave() {
    for (let i = 1; i < mesh.displacement.length - 1; i++) {
        for (let j = 1; j < mesh.displacement[0].length - 1; j++) {
            if (mesh.obstacle[i][j]) {
                mesh.displacementNew[i][j] = 0;
                continue;
            }

            mesh.displacementNew[i][j] =
                (2 * mesh.displacement[i][j] -
                    mesh.displacementOld[i][j] +
                    courantNumber() ** 2 *
                        (mesh.displacement[i + 1][j] +
                            mesh.displacement[i - 1][j] +
                            mesh.displacement[i][j + 1] +
                            mesh.displacement[i][j - 1] -
                            4 * mesh.displacement[i][j])) *
                lossEnergy();
        }
    }
}

function update() {
    if (mesh.step === 0) {
        mesh.displacementOld = mesh.displacement.map((row) => [...row]);
        mesh.displacementNew = mesh.displacement.map((row) => [...row]);
        calculateInitialWave();
    } else {
        mesh.displacementOld = mesh.displacement.map((row) => [...row]);
        mesh.displacement = mesh.displacementNew.map((row) => [...row]);
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
    ctx.fillText(
        `n = ${mesh.step}   obstáculos = ${mesh.obstacles.length}   E = ${totalEnergy().toFixed(0)}`,
        right, 96
    );
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
    if (mouse.overObstacle) {
        ctx.fillText(
            `obstáculo r = ${mouse.overObstacle.radius} · arraste: mover · roda: tamanho · botão direito: remover`,
            left + width / 2, top + 12
        );
    } else if (mouse.inside) {
        const u = mesh.displacement[mouse.i][mouse.j];
        const velocity = (u - mesh.displacementOld[mouse.i][mouse.j]) / mesh.dt;
        ctx.font = "11px monospace";
        ctx.fillText(
            `u(${mouse.j}, ${mouse.i}) = ${u.toFixed(2)}   ∂u/∂t = ${velocity.toFixed(2)}`,
            left + width / 2, top + 12
        );
    } else {
        ctx.fillText("clique: onda · shift + clique: obstáculo", left + width / 2, top + 12);
    }
}

function draw() {
    ctx.clearRect(0, 0, screen.width, screen.height);
    drawFormulas();
    drawMesh();
    drawObstacles();
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
            if (mesh.obstacle[i][j]) continue;

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

function eventCell(event) {
    const rect = cnv.getBoundingClientRect();
    const j = Math.floor(((event.clientX - rect.left) * (cnv.width / rect.width) - meshLeft()) / mesh.cellWidth);
    const i = Math.floor(((event.clientY - rect.top) * (cnv.height / rect.height) - meshTop()) / mesh.cellHeight);
    const inside = i >= 0 && j >= 0
        && i < mesh.displacement.length && j < mesh.displacement[0].length;
    return { i, j, inside };
}

function updateCursor() {
    if (obstacleDrag.target) cnv.style.cursor = "grabbing";
    else if (mouse.overObstacle) cnv.style.cursor = "grab";
    else cnv.style.cursor = mouse.inside ? "crosshair" : "default";
}

cnv.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;

    const { i, j, inside } = eventCell(event);
    if (!inside) return;

    // shift + clique: coloca um obstáculo novo
    if (event.shiftKey) {
        mouse.overObstacle = addObstacle(i, j, obstacleSettings.radius);
        updateCursor();
        return;
    }

    // clique em um obstáculo: começa a arrastá-lo
    const obstacle = obstacleAt(i, j);
    if (obstacle) {
        obstacleDrag.target = obstacle;
        obstacleDrag.offsetI = obstacle.i - i;
        obstacleDrag.offsetJ = obstacle.j - j;
        updateCursor();
        return;
    }

    mouse.pressed = true;
    const hit = addWave(event, pulse.amplitude);
    if (hit) rings.push({ x: hit.x, y: hit.y, radius: pulse.radius * mesh.cellWidth, alpha: 0.6 });
});

cnv.addEventListener("mousemove", (event) => {
    const { i, j, inside } = eventCell(event);

    mouse.i = i;
    mouse.j = j;
    mouse.inside = inside;

    if (obstacleDrag.target) {
        const target = obstacleDrag.target;
        target.i = Math.max(1, Math.min(mesh.height - 1, i + obstacleDrag.offsetI));
        target.j = Math.max(1, Math.min(mesh.width - 1, j + obstacleDrag.offsetJ));
        rebuildObstacles();
        return;
    }

    mouse.overObstacle = inside ? obstacleAt(i, j) : null;
    updateCursor();

    if (!mouse.pressed) return;

    // ao arrastar, só solta um pulso novo depois de andar algumas células
    if (Math.hypot(i - mouse.lastI, j - mouse.lastJ) < pulse.radius) return;

    addWave(event, pulse.dragAmplitude);
});

// botão direito em um obstáculo: remove
cnv.addEventListener("contextmenu", (event) => {
    const { i, j, inside } = eventCell(event);
    const obstacle = inside ? obstacleAt(i, j) : null;
    if (!obstacle) return;

    event.preventDefault();
    removeObstacle(obstacle);
    mouse.overObstacle = null;
    updateCursor();
});

// roda do mouse em um obstáculo: muda o tamanho
cnv.addEventListener("wheel", (event) => {
    if (!mouse.overObstacle) return;

    event.preventDefault();
    const o = mouse.overObstacle;
    o.radius = Math.max(
        obstacleSettings.minRadius,
        Math.min(obstacleSettings.maxRadius, o.radius + (event.deltaY < 0 ? 1 : -1)),
    );
    obstacleSettings.radius = o.radius; // o próximo obstáculo nasce com esse tamanho
    rebuildObstacles();
}, { passive: false });

cnv.addEventListener("mouseleave", () => {
    mouse.inside = false;
    if (!obstacleDrag.target) mouse.overObstacle = null;
    updateCursor();
});

window.addEventListener("mouseup", () => {
    mouse.pressed = false;
    obstacleDrag.target = null;
    updateCursor();
});
defineStartDisplacement();
defineObstacles();
loop();
