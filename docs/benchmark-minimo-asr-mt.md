# Benchmark Minimo ASR/MT

Script: `services/asr-mt/scripts/benchmark_runner.py`

## Formato de entrada (JSONL)
### ASR referencia (`asr_ref.jsonl`)
```json
{"id":"1","text":"hola como estas"}
{"id":"2","text":"quiero visitar la propiedad"}
```

### ASR hipotesis (`asr_hyp.jsonl`)
```json
{"id":"1","text":"hola como estas"}
{"id":"2","text":"quiero visitar propiedad"}
```

### MT referencia (`mt_ref.jsonl`)
```json
{"id":"1","translation":"hello how are you"}
{"id":"2","translation":"i want to visit the property"}
```

### MT hipotesis (`mt_hyp.jsonl`)
```json
{"id":"1","translation":"hello how are you"}
{"id":"2","translation":"i want to visit property"}
```

## Ejecucion
```bash
cd services/asr-mt
python scripts/benchmark_runner.py \
  --asr-ref fixtures/asr_ref.jsonl --asr-hyp fixtures/asr_hyp.jsonl \
  --mt-ref fixtures/mt_ref.jsonl --mt-hyp fixtures/mt_hyp.jsonl
```

## Salida
- `ASR_WER`
- `ASR_CER`
- `MT_chrF`

## Objetivos iniciales (recomendados)
- ASR_WER <= 0.25
- MT_chrF >= 0.45

