const cnv = document.getElementById("cnv");
const ctx = cnv.getContext("2d");

const screen = {
    width: cnv.width,
    height: cnv.height,
};

let mousePosition = {
    x: 0,
    y: 0,
};

const mesh = {
    width: 200,
    height: 200,
    cellWidth: 3,
    cellHeight: 3,
    displacement: [],
    displacementOld: [],
    displacementNew: [],
    obstacle: [],
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
    const radius = 1;

    mesh.displacement = Array.from({ length: mesh.height + 1 }, (_, y) =>
        Array.from({ length: mesh.width + 1 }, (_, x) => {
            const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

            return distance <= radius ? mesh.maxDisplacement : 0;
        }),
    );

    mesh.step = 0;
}

function displacementColor(d) {
    // Mapeia o deslocamento para uma faixa de luminosidade (ex: de 10% a 90%)
    // 'ratio' normaliza o deslocamento entre 0 e 1
    const ratio = Math.min(Math.max((d / 20 + 1) / 2, 0), 1);
    const lightness = 10 + ratio * 80; // Vai de 10% (escuro) a 90% (claro)

    return `hsl(240, 100%, ${lightness}%)`;
}

function meshLeft() {
    return Math.round(
        screen.width / 2 - (mesh.displacement[0].length * mesh.cellWidth) / 2,
    );
}

function meshTop() {
    return 110;
}

function drawMesh() {
    for (let i = 0; i < mesh.displacement.length; i++) {
        for (let j = 0; j < mesh.displacement[0].length; j++) {
            ctx.fillStyle = mesh.obstacle[i][j]
                ? "#6b5f55"
                : displacementColor(mesh.displacement[i][j]);
            ctx.fillRect(
                meshLeft() + j * mesh.cellWidth,
                meshTop() + i * mesh.cellHeight,
                mesh.cellWidth,
                mesh.cellHeight,
            );
        }
    }

    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(
        meshLeft(),
        meshTop(),
        mesh.displacement[0].length * mesh.cellWidth,
        mesh.displacement.length * mesh.cellHeight,
    );
}

// Define the obstacle in the mesh (a circle in this case)

function addObstacle(x, y, radius) {
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

function defineObstacles() {
    mesh.obstacle = Array.from({ length: mesh.height + 1 }, () =>
        Array(mesh.width + 1).fill(false),
    );

    addObstacle(60, 60, 8);
    addObstacle(140, 130, 12);
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

function lossEnergy() {
    return 0.99;
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

function draw() {
    ctx.clearRect(0, 0, screen.width, screen.height);
    drawMesh();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

function addWave(event) {
    const rect = cnv.getBoundingClientRect();
    const x =
        (event.clientX - rect.left) * (cnv.width / rect.width) - meshLeft();
    const y =
        (event.clientY - rect.top) * (cnv.height / rect.height) - meshTop();

    const j = Math.floor(x / mesh.cellWidth);
    const i = Math.floor(y / mesh.cellHeight);

    if (
        i < 1 ||
        j < 1 ||
        i >= mesh.displacement.length - 1 ||
        j >= mesh.displacement[0].length - 1
    )
        return;

    mesh.displacement[i][j] = 50;
}
cnv.addEventListener("mousedown", (event) => addWave(event));

defineStartDisplacement();
defineObstacles();
loop();
