#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


def read_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open('r', encoding='utf-8') as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def levenshtein(seq_a: list[str], seq_b: list[str]) -> int:
    if not seq_a:
        return len(seq_b)
    if not seq_b:
        return len(seq_a)
    prev = list(range(len(seq_b) + 1))
    for i, token_a in enumerate(seq_a, start=1):
        cur = [i]
        for j, token_b in enumerate(seq_b, start=1):
            cost = 0 if token_a == token_b else 1
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost))
        prev = cur
    return prev[-1]


def safe_div(num: float, den: float) -> float:
    return num / den if den else 0.0


def compute_wer(samples: list[tuple[str, str]]) -> float:
    errors = 0
    ref_words = 0
    for ref, hyp in samples:
        ref_tokens = ref.split()
        hyp_tokens = hyp.split()
        errors += levenshtein(ref_tokens, hyp_tokens)
        ref_words += len(ref_tokens)
    return safe_div(errors, ref_words)


def compute_cer(samples: list[tuple[str, str]]) -> float:
    errors = 0
    ref_chars = 0
    for ref, hyp in samples:
        ref_tokens = list(ref)
        hyp_tokens = list(hyp)
        errors += levenshtein(ref_tokens, hyp_tokens)
        ref_chars += len(ref_tokens)
    return safe_div(errors, ref_chars)


def ngrams(text: str, n: int) -> dict[str, int]:
    chars = list(text)
    if len(chars) < n:
        return {}
    counts: dict[str, int] = {}
    for i in range(len(chars) - n + 1):
        gram = ''.join(chars[i:i + n])
        counts[gram] = counts.get(gram, 0) + 1
    return counts


def compute_chrf(samples: list[tuple[str, str]], n: int = 6, beta: float = 2.0) -> float:
    if not samples:
        return 0.0
    beta_sq = beta * beta
    values: list[float] = []
    for ref, hyp in samples:
        precisions: list[float] = []
        recalls: list[float] = []
        for order in range(1, n + 1):
            ref_counts = ngrams(ref, order)
            hyp_counts = ngrams(hyp, order)
            overlap = sum(min(hyp_counts.get(k, 0), v) for k, v in ref_counts.items())
            hyp_total = sum(hyp_counts.values())
            ref_total = sum(ref_counts.values())
            precisions.append(safe_div(overlap, hyp_total))
            recalls.append(safe_div(overlap, ref_total))
        p = sum(precisions) / n
        r = sum(recalls) / n
        if p == 0.0 and r == 0.0:
            values.append(0.0)
            continue
        values.append((1 + beta_sq) * p * r / ((beta_sq * p) + r))
    return sum(values) / len(values)


def paired_from_rows(ref_rows: list[dict], hyp_rows: list[dict], key: str) -> list[tuple[str, str]]:
    by_id = {str(row['id']): str(row[key]) for row in hyp_rows if 'id' in row and key in row}
    pairs: list[tuple[str, str]] = []
    for row in ref_rows:
        sample_id = str(row.get('id', ''))
        if sample_id and sample_id in by_id and key in row:
            pairs.append((str(row[key]), by_id[sample_id]))
    return pairs


def print_metric(name: str, value: float) -> None:
    print(f"{name}: {value:.4f}")


def main() -> int:
    parser = argparse.ArgumentParser(description='Minimal ASR/MT benchmark runner (WER/CER/chrF).')
    parser.add_argument('--asr-ref', type=Path)
    parser.add_argument('--asr-hyp', type=Path)
    parser.add_argument('--mt-ref', type=Path)
    parser.add_argument('--mt-hyp', type=Path)
    args = parser.parse_args()

    ran_any = False

    if args.asr_ref and args.asr_hyp:
        asr_ref = read_jsonl(args.asr_ref)
        asr_hyp = read_jsonl(args.asr_hyp)
        pairs = paired_from_rows(asr_ref, asr_hyp, 'text')
        print(f"ASR samples: {len(pairs)}")
        print_metric('ASR_WER', compute_wer(pairs))
        print_metric('ASR_CER', compute_cer(pairs))
        ran_any = True

    if args.mt_ref and args.mt_hyp:
        mt_ref = read_jsonl(args.mt_ref)
        mt_hyp = read_jsonl(args.mt_hyp)
        pairs = paired_from_rows(mt_ref, mt_hyp, 'translation')
        print(f"MT samples: {len(pairs)}")
        print_metric('MT_chrF', compute_chrf(pairs))
        ran_any = True

    if not ran_any:
        parser.error('Provide --asr-ref/--asr-hyp and/or --mt-ref/--mt-hyp')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
