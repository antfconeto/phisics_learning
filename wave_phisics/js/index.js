
const cnv = document.getElementById("cnv");
const ctx = cnv.getContext("2d");

const screen = {
    width: cnv.width,
    height: cnv.height
};

function update() {
}
function draw() {
    ctx.clearRect(0, 0, screen.width, screen.height);

}
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}
loop()