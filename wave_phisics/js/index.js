const cnv = document.getElementById("cnv");
const ctx = cnv.getContext("2d");

const screen = {
    width: cnv.width,
    height: cnv.height,
};

const mesh = {
    width: 80,
    height: 80,
    cellWidth: 5,
    cellHeight: 5,
    displacement: [],
    displacementOld: [],
    displacementNew: [],
    c: 0.2,
    dt: 1,
    dx: 1,
    maxDisplacement: 150,
    step: 0,
};

// Define the initial displacement of the mesh

function defineStartDisplacement() {
    const centerX = mesh.width / 2;
    const centerY = mesh.height / 2;
    const radius = 10;

    mesh.displacement = Array.from({ length: mesh.height + 1 }, (_, y) =>
        Array.from({ length: mesh.width + 1 }, (_, x) => {
            const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

            return distance <= radius ? mesh.maxDisplacement : 0;
        }),
    );

    mesh.step = 0;
}

// Render the mesh with colors based on displacement

function displacementColor(d) {
    const hue = (1 - d / mesh.maxDisplacement) * 240;
    return `hsl(${hue}, 100%, 50%)`;
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
            ctx.fillStyle = displacementColor(mesh.displacement[i][j]);
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

function calculateNextWave() {
    for (let i = 1; i < mesh.displacement.length - 1; i++) {
        for (let j = 1; j < mesh.displacement[0].length - 1; j++) {
            mesh.displacementNew[i][j] = (2 * mesh.displacement[i][j]) - mesh.displacementOld[i][j] + ((courantNumber() ** 2) * (
                mesh.displacement[i+1][j] +
                mesh.displacement[i-1][j] +
                mesh.displacement[i][j+1] +
                mesh.displacement[i][j-1] -
                4 * mesh.displacement[i][j]
            ));    
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

function draw() {
    ctx.clearRect(0, 0, screen.width, screen.height);
    drawMesh();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

defineStartDisplacement();
loop();
