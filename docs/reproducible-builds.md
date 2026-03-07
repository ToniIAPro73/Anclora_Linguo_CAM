# Reproducible Builds

## Versiones fijadas
- Node.js: ver `.nvmrc`
- Python: ver `.python-version`

## Frontend
```bash
nvm use
npm ci
npm run lint
npm run test
npm run build
```

## Backend ASR/MT
```bash
cd services/asr-mt
python -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
python -m py_compile app/main.py
```

## Notas
- `requirements.txt` y `requirements-ml.txt` usan versiones fijas.
- En CI, usar `npm ci` (no `npm install`) para dependencia determinista.
- Para entornos productivos, conservar lockfiles y versionado de modelos con checksum (`scripts/model_manager.py`).
