# phisics_learning

Simulações de física feitas por hobby, em JavaScript puro com Canvas.

## temperature_phisics

Condução de calor resolvida por diferenças finitas, com setas mostrando a
direção e a intensidade do fluxo de calor (Lei de Fourier, `q = −k · ∇T`).
As bordas são isoladas, então a energia total (`ΣT`) se conserva.

- **1D** — barra: `∂T/∂t = α · ∂²T/∂x²`. Abra `temperature_phisics/1d/index.html`.
- **2D** — placa: `∂T/∂t = α · ∇²T`. Abra `temperature_phisics/2d/index.html`
  (passe o mouse sobre a placa para ver a temperatura de cada ponto).
