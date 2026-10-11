
const cnv = document.getElementById("cnv");
const ctx = cnv.getContext("2d");

const screen = {
    width: cnv.width,
    height: cnv.height
};

const sheet = {
    width: 80,
    height: 80,
    cellWidth: 5,
    cellHeight:5,
    temperature: [],
    alpha: 0.2,
    dt: 1,
    dx: 1,
    maxTemperature: 150,
    step: 0
};

const arrows = {
    spacing: 8,       // de quantas em quantas células desenhar uma seta
    gradientSpan: 2,  // vizinhança usada para estimar ∇T
    maxLength: 18,
    scale: 4          // pixels por unidade de fluxo
};

const mouse = {
    inside: false,
    i: 0,
    j: 0
};

function defineInitialTemperature() {
    const centerX = sheet.width / 2;
    const centerY = sheet.height / 2;
    const radius = 20;

    sheet.temperature = Array.from(
        { length: sheet.height + 1 },
        (_, y) => Array.from(
            { length: sheet.width + 1 },
            (_, x) => {
                const distance = Math.sqrt(
                    (x - centerX) ** 2 + (y - centerY) ** 2
                );

                return distance <= radius
                    ? sheet.maxTemperature
                    : 10;
            }
        )
    );

    sheet.step = 0;
}


function update() {
    const old = sheet.temperature;
    const next = old.map(row => row.slice());

    const r = sheet.alpha * sheet.dt / (sheet.dx ** 2);

 
    for (let i = 1; i < old.length - 1; i++) {
        for(let j = 1; j < old[0].length - 1; j++){
            var devX = old[i][j+1] - 2 * old[i][j] + old[i][j-1]
            var devY = old[i+1][j] - 2 * old[i][j] + old[i-1][j]
            next[i][j] = old[i][j] + r * (devX + devY)
        }

    }

    const lastI = next.length - 1;
    const lastJ = next[0].length - 1;
    for (let i = 0; i <= lastI; i++) {
        next[i][0] = next[i][1];
        next[i][lastJ] = next[i][lastJ - 1];
    }
    for (let j = 0; j <= lastJ; j++) {
        next[0][j] = next[1][j];
        next[lastI][j] = next[lastI - 1][j];
    }

    sheet.temperature = next;
    sheet.step++;
}

function totalEnergy() {
    const T = sheet.temperature;
    let sum = 0;
    for (let i = 1; i < T.length - 1; i++) {
        for (let j = 1; j < T[0].length - 1; j++) {
            sum += T[i][j];
        }
    }
    return sum;
}

function temperatureColor(t) {
    const hue = (1 - t / sheet.maxTemperature) * 240;
    return `hsl(${hue}, 100%, 50%)`;
}

function sheetLeft() {
    return Math.round(screen.width / 2 - (sheet.temperature[0].length * sheet.cellWidth) / 2);
}

function sheetTop() {
    return 110;
}

function drawSheet() {
    for (let i = 0; i < sheet.temperature.length; i++) {
        for(let j = 0; j < sheet.temperature[0].length; j++){
            ctx.fillStyle = temperatureColor(sheet.temperature[i][j]);
            ctx.fillRect(
                sheetLeft() + j * sheet.cellWidth,
                sheetTop() + i * sheet.cellHeight,
                sheet.cellWidth,
                sheet.cellHeight
            );
        }
    }

    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(
        sheetLeft(),
        sheetTop(),
        sheet.temperature[0].length * sheet.cellWidth,
        sheet.temperature.length * sheet.cellHeight
    );
}

function gradientAt(i, j) {
    const T = sheet.temperature;
    const span = arrows.gradientSpan;

    const left = Math.max(0, j - span);
    const right = Math.min(T[0].length - 1, j + span);
    const up = Math.max(0, i - span);
    const down = Math.min(T.length - 1, i + span);

    return {
        x: (T[i][right] - T[i][left]) / ((right - left) * sheet.dx),
        y: (T[down][j] - T[up][j]) / ((down - up) * sheet.dx)
    };
}

function drawArrow(x1, y1, x2, y2) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = 6;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

function drawFluxArrows() {
    const T = sheet.temperature;

    ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.lineWidth = 1.5;

    for (let i = arrows.spacing / 2; i < T.length; i += arrows.spacing) {
        for (let j = arrows.spacing / 2; j < T[0].length; j += arrows.spacing) {
            // fluxo de calor: q ∝ −∇T (vai do quente para o frio)
            const gradient = gradientAt(i, j);
            let qx = -gradient.x * arrows.scale;
            let qy = -gradient.y * arrows.scale;

            const length = Math.hypot(qx, qy);
            if (length < 1.5) continue;
            if (length > arrows.maxLength) {
                qx *= arrows.maxLength / length;
                qy *= arrows.maxLength / length;
            }

            const x = sheetLeft() + (j + 0.5) * sheet.cellWidth;
            const y = sheetTop() + (i + 0.5) * sheet.cellHeight;
            drawArrow(x - qx / 2, y - qy / 2, x + qx / 2, y + qy / 2);
        }
    }
}

function drawLegend() {
    const left = sheetLeft();
    const width = sheet.temperature[0].length * sheet.cellWidth;
    const top = sheetTop() + sheet.temperature.length * sheet.cellHeight + 14;

    const gradient = ctx.createLinearGradient(left, 0, left + width, 0);
    for (let s = 0; s <= 1; s += 0.25) {
        gradient.addColorStop(s, temperatureColor(s * sheet.maxTemperature));
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(left, top, width, 8);

    ctx.fillStyle = "#666";
    ctx.font = "11px sans-serif";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText("0°", left, top + 12);
    ctx.textAlign = "right";
    ctx.fillText(`${sheet.maxTemperature}°`, left + width, top + 12);

    ctx.textAlign = "center";
    if (mouse.inside) {
        const t = sheet.temperature[mouse.i][mouse.j];
        const g = gradientAt(mouse.i, mouse.j);
        ctx.font = "11px monospace";
        ctx.fillText(
            `T(${mouse.j}, ${mouse.i}) = ${t.toFixed(1)}°   q = (${(-g.x).toFixed(1)}, ${(-g.y).toFixed(1)})`,
            left + width / 2, top + 12
        );
    } else {
        ctx.fillText("setas: fluxo de calor q = −∇T", left + width / 2, top + 12);
    }
}
function drawFormulas() {
    const r = sheet.alpha * sheet.dt / (sheet.dx ** 2);

    const left = sheetLeft();
    const right = screen.width - left;

    ctx.fillStyle = "black";
    ctx.textBaseline = "alphabetic";

    ctx.textAlign = "left";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("Condução de calor 2D", left, 28);

    ctx.textAlign = "right";
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#666";
    ctx.fillText("bordas isoladas", right, 28);

    ctx.fillStyle = "black";
    ctx.font = "italic 15px serif";
    ctx.textAlign = "left";
    ctx.fillText("∂T/∂t = α · ∇²T", left, 52);
    ctx.textAlign = "right";
    ctx.fillText("q = −k · ∇T", right, 52);

    ctx.textAlign = "left";
    ctx.fillText("Tᵢ,ⱼⁿ⁺¹ = Tᵢ,ⱼⁿ + r · (Tᵢ₊₁,ⱼ + Tᵢ₋₁,ⱼ + Tᵢ,ⱼ₊₁ + Tᵢ,ⱼ₋₁ − 4Tᵢ,ⱼ)", left, 74);

    ctx.font = "11px monospace";
    ctx.fillStyle = "#666";
    ctx.fillText(`r = α·Δt/Δx² = ${r.toFixed(2)}`, left, 96);
    ctx.textAlign = "right";
    ctx.fillText(`n = ${sheet.step}   ΣT = ${totalEnergy().toFixed(0)}`, right, 96);
}




function draw() {
    ctx.clearRect(0, 0, screen.width, screen.height);
    drawFormulas();
    drawSheet();
    drawFluxArrows();
    drawLegend();
}

cnv.addEventListener("mousemove", (event) => {
    const rect = cnv.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (cnv.width / rect.width) - sheetLeft();
    const y = (event.clientY - rect.top) * (cnv.height / rect.height) - sheetTop();

    mouse.j = Math.floor(x / sheet.cellWidth);
    mouse.i = Math.floor(y / sheet.cellHeight);
    mouse.inside = mouse.i >= 0 && mouse.j >= 0
        && mouse.i < sheet.temperature.length && mouse.j < sheet.temperature[0].length;
});
cnv.addEventListener("mouseleave", () => mouse.inside = false);

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

defineInitialTemperature();
loop();
