# Visual Forge (TripoSR)

Local image-to-3D pipeline for the Sovereign Biosphere. No cloud API.

## One-time install

```powershell
powershell -ExecutionPolicy Bypass -File D:\Hearth\prosper2\scripts\visual_forge\install_forge.ps1
```

Requires: Git, Python 3.8+, NVIDIA GPU with ~6 GB VRAM (CUDA 11.8 PyTorch wheel).

## Generate a model

1. Drop a PNG/JPG into `scripts/visual_forge/inbox/`
2. Run:

```powershell
powershell -ExecutionPolicy Bypass -File D:\Hearth\prosper2\scripts\visual_forge\generate_asset.ps1
```

Or pass an explicit path:

```powershell
.\generate_asset.ps1 D:\Hearth\prosper2\scripts\visual_forge\inbox\wind-catcher.png
```

Output lands in `frontend/public/models/<name>_<timestamp>/` as `.glb`.

## Gradio UI (optional)

```powershell
cd D:\Hearth\prosper2\scripts\visual_forge\TripoSR
..\..\venv\Scripts\python.exe gradio_app.py
```

## Troubleshooting

If you see `torchmcubes was not compiled with CUDA support`:

```powershell
D:\Hearth\prosper2\scripts\visual_forge\venv\Scripts\pip.exe uninstall -y torchmcubes
D:\Hearth\prosper2\scripts\visual_forge\venv\Scripts\pip.exe install git+https://github.com/tatsy/torchmcubes.git
```

Ensure local CUDA major version matches PyTorch (this forge pins **cu118**).
